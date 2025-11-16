#!/bin/bash

# emergency-rollback.sh
# Emergency rollback script for SoulWallet production
# Restores database and application to last known good state
# Author: SoulWallet Development Team
# Version: 1.0.0

set -e

# Configuration
BACKUP_DIR="./backups"
LOG_FILE="logs/rollback.log"
NOTIFICATION_WEBHOOK="${SLACK_WEBHOOK_URL:-}"  # Set in environment or .env
AUTO_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto)
            AUTO_MODE=true
            shift
            ;;
        *)
            echo "Usage: $0 [--auto]" >&2
            echo "  --auto  Skip confirmation prompts" >&2
            exit 1
            ;;
    esac
done

# Logging function
log() {
    local message="$(date '+%Y-%m-%d %H:%M:%S') - $*"
    echo "$message" | tee -a "$LOG_FILE"
}

# Notification function
notify() {
    local message="$1"
    log "$message"
    
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"🚨 SoulWallet Emergency Rollback: $message\"}" \
             "$NOTIFICATION_WEBHOOK" >/dev/null 2>&1 || true
    fi
}

# Error handling
error_exit() {
    local message="$1"
    notify "FAILED: $message"
    echo "Manual rollback instructions:" >&2
    echo "1. Check logs in $LOG_FILE" >&2
    echo "2. Restore from safety backup if available" >&2
    echo "3. Contact DevOps team" >&2
    exit 1
}

# Create logs directory
mkdir -p logs

log "Starting emergency rollback"

# Step 1: Find latest backup
log "Finding latest backup..."
if [[ ! -d "$BACKUP_DIR" ]]; then
    error_exit "Backup directory $BACKUP_DIR not found"
fi

# Enable nullglob to handle no matches gracefully
shopt -s nullglob
BACKUP_FILES=("$BACKUP_DIR"/*.sql "$BACKUP_DIR"/*.sql.gz "$BACKUP_DIR"/*.dump "$BACKUP_DIR"/*.backup)
shopt -u nullglob

if [[ ${#BACKUP_FILES[@]} -eq 0 ]]; then
    error_exit "No backup files found in $BACKUP_DIR"
fi

LATEST_BACKUP=$(ls -t "${BACKUP_FILES[@]}" 2>/dev/null | head -1)
if [[ -z "$LATEST_BACKUP" ]]; then
    error_exit "No backup files found in $BACKUP_DIR"
fi

BACKUP_DATE=$(stat -c %y "$LATEST_BACKUP" 2>/dev/null || stat -f %Sm -t "%Y-%m-%d %H:%M:%S" "$LATEST_BACKUP")
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)

log "Latest backup: $LATEST_BACKUP"
log "Backup date: $BACKUP_DATE"
log "Backup size: $BACKUP_SIZE"

# Step 2: Confirm rollback
if [[ "$AUTO_MODE" != true ]]; then
    echo ""
    echo "EMERGENCY ROLLBACK - THIS WILL CAUSE DOWNTIME"
    echo "=============================================="
    echo "Backup file: $LATEST_BACKUP"
    echo "Backup date: $BACKUP_DATE"
    echo "Backup size: $BACKUP_SIZE"
    echo ""
    echo "This will:"
    echo "- Stop the application"
    echo "- Restore database from backup"
    echo "- Revert application code to previous version"
    echo "- Restart the application"
    echo ""
    read -p "Are you sure you want to proceed? Type 'yes' to continue: " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        log "Rollback cancelled by user"
        exit 0
    fi
fi

notify "Emergency rollback initiated - backup: $(basename "$LATEST_BACKUP")"

# Step 3: Stop application
log "Stopping application..."

# Try PM2 first
if command -v pm2 >/dev/null 2>&1 && pm2 list >/dev/null 2>&1; then
    log "Stopping PM2 processes"
    pm2 stop all || true
    pm2 delete all || true
elif docker-compose ps backend >/dev/null 2>&1; then
    log "Stopping Docker Compose services"
    docker-compose stop backend || true
elif systemctl is-active --quiet soulwallet 2>/dev/null; then
    log "Stopping systemd service"
    sudo systemctl stop soulwallet || true
else
    log "Warning: Could not detect running application. Proceeding anyway."
fi

# Step 4: Restore database
log "Restoring database from backup..."
if [[ ! -x "./scripts/restore-database.sh" ]]; then
    error_exit "Restore script not found or not executable: ./scripts/restore-database.sh"
fi

./scripts/restore-database.sh --force --no-backup "$LATEST_BACKUP"
log "Database restore completed"

# Step 5: Revert application code
log "Reverting application code..."

# Get previous deployment tag
PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || error_exit "Could not determine previous tag")
log "Reverting to tag: $PREVIOUS_TAG"

git checkout "$PREVIOUS_TAG" || error_exit "Failed to checkout previous tag"

# Rebuild if needed
if [[ -f "package.json" ]]; then
    log "Rebuilding application..."
    npm run build || error_exit "Build failed"
fi

# Step 6: Restart application
log "Restarting application..."

# Try PM2 first
if command -v pm2 >/dev/null 2>&1; then
    log "Starting with PM2"
    pm2 start ecosystem.config.js || pm2 start npm --name "soulwallet" -- start || error_exit "Failed to start with PM2"
elif [[ -f "docker-compose.yml" ]]; then
    log "Starting with Docker Compose"
    docker-compose start backend || error_exit "Failed to start with Docker Compose"
elif systemctl is-active --quiet soulwallet 2>/dev/null; then
    log "Starting systemd service"
    sudo systemctl start soulwallet || error_exit "Failed to start systemd service"
else
    error_exit "Could not determine how to restart application"
fi

# Step 7: Verify health
log "Verifying application health..."
sleep 10

# Check health endpoint
if ! curl -f --max-time 30 http://localhost:3001/health >/dev/null 2>&1; then
    error_exit "Health check failed - application not responding"
fi

# Check database connectivity
if ! curl -f --max-time 30 http://localhost:3001/health/db >/dev/null 2>&1; then
    error_exit "Database health check failed"
fi

# Check application logs for errors
if [[ -f "logs/error.log" ]]; then
    ERROR_COUNT=$(grep -c "ERROR\|FATAL" logs/error.log 2>/dev/null || echo "0")
    if [[ "$ERROR_COUNT" -gt 0 ]]; then
        log "Warning: $ERROR_COUNT errors found in logs after rollback"
    fi
fi

log "Health checks passed"

# Step 8: Notify team
notify "Emergency rollback completed successfully - system restored to $PREVIOUS_TAG"

log "Emergency rollback completed in $(($(date +%s) - $(date +%s -r "$LOG_FILE")) ) seconds"
echo "Rollback completed. Check $LOG_FILE for details."