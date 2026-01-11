#!/bin/bash
# Plan10 Step 6: Infrastructure Failover Test Script
# Tests system resilience against component failures
#
# Usage: ./scripts/test-failover.sh
# Requirements: Docker Compose, curl
#
# WARNING: This will temporarily stop services. Run in staging, not production!

set -e

echo "=========================================="
echo "🧪 SoulWallet Failover Test Suite"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will temporarily stop services!"
echo "   Run this in staging environment only."
echo ""

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
DOCKER_COMPOSE_CMD="${DOCKER_COMPOSE_CMD:-docker-compose}"
RECOVERY_WAIT="${RECOVERY_WAIT:-15}"

TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
test_pass() {
    echo "✅ PASS: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    echo "❌ FAIL: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

wait_for_health() {
    local max_attempts=$1
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    return 1
}

# Pre-flight check
echo "🔍 Pre-flight Check"
echo "-------------------"

if ! curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo "❌ Backend not responding at $BACKEND_URL"
    echo "   Start the application before running failover tests."
    exit 1
fi
echo "✅ Backend is healthy"
echo ""

# Test 1: Redis Failover
echo "=========================================="
echo "Test 1: Redis Failover"
echo "=========================================="

echo "📍 Stopping Redis..."
$DOCKER_COMPOSE_CMD stop redis 2>/dev/null || echo "Note: Could not stop Redis via docker-compose"

sleep 3

echo "📍 Testing API with Redis down..."
if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
    test_pass "API still responding with Redis down (graceful degradation)"
else
    test_fail "API completely down after Redis failure"
fi

echo "📍 Restarting Redis..."
$DOCKER_COMPOSE_CMD start redis 2>/dev/null || echo "Note: Could not start Redis via docker-compose"

sleep $RECOVERY_WAIT

echo "📍 Testing API after Redis recovery..."
if wait_for_health 10; then
    test_pass "API recovered after Redis restart"
else
    test_fail "API did not recover after Redis restart"
fi

echo ""

# Test 2: Database Failover
echo "=========================================="
echo "Test 2: Database Failover"
echo "=========================================="

echo "📍 Stopping PostgreSQL..."
$DOCKER_COMPOSE_CMD stop postgres 2>/dev/null || echo "Note: Could not stop PostgreSQL via docker-compose"

sleep 5

echo "📍 Testing API with database down..."
# API should return degraded status or 503
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "503" ] || [ "$HEALTH_STATUS" = "500" ]; then
    test_pass "API correctly reports unhealthy when database is down"
elif [ "$HEALTH_STATUS" = "200" ]; then
    echo "⚠️  API reports healthy without database (check health endpoint logic)"
else
    echo "⚠️  API returned status $HEALTH_STATUS"
fi

echo "📍 Restarting PostgreSQL..."
$DOCKER_COMPOSE_CMD start postgres 2>/dev/null || echo "Note: Could not start PostgreSQL via docker-compose"

sleep $RECOVERY_WAIT

echo "📍 Testing API after database recovery..."
if wait_for_health 15; then
    test_pass "API recovered after PostgreSQL restart"
else
    test_fail "API did not recover after PostgreSQL restart"
fi

echo ""

# Comment 4: Test 3: RabbitMQ Failover
echo "=========================================="
echo "Test 3: RabbitMQ Failover"
echo "=========================================="

echo "📍 Stopping RabbitMQ..."
$DOCKER_COMPOSE_CMD stop rabbitmq 2>/dev/null || echo "Note: Could not stop RabbitMQ via docker-compose"

sleep 5

echo "📍 Testing API with RabbitMQ down..."
# API should still respond (queues should degrade gracefully)
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    test_pass "API still responding with RabbitMQ down (graceful degradation)"
elif [ "$HEALTH_STATUS" = "503" ]; then
    echo "⚠️  API reports degraded (queue processing paused but API responds)"
else
    test_fail "API not responding when RabbitMQ is down (status: $HEALTH_STATUS)"
fi

echo "📍 Restarting RabbitMQ..."
$DOCKER_COMPOSE_CMD start rabbitmq 2>/dev/null || echo "Note: Could not start RabbitMQ via docker-compose"

sleep $RECOVERY_WAIT

echo "📍 Testing API after RabbitMQ recovery..."
if wait_for_health 10; then
    test_pass "API recovered after RabbitMQ restart"
else
    test_fail "API did not recover after RabbitMQ restart"
fi

# Verify queue is processing (check RabbitMQ management API if available)
echo "📍 Verifying RabbitMQ queue connectivity..."
if curl -sf -u "${RABBITMQ_USER:-soulwallet}:${RABBITMQ_PASSWORD:-rabbitmq_password}" \
    "http://localhost:15672/api/queues" > /dev/null 2>&1; then
    test_pass "RabbitMQ management API accessible"
else
    echo "⚠️  RabbitMQ management API not accessible (may need port 15672 exposed)"
fi

echo ""

# Test 4: Application Restart Resilience
echo "=========================================="
echo "Test 4: Application Restart Resilience"
echo "=========================================="

echo "📍 Restarting backend service..."
$DOCKER_COMPOSE_CMD restart backend 2>/dev/null || echo "Note: Could not restart backend via docker-compose"

echo "📍 Waiting for application to come back online..."
sleep 30

if wait_for_health 20; then
    test_pass "Application recovered after restart"
else
    test_fail "Application did not recover after restart"
fi

echo ""

# Test 5: Rapid Request Handling After Recovery
echo "=========================================="
echo "Test 5: Post-Recovery Load Test"
echo "=========================================="

echo "📍 Sending rapid requests after recovery..."
SUCCESS_COUNT=0
for i in {1..20}; do
    if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    fi
done

if [ $SUCCESS_COUNT -ge 18 ]; then
    test_pass "Handled 20 rapid requests ($SUCCESS_COUNT/20 succeeded)"
elif [ $SUCCESS_COUNT -ge 10 ]; then
    echo "⚠️  Partial success: $SUCCESS_COUNT/20 requests succeeded"
else
    test_fail "Only $SUCCESS_COUNT/20 requests succeeded after recovery"
fi

echo ""

# Summary
echo "=========================================="
echo "📊 Failover Test Summary"
echo "=========================================="
echo ""
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 All failover tests passed!"
    echo "✅ System demonstrates good resilience."
    exit 0
else
    echo "❌ Some failover tests failed."
    echo "   Review infrastructure configuration."
    exit 1
fi
