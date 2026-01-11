#!/bin/bash

# =============================================================================
# SoulWallet Observability Stack Verification Script
# Verifies that all observability components are running and healthy
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
JAEGER_URL="${JAEGER_URL:-http://localhost:16686}"
ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
KIBANA_URL="${KIBANA_URL:-http://localhost:5601}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"
API_URL="${API_URL:-http://localhost:3001}"

PASSED=0
FAILED=0

# Helper functions
check_service() {
    local name=$1
    local url=$2
    local endpoint=$3
    
    printf "Checking %s... " "$name"
    
    if curl -sf "$url$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

check_prometheus_target() {
    local target=$1
    printf "  - Target '%s'... " "$target"
    
    response=$(curl -sf "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null || echo '{"status":"error"}')
    if echo "$response" | grep -q "\"job\":\"$target\"" && echo "$response" | grep -q '"health":"up"'; then
        echo -e "${GREEN}✓ UP${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠ NOT READY${NC}"
        return 1
    fi
}

# Header
echo "=============================================="
echo "   SoulWallet Observability Verification"
echo "=============================================="
echo ""

# 1. Check API /metrics endpoint
echo "1. Checking API Metrics Endpoint"
echo "--------------------------------"
check_service "API /metrics" "$API_URL" "/metrics"
echo ""

# 2. Check Prometheus
echo "2. Checking Prometheus"
echo "----------------------"
if check_service "Prometheus" "$PROMETHEUS_URL" "/-/healthy"; then
    echo "   Checking scrape targets:"
    check_prometheus_target "soulwallet-api" || true
fi
echo ""

# 3. Check Jaeger
echo "3. Checking Jaeger"
echo "------------------"
check_service "Jaeger UI" "$JAEGER_URL" "/"

# Check for traces
printf "  - Checking for traces... "
response=$(curl -sf "$JAEGER_URL/api/services" 2>/dev/null || echo '{"data":[]}')
if echo "$response" | grep -q "soulwallet"; then
    echo -e "${GREEN}✓ TRACES FOUND${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ NO TRACES YET${NC}"
fi
echo ""

# 4. Check Elasticsearch
echo "4. Checking Elasticsearch"
echo "-------------------------"
if check_service "Elasticsearch" "$ELASTICSEARCH_URL" "/_cluster/health"; then
    # Check for soulwallet-logs index
    printf "  - Checking for logs index... "
    if curl -sf "$ELASTICSEARCH_URL/_cat/indices/soulwallet-logs-*" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ INDEX EXISTS${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠ NO LOGS INDEX YET${NC}"
    fi
fi
echo ""

# 5. Check Kibana
echo "5. Checking Kibana"
echo "------------------"
check_service "Kibana" "$KIBANA_URL" "/api/status"
echo ""

# 6. Check Grafana
echo "6. Checking Grafana"
echo "-------------------"
if check_service "Grafana" "$GRAFANA_URL" "/api/health"; then
    # Check dashboards
    printf "  - Checking dashboards... "
    response=$(curl -sf "$GRAFANA_URL/api/search?type=dash-db" 2>/dev/null || echo '[]')
    dashboard_count=$(echo "$response" | grep -o '"uid"' | wc -l)
    if [ "$dashboard_count" -gt 0 ]; then
        echo -e "${GREEN}✓ $dashboard_count DASHBOARDS${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠ NO DASHBOARDS${NC}"
    fi
fi
echo ""

# 7. Check AlertManager
echo "7. Checking AlertManager"
echo "------------------------"
check_service "AlertManager" "$ALERTMANAGER_URL" "/-/healthy"
echo ""

# Summary
echo "=============================================="
echo "   Summary"
echo "=============================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All observability checks passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some checks failed. Review the output above.${NC}"
    exit 1
fi
