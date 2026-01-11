#!/bin/bash
# Canary Deployment Script for SoulWallet
# Deploys a canary version with weighted traffic routing

set -euo pipefail

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
CANARY_PERCENTAGE="${CANARY_PERCENTAGE:-10}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-soulwallet}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"
PROMOTION_WAIT_SECONDS="${PROMOTION_WAIT_SECONDS:-600}"
ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-0.01}"
DRY_RUN="false"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --percentage)
      CANARY_PERCENTAGE="${2:-10}"
      shift 2
      ;;
    --environment)
      ENVIRONMENT="${2:-production}"
      shift 2
      ;;
    --promote)
      ACTION="promote"
      shift
      ;;
    --rollback)
      ACTION="rollback"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--percentage N] [--environment ENV] [--promote] [--rollback] [--dry-run]"
      exit 1
      ;;
  esac
done

ACTION="${ACTION:-deploy}"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [CANARY] $*"
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

http_status() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000"
}

wait_for_health() {
  local url="$1"
  local deadline=$(($(date +%s) + HEALTH_TIMEOUT_SECONDS))

  while [[ $(date +%s) -lt $deadline ]]; do
    local status
    status="$(http_status "$url/health")"
    if [[ "$status" == "200" ]]; then
      log "Health check passed for $url"
      return 0
    fi
    log "Waiting for health check ($status)..."
    sleep 5
  done
  return 1
}

detect_active_color() {
  # Probe health endpoints to determine which backend color is active
  local blue_status green_status
  
  blue_status="$(http_status "http://backend-blue:3001/health" 2>/dev/null || echo "000")"
  green_status="$(http_status "http://backend-green:3002/health" 2>/dev/null || echo "000")"
  
  if [[ "$green_status" == "200" ]]; then
    echo "green"
  elif [[ "$blue_status" == "200" ]]; then
    echo "blue"
  else
    # Fallback: parse current nginx config to determine active upstream
    if grep -q "backend-green:3002" nginx/nginx.conf 2>/dev/null | grep -v "#" | head -1; then
      echo "green"
    else
      echo "blue"
    fi
  fi
}

update_nginx_weights() {
  local canary_weight="$1"
  local main_weight=$((100 - canary_weight))
  
  # Detect active backend color (blue or green)
  local active_color
  active_color="$(detect_active_color)"
  local active_host active_port
  
  if [[ "$active_color" == "green" ]]; then
    active_host="backend-green"
    active_port="3002"
  else
    active_host="backend-blue"
    active_port="3001"
  fi

  log "Updating nginx weights: $active_color=$main_weight%, canary=$canary_weight%"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would update nginx weights (active: $active_color)"
    return 0
  fi

  # Update nginx.conf - rewrite the MAIN backend upstream to include canary
  # Uses dynamically detected active color instead of hardcoding blue
  local tmp
  tmp="$(mktemp)"
  
  if [[ "$canary_weight" -gt 0 ]]; then
    # Canary mode: rewrite backend upstream to include both active color and canary servers
    awk -v main="$main_weight" -v canary="$canary_weight" -v host="$active_host" -v port="$active_port" '
      /upstream backend \{/ { 
        print
        print "        server " host ":" port " weight=" main " max_fails=3 fail_timeout=30s;"
        print "        server backend-canary:3003 weight=" canary " max_fails=3 fail_timeout=30s;"
        skip_until_close = 1
        next
      }
      skip_until_close && /keepalive/ { print; next }
      skip_until_close && /^\}/ { skip_until_close = 0 }
      skip_until_close { next }
      { print }
    ' nginx/nginx.conf > "$tmp"
  else
    # Normal mode: backend upstream points only to active server
    awk -v host="$active_host" -v port="$active_port" '
      /upstream backend \{/ { 
        print
        print "        server " host ":" port " max_fails=3 fail_timeout=30s;"
        skip_until_close = 1
        next
      }
      skip_until_close && /keepalive/ { print; next }
      skip_until_close && /^\}/ { skip_until_close = 0 }
      skip_until_close { next }
      { print }
    ' nginx/nginx.conf > "$tmp"
  fi
  
  mv "$tmp" nginx/nginx.conf

  # Reload nginx
  compose exec -T nginx nginx -t
  compose exec -T nginx nginx -s reload
  
  log "Nginx config updated and reloaded (active: $active_color)"
}

