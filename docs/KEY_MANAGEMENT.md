# Key Management System

This document describes the key management system for SoulWallet, including encryption, rotation, and emergency procedures.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Key Management Architecture                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │    AWS KMS      │     │   Environment   │                   │
│  │  (Production)   │     │   Variables     │                   │
│  │                 │     │   (Fallback)    │                   │
│  └────────┬────────┘     └────────┬────────┘                   │
│           │                       │                            │
│           └───────────┬───────────┘                            │
│                       ▼                                        │
│           ┌───────────────────────┐                            │
│           │  KeyManagementService │                            │
│           │  (Abstraction Layer)  │                            │
│           └───────────┬───────────┘                            │
│                       │                                        │
│    ┌──────────────────┼──────────────────┐                    │
│    ▼                  ▼                  ▼                    │
│ ┌──────────┐   ┌──────────────┐   ┌───────────┐              │
│ │ Custodial│   │     JWT      │   │   TOTP    │              │
│ │ Wallets  │   │   Secrets    │   │  Secrets  │              │
│ └──────────┘   └──────────────┘   └───────────┘              │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Key Types

### 1. Custodial Wallet Keys
- **Purpose**: Encrypt private keys for copy trading wallets
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Storage**: Database (encrypted)
- **Rotation**: Manual via `npm run keys:rotate-master`

### 2. JWT Signing Secrets
- **Purpose**: Sign access and refresh tokens
- **Algorithm**: HS256 (HMAC-SHA256)
- **Storage**: Environment variables + database tracking
- **Rotation**: Automatic every 90 days via cron

### 3. TOTP Encryption Keys
- **Purpose**: Encrypt 2FA secrets at rest
- **Algorithm**: AES-256-GCM with scrypt key derivation
- **Storage**: Environment variable
- **Rotation**: Manual when compromised

## Configuration

### Environment Variables

```env
# KMS Provider (aws | env | vault)
KMS_PROVIDER=env

# AWS KMS Configuration (if KMS_PROVIDER=aws)
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/...

# Master Wallet Encryption
CUSTODIAL_WALLET_MASTER_SECRET=<64+ character secret>
CUSTODIAL_WALLET_SALT=<optional legacy salt>

# JWT Secrets (comma-separated for rotation)
JWT_SECRET=<current_secret>,<previous_secret>
JWT_REFRESH_SECRET=<current_secret>,<previous_secret>

# Rotation Configuration
JWT_ROTATION_PERIOD_DAYS=90
JWT_OVERLAP_PERIOD_DAYS=7

# TOTP Encryption
TOTP_ENCRYPTION_KEY=<32+ character key>

# Audit Logging
ENABLE_KEY_AUDIT_LOGGING=true
```

## Key Rotation

### JWT Secret Rotation

JWT secrets are rotated automatically via cron job every Sunday at 3 AM:

```
Weekly Check → Is secret older than 90 days? → Generate new secret
                                            → Register in database
                                            → Log WARNING to update env
```

**Manual rotation:**
```bash
npm run keys:rotate-jwt
```

This will output new secrets that must be added to your environment or secrets manager.

### Master Key Rotation

Master keys for custodial wallets require a planned rotation:

1. **Preparation:**
   ```bash
   # Generate new secret
   openssl rand -base64 64
   
   # Set as environment variable
   export CUSTODIAL_WALLET_NEW_MASTER_SECRET="<new_secret>"
   ```

2. **Dry run:**
   ```bash
   npm run keys:rotate-master -- --dry-run
   ```

3. **Execute:**
   ```bash
   npm run keys:rotate-master -- --batch-size=50
   ```

4. **Update configuration:**
   - Replace `CUSTODIAL_WALLET_MASTER_SECRET` with new value
   - Remove `CUSTODIAL_WALLET_NEW_MASTER_SECRET`
   - Deploy

## Monitoring

### Check Key Status

```bash
npm run keys:status
```

Output example:
```
=== KEY MANAGEMENT STATUS REPORT ===
  Generated: 2024-12-26T12:00:00Z
  Rotation Period: 90 days
  Overlap Period: 7 days

=== Environment Configuration ===
  ✅ CUSTODIAL_WALLET_MASTER_SECRET: SET
  ✅ JWT_SECRET: SET (2 values)
  ✅ TOTP_ENCRYPTION_KEY: SET

=== Master Key Status ===
  Version 2: ✅ ACTIVE
    Algorithm: AES-256-GCM
    Created: 2024-10-01
    Expires: 2025-01-06

=== JWT Secret Status ===
  ACCESS TOKENS:
    Version 3: ✅ OK
      Expires: 2025-03-01 (65 days)
```

### Audit Logs

Key operations are logged to the `key_operation_logs` table:

```sql
SELECT operation, key_version, success, created_at
FROM key_operation_logs
ORDER BY created_at DESC
LIMIT 20;
```

## Emergency Procedures

### Compromised JWT Secret

1. **Immediately generate new secrets:**
   ```bash
   npm run keys:rotate-jwt -- --both
   ```

2. **Update environment and deploy**

3. **Invalidate all active sessions:**
   ```sql
   DELETE FROM sessions;
   ```

### Compromised Master Key

1. **Disable copy trading immediately**

2. **Prepare rollback key:**
   ```bash
   export CUSTODIAL_WALLET_ROLLBACK_SECRET="<previous_key>"
   ```

3. **Execute rollback:**
   ```bash
   npm run keys:rollback -- --target-version=N
   ```

4. **Investigate and rotate again with new key**

### KMS Service Outage (AWS)

The system automatically falls back to environment-based encryption if KMS is unavailable:

1. Application logs warning about KMS fallback
2. New wallets created with env-based encryption
3. Existing KMS wallets may fail to decrypt
4. Monitor logs and wait for KMS recovery

## Database Schema

### Key Tracking Models

```prisma
model KeyVersion {
  id          String   @id @default(cuid())
  version     Int      @unique
  algorithm   String
  kdfConfig   Json
  kmsKeyId    String
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
  isActive    Boolean  @default(true)
}

model JWTSecretVersion {
  id          String   @id @default(cuid())
  secretHash  String   @unique
  version     Int      @unique
  purpose     String   // "access" or "refresh"
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  isActive    Boolean  @default(true)
  rotatedBy   String?
}

model KeyOperationLog {
  id          String   @id @default(cuid())
  operation   String
  keyVersion  Int
  userId      String?
  success     Boolean
  errorMsg    String?
  metadata    Json?
  createdAt   DateTime @default(now())
}
```

## Best Practices

1. **Never log secrets** - Use hashes for identification
2. **Rotate regularly** - Even without incidents
3. **Test rotation** - Use `--dry-run` first
4. **Monitor** - Run `keys:status` weekly
5. **Backup** - Keep previous secrets for rollback
6. **Document** - Log who rotated and why

## Troubleshooting

### "No active secret version found"
- JWT rotation tracking not initialized
- Run application startup to initialize

### "Failed to decrypt wallet"
- Key version mismatch
- Check `keyVersion` in wallet record
- Ensure correct master secret is configured

### "KMS access denied"
- Check AWS credentials
- Verify KMS key policy
- Check IAM role permissions

### Migration failing
- Ensure legacy salt is configured
- Check `CUSTODIAL_WALLET_MASTER_SECRET` is correct
- Review error logs for specific wallet IDs
