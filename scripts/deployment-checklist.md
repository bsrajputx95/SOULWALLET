# Soul Wallet Deployment Checklist

## ✅ App Icon Implementation
- [x] Generated all icon sizes from soulwalleticon.jpg
- [x] Updated app.json with correct icon paths
- [x] Created adaptive icons for Android
- [x] Created splash screen with branding
- [x] Generated favicon for web

## 🗄️ Database Migration & Schema Validation

### Pre-Migration Checks
- [ ] Backup production database (Railway dashboard or `pg_dump`)
- [ ] Test database connection: `tsx scripts/test-database-connection.ts`
- [ ] Verify schema alignment: `tsx scripts/verify-schema-alignment.ts`
- [ ] Review migration SQL in `prisma/migrations/` directory

### Migration Deployment
- [ ] Set production DATABASE_URL environment variable
- [ ] Run `npm run db:migrate:deploy` (safe, no data loss)
- [ ] Verify migration status: `npx prisma migrate status`
- [ ] Check database health: `curl http://localhost:3001/health/db`

### Index Verification
- [ ] Confirm new indexes created (check PostgreSQL logs or `\d+ table_name`)
- [ ] Test query performance on critical paths:
  - Copy trading positions query (copyTrading.getOpenPositions)
  - Portfolio snapshot range query (portfolio.getHistory)
  - Social feed query (social.getFeed)

### Seed Data (Optional)
- [ ] Run `npm run db:seed` (only if database is empty)
- [ ] Run `npm run db:seed-traders` (creates 10 featured traders)
- [ ] Verify seed data: Check user count, trader profiles

### Post-Migration Validation
- [ ] Test critical user flows (signup, login, wallet operations)
- [ ] Monitor database connection pool usage
- [ ] Check for migration-related errors in logs
- [ ] Document migration completion time and any issues

### Rollback Plan
- [ ] Keep database backup accessible for 7 days
- [ ] Document rollback procedure in `scripts/database-maintenance.md`
- [ ] Test rollback in staging environment first

**Reference:** See `scripts/database-maintenance.md` for detailed procedures.

---

## 🔐 Security Configuration

### Environment Variables Setup
- [ ] Run `node scripts/generate-production-keys.js` to regenerate all secrets
- [ ] Run `node scripts/validate-production-env.js` to validate configuration
- [ ] Update DATABASE_URL with Railway PostgreSQL connection string
- [ ] Update REDIS_URL with Railway Redis connection string
- [ ] Set CSRF_ENABLED=true
- [ ] Configure ALLOWED_ORIGINS with production domains
- [ ] Remove Helius API key from eas.json (move to Railway env vars)
- [ ] Set all Railway environment variables (see `scripts/railway-env-setup.md`)
- [ ] Test environment validation on Railway
- [ ] Verify security headers in production
- [ ] Test CORS with production domains
- [ ] Test CSRF protection flow

### Critical Security Items
```bash
# Generate secure keys for production
node scripts/generate-production-keys.js

# Validate production environment
node scripts/validate-production-env.js

# Test security headers
bash scripts/test-security-headers.sh https://your-app.up.railway.app
```

### Security Verification
- [ ] Run security header scan (securityheaders.com)
- [ ] Test CORS policy with production domains
- [ ] Verify CSRF protection is enabled
- [ ] Test rate limiting
- [ ] Verify JWT token expiration (should be 15m)
- [ ] Test session management
- [ ] Verify all secrets are rotated from defaults

## 🚂 Railway Deployment Configuration

See detailed guide: `scripts/railway-env-setup.md`

### Railway Setup Checklist
- [ ] Railway CLI installed and logged in
- [ ] Project linked with `railway link`
- [ ] PostgreSQL service provisioned
- [ ] Redis service provisioned
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Health check endpoints verified

### Railway Environment Variables
```bash
# Verify all variables are set
railway variables

# Deploy
railway up

# Check logs
railway logs
```

