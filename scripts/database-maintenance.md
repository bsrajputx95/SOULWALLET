# Database Maintenance Runbook

## Pre-Deployment Checklist

### 1. Test Database Connection
```bash
tsx scripts/test-database-connection.ts
```

### 2. Verify Schema Alignment
```bash
tsx scripts/verify-schema-alignment.ts
```

### 3. Create Migration (if schema changed)
```bash
bash scripts/create-production-migration.sh
# Review generated SQL in prisma/migrations/
```

### 4. Deploy Migration
```bash
npm run db:migrate:deploy
```

## Production Deployment Steps

### Step 1: Backup Database
```bash
# Railway: Use Railway dashboard > Database > Backups
# Or manual backup:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Deploy Migrations
```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host:5432/soulwallet"

# Deploy migrations (safe, no data loss)
npm run db:migrate:deploy
```

### Step 3: Verify Migration
```bash
# Check migration status
npx prisma migrate status

# Test connection
tsx scripts/test-database-connection.ts
```

### Step 4: Seed Data (Optional)
```bash
# Only run if database is empty or you need test data
npm run db:seed
npm run db:seed-traders
```

## Rollback Procedures

### Rollback Last Migration
```bash
# WARNING: This may cause data loss
# 1. Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 2. Or manually revert migration
# Edit prisma/migrations/[timestamp]_migration/migration.sql
# Create inverse SQL and run:
psql $DATABASE_URL < rollback.sql
```

### Emergency Database Reset (Development Only)
```bash
# ⚠️  NEVER run in production - destroys all data
npm run db:reset
```

## Performance Monitoring

### Check Index Usage
```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Check Slow Queries
```sql
SELECT query, calls, total_time, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Check Connection Pool
```sql
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'soulwallet';
```

## Common Issues

### Issue: "Migration failed" error
**Solution:**
1. Check DATABASE_URL is correct
2. Verify database user has CREATE/ALTER permissions
3. Review migration SQL for syntax errors
4. Check database logs for detailed error

### Issue: "Connection pool exhausted"
**Solution:**
1. Increase connection_limit in DATABASE_URL: `?connection_limit=20`
2. Check for connection leaks (missing `prisma.$disconnect()`)
3. Review `src/lib/prisma.ts` connection pooling config

### Issue: "Slow queries"
**Solution:**
1. Run index usage query above
2. Add missing indexes to `prisma/schema.prisma`
3. Use `EXPLAIN ANALYZE` to diagnose query plans
4. Consider adding composite indexes for common filters

## Health Checks

### Database Health Endpoint
```bash
curl http://localhost:3001/health/db
```

### Manual Health Check
```bash
tsx scripts/test-database-connection.ts
```

## Maintenance Schedule
- **Daily**: Monitor connection pool usage, check error logs
- **Weekly**: Review slow query logs, verify backup integrity
- **Monthly**: Analyze index usage, optimize unused indexes
- **Quarterly**: Review schema for normalization opportunities

## Contact
For database emergencies, refer to `scripts/deployment-checklist.md` and Railway dashboard.
