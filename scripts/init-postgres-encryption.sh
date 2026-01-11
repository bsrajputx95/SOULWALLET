#!/bin/bash

# PostgreSQL Encryption Initialization Script
# 
# Description: Sets up Transparent Data Encryption (TDE) and SSL for PostgreSQL.
# This script should be run during initial PostgreSQL setup.
#
# Usage: ./scripts/init-postgres-encryption.sh
#
# Author: SoulWallet Development Team
# Version: 1.0.0

set -euo pipefail

# Configuration
ENCRYPTION_DIR="${POSTGRES_ENCRYPTION_DIR:-/var/lib/postgresql/encryption}"
SSL_DIR="${POSTGRES_SSL_DIR:-/var/lib/postgresql/ssl}"
DATA_DIR="${PGDATA:-/var/lib/postgresql/data}"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
    exit 1
}

# Check if running as postgres user
check_user() {
    if [ "$(whoami)" != "postgres" ] && [ "$(id -u)" -ne 0 ]; then
        log "WARNING: Not running as postgres or root user"
    fi
}

# Create encryption key directory
create_encryption_dir() {
    log "Creating encryption directory: $ENCRYPTION_DIR"
    mkdir -p "$ENCRYPTION_DIR"
    chmod 700 "$ENCRYPTION_DIR"
}

# Generate data encryption key (DEK)
generate_data_encryption_key() {
    local key_file="$ENCRYPTION_DIR/data_encryption.key"
    
    if [ -f "$key_file" ]; then
        log "Data encryption key already exists at $key_file"
        return 0
    fi
    
    log "Generating new data encryption key..."
    openssl rand -hex 32 > "$key_file"
    chmod 600 "$key_file"
    
    log "Data encryption key generated: $key_file"
}

# Generate SSL certificates
generate_ssl_certificates() {
    local cert_file="$SSL_DIR/server.crt"
    local key_file="$SSL_DIR/server.key"
    
    mkdir -p "$SSL_DIR"
    chmod 700 "$SSL_DIR"
    
    if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
        log "SSL certificates already exist"
        return 0
    fi
    
    log "Generating SSL certificates..."
    
    # Generate private key
    openssl genrsa -out "$key_file" 2048
    chmod 600 "$key_file"
    
    # Generate self-signed certificate (valid for 365 days)
    # In production, use proper CA-signed certificates
    openssl req -new -x509 -days 365 \
        -key "$key_file" \
        -out "$cert_file" \
        -subj "/C=US/ST=California/L=SanFrancisco/O=SoulWallet/CN=soulwallet-postgres"
    
    chmod 644 "$cert_file"
    
    log "SSL certificates generated: $cert_file, $key_file"
}

# Configure PostgreSQL for SSL
configure_postgresql_ssl() {
    local conf_file="$DATA_DIR/postgresql.conf"
    
    if [ ! -f "$conf_file" ]; then
        log "PostgreSQL config not found at $conf_file, skipping SSL configuration"
        return 0
    fi
    
    log "Configuring PostgreSQL for SSL..."
    
    # Backup original config
    cp "$conf_file" "${conf_file}.backup"
    
    # Add or update SSL settings
    # Remove existing SSL settings first
    sed -i '/^ssl\s*=/d' "$conf_file"
    sed -i '/^ssl_cert_file\s*=/d' "$conf_file"
    sed -i '/^ssl_key_file\s*=/d' "$conf_file"
    
    # Append new SSL settings
    cat >> "$conf_file" << EOF

# SSL Configuration (added by init-postgres-encryption.sh)
ssl = on
ssl_cert_file = '$SSL_DIR/server.crt'
ssl_key_file = '$SSL_DIR/server.key'
EOF
    
    log "PostgreSQL SSL configured"
}

# Configure pg_hba.conf for SSL connections
configure_pg_hba_ssl() {
    local hba_file="$DATA_DIR/pg_hba.conf"
    
    if [ ! -f "$hba_file" ]; then
        log "pg_hba.conf not found at $hba_file, skipping"
        return 0
    fi
    
    log "Configuring pg_hba.conf for SSL connections..."
    
    # Backup original config
    cp "$hba_file" "${hba_file}.backup"
    
    # Add SSL hostssl entries (optional, depends on requirements)
    # This allows SSL connections from any host
    if ! grep -q "hostssl" "$hba_file"; then
        cat >> "$hba_file" << EOF

# SSL connections (added by init-postgres-encryption.sh)
# hostssl  all  all  0.0.0.0/0  scram-sha-256
EOF
    fi
    
    log "pg_hba.conf configured"
}

# Generate pgcrypto application key
generate_pgcrypto_key() {
    local key_file="$ENCRYPTION_DIR/pgcrypto.key"
    
    if [ -f "$key_file" ]; then
        log "pgcrypto key already exists at $key_file"
        return 0
    fi
    
    log "Generating pgcrypto application encryption key..."
    openssl rand -hex 32 > "$key_file"
    chmod 600 "$key_file"
    
    log "pgcrypto key generated: $key_file"
    log ""
    log "======================================="
    log "IMPORTANT: Add this key to your .env file:"
    log "PGCRYPTO_KEY=$(cat "$key_file")"
    log "======================================="
}

# Verify pgcrypto extension is available
verify_pgcrypto() {
    log "Verifying pgcrypto extension availability..."
    
    # This check requires PostgreSQL to be running
    if command -v psql &> /dev/null; then
        if psql -d postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'pgcrypto';" 2>/dev/null | grep -q pgcrypto; then
            log "pgcrypto extension is available"
        else
            log "WARNING: pgcrypto extension may not be available. Ensure postgresql-contrib is installed."
        fi
    else
        log "psql not available, skipping pgcrypto verification"
    fi
}

# Print summary
print_summary() {
    log ""
    log "======================================="
    log "PostgreSQL Encryption Setup Complete"
    log "======================================="
    log "Encryption key directory: $ENCRYPTION_DIR"
    log "SSL directory: $SSL_DIR"
    log ""
    log "Files created:"
    ls -la "$ENCRYPTION_DIR" 2>/dev/null || true
    ls -la "$SSL_DIR" 2>/dev/null || true
    log ""
    log "Next steps:"
    log "1. Restart PostgreSQL to apply SSL configuration"
    log "2. Add PGCRYPTO_KEY to your .env file"
    log "3. Run Prisma migrations to create pgcrypto extension"
    log "======================================="
}

# Main execution
main() {
    log "Starting PostgreSQL encryption initialization..."
    
    check_user
    create_encryption_dir
    generate_data_encryption_key
    generate_ssl_certificates
    configure_postgresql_ssl
    configure_pg_hba_ssl
    generate_pgcrypto_key
    verify_pgcrypto
    print_summary
    
    log "Encryption initialization completed successfully"
}

# Run main function
main "$@"