## 📱 Android Production Build & Optimization

### Pre-Build Configuration
- [ ] ProGuard/R8 enabled in `android/gradle.properties`
- [ ] Resource shrinking enabled
- [ ] Comprehensive ProGuard rules in `android/app/proguard-rules.pro`
- [ ] APK splits configured in `android/app/build.gradle`
- [ ] Debug keystore removed from release builds
- [ ] EAS credentials configured for production signing
- [ ] Version management script tested: `npm run version:patch`

### Asset Optimization
- [ ] Run asset optimization: `npm run optimize:assets`
- [ ] Verify app icon displays correctly (all densities)
- [ ] Verify splash screen displays correctly (all densities)
- [ ] Verify adaptive icon on different launchers
- [ ] Check total asset size (<5MB recommended)
- [ ] Convert large images to WebP format

### Build Testing
- [ ] Test local development build: `npx expo run:android`
- [ ] Test beta APK build: `npm run build:android:beta`
- [ ] Test production AAB build: `npm run build:android:production`
- [ ] Run comprehensive Android tests: `npm run test:android:full`
- [ ] Test on minimum API level (24 - Android 7.0)
- [ ] Test on latest API level (34 - Android 14)
- [ ] Test on low-end device (2GB RAM)

### ProGuard/R8 Validation
- [ ] Build with ProGuard enabled succeeds
- [ ] No missing class errors in logs
- [ ] Wallet creation works (crypto operations)
- [ ] Solana transaction signing works
- [ ] tRPC API calls work
- [ ] Sentry error reporting works
- [ ] Copy trading functionality works
- [ ] Token swapping works

### Build Size Analysis
- [ ] Run build size analysis: `npm run analyze:build-size`
- [ ] Universal APK size <50MB
- [ ] Split APK size <20MB per architecture
- [ ] AAB estimated download size <25MB
- [ ] JS bundle size <5MB
- [ ] Native libraries size <20MB
- [ ] Assets size <5MB
- [ ] Track size changes over time

### Version Management
- [ ] Bump version: `npm run version:patch` (or minor/major)
- [ ] Verify version updated in `app.json`
- [ ] Verify version updated in `package.json`
- [ ] Verify versionCode updated in `android/app/build.gradle`
- [ ] Git tag created: `v{version}`
- [ ] Git tag pushed to remote

### Multi-Device Testing
- [ ] Test on Samsung device (One UI)
- [ ] Test on Google Pixel (stock Android)
- [ ] Test on OnePlus/Xiaomi (custom ROM)
- [ ] Test on tablet (if supported)
- [ ] Test on Android 7.0 (API 24)
- [ ] Test on Android 10.0 (API 29)
- [ ] Test on Android 14.0 (API 34)

### Critical Flow Testing
- [ ] User signup and login
- [ ] Wallet creation (new seed phrase)
- [ ] Wallet import (existing seed phrase)
- [ ] Send SOL transaction
- [ ] Receive SOL transaction
- [ ] Token swap (Jupiter)
- [ ] Start copy trading
- [ ] Stop copy trading
- [ ] View portfolio
- [ ] Social features (post, like, comment)
- [ ] Push notifications
- [ ] Deep linking

### Performance Testing
- [ ] App startup time <3 seconds
- [ ] Screen navigation smooth (60fps)
- [ ] No memory leaks (test with LeakCanary)
- [ ] No ANR (Application Not Responding) errors
- [ ] Battery usage acceptable
- [ ] Network usage optimized

### Play Store Preparation
- [ ] App signing key configured in EAS
- [ ] Store listing created in Play Console
- [ ] App description written (short and full)
- [ ] Screenshots prepared (phone and tablet)
- [ ] Feature graphic created (1024x500)
- [ ] App icon uploaded (512x512)
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] Data safety section completed
- [ ] Target audience selected
- [ ] App category selected

