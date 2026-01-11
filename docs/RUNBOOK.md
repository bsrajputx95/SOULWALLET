# SoulWallet Operations Runbook

This runbook provides operational procedures for managing SoulWallet in production.

## Table of Contents
1. [Deployment](#deployment)
2. [Scaling](#scaling)
3. [Monitoring](#monitoring)
4. [Incident Response](#incident-response)
5. [Backup & Recovery](#backup--recovery)
6. [Queue Management](#queue-management)

---

## Deployment

### Production Deployment
```bash
# Pull latest code
git pull origin main

# Build and restart
npm run server:build
pm2 reload ecosystem.config.js --env production

# Verify health
curl http://localhost:3001/health
```

### Zero-Downtime Deployment
```bash
# Rolling restart (one instance at a time)
pm2 reload all --update-env

# Monitor during rollout
pm2 monit
```

### Rollback
```bash
# Revert to previous version
git checkout HEAD~1
npm run server:build
pm2 reload all
```

---

## Scaling

### Scale Up (Vertical)
1. Increase container memory/CPU limits in `docker-compose.yml`
2. Increase `DB_CONNECTION_LIMIT` if needed
3. Restart services: `docker-compose up -d`

### Scale Out (Horizontal)
```bash
# Add PM2 instances
pm2 scale soulwallet +2

# Update nginx upstream (if using nginx)
# Add new server entries to nginx.conf
```

### Database Scaling
1. Enable read replica: Set `DATABASE_READ_REPLICA_URL`
2. Update read-heavy queries to use `getPrismaReadClient()`
3. Monitor replica lag

---

## Monitoring

### Health Check
```bash
# Basic health
curl http://localhost:3001/health

# Detailed metrics
curl http://localhost:3001/api/admin/metrics
```

### Key Metrics to Monitor
| Metric | Alert Threshold |
|--------|-----------------|
| Response time (P95) | > 500ms |
| Error rate | > 1% |
| CPU usage | > 80% |
| Memory usage | > 85% |
| Queue depth | > 1000 |
| Cache hit rate | < 70% |

### PM2 Monitoring
```bash
# Real-time monitoring
pm2 monit

# Process list
pm2 list

# Logs
pm2 logs --lines 100
```

---

## Incident Response

### High Latency
1. Check Redis cache: `redis-cli INFO stats`
2. Check database: `SELECT * FROM pg_stat_activity;`
3. Check queue depth: `curl /api/admin/queue-stats`
4. Scale up if needed

### Service Down
1. Check PM2 status: `pm2 list`
2. Check Docker: `docker-compose ps`
3. Check logs: `pm2 logs --err`
4. Restart: `pm2 restart all`

### Database Issues
1. Check connections: `SELECT count(*) FROM pg_stat_activity;`
2. Check for locks: `SELECT * FROM pg_locks WHERE NOT granted;`
3. Restart PgBouncer if connection exhausted

### Redis Issues
1. Check memory: `redis-cli INFO memory`
2. Clear cache if needed: `redis-cli FLUSHDB` (use with caution!)
3. Restart Redis: `docker-compose restart redis`

---

## Backup & Recovery

### Manual Backup
```bash
# Database backup
./scripts/backup-database.sh

# Verify backup
./scripts/verify-backup.sh
```

### Restore from Backup
```bash
# Stop application
pm2 stop all

# Restore database
./scripts/restore-backup.sh /path/to/backup.sql

# Restart application
pm2 start all
```

### Scheduled Backups
Backups run automatically via the `backup` service in docker-compose.
- Daily: Full backup
- Retention: 7 days

---

## Queue Management

### Monitor Queues
```bash
# Queue stats
curl http://localhost:3001/api/admin/queue-stats

# DLQ items
curl http://localhost:3001/api/admin/dlq-items
```

### Retry Failed Jobs
```bash
# Retry all DLQ items
curl -X POST http://localhost:3001/api/admin/dlq-retry-all

# Retry specific queue
curl -X POST http://localhost:3001/api/admin/dlq-retry?queue=buy-orders
```

### Pause/Resume Queues
```bash
# Pause queue (for maintenance)
curl -X POST http://localhost:3001/api/admin/queue-pause?queue=buy-orders

# Resume queue
curl -X POST http://localhost:3001/api/admin/queue-resume?queue=buy-orders
```

### Clear Stuck Jobs
```bash
# Clear completed jobs older than 24h
curl -X POST http://localhost:3001/api/admin/queue-clean?queue=buy-orders&grace=86400

# Clear failed jobs
curl -X POST http://localhost:3001/api/admin/queue-clean-failed?queue=buy-orders
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | [Configured in PagerDuty] |
| Database Admin | [Configured in PagerDuty] |
| Security Team | security@soulwallet.com |

---

## Appendix: Useful Commands

```bash
# Full system status
docker-compose ps && pm2 list

# Resource usage
docker stats

# Database size
psql -c "SELECT pg_size_pretty(pg_database_size('soulwallet'));"

# Redis memory
redis-cli INFO memory | grep used_memory_human

# Active connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```
