# Railway Environment Variable Setup Guide

This guide provides step-by-step instructions for configuring environment variables on Railway for SoulWallet production deployment.

## Prerequisites

1. **Railway CLI installed**: `npm install -g @railway/cli`
2. **Railway account**: Sign up at [railway.app](https://railway.app)
3. **Project linked**: Run `railway link` in your project directory
4. **PostgreSQL and Redis provisioned**: Add these services in Railway dashboard

## Quick Start

```bash
# Login to Railway
railway login

# Link to your project
railway link

# Verify connection
railway status
```

## Environment Variables Configuration

### Method 1: Railway Dashboard (Recommended for Secrets)

1. Go to your Railway project dashboard
2. Click on your service
3. Navigate to "Variables" tab
4. Add each variable individually

### Method 2: Railway CLI (Bulk Setup)

```bash
# Core Configuration
railway variables set NODE_ENV="production"
railway variables set PORT="3001"
railway variables set HOST="0.0.0.0"

# Database (auto-populated by Railway PostgreSQL)
# DATABASE_URL is automatically set when you add PostgreSQL service

# Redis (auto-populated by Railway Redis)
# REDIS_URL is automatically set when you add Redis service
```

## Required Environment Variables

### 1. Core Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `HOST` | Server host | `0.0.0.0` |

### 2. Database & Redis

| Variable | Description | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway |
| `REDIS_URL` | Redis connection string | Auto-set by Railway |

**Important**: Ensure `?sslmode=require` is appended to DATABASE_URL for production.

### 3. Security Keys (CRITICAL)

Generate these using `node scripts/generate-production-keys.js`:

| Variable | Description | Min Length |
|----------|-------------|------------|
| `JWT_SECRET` | JWT signing key | 32 chars |
| `JWT_REFRESH_SECRET` | Refresh token key | 32 chars |
| `WALLET_ENCRYPTION_KEY` | Wallet encryption (hex) | 64 hex chars |
| `ADMIN_KEY` | Admin authentication | 32 chars |
| `ADMIN_API_KEY` | Admin API access | 32 chars |
| `SESSION_SECRET` | Session signing | 32 chars |
| `CSRF_SECRET` | CSRF token signing | 32 chars |

```bash
# Generate and set security keys
node scripts/generate-production-keys.js

# Then set each key in Railway
railway variables set JWT_SECRET="your-generated-secret"
railway variables set JWT_REFRESH_SECRET="your-generated-secret"
railway variables set WALLET_ENCRYPTION_KEY="your-64-char-hex-key"
railway variables set ADMIN_KEY="your-generated-secret"
railway variables set CSRF_SECRET="your-generated-secret"
```

### 4. Authentication Settings

```bash
railway variables set JWT_EXPIRES_IN="15m"
railway variables set JWT_REFRESH_EXPIRES_IN="7d"
railway variables set MAX_LOGIN_ATTEMPTS="5"
railway variables set LOCKOUT_DURATION_MINUTES="15"
railway variables set SESSION_FINGERPRINT_STRICT="true"
```

### 5. CORS & Security

```bash
railway variables set ALLOWED_ORIGINS="https://soulwallet-production.up.railway.app,https://soulwallet.app"
railway variables set CSRF_ENABLED="true"
railway variables set SECURE_COOKIES="true"
railway variables set SAME_SITE_COOKIES="strict"
```

### 6. Feature Flags

```bash
railway variables set FEATURE_SEND_ENABLED="true"
railway variables set FEATURE_SWAP_ENABLED="true"
railway variables set FEATURE_COPY_TRADING_ENABLED="true"
railway variables set FEATURE_SIMULATION_MODE="false"
railway variables set ENABLE_PLAYGROUND="false"
railway variables set ENABLE_INTROSPECTION="false"
```

### 7. Blockchain Configuration (Helius)

> ⚠️ **Note**: Get your Helius API key from https://dev.helius.xyz/dashboard/app
> Replace `YOUR_ACTUAL_HELIUS_KEY` with your real API key before deploying.

```bash
railway variables set HELIUS_API_KEY="YOUR_ACTUAL_HELIUS_KEY"
railway variables set HELIUS_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_ACTUAL_HELIUS_KEY"
railway variables set HELIUS_WS_URL="wss://mainnet.helius-rpc.com/?api-key=YOUR_ACTUAL_HELIUS_KEY"
railway variables set SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_ACTUAL_HELIUS_KEY"
railway variables set EXPO_PUBLIC_SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
```

### 8. Email Configuration

Choose one provider:

**SendGrid (Recommended)**:
```bash
railway variables set EMAIL_PROVIDER="sendgrid"
railway variables set SENDGRID_API_KEY="SG.your-api-key"
railway variables set EMAIL_FROM="noreply@soulwallet.app"
```

**Resend**:
```bash
railway variables set EMAIL_PROVIDER="resend"
railway variables set RESEND_API_KEY="re_your-api-key"
railway variables set EMAIL_FROM="noreply@soulwallet.app"
```

**SMTP**:
```bash
railway variables set EMAIL_PROVIDER="smtp"
railway variables set SMTP_HOST="smtp.gmail.com"
railway variables set SMTP_PORT="587"
railway variables set SMTP_USER="your-email@gmail.com"
railway variables set SMTP_PASS="your-app-password"
```

### 9. Monitoring (Optional but Recommended)

> ⚠️ **Note**: The values below are placeholders. Get your actual Sentry DSN from:
> Sentry Dashboard > Settings > Client Keys (DSN)

```bash
railway variables set EXPO_PUBLIC_SENTRY_DSN="https://your-actual-key@sentry.io/your-project-id"
railway variables set SENTRY_AUTH_TOKEN="your-actual-sentry-auth-token"
railway variables set LOG_LEVEL="info"
```

## Security Best Practices

### DO:
- ✅ Use Railway's secret management for all sensitive values
- ✅ Generate unique secrets for each environment (staging vs production)
- ✅ Rotate secrets regularly (every 90 days recommended)
- ✅ Use strong, randomly generated secrets (32+ characters)
- ✅ Enable CSRF protection (`CSRF_ENABLED=true`)
- ✅ Set `SESSION_FINGERPRINT_STRICT=true`
- ✅ Use HTTPS-only origins in `ALLOWED_ORIGINS`

### DON'T:
- ❌ Never commit secrets to git
- ❌ Never use placeholder values in production
- ❌ Never share secrets between environments
- ❌ Never expose API keys in client-side code (eas.json)
- ❌ Never set `FEATURE_SIMULATION_MODE=true` in production
- ❌ Never enable `ENABLE_PLAYGROUND` or `ENABLE_INTROSPECTION` in production

## Verification Steps

### 1. Verify All Variables Are Set

```bash
railway variables
```

### 2. Run Validation Script

```bash
node scripts/validate-production-env.js
```

### 3. Deploy and Test Health Endpoints

```bash
# Deploy
railway up

# Test health endpoint
curl https://your-app.up.railway.app/health

# Test security headers
bash scripts/test-security-headers.sh https://your-app.up.railway.app
```

### 4. Verify CORS

```bash
curl -H "Origin: https://soulwallet.app" \
     -I https://your-app.up.railway.app/health
```

### 5. Verify CSRF Protection

```bash
# Get CSRF token
curl -c cookies.txt https://your-app.up.railway.app/api/csrf

# Use token in POST request
curl -b cookies.txt \
     -H "X-CSRF-Token: <token>" \
     -X POST https://your-app.up.railway.app/api/trpc/auth.login
```

## Troubleshooting

### Database Connection Failed

1. Check DATABASE_URL format: `postgresql://user:pass@host:port/db?sslmode=require`
2. Verify PostgreSQL service is running in Railway
3. Check if IP allowlist is configured (if applicable)

### Redis Connection Failed

1. Check REDIS_URL format: `redis://default:password@host:port`
2. Verify Redis service is running in Railway
3. Check connection timeout settings

### CORS Errors

1. Verify `ALLOWED_ORIGINS` includes your frontend domain
2. Ensure origins use HTTPS (required in production)
3. Check for trailing slashes (should not have them)

### CSRF Token Invalid

1. Ensure `CSRF_ENABLED=true`
2. Check cookie settings (`SameSite=Strict`)
3. Verify token is being sent in `X-CSRF-Token` header

### Environment Validation Failed

1. Run `node scripts/validate-production-env.js` locally
2. Check for placeholder values
3. Verify secret lengths meet minimum requirements

## Rollback Procedures

### Quick Rollback

```bash
# View deployment history
railway deployments

# Rollback to previous deployment
railway rollback
```

### Environment Variable Rollback

1. Keep a backup of working environment variables
2. Use Railway dashboard to restore previous values
3. Redeploy after restoring variables

## Related Documentation

- [Deployment Checklist](./deployment-checklist.md)
- [Security Headers Test Script](./test-security-headers.sh)
- [Production Key Generation](./generate-production-keys.js)
- [Environment Validation](./validate-production-env.js)

## Support

For issues with Railway deployment:
- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

For SoulWallet-specific issues:
- Check server logs: `railway logs`
- Review health endpoints: `/health`, `/health/db`, `/health/redis`
