# SoulWallet Scaling Architecture

This document describes the enterprise scaling architecture for SoulWallet, including horizontal scaling, load balancing, database optimization, and performance testing.

## Architecture Overview

```
                    ┌─────────────┐
                    │   Nginx     │
                    │Load Balancer│
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
    │ PM2 :3001│      │ PM2 :3002│      │ PM2 :3003│
    └────┬────┘      └────┬────┘      └────┬────┘
         │                 │                 │
         └────────────┬────┴────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───┴───┐      ┌─────┴─────┐      ┌────┴────┐
│ Redis │      │ PgBouncer │      │  Bull   │
│Cache  │      │Connection │      │ Queues  │
│+Pubsub│      │  Pooler   │      └────┬────┘
└───────┘      └─────┬─────┘           │
                     │                 │
         ┌───────────┴───────────┐     │
         │                       │     │
    ┌────┴────┐           ┌─────┴────┐│
    │Postgres │◄──────────│ Postgres ││
    │ Primary │ Replication│ Replica  ││
    └─────────┘           └──────────┘│
                                      │
                              ┌───────┴───────┐
                              │   Jupiter     │
                              │   Helius      │
                              └───────────────┘
```

## Components

### 1. Nginx Load Balancer
- **Purpose:** Distribute traffic across PM2 instances
- **Features:** Sticky sessions (WebSocket support), rate limiting, SSL termination
- **Config:** `nginx/nginx.conf`

### 2. PM2 Cluster
- **Purpose:** Run multiple Node.js instances
- **Config:** `pm2.config.js` (instances: 'max')
- **Ports:** 3001-3004

### 3. Redis
- **Cache:** Session, price, portfolio data
- **Pub/Sub:** Cross-instance event broadcasting
- **Queues:** Bull queue backend

### 4. Bull Queues
| Queue | Purpose |
|-------|---------|
| `buy-orders` | Copy trade buy execution |
| `sell-orders` | Copy trade sell execution |
| `transaction-processing` | Transaction monitoring |
| `profit-sharing` | Fee distribution |

### 5. Database Layer
- **Primary:** Write operations
- **Replica:** Read-heavy queries (getPrismaReadClient)
- **PgBouncer:** Connection pooling (1000 max connections)

## Scaling Operations

### Add More Instances
```bash
# Update PM2 config
pm2 scale soulwallet +2

# Update nginx upstream
# Add server backend:300X entries
```

### Enable Read Replica
```bash
# Set environment variable
DATABASE_READ_REPLICA_URL=postgresql://user:pass@replica:5432/soulwallet

# Update queries to use getPrismaReadClient()
const readPrisma = getPrismaReadClient();
const data = await readPrisma.user.findMany();
```

### Enable PgBouncer
```bash
# Update DATABASE_URL to point to PgBouncer
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/soulwallet
```

## Load Testing

### Normal Load Test
```bash
npx k6 run tests/load/api-load-test.js
```

### Spike Test
```bash
npx k6 run tests/load/spike-test.js
```

### Stress Test (Find Breaking Point)
```bash
npx k6 run tests/load/stress-test.js
```

## Performance Profiling

```bash
# Full profiling suite
./scripts/profile-api.sh

# Individual profiles
npm run profile:doctor   # Overall health
npm run profile:flame    # CPU hotspots
npm run profile:heap     # Memory usage
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Throughput | 1000+ req/s |
| P95 Latency | < 250ms |
| Error Rate | < 0.1% |
| Concurrent Users | 10K+ |
| Uptime | 99.9% |

## Troubleshooting

### High Latency
1. Check Redis cache hit rate via `/health` endpoint
2. Run `npm run profile:flame` to identify CPU hotspots
3. Check database query times in logs

### Memory Issues
1. Run `npm run profile:heap` 
2. Check for memory leaks in long-running processes
3. Review Bull queue memory usage

### Connection Exhaustion
1. Check PgBouncer stats
2. Review pool utilization via `/health` endpoint
3. Increase `MAX_CLIENT_CONN` if needed
