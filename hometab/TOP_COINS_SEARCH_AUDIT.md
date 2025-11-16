# 🔍 Top Coins & Search Functionality Audit Report

**Date**: November 11, 2025  
**Status**: ❌ **CRITICAL ISSUES FOUND**

---

## 📊 **Executive Summary**

**Major Finding**: "TOP COINS" tab is **COMPLETELY MISLABELED** and search functionality is **LIMITED TO WALLET TOKENS**!

### **Risk Level**: 🔴 **HIGH**
- ❌ "TOP COINS" tab shows **user's wallet tokens**, NOT market top coins
- ❌ Search only filters **user's own tokens**, not market-wide search
- ❌ Backend has **market.trending** endpoint but frontend doesn't use it
- ❌ Backend has **market.search** endpoint but frontend doesn't use it
- ⚠️ Users misled by tab name - expect trending coins, get personal tokens

---

## 🔍 **Detailed Findings**

### **1. "TOP COINS" Tab** ❌ **COMPLETELY WRONG**

#### **Frontend (`app/(tabs)/index.tsx` lines 219-269):**
```typescript
case 'coins':
  return (
    <View style={styles.tabContent}>
      {/* Search with Time Filter Dropdown for Coins */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search coins..."
          value={coinsSearchQuery}
          onChangeText={setCoinsSearchQuery}
        />
      </View>
      
      {/* ❌ Shows USER'S WALLET TOKENS, not market top coins! */}
      {tokens
        .filter(token => 
          token.symbol.toLowerCase().includes(coinsSearchQuery.toLowerCase()) ||
          token.name.toLowerCase().includes(coinsSearchQuery.toLowerCase())
        )
        .map(token => (
          <TokenCard
            key={token.id}
            symbol={token.symbol}
            name={token.name}
            price={token.price}
            change={token.change24h}
          />
        ))
      }
    </View>
  );
```

**Where `tokens` comes from** (`hooks/wallet-store.ts`):
```typescript
const tokensQuery = trpc.wallet.getTokens.useQuery(); // ❌ USER'S WALLET TOKENS

const tokens: Token[] = tokensQuery.data?.tokens.map(token => {
  return {
    id: token.mint,
    symbol: metadata?.symbol || 'UNKNOWN',
    name: metadata?.name || 'Unknown Token',
    price: 1,               // ❌ Hardcoded
    change24h: 0,           // ❌ Hardcoded
    balance: token.balance,  // User's balance
  };
}) || [];
```

**Critical Issues:**
1. ❌ **Tab name misleading** - Says "TOP COINS" but shows personal wallet
2. ❌ **Wrong data source** - Uses wallet tokens instead of market data
3. ❌ **Hardcoded prices** - price: 1, change24h: 0
4. ❌ **No market data** - Doesn't fetch trending/popular coins
5. ❌ **Poor UX** - Users can't discover new tokens

---

### **2. Search Functionality** ❌ **LIMITED & DISCONNECTED**

#### **Current Implementation** (Lines 253-257):
```typescript
{/* ❌ Only searches USER'S wallet tokens */}
{tokens
  .filter(token => 
    token.symbol.toLowerCase().includes(coinsSearchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(coinsSearchQuery.toLowerCase())
  )
  .map(token => <TokenCard ... />)
}
```

**Issues:**
1. ❌ **No real-time search** - Just filters local array
2. ❌ **Limited scope** - Only searches tokens user owns
3. ❌ **No market search** - Can't discover new tokens
4. ❌ **No API calls** - Backend search endpoint unused

**Example**:
- User searches "BONK"
- If user doesn't own BONK → No results ❌
- But backend has `market.search('BONK')` that works! ✅

---

### **3. Backend Has Solutions BUT Unused** ⚠️

