# SoulWallet — Final Sprint Audit Report

> **Purpose**: This document is a complete audit of the SoulWallet codebase. Each item lists the **problem**, its **location**, the **solution**, and **how to implement** it. Other agents should use this as a task list.

---

## 1. AUTH — Login & Signup

### 1.1 MISSING: User Policy Checkbox (Signup)
- **Problem**: No user policy / terms of service checkbox exists on signup. Required per ffr.md.
- **Location**: `app/(auth)/signup.tsx` — between confirm password and signup button (line ~247)
- **Solution**: Add a simple checkbox with text "I agree to the Terms of Service and Privacy Policy". Block signup if unchecked.
- **Implementation**: Add a `const [policyAccepted, setPolicyAccepted] = useState(false)` state. Render a `TouchableOpacity` with a checkbox icon (checked/unchecked) and text. In `handleSignup()`, add validation: `if (!policyAccepted) { setErrorMessage('You must accept the policy'); return; }`. Keep it minimal — no modal, no link to a doc, just a checkbox and label text.

### 1.2 MISSING: User Policy Checkbox (Login)
- **Problem**: No policy checkbox on login page. Per ffr.md it should be on both login and signup.
- **Location**: `app/(auth)/login.tsx` — before the Login button (line ~190)
- **Solution**: Same as signup — add checkbox. Only blocks login if unchecked.
- **Implementation**: Same pattern as 1.1. Add state + checkbox + validation.

### 1.3 BLOAT: Social Login Buttons (Google/Apple)
- **Problem**: Google and Apple social login buttons exist but are completely non-functional — they just show a "Coming Soon" alert. This is bloat and confuses users.
- **Location**: `app/(auth)/login.tsx` (lines 200-216), `app/(auth)/signup.tsx` (lines 257-273)
- **Solution**: Remove the social login buttons and the `NeonDivider` "OR CONTINUE WITH" from both screens. Remove `handleSocialPress` function and `SocialButton` import.
- **Implementation**: Delete the `NeonDivider`, `socialButtonsContainer` View, `SocialButton` components, and the `handleSocialPress` function from both files. Remove unused imports (`SocialButton`, `NeonDivider` if not used elsewhere).

### 1.4 BLOAT: Forgot Password is Mocked
- **Problem**: `app/(auth)/forgot-password.tsx` is entirely mocked — OTP verification accepts any 6-digit code, password reset does nothing. It's dead code.
- **Location**: `app/(auth)/forgot-password.tsx`
- **Solution**: Replace the mock with a simple "Coming Soon" screen OR connect to a real backend endpoint. Per ffr.md "no pass reset its coming soon" — so change this to a simple message: "Password reset is coming soon."
- **Implementation**: Replace the entire multi-step form with a single screen that says "Password reset coming soon" with a back button. This removes ~350 lines of dead code.

---

## 2. HOME PAGE

### 2.1 BLOAT: Dummy Wallet Fallback Data
- **Problem**: `DUMMY_WALLET` constant (lines 38-45 in `app/(tabs)/index.tsx`) with fake balances is never used in meaningful code paths but adds visual noise.
- **Location**: `app/(tabs)/index.tsx` lines 38-45
- **Solution**: Remove `DUMMY_WALLET` constant entirely.
- **Implementation**: Delete the constant. Search for any reference to `DUMMY_WALLET` in the file — there should be none in actual render paths.

### 2.2 BLOAT: Suppressed Unused Variables
- **Problem**: Multiple `void` statements to suppress unused variable warnings (lines 117-119): `void showCreateWalletModal; void setShowCreateWalletModal; void isCreatingWallet; void hasWallet; void isLoadingWallet;`. These are dead state variables.
- **Location**: `app/(tabs)/index.tsx` lines 84-86, 117-119
- **Solution**: If these states aren't driving any UI, remove them entirely. If wallet creation modal is needed, it should be wired up properly.
- **Implementation**: Remove `showCreateWalletModal`, `setShowCreateWalletModal`, `isCreatingWallet` states and the void suppressions. The wallet creation flow exists in `solana-setup.tsx` — no need for duplicate state here.

