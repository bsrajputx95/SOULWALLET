# WALLET POLISH MASTER PLAN (Combined Tracer AI + Antigravity Review)

> **Created by:** Tracer AI  
> **Reviewed & Enhanced by:** Antigravity  
> **Date:** 2026-01-08

---

## Executive Summary

Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then review all the changes together at the end.

---

## Observations

The wallet infrastructure is **production-grade** with comprehensive security (KMS, PBKDF2 310k, RPC failover, transaction simulation), real-time data flows (DexScreener prices, Jupiter swaps, portfolio snapshots), and seamless UX (auto-refresh hooks, optimistic updates). The 5% gaps identified are **non-blocking polish items**: E2E test coverage, iBuy FIFO sell logic, Metaplex metadata fallback, queue status banners, and Hermes optimization. Core wallet functionality (create/import/send/receive/swap/iBuy/portfolio/market) is **fully operational** with enterprise-level resilience (circuit breakers, DLQ, audit logs).

---

## 🚨 ANTIGRAVITY ADDITIONS - Critical Items Tracer AI Missed

### **Issue 1: Two Wallet Creation Code Paths (CRITICAL)**

**Problem:** There are TWO separate wallet creation implementations:
- `hooks/solana-wallet-store.ts` → `createWalletEncrypted()` - uses `Keypair.generate()` directly
- `hooks/wallet-creation-store.ts` → `WalletManager.createNewWallet()` - uses BIP39 properly

**Risk:** Users might get wallets WITHOUT mnemonic backup if the wrong path is used.

### **Issue 2: Web Platform PBKDF2 Lower Security**

**Problem:** Web uses 200k iterations vs 310k on native (line 33 in secure-storage.ts)

**Risk:** Web users have weaker encryption, potential brute-force vulnerability.

### **Issue 3: SPL Token Functions Disabled on Web**

**Problem:** Line 80-82 in `solana-wallet-store.ts` disables token functions on web.

**Risk:** Web users cannot see token balances or send tokens!

### **Issue 4: Token Refresh Race Condition**

**Problem:** In `executeSwap()` (line 741), only 1 second wait before `refreshBalances()` - blockchain may not have finalized.

---

## Approach

This plan addresses the **5% polish gaps** plus **Antigravity's critical additions** to achieve **100% wallet perfection** while **boosting speed/performance** across the stack. The strategy focuses on:

1. **Wallet code path unification** (NEW - security critical)
2. **E2E test coverage** for wallet flows
3. **iBuy FIFO sell logic** for accurate position tracking
4. **Metaplex metadata fetching** to eliminate "UNKNOWN" tokens
5. **Hermes/image optimization** for sub-second load times
6. **Batch RPC calls** to reduce latency
7. **Optimistic UI updates** for instant feedback
8. **Queue status banners** for transparency
9. **Web platform documentation** (NEW)

All changes maintain backward compatibility and leverage existing infrastructure (Redis cache, RPC manager, execution queue).

---

## 📋 UPDATED TIMELINE

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: E2E Wallet Test Coverage | 2 days | MEDIUM |
| **NEW Phase 1.5: Wallet Code Path Unification** | 1 day | **CRITICAL** |
| Phase 2: iBuy FIFO + Metaplex | 3.5 days | HIGH |
| **NEW Phase 2.5: Web Platform Documentation** | 1 day | LOW |
| Phase 3: Hermes + Optimization | 2.5 days | MEDIUM |
| Phase 4: Batch RPC + Queue Banners | 2 days | LOW |
| Phase 5: Final Review | 1 day | HIGH |
| **TOTAL** | ~13 days | |

---

## Implementation Plan

### **Phase 1: E2E Wallet Test Coverage (2 days)**

**Objective:** Add comprehensive end-to-end tests for wallet flows to prevent regressions and ensure seamless UX.

**Tasks:**
1. Create `__tests__/e2e/wallet-flows.test.ts` with Playwright/Detox tests covering:
   - **Create wallet flow**: Signup → Create encrypted wallet → Verify balance/tokens load
   - **Send SOL flow**: Navigate to send → Enter address/amount → Simulate → Confirm → Verify transaction recorded
   - **Swap flow**: Market → Token select → Swap screen → Jupiter quote → Execute → Verify balance update
   - **iBuy flow**: Sosio → Post with token → iBuy button → Swap → Verify bag shows token with P&L
   - **Portfolio flow**: Portfolio tab → Holdings/Copied/Watchlist tabs → Verify real data loads