#### **Backend Market Router** (`src/server/routers/market.ts`):
```typescript
export const marketRouter = router({
  // ✅ Get token details
  getToken: protectedProcedure
    .input(z.object({ address: z.string().min(10) }))
    .query(async ({ input }) => {
      return await marketData.getToken(input.address);
    }),

  // ✅ Search tokens/pairs - UNUSED BY FRONTEND!
  search: protectedProcedure
    .input(z.object({ q: z.string().min(1) }))
    .query(async ({ input }) => {
      return await marketData.search(input.q);
    }),

  // ✅ Trending tokens - UNUSED BY FRONTEND!
  trending: protectedProcedure
    .query(async () => {
      return await marketData.trending();
    }),
});
```

**Backend Features Available:**
- ✅ Real-time market search via DexScreener
- ✅ Trending tokens endpoint
- ✅ Token details with live prices
- ✅ 30-second caching for performance

**Problem**: Frontend doesn't call ANY of these! ❌

---

### **4. MarketData Service** ✅ **Good Implementation**

**File**: `src/lib/services/marketData.ts`

```typescript
class MarketDataService {
  private cache = new NodeCache({ stdTTL: 30 }); // ✅ 30s cache
  private base = 'https://api.dexscreener.com/latest';

  async getToken(address: string) {
    const key = `token:${address}`;
    const cached = this.cache.get(key);
    if (cached) return cached;  // ✅ Cache hit

    const { data } = await axios.get(`${this.base}/dex/tokens/${address}`);
    this.cache.set(key, data);
    return data;
  }

  async search(q: string) {
    const key = `search:${q}`;
    const cached = this.cache.get(key);
    if (cached) return cached;  // ✅ Cache hit

    const { data } = await axios.get(`${this.base}/dex/search`, { params: { q } });
    this.cache.set(key, data);
    return data;
  }

  async trending() {
    return this.search('solana');  // ⚠️ Fallback - could be improved
  }
}
```

**Good Features:**
- ✅ DexScreener API integration
- ✅ 30-second caching
- ✅ Axios for reliable requests
- ✅ Search functionality ready

**Issue:**
- ⚠️ `trending()` is just a fallback search for "solana"
- Could use better trending logic

---

## 🏗️ **Architecture Analysis**

### **Current Architecture** (❌ Broken):
```
Frontend "TOP COINS" Tab
    |
    |--[Shows wallet tokens]
    |   - Only user's owned tokens
    |   - Hardcoded price: 1
    |   - Hardcoded change: 0
    |   - Can't discover new coins
    |
    |--[Search filters locally]
    |   - No API calls
    |   - Limited to wallet
    |
Backend (Unused!)
    |
    |--[market.trending] ✅ Available but unused
    |--[market.search] ✅ Available but unused
    |--[marketData.getToken] ✅ Available but unused
```

### **Correct Architecture** (✅ What it should be):
```
Frontend "TOP COINS" Tab
    |
    |--[trpc.market.trending.useQuery()]
    |        ↓
    |   Backend fetches trending coins
    |        ↓
    |   DexScreener API
    |        ↓
    |   Returns real market data
    |        ↓
    |   Display popular coins with:
    |   - Real prices
    |   - Real 24h changes
    |   - Trading volume
    |   - All Solana tokens
    |
    |--[Search: trpc.market.search.useQuery(query)]
    |        ↓
    |   Backend searches DexScreener
    |        ↓
    |   Real-time results
    |        ↓
    |   User can discover new tokens
```

---

## 🐛 **Critical Issues List**

### **🔴 Critical (Must Fix):**

1. **"TOP COINS" tab mislabeled**
   - Location: `app/(tabs)/index.tsx` line 552
   - Impact: Users expect market coins, get personal wallet
   - Fix: Either rename tab or fetch real market data

2. **Displays wallet tokens as "top coins"**
   - Location: `app/(tabs)/index.tsx` lines 253-268
   - Impact: Misleading, wrong functionality
   - Fix: Use `trpc.market.trending` endpoint

3. **Search only filters wallet tokens**
   - Location: `app/(tabs)/index.tsx` lines 254-257
   - Impact: Can't discover new tokens
   - Fix: Use `trpc.market.search` for real-time search

4. **Backend market router unused**
   - Impact: Wasted development, users get wrong features
   - Fix: Connect frontend to market endpoints