### 2.3 PERFORMANCE: Double Data Fetch on Focus
- **Problem**: `loadWalletData()` is called in both `useEffect` and `useFocusEffect`, causing double-fetch on initial mount.
- **Location**: `app/(tabs)/index.tsx` lines 169-178
- **Solution**: Remove the initial `useEffect` call — `useFocusEffect` already fires on mount.
- **Implementation**: Remove the `useEffect(() => { loadWalletData(); }, [loadWalletData]);` block (lines 169-171). Keep only the `useFocusEffect`.

### 2.4 PERFORMANCE: loadWalletData has walletAddress in dependency
- **Problem**: `loadWalletData` depends on `walletAddress` via `useCallback`, but it also *sets* `walletAddress` internally. This can cause an extra re-render loop.
- **Location**: `app/(tabs)/index.tsx` line 167
- **Solution**: Remove `walletAddress` from the `useCallback` dependency array since the function doesn't need the stale closure value.
- **Implementation**: Change `}, [walletAddress]);` to `}, []);` on the `useCallback`.

### 2.5 LOG NOISE: Excessive console.log in production
- **Problem**: Many `console.log` statements guarded by `__DEV__` — good. But some are not guarded (e.g., in services). Causes log noise in production builds.
- **Location**: Multiple files — `services/swap.ts` (lines 69, 96, 109, 117, 157, 174, etc.), `services/copyTrading.ts`, `services/ibuy.ts`
- **Solution**: Wrap all console.log/warn/error in `__DEV__` checks OR use `babel-plugin-transform-remove-console` (already in devDependencies) properly in babel config for production builds.
- **Implementation**: Check `babel.config.js` — ensure `transform-remove-console` plugin is active for production builds. This is the cleanest approach. Alternatively, wrap remaining logs in `if (__DEV__)`.

---

## 3. COPY TRADING (Flagship Feature) — ARCHITECTURE REWRITE

### 3.0 CRITICAL: Switch to Custodial Trading Wallet (Like Trojan Bot)
- **Problem**: Current copy trading is non-custodial — user must have the app open for trades to execute because the private key is on-device. The client polls a queue, signs transactions locally, then broadcasts. This means if the user closes the app, trades are missed. Real copy trading (Trojan, BonkBot, Maestro) uses custodial wallets where the backend holds the key and executes instantly.
- **Location**: Entire copy trading flow — `services/copyTrading.ts`, `services/backgroundTasks.ts`, `components/CopyTradeExecutionModal.tsx`, `components/CopyTradingModal.tsx`, `soulwallet-backend/src/services/copyEngine.ts`
- **Solution**: Create a dedicated custodial "Trading Wallet" per user on the backend. Backend holds the private key and executes trades instantly when Helius webhook fires. User's main wallet stays non-custodial.
- **Implementation**:

**STEP 1: Prisma Schema — Add TradingWallet Model**
- Location: `soulwallet-backend/prisma/schema.prisma`
- Add model:
  ```
  model TradingWallet {
    id                 String   @id @default(cuid())
    userId             String   @unique
    publicKey          String   @unique
    encryptedPrivateKey String  // encrypted with server-side TRADING_WALLET_SECRET env var
    createdAt          DateTime @default(now())
    user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  }
  ```
- Add `tradingWallet TradingWallet?` relation to User model
- Run `npx prisma migrate dev`

**STEP 2: Backend — Trading Wallet Endpoints**
- Location: `soulwallet-backend/src/server.ts` (or new `routes/copyTrade.ts` if splitting)
- Add env var: `TRADING_WALLET_SECRET` — used to encrypt/decrypt trading wallet private keys in DB
- `POST /copy-trade/wallet/create` (auth required):
  1. Check if user already has a trading wallet → return existing if so
  2. Generate new `Keypair` server-side
  3. Encrypt `secretKey` using `TRADING_WALLET_SECRET` (AES-256 or simple crypto for beta)
  4. Store in `TradingWallet` table
  5. Return `{ publicKey }` to client
- `GET /copy-trade/wallet` (auth required):
  1. Get user's trading wallet
  2. Fetch SOL balance via RPC
  3. Return `{ publicKey, balance }`