2. Add `__tests__/e2e/wallet-edge-cases.test.ts` for error scenarios:
   - Insufficient balance for send/swap
   - RPC failure with automatic failover
   - Transaction timeout handling
   - Duplicate transaction prevention (idempotency)
3. Integrate E2E tests into CI/CD pipeline (`.github/workflows/ci.yml`):
   - Run E2E tests on PR merge to `main`
   - Fail build if any E2E test fails
   - Generate test report artifacts
4. Add E2E test documentation to `docs/TESTING.md`:
   - How to run E2E tests locally
   - How to debug failing tests
   - How to add new E2E tests

**Files:**
- `__tests__/e2e/wallet-flows.test.ts` (new)
- `__tests__/e2e/wallet-edge-cases.test.ts` (new)
- `.github/workflows/ci.yml` (update)
- `docs/TESTING.md` (update)
- `package.json` (add E2E test scripts)

**Verification:**
- All E2E tests pass locally and in CI
- Test coverage report shows >90% wallet flow coverage
- Documentation updated with E2E test instructions

---

### **NEW Phase 1.5: Wallet Code Path Unification (1 day) - CRITICAL**

**Objective:** Unify wallet creation to always use BIP39 with mnemonic backup - security critical.

**Tasks:**
1. Deprecate `solana-wallet-store.ts` `createWalletEncrypted()`:
   ```typescript
   // In hooks/solana-wallet-store.ts
   const createWalletEncrypted = async (password: string) => {
     console.warn('DEPRECATED: Use WalletManager.createNewWallet instead');
     const { WalletManager } = await import('./wallet-creation-store');
     const result = await WalletManager.createNewWallet(password);
     // Update state with result
     setState(prev => ({ 
       ...prev, 
       wallet: result.keypair, 
       publicKey: result.publicKey, 
       isLoading: false, 
       needsUnlock: false 
     }));
     await syncWalletAddressToBackend(result.publicKey);
     return result.keypair;
   };
   ```
2. Redirect all creation flows to `WalletManager.createNewWallet()`
3. Add migration prompt for existing non-BIP39 wallets (show backup reminder)
4. Add unit tests for wallet creation path
5. Update onboarding screens to use unified path

**Files:**
- `hooks/solana-wallet-store.ts` (update `createWalletEncrypted`)
- `hooks/wallet-creation-store.ts` (ensure single source of truth)
- `app/create-wallet.tsx` (verify uses WalletManager)
- `app/onboarding/CreateWallet.tsx` (verify uses WalletManager)
- `__tests__/unit/wallet-creation.test.ts` (new)

**Verification:**
- All wallet creations produce mnemonic backup
- Existing wallets continue to work
- Unit tests pass
- No code path bypasses BIP39

---

### **Phase 2: iBuy FIFO Sell Logic & Metaplex Metadata (3.5 days)**

**Objective:** Fix iBuy proportional sell to use true FIFO (oldest position first) and enhance token metadata fetching with Metaplex to eliminate "UNKNOWN" tokens.

#### **2.1: iBuy FIFO Sell Logic**
1. Update `components/TokenBagModal.tsx` `handleSell` function (lines 183-256):
   - Replace proportional sell logic with **true FIFO**: Sort `tokenPurchases` by `createdAt` ASC
   - For partial sells (10%/25%/50%), sell from **oldest position first** until target amount reached
   - For 100% sells, close all positions (existing logic is correct)
   - Update position amounts in database (add `amountRemaining` field to `IBuyPurchase` model)
2. Update `src/server/routers/social.ts` `sellIBuyToken` mutation (lines 1010-1096):
   - Add logic to handle **partial position sells**: Update `amountRemaining` instead of marking `SOLD`
   - Only mark position as `SOLD` when `amountRemaining === 0`
   - Calculate profit proportionally based on amount sold vs total position
3. Add `amountRemaining` field to `prisma/schema.prisma` `IBuyPurchase` model:
   ```prisma
   model IBuyPurchase {
     // ... existing fields
     amountRemaining Float @default(0) // Amount not yet sold (0 = fully sold)
   }
   ```
4. Create migration: `npm run db:migrate:dev -- --name add-ibuy-amount-remaining`
5. **NEW: Add backfill script** `scripts/backfill-ibuy-amount-remaining.ts`:
   ```typescript
   // Set amountRemaining = amount for all existing purchases with status HOLDING
   await prisma.iBuyPurchase.updateMany({
     where: { status: 'HOLDING' },
     data: { amountRemaining: prisma.raw('amount') }
   });
   ```
