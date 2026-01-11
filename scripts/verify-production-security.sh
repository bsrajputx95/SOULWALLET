#!/bin/bash
# Plan10 Step 8: Production Security Verification Script
# Validates that all security requirements are met before deployment
#
# Usage: ./scripts/verify-production-security.sh
# Exit code 0 = all checks passed, 1 = failures detected

set -e

echo "=========================================="
echo "🔒 SoulWallet Production Security Verification"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0
ENV_FILE="${1:-.env.production}"

# Helper function for checks
check_pass() {
    echo "✅ PASS: $1"
}

check_fail() {
    echo "❌ FAIL: $1"
    ERRORS=$((ERRORS + 1))
}

check_warn() {
    echo "⚠️  WARN: $1"
    WARNINGS=$((WARNINGS + 1))
}

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  Environment file '$ENV_FILE' not found. Using code-based checks only."
    ENV_FILE=""
fi

echo "📋 Security Configuration Checks"
echo "----------------------------------"

# Check 1: KMS Provider
if [ -n "$ENV_FILE" ]; then
    if grep -q "KMS_PROVIDER=env" "$ENV_FILE" 2>/dev/null; then
        check_fail "KMS_PROVIDER=env in production (must be 'aws' or 'vault')"
    elif grep -q "KMS_PROVIDER=aws\|KMS_PROVIDER=vault" "$ENV_FILE" 2>/dev/null; then
        check_pass "KMS provider configured (aws/vault)"
    else
        check_warn "KMS_PROVIDER not explicitly set"
    fi
fi

# Check 2: CAPTCHA Enabled
if [ -n "$ENV_FILE" ]; then
    if grep -q "CAPTCHA_ENABLED=false" "$ENV_FILE" 2>/dev/null; then
        check_fail "CAPTCHA disabled in production"
    elif grep -q "CAPTCHA_ENABLED=true" "$ENV_FILE" 2>/dev/null; then
        check_pass "CAPTCHA enabled"
    else
        check_warn "CAPTCHA_ENABLED not set (defaults to false)"
    fi
fi

# Check 3: TOTP Encryption Key
if [ -n "$ENV_FILE" ]; then
    TOTP_KEY=$(grep "^TOTP_ENCRYPTION_KEY=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
    if [ -z "$TOTP_KEY" ]; then
        check_fail "TOTP_ENCRYPTION_KEY not set"
    elif [ ${#TOTP_KEY} -lt 32 ]; then
        check_fail "TOTP_ENCRYPTION_KEY too short (need 32+ chars)"
    else
        check_pass "TOTP encryption key configured"
    fi
fi

# Check 4: JWT Secrets
if [ -n "$ENV_FILE" ]; then
    JWT_SECRET=$(grep "^JWT_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
    if [ -z "$JWT_SECRET" ] || [[ "$JWT_SECRET" == *"your-"* ]] || [[ "$JWT_SECRET" == *"change-this"* ]]; then
        check_fail "JWT_SECRET not properly configured"
    else
        check_pass "JWT secrets configured"
    fi
fi

# Check 5: PBKDF2 Iterations (code check)
echo ""
echo "📋 Code Security Checks"
echo "-----------------------"

if grep -q "ITERATIONS: 310000" src/lib/services/custodialWallet.ts 2>/dev/null; then
    check_pass "PBKDF2 iterations = 310000 (OWASP 2023)"
elif grep -q "ITERATIONS: 100000" src/lib/services/custodialWallet.ts 2>/dev/null; then
    check_fail "PBKDF2 iterations still 100k (need 310k)"
else
    check_warn "Could not verify PBKDF2 iterations"
fi

# Check 6: Production blocks in custodial wallet
if grep -q "process.env.NODE_ENV === 'production'" src/lib/services/custodialWallet.ts 2>/dev/null; then
    check_pass "Custodial wallet has production environment checks"
else
    check_fail "Custodial wallet missing production environment blocks"
fi

# Check 7: TOTP production blocks
if grep -q "process.env.NODE_ENV === 'production'" src/lib/services/twoFactor.ts 2>/dev/null; then
    check_pass "TOTP service has production environment checks"
else
    check_fail "TOTP service missing production environment blocks"
fi

# Check 8: CSRF Enabled
if [ -n "$ENV_FILE" ]; then
    if grep -q "CSRF_ENABLED=false" "$ENV_FILE" 2>/dev/null; then
        check_fail "CSRF disabled in production"
    else
        check_pass "CSRF protection enabled"
    fi
fi

# Check 9: Session Fingerprinting
if [ -n "$ENV_FILE" ]; then
    if grep -q "SESSION_FINGERPRINT_STRICT=false" "$ENV_FILE" 2>/dev/null; then
        check_warn "Session fingerprinting not in strict mode"
    else
        check_pass "Session fingerprinting enabled"
    fi
fi

# Check 10: Audit Logging
if [ -n "$ENV_FILE" ]; then
    if grep -q "ENABLE_KEY_AUDIT_LOGGING=true" "$ENV_FILE" 2>/dev/null; then
        check_pass "Key audit logging enabled"
    else
        check_warn "Key audit logging not enabled (recommended for compliance)"
    fi
fi

echo ""
echo "📋 Infrastructure Checks"
echo "------------------------"

# Check 11: Redis availability
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        check_pass "Redis is reachable"
    else
        check_warn "Redis ping failed (may be using remote instance)"
    fi
else
    check_warn "redis-cli not installed (cannot verify Redis)"
fi

# Check 12: Database connection
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        check_pass "PostgreSQL is reachable"
    else
        check_warn "PostgreSQL connection failed"
    fi
else
    check_warn "Cannot verify PostgreSQL (psql not installed or DATABASE_URL not set)"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 Security Verification Summary"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 All security checks passed!"
    echo "✅ System is ready for production deployment."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warning(s) detected."
    echo "✅ System can be deployed, but review warnings."
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) detected."
    echo "🚫 Fix all errors before deploying to production!"
    exit 1
fi
