# PITR Recovery Runbook

## Overview

Point-in-Time Recovery (PITR) allows restoring the database to any point within WAL retention period.

**Targets:**
- RPO: < 10 seconds
- RTO: < 1 minute

## Prerequisites

- WAL archiving enabled (`wal_level=replica`, `archive_mode=on`)
- Base backup available
- WAL files archived

## Recovery Procedure

### 1. Identify Recovery Point

```bash
# Format: "YYYY-MM-DD HH:MM:SS"
TARGET_TIME="2024-01-15 14:30:00"
```

### 2. Stop Application

```bash
docker compose stop backend postgres
```

### 3. Locate Base Backup

```bash
ls -la ./backups/
# Find backup from BEFORE your target time
BACKUP_FILE="./backups/basebackup-20240115.tar.gz"
```

### 4. Run Recovery Script

```bash
./scripts/restore-pitr.sh \
  --backup-file "$BACKUP_FILE" \
  --target-time "$TARGET_TIME"
```

### 5. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 6. Monitor Recovery

```bash
docker compose logs -f postgres
# Wait for "database system is ready to accept connections"
```

### 7. Verify Data

```sql
-- Check data at recovery point
SELECT COUNT(*) FROM users;
SELECT MAX(created_at) FROM transactions;
```

### 8. Restart Application

```bash
docker compose up -d backend
```

## Verification

### Test PITR Capability
```bash
./scripts/test-pitr.sh
```

### Check WAL Archiving
```sql
SHOW wal_level;        -- Should be 'replica'
SHOW archive_mode;     -- Should be 'on'
SHOW archive_command;  -- Should have archive path
```

## Common Scenarios

### Accidental Data Deletion
1. Note exact time of deletion
2. Recover to 1 minute before deletion
3. Export recovered data
4. Merge back to production

### Database Corruption
1. Use latest base backup
2. Recover to just before corruption
3. Verify data integrity

### Failed Deployment
1. Note deployment time
2. Recover to pre-deployment state
3. Investigate and fix deployment

## Troubleshooting

### "recovery.signal not found"
The restore script creates this file. Ensure you ran `restore-pitr.sh` correctly.

### "WAL file not found"
WAL files may have been cleaned up. Check retention settings:
```sql
SHOW wal_keep_size;
```

### Recovery Takes Too Long
- Consider increasing `checkpoint_completion_target`
- Use more recent base backups
- Ensure WAL files are local (not remote)

## Monthly Testing

> [!IMPORTANT]
> Test PITR monthly to ensure it works when needed.

1. Create test backup
2. Perform recovery to test database
3. Verify data at recovery point
4. Document results
5. Clean up test environment

## Alerts

Configure alerts for:
- WAL archiving failures
- Base backup age > 7 days
- Archive directory disk usage > 80%