6. Add unit tests in `__tests__/unit/ibuy-fifo.test.ts`:
   - Test FIFO sell order (oldest first)
   - Test partial position sells
   - Test 100% sell closes all positions
   - Test profit calculation accuracy

#### **2.2: Metaplex Metadata Fetching**
1. Create `src/lib/services/metaplexMetadata.ts`:
   - Implement `fetchMetaplexMetadata(mint: string)` using `@metaplex-foundation/js` SDK
   - Fetch on-chain metadata (name, symbol, URI)
   - Fetch off-chain metadata from URI (logo, description)
   - Cache results in Redis with 24h TTL
   - Graceful fallback to "UNKNOWN" if fetch fails
2. Update `src/server/routers/wallet.ts` `getTokenMetadata` query (lines 544-610):
   - After checking `KNOWN_TOKENS` and Redis cache, call `fetchMetaplexMetadata` before returning "UNKNOWN"
   - Store fetched metadata in Redis cache
3. Add Metaplex SDK to `package.json`:
   ```bash
   npm install @metaplex-foundation/js
   ```
4. Add unit tests in `__tests__/unit/metaplex-metadata.test.ts`:
   - Test successful metadata fetch
   - Test cache hit/miss
   - Test fallback to "UNKNOWN" on error
   - Test off-chain URI fetch

**Files:**
- `components/TokenBagModal.tsx` (update `handleSell`)
- `src/server/routers/social.ts` (update `sellIBuyToken`)
- `prisma/schema.prisma` (add `amountRemaining` field)
- `scripts/backfill-ibuy-amount-remaining.ts` (new)
- `src/lib/services/metaplexMetadata.ts` (new)
- `src/server/routers/wallet.ts` (update `getTokenMetadata`)
- `package.json` (add Metaplex SDK)
- `__tests__/unit/ibuy-fifo.test.ts` (new)
- `__tests__/unit/metaplex-metadata.test.ts` (new)

**Verification:**
- iBuy sells follow FIFO order (oldest position first)
- Partial sells update `amountRemaining` correctly
- Existing positions backfilled with correct `amountRemaining`
- Token metadata shows real names/symbols instead of "UNKNOWN"
- All unit tests pass

---

### **NEW Phase 2.5: Web Platform Documentation (1 day)**

**Objective:** Clearly document web platform limitations for V1.

**Tasks:**
1. Create `docs/PLATFORM_SUPPORT.md`:
   - Document that SPL token functions are disabled on web
   - Explain PBKDF2 200k vs 310k difference
   - Recommend mobile app for full features
2. Add "Web Preview Mode" banner to web builds:
   - Show message: "For full wallet features, use the mobile app"
   - Disable send/swap buttons on web with tooltip explanation
3. Update `lib/secure-storage.ts`:
   ```typescript
   // Increase web iterations to 250k minimum
   const PBKDF2_ITERATIONS_WEB = 250000; // Up from 200000
   ```

**Files:**
- `docs/PLATFORM_SUPPORT.md` (new)
- `components/WebPreviewBanner.tsx` (new)
- `app/_layout.tsx` (add banner for web)
- `lib/secure-storage.ts` (increase web iterations)

**Verification:**
- Web users see clear limitation banner
- PBKDF2 web iterations increased to 250k
- Documentation complete

---

### **Phase 3: Hermes, Image Optimization & Optimistic UI (2.5 days)**

**Objective:** Enable Hermes engine (if not already), optimize images/bundles, and add optimistic UI updates for instant feedback.

#### **3.0: Pre-Check - Verify Hermes Status**
```bash
grep -r "jsEngine" app.json
```
If already "hermes", skip Hermes enablement steps.

#### **3.1: Hermes Engine (Skip if already enabled)**
1. Enable Hermes in `metro.config.js`:
   ```javascript
   config.transformer = {
     ...config.transformer,
     hermesParser: true,
   };
   ```
2. Update `app.json`:
   ```json
   {
     "expo": {
       "jsEngine": "hermes",
       "android": { "jsEngine": "hermes" },
       "ios": { "jsEngine": "hermes" }
     }
   }
   ```
3. Test Hermes build:
   ```bash
   npx expo run:android --variant release
   npx expo run:ios --configuration Release
   ```
4. Verify performance improvement (measure app startup time before/after)

#### **3.2: Image Optimization**
1. Add `expo-image` for optimized image loading:
   ```bash
   npx expo install expo-image
   ```
2. Replace `<Image>` with `<ExpoImage>` in key screens:
   - `app/(tabs)/portfolio.tsx` (token logos)
   - `app/(tabs)/market.tsx` (token logos)
   - `components/TokenCard.tsx` (token logos)
   - `components/TokenBagModal.tsx` (token logos)