- `POST /copy-trade/wallet/withdraw` (auth required):
  1. Get user's trading wallet + main wallet public key
  2. Decrypt private key from DB
  3. Create SOL transfer from trading wallet → main wallet
  4. Sign with trading wallet keypair
  5. Broadcast and return signature

**STEP 3: Backend — Modify Copy Engine for Server-Side Execution**
- Location: `soulwallet-backend/src/services/copyEngine.ts`
- Currently `queueCopyTrade()` creates a queue item and waits for the client to execute.
- Change: When Helius webhook fires and `queueCopyTrade()` is called, instead of creating a queue item:
  1. Get user's trading wallet from DB
  2. Decrypt private key
  3. Get Jupiter swap quote (same logic as current client-side `getQuote`)
  4. Get swap transaction from Jupiter Ultra API
  5. Sign with trading wallet keypair
  6. Broadcast transaction
  7. Create SL/TP limit orders server-side (sign + broadcast)
  8. Record position in DB
  9. All of this happens instantly — no queue, no client involvement
- Profit share (5% to trader): When position closes in profit (> $10-20 threshold), calculate 5%, create SOL transfer to trader's public address, sign with trading wallet key, broadcast. Add SPL Memo "Thank you from soulwallet" if feasible.

**STEP 4: Frontend — Update Copy Trading UI**
- Location: `services/copyTrading.ts`, `components/CopyTradingModal.tsx`, `components/CopyTradeExecutionModal.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/portfolio.tsx`
- Remove all client-side signing logic: `executeCopyTrade()`, `executeCopyTradeSell()`, `closeCopyPosition()`, `submitCancelTransactions()`, `signAndSubmitLimitOrder()`
- Remove `services/backgroundTasks.ts` (no longer needed — backend executes instantly)
- Remove `CopyTradeExecutionModal` (no PIN prompt needed)
- Remove `QueueStatusBanner` (no queue for user to act on)
- Update `CopyTradingModal` setup flow:
  1. On first setup, call `POST /copy-trade/wallet/create` to get trading wallet
  2. Show trading wallet address + "Deposit SOL" instruction
  3. Show current trading wallet balance
  4. User enters: trader address, total amount, per-trade amount, SL/TP, exit-with-trader
  5. Save config (existing `POST /copy-trade/config`) — backend handles everything from here
- Update Portfolio:
  1. Add "Trading Wallet" section showing balance
  2. Add "Deposit" button (sends SOL from main wallet to trading wallet — uses existing `sendTransaction`)
  3. Add "Withdraw" button (calls `POST /copy-trade/wallet/withdraw`)
  4. Positions are read-only — fetched from `GET /copy-trade/positions`
- Keep: `fetchCopyConfig`, `fetchCopyPositions`, `createCopyConfig`, `stopCopyTrading` (these are API calls, still needed)
- Remove unused `authToken` parameter from all remaining functions

**STEP 5: Cleanup Dead Code**
- Delete or gut: `services/backgroundTasks.ts` — no longer needed
- Delete: `components/CopyTradeExecutionModal.tsx` — no client-side execution
- Delete: `components/QueueStatusBanner.tsx` — no queue for users
- Remove from `services/copyTrading.ts`: `executeCopyTrade`, `executeCopyTradeSell`, `closeCopyPosition`, `submitCancelTransactions`, `signAndSubmitLimitOrder`, `createJupiterLimitOrder`
- Remove Jupiter Limit Order API helpers from client — all server-side now
- Remove copy trade queue polling from home page

**KEY DESIGN DECISIONS:**
- One trading wallet per user, created once, stays forever
- When user deletes copy config → only config deleted, wallet + funds stay
- User can withdraw funds from trading wallet anytime
- User can deposit more SOL anytime
- Main wallet stays non-custodial (keys on device)
- Trading wallet is custodial (keys on backend) — only for copy trading
- Encrypt trading wallet private key with server env var, NOT user PIN
- No complex key management — it's beta

---

## 4. SOSIO (Social Feed — King Feature)