### Production Build
- [ ] Run pre-build checks: `npm run prebuild`
- [ ] Build production AAB: `npm run build:android:production`
- [ ] Verify build succeeds on EAS
- [ ] Download AAB from EAS
- [ ] Verify AAB signature: `apksigner verify app.aab`
- [ ] Test AAB locally with bundletool

### Play Store Submission
- [ ] Upload AAB to Play Console (or use `npm run submit:android`)
- [ ] Create release (internal/closed/open testing)
- [ ] Add release notes
- [ ] Set rollout percentage (start with 10%)
- [ ] Submit for review
- [ ] Monitor crash reports in Play Console
- [ ] Monitor Sentry for errors

### Post-Deployment Monitoring
- [ ] Monitor crash-free rate (target: >99%)
- [ ] Monitor ANR rate (target: <0.5%)
- [ ] Monitor app startup time
- [ ] Monitor user reviews and ratings
- [ ] Monitor Sentry error rate
- [ ] Check for ProGuard-related crashes
- [ ] Verify all features working in production

### Rollback Plan
- [ ] Keep previous AAB version accessible
- [ ] Document rollback procedure
- [ ] Test rollback in internal testing track
- [ ] Prepare hotfix branch if needed

**Reference**: See `docs/ANDROID_BUILD_GUIDE.md` for detailed Android build documentation.

---

## 🐛 Known Issues to Fix

### High Priority TypeScript Errors
1. **copyTradingService.ts** - Multiple model reference errors
   - Fix Prisma model references (copyTradeSetting → copyTrading)
   - Fix Position model field mappings
   - Handle undefined/null values properly

2. **walletService.ts** - Buffer and encryption errors
   - Fix Buffer.from() with proper type checking
   - Update encryption key handling

### Medium Priority
- Remove unused imports and variables
- Fix type annotations for better type safety
- Update deprecated API calls

## 📦 Build & Deployment

### Mobile App (Android)
```bash
# Bump version
npm run version:patch  # or minor/major

# Optimize assets
npm run optimize:assets

# Test build
npm run test:android:full

# Build for production
npm run build:android:production

# Analyze build size
npm run analyze:build-size

# Submit to Play Store
npm run submit:android
```

### Mobile App (iOS)
```bash
# Build for iOS
npx eas build --platform ios --profile production
```

### Web Deployment
```bash
# Build web version
npm run build:web

# Deploy to Netlify
npm run deploy:production
```

### Backend Deployment
```bash
# Database migration
npm run db:migrate:deploy

# Start production server
npm run deploy:production
```

## 🎯 Performance Optimizations

### Bundle Size
- [ ] Run bundle analyzer: `npx expo export --platform web --output-dir dist --analyze`
- [ ] Remove unused dependencies
- [ ] Enable tree shaking
- [ ] Optimize images with WebP format

### Runtime Performance
- [ ] Enable React production mode
- [ ] Configure proper caching headers
- [ ] Enable compression (gzip/brotli)
- [ ] Set up CDN for static assets

## 🔍 Testing Requirements

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### Full Integration Test Suite
```bash
# Run full integration test suite with detailed report
npm run test:integration:full

# Run individual test suites
npm run test:auth
npm run test:wallet
npm run test:copy-trading
npm run test:market
npm run test:social
npm run test:swap
npm run test:transaction
npm run test:portfolio
npm run test:health
npm run test:errors

# Run with coverage
npm run test:coverage
```

### Test Results Template
- [ ] Auth tests: ___/___ passed (___% coverage)
- [ ] Wallet tests: ___/___ passed (___% coverage)
- [ ] Copy Trading tests: ___/___ passed (___% coverage)
- [ ] Market tests: ___/___ passed (___% coverage)
- [ ] Social tests: ___/___ passed (___% coverage)
- [ ] Swap tests: ___/___ passed (___% coverage)
- [ ] Transaction tests: ___/___ passed (___% coverage)
- [ ] Portfolio tests: ___/___ passed (___% coverage)
- [ ] Health Check tests: ___/___ passed (___% coverage)
- [ ] Error Handling tests: ___/___ passed (___% coverage)

