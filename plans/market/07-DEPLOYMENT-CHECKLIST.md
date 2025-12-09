# Market Tab Deployment Checklist

## Pre-Deployment Verification

### Frontend Checks

#### SoulMarket Tab
- [ ] Tokens load from DexScreener API
- [ ] Loading state shows skeleton
- [ ] Error state shows retry option
- [ ] Pull-to-refresh works
- [ ] Search filters tokens correctly
- [ ] Quick filters apply correctly
- [ ] Advanced filters apply correctly
- [ ] Token cards display all data
- [ ] Token cards navigate to detail page
- [ ] Virtualized list scrolls smoothly

#### External Platform Tabs
- [ ] WebView loads Raydium
- [ ] WebView loads Pump.fun
- [ ] WebView loads BullX
- [ ] WebView loads DexScreener
- [ ] Wallet injection works
- [ ] Transaction signing works
- [ ] Error handling for failed loads
- [ ] Loading indicator shows

#### Coin Detail Page
- [ ] Real data loads from API
- [ ] Price updates periodically
- [ ] Stats display correctly
- [ ] Sentiment section works
- [ ] Chart placeholder shows
- [ ] Trades tab shows data
- [ ] Holders tab shows data
- [ ] Buy button opens modal
- [ ] Sell button opens modal
- [ ] Trade modal executes swap
- [ ] Watchlist toggle works
- [ ] Links open correctly

#### Swap Screen
- [ ] Token selection works
- [ ] Quote fetches correctly
- [ ] Route options display
- [ ] Slippage settings work
- [ ] Swap executes successfully
- [ ] History shows past swaps
- [ ] Error handling works

### Backend Checks

#### Market Router
- [ ] `getToken` returns valid data
- [ ] `search` returns paginated results
- [ ] `trending` returns tokens
- [ ] `soulMarket` returns filtered tokens
- [ ] `getTokenDetails` returns full data
- [ ] All endpoints require auth
- [ ] Rate limiting works
- [ ] Caching works

#### Swap Router
- [ ] `getQuote` returns Jupiter quote
- [ ] `swap` executes transaction
- [ ] `getSupportedTokens` returns list
- [ ] `getSwapHistory` returns user swaps
- [ ] Feature flags respected

### Performance Checks
- [ ] Token list renders < 100ms
- [ ] Scroll maintains 60 FPS
- [ ] Memory usage < 100MB
- [ ] API responses < 500ms
- [ ] No memory leaks

### Security Checks
- [ ] All endpoints authenticated
- [ ] Input validation on all params
- [ ] No sensitive data in logs
- [ ] WebView URL whitelist enforced
- [ ] Transaction signing requires confirmation

### Accessibility Checks
- [ ] Screen reader labels present
- [ ] Touch targets >= 44px
- [ ] Color contrast meets WCAG
- [ ] Focus indicators visible
- [ ] Keyboard navigation works

## Test Coverage

### Unit Tests
- [ ] Market store filter logic
- [ ] Price formatting functions
- [ ] Number formatting functions
- [ ] Filter parsing functions

### Integration Tests
- [ ] Market router endpoints
- [ ] Swap router endpoints
- [ ] Token search flow
- [ ] Swap execution flow

### Property-Based Tests
- [ ] Filter combinations
- [ ] Price calculations
- [ ] Pagination logic

### E2E Tests
- [ ] Browse tokens flow
- [ ] Search and filter flow
- [ ] View token detail flow
- [ ] Execute swap flow

## Deployment Steps

### 1. Pre-Deployment
```bash
# Run all tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint

# Build check
npm run build
```

### 2. Database Migrations
```bash
# Check for pending migrations
npx prisma migrate status

# Apply migrations
npx prisma migrate deploy
```

### 3. Environment Variables
Verify these are set in production:
- `DEXSCREENER_API_KEY` (if required)
- `JUPITER_API_URL`
- `FEATURE_FLAG_SWAP_ENABLED`
- `FEATURE_FLAG_SIMULATION_MODE`

### 4. Deploy Backend
```bash
# Deploy to Railway/production
git push origin main
```

### 5. Deploy Frontend
```bash
# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform all
```

### 6. Post-Deployment Verification
- [ ] Health check endpoints respond
- [ ] Market data loads in production
- [ ] Swap functionality works
- [ ] No errors in Sentry
- [ ] Performance metrics acceptable

## Rollback Plan

### If Issues Detected
1. Revert to previous deployment
2. Check error logs
3. Identify root cause
4. Fix and re-deploy

### Rollback Commands
```bash
# Railway rollback
railway rollback

# EAS rollback (if needed)
# Revert to previous build in app stores
```

## Monitoring

### Metrics to Watch
- API response times
- Error rates
- User engagement
- Swap success rate
- WebView load times

### Alerts to Set
- Error rate > 1%
- Response time > 2s
- Swap failure rate > 5%
- Memory usage > 80%

## Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Developer | | | [ ] |
| QA | | | [ ] |
| Product | | | [ ] |
| DevOps | | | [ ] |