### 4.1 MISSING: Feed Algorithm / Recommendation
- **Problem**: Feed is purely chronological (`orderBy: createdAt desc`). No recommendation algorithm, no hashtag-based boosting, no engagement scoring.
- **Location**: `soulwallet-backend/src/services/feedService.ts`
- **Solution**: Implement a weighted scoring algorithm:
  - Recency score (exponential decay)
  - Engagement score (likes + comments * 2)
  - Follow affinity (posts from people you follow rank higher)
  - Hashtag relevance (if user interacts with certain hashtags)
  - Global accounts (`@soulwallet`, `@bhavanisingh`) always boosted to top
- **Implementation**:
  1. Backend: In `feedService.ts`, after fetching posts, compute a score for each:
     ```
     score = (likesCount * 1) + (commentsCount * 2) + (isFollowing ? 10 : 0) + (isGlobalUser ? 50 : 0) + recencyBonus
     ```
     recencyBonus = max(0, 24 - hoursAgo) where hoursAgo = (now - createdAt) / 3600000
  2. Sort posts by score descending.
  3. Global users (`soulwallet`, `bhavanisingh`) — fetch their posts separately and inject at positions 0, 3, 7 etc (spread through feed).
  4. Add hashtag extraction on post creation (already done in `social.ts` `extractHashtags`) — store in DB and use for relevance.

### 4.2 MISSING: Hashtag Support in Feed
- **Problem**: Hashtags are extracted client-side (`social.ts` line 60-65) and sent to backend, but the feed doesn't use them for filtering or recommendation.
- **Location**: `services/social.ts` (extraction), `soulwallet-backend/src/services/feedService.ts` (feed)
- **Solution**: Backend should index hashtags and allow feed filtering by hashtag. Frontend should make hashtags tappable in posts.
- **Implementation**:
  1. Backend: Add query param `hashtag` to feed endpoint. Filter posts where `hashtags` array contains the requested hashtag.
  2. Frontend: In `SocialPost` component, parse `#hashtags` in content and render as tappable links that filter the feed.

### 4.3 PERFORMANCE: Dynamic Import in Component
- **Problem**: `sosio.tsx` does dynamic imports inside `fetchUserProfile` callback: `const SecureStore = await import('expo-secure-store');` and `const { api } = await import('@/services/api');`. This is unnecessary and slow — these modules are already statically imported elsewhere.
- **Location**: `app/(tabs)/sosio.tsx` lines 48-52
- **Solution**: Use static imports at top of file.
- **Implementation**: Add `import * as SecureStore from 'expo-secure-store';` and `import { api } from '@/services/api';` at the top. Replace the dynamic imports with direct usage.

### 4.4 BLOAT: Unused Variables
- **Problem**: `profileQuery` is defined (line 65) and immediately voided (line 68). Dead code.
- **Location**: `app/(tabs)/sosio.tsx` lines 65-68
- **Solution**: Remove `profileQuery` and the `void profileQuery` line.

### 4.5 BLOAT: `userSearchQuery` Mock
- **Problem**: `userSearchQuery` (line 126) is a mock returning empty array, never used for search.
- **Location**: `app/(tabs)/sosio.tsx` line 126
- **Solution**: Remove if not driving any UI. If search is needed, implement properly.

### 4.6 IBUY: Duplicate `getTokenDecimals` Function
- **Problem**: `services/ibuy.ts` defines its own `getTokenDecimals` (lines 7-15) that duplicates `services/swap.ts`'s version but with different default (6 vs 9) and no caching.
- **Location**: `services/ibuy.ts` lines 7-15
- **Solution**: Remove the local function and import from `swap.ts`.
- **Implementation**: Replace `async function getTokenDecimals(mintAddress: string)` with `import { getTokenDecimals } from './swap';`. Delete lines 7-15.

### 4.7 IBUY: Creator Profit Share Not Executing
- **Problem**: IBUY records `creatorFee` in the database but never actually transfers SOL to the creator. Same issue as copy trading profit share.
- **Location**: `soulwallet-backend/src/server.ts` IBUY endpoints, `services/ibuy.ts`
- **Solution**: When a user sells an IBUY position at profit, calculate 5% of profit and transfer to the creator's wallet. The backend `sellIBuyPosition` already calculates `creatorShare` — it just needs to execute the transfer.
- **Implementation**: In the `/ibuy/sell/execute` endpoint, after confirming the sell, if `creatorShare > 0` and the creator has a wallet: prepare a SOL transfer transaction, return it to the client for signing. Same pattern as copy trading profit share (3.4).

