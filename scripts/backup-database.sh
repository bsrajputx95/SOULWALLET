#!/bin/bash

# SoulWallet Database Backup Script
#
# Description: This script creates backups of the SoulWallet database.
# It supports both PostgreSQL (production) and SQLite (development) databases.
# Backups are organized in daily/weekly/monthly directories with rotation.
#
# Usage: ./scripts/backup-database.sh
# Environment variables:
#   BACKUP_DIR: Backup directory (default: ./backups)
#   RETENTION_DAYS: Days to keep daily backups (default: 30)
#   DATABASE_URL: Database connection URL (from .env or environment)
#
# Author: SoulWallet Development Team
# Version: 1.0.0

set -euo pipefail

# Configuration variables
BACKUP_DIR=${BACKUP_DIR:-./backups}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Ensure logs directory exists
mkdir -p logs

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a logs/backup.log
}

# Cleanup function for partial backups
cleanup() {
    if [ -n "${BACKUP_FILE:-}" ] && [ -f "$BACKUP_FILE" ]; then
        rm -f "$BACKUP_FILE"
        log "Removed partial backup file: $BACKUP_FILE"
    fi
}

# Trap errors and cleanup
trap cleanup EXIT ERR

# Source environment file if it exists
if [ -f .env ]; then
    source .env
fi

# Validate DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
    log "ERROR: DATABASE_URL not set. Please check your .env file or environment variables."
    exit 1
fi

