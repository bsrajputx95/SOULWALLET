#!/bin/bash
# run-all-tests.sh - Master test runner for SoulWallet
# Runs all test suites in sequence with coverage enforcement

set -e

echo "=========================================="
echo "SoulWallet Full Test Suite"
echo "=========================================="
echo "Started at: $(date)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
declare -A TEST_RESULTS
FAILED=0

run_test() {
    local name=$1
    local command=$2
    
    echo -e "${YELLOW}Running $name...${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✓ $name passed${NC}"
        TEST_RESULTS[$name]="PASSED"
    else
        echo -e "${RED}✗ $name failed${NC}"
        TEST_RESULTS[$name]="FAILED"
        FAILED=1
    fi
    echo ""
}

# 1. Type checking
run_test "Type Check" "npm run type-check"

# 2. Linting
run_test "Lint" "npm run lint"

# 3. Format check
run_test "Format Check" "npm run format:check"

# 4. Unit tests
run_test "Unit Tests" "npm run test:unit"

# 5. Integration tests
run_test "Integration Tests" "npm run test:integration:full"

# 6. Property tests
run_test "Property Tests" "npm run test:property"

# 7. Security tests
run_test "Security Tests" "npm run test:security"

# 8. Chaos tests
run_test "Chaos Tests" "npm run test:chaos"

# 9. Coverage report
echo -e "${YELLOW}Generating coverage report...${NC}"
npm run test:coverage -- --coverageReporters=json-summary

# 10. Verify coverage threshold
echo -e "${YELLOW}Verifying coverage threshold...${NC}"
coverage=$(node -e "console.log(JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json','utf8')).total.lines.pct)")

if (( $(echo "$coverage < 90" | bc -l) )); then
    echo -e "${RED}✗ Coverage $coverage% is below 90% threshold${NC}"
    FAILED=1
    TEST_RESULTS["Coverage"]="FAILED ($coverage%)"
else
    echo -e "${GREEN}✓ Coverage threshold met: $coverage%${NC}"
    TEST_RESULTS["Coverage"]="PASSED ($coverage%)"
fi

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="

for test in "${!TEST_RESULTS[@]}"; do
    result=${TEST_RESULTS[$test]}
    if [[ $result == *"PASSED"* ]]; then
        echo -e "${GREEN}✓ $test: $result${NC}"
    else
        echo -e "${RED}✗ $test: $result${NC}"
    fi
done

echo ""
echo "Completed at: $(date)"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
