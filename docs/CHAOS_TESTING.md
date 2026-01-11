# Chaos Testing Guide

Comprehensive guide for running chaos engineering tests on SoulWallet to verify resilience under failure conditions.

## Overview

Chaos testing validates that SoulWallet handles infrastructure failures gracefully:
- **Database failures** - PostgreSQL connection issues, timeouts
- **RPC failures** - Solana RPC endpoint unavailability
- **Redis failures** - Cache connection failures
- **Pod failures** - Service instance crashes

## Prerequisites

- Docker and docker-compose installed
- Node.js 20+
- k6 for load testing (optional)
- Access to docker-compose.prod.yml

## Quick Start

```bash
# Run all chaos tests
npm run test:chaos

# Run individual scenarios
npm run test:chaos:db
npm run test:chaos:rpc
npm run test:chaos:redis
npm run test:chaos:pod
```

## Test Scenarios

### 1. Database Failure (`database-failure.test.ts`)

Tests system behavior when PostgreSQL becomes unavailable:
- Circuit breaker opens after repeated failures
- Cached data served as fallback
- Recovery when database returns

**What's tested:**
- Connection pool exhaustion handling
- Query timeout behavior
- Transaction rollback on failure
- Graceful degradation to cached responses

### 2. RPC Failure (`rpc-failure.test.ts`)

Tests behavior when Solana RPC endpoints fail:
- Timeout handling
- Failover to backup endpoints
- Transaction retry with exponential backoff
- Dead letter queue for failed transactions

**What's tested:**
- RPC endpoint failover logic
- Transaction confirmation timeouts
- Balance query fallbacks
- Swap execution retry logic

### 3. Redis Failure (`redis-failure.test.ts`)

Tests behavior when Redis cache is unavailable:
- Rate limiting fallback to in-memory
- Session validation fallback to database
- Cache miss handling
- Graceful service continuation

**What's tested:**
- Rate limiter memory fallback
- Session cache miss handling
- Pub/sub reconnection
- Cache write failures

### 4. Pod Failure (`pod-failure.test.ts`)

Tests behavior when service instances crash:
- Load balancer traffic redirect
- Zero-downtime restarts
- Session persistence across restarts
- State recovery

**What's tested:**
- PM2 cluster recovery
- Connection draining
- Health check failures
- Auto-scaling triggers

## Chaos Mesh Integration

For production-like chaos injection, use Chaos Mesh:

### Start Chaos Mesh

```bash
docker-compose -f docker-compose.prod.yml up -d chaos-mesh
```

Access dashboard at: http://localhost:2333

### Create Chaos Experiments

**Network Delay:**
```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: postgres-delay
spec:
  selector:
    labelSelectors:
      app: postgres
  mode: all
  action: delay
  delay:
    latency: "500ms"
  duration: "30s"
```

**Pod Kill:**
```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: backend-kill
spec:
  selector:
    labelSelectors:
      app: backend
  mode: one
  action: pod-kill
  duration: "10s"
```

## Running Chaos Tests

### Full Orchestration

```bash
./scripts/run-chaos-tests.sh
```

This script:
1. Starts required infrastructure
2. Runs all chaos scenarios
3. Generates a report

### With Load

For more realistic testing, combine chaos with load:

```bash
# Terminal 1: Start load test
k6 run tests/load/api-load-test.js

# Terminal 2: Inject chaos
npm run test:chaos:db
```

## Interpreting Results

### Circuit Breaker States

| State | Meaning |
|-------|---------|
| CLOSED | Normal operation, requests flow through |
| OPEN | Failures detected, requests rejected immediately |
| HALF_OPEN | Testing recovery, limited requests allowed |

### Pass Criteria

- ✅ Circuit breaker opens after threshold failures
- ✅ Fallback mechanisms activate correctly
- ✅ Recovery occurs after chaos ends
- ✅ No data corruption during failures
- ✅ Error responses returned (not hangs)

### Fail Indicators

- ❌ Hung requests (no timeout)
- ❌ Data inconsistency after recovery
- ❌ Circuit never opens (missing protection)
- ❌ No fallback (hard failure on dependency)

## Report Generation

```bash
npm run test:chaos:report
```

Reports are saved to `__tests__/reports/` with:
- JSON summary
- Markdown report
- Resilience score (A-F grade)
- Recommendations

## Best Practices

1. **Run in isolation** - Don't run chaos tests in production
2. **Monitor observability** - Watch Grafana during tests
3. **Start small** - Begin with single failure types
4. **Combine failures** - Eventually test cascading failures
5. **Document findings** - Update runbooks based on results

## Troubleshooting

### Tests Timeout

```bash
# Increase Jest timeout
jest --testTimeout=30000 __tests__/chaos
```

### Docker Issues

```bash
# Reset containers
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

### Server Not Starting

```bash
# Check logs
npm run server:start 2>&1 | tee server.log
```

## Related Documentation

- [TESTING.md](./TESTING.md) - General testing guide
- [LOAD_TESTING.md](./LOAD_TESTING.md) - Load testing guide
- [RUNBOOK.md](./RUNBOOK.md) - Incident response procedures
