# Deployment Checklist - Home Screen Production Readiness

## Overview
Final checklist to ensure the home screen is production-ready and industry-standard.

---

## 1. 🔴 BLOCKERS - Must Fix Before Deployment

### 1.1 Copy Trading Wallet Integration
- [ ] **Replace stub wallet in executionQueue.ts**
  - Current: `const userWallet = Keypair.generate();` (random wallet)
  - Required: Real user wallet keypair for signing
  - Files: `src/lib/services/executionQueue.ts` lines 85-86, 140-141
  - Effort: 8 hours

- [ ] **Replace stub wallet in profitSharing.ts**
  - Current: `const userWallet = Keypair.generate();` (random wallet)
  - Required: Real user wallet for fee transfers
  - File: `src/lib/services/profitSharing.ts` line 85
  - Effort: 4 hours

- [ ] **Implement wallet signing solution**
  - Option A: Custodial wallets (recommended for MVP)
  - Option B: Smart contract delegation
  - Option C: Pre-signed transactions
  - Effort: 16-40 hours depending on approach

### 1.2 Critical Frontend Fixes
- [x] **Add validateCopyTradeForm function** ✅ DONE
  - File: `app/(tabs)/index.tsx`
  - Status: Implemented at line ~2092

- [x] **Add validateSolanaAddress function** ✅ DONE
  - File: `app/(tabs)/index.tsx`
  - Status: Implemented at line ~2082

### 1.3 Data Integrity
- [ ] **Add transaction verification in profit sharing**
  - Verify on-chain success before recording fee
  - File: `src/lib/services/profitSharing.ts`
  - Effort: 2 hours

- [ ] **Add position locking for SL/TP**
  - Prevent duplicate sell orders
  - File: `src/lib/services/priceMonitor.ts`
  - Effort: 2 hours

---

## 2. 🟠 HIGH PRIORITY - Should Fix Before Launch

### 2.1 Frontend
- [ ] Real swap quotes in home modal (not mock rates)
- [ ] Query invalidation after copy trade mutations
- [ ] Error states for failed API calls
- [ ] Loading state improvements
- [ ] Remove demo wallet fallback

### 2.2 Backend
- [ ] Auto-create trader profile when copying new wallet
- [ ] Balance check before starting copy trade
- [ ] Fallback for empty featured traders list
- [ ] Better SOL price fallback handling
- [ ] Birdeye API rate limiting

### 2.3 Copy Trading
- [ ] Fix duplicate sell orders (exit with trader)
- [ ] Use user's slippage setting in execution
- [ ] Add balance check before buy orders
- [ ] Handle partial trader sells

### 2.4 Security
- [ ] Token refresh implementation
- [ ] Request rate limiting on all mutations
- [ ] Transaction amount limits

---

## 3. 🟡 MEDIUM PRIORITY - Fix Soon After Launch

### 3.1 Features
- [ ] SPL tokens in total balance
- [ ] Price alerts for tokens
- [ ] Watchlist/favorites
- [ ] Trader comparison
- [ ] Trailing stop loss

### 3.2 Performance
- [ ] Batch Birdeye API calls
- [ ] Virtual list for large data sets
- [ ] Request deduplication
- [ ] Optimistic updates

### 3.3 UX
- [ ] Offline support
- [ ] Real-time WebSocket updates
- [ ] Better loading skeletons
- [ ] Accessibility improvements

---

## 4. Environment Configuration

### 4.1 Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=your_helius_key
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
HELIUS_WS_URL=wss://mainnet.helius-rpc.com/?api-key=...

# External APIs
BIRDEYE_API_KEY=your_birdeye_key

# Redis (for Bull queues)
REDIS_URL=redis://...

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Feature Flags
SEND_ENABLED=true
SIMULATION_MODE=true

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

### 4.2 Verify All Variables Set
```bash
# Run validation script
npm run validate:env
```

---

## 5. Database Migrations

### 5.1 Pending Schema Changes
- [ ] Add `slTpTriggeredAt` to Position model
- [ ] Add `PositionStatus` enum
- [ ] Add foreign keys to ExecutionQueue
- [ ] Add AuditLog model (optional)

### 5.2 Run Migrations
```bash
npx prisma migrate deploy
```

### 5.3 Seed Data
```bash
# Seed featured traders
npx prisma db seed
```

---

## 6. Service Dependencies

### 6.1 Required Services
- [ ] PostgreSQL database running
- [ ] Redis server running (for Bull queues)
- [ ] Helius WebSocket accessible
- [ ] Birdeye API accessible
- [ ] DexScreener API accessible
- [ ] Jupiter API accessible

### 6.2 Health Checks
```bash
# Test database connection
npm run test:db

# Test Redis connection
npm run test:redis

# Test external APIs
npm run test:apis
```

---

## 7. Monitoring Setup

### 7.1 Sentry
- [ ] Sentry project created
- [ ] DSN configured
- [ ] Source maps uploaded
- [ ] Error alerts configured