**Overall**: ___/___ tests passed (___% pass rate)
**Coverage**: ___% lines, ___% branches, ___% functions

### Critical Issues Found
(Document any failures or issues discovered during testing)

### Test Report Location
`__tests__/reports/test-results-{timestamp}.json`

Reference `docs/TESTING.md` for detailed testing documentation.

### Manual Testing Checklist
- [ ] User registration and login flow
- [ ] Wallet creation and management
- [ ] Token swapping functionality
- [ ] Copy trading features
- [ ] Social features (posts, likes, comments)
- [ ] Push notifications
- [ ] Error handling and recovery

## 📊 Monitoring & Analytics

> See `scripts/sentry-setup-guide.md` for detailed Sentry configuration instructions.

### Sentry Configuration & Setup
- [ ] Create Sentry account and organization at sentry.io
- [ ] Create two Sentry projects: `soulwallet-mobile` and `soulwallet-backend`
- [ ] Generate Sentry auth token with `project:releases` and `org:read` scopes
- [ ] Set `EXPO_PUBLIC_SENTRY_DSN` in Railway environment variables (backend DSN)
- [ ] Add `SENTRY_AUTH_TOKEN` to EAS secrets: `eas secret:create --scope project --name SENTRY_AUTH_TOKEN`
- [ ] Update `eas.json` with Sentry organization and project configuration
- [ ] Set Sentry environment variables in Railway:
  - `SENTRY_ORG`
  - `SENTRY_PROJECT_BACKEND`
  - `SENTRY_TRACES_SAMPLE_RATE=0.1`
  - `SENTRY_PROFILES_SAMPLE_RATE=0.1`
- [ ] Run Sentry configuration test: `npm run sentry:test-config`
- [ ] Verify Sentry packages are installed: `@sentry/react-native`, `@sentry/node`

### Sentry Dashboard Configuration
- [ ] Configure alert rules for critical errors (auth failures, wallet operations)
- [ ] Set up performance monitoring thresholds (auth: 500ms, wallet: 1000ms, swap: 1500ms)
- [ ] Enable release tracking and link GitHub repository
- [ ] Configure notification channels (email, Slack, Discord)
- [ ] Set up error grouping rules
- [ ] Configure user feedback widget (optional)

### Source Maps & Error Tracking
- [ ] Verify source maps upload during EAS build
- [ ] Test error reporting in production mode
- [ ] Verify stack traces show original source code (not minified)
- [ ] Test user context attachment (user ID, username)
- [ ] Verify sensitive data is filtered (passwords, tokens, keys)

### Performance Monitoring Setup
- [ ] Verify Sentry performance monitoring is enabled (tracesSampleRate > 0)
- [ ] Test transaction tracking for critical endpoints:
  - [ ] Auth endpoints (signup, login, logout)
  - [ ] Wallet operations (create, import, send, receive)
  - [ ] Copy trading (start, stop, positions)
  - [ ] Swap operations (quote, execute)
- [ ] Monitor slow transactions (>2 seconds) in Sentry dashboard
- [ ] Set up custom performance metrics for business logic
- [ ] Enable profiling for CPU-intensive operations (profilesSampleRate > 0)

### Health Check Monitoring
- [ ] Run health check tests: `npm run health:test`
- [ ] Verify all health endpoints respond correctly:
  - [ ] `/health` - Overall system health
  - [ ] `/health/db` - Database connectivity
  - [ ] `/health/redis` - Redis connectivity
  - [ ] `/health/solana` - Solana RPC connectivity
  - [ ] `/health/ready` - Readiness probe
  - [ ] `/health/live` - Liveness probe