monitor_canary() {
  local duration="$1"
  local url="http://localhost"
  local end=$(($(date +%s) + duration))
  local total=0
  local errors=0

  log "Monitoring canary for $duration seconds..."

  while [[ $(date +%s) -lt $end ]]; do
    total=$((total + 1))
    local status
    status="$(http_status "$url/health")"
    if [[ "$status" != "200" ]]; then
      errors=$((errors + 1))
    fi
    
    # Check error rate every 30 seconds
    if [[ $((total % 15)) -eq 0 ]]; then
      local rate
      rate=$(echo "scale=4; $errors / $total" | bc)
      log "Current error rate: $rate (threshold: $ERROR_RATE_THRESHOLD)"
      
      # Fail early if error rate exceeds threshold
      if (( $(echo "$rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        log "ERROR: Error rate exceeded threshold, initiating rollback"
        return 1
      fi
    fi
    
    sleep 2
  done

  if [[ "$total" -gt 0 ]]; then
    local final_rate
    final_rate=$(echo "scale=4; $errors / $total" | bc)
    log "Final error rate: $final_rate"
    if (( $(echo "$final_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
      return 1
    fi
  fi
  return 0
}

deploy_canary() {
  log "Starting canary deployment with $CANARY_PERCENTAGE% traffic"

  # Build and start canary service
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would build and start canary service"
  else
    compose up -d --build backend-canary
  fi

  # Wait for canary to be healthy
  log "Waiting for canary service health..."
  if ! wait_for_health "http://localhost:3003"; then
    log "ERROR: Canary failed health checks"
    rollback_canary
    exit 1
  fi

  # Update nginx to route traffic to canary
  update_nginx_weights "$CANARY_PERCENTAGE"

  log "Canary deployed with $CANARY_PERCENTAGE% traffic"
  log "Monitoring canary for $PROMOTION_WAIT_SECONDS seconds..."

  # Monitor canary
  if [[ "$DRY_RUN" != "true" ]]; then
    if ! monitor_canary "$PROMOTION_WAIT_SECONDS"; then
      log "Canary failed monitoring, rolling back"
      rollback_canary
      exit 1
    fi
  fi

  log "Canary passed monitoring period!"
  log "To promote: $0 --promote"
  log "To rollback: $0 --rollback"
}

promote_canary() {
  log "Promoting canary to production"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would promote canary"
    return 0
  fi

  # Increase canary traffic gradually
  for weight in 25 50 75 100; do
    log "Increasing canary traffic to $weight%"
    update_nginx_weights "$weight"
    sleep 60

    # Quick health check
    if [[ "$(http_status "http://localhost/health")" != "200" ]]; then
      log "ERROR: Health check failed during promotion"
      rollback_canary
      exit 1
    fi
  done

  # Replace main with canary
  log "Replacing main service with canary code"
  compose up -d --build backend
  wait_for_health "http://localhost:3001"

  # Restore normal routing
  update_nginx_weights 0

  # Stop canary
  compose stop backend-canary || true

  log "Canary promoted to production successfully!"
}

rollback_canary() {
  log "Rolling back canary deployment"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would rollback canary"
    return 0
  fi

  # Remove canary from routing
  update_nginx_weights 0

  # Stop canary service
  compose stop backend-canary || true

  log "Canary rolled back successfully"
}

# Main execution
log "Canary deployment script started (action=$ACTION, env=$ENVIRONMENT, dry_run=$DRY_RUN)"

case "$ACTION" in
  deploy)
    deploy_canary
    ;;
  promote)
    promote_canary
    ;;
  rollback)
    rollback_canary
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac

log "Canary deployment script completed"
