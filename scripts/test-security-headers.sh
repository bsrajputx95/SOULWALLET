#!/bin/bash

# =============================================================================
# SoulWallet Security Headers Testing Script
# =============================================================================
# Tests security headers, CORS, and CSRF protection on production deployment
#
# Usage: bash scripts/test-security-headers.sh https://your-app.up.railway.app
#
# Requirements: curl, jq (optional, for JSON parsing)
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Check if URL is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No URL provided${NC}"
    echo "Usage: bash scripts/test-security-headers.sh https://your-app.up.railway.app"
    exit 1
fi

BASE_URL="$1"

# Remove trailing slash if present
BASE_URL="${BASE_URL%/}"

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}       SoulWallet Security Headers Test Suite${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
echo -e "${BLUE}Target: ${BASE_URL}${NC}"
echo -e "${BLUE}Date: $(date)${NC}"
echo ""

# Function to check if a header exists and has expected value
check_header() {
    local headers="$1"
    local header_name="$2"
    local expected_value="$3"
    local description="$4"
    
    local actual_value=$(echo "$headers" | grep -i "^${header_name}:" | cut -d':' -f2- | xargs)
    
    if [ -z "$actual_value" ]; then
        echo -e "  ${RED}❌ ${header_name}: Missing${NC}"
        echo -e "     ${YELLOW}Expected: ${expected_value}${NC}"
        ((FAILED++))
        return 1
    elif [ -n "$expected_value" ] && [[ "$actual_value" != *"$expected_value"* ]]; then
        echo -e "  ${YELLOW}⚠️  ${header_name}: ${actual_value}${NC}"
        echo -e "     ${YELLOW}Expected to contain: ${expected_value}${NC}"
        ((WARNINGS++))
        return 2
    else
        echo -e "  ${GREEN}✅ ${header_name}: ${actual_value}${NC}"
        ((PASSED++))
        return 0
    fi
}

# Function to check if a header is absent (for security)
check_header_absent() {
    local headers="$1"
    local header_name="$2"
    
    local actual_value=$(echo "$headers" | grep -i "^${header_name}:" | cut -d':' -f2- | xargs)
    
    if [ -z "$actual_value" ]; then
        echo -e "  ${GREEN}✅ ${header_name}: Not present (good)${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "  ${YELLOW}⚠️  ${header_name}: ${actual_value} (should be removed)${NC}"
        ((WARNINGS++))
        return 1
    fi
}

# =============================================================================
# Test 1: Health Endpoint Security Headers
# =============================================================================
echo -e "${CYAN}${BOLD}1. Testing Health Endpoint Security Headers${NC}"
echo -e "${CYAN}   GET ${BASE_URL}/health${NC}"
echo ""

HEALTH_RESPONSE=$(curl -s -I "${BASE_URL}/health" 2>&1)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | head -1 | cut -d' ' -f2)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "  ${GREEN}✅ Health endpoint accessible (HTTP ${HEALTH_STATUS})${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ Health endpoint returned HTTP ${HEALTH_STATUS}${NC}"
    ((FAILED++))
fi

echo ""
echo -e "${BLUE}  Security Headers:${NC}"
check_header "$HEALTH_RESPONSE" "Strict-Transport-Security" "max-age=" "HSTS"
check_header "$HEALTH_RESPONSE" "X-Frame-Options" "DENY" "Clickjacking protection"
check_header "$HEALTH_RESPONSE" "X-Content-Type-Options" "nosniff" "MIME sniffing protection"
check_header "$HEALTH_RESPONSE" "Referrer-Policy" "strict-origin" "Referrer policy"
check_header "$HEALTH_RESPONSE" "Content-Security-Policy" "" "CSP"
check_header "$HEALTH_RESPONSE" "Permissions-Policy" "" "Permissions policy"
check_header_absent "$HEALTH_RESPONSE" "X-Powered-By"

# =============================================================================
# Test 2: API Info Endpoint
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}2. Testing API Info Endpoint${NC}"
echo -e "${CYAN}   GET ${BASE_URL}/api${NC}"
echo ""

API_RESPONSE=$(curl -s -I "${BASE_URL}/api" 2>&1)
API_STATUS=$(echo "$API_RESPONSE" | head -1 | cut -d' ' -f2)

if [ "$API_STATUS" = "200" ]; then
    echo -e "  ${GREEN}✅ API endpoint accessible (HTTP ${API_STATUS})${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ API endpoint returned HTTP ${API_STATUS}${NC}"
    ((FAILED++))
fi

