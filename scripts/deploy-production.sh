#!/bin/bash

# =============================================================================
# PRODUCTION DEPLOYMENT SCRIPT - SOULWALLET
# =============================================================================
# This script handles the complete production deployment process
# Author: SoulWallet Development Team
# Version: 1.0.0
# =============================================================================

set -e  # Exit on error

# Configuration
DEPLOY_DIR="/var/www/soulwallet"
BACKUP_DIR="/var/backups/soulwallet"
LOG_FILE="/var/log/soulwallet/deploy-$(date +%Y%m%d-%H%M%S).log"
HEALTH_CHECK_URL="https://api.soulwallet.com/health"
NOTIFICATION_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"
    notify "Deployment failed: $*"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "$LOG_FILE"
}

notify() {
    local message="$1"
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"SoulWallet Deployment: $message\"}" \
            "$NOTIFICATION_WEBHOOK" >/dev/null 2>&1 || true
    fi
}

# =============================================================================
# PRE-DEPLOYMENT CHECKS
# =============================================================================

pre_deployment_checks() {
    log "Starting pre-deployment checks..."
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_NODE="20.0.0"
    if [[ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE" ]]; then
        error "Node.js version $REQUIRED_NODE or higher required (current: $NODE_VERSION)"
    fi
    
    # Check required environment variables
    local required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
        "ADMIN_KEY"
        "REDIS_URL"
        "SOLANA_RPC_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    # Check PostgreSQL connection
    if ! pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
        error "Cannot connect to PostgreSQL database"
    fi
    
    # Check Redis connection
    if ! redis-cli ping >/dev/null 2>&1; then
        warning "Redis is not available - using memory store"
    fi
    
    # Check disk space
    AVAILABLE_SPACE=$(df "$DEPLOY_DIR" | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=$((1024 * 1024))  # 1GB in KB
    if [[ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]]; then
        error "Insufficient disk space (available: ${AVAILABLE_SPACE}KB, required: ${REQUIRED_SPACE}KB)"
    fi
    
    log "Pre-deployment checks passed ✓"
}

# =============================================================================
# BACKUP CURRENT DEPLOYMENT
# =============================================================================

backup_current() {
    log "Creating backup of current deployment..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup database
    log "Backing up database..."
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_PATH/database.sql.gz"
    
    # Backup application files
    log "Backing up application files..."
    if [[ -d "$DEPLOY_DIR" ]]; then
        tar -czf "$BACKUP_PATH/app.tar.gz" -C "$DEPLOY_DIR" .
    fi
    
    # Backup environment files
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        cp "$DEPLOY_DIR/.env" "$BACKUP_PATH/.env.backup"
    fi
    
    log "Backup completed: $BACKUP_PATH"
}

# =============================================================================
# BUILD APPLICATION
# =============================================================================

build_application() {
    log "Building application..."
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci --production=false
    
    # Generate Prisma client
    log "Generating Prisma client..."
    npx prisma generate
    
    # Build TypeScript
    log "Building TypeScript..."
    npm run server:build
    
    # Build frontend (if needed)
    if [[ -f "package.json" ]] && grep -q "\"build:web\"" package.json; then
        log "Building web frontend..."
        npm run build:web
    fi
    
    # Optimize for production
    log "Optimizing for production..."
    npm prune --production
    
    log "Build completed ✓"
}

# =============================================================================
# DATABASE MIGRATION
# =============================================================================

migrate_database() {
    log "Running database migrations..."
    
    # Create migration backup
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/pre-migration-$(date +%Y%m%d-%H%M%S).sql.gz"
    
    # Run Prisma migrations
    npx prisma migrate deploy
    
    # Verify migration status
    npx prisma migrate status
    
    log "Database migration completed ✓"
}

# =============================================================================
# DEPLOY APPLICATION
# =============================================================================

deploy_application() {
    log "Deploying application..."
    
    # Stop current application
    log "Stopping current application..."
    if pm2 list | grep -q "soulwallet-api"; then
        pm2 stop soulwallet-api || true
        pm2 delete soulwallet-api || true
    fi
    
    # Copy files to deployment directory
    log "Copying files to deployment directory..."
    mkdir -p "$DEPLOY_DIR"
    rsync -av --delete \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.env.local \
        --exclude=logs \
        --exclude=backups \
        ./ "$DEPLOY_DIR/"
    
    # Install production dependencies
    cd "$DEPLOY_DIR"
    npm ci --production
    
    # Set up environment
    if [[ -f ".env.production" ]]; then
        cp .env.production .env
    fi
    
    # Start application with PM2
    log "Starting application with PM2..."
    pm2 start pm2.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    pm2 startup systemd -u soulwallet --hp /home/soulwallet
    
    log "Application deployed ✓"
}

# =============================================================================
# POST-DEPLOYMENT VERIFICATION
# =============================================================================

verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for application to start
    sleep 10
    
    # Check PM2 status
    if ! pm2 list | grep -q "online.*soulwallet-api"; then
        error "Application failed to start"
    fi
    
    # Health check
    log "Running health check..."
    for i in {1..10}; do
        if curl -f -s "$HEALTH_CHECK_URL" >/dev/null; then
            log "Health check passed ✓"
            break
        fi
        
        if [[ $i -eq 10 ]]; then
            error "Health check failed after 10 attempts"
        fi
        
        warning "Health check attempt $i failed, retrying..."
        sleep 5
    done
    
    # Check critical endpoints
    local endpoints=(
        "/health/db"
        "/health/redis"
        "/health/ready"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if ! curl -f -s "${HEALTH_CHECK_URL%/health}$endpoint" >/dev/null; then
            warning "Endpoint $endpoint check failed"
        fi
    done
    
    # Check logs for errors
    if pm2 logs soulwallet-api --lines 50 --nostream | grep -q "ERROR"; then
        warning "Errors found in application logs"
    fi
    
    log "Deployment verification completed ✓"
}

# =============================================================================
# ROLLBACK
# =============================================================================

rollback() {
    error "Rolling back deployment..."
    
    # Stop failed deployment
    pm2 stop soulwallet-api || true
    pm2 delete soulwallet-api || true
    
    # Restore from backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/backup-*/app.tar.gz 2>/dev/null | head -1)
    
    if [[ -n "$LATEST_BACKUP" ]]; then
        log "Restoring from backup: $LATEST_BACKUP"
        tar -xzf "$LATEST_BACKUP" -C "$DEPLOY_DIR"
        
        # Restore database if needed
        DB_BACKUP="${LATEST_BACKUP%/app.tar.gz}/database.sql.gz"
        if [[ -f "$DB_BACKUP" ]]; then
            log "Restoring database..."
            gunzip -c "$DB_BACKUP" | psql "$DATABASE_URL"
        fi
        
        # Restart application
        cd "$DEPLOY_DIR"
        pm2 start pm2.config.js --env production
        
        log "Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# =============================================================================
# CLEANUP
# =============================================================================

cleanup() {
    log "Cleaning up..."
    
    # Remove old backups (keep last 30 days)
    find "$BACKUP_DIR" -name "backup-*" -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
    
    # Clear old logs
    find /var/log/soulwallet -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Clear PM2 logs
    pm2 flush
    
    # Clear npm cache
    npm cache clean --force
    
    log "Cleanup completed ✓"
}

# =============================================================================
# MAIN DEPLOYMENT FLOW
# =============================================================================

main() {
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log "==================================================================="
    log "Starting SoulWallet Production Deployment"
    log "==================================================================="
    
    notify "Starting deployment..."
    
    # Set error trap
    trap rollback ERR
    
    # Run deployment steps
    pre_deployment_checks
    backup_current
    build_application
    migrate_database
    deploy_application
    verify_deployment
    cleanup
    
    # Remove error trap
    trap - ERR
    
    log "==================================================================="
    log "Deployment completed successfully!"
    log "==================================================================="
    
    notify "Deployment completed successfully! ✅"
}

# Run if not sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