### **⚠️ High Priority:**

5. **Hardcoded token prices (price: 1)**
   - Location: `hooks/wallet-store.ts` line 83
   - Impact: Wrong price data shown
   - Fix: Already addressed in balance audit

6. **No real-time search**
   - Impact: Poor search UX
   - Fix: Debounced API search with instant results

7. **Trending endpoint is basic**
   - Location: `src/lib/services/marketData.ts` line 40
   - Impact: Just searches "solana"
   - Fix: Implement proper trending logic

### **⚠️ Medium Priority:**

8. **Time filter not functional**
   - Location: Lines 238-246
   - Impact: UI button exists but does nothing
   - Fix: Connect to backend with period parameter

9. **No token details page**
   - Impact: Can't see detailed token info
   - Fix: Add navigation to token details

10. **No loading states for search**
    - Impact: Poor UX during search
    - Fix: Add loading indicators

---

## ✅ **What's Working**

### **✅ Good Implementations:**

1. **Search UI/UX**
   - ✅ Clean search bar design
   - ✅ Clear placeholder text
   - ✅ Real-time typing (local filter)

2. **Backend Infrastructure**
   - ✅ DexScreener integration
   - ✅ Caching for performance
   - ✅ Market router with endpoints
   - ✅ Error handling

3. **Time Filter UI**
   - ✅ Cycle button (1d, 7d, 1m, 1y)
   - ✅ Visual feedback
   - ⚠️ Not connected to data yet

---

## 🔧 **Recommended Fixes**

### **Immediate Actions** (Critical):

#### **1. Fix "TOP COINS" Tab - Use Real Market Data**

**Update `app/(tabs)/index.tsx`:**
```typescript
// ✅ ADD: Query for trending coins
const { data: trendingCoins, isLoading: trendingLoading } = 
  trpc.market.trending.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

// Transform trending data
const topCoins = trendingCoins?.pairs?.slice(0, 20).map(pair => ({
  id: pair.pairAddress,
  symbol: pair.baseToken.symbol,
  name: pair.baseToken.name,
  price: parseFloat(pair.priceUsd || '0'),
  change24h: parseFloat(pair.priceChange.h24 || '0'),
  volume24h: parseFloat(pair.volume.h24 || '0'),
  logo: pair.info?.imageUrl,
  liquidity: parseFloat(pair.liquidity?.usd || '0'),
})) || [];

// In render:
case 'coins':
  return (
    <View style={styles.tabContent}>
      {trendingLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <>
          {/* Search */}
          {/* Display topCoins instead of tokens */}
          {topCoins
            .filter(coin => 
              coin.symbol.toLowerCase().includes(coinsSearchQuery.toLowerCase()) ||
              coin.name.toLowerCase().includes(coinsSearchQuery.toLowerCase())
            )
            .map(coin => (
              <TokenCard
                key={coin.id}
                symbol={coin.symbol}
                name={coin.name}
                price={coin.price}      // ✅ Real price
                change={coin.change24h}  // ✅ Real change
                volume={coin.volume24h}  // ✅ Real volume
                logo={coin.logo}
              />
            ))
          }
        </>
      )}
    </View>
  );
```

#### **2. Implement Real-Time Market Search**

**Add search query with debouncing:**
```typescript
// ✅ ADD: Debounced search query
const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearchQuery(coinsSearchQuery);
  }, 300); // Debounce 300ms
  
  return () => clearTimeout(timer);
}, [coinsSearchQuery]);

// ✅ ADD: Market search query
const { data: searchResults, isLoading: searchLoading } = 
  trpc.market.search.useQuery(
    { q: debouncedSearchQuery },
    {
      enabled: debouncedSearchQuery.length > 2, // Only search if 3+ chars
      refetchInterval: false, // Don't auto-refresh search
    }
  );

// Display search results or trending coins
const displayCoins = debouncedSearchQuery.length > 2 
  ? (searchResults?.pairs || []).map(pair => ({...})) // Search results
  : topCoins; // Trending coins
```

