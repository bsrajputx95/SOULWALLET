#!/bin/bash
# run-chaos-tests.sh - Chaos test orchestration script
# Starts infrastructure, runs chaos scenarios, and generates reports

set -e

echo "=========================================="
echo "SoulWallet Chaos Testing Suite"
echo "=========================================="
echo "Started at: $(date)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start observability stack if not running
echo -e "${YELLOW}Starting observability stack...${NC}"
docker-compose -f docker-compose.prod.yml up -d postgres redis prometheus jaeger 2>/dev/null || true
sleep 5

# Start Chaos Mesh if available
echo -e "${YELLOW}Starting Chaos Mesh...${NC}"
docker-compose -f docker-compose.prod.yml up -d chaos-mesh 2>/dev/null || {
    echo -e "${YELLOW}Chaos Mesh not available, running tests without container chaos injection${NC}"
}

# Wait for services
echo "Waiting for services to be ready..."
sleep 10

# Health check
echo -e "${YELLOW}Checking service health...${NC}"
curl -sf http://localhost:3001/health > /dev/null || {
    echo -e "${RED}Server not responding. Starting server...${NC}"
    npm run server:start &
    sleep 15
}

echo ""
echo "=========================================="
echo "Running Chaos Test Scenarios"
echo "=========================================="

# Track results
declare -a PASSED_TESTS=()
declare -a FAILED_TESTS=()

run_chaos_test() {
    local name=$1
    local command=$2
    
    echo ""
    echo -e "${YELLOW}Scenario: $name${NC}"
    echo "----------------------------------------"
    
    if eval "$command"; then
        echo -e "${GREEN}✓ $name passed${NC}"
        PASSED_TESTS+=("$name")
    else
        echo -e "${RED}✗ $name failed${NC}"
        FAILED_TESTS+=("$name")
    fi
}

# Run individual chaos scenarios
run_chaos_test "Database Failure" "npm run test:chaos:db 2>/dev/null"
run_chaos_test "RPC Failure" "npm run test:chaos:rpc 2>/dev/null"
run_chaos_test "Redis Failure" "npm run test:chaos:redis 2>/dev/null"
run_chaos_test "Pod Failure" "npm run test:chaos:pod 2>/dev/null"

# Generate chaos report
echo ""
echo -e "${YELLOW}Generating chaos test report...${NC}"
npm run test:chaos:report 2>/dev/null || {
    echo "Report generation script not found, generating basic report..."
    
    # Create basic report
    cat > __tests__/reports/chaos-report-$(date +%Y%m%d-%H%M%S).json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "environment": "test",
  "scenarios": {
    "database_failure": { "status": "${PASSED_TESTS[*]}" },
    "rpc_failure": { "tested": true },
    "redis_failure": { "tested": true },
    "pod_failure": { "tested": true }
  },
  "passed": ${#PASSED_TESTS[@]},
  "failed": ${#FAILED_TESTS[@]},
  "total": $((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]}))
}
EOF
    echo "Basic report generated."
}

# Summary
echo ""
echo "=========================================="
echo "Chaos Test Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}Passed: ${#PASSED_TESTS[@]}${NC}"
for test in "${PASSED_TESTS[@]}"; do
    echo "  ✓ $test"
done

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed: ${#FAILED_TESTS[@]}${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  ✗ $test"
    done
fi

echo ""
echo "Completed at: $(date)"

# Exit with appropriate code
if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    exit 1
fi

exit 0
