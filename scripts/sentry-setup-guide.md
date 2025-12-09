# Sentry Setup Guide for SoulWallet

## Overview

SoulWallet uses Sentry for crash reporting, error tracking, and performance monitoring across both the mobile app and backend services.

**Architecture:**
- `soulwallet-mobile` - React Native mobile app (iOS/Android)
- `soulwallet-backend` - Node.js/Fastify backend API

## Prerequisites

- Sentry account (free tier available at [sentry.io](https://sentry.io))
- Access to Railway dashboard (for backend env vars)
- Access to EAS dashboard (for mobile secrets)

## Step 1: Create Sentry Projects

1. Log in to [Sentry Dashboard](https://sentry.io)
2. Create two projects:
   - **soulwallet-mobile** (Platform: React Native)
   - **soulwallet-backend** (Platform: Node.js)
3. Get DSN for each project:
   - Navigate to Settings > Projects > [Project] > Client Keys (DSN)
   - DSN format: `https://[public-key]@o[org-id].ingest.sentry.io/[project-id]`

## Step 2: Generate Auth Token

1. Navigate to Settings > Auth Tokens
2. Create new token with scopes:
   - `project:releases` (for source maps)
   - `org:read` (for organization access)
3. Save token securely (needed for EAS secrets and Railway)

## Step 3: Configure Mobile App

### Environment Variables

Add to `.env.production.generated`:
```env
EXPO_PUBLIC_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]
```

### EAS Secrets

```bash
# Add auth token to EAS secrets (for source map uploads)
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <your-token>
```

### Verify Configuration

```bash
npm run sentry:test-config
```

## Step 4: Configure Backend

### Railway Environment Variables

Set in Railway dashboard:
```env
EXPO_PUBLIC_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[backend-project]
SENTRY_AUTH_TOKEN=<your-auth-token>
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT_BACKEND=soulwallet-backend
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

## Step 5: Configure Sentry Dashboard

### Alert Rules (Settings > Alerts)

1. **New Issue Alert**
   - Trigger: When a new issue is created
   - Environment: production
   - Action: Send notification

2. **High Error Rate Alert**
   - Trigger: Error count > 10 in 1 minute
   - Action: Send notification

3. **Slow Transaction Alert**
   - Trigger: Transaction duration > 2 seconds
   - Endpoints: auth.*, wallet.*, swap.*
   - Action: Send notification

### Performance Thresholds

| Endpoint Category | Target | Warning | Critical |
|-------------------|--------|---------|----------|
| Auth endpoints    | 500ms  | 1000ms  | 2000ms   |
| Wallet operations | 1000ms | 2000ms  | 3000ms   |
| Copy trading      | 1500ms | 3000ms  | 5000ms   |
| Swap operations   | 2000ms | 4000ms  | 6000ms   |

### Release Tracking

1. Enable release tracking for both projects
2. Link GitHub repository for commit tracking
3. Configure deploy notifications

## Step 6: Testing

### Test Configuration
```bash
npm run sentry:test-config
```

### Test Error Reporting
```javascript
// In development, trigger a test error:
throw new Error('Sentry test error');
```

### Verify in Dashboard
1. Check Sentry dashboard for test events
2. Verify source maps show original code
3. Check user context is attached

## Step 7: Production Deployment

### Pre-deployment Checklist
- [ ] Run `npm run sentry:test-config`
- [ ] Verify DSN is set in Railway
- [ ] Verify auth token is in EAS secrets
- [ ] Test error reporting in staging

### Post-deployment
- [ ] Monitor Sentry dashboard for 24 hours
- [ ] Verify errors show correct source maps
- [ ] Check performance metrics

## Monitoring Best Practices

1. **Daily**: Review new issues in Sentry
2. **Weekly**: Check performance trends
3. **Monthly**: Review and adjust sample rates
4. **Per Release**: Monitor error rates after deployment

## Cost Optimization

### Free Tier Limits
- 5,000 errors/month
- 10,000 transactions/month

### Recommended Sample Rates

| Environment | Traces | Profiles |
|-------------|--------|----------|
| Development | 100%   | 100%     |
| Staging     | 50%    | 50%      |
| Production (low traffic) | 50% | 50% |
| Production (high traffic) | 10% | 10% |

### Filtering Noisy Errors

Use `beforeSend` to filter:
- Network errors (handled gracefully)
- User cancellation errors
- Known third-party issues

## Troubleshooting

### Source Maps Not Uploading
1. Check `SENTRY_AUTH_TOKEN` in EAS secrets
2. Verify `SENTRY_ORG` and `SENTRY_PROJECT` in eas.json
3. Check EAS build logs for upload errors

### Errors Not Appearing
1. Verify DSN is correct
2. Check network connectivity
3. Verify `initializeSentry()` is called early

### Missing User Context
1. Check `setUser()` is called after login
2. Verify user object has required fields (id, username, email)

### Performance Data Missing
1. Verify `tracesSampleRate > 0`
2. Check transactions are being created
3. Verify spans are properly finished

## Debug Commands

```bash
# Test Sentry configuration
npm run sentry:test-config

# Check EAS secrets
eas secret:list

# View Railway env vars
railway variables
```

## Related Files

- `lib/sentry.ts` - Client-side Sentry configuration
- `src/server/fastify.ts` - Backend Sentry integration
- `eas.json` - EAS build configuration
- `.env.production.example` - Environment variable reference
- `hooks/auth-store.ts` - User context integration

## References

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