# =============================================================================
# Test 3: CORS with Allowed Origin
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}3. Testing CORS with Allowed Origin${NC}"
echo -e "${CYAN}   GET ${BASE_URL}/health with Origin header${NC}"
echo ""

# Test with a likely allowed origin
CORS_RESPONSE=$(curl -s -I -H "Origin: https://soulwallet.app" "${BASE_URL}/health" 2>&1)
CORS_HEADER=$(echo "$CORS_RESPONSE" | grep -i "^Access-Control-Allow-Origin:" | cut -d':' -f2- | xargs)

if [ -n "$CORS_HEADER" ]; then
    echo -e "  ${GREEN}✅ CORS: Access-Control-Allow-Origin: ${CORS_HEADER}${NC}"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠️  CORS: No Access-Control-Allow-Origin header returned${NC}"
    echo -e "     ${YELLOW}This may be expected if origin is not in ALLOWED_ORIGINS${NC}"
    ((WARNINGS++))
fi

# Check for credentials support
CORS_CREDS=$(echo "$CORS_RESPONSE" | grep -i "^Access-Control-Allow-Credentials:" | cut -d':' -f2- | xargs)
if [ "$CORS_CREDS" = "true" ]; then
    echo -e "  ${GREEN}✅ CORS: Credentials allowed${NC}"
    ((PASSED++))
fi

# =============================================================================
# Test 4: CORS with Disallowed Origin
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}4. Testing CORS with Disallowed Origin${NC}"
echo -e "${CYAN}   GET ${BASE_URL}/health with malicious Origin${NC}"
echo ""

BAD_CORS_RESPONSE=$(curl -s -I -H "Origin: https://evil-site.com" "${BASE_URL}/health" 2>&1)
BAD_CORS_STATUS=$(echo "$BAD_CORS_RESPONSE" | head -1 | cut -d' ' -f2)
BAD_CORS_HEADER=$(echo "$BAD_CORS_RESPONSE" | grep -i "^Access-Control-Allow-Origin:" | cut -d':' -f2- | xargs)

if [ "$BAD_CORS_STATUS" = "200" ] && [ -z "$BAD_CORS_HEADER" ]; then
    echo -e "  ${GREEN}✅ CORS: Disallowed origin correctly rejected (no ACAO header)${NC}"
    ((PASSED++))
elif [ "$BAD_CORS_STATUS" != "200" ]; then
    echo -e "  ${GREEN}✅ CORS: Disallowed origin rejected with HTTP ${BAD_CORS_STATUS}${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ CORS: Disallowed origin was allowed: ${BAD_CORS_HEADER}${NC}"
    ((FAILED++))
fi

# =============================================================================
# Test 5: CSRF Token Endpoint
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}5. Testing CSRF Protection${NC}"
echo -e "${CYAN}   GET ${BASE_URL}/api/csrf${NC}"
echo ""

CSRF_RESPONSE=$(curl -s -c /tmp/csrf_cookies.txt -w "\n%{http_code}" "${BASE_URL}/api/csrf" 2>&1)
CSRF_STATUS=$(echo "$CSRF_RESPONSE" | tail -1)
CSRF_BODY=$(echo "$CSRF_RESPONSE" | head -n -1)

if [ "$CSRF_STATUS" = "200" ]; then
    echo -e "  ${GREEN}✅ CSRF endpoint accessible (HTTP ${CSRF_STATUS})${NC}"
    ((PASSED++))
    
    # Check if token is returned
    if command -v jq &> /dev/null; then
        CSRF_TOKEN=$(echo "$CSRF_BODY" | jq -r '.token' 2>/dev/null)
        if [ -n "$CSRF_TOKEN" ] && [ "$CSRF_TOKEN" != "null" ]; then
            echo -e "  ${GREEN}✅ CSRF token received: ${CSRF_TOKEN:0:20}...${NC}"
            ((PASSED++))
        else
            echo -e "  ${YELLOW}⚠️  CSRF token not in expected format${NC}"
            ((WARNINGS++))
        fi
    else
        echo -e "  ${YELLOW}⚠️  jq not installed, skipping token validation${NC}"
        ((WARNINGS++))
    fi
    
    # Check for Set-Cookie header
    CSRF_COOKIE=$(cat /tmp/csrf_cookies.txt 2>/dev/null | grep csrf_token)
    if [ -n "$CSRF_COOKIE" ]; then
        echo -e "  ${GREEN}✅ CSRF cookie set${NC}"
        ((PASSED++))
    else
        echo -e "  ${YELLOW}⚠️  CSRF cookie not found${NC}"
        ((WARNINGS++))
    fi
