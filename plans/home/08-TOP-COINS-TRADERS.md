# Top Coins & Top Traders Audit

## Overview
Audit of the market data and trader listings displayed on the home screen.

---

## 1. Top Coins Implementation

### 1.1 Data Flow
```
Frontend (index.tsx)
    │
    ├─> trpc.market.trending.useQuery()
    │       └─> marketData.trending()
    │               └─> DexScreener API searches
    │               └─> Filter & sort by volume
    │               └─> Cache for 5 minutes
    │
    └─> trpc.market.search.useQuery({ q: searchTerm })
            └─> marketData.search(q)
                    └─> DexScreener search API
```

### 1.2 Frontend Implementation (`app/(tabs)/index.tsx`)

```typescript
// Fetch trending coins
const { data: trendingData, isLoading: trendingLoading } = trpc.market.trending.useQuery(undefined, {
  enabled: isAuthenticated,
  staleTime: 60_000,
  refetchInterval: 60_000,
  refetchOnWindowFocus: false,
});

// Transform to display format
const topCoins = React.useMemo(() => {
  if (!trendingData?.pairs) return [];
  
  return trendingData.pairs.slice(0, 20).map((pair: any) => ({
    id: pair.pairAddress || `${pair.chainId}-${pair.dexId}`,
    symbol: pair.baseToken?.symbol || 'UNKNOWN',
    name: pair.baseToken?.name || 'Unknown Token',
    price: parseFloat(pair.priceUsd || '0'),
    change24h: parseFloat(pair.priceChange?.h24 || '0'),
    volume24h: parseFloat(pair.volume?.h24 || '0'),
    logo: pair.info?.imageUrl,
    liquidity: parseFloat(pair.liquidity?.usd || '0'),
  }));
}, [trendingData]);

// Search with debounce
const { data: searchData, isLoading: searchLoading } = trpc.market.search.useQuery(
  { q: debouncedCoinsSearch },
  {
    enabled: isAuthenticated && debouncedCoinsSearch.length >= 2,
    staleTime: 60_000,
    keepPreviousData: true,
  }
);
```

### 1.3 Backend Implementation (`src/lib/services/marketData.ts`)

```typescript
async trending() {
  const key = 'trending';
  const cached = this.cache.get(key);
  if (cached) return cached;

  // Search for popular Solana tokens
  const popularTokens = ['SOL', 'USDC', 'BONK', 'WIF', 'JUP', 'PYTH', 'JTO', 'RNDR', 'RAY'];
  
  const results = await Promise.all(
    popularTokens.map(async (token) => {
      try {
        return await this.search(token);
      } catch {
        return { pairs: [] };
      }
    })
  );

  // Combine, sort by volume, deduplicate
  const allPairs = results.flatMap(r => r.pairs || []);
  const sortedByVolume = allPairs.sort((a, b) => 
    parseFloat(b.volume?.h24 || '0') - parseFloat(a.volume?.h24 || '0')
  );
  const uniquePairs = sortedByVolume.filter((pair, index, self) =>
    index === self.findIndex(p => p.baseToken?.address === pair.baseToken?.address)
  );

  const trending = { pairs: uniquePairs.slice(0, 50) };
  this.cache.set(key, trending, 300); // 5 minute cache
  return trending;
}
```

### 1.4 Issues Found

#### 🟠 High Priority

##### 1.4.1 Hardcoded Token List
```typescript
const popularTokens = ['SOL', 'USDC', 'BONK', 'WIF', 'JUP', 'PYTH', 'JTO', 'RNDR', 'RAY'];
```
**ISSUE**: Doesn't discover new trending tokens

**FIX**: Use DexScreener's actual trending endpoint or Birdeye trending

##### 1.4.2 No Error Handling in UI
```typescript
{isLoadingCoins ? (
  <LoadingContainer />
) : displayCoins.length === 0 ? (
  <EmptyContainer />
) : (
  // Display coins
)}
```
**ISSUE**: No error state shown if API fails

**FIX**: Add error handling:
```typescript
const { data, isLoading, error } = trpc.market.trending.useQuery(...);

{error ? (
  <ErrorContainer message="Failed to load coins" onRetry={refetch} />
) : isLoading ? (
  <LoadingContainer />
) : ...}
```