3. Add image caching config in `app.json`:
   ```json
   {
     "expo": {
       "plugins": [
         ["expo-image", { "cachePolicy": "memory-disk" }]
       ]
     }
   }
   ```
4. Lazy-load images below fold using `contentVisibilityAuto` prop

#### **3.3: Optimistic UI Updates**
1. Update `hooks/wallet-store.ts` to add optimistic updates:
   - Add `optimisticBalance` state for instant balance updates after send/swap
   - Add `optimisticTokens` state for instant token list updates
   - Revert optimistic updates if backend call fails
2. Update `hooks/solana-wallet-store.ts` `sendSol` and `executeSwap`:
   - Update local balance immediately before transaction confirmation
   - Show "Pending..." status in UI
   - Revert if transaction fails
   - **NEW: Fix race condition** - wait for finalization before refresh:
     ```typescript
     await waitForFinalization(signature);
     await new Promise(resolve => setTimeout(resolve, 2000)); // 2s buffer
     await refreshBalances();
     ```
3. Update `components/TokenBagModal.tsx` `handleSell`:
   - Optimistically remove sold tokens from bag
   - Show "Selling..." status
   - Revert if sell fails
4. Add loading skeletons in:
   - `app/(tabs)/portfolio.tsx` (token list skeleton)
   - `app/(tabs)/market.tsx` (token list skeleton)
   - `app/swap.tsx` (quote skeleton)

**Files:**
- `metro.config.js` (enable Hermes - if needed)
- `app.json` (Hermes + image config)
- `package.json` (add `expo-image`)
- `app/(tabs)/portfolio.tsx` (ExpoImage + skeleton)
- `app/(tabs)/market.tsx` (ExpoImage + skeleton)
- `components/TokenCard.tsx` (ExpoImage)
- `components/TokenBagModal.tsx` (ExpoImage + optimistic)
- `app/swap.tsx` (skeleton)
- `hooks/wallet-store.ts` (optimistic updates)
- `hooks/solana-wallet-store.ts` (optimistic updates + race condition fix)

**Verification:**
- Hermes build succeeds on Android/iOS (if enabled)
- App startup time reduced by >30%
- Images load instantly from cache
- UI updates immediately on user actions (before backend confirmation)
- No race conditions in balance refresh

---

### **Phase 4: Batch RPC Calls, Skeletons & Queue Banners (2 days)**

**Objective:** Reduce RPC latency with batch calls, add loading skeletons, and display queue status banners for transparency.

#### **4.1: Batch RPC Calls**
1. Update `src/lib/services/rpcManager.ts` to add `batchCall` method:
   ```typescript
   async batchCall<T>(calls: Array<(connection: Connection) => Promise<T>>): Promise<T[]> {
     const connection = await this.getConnection();
     return Promise.all(calls.map(call => call(connection)));
   }
   ```
2. Update `src/server/routers/wallet.ts` `getTokens` query (lines 184-228):
   - Batch `getBalance` + `getParsedTokenAccountsByOwner` into single RPC call
   - Reduce latency from ~500ms to ~200ms
3. Update `hooks/wallet-store.ts` to batch portfolio queries:
   - Combine `getOverview` + `getPNL` + `getAssetBreakdown` into single tRPC batch call
   - Use tRPC's built-in batching: `trpc.useQueries([...])`

#### **4.2: Loading Skeletons**
1. Create `components/Skeleton.tsx` reusable skeleton component:
   - Animated shimmer effect
   - Configurable width/height/borderRadius
2. Add skeletons to:
   - `app/(tabs)/portfolio.tsx` (token list, wallet cards)
   - `app/(tabs)/market.tsx` (token list)
   - `app/swap.tsx` (quote card)
3. Show skeletons during initial load (not on refetch)

#### **4.3: Queue Status Banners**
1. Update `src/lib/services/executionQueue.ts` to expose queue stats:
   - Add `getActiveJobsCount()` method
   - Add `getQueueHealth()` method (returns "healthy" | "degraded" | "down")
2. Create `src/server/routers/queue.ts` tRPC router:
   ```typescript
   export const queueRouter = router({
     getStatus: protectedProcedure.query(async () => {
       const stats = await executionQueue.getQueueStats();
       return {
         activeJobs: stats.buy.active + stats.sell.active,
         health: stats.buy.failed > 10 ? 'degraded' : 'healthy',
       };
     }),
   });
   ```
