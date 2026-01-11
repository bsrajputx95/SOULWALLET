# Database Encryption Runbook

## Overview

SoulWallet uses AES-256-GCM encryption for sensitive data at rest, implemented through a Prisma middleware layer with pgcrypto-compatible operations.

## Encrypted Fields

| Model | Fields |
|-------|--------|
| User | `email`, `walletAddress` |
| CustodialWallet | `encryptedKey` |
| KYCVerification | `encryptedData` |

## Configuration

### Environment Variables

```bash
# 32-byte hex key (generate with: openssl rand -hex 32)
PGCRYPTO_KEY=your_64_char_hex_key_here

# Optional salt for passphrase-based keys
PGCRYPTO_SALT=custom_salt
```

### Key Generation

```bash
# Generate new encryption key
openssl rand -hex 32
```

## Key Rotation Procedure

> [!CAUTION]
> Key rotation requires downtime. Schedule during maintenance window.

### 1. Generate New Key
```bash
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"
```

### 2. Stop Application
```bash
docker compose stop backend
```

### 3. Run Rotation Script
```typescript
import { rotateEncryptionKey } from './src/lib/prisma/encryption';
import prisma from './src/lib/prisma';

await rotateEncryptionKey(prisma, OLD_KEY, NEW_KEY);
```

### 4. Update Environment
```bash
# Update .env or secrets manager
PGCRYPTO_KEY=$NEW_KEY
```

### 5. Restart Application
```bash
docker compose start backend
```

### 6. Verify
```bash
./scripts/test-encryption.sh
```

## Verification

### Check Encryption is Working
```bash
./scripts/test-encryption.sh
```

### Verify Data at Rest
```sql
-- Encrypted data contains ":" separators (iv:tag:ciphertext)
SELECT id, LEFT(email, 50) 
FROM users 
WHERE email LIKE '%:%:%' 
LIMIT 5;
```

### Test Decryption
```bash
# Application should decrypt automatically
curl -X GET localhost:3001/api/user/me \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### "PGCRYPTO_KEY environment variable is not set"
Ensure the key is set in your environment or .env file.

### Decryption Fails on Read
1. Check key matches the one used for encryption
2. Verify key format (64 hex chars or 44 base64 chars)
3. Check for data corruption in the `:` separators

### pgcrypto Extension Missing
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Recovery from Key Loss

> [!WARNING]
> If the encryption key is lost, encrypted data cannot be recovered.

1. Restore from backup taken before encryption
2. Or request users to re-enter sensitive data
3. Consider this scenario in disaster recovery planning

## Monitoring

- Alert on encryption/decryption failures
- Monitor key age (rotate annually)
- Track encrypted field access patterns
