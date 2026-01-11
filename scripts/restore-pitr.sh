#!/bin/bash

# SoulWallet Point-in-Time Recovery (PITR) Script
#
# Description: Restores the PostgreSQL database to a specific point in time
# using WAL archives. Supports recovery to any timestamp within WAL retention.
#
# Usage: ./scripts/restore-pitr.sh --backup-file <path> --target-time <ISO-8601>
#
# Parameters:
#   --backup-file  : Path to base backup file (pg_basebackup output)
#   --target-time  : Target recovery time in ISO 8601 format (e.g., "2024-01-15 14:30:00")
#   --dry-run      : Validate parameters without performing restore
#
# Prerequisites:
#   - PostgreSQL 12+ with WAL archiving enabled
#   - Access to WAL archive directory
#   - Base backup created with pg_basebackup
#
# Author: SoulWallet Development Team
# Version: 1.0.0

set -euo pipefail

# Configuration
POSTGRES_VERSION="${POSTGRES_VERSION:-15}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/lib/postgresql/wal_archive}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RESTORE_TEMP_DIR="${RESTORE_TEMP_DIR:-/tmp/pg_restore_$$}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $*${NC}"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $*${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $*${NC}" >&2
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Point-in-Time Recovery (PITR) for PostgreSQL

OPTIONS:
    --backup-file <path>      Path to base backup file (required)
    --target-time <time>      Target recovery time in ISO 8601 format (required)
                              Example: "2024-01-15 14:30:00"
    --wal-archive <dir>       WAL archive directory (default: $WAL_ARCHIVE_DIR)
    --data-dir <dir>          PostgreSQL data directory (default: $PGDATA)
    --dry-run                 Validate parameters without performing restore
    --force                   Skip confirmation prompts
    --help                    Show this help message

EXAMPLES:
    # Restore to specific timestamp
    $0 --backup-file ./backups/base_20240115.tar.gz --target-time "2024-01-15 14:30:00"

    # Dry run to validate parameters
    $0 --backup-file ./backups/base.tar.gz --target-time "2024-01-15 14:30:00" --dry-run

    # Custom WAL archive location
    $0 --backup-file ./backups/base.tar.gz --target-time "2024-01-15 14:30:00" \\
       --wal-archive /mnt/wal_archive

NOTES:
    - Ensure PostgreSQL is stopped before running this script
    - The script will backup current data before restoring
    - WAL files must be available for the target recovery time
    - Recovery Point Objective (RPO): < 10 seconds
    - Recovery Time Objective (RTO): < 1 minute
EOF
}

# Parse command line arguments
parse_args() {
    BACKUP_FILE=""
    TARGET_TIME=""
    DRY_RUN=false
    FORCE=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-file)
                BACKUP_FILE="$2"
                shift 2
                ;;
            --target-time)
                TARGET_TIME="$2"
                shift 2
                ;;
            --wal-archive)
                WAL_ARCHIVE_DIR="$2"
                shift 2
                ;;
            --data-dir)
                PGDATA="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate required parameters
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "Missing required parameter: --backup-file"
        usage
        exit 1
    fi

    if [[ -z "$TARGET_TIME" ]]; then
        log_error "Missing required parameter: --target-time"
        usage
        exit 1
    fi
}

# Validate backup file
validate_backup_file() {
    log "Validating backup file: $BACKUP_FILE"

    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    # Check if backup file is readable
    if [[ ! -r "$BACKUP_FILE" ]]; then
        log_error "Backup file is not readable: $BACKUP_FILE"
        exit 1
    fi

    # Validate backup file format
    if [[ "$BACKUP_FILE" == *.tar.gz ]] || [[ "$BACKUP_FILE" == *.tgz ]]; then
        if ! tar -tzf "$BACKUP_FILE" &>/dev/null; then
            log_error "Backup file is not a valid tar.gz archive"
            exit 1
        fi
    elif [[ "$BACKUP_FILE" == *.tar ]]; then
        if ! tar -tf "$BACKUP_FILE" &>/dev/null; then
            log_error "Backup file is not a valid tar archive"
            exit 1
        fi
    elif [[ "$BACKUP_FILE" == *.dump ]]; then
        log_warn "Detected pg_dump format. PITR requires pg_basebackup format."
        log_warn "Consider using pg_basebackup for PITR-compatible backups."
    fi

    log_success "Backup file validated"
}

# Validate target time
validate_target_time() {
    log "Validating target time: $TARGET_TIME"

    # Try to parse the target time
    if ! date -d "$TARGET_TIME" &>/dev/null; then
        log_error "Invalid target time format: $TARGET_TIME"
        log_error "Expected ISO 8601 format: YYYY-MM-DD HH:MM:SS"
        exit 1
    fi

    # Check if target time is in the future
    TARGET_EPOCH=$(date -d "$TARGET_TIME" +%s)
    CURRENT_EPOCH=$(date +%s)

    if [[ $TARGET_EPOCH -gt $CURRENT_EPOCH ]]; then
        log_error "Target time is in the future"
        exit 1
    fi

    log_success "Target time validated: $(date -d "$TARGET_TIME" '+%Y-%m-%d %H:%M:%S %Z')"
}