elif [ "$CSRF_STATUS" = "404" ]; then
    echo -e "  ${YELLOW}⚠️  CSRF endpoint not found (CSRF_ENABLED may be false)${NC}"
    echo -e "     ${YELLOW}Set CSRF_ENABLED=true in production${NC}"
    ((WARNINGS++))
else
    echo -e "  ${RED}❌ CSRF endpoint returned HTTP ${CSRF_STATUS}${NC}"
    ((FAILED++))
fi

# Cleanup
rm -f /tmp/csrf_cookies.txt

# =============================================================================
# Test 6: POST without CSRF Token (should fail if CSRF enabled)
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}6. Testing POST without CSRF Token${NC}"
echo -e "${CYAN}   POST ${BASE_URL}/api/trpc/auth.login (no CSRF token)${NC}"
echo ""

NO_CSRF_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"json":{"email":"test@test.com","password":"test"}}' \
    "${BASE_URL}/api/trpc/auth.login" 2>&1)
NO_CSRF_STATUS=$(echo "$NO_CSRF_RESPONSE" | tail -1)

if [ "$NO_CSRF_STATUS" = "403" ]; then
    echo -e "  ${GREEN}✅ POST without CSRF token correctly rejected (HTTP 403)${NC}"
    ((PASSED++))
elif [ "$NO_CSRF_STATUS" = "401" ] || [ "$NO_CSRF_STATUS" = "400" ]; then
    echo -e "  ${YELLOW}⚠️  POST returned HTTP ${NO_CSRF_STATUS} (may be auth error, not CSRF)${NC}"
    echo -e "     ${YELLOW}CSRF protection may not be enabled${NC}"
    ((WARNINGS++))
else
    echo -e "  ${YELLOW}⚠️  POST returned HTTP ${NO_CSRF_STATUS}${NC}"
    ((WARNINGS++))
fi

# =============================================================================
# Test 7: Rate Limiting Headers
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}7. Testing Rate Limiting Headers${NC}"
echo -e "${CYAN}   GET ${BASE_URL}/health${NC}"
echo ""

RATE_RESPONSE=$(curl -s -I "${BASE_URL}/health" 2>&1)

RATE_LIMIT=$(echo "$RATE_RESPONSE" | grep -i "^X-RateLimit-Limit:" | cut -d':' -f2- | xargs)
RATE_REMAINING=$(echo "$RATE_RESPONSE" | grep -i "^X-RateLimit-Remaining:" | cut -d':' -f2- | xargs)

if [ -n "$RATE_LIMIT" ]; then
    echo -e "  ${GREEN}✅ X-RateLimit-Limit: ${RATE_LIMIT}${NC}"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠️  X-RateLimit-Limit header not present${NC}"
    ((WARNINGS++))
fi

if [ -n "$RATE_REMAINING" ]; then
    echo -e "  ${GREEN}✅ X-RateLimit-Remaining: ${RATE_REMAINING}${NC}"
    ((PASSED++))
fi

# =============================================================================
# Test 8: HTTPS Redirect (if applicable)
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}8. Testing HTTPS Configuration${NC}"
echo ""

if [[ "$BASE_URL" == https://* ]]; then
    echo -e "  ${GREEN}✅ Using HTTPS${NC}"
    ((PASSED++))
    
    # Check HSTS
    HSTS=$(echo "$HEALTH_RESPONSE" | grep -i "^Strict-Transport-Security:" | cut -d':' -f2- | xargs)
    if [[ "$HSTS" == *"max-age="* ]]; then
        echo -e "  ${GREEN}✅ HSTS enabled: ${HSTS}${NC}"
        ((PASSED++))
    fi
else
    echo -e "  ${YELLOW}⚠️  Not using HTTPS - production should use HTTPS${NC}"
    ((WARNINGS++))
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}                    TEST SUMMARY${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
echo -e "  ${GREEN}✅ Passed:   ${PASSED}${NC}"
echo -e "  ${YELLOW}⚠️  Warnings: ${WARNINGS}${NC}"
echo -e "  ${RED}❌ Failed:   ${FAILED}${NC}"
echo ""
echo -e "${BOLD}============================================================${NC}"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${RED}${BOLD}❌ SECURITY TESTS FAILED${NC}"
    echo -e "${RED}Fix the failed checks before going to production.${NC}"
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}${BOLD}⚠️  TESTS PASSED WITH WARNINGS${NC}"
    echo -e "${YELLOW}Review warnings for potential security improvements.${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${GREEN}${BOLD}✅ ALL SECURITY TESTS PASSED${NC}"
    echo -e "${GREEN}Security headers are properly configured.${NC}"
    echo ""
    exit 0
fi
