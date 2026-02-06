I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The backend already has **both endpoints fully implemented**:
- `/market/trending` - Top 10 Solana tokens, refreshes daily at 15:00 UTC, 24h cache
- `/market/tokens` - Top 50 tokens by volume, 1h cache via NodeCache

Frontend has **partial integration**:
- Home screen fetches trending tokens but lacks price polling
- Market screen fetches tokens but shows all 50 instead of 30, lacks price polling
- `fetchTrendingTokens` exists in `services/social.ts` (should be in `market.ts`)
- TokenCard component ready to display logos/banners

**Missing pieces**: Price polling intervals, 30-token limit for SoulMarket, service file organization.

---

## Approach

Keep it **dead simple** - no over-engineering, just working features:

1. **Backend**: Already complete, just verify BirdEye endpoints work
2. **Frontend Home**: Add 5-minute price polling for trending tokens
3. **Frontend Market**: Limit to 30 tokens, add 5-minute price polling
4. **Service cleanup**: Move `fetchTrendingTokens` to `market.ts` for consistency
5. **No extras**: No WebSockets, no complex caching, no background sync - just simple `setInterval` polling

This matches your "simple, fast, working" requirement for beta APK.

---

## Implementation Steps

### 1. Backend Verification (No Changes Needed)

**File: `soulwallet-backend/src/server.ts`**

Verify existing endpoints work correctly:
- Line 1610-1637: `/market/trending` endpoint ✅
- Line 1549-1608: `/market/tokens` endpoint ✅
- Line 1470-1531: `fetchTrendingTokens()` helper ✅
- Line 1441-1468: `shouldRefreshTrending()` helper ✅

**BirdEye API endpoints used:**
- Trending: `https://public-api.birdeye.so/public/defi/tokenlist` (FREE, no key)
- SoulMarket: `https://public-api.birdeye.so/defi/tokenlist` (requires `BIRDEYE_API_KEY`)

Both endpoints already include:
- `logo` field from `token.logoURI`
- `banner` field from `token.extensions?.bannerURI`
- `priceChange24h` for % movement
- Proper sorting (trending by `v24hChangePercent`, market by `v24hUSD`)

**No backend changes required** - everything works as specified.

---

### 2. Frontend Service Cleanup

**File: `services/market.ts`**

Move `fetchTrendingTokens` from `social.ts` to `market.ts` for better organization:

```typescript
// Add TrendingToken interface
export interface TrendingToken {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  logo: string;
  banner?: string;
}

// Add trending tokens fetch
export const fetchTrendingTokens = async (): Promise<{
  success: boolean;
  tokens?: TrendingToken[];
  lastUpdated?: string;
  error?: string;
}> => {
  const response = await api.get<{
    success: boolean;
    tokens: TrendingToken[];
    lastUpdated: string;
  }>('/market/trending');
  return response;
};
```

**File: `services/social.ts`**

Remove `fetchTrendingTokens` and `TrendingToken` interface (lines 176-203) - no longer needed here.

---

### 3. Home Screen - Trending Tokens with Price Polling

**File: `app/(tabs)/index.tsx`**

**Changes needed:**

1. **Import from correct service** (line 219):
   ```typescript
   import { fetchTrendingTokens } from '@/services/market'; // Changed from social
   ```

2. **Add price polling interval** (after line 250):
   ```typescript
   // Poll prices every 5 minutes for trending tokens
   useEffect(() => {
     if (trendingTokens.length === 0) return;
     
     const pollPrices = async () => {
       const result = await fetchTrendingTokens();
       if (result.success && result.tokens) {
         const transformed = result.tokens.map((token: any) => ({
           id: token.address,
           symbol: token.symbol,
           name: token.name,
           price: token.price || 0,
           change24h: token.priceChange24h || 0,
           volume24h: token.volume24h || 0,
           logo: token.logo || getWellKnownTokenLogo(token.symbol),
           banner: token.banner,
           liquidity: token.liquidity || 0,
           contractAddress: token.address,
           marketCap: token.marketCap || 0,
         }));
         setTrendingTokens(transformed);
       }
     };
     
     const interval = setInterval(pollPrices, 5 * 60 * 1000); // 5 minutes
     return () => clearInterval(interval);
   }, [trendingTokens.length]);
   ```