#### **3. Rename Tab or Add "My Tokens" Tab**

**Option A: Rename existing tab**
```typescript
// Change "TOP COINS" to "MARKET" or "TRENDING"
<Text>TRENDING</Text>
```

**Option B: Add separate "My Tokens" tab**
```typescript
const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'traders' | 'copy'>('market');

// Add "PORTFOLIO" tab to show user's tokens
```

#### **4. Improve Trending Endpoint**

**Update `src/lib/services/marketData.ts`:**
```typescript
async trending() {
  const key = 'trending';
  const cached = this.cache.get(key);
  if (cached) return cached;

  // ✅ Search for popular Solana tokens
  const queries = ['SOL', 'USDC', 'BONK', 'WIF', 'JUP'];
  const results = await Promise.all(
    queries.map(q => this.search(q))
  );

  // Combine and sort by volume
  const allPairs = results.flatMap(r => r.pairs || []);
  const sorted = allPairs.sort((a, b) => 
    parseFloat(b.volume?.h24 || '0') - parseFloat(a.volume?.h24 || '0')
  );

  const trending = { pairs: sorted.slice(0, 50) };
  this.cache.set(key, trending, 300); // Cache 5 minutes
  return trending;
}
```

---

## 📝 **Implementation Plan**

### **Phase 1: Critical Fixes** (2-3 hours)
1. ✅ Add `trpc.market.trending` query to home screen
2. ✅ Display real market coins instead of wallet tokens
3. ✅ Implement debounced real-time search
4. ✅ Add loading states

### **Phase 2: Enhanced Features** (2-3 hours)
5. ✅ Improve trending endpoint logic
6. ✅ Add "My Tokens" separate tab
7. ✅ Connect time filter to backend
8. ✅ Add token details navigation

### **Phase 3: Polish** (1-2 hours)
9. ✅ Add search result highlights
10. ✅ Improve empty states
11. ✅ Add pull-to-refresh
12. ✅ Error handling improvements

---

## 📊 **Expected Improvements**

### **After Fixes:**

| Feature | Before | After |
|---------|--------|-------|
| **Tab Name** | "TOP COINS" (misleading) ❌ | "TRENDING" or "MARKET" ✅ |
| **Data Source** | User's wallet tokens ❌ | Real market data ✅ |
| **Coin Count** | 3-5 (user's tokens) ❌ | 20-50 trending coins ✅ |
| **Prices** | Hardcoded (1) ❌ | Real from DexScreener ✅ |
| **Search Scope** | User's wallet only ❌ | Entire Solana market ✅ |
| **Real-Time Search** | No API calls ❌ | Debounced API search ✅ |
| **Discovery** | Can't find new tokens ❌ | Full market discovery ✅ |

---

## 🎯 **Summary**

### **Current State:**
- ❌ **TOP COINS**: Shows wallet tokens (wrong!)
- ❌ **Search**: Only filters wallet tokens
- ⚠️ **Backend**: Has market endpoints but unused

### **Issues Count:**
- 🔴 **Critical**: 4 issues
- ⚠️ **High**: 3 issues
- ⚠️ **Medium**: 3 issues
- **Total**: 10 issues found

### **Action Required:**
1. **Immediate**: Connect frontend to market.trending
2. **Immediate**: Implement real-time market search
3. **Short-term**: Rename tab or add portfolio tab
4. **Short-term**: Improve trending logic

---

## ✅ **After All Fixes:**

**Working Flow:**
1. ✅ User opens "TRENDING" tab
2. ✅ App fetches real trending Solana tokens from DexScreener
3. ✅ Displays top 20 coins with real prices and 24h changes
4. ✅ User searches "BONK"
5. ✅ App queries DexScreener API in real-time
6. ✅ Results appear instantly with real market data
7. ✅ User can discover and track any Solana token

**Benefits:**
- ✅ Accurate tab labeling
- ✅ Real market discovery
- ✅ Real-time search
- ✅ Better UX
- ✅ Trust from users

---

**Status**: Ready for immediate implementation! 🚀
