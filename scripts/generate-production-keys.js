#!/usr/bin/env node

/**
 * Generate secure production keys for Soul Wallet
 * Run this script to generate all required secure keys for production
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate secure random keys
function generateKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64');
}

function generateHexKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateAlphanumeric(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate all required keys
const keys = {
  JWT_SECRET: generateKey(32),
  JWT_REFRESH_SECRET: generateKey(32),
  WALLET_ENCRYPTION_KEY: generateHexKey(32), // Must be hex for AES-256
  ADMIN_KEY: generateKey(32),
  ADMIN_API_KEY: generateKey(32),
  ENCRYPTION_KEY: generateHexKey(32),
  WEBHOOK_SECRET: generateKey(32),
  API_SECRET_KEY: generateKey(32),
  SESSION_SECRET: generateKey(32),
  CSRF_SECRET: generateKey(32),
};

// Generate database URL (placeholder - needs actual credentials)
const databaseUrl = `postgresql://user:password@localhost:5432/soulwallet_prod`;

// Generate Redis URL (placeholder - needs actual credentials)
const redisUrl = `redis://:password@localhost:6379/0`;

// Create production environment template
const envContent = `# Soul Wallet Production Environment Variables
# Generated: ${new Date().toISOString()}
# ⚠️ CRITICAL: Keep this file secure and never commit to version control

#############################################
# Core Configuration
#############################################
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
APP_NAME="Soul Wallet"
APP_URL=https://soulwallet.app
API_URL=https://api.soulwallet.app

#############################################
# Database Configuration
#############################################
DATABASE_URL="${databaseUrl}"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

#############################################
# Redis Configuration
#############################################
REDIS_URL="${redisUrl}"
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000

#############################################
# Security Keys (Generated - Keep Secure!)
#############################################
JWT_SECRET="${keys.JWT_SECRET}"
JWT_REFRESH_SECRET="${keys.JWT_REFRESH_SECRET}"
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_EXP_SECONDS=900

WALLET_ENCRYPTION_KEY="${keys.WALLET_ENCRYPTION_KEY}"
ADMIN_KEY="${keys.ADMIN_KEY}"
ADMIN_API_KEY="${keys.ADMIN_API_KEY}"
ENCRYPTION_KEY="${keys.ENCRYPTION_KEY}"
SESSION_SECRET="${keys.SESSION_SECRET}"
CSRF_SECRET="${keys.CSRF_SECRET}"
WEBHOOK_SECRET="${keys.WEBHOOK_SECRET}"
API_SECRET_KEY="${keys.API_SECRET_KEY}"

#############################################
# Authentication Settings
#############################################
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
SESSION_TIMEOUT_HOURS=24
OTP_EXPIRES_IN_MINUTES=10
PASSWORD_MIN_LENGTH=8
REQUIRE_EMAIL_VERIFICATION=true

#############################################
# Rate Limiting
#############################################
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_API_MAX=1000

#############################################
# Email Configuration (Update with actual SMTP)
#############################################
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
EMAIL_FROM=noreply@soulwallet.app

#############################################
# Blockchain Configuration
#############################################
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
SOLANA_COMMITMENT=confirmed

#############################################
# Monitoring & Analytics
#############################################
EXPO_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_AUTH_TOKEN=your-sentry-auth-token
LOG_LEVEL=info
ENABLE_ANALYTICS=true

#############################################
# Feature Flags
#############################################
FEATURE_SEND_ENABLED=true
FEATURE_SWAP_ENABLED=true
FEATURE_COPY_TRADING_ENABLED=true
FEATURE_SOCIAL_ENABLED=true
FEATURE_SIMULATION_MODE=false
MAINTENANCE_MODE=false

#############################################
# CORS & Security Headers
#############################################
ALLOWED_ORIGINS=https://soulwallet.app,https://www.soulwallet.app,https://app.soulwallet.com
TRUSTED_PROXIES=true
SECURE_COOKIES=true
SAME_SITE_COOKIES=strict

#############################################
# Admin Configuration
#############################################
ADMIN_EMAILS=admin@soulwallet.app
ADMIN_DASHBOARD_ENABLED=true
ADMIN_2FA_REQUIRED=true

#############################################
# Backup Configuration
#############################################
BACKUP_ENABLED=true
BACKUP_S3_BUCKET=soulwallet-backups
BACKUP_RETENTION_DAYS=30
AWS_REGION=us-east-1

#############################################
# Push Notifications
#############################################
EXPO_ACCESS_TOKEN=your-expo-access-token
FCM_SERVER_KEY=your-fcm-server-key
APNS_KEY_ID=your-apns-key-id
APNS_TEAM_ID=your-apns-team-id

#############################################
# Webhooks (Optional)
#############################################
DISCORD_WEBHOOK_URL=
SLACK_WEBHOOK_URL=

#############################################
# Performance & Caching
#############################################
CACHE_TTL=3600
CDN_URL=https://cdn.soulwallet.app
ENABLE_COMPRESSION=true
CLUSTER_WORKERS=4
`;

// Write to .env.production.generated
const outputPath = path.join(__dirname, '..', '.env.production.generated');
fs.writeFileSync(outputPath, envContent);

console.log('🔐 Production keys generated successfully!');
console.log('📁 Keys saved to: .env.production.generated');
console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
console.log('1. Review and update placeholder values (database, Redis, email, etc.)');
console.log('2. NEVER commit .env.production.generated to version control');
console.log('3. Store these keys securely (e.g., AWS Secrets Manager, Azure Key Vault)');
console.log('4. Use different keys for staging and production environments');
console.log('5. Enable audit logging for key access');
console.log('\n📝 Generated Keys:');

// Display keys (only during generation)
Object.entries(keys).forEach(([key, value]) => {
  console.log(`${key}: ${value.substring(0, 20)}...`);
});

console.log('\n✅ Next steps:');
console.log('1. Review .env.production.generated');
console.log('2. Update placeholder values with actual credentials');
console.log('3. Rename to .env.production when ready');
console.log('4. Deploy to secure environment');