3. Add queue status banner to `hooks/wallet-store.ts`:
   - Query `queue.getStatus` every 30s
   - Show banner if `activeJobs > 50` or `health === 'degraded'`
4. Create `components/QueueStatusBanner.tsx`:
   - Display "High load - transactions may take longer" if queue is busy
   - Display "Service degraded - some features may be slow" if health is degraded
   - Add retry button for failed transactions
5. Add banner to:
   - `app/(tabs)/portfolio.tsx` (top of screen)
   - `app/swap.tsx` (above swap button)

**Files:**
- `src/lib/services/rpcManager.ts` (add `batchCall`)
- `src/server/routers/wallet.ts` (batch RPC calls)
- `hooks/wallet-store.ts` (batch tRPC queries)
- `components/Skeleton.tsx` (new)
- `app/(tabs)/portfolio.tsx` (skeletons + banner)
- `app/(tabs)/market.tsx` (skeletons)
- `app/swap.tsx` (skeleton + banner)
- `src/lib/services/executionQueue.ts` (expose stats)
- `src/server/routers/queue.ts` (new)
- `components/QueueStatusBanner.tsx` (new)

**Verification:**
- RPC calls batched (verify in network logs)
- Skeletons show during initial load
- Queue status banner appears when queue is busy
- All features remain functional

---

### **Phase 5: Final Review, Load Testing & Documentation (1 day)**

**Objective:** Verify all wallet polish changes, run load tests, and update documentation.

**Tasks:**
1. **E2E Test Suite**: Run full E2E test suite and verify all tests pass
2. **Load Testing**: Run k6 load tests (`tests/load/wallet-flows.js`) with 10K concurrent users:
   - Verify P95 latency < 200ms for wallet operations
   - Verify error rate < 0.1%
   - Verify queue handles load without degradation
3. **Lighthouse Audit**: Run Lighthouse on mobile app (Expo web build):
   - Verify Performance score > 90
   - Verify Accessibility score > 95
4. **Documentation Updates**:
   - Update `docs/WALLET.md` with new features (FIFO sell, Metaplex metadata, optimistic UI)
   - Update `README.md` with performance improvements (Hermes, batch RPC, skeletons)
   - Add troubleshooting guide for common wallet issues
   - **NEW: Add `docs/PLATFORM_SUPPORT.md`** (web limitations)
5. **Code Review**: Review all changes for:
   - Security vulnerabilities (no private key exposure)
   - Performance regressions (no N+1 queries)
   - UX consistency (loading states, error messages)
   - **NEW: Wallet creation path unification verified**
6. **Rollback Plan**: Document rollback procedure in case of issues:
   - Revert Hermes if app crashes
   - Revert optimistic updates if causing data inconsistencies
   - Revert batch RPC if causing timeouts

**Files:**
- `tests/load/wallet-flows.js` (new k6 script)
- `docs/WALLET.md` (update)
- `docs/PLATFORM_SUPPORT.md` (new)
- `README.md` (update)
- `docs/TROUBLESHOOTING.md` (new)

**Verification:**
- All E2E tests pass
- Load tests pass with <200ms P95 latency
- Lighthouse score > 90
- Documentation complete and accurate
- No security vulnerabilities in wallet creation

---

## 🎯 PRIORITY ORDER

If time is limited, implement in this order:

1. **CRITICAL**: Phase 1.5 (Wallet Unification) - Security
2. **HIGH**: Phase 2 (iBuy FIFO + Metaplex) - Core feature fix
3. **MEDIUM**: Phase 3 (Hermes/Optimization) - Performance
4. **MEDIUM**: Phase 1 (E2E Tests) - Regression prevention
5. **LOW**: Phase 4 (Batch RPC + Banners) - Polish
6. **LOW**: Phase 2.5 (Web Documentation) - Clarity

---

## Summary

This plan delivers **100% wallet perfection** by addressing:

**Original 5% gaps (Tracer AI):**
- E2E tests
- iBuy FIFO
- Metaplex metadata
- Hermes
- Batch RPC
- Optimistic UI
- Queue banners

**Additional critical items (Antigravity):**
- Wallet code path unification (security)
- Web platform PBKDF2 increase (security)
- Web platform documentation (clarity)
- Token refresh race condition fix (reliability)
- iBuy migration backfill (data integrity)

All changes are **backward compatible**, leverage **existing infrastructure** (Redis, RPC manager, execution queue), and maintain **enterprise-level security** (no private key exposure, audit logs, circuit breakers). The wallet will be **production-ready** with **sub-second load times**, **instant UI feedback**, and **comprehensive test coverage** to prevent regressions.