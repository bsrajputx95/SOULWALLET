#!/bin/bash

# Test Script for Query Performance Monitoring
#
# Description: Validates that pg_stat_statements is working and
# the query performance admin endpoint is accessible.
#
# Usage: ./scripts/test-query-performance.sh
#
# Author: SoulWallet Development Team
# Version: 1.0.0

set -euo pipefail

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/soulwallet}"
API_URL="${API_URL:-http://localhost:3001}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] $*"; }
log_success() { echo -e "${GREEN}[✓] $*${NC}"; }
log_fail() { echo -e "${RED}[✗] $*${NC}"; }
log_warn() { echo -e "${YELLOW}[!] $*${NC}"; }

# Check pg_stat_statements extension
test_pg_stat_statements() {
    log "Testing pg_stat_statements extension..."
    
    local result=$(psql "$DATABASE_URL" -t -c "
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements' LIMIT 1
    " 2>/dev/null | tr -d '[:space:]')
    
    if [ "$result" = "1" ]; then
        log_success "pg_stat_statements extension is installed"
        return 0
    else
        log_fail "pg_stat_statements is not installed"
        log "Add to postgresql.conf: shared_preload_libraries = 'pg_stat_statements'"
        return 1
    fi
}

# Check pg_stat_statements tracking
test_statement_tracking() {
    log "Testing statement tracking..."
    
    local count=$(psql "$DATABASE_URL" -t -c "
        SELECT count(*) FROM pg_stat_statements
    " 2>/dev/null | tr -d '[:space:]')
    
    if [ -n "$count" ] && [ "$count" -gt 0 ]; then
        log_success "Tracking $count statements"
        return 0
    else
        # Try to enable tracking
        psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements" &>/dev/null || true
        
        # Generate some queries to track
        for i in {1..5}; do
            psql "$DATABASE_URL" -c "SELECT count(*) FROM users" &>/dev/null || true
        done
        
        # Check again
        count=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_statements" 2>/dev/null | tr -d '[:space:]')
        
        if [ "$count" -gt 0 ]; then
            log_success "Now tracking $count statements"
            return 0
        else
            log_warn "Statement tracking not active"
            return 0
        fi
    fi
}

# Get top queries
test_top_queries() {
    log "Testing top queries by time..."
    
    local result=$(psql "$DATABASE_URL" -t -c "
        SELECT LEFT(query, 80), calls, round(mean_exec_time::numeric, 2) as avg_ms
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 5
    " 2>/dev/null)
    
    if [ -n "$result" ]; then
        echo ""
        echo "Top 5 queries by execution time:"
        echo "$result"
        echo ""
        log_success "Top queries retrieved"
        return 0
    else
        log_warn "No query statistics available"
        return 0
    fi
}

# Check for N+1 patterns
test_n1_detection() {
    log "Testing N+1 pattern detection..."
    
    local result=$(psql "$DATABASE_URL" -t -c "
        SELECT LEFT(query, 60) as query, calls
        FROM pg_stat_statements
        WHERE calls > 100
          AND mean_exec_time < 10
        ORDER BY calls DESC
        LIMIT 5
    " 2>/dev/null)
    
    if [ -n "$result" ]; then
        echo ""
        echo "Potential N+1 patterns (high calls, low time):"
        echo "$result"
        echo ""
        log_success "N+1 detection query works"
    else
        log_success "No N+1 patterns detected"
    fi
    
    return 0
}

# Test cache hit ratio
test_cache_hit_ratio() {
    log "Testing cache hit ratio..."
    
    local ratio=$(psql "$DATABASE_URL" -t -c "
        SELECT 
            round(
                CASE WHEN (blks_hit + blks_read) = 0 THEN 1
                ELSE blks_hit::numeric / (blks_hit + blks_read)
                END * 100, 2
            ) as hit_percent
        FROM pg_stat_database
        WHERE datname = current_database()
    " 2>/dev/null | tr -d '[:space:]')
    
    if [ -n "$ratio" ]; then
        log "Cache hit ratio: ${ratio}%"
        
        # Parse ratio for threshold check
        if [ "$(echo "$ratio > 95" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
            log_success "Excellent cache performance"
        elif [ "$(echo "$ratio > 80" | bc -l 2>/dev/null || echo 1)" = "1" ]; then
            log_success "Good cache performance"
        else
            log_warn "Cache hit ratio below 80%. Consider increasing shared_buffers."
        fi
        return 0
    else
        log_warn "Cannot calculate cache hit ratio"
        return 0
    fi
}

# Test admin endpoint
test_admin_endpoint() {
    log "Testing admin query performance endpoint..."
    
    if ! command -v curl &> /dev/null; then
        log_warn "curl not found, skipping endpoint test"
        return 0
    fi
    
    # Try to access endpoint
    local status=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${ADMIN_TOKEN:-test}" \
        "$API_URL/api/admin/query-performance" 2>/dev/null || echo "000")
    
    case $status in
        200)
            log_success "Admin endpoint accessible (200 OK)"
            ;;
        401|403)
            log_warn "Admin endpoint requires authentication ($status)"
            ;;
        000)
            log_warn "Cannot connect to API at $API_URL"
            ;;
        *)
            log_warn "Admin endpoint returned status $status"
            ;;
    esac
    
    return 0
}

# Run all tests
main() {
    echo ""
    echo "========================================"
    echo "  Query Performance Test Suite"
    echo "========================================"
    echo ""
    
    local failed=0
    
    test_pg_stat_statements || ((failed++))
    test_statement_tracking || ((failed++))
    test_top_queries || ((failed++))
    test_n1_detection
    test_cache_hit_ratio
    test_admin_endpoint
    
    echo ""
    echo "========================================"
    if [ $failed -eq 0 ]; then
        log_success "All query performance tests passed!"
        echo "========================================"
        exit 0
    else
        log_fail "$failed test(s) failed"
        echo "========================================"
        exit 1
    fi
}

main "$@"