# Parse DATABASE_URL and set database type
if [[ $DATABASE_URL == postgresql://* ]]; then
    # PostgreSQL database
    BACKUP_FILE="$BACKUP_DIR/backup-${TIMESTAMP}.dump"
    DB_TYPE="postgresql"
elif [[ $DATABASE_URL == file:* ]]; then
    # SQLite file database
    DB_FILE=${DATABASE_URL#file:}
    BACKUP_FILE="$BACKUP_DIR/backup-${TIMESTAMP}.sql.gz"
    DB_TYPE="sqlite"
else
    log "ERROR: Unsupported DATABASE_URL format. Supported: postgresql://... or file:..."
    exit 1
fi

# Backup directory setup
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"

# Check write permissions
if [ ! -w "$BACKUP_DIR" ]; then
    log "ERROR: No write permission on backup directory: $BACKUP_DIR"
    exit 1
fi

# Pre-backup validation
if [ "$DB_TYPE" = "postgresql" ]; then
    # Check if pg_dump is available
    if ! command -v pg_dump >/dev/null 2>&1; then
        log "ERROR: pg_dump command not found. Please install PostgreSQL client tools."
        exit 1
    fi

    # Test database connectivity using connection string
    if ! pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
        log "ERROR: Cannot connect to PostgreSQL database"
        exit 2
    fi
elif [ "$DB_TYPE" = "sqlite" ]; then
    # Check if sqlite3 is available
    if ! command -v sqlite3 >/dev/null 2>&1; then
        log "ERROR: sqlite3 command not found. Please install SQLite."
        exit 1
    fi

    # Check if database file is readable
    if [ ! -r "$DB_FILE" ]; then
        log "ERROR: Cannot read SQLite database file: $DB_FILE"
        exit 1
    fi
fi

# Check available disk space (warn if less than 1GB free)
DISK_SPACE_KB=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
if [ "$DISK_SPACE_KB" -lt 1048576 ]; then  # 1GB = 1048576 KB
    log "WARNING: Low disk space available: $(df -h "$BACKUP_DIR" | tail -1 | awk '{print $4}') free"
    # Continue anyway, but warn
fi

# Backup execution
log "Starting $DB_TYPE database backup"
START_TIME=$(date +%s)

if [ "$DB_TYPE" = "postgresql" ]; then
    # Use pg_dump with connection string directly
    pg_dump \
        --dbname="$DATABASE_URL" \
        --format=custom \
        --verbose \
        --no-owner \
        --no-acl \
        --file="$BACKUP_FILE"
elif [ "$DB_TYPE" = "sqlite" ]; then
    # Use sqlite3 dump with gzip compression
    sqlite3 "$DB_FILE" .dump | gzip > "$BACKUP_FILE"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Backup verification
if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
    log "ERROR: Backup failed - file not created or is empty: $BACKUP_FILE"
    exit 3
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE) in ${DURATION}s"

# Calculate and store checksum
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"

# Backup organization (grandfather-father-son strategy)
cp "$BACKUP_FILE" "$BACKUP_DIR/daily/"
cp "$BACKUP_FILE.sha256" "$BACKUP_DIR/daily/"

# Weekly backup on Sundays (day of week = 0)
DAY_OF_WEEK=$(date +%w)
if [ "$DAY_OF_WEEK" -eq 0 ]; then
    cp "$BACKUP_FILE" "$BACKUP_DIR/weekly/"
    cp "$BACKUP_FILE.sha256" "$BACKUP_DIR/weekly/"
    log "Created weekly backup"
fi

# Monthly backup on first day of month
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" -eq 01 ]; then
    cp "$BACKUP_FILE" "$BACKUP_DIR/monthly/"
    cp "$BACKUP_FILE.sha256" "$BACKUP_DIR/monthly/"
    log "Created monthly backup"
fi

# Backup rotation
# Remove daily backups older than RETENTION_DAYS
find "$BACKUP_DIR/daily" \( -name "*.dump*" -o -name "*.sql.gz*" \) -mtime +"$RETENTION_DAYS" -delete

# Keep only last 4 weekly backups
WEEKLY_FILES=$(ls -t "$BACKUP_DIR/weekly"/*.dump* "$BACKUP_DIR/weekly"/*.sql.gz* 2>/dev/null || true)
if [ -n "$WEEKLY_FILES" ]; then
    echo "$WEEKLY_FILES" | tail -n +5 | xargs rm -f || true
fi

# Keep only last 12 monthly backups
MONTHLY_FILES=$(ls -t "$BACKUP_DIR/monthly"/*.dump* "$BACKUP_DIR/monthly"/*.sql.gz* 2>/dev/null || true)
if [ -n "$MONTHLY_FILES" ]; then
    echo "$MONTHLY_FILES" | tail -n +13 | xargs rm -f || true
fi

# Set restrictive permissions on backup files
chmod 600 "$BACKUP_FILE"

# Optional: Remote backup (uncomment and configure as needed)
# Example: Upload to S3
# aws s3 cp "$BACKUP_FILE" s3://your-bucket/backups/ --sse AES256
# aws s3 cp "$BACKUP_FILE.sha256" s3://your-bucket/backups/

# Optional: Notification (uncomment and implement as needed)
# notify_backup_success() {
#     # Send email, Slack, Discord, etc.
#     echo "Backup completed: $BACKUP_FILE ($BACKUP_SIZE)" | mail -s "Database Backup Success" admin@soulwallet.com
# }
# notify_backup_success

log "Database backup process completed successfully"

# Usage examples (in comments for reference):
# Basic usage: ./scripts/backup-database.sh
# Custom backup directory: BACKUP_DIR=/mnt/backups ./scripts/backup-database.sh
# Custom retention: RETENTION_DAYS=60 ./scripts/backup-database.sh

# Cron setup examples (add to crontab -e):
# Daily backup at 2 AM: 0 2 * * * /path/to/project/scripts/backup-database.sh >> /path/to/project/logs/backup.log 2>&1
# Hourly backup: 0 * * * * /path/to/project/scripts/backup-database.sh >> /path/to/project/logs/backup.log 2>&1

# Exit codes:
# 0: Success
# 1: General error (missing tools, invalid config)
# 2: Database connection failed
# 3: Backup failed (file not created)
# 4: Insufficient disk space (not implemented, but could be added)

# Security considerations:
# - Uses PGPASSWORD environment variable for PostgreSQL authentication
# - Sets restrictive permissions (600) on backup files
# - Does not log passwords or sensitive connection details
# - Consider encrypting backups for sensitive data: gpg --encrypt "$BACKUP_FILE"
# - Store backups in secure locations with proper access controls

# Performance optimization:
# - Uses compressed custom format for PostgreSQL (smaller, faster)
# - For large PostgreSQL databases, consider: --jobs=4 for parallel dumping
# - Schedule backups during low-traffic periods
# - For very large databases, consider pg_basebackup for physical backups

exit 0