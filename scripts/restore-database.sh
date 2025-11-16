#!/bin/bash

# restore-database.sh
# Database restore script for SoulWallet project
# This script restores a PostgreSQL database from a backup file
# Author: SoulWallet Development Team
# Version: 1.0.0

set -euo pipefail

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS] <backup-file>"
    echo ""
    echo "Restore a PostgreSQL database from a backup file."
    echo ""
    echo "OPTIONS:"
    echo "  --force       Skip confirmation prompt"
    echo "  --no-backup   Skip creating safety backup before restore"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 backups/backup-20240101_120000.sql"
    echo "  $0 --force backups/backup.sql.gz"
    echo "  $0 --no-backup backups/backup.dump"
    echo ""
    echo "BACKUP FILE FORMATS:"
    echo "  .sql     Plain SQL format"
    echo "  .sql.gz  Compressed SQL format"
    echo "  .dump    Custom pg_dump format"
    echo "  .backup  Custom pg_dump format"
}

# Configuration variables
BACKUP_FILE=""
DATABASE_URL=""
SAFETY_BACKUP_DIR="./backups/pre-restore"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FORCE_RESTORE=false
SKIP_SAFETY_BACKUP=false
LOG_FILE="logs/restore.log"
SAFETY_BACKUP_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_RESTORE=true
            shift
            ;;
        --no-backup)
            SKIP_SAFETY_BACKUP=true
            shift
            ;;
        -*)
            echo "Unknown option: $1" >&2
            usage
            exit 2
            ;;
        *)
            if [[ -z "$BACKUP_FILE" ]]; then
                BACKUP_FILE="$1"
            else
                echo "Too many arguments" >&2
                usage
                exit 2
            fi
            shift
            ;;
    esac
done

# Argument validation
if [[ -z "$BACKUP_FILE" ]]; then
    usage
    exit 2
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Error: Backup file '$BACKUP_FILE' not found" >&2
    exit 3
fi

if [[ ! -r "$BACKUP_FILE" ]]; then
    echo "Error: Backup file '$BACKUP_FILE' is not readable" >&2
    exit 3
fi

# Validate file extension
case "$BACKUP_FILE" in
    *.sql|*.sql.gz|*.dump|*.backup) ;;
    *)
        echo "Error: Unsupported backup file format. Supported: .sql, .sql.gz, .dump, .backup" >&2
        exit 2
        ;;
esac

# Environment setup
if [[ -z "${DATABASE_URL:-}" ]]; then
    if [[ -f ".env" ]]; then
        source .env
    else
        echo "Error: DATABASE_URL not set and .env file not found" >&2
        exit 4
    fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL not set" >&2
    exit 4
fi

# Parse DATABASE_URL (simple parsing for PostgreSQL)
# Format: postgresql://user:pass@host:port/db?params
if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo "Error: Invalid DATABASE_URL format" >&2
    exit 4
fi

# Verify required tools
command -v psql >/dev/null 2>&1 || { echo "Error: psql not found" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "Error: pg_restore not found" >&2; exit 1; }
if [[ "$BACKUP_FILE" == *.gz ]]; then
    command -v gunzip >/dev/null 2>&1 || { echo "Error: gunzip not found" >&2; exit 1; }
fi

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Create logs directory if it doesn't exist
mkdir -p logs

# Rollback function (defined early for trap)
rollback() {
    local exit_code=$?
    log "Error occurred during restore (exit code: $exit_code). Attempting rollback..."
    
    if [[ -n "$SAFETY_BACKUP_FILE" && -f "$SAFETY_BACKUP_FILE" ]]; then
        log "Restoring from safety backup: $SAFETY_BACKUP_FILE"
        if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-acl --verbose "$SAFETY_BACKUP_FILE" 2>>"$LOG_FILE"; then
            log "Rollback successful"
            echo "Rollback completed. Original data restored from safety backup."
        else
            log "Error: Rollback failed"
            echo "Rollback failed. Manual intervention required. Safety backup available at: $SAFETY_BACKUP_FILE"
            exit 7
        fi
    else
        log "No safety backup available for rollback"
        echo "No safety backup available. Manual recovery required."
        exit 7
    fi
}

# Trap errors and setup exit handler
trap rollback EXIT ERR

# Pre-restore validation
log "Starting database restore validation"
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
    log "Error: Database connection failed"
    exit 4
fi

# Check if database exists (simple check)
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    log "Warning: Database '$DB_NAME' does not exist. It will be created during restore."
fi

