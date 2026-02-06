I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The Market tab currently uses static dummy data (`DUMMY_TOKENS`) and has a non-functional QuickBuyModal showing "Coming Soon" alerts. The backend lacks a market data endpoint and caching infrastructure. However, the swap infrastructure (`file:services/swap.ts`) is fully functional with Jupiter integration, and WebView caching is already properly configured in `file:components/market/ExternalPlatformWebView.tsx`. The portfolio screen has pull-to-refresh implemented but needs verification that it triggers after successful swaps.

## Approach

Implement a lightweight market data layer using BirdEye API with 1-hour backend caching via NodeCache to avoid rate limits. Replace dummy data in the Market screen with real API calls, wire QuickBuyModal to the existing swap infrastructure (reusing `executeSwap` from `file:services/swap.ts`), and verify WebView cache settings and portfolio refresh behavior. This avoids over-engineering by reusing existing patterns from SwapModal and keeping the architecture simple.

## Implementation Steps

### 1. Backend - Install NodeCache Dependency

Navigate to `file:soulwallet-backend/` directory and install the `node-cache` package:

```bash
npm install node-cache
```

Add TypeScript types:

```bash
npm install --save-dev @types/node-cache
```

### 2. Backend - Add Market Tokens Endpoint

In `file:soulwallet-backend/src/server.ts`:

**Import NodeCache** at the top of the file alongside other imports (after line 13):
- Import `NodeCache` from `node-cache`

**Initialize token cache** after the Express app initialization (around line 68):
- Create a new `NodeCache` instance with `stdTTL: 3600` (1 hour cache)
- Name the instance `tokenCache`

**Add GET `/market/tokens` endpoint** before the 404 handler (around line 1248):
- Check cache first using `tokenCache.get('top_tokens')`
- If cached, return `{ success: true, tokens: cached, cached: true }`
- If not cached, fetch from BirdEye API:
  - URL: `https://public-api.birdeye.so/defi/tokenlist`
  - Headers: `X-API-KEY` from `process.env.BIRDEYE_API_KEY`
  - Query params: `sort_by=v24hUSD`, `sort_type=desc`, `offset=0`, `limit=50`
- Transform response data to frontend format:
  - Map each token to: `{ address, symbol, name, price, priceChange24h, volume24h, marketCap, logo, banner }`
  - Use `logoURI` from response or fallback to Solana token-list GitHub URL
  - Use `extensions?.bannerURI` for banner field
- Cache the transformed tokens using `tokenCache.set('top_tokens', tokens)`
- Return `{ success: true, tokens, cached: false }`
- On error, return stale cache if available, otherwise return 500 error

**Environment variable check**: Ensure `BIRDEYE_API_KEY` is already set in backend `.env` (it should be from Phase 2)

### 3. Frontend - Create Market Service

Create new file `file:services/market.ts`:

**Export `fetchMarketTokens` function**:
- Fetch from `${EXPO_PUBLIC_API_URL}/market/tokens`
- Return parsed JSON response
- Handle network errors gracefully

**Export `refreshMarketTokens` function** (optional):
- Same as `fetchMarketTokens` but with `?refresh=true` query param
- This forces backend to bypass cache if needed in future

**Type definitions**:
- Define `MarketToken` interface matching backend response format
- Include fields: `address`, `symbol`, `name`, `price`, `priceChange24h`, `volume24h`, `marketCap`, `logo`, `banner`

### 4. Frontend - Update Market Screen

In `file:app/(tabs)/market.tsx`:

**Replace dummy data with real API**:
- Remove `DUMMY_TOKENS` constant (line 21-25)
- Import `fetchMarketTokens` from `file:services/market.ts`
- Add `useEffect` hook to fetch tokens on component mount
- Store tokens in state using `useState<MarketToken[]>`
- Handle loading state (set `isLoading` to true during fetch)
- Handle error state (show error message if fetch fails)

**Update refresh handler**:
- Modify `onRefresh` callback (line 63-67) to call `fetchMarketTokens`
- Update `refetch` function to actually fetch from API instead of no-op

**Update token mapping**:
- Ensure `visibleTokens.map()` (line 117) uses correct field names from API response
- Map `address` to `contractAddress` prop
- Add `pairAddress` field (may need to derive from BirdEye data or leave empty)

**Preserve existing UI**:
- Keep all existing UI components (TokenCard, tabs, WebView, QuickBuyModal)
- Keep responsive padding logic
- Keep skeleton loader during initial load

### 5. Frontend - Wire QuickBuyModal to Swap Service

In `file:components/QuickBuyModal.tsx`:

**Import swap functions**:
- Import `getQuote` and `executeSwap` from `file:services/swap.ts`
- Import `getTokenDecimals` to handle token decimals properly

**Replace mock verification** (line 88-106):
- Remove mock timeout and dummy token info
- Call BirdEye or Jupiter API to verify token exists
- Fetch token metadata (symbol, name, decimals, logo)
- Mark as `verified: true` if from Jupiter strict list, `verified: false` otherwise
- Set `source` field appropriately

