#!/bin/bash
# Rolling Restart Script for SoulWallet
# Performs zero-downtime rolling restart of services

set -euo pipefail

# Configuration
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-soulwallet}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"
RESTART_DELAY_SECONDS="${RESTART_DELAY_SECONDS:-10}"
DRY_RUN="${DRY_RUN:-false}"

# Parse arguments
SERVICE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --timeout)
      HEALTH_TIMEOUT_SECONDS="${2:-120}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --service <service_name> [--dry-run] [--timeout <seconds>]"
      exit 1
      ;;
  esac
done

if [[ -z "$SERVICE" ]]; then
  echo "Error: --service is required" >&2
  echo "Usage: $0 --service <service_name> [--dry-run]"
  exit 1
fi

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [ROLLING-RESTART] $*"
}

compose() {
  local files=(-f docker-compose.yml)
  if [[ -f docker-compose.prod.yml ]]; then
    files+=(-f docker-compose.prod.yml)
  fi
  docker-compose "${files[@]}" -p "$COMPOSE_PROJECT_NAME" "$@"
}

http_status() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000"
}

wait_for_health() {
  local service="$1"
  local port="$2"
  local deadline=$(($(date +%s) + HEALTH_TIMEOUT_SECONDS))

  while [[ $(date +%s) -lt $deadline ]]; do
    local status
    status="$(http_status "http://localhost:${port}/health")"
    if [[ "$status" == "200" ]]; then
      log "Health check passed for $service on port $port"
      return 0
    fi
    log "Waiting for $service health check ($status)..."
    sleep 5
  done
  
  log "ERROR: Health check timeout for $service"
  return 1
}

get_service_port() {
  local service="$1"
  case "$service" in
    backend|backend-blue) echo "3001" ;;
    backend-green) echo "3002" ;;
    backend-canary) echo "3003" ;;
    *) echo "3001" ;;  # Default
  esac
}

rolling_restart() {
  local service="$1"
  local port
  port="$(get_service_port "$service")"
  
  log "Starting rolling restart of $service"
  
  # Get replica count
  local replicas
  replicas=$(compose ps -q "$service" 2>/dev/null | wc -l || echo "1")
  replicas=${replicas:-1}
  
  log "Service $service has $replicas replica(s)"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] Would restart $service with $replicas replicas"
    return 0
  fi
  
  if [[ "$replicas" -le 1 ]]; then
    # Single replica: simple restart with health check
    log "Restarting single replica of $service..."
    
    compose restart "$service"
    
    sleep "$RESTART_DELAY_SECONDS"
    
    if ! wait_for_health "$service" "$port"; then
      log "ERROR: $service failed health check after restart"
      exit 1
    fi
  else
    # Multiple replicas: restart one at a time
    for i in $(seq 1 "$replicas"); do
      log "Restarting replica $i of $replicas for $service..."
      
      # Scale down by 1, then back up
      compose up -d --scale "$service=$((replicas - 1))" "$service"
      sleep "$RESTART_DELAY_SECONDS"
      
      compose up -d --scale "$service=$replicas" "$service"
      sleep "$RESTART_DELAY_SECONDS"
      
      if ! wait_for_health "$service" "$port"; then
        log "ERROR: $service replica $i failed health check"
        exit 1
      fi
      
      log "Replica $i restarted successfully"
    done
  fi
  
  log "Rolling restart of $service completed successfully"
}

# Main execution
log "Rolling restart script started (service=$SERVICE, dry_run=$DRY_RUN)"

rolling_restart "$SERVICE"

log "Rolling restart script completed"
