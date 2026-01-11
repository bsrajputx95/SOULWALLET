# Load Testing Guide

## Overview

Load tests verify the system can handle target throughput of 1000+ concurrent copiers using k6 for performance testing.

## Test Location

Load test script: `tests/load/copy-trading-stress.k6.js`

## Prerequisites

1. Install k6: https://k6.io/docs/get-started/installation/
2. Set up test environment with seeded data
3. Configure environment variables

## Running Load Tests

```bash
# Basic run
k6 run tests/load/copy-trading-stress.k6.js

# With custom options
k6 run tests/load/copy-trading-stress.k6.js \
  --env API_URL=http://localhost:3000 \
  --env TRADER_WALLET=FeaturedTrader123...

# Generate HTML report
k6 run tests/load/copy-trading-stress.k6.js --out json=results.json
```

## Test Scenarios

### Scenario 1: Gradual Ramp Up
Simulates organic growth of copiers over time.

| Duration | VUs | Purpose |
|----------|-----|---------|
| 1 min | 0→100 | Warm up |
| 2 min | 100→500 | Scale test |
| 3 min | 500→1000 | Peak load |
| 5 min | 1000 | Sustained load |
| 2 min | 1000→0 | Cooldown |

### Scenario 2: Burst
Simulates sudden trade by featured trader - all copiers execute simultaneously.

- 100 VUs
- 1000 iterations
- 30 second max duration

## Performance Thresholds

| Metric | Target | Critical |
|--------|--------|----------|
| Copy trade latency (p95) | <5s | <10s |
| Position open latency (p99) | <10s | <15s |
| Success rate | >95% | >90% |
| HTTP response (p95) | <3s | <5s |

## Expected Results

At 1000 concurrent copiers:
- **Trade detection**: <2s (WebSocket)
- **Queue processing**: <1s (5x concurrency)
- **Swap execution**: <3s (Jupiter)
- **Total E2E latency**: <6s

## CI Integration

```yaml
load-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: grafana/k6-action@v0.3.0
      with:
        filename: tests/load/copy-trading-stress.k6.js
        flags: --out json=results.json
    - uses: actions/upload-artifact@v4
      with:
        name: k6-results
        path: results.json
```

## Metrics Collected

- `copy_trade_success` - Success rate of copy trade operations
- `copy_trade_latency_ms` - Latency of copy trade execution
- `position_open_latency_ms` - Time to open a position

## Troubleshooting

| Issue | Solution |
|-------|----------|
| High latency | Check queue depth, increase concurrency |
| Low success rate | Check slippage settings, RPC health |
| Timeouts | Increase TRANSACTION_TIMEOUT_SECONDS |