**Replace "Coming Soon" alert** (line 141-145):
- Remove the alert
- Fetch quote using `getQuote` with:
  - `inputMint`: SOL address (`So11111111111111111111111111111111111111112`)
  - `outputMint`: `tokenInfo.address`
  - `amount`: Convert SOL amount to lamports using decimals
  - `slippageBps`: Convert slippage percentage to basis points (e.g., 1% = 100 bps)
- Show loading state while fetching quote
- Display estimated output from quote
- On user confirmation, call `executeSwap(quote, pin)` (no PIN needed, remove PIN input)
- Handle success: Show success toast, close modal, trigger portfolio refresh
- Handle error: Show error message

**Simplify PIN flow**:
- Since `executeSwap` already handles PIN internally via `getKeypairForSigning`, remove PIN input from QuickBuyModal
- Or keep PIN input if you want explicit confirmation (follow SwapModal pattern)

**Follow SwapModal patterns**:
- Study `file:components/SwapModal.tsx` for quote fetching logic (line 97-135)
- Study swap execution logic (line 232-294)
- Reuse error handling patterns
- Reuse loading states and UI feedback

### 6. Frontend - Verify WebView Cache Settings

In `file:components/market/ExternalPlatformWebView.tsx`:

**Verify cache settings are enabled** (already done, just confirm):
- Line 217: `cacheEnabled={true}` ✓
- Line 218: `cacheMode="LOAD_CACHE_ELSE_NETWORK"` ✓
- Line 219: `thirdPartyCookiesEnabled={true}` ✓
- Line 220: `sharedCookiesEnabled={true}` ✓

**No changes needed** - WebView caching is already optimized.

### 7. Frontend - Verify Portfolio Refresh

In `file:app/(tabs)/portfolio.tsx`:

**Verify refresh on focus**:
- Check if `useFocusEffect` or `useEffect` triggers balance refresh when tab becomes active
- If not present, add `useFocusEffect` hook to call `fetchBalances` when portfolio tab is focused

**Verify pull-to-refresh**:
- Confirm `RefreshControl` is wired to `fetchBalances` function
- Ensure `refreshing` state is properly managed

**Add refresh callback to QuickBuyModal**:
- In `file:app/(tabs)/market.tsx`, pass `onSuccess` callback to QuickBuyModal
- Callback should trigger portfolio refresh (if possible) or just close modal

### 8. Testing Checklist

**Backend testing**:
- Start backend server
- Hit `/market/tokens` endpoint manually (curl or Postman)
- Verify response contains 50 tokens with correct fields
- Hit endpoint again, verify `cached: true` in response
- Wait 1 hour, verify cache expires and fresh data is fetched

**Frontend Market screen testing**:
- Open Market tab
- Verify tokens load from API (not dummy data)
- Pull to refresh, verify tokens update
- Switch to WebView tabs (DexScreener, Raydium, etc.)
- Verify WebViews load quickly on second visit (cache working)

**QuickBuyModal testing**:
- Open QuickBuyModal via floating cart button
- Paste a valid token address (e.g., BONK: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`)
- Verify token info loads (symbol, name, logo)
- Enter SOL amount (e.g., 0.1)
- Verify estimated output appears
- Confirm swap
- Verify transaction succeeds
- Check portfolio tab, verify new token appears in holdings

**Portfolio refresh testing**:
- After successful swap in QuickBuyModal
- Switch to Portfolio tab
- Verify new token appears without manual refresh
- Pull to refresh, verify balances update

### 9. Environment Variables

**Backend** (`file:soulwallet-backend/.env`):
- Ensure `BIRDEYE_API_KEY` is set (should already exist from Phase 2)

**Frontend** (`file:.env`):
- Ensure `EXPO_PUBLIC_API_URL` points to backend (should already exist)

No new environment variables needed.

### 10. Error Handling

**Backend**:
- If BirdEye API fails, return stale cache if available
- If no cache and API fails, return 500 error with message
- Log errors for debugging

**Frontend**:
- If `/market/tokens` fails, show error message in Market screen
- Allow retry via pull-to-refresh
- If QuickBuyModal swap fails, show error alert with details
- Don't close modal on error, allow user to retry

### 11. Performance Optimizations

**Backend**:
- 1-hour cache reduces BirdEye API calls from potentially thousands to ~24 per day
- Stale cache fallback ensures users always see data even if API is down

**Frontend**:
- FlatList with `initialNumToRender={10}` and `windowSize={5}` already optimized (line 112-146)
- WebView cache reduces load times from 3-5 seconds to <1 second on revisit
- Image caching handled by React Native default behavior

**No additional optimizations needed** - current architecture is already efficient for beta.

---

## Summary

This implementation adds a simple, cached market data layer without over-engineering. The backend caches BirdEye data for 1 hour to avoid rate limits, the frontend replaces dummy data with real API calls, and QuickBuyModal is wired to the existing swap infrastructure. WebView caching is already optimized, and portfolio refresh just needs verification. Total estimated effort: ~500 lines of code across 4 files (backend endpoint, market service, market screen updates, QuickBuyModal wiring).