---

## 5. MARKET & TOKEN INFO

### 5.1 MISSING: WebView Cache for External Platforms
- **Problem**: Per ffr.md, external platform webviews should cache content for fast loading. Currently no caching configured.
- **Location**: `components/market/ExternalPlatformWebView.tsx`
- **Solution**: Enable WebView caching by setting `cacheEnabled={true}` and `cacheMode="LOAD_CACHE_ELSE_NETWORK"` on the WebView component.
- **Implementation**: Add these props to the WebView component in `ExternalPlatformWebView.tsx`.

### 5.2 PERFORMANCE: Token List is Hardcoded Fallback Only
- **Problem**: `services/swap.ts` `getTokenList()` (line 62-73) immediately returns `FALLBACK_TOKENS` (15 tokens) without ever trying to fetch from Jupiter. The comment says "API often fails in React Native".
- **Location**: `services/swap.ts` lines 62-73
- **Solution**: Try Jupiter API first with a short timeout (3s), fall back to the hardcoded list. Cache the result. This gives users access to thousands of tokens instead of just 15.
- **Implementation**: Restore the API call with a 3-second AbortController timeout. On success, merge with FALLBACK_TOKENS (fallback tokens first for common ones). On failure, use fallback. Cache for 5 minutes (already have TTL logic).

### 5.3 BUG: `MarketToken` and `TrendingToken` are Identical Types
- **Problem**: `services/market.ts` defines `MarketToken` and `TrendingToken` with identical fields.
- **Location**: `services/market.ts` lines 3-14 and 24-35
- **Solution**: Remove `TrendingToken`, use `MarketToken` everywhere.
- **Implementation**: Delete the `TrendingToken` interface. Replace all `TrendingToken` references with `MarketToken`.

---

## 6. PORTFOLIO

### 6.1 PERFORMANCE: Double Fetch Pattern
- **Problem**: Same double-fetch issue as home page — both `useEffect` and `useFocusEffect` calling `fetchWalletData`.
- **Location**: `app/(tabs)/portfolio.tsx`
- **Solution**: Use only `useFocusEffect`.
- **Implementation**: Same as 2.3 — remove the initial `useEffect`, keep `useFocusEffect`.

### 6.2 BLOAT: Excessive `__DEV__` Logging
- **Problem**: Many `__DEV__` console.log calls in portfolio that log full holdings arrays (line 187). This slows rendering even in dev.
- **Location**: `app/(tabs)/portfolio.tsx` lines 159-187
- **Solution**: Reduce to essential logs only. Remove the `console.log('Holdings:', ...)` that dumps full arrays.

---

## 7. ACCOUNT / SETTINGS

### 7.1 CHECK: Delete Account
- **Problem**: Per ffr.md, delete account should "completely delete the user from the db and the app". Verify the backend endpoint actually cascades deletes (posts, follows, wallet, copy configs, positions, etc.).
- **Location**: `soulwallet-backend/src/server.ts` — DELETE /account endpoint
- **Solution**: Ensure the delete endpoint uses Prisma cascade or manually deletes all related records: posts, comments, likes, follows, wallet, copyTradingConfig, copyPositions, copyTradeQueue, ibuyPositions, creatorRevenue, traderWebhooks.
- **Implementation**: Review the Prisma schema for `onDelete: Cascade` on all relations. If not present, add manual cleanup in the delete handler.

---

## 8. BACKEND ISSUES

### 8.1 CRITICAL: 140KB Single Server File
- **Problem**: `soulwallet-backend/src/server.ts` is 140KB / ~3000+ lines. This is a massive monolith that's hard to maintain, debug, and causes slow reload during development.
- **Location**: `soulwallet-backend/src/server.ts`
- **Solution**: Split into route files. Create `routes/` directory with separate files for each domain.
- **Implementation**: Create `routes/auth.ts`, `routes/wallet.ts`, `routes/social.ts`, `routes/copyTrade.ts`, `routes/ibuy.ts`, `routes/market.ts`, `routes/trigger.ts`. Move each endpoint group to its file using Express Router. Import and mount in `server.ts`. This is a big refactor — do it carefully.