##### 1.4.3 Search Minimum 2 Characters
```typescript
enabled: debouncedCoinsSearch.length >= 2,
```
**ISSUE**: Single character searches like "W" (for WIF) don't work

**FIX**: Allow single character or show suggestions

#### 🟡 Medium Priority

##### 1.4.4 No Price Alerts
**FIX**: Allow users to set price alerts for tokens

##### 1.4.5 No Favorites/Watchlist
**FIX**: Let users save favorite tokens

##### 1.4.6 Time Filter Not Functional
```typescript
const [coinsTimeFilter, setCoinsTimeFilter] = React.useState<'1d' | '7d' | '1m' | '1y'>('1d');
```
**ISSUE**: Filter UI exists but doesn't affect data

**FIX**: Pass filter to API and sort by appropriate time period

---

## 2. Top Traders Implementation

### 2.1 Data Flow
```
Frontend (index.tsx)
    │
    ├─> trpc.traders.getTopTraders.useQuery({ limit: 10, period: '7d' })
    │       └─> prisma.traderProfile.findMany({ where: { isFeatured: true } })
    │       └─> For each trader: birdeyeData.getWalletPnL(walletAddress)
    │       └─> Sort by ROI, cache for 5 minutes
    │
    └─> trpc.traders.search.useQuery({ q: searchTerm })
            └─> prisma.traderProfile.findMany({ where: { username/wallet contains q } })
```

### 2.2 Frontend Implementation

```typescript
// Fetch top traders
const { data: tradersData, isLoading: tradersLoading } = trpc.traders.getTopTraders.useQuery(
  { limit: 10, period: '7d' },
  { enabled: isAuthenticated, staleTime: 300_000, refetchInterval: 300_000 }
);

const topTraders = tradersData?.data || [];

// Search traders
const { data: searchedTradersData } = trpc.traders.search.useQuery(
  { q: debouncedTradersSearch, limit: 10 },
  { enabled: isAuthenticated && debouncedTradersSearch.length >= 3 }
);

// Display
{topTraders.map((trader) => (
  <TraderCard
    key={trader.id}
    username={trader.name}
    roi={trader.roi}
    period={tradersTimeFilter}
    isVerified={trader.verified}
    onPress={() => {
      // Open Birdeye profile
      Linking.openURL(`https://birdeye.so/profile/${trader.walletAddress}?chain=solana`);
    }}
    onCopyPress={() => {
      setSelectedTrader(trader.name);
      setSelectedTraderWallet(trader.walletAddress);
      setShowCopyModal(true);
    }}
  />
))}
```

### 2.3 Backend Implementation (`src/server/routers/traders.ts`)

```typescript
getTopTraders: protectedProcedure
  .input(z.object({
    limit: z.number().min(1).max(20).default(10),
    period: z.enum(['1d', '7d', '30d', 'all']).default('7d'),
  }).optional())
  .query(async ({ input }) => {
    // Get featured traders from database
    const traders = await prisma.traderProfile.findMany({
      where: { isFeatured: true },
      orderBy: { featuredOrder: 'asc' },
      take: limit,
    });

    // Fetch real PnL data from Birdeye
    const tradersWithData = await Promise.all(
      traders.map(async (trader) => {
        const pnlData = await birdeyeData.getWalletPnL(trader.walletAddress);
        return {
          id: trader.id,
          name: trader.username || trader.id,
          walletAddress: trader.walletAddress,
          roi: pnlData?.data?.roi_percentage || 0,
          totalPnL: pnlData?.data?.total_pnl_usd || 0,
          // ...
        };
      })
    );

    return { success: true, data: tradersWithData.sort((a, b) => b.roi - a.roi) };
  }),
```

### 2.4 Issues Found

#### 🔴 Critical Issues

##### 2.4.1 Only Featured Traders Shown
```typescript
const traders = await prisma.traderProfile.findMany({
  where: { isFeatured: true },
});
```
**ISSUE**: If no traders are marked as featured, list is empty

**FIX**: Add fallback to top performers:
```typescript
let traders = await prisma.traderProfile.findMany({
  where: { isFeatured: true },
  orderBy: { featuredOrder: 'asc' },
  take: limit,
});

