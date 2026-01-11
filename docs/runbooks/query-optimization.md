# Query Optimization Runbook

## Overview

This runbook covers identifying and resolving slow queries using pg_stat_statements and the query performance admin endpoint.

## Monitoring Tools

### Admin Endpoint
```bash
curl -X GET http://localhost:3001/api/admin/query-performance \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Grafana Dashboard
Navigate to: **Dashboards > Database Performance**

### Direct SQL
```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

## Identifying Slow Queries

### Definition
- **Slow Query**: Mean execution time > 1 second
- **Frequent Slow Query**: > 100 calls with mean time > 100ms

### Finding Slow Queries
```sql
SELECT 
  LEFT(query, 100) as query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(total_exec_time::numeric/1000, 2) as total_sec
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- > 1 second
ORDER BY total_exec_time DESC
LIMIT 10;
```

## Detecting N+1 Problems

### Signature
- High call count (> 100)
- Low individual execution time (< 10ms)
- Query pattern involves single-row lookups

### Finding N+1 Patterns
```sql
SELECT 
  LEFT(query, 80) as query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms
FROM pg_stat_statements
WHERE calls > 100
  AND mean_exec_time < 10
ORDER BY calls DESC
LIMIT 10;
```

### Fixing N+1

**Before (N+1):**
```typescript
const users = await prisma.user.findMany();
for (const user of users) {
  const sessions = await prisma.session.findMany({ where: { userId: user.id } });
}
```

**After (Single Query):**
```typescript
const users = await prisma.user.findMany({
  include: { sessions: true }
});
```

## Adding Indexes

### Identify Missing Indexes
```sql
-- Queries doing sequential scans on large tables
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
  AND idx_scan < seq_scan
ORDER BY seq_tup_read DESC;
```

### Create Index
```sql
CREATE INDEX CONCURRENTLY idx_users_created_verified 
ON users (created_at, is_verified);
```

### Verify Index Usage
```sql
SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Connection Pool Optimization

### Check Current Settings
```sql
SHOW max_connections;
```

### Tune Pool Size
```bash
# In DATABASE_URL
?connection_limit=10&pool_timeout=20
```

### Monitor Pool Usage
```bash
curl -s http://localhost:3001/metrics | grep prisma_pool
```

## Cache Optimization

### Check Cache Hit Ratio
```sql
SELECT 
  round(100 * blks_hit::numeric / (blks_hit + blks_read), 2) as hit_ratio
FROM pg_stat_database
WHERE datname = current_database();
```

### Target: > 99%

If below 95%, increase `shared_buffers`:
```bash
# In docker-compose.prod.yml
POSTGRES_SHARED_BUFFERS: 1GB  # Increase from 512MB
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Query P95 | < 500ms |
| Slow Queries/day | < 10 |
| Cache Hit Ratio | > 99% |
| Connection Pool | < 80% utilized |

## Escalation

1. **Alert threshold crossed** → Check admin endpoint
2. **Identify slow query** → Add index or optimize
3. **N+1 detected** → Refactor code
4. **Cache ratio low** → Increase shared_buffers
5. **Still slow** → Consider read replicas