# Validate WAL archive
validate_wal_archive() {
    log "Validating WAL archive directory: $WAL_ARCHIVE_DIR"

    if [[ ! -d "$WAL_ARCHIVE_DIR" ]]; then
        log_error "WAL archive directory not found: $WAL_ARCHIVE_DIR"
        exit 1
    fi

    # Count WAL files
    WAL_COUNT=$(find "$WAL_ARCHIVE_DIR" -name '0000*' -type f 2>/dev/null | wc -l)
    log "Found $WAL_COUNT WAL files in archive"

    if [[ $WAL_COUNT -eq 0 ]]; then
        log_warn "No WAL files found in archive. PITR may not be possible."
    fi

    log_success "WAL archive validated"
}

# Check PostgreSQL status
check_postgres_status() {
    log "Checking PostgreSQL status..."

    # Check if PostgreSQL is running
    if pg_isready -q 2>/dev/null; then
        log_error "PostgreSQL is still running. Please stop it before PITR."
        log_error "Run: docker compose stop postgres"
        exit 1
    fi

    log_success "PostgreSQL is not running (OK for PITR)"
}

# Backup current data
backup_current_data() {
    log "Backing up current data directory..."

    local BACKUP_CURRENT="$BACKUP_DIR/pre_pitr_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_CURRENT"

    if [[ -d "$PGDATA" ]] && [[ "$(ls -A "$PGDATA" 2>/dev/null)" ]]; then
        cp -a "$PGDATA" "$BACKUP_CURRENT/"
        log_success "Current data backed up to: $BACKUP_CURRENT"
    else
        log_warn "Data directory is empty, nothing to backup"
    fi
}

# Extract base backup
extract_base_backup() {
    log "Extracting base backup to data directory..."

    mkdir -p "$RESTORE_TEMP_DIR"
    mkdir -p "$PGDATA"

    # Clear existing data
    rm -rf "${PGDATA:?}"/*

    if [[ "$BACKUP_FILE" == *.tar.gz ]] || [[ "$BACKUP_FILE" == *.tgz ]]; then
        tar -xzf "$BACKUP_FILE" -C "$PGDATA"
    elif [[ "$BACKUP_FILE" == *.tar ]]; then
        tar -xf "$BACKUP_FILE" -C "$PGDATA"
    else
        log_error "Unsupported backup file format"
        exit 1
    fi

    log_success "Base backup extracted"
}

# Create recovery configuration
create_recovery_config() {
    log "Creating recovery configuration..."

    # PostgreSQL 12+ uses recovery.signal instead of recovery.conf
    if [[ $POSTGRES_VERSION -ge 12 ]]; then
        # Create recovery.signal to trigger recovery mode
        touch "$PGDATA/recovery.signal"

        # Add recovery settings to postgresql.auto.conf
        cat >> "$PGDATA/postgresql.auto.conf" << EOF

# PITR Recovery Configuration (added by restore-pitr.sh)
restore_command = 'cp $WAL_ARCHIVE_DIR/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF
        log_success "Created recovery.signal and updated postgresql.auto.conf"
    else
        # PostgreSQL 11 and earlier use recovery.conf
        cat > "$PGDATA/recovery.conf" << EOF
# PITR Recovery Configuration (added by restore-pitr.sh)
restore_command = 'cp $WAL_ARCHIVE_DIR/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
standby_mode = off
EOF
        log_success "Created recovery.conf"
    fi
}

# Set correct permissions
set_permissions() {
    log "Setting correct file permissions..."

    # PostgreSQL requires strict permissions on data directory
    chmod 700 "$PGDATA"

    # Set ownership if running as root
    if [[ $(id -u) -eq 0 ]] && id postgres &>/dev/null; then
        chown -R postgres:postgres "$PGDATA"
    fi

    log_success "Permissions set"
}

# Perform PITR
perform_pitr() {
    log "Starting Point-in-Time Recovery..."
    log "  Backup file:  $BACKUP_FILE"
    log "  Target time:  $TARGET_TIME"
    log "  WAL archive:  $WAL_ARCHIVE_DIR"
    log "  Data dir:     $PGDATA"

    if [[ "$DRY_RUN" == true ]]; then
        log_warn "DRY RUN MODE - No changes will be made"
        return 0
    fi

    if [[ "$FORCE" != true ]]; then
        read -p "This will overwrite the current database. Continue? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "PITR cancelled by user"
            exit 0
        fi
    fi

    # Execute PITR steps
    backup_current_data
    extract_base_backup
    create_recovery_config
    set_permissions

    log_success "PITR preparation complete!"
    log ""
    log "Next steps:"
    log "  1. Start PostgreSQL: docker compose up -d postgres"
    log "  2. Monitor recovery: docker compose logs -f postgres"
    log "  3. Verify data integrity after recovery completes"
    log ""
    log "Recovery will automatically complete when PostgreSQL starts."
}

# Cleanup
cleanup() {
    if [[ -d "$RESTORE_TEMP_DIR" ]]; then
        rm -rf "$RESTORE_TEMP_DIR"
    fi
}

trap cleanup EXIT

# Main execution
main() {
    log "=========================================="
    log "SoulWallet Point-in-Time Recovery (PITR)"
    log "=========================================="

    parse_args "$@"

    # Validation phase
    validate_backup_file
    validate_target_time
    validate_wal_archive
    check_postgres_status

    # Execute PITR
    perform_pitr

    log ""
    log_success "PITR script completed successfully"
}

main "$@"