if (traders.length === 0) {
  traders = await prisma.traderProfile.findMany({
    orderBy: { totalROI: 'desc' },
    take: limit,
  });
}
```

##### 2.4.2 No Trader Discovery
**ISSUE**: Users can only copy pre-registered traders

**FIX**: Allow copying any Solana wallet address (already partially implemented in copy modal)

#### 🟠 High Priority

##### 2.4.3 Birdeye API Dependency
```typescript
const pnlData = await birdeyeData.getWalletPnL(trader.walletAddress);
```
**ISSUE**: If Birdeye is down, all traders show 0% ROI

**FIX**: 
1. Cache last known values in database
2. Show "data unavailable" indicator
3. Add fallback data source

##### 2.4.4 Period Filter Not Used
```typescript
period: z.enum(['1d', '7d', '30d', 'all']).default('7d'),
```
**ISSUE**: Period is accepted but not used in Birdeye query

**FIX**: Pass period to Birdeye API or filter cached data

##### 2.4.5 Search Minimum 3 Characters
```typescript
enabled: debouncedTradersSearch.length >= 3
```
**ISSUE**: Can't search for short usernames

**FIX**: Allow 2 characters minimum

#### 🟡 Medium Priority

##### 2.4.6 No Trader Verification Badge Logic
```typescript
isVerified={trader.verified ?? trader.isVerified}
```
**ISSUE**: No clear criteria for verification

**FIX**: Define verification criteria (KYC, track record, etc.)

##### 2.4.7 No Trader Performance History
**FIX**: Show performance chart on trader card

##### 2.4.8 No Trader Comparison
**FIX**: Allow comparing multiple traders side-by-side

---

## 3. TokenCard Component (`components/TokenCard.tsx`)

### ✅ Working Correctly
- Price formatting for various ranges
- Large number formatting (K, M, B)
- Color coding for positive/negative change
- Logo with fallback
- Navigation to coin detail

### 🟡 Improvements

##### 3.1 Add Sparkline Chart
**FIX**: Show mini price chart in card

##### 3.2 Add Quick Actions
**FIX**: Add buy/swap buttons directly on card

---

## 4. TraderCard Component (`components/TraderCard.tsx`)

### ✅ Working Correctly
- Avatar with fallback
- ROI display with color coding
- Period indicator
- Verified badge
- Copy button

### 🟡 Improvements

##### 4.1 Show More Stats
**FIX**: Add win rate, total trades, followers

##### 4.2 Add Follow Button
**FIX**: Allow following without copying

---

## 5. Data Quality Checks

### Coins Data
- [ ] All prices are positive numbers
- [ ] Change percentages are reasonable (-100% to +1000%)
- [ ] Volume is non-negative
- [ ] Symbols are uppercase
- [ ] No duplicate tokens

### Traders Data
- [ ] All wallet addresses are valid Solana addresses
- [ ] ROI percentages are reasonable
- [ ] Usernames are sanitized
- [ ] No duplicate traders

---

## 6. Performance Optimization

### Current Issues
1. **Multiple API calls** - Each trader triggers Birdeye call
2. **No pagination** - All data loaded at once
3. **No virtual list** - All items rendered

### Recommended Improvements

#### 6.1 Batch Birdeye Calls
```typescript
// Instead of individual calls
const pnlData = await Promise.all(
  traders.map(t => birdeyeData.getWalletPnL(t.walletAddress))
);

// Use batch endpoint if available
const pnlData = await birdeyeData.getBatchWalletPnL(
  traders.map(t => t.walletAddress)
);
```

#### 6.2 Add Pagination
```typescript
const { data, fetchNextPage, hasNextPage } = trpc.traders.getTopTraders.useInfiniteQuery(
  { limit: 10 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);
```

#### 6.3 Use FlatList with Virtualization
```typescript
<FlatList
  data={topTraders}
  renderItem={({ item }) => <TraderCard {...item} />}
  keyExtractor={(item) => item.id}
  initialNumToRender={5}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

---

## 7. Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 | Fallback for empty featured traders | 1hr |
| 🟠 | Dynamic trending tokens | 4hr |
| 🟠 | Error states in UI | 2hr |
| 🟠 | Birdeye fallback/caching | 3hr |
| 🟠 | Period filter implementation | 2hr |
| 🟡 | Time filter for coins | 2hr |
| 🟡 | Watchlist feature | 4hr |
| 🟡 | Trader comparison | 4hr |
| 🟡 | Performance optimization | 4hr |

**Total Estimated Effort: ~26 hours**