- [ ] Set up continuous health monitoring: `npm run health:monitor`
- [ ] Configure health check alerts in monitoring system
- [ ] Test health check endpoints from external monitoring service (UptimeRobot, Pingdom)

### Monitoring Verification
- [ ] Trigger test error in production and verify it appears in Sentry
- [ ] Check Sentry dashboard shows correct environment (production)
- [ ] Verify performance transactions are being recorded
- [ ] Test alert notifications (email, Slack, Discord)
- [ ] Monitor error rate for first 24 hours after deployment
- [ ] Review performance metrics and identify slow endpoints
- [ ] Set up weekly Sentry digest emails
- [ ] Document any Sentry issues in deployment notes

## 🚀 Deployment Steps

### 1. Pre-deployment
- [ ] Run full test suite
- [ ] Run `node scripts/validate-production-env.js`
- [ ] Check all environment variables
- [ ] Review security configurations
- [ ] Backup database

### 2. Deploy Backend
```bash
# Using Docker
docker-compose -f docker-compose.prod.yml up -d

# Using PM2
pm2 start pm2.config.js --env production

# Using Railway
railway up
```

### 3. Deploy Frontend
```bash
# Web deployment
npm run deploy:web

# Mobile deployment via EAS
eas submit --platform all
```

### 4. Post-deployment
- [ ] Verify all services are running
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Run `bash scripts/test-security-headers.sh <URL>`
- [ ] Verify Sentry is receiving events from production
- [ ] Check health monitoring is running and reporting correctly
- [ ] Review Sentry dashboard for any unexpected errors
- [ ] Monitor performance metrics for regressions
- [ ] Verify alert notifications are working

## 📝 Documentation

### API Documentation
- [ ] Update API endpoints documentation
- [ ] Document authentication flow
- [ ] Add example requests/responses

### User Documentation
- [ ] Create user guide
- [ ] Add FAQ section
- [ ] Document troubleshooting steps

## 🔒 Compliance & Legal

- [ ] Privacy Policy updated
- [ ] Terms of Service reviewed
- [ ] GDPR compliance checked
- [ ] Data retention policies configured
- [ ] SSL certificate installed and valid

## 📱 App Store Requirements

### iOS App Store
- [ ] App description and keywords
- [ ] Screenshots for all required sizes
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Age rating questionnaire

### Google Play Store
- [ ] App description (short and full)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots for phones and tablets
- [ ] Content rating questionnaire
- [ ] Data safety section completed

## ✨ Final Checks

- [ ] All critical bugs fixed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] User acceptance testing completed
- [ ] Rollback plan prepared
- [ ] Support team briefed

---

## Notes

### Critical Files to Review
1. `/src/services/copyTradingService.ts` - Has syntax errors that need fixing
2. `/src/services/walletService.ts` - Encryption implementation needs review
3. `.env.production.generated` - Ensure all values are production-ready
4. `eas.json` - Verify no exposed API keys (Helius key removed)
5. `pm2.config.js` - Review production configuration
6. `scripts/railway-env-setup.md` - Railway deployment guide

### Recommended Actions
1. Run `node scripts/generate-production-keys.js` to regenerate secrets
2. Run `node scripts/validate-production-env.js` before deployment
3. Run comprehensive TypeScript type check: `npm run type-check`
4. Fix all high-priority lint errors
5. Update all placeholder values in environment files
6. Test deployment in staging environment first
7. Test all health endpoints after Railway deployment
8. Verify CORS and CSRF in production environment

### Security Scripts
- `scripts/generate-production-keys.js` - Generate cryptographically secure secrets
- `scripts/validate-production-env.js` - Validate environment configuration
- `scripts/test-security-headers.sh` - Test security headers in production
- `scripts/railway-env-setup.md` - Railway environment setup guide

### Support Contacts
- Technical Issues: [Add contact]
- Security Issues: [Add contact]
- Business Queries: [Add contact]