### 8.2 PERFORMANCE: Rate Limiter Too Strict
- **Problem**: Global rate limit of 100 requests per 15 minutes per IP. With normal app usage (wallet refresh, feed scroll, portfolio checks), an active user can hit this in under 10 minutes.
- **Location**: `soulwallet-backend/src/server.ts` lines 94-101
- **Solution**: Increase global limit to 500-1000 per 15 minutes. Add separate, stricter rate limits on auth endpoints (login/register) only.
- **Implementation**: Change `max: 100` to `max: 600`. Add a separate rate limiter for `/login` and `/register` routes: `rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })`.

### 8.3 MISSING: Feed Doesn't Include Like Status
- **Problem**: `feedService.ts` doesn't include whether the current user has liked each post. The `social.ts` client interface has `isLiked` but it's not populated by the feed endpoint.
- **Location**: `soulwallet-backend/src/services/feedService.ts`
- **Solution**: Include user's like status in feed query.
- **Implementation**: Pass `userId` to `getFeed`, add a Prisma include for `likes: { where: { userId }, select: { id: true } }` on the post query. Map `isLiked: post.likes.length > 0` in the response.

### 8.4 MISSING: Feed Doesn't Include Comment Count
- **Problem**: Feed posts from `feedService.ts` don't include `likesCount` or `commentsCount` — only the raw post data with user info.
- **Location**: `soulwallet-backend/src/services/feedService.ts` lines 47-59
- **Solution**: Add `_count: { select: { likes: true, comments: true } }` to the Prisma include.
- **Implementation**: Add the `_count` include and map the result to include `likesCount: post._count.likes`, `commentsCount: post._count.comments`.

### 8.5 BUG: `verifyToken` in social.ts Uses Deprecated Jupiter v6 API
- **Problem**: `services/social.ts` line 211 uses `https://price.jup.ag/v6/price` which may be deprecated/unreliable.
- **Location**: `services/social.ts` lines 207-226
- **Solution**: Use the same Jupiter API endpoint the backend uses (`lite-api.jup.ag/price/v3`) or use the backend's `/tokens/verify` endpoint instead.
- **Implementation**: Replace the direct Jupiter call with `api.post('/tokens/verify', { address })` — the backend already has this endpoint with better error handling.

---

## 9. GENERAL CODE QUALITY

### 9.1 `any` Type Usage
- **Problem**: Extensive use of `any` type throughout the codebase — `error: any`, `data: any`, `user: any`, etc.
- **Locations**: Virtually every file — `services/*.ts`, `app/**/*.tsx`
- **Solution**: Replace `any` with proper types or `unknown` where possible. At minimum, replace `catch (error: any)` with `catch (error: unknown)` and use type guards.
- **Implementation**: Low priority for beta, but clean up the most egregious cases: user state types, API response types, error handling.

### 9.2 UNUSED: `solana-setup.tsx` is 31KB
- **Problem**: This is a full wallet creation/import screen at 31KB. It works but is heavy. Per ffr.md, keep things light.
- **Location**: `app/solana-setup.tsx`
- **Solution**: No action needed if it works. Just ensure it's not being loaded unnecessarily (lazy load).

### 9.3 UNUSED: `performance.ts` Utility
- **Problem**: `utils/performance.ts` defines `PerformanceMonitor`, `usePerformanceMonitor`, `withPerformanceMonitoring`, `trackBundleSize` — none of which appear to be used anywhere in the app.
- **Location**: `utils/performance.ts`
- **Solution**: If not used, remove the file to reduce bundle size. If useful for debugging, keep but ensure it's tree-shaken in production.
- **Implementation**: Search for imports of `performanceMonitor`, `usePerformanceMonitor`, `withPerformanceMonitoring`, `trackBundleSize`. If none found, delete the file and remove from `utils/index.ts`.