### 7.2 Logging
- [ ] Log aggregation set up
- [ ] Log levels configured
- [ ] Sensitive data redacted

### 7.3 Metrics
- [ ] API response times tracked
- [ ] Error rates monitored
- [ ] Copy trade success rate tracked
- [ ] Fee collection tracked

### 7.4 Alerts
- [ ] High error rate alert
- [ ] API latency alert
- [ ] Copy trade failure alert
- [ ] Low balance alert (for custodial wallets)

---

## 8. Testing

### 8.1 Unit Tests
```bash
npm run test:unit
```
- [ ] All tests passing
- [ ] Coverage > 70%

### 8.2 Integration Tests
```bash
npm run test:integration
```
- [ ] API endpoints tested
- [ ] Database operations tested
- [ ] External API mocks working

### 8.3 E2E Tests
```bash
npm run test:e2e
```
- [ ] Login flow works
- [ ] Balance displays correctly
- [ ] Copy trade flow works
- [ ] Send/receive works

### 8.4 Manual Testing
- [ ] Test on iOS device
- [ ] Test on Android device
- [ ] Test on web browser
- [ ] Test with slow network
- [ ] Test with no network

---

## 9. Security Checklist

### 9.1 Authentication
- [ ] JWT tokens expire appropriately
- [ ] Refresh tokens implemented
- [ ] Session invalidation works
- [ ] Rate limiting on auth endpoints

### 9.2 Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] HTTPS enforced
- [ ] No PII in logs
- [ ] Wallet keys securely stored

### 9.3 Input Validation
- [ ] All inputs validated with Zod
- [ ] SQL injection prevented (Prisma)
- [ ] XSS prevented (React)
- [ ] CSRF protection enabled

### 9.4 API Security
- [ ] Rate limiting on all endpoints
- [ ] Request size limits
- [ ] Timeout configuration
- [ ] Error messages don't leak info

---

## 10. Performance Checklist

### 10.1 Frontend
- [ ] Bundle size < 2MB
- [ ] Initial load < 3 seconds
- [ ] Time to interactive < 5 seconds
- [ ] No memory leaks

### 10.2 Backend
- [ ] API response time < 500ms (p95)
- [ ] Database queries optimized
- [ ] Proper indexing in place
- [ ] Connection pooling configured

### 10.3 Caching
- [ ] API responses cached appropriately
- [ ] Database query caching
- [ ] Static assets cached

---

## 11. Rollback Plan

### 11.1 Database Rollback
```bash
# Revert last migration
npx prisma migrate resolve --rolled-back <migration_name>
```

### 11.2 Code Rollback
```bash
# Revert to previous version
git revert HEAD
git push origin main
```

### 11.3 Feature Flags
```bash
# Disable copy trading
COPY_TRADING_ENABLED=false

# Disable send
SEND_ENABLED=false
```

---

## 12. Launch Sequence

### Phase 1: Soft Launch (Day 1)
1. Deploy to staging
2. Run full test suite
3. Manual QA testing
4. Fix any critical issues
5. Deploy to production (limited users)

### Phase 2: Beta (Days 2-7)
1. Monitor error rates
2. Monitor performance
3. Gather user feedback
4. Fix reported issues
5. Gradually increase user access

### Phase 3: General Availability (Day 8+)
1. Open to all users
2. Marketing push
3. Monitor scaling
4. Continue improvements

---

## 13. Post-Launch Monitoring

### First 24 Hours
- [ ] Error rate < 1%
- [ ] API latency normal
- [ ] No critical bugs reported
- [ ] Copy trades executing successfully
- [ ] Fees being collected

### First Week
- [ ] User retention metrics
- [ ] Feature usage analytics
- [ ] Performance trends
- [ ] User feedback analysis

---

## 14. Summary

### Total Effort Estimates

| Category | Effort |
|----------|--------|
| Blockers | ~30 hours |
| High Priority | ~40 hours |
| Medium Priority | ~50 hours |
| **Total** | **~120 hours** |

### Recommended Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| Week 1 | 5 days | Fix all blockers |
| Week 2 | 5 days | High priority items |
| Week 3 | 3 days | Testing & QA |
| Week 4 | 2 days | Soft launch & monitoring |

### Critical Path
1. Wallet signing solution (BLOCKER)
2. Transaction verification (BLOCKER)
3. Frontend validation (BLOCKER)
4. Error handling (HIGH)
5. Testing (HIGH)
6. Deployment (HIGH)

---

## 15. Sign-Off

### Technical Review
- [ ] Code review completed
- [ ] Architecture review completed
- [ ] Security review completed

### Business Review
- [ ] Feature requirements met
- [ ] UX approved
- [ ] Legal/compliance approved

### Final Approval
- [ ] QA sign-off
- [ ] Engineering sign-off
- [ ] Product sign-off
- [ ] Ready for launch ✅
