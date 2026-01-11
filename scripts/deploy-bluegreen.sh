#!/bin/bash
set -euo pipefail

ENVIRONMENT="production"
DRY_RUN="false"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-soulwallet}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-60}"
ERROR_BUDGET_SECONDS="${ERROR_BUDGET_SECONDS:-300}"
ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-0.01}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*"
}

compose() {
  local files=(-f docker-compose.yml)
  if [[ "$ENVIRONMENT" == "production" ]]; then
    files+=(-f docker-compose.prod.yml)
  elif [[ "$ENVIRONMENT" == "staging" ]]; then
    files+=(-f docker-compose.staging.yml)
  fi
  docker-compose "${files[@]}" -p "$COMPOSE_PROJECT_NAME" "$@"
}

service_name_for_color() {
  local color="$1"
  if [[ "$color" == "blue" ]]; then
    echo "backend"
  else
    echo "backend-green"
  fi
}

http_status() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000"
}

wait_for_health() {
  local base_url="$1"
  local deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))

  while [[ $(date +%s) -lt $deadline ]]; do
    local h1
    local h2
    local h3
    h1="$(http_status "$base_url/health")"
    h2="$(http_status "$base_url/health/db")"
    h3="$(http_status "$base_url/health/redis")"
    if [[ "$h1" == "200" && "$h2" == "200" && ( "$h3" == "200" || "$h3" == "503" ) ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

detect_active_color() {
  local blue_ok
  local green_ok
  blue_ok="false"
  green_ok="false"
  if [[ "$(http_status "http://localhost:3001/health")" == "200" ]]; then
    blue_ok="true"
  fi
  if [[ "$(http_status "http://localhost:3002/health")" == "200" ]]; then
    green_ok="true"
  fi

  if [[ "$blue_ok" == "true" && "$green_ok" != "true" ]]; then
    echo "blue"
    return 0
  fi
  if [[ "$green_ok" == "true" && "$blue_ok" != "true" ]]; then
    echo "green"
    return 0
  fi
  if [[ "$blue_ok" == "true" && "$green_ok" == "true" ]]; then
    echo "blue"
    return 0
  fi
  echo "none"
}

switch_nginx_upstream() {
  local to_color="$1"
  local target_line=""
  if [[ "$to_color" == "blue" ]]; then
    target_line="server backend-blue:3001 max_fails=3 fail_timeout=30s;"
  else
    target_line="server backend-green:3002 max_fails=3 fail_timeout=30s;"
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would switch nginx upstream to $to_color"
    return 0
  fi

  local tmp
  tmp="$(mktemp)"
  awk -v repl="$target_line" '
    $0 ~ /^upstream backend \{/ { inblock=1 }
    inblock && $0 ~ /^ *server backend-(blue|green):[0-9]+/ { $0="        " repl }
    inblock && $0 ~ /^\}/ { inblock=0 }
    { print }
  ' nginx/nginx.conf > "$tmp"
  mv "$tmp" nginx/nginx.conf

  compose exec -T nginx nginx -t
  compose exec -T nginx nginx -s reload
}

run_smoke_tests() {
  local url="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would run smoke tests against $url"
    return 0
  fi
  npm run health:test -- --url "$url"
}

monitor_error_budget() {
  local url="$1"
  local end=$(( $(date +%s) + ERROR_BUDGET_SECONDS ))
  local total=0
  local failed=0
  while [[ $(date +%s) -lt $end ]]; do
    total=$((total + 1))
    if [[ "$(http_status "$url/health")" != "200" ]]; then
      failed=$((failed + 1))
    fi
    sleep 2
  done

  if [[ "$total" -eq 0 ]]; then
    return 0
  fi

  TOTAL="$total" FAILED="$failed" THR="$ERROR_RATE_THRESHOLD" node - <<'NODE'
const total = Number(process.env.TOTAL || '0')
const failed = Number(process.env.FAILED || '0')
const thr = Number(process.env.THR || '0')
const rate = total > 0 ? failed / total : 0
process.stdout.write(String(rate))
process.exit(rate <= thr ? 0 : 1)
NODE
}

rollback() {
  local active_color="$1"
  log "Rolling back to $active_color"
  switch_nginx_upstream "$active_color"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would stop standby container"
    return 0
  fi
  if [[ "$active_color" == "blue" ]]; then
    compose stop backend-green || true
  else
    compose stop backend || true
  fi
}

log "Blue-green deployment starting (environment=$ENVIRONMENT, dry_run=$DRY_RUN)"

ACTIVE="$(detect_active_color)"
if [[ "$ACTIVE" == "none" ]]; then
  ACTIVE="blue"
fi
if [[ "$ACTIVE" == "blue" ]]; then
  STANDBY="green"
  STANDBY_URL="http://localhost:3002"
  ACTIVE_URL="http://localhost:3001"
else
  STANDBY="blue"
  STANDBY_URL="http://localhost:3001"
  ACTIVE_URL="http://localhost:3002"
fi

log "Active color: $ACTIVE, standby color: $STANDBY"

if [[ "$DRY_RUN" != "true" ]]; then
  ./scripts/backup-database.sh || true
fi

log "Deploying to standby ($STANDBY)"
if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] Would build and start backend-$STANDBY"
else
  STANDBY_SERVICE="$(service_name_for_color "$STANDBY")"
  compose up -d --build "$STANDBY_SERVICE"
  compose exec -T "$STANDBY_SERVICE" sh -c "npx prisma migrate deploy" || true
fi

log "Waiting for standby health checks"
if ! wait_for_health "$STANDBY_URL"; then
  log "Standby failed health checks"
  rollback "$ACTIVE"
  exit 1
fi

log "Running smoke tests on standby"
run_smoke_tests "$STANDBY_URL"

log "Switching traffic to $STANDBY"
switch_nginx_upstream "$STANDBY"

log "Monitoring post-switch error budget"
if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] Skipping monitoring"
else
  if ! monitor_error_budget "http://localhost"; then
    log "Error budget exceeded; initiating rollback"
    rollback "$ACTIVE"
    exit 1
  fi
fi

log "Soaking before cleanup"
if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] Would wait and stop old container"
else
  sleep 600
  ACTIVE_SERVICE="$(service_name_for_color "$ACTIVE")"
  compose stop "$ACTIVE_SERVICE" || true
fi

log "Blue-green deployment completed"