### 9.4 UNUSED: `rateLimiter.ts`
- **Problem**: `utils/rateLimiter.ts` (511 bytes) — check if it's used anywhere.
- **Location**: `utils/rateLimiter.ts`
- **Solution**: If unused, remove.

### 9.5 SECURITY: PIN Stored as btoa(pin)
- **Problem**: `wallet.ts` line 96 stores the PIN as `btoa(userPin)` — this is base64 encoding, NOT hashing. Anyone with device access can decode it instantly. Per ffr.md this is acceptable for beta, but flag it.
- **Location**: `services/wallet.ts` line 96
- **Solution**: For beta: acceptable. For production: hash with bcrypt or similar. Just noting it here.

### 9.6 UNUSED: `Transaction` Import in wallet.ts
- **Problem**: `import { Keypair, Transaction } from '@solana/web3.js'` — `Transaction` is used in `sendTransaction` but check if legacy Transaction class is needed or if VersionedTransaction should be used consistently.
- **Location**: `services/wallet.ts` line 4
- **Solution**: No change needed if `sendTransaction` works. Just ensure consistency — copy trading uses `VersionedTransaction`, send uses legacy `Transaction`. Both should work.

### 9.7 TRIGGER SERVICE: Import at Bottom of File
- **Problem**: `services/trigger.ts` has `import { getLocalPublicKey } from './wallet';` at line 114 (bottom of file) instead of at the top.
- **Location**: `services/trigger.ts` line 114
- **Solution**: Move the import to the top of the file with other imports.
- **Implementation**: Move line 114 to line 5 (after existing imports).

---

## 10. ENV & CONFIG

### 10.1 EXPOSED: Helius API Key in .env
- **Problem**: `.env` file contains `EXPO_PUBLIC_HELIUS_API_KEY=cb611f1c-335b-4835-8fec-9fc90070680c`. Any `EXPO_PUBLIC_*` variable is embedded in the client bundle and visible to anyone who decompiles the APK.
- **Location**: `.env` line 6
- **Solution**: For beta this is acceptable. For production: proxy all Helius calls through the backend (which already has its own Helius keys). Remove the client-side key.

### 10.2 UNUSED: Sentry & Analytics Placeholders
- **Problem**: `.env` has `EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn-here` and `EXPO_PUBLIC_ANALYTICS_ID=your-analytics-id-here` — placeholders that do nothing.
- **Location**: `.env` lines 13-14
- **Solution**: Remove these placeholder values to avoid confusion.

---

## PRIORITY ORDER (for implementation)

### P0 — Must Fix (Blocks deployment)
1. **3.0** Custodial Trading Wallet architecture rewrite (Steps 1-5 — this IS the copy trading feature)
2. **1.1** Add policy checkbox to signup
3. **1.2** Add policy checkbox to login
4. **8.2** Increase rate limit

### P1 — High Priority (Core experience)
5. **4.1** Feed algorithm (Sosio king feature)
6. **4.7** IBUY creator profit share
7. **8.3** Feed like status
8. **8.4** Feed comment count

### P2 — Medium Priority (Performance & cleanup)
9. **1.3** Remove social login bloat
10. **1.4** Replace forgot-password with "coming soon"
11. **2.1** Remove dummy wallet
12. **2.2** Remove suppressed unused variables
13. **2.3** Fix double-fetch on home
14. **6.1** Fix double-fetch on portfolio
15. **4.3** Fix dynamic imports in sosio
16. **4.6** Remove duplicate getTokenDecimals
17. **5.1** Enable WebView caching
18. **9.7** Fix trigger.ts import order

### P3 — Nice to Have (Polish)
19. **4.2** Hashtag support in feed
20. **5.2** Restore Jupiter token list API
21. **5.3** Remove duplicate type
22. **8.1** Split server.ts into route files
23. **9.3** Remove unused performance.ts
24. **9.4** Check/remove unused rateLimiter.ts
25. **2.5** Ensure console removal in prod
26. **8.5** Fix deprecated Jupiter v6 API usage

---

*Generated by audit agent. Implementation agents: follow priority order. Each item is independent unless noted. Do NOT over-engineer — keep it simple, fast, light.*