3. **Update TokenCard props** (around line 543-818 in `renderTabContent`):
   - Ensure `logo` prop is passed: `logo={coin.logo}`
   - Ensure `change` prop uses `change24h`: `change={coin.change24h}`

**No other changes needed** - trending tokens already load on mount, display in TokenCard, and navigate to coin details.

---

### 4. Market Screen - SoulMarket with 30 Tokens & Price Polling

**File: `app/(tabs)/market.tsx`**

**Changes needed:**

1. **Limit to 30 tokens** (line 78):
   ```typescript
   // Limit SoulMarket to 30 tokens (backend returns 50)
   const visibleTokens = tokens.slice(0, 30);
   ```

2. **Add price polling interval** (after line 69):
   ```typescript
   // Poll prices every 5 minutes for market tokens
   useEffect(() => {
     if (tokens.length === 0 || activeTab !== 'soulmarket') return;
     
     const pollPrices = async () => {
       try {
         const response = await fetchMarketTokens();
         if (response.success) {
           setTokens(response.tokens);
         }
       } catch (err) {
         // Silent fail - keep showing cached data
       }
     };
     
     const interval = setInterval(pollPrices, 5 * 60 * 1000); // 5 minutes
     return () => clearInterval(interval);
   }, [tokens.length, activeTab]);
   ```

3. **Update token count display** (line 119):
   ```typescript
   {totalCount > 0 && (
     <Text style={styles.tokenCount}>
       Showing {visibleTokens.length} of {totalCount} tokens
     </Text>
   )}
   ```

**No other changes needed** - market tokens already load on mount, display in TokenCard with logos, and have pull-to-refresh.

---

### 5. Price Service Enhancement (Optional - Backend)

**File: `soulwallet-backend/src/services/priceService.ts`**

**Current state**: Only fetches prices from Jupiter (10s cache)

**Enhancement** (if you want real-time price updates):

Add BirdEye price fetching as fallback:
```typescript
export async function getTokenPriceWithBirdEye(mintToken: string): Promise<number> {
  // Try Jupiter first (existing logic)
  const jupiterPrice = await getTokenPrice(mintToken);
  if (jupiterPrice > 0) return jupiterPrice;
  
  // Fallback to BirdEye
  try {
    const response = await axios.get('https://public-api.birdeye.so/defi/price', {
      headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY },
      params: { address: mintToken },
      timeout: 5000
    });
    return response.data?.data?.value || 0;
  } catch {
    return 0;
  }
}
```

**Note**: This is **optional** - current implementation already works. Only add if you see price staleness issues.

---

### 6. Testing Checklist

**Backend:**
- [ ] `/market/trending` returns 10 tokens with logos/banners
- [ ] `/market/tokens` returns 50 tokens with logos/banners
- [ ] Trending refreshes at 15:00 UTC daily
- [ ] Market tokens cache expires after 1 hour
- [ ] Fallback tokens work when BirdEye API fails

**Frontend Home:**
- [ ] Trending tokens load on mount
- [ ] Logos display correctly (or fallback to letter avatar)
- [ ] Price updates every 5 minutes
- [ ] % change displays with correct color (green/red)
- [ ] Clicking token navigates to coin details
- [ ] Pull-to-refresh works

**Frontend Market:**
- [ ] SoulMarket shows exactly 30 tokens
- [ ] Logos display correctly
- [ ] Price updates every 5 minutes
- [ ] Pull-to-refresh works
- [ ] Token count shows "Showing 30 of 50 tokens"
- [ ] Clicking token navigates to coin details

---

## Summary

**Total changes**: ~50 lines across 3 files
- `services/market.ts`: +20 lines (move trending function)
- `app/(tabs)/index.tsx`: +25 lines (price polling)
- `app/(tabs)/market.tsx`: +10 lines (30-token limit + polling)

**No backend changes needed** - everything already works.

**Simple, fast, working** - just basic `setInterval` polling, no fancy stuff.