# Confirmation prompt
if [[ "$FORCE_RESTORE" != true ]]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    BACKUP_DATE=$(stat -c %y "$BACKUP_FILE" 2>/dev/null || stat -f %Sm -t "%Y-%m-%d %H:%M:%S" "$BACKUP_FILE")
    echo ""
    echo "WARNING: This will restore the database '$DB_NAME' from backup file '$BACKUP_FILE'"
    echo "Backup file size: $BACKUP_SIZE"
    echo "Backup file date: $BACKUP_DATE"
    echo "This operation will result in data loss. A safety backup will be created first."
    echo ""
    read -p "Type 'yes' to continue: " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        echo "Restore cancelled"
        exit 0
    fi
fi

# Safety backup
if [[ "$SKIP_SAFETY_BACKUP" != true ]]; then
    log "Creating safety backup before restore"
    mkdir -p "$SAFETY_BACKUP_DIR"
    SAFETY_BACKUP_FILE="$SAFETY_BACKUP_DIR/safety-backup-$TIMESTAMP"
    
    # Use pg_dump for safety backup (custom format for pg_restore)
    if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=custom --compress=9 --verbose > "$SAFETY_BACKUP_FILE" 2>>"$LOG_FILE"; then
        log "Error: Failed to create safety backup"
        exit 1
    fi
    
    log "Safety backup created: $SAFETY_BACKUP_FILE"
fi

# Database preparation
log "Preparing database for restore"

# Terminate active connections
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || log "Warning: Could not terminate all connections"

# Drop and recreate database (if force or doesn't exist)
if [[ "$FORCE_RESTORE" == true ]] || ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    log "Dropping and recreating database '$DB_NAME'"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" >/dev/null 2>&1
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" >/dev/null 2>&1
fi

# Restore execution
log "Starting database restore from '$BACKUP_FILE'"

# Checksum verification
if [[ -f "$BACKUP_FILE.sha256" ]]; then
    log "Verifying backup file checksum"
    if ! sha256sum -c "$BACKUP_FILE.sha256" >/dev/null 2>&1; then
        log "Error: Backup file checksum verification failed"
        exit 3
    fi
    log "Checksum verification passed"
fi

# Detect format and restore
case "$BACKUP_FILE" in
    *.sql.gz)
        log "Restoring from compressed SQL file"
        gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --quiet 2>>"$LOG_FILE"
        ;;
    *.sql)
        log "Restoring from SQL file"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE" --quiet 2>>"$LOG_FILE"
        ;;
    *.dump|*.backup)
        log "Restoring from custom dump file"
        pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-acl --verbose --jobs=4 --disable-triggers --single-transaction "$BACKUP_FILE" 2>>"$LOG_FILE"
        ;;
esac

log "Database restore completed successfully"

# Post-restore verification
log "Verifying restored database"

# Check database accessibility
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    log "Error: Database not accessible after restore"
    exit 5
fi

# Check critical tables exist
CRITICAL_TABLES=("User" "Session" "Transaction")
for table in "${CRITICAL_TABLES[@]}"; do
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM \"$table\" LIMIT 1;" >/dev/null 2>&1; then
        log "Warning: Critical table '$table' not found or empty"
    fi
done

log "Database verification completed"

# Database migrations
log "Running Prisma migrations"
if ! npm run db:migrate:deploy >/dev/null 2>&1; then
    log "Error: Prisma migrations failed"
    exit 6
fi

log "Generating Prisma client"
if ! npm run db:generate >/dev/null 2>&1; then
    log "Error: Prisma client generation failed"
    exit 6
fi

log "Migrations completed successfully"

# Success - disable trap before normal exit
trap - EXIT ERR
log "Database restore completed successfully"
echo "Restore completed. Safety backup (if created): $SAFETY_BACKUP_FILE"
exit 0

# Usage examples (in comments)
# Basic restore: ./scripts/restore-database.sh backups/backup-20240101_120000.sql
# Force restore: ./scripts/restore-database.sh --force backups/backup.sql.gz
# Skip safety backup: ./scripts/restore-database.sh --no-backup backups/backup.dump

# Exit codes:
# 0: Success
# 1: General error
# 2: Invalid arguments
# 3: Backup file not found or unreadable
# 4: Database connection failed
# 5: Restore failed
# 6: Migration failed
# 7: Rollback failed

# Security considerations:
# - Use .pgpass file for authentication to avoid password in logs
# - Set restrictive permissions on restored database
# - Verify backup source is trusted
# - Log all restore operations for audit trail
# - Require explicit confirmation for production restores

# Performance optimization:
# - Use parallel restore for large databases: --jobs=4 (already included)
# - Disable triggers during restore: --disable-triggers (already included)
# - Use single transaction for faster restore: --single-transaction (already included)
# - Consider using pg_basebackup for physical restores (not implemented here)

# Production safety:
# - Add extra confirmation for production environment
# - Check NODE_ENV and warn if production
# - Require additional flag for production restores
# - Send alerts to team when production restore is initiated
# - Create audit log entry