# Market Tab Backend Audit

## File: `src/server/routers/market.ts`

### Current Endpoints

#### 1. `getToken` ✅ Good
```typescript
getToken: protectedProcedure
  .input(z.object({ address: z.string().min(10) }))
  .query(async ({ input }) => {
    return await marketData.getToken(input.address);
  })
```
- Proper validation
- Error handling
- Uses marketData service

#### 2. `search` ✅ Good with Issues
```typescript
search: protectedProcedure
  .input(z.object({ 
    q: z.string().min(1), 
    limit: z.number().min(1).max(50).optional(), 
    cursor: z.number().min(0).optional() 
  }))
```
**Issues**:
- `q` requires min 1 char - should allow empty for "all"
- Pagination implemented but cursor is number (should be string for consistency)

#### 3. `trending` ✅ Good
- Returns popular tokens
- Cached for 5 minutes

#### 4. `soulMarket` ✅ Good
- Quality filters applied
- Solana-only
- Cached for 5 minutes

### Missing Endpoints

#### 1. `getTokenDetails` - NEEDED
For coin detail page with full data:
- Price history
- Holder distribution
- Recent transactions
- Social links

#### 2. `getTokenChart` - NEEDED
For price chart data:
- OHLCV data
- Multiple timeframes

#### 3. `getTokenHolders` - NEEDED
For holders tab:
- Top holders
- Holder distribution

#### 4. `getTokenTransactions` - NEEDED
For trades tab:
- Recent buys/sells
- Whale transactions

---

## File: `src/lib/services/marketData.ts`

### Current Implementation

#### 1. Caching ✅ Good
```typescript
private cache = new NodeCache({ stdTTL: 30 });
```
- 30 second default TTL
- 5 minute TTL for soulMarket

#### 2. DexScreener Integration ✅ Good
```typescript
private base = 'https://api.dexscreener.com/latest';
```

#### 3. Quality Filters ✅ Good
```typescript
// Filter 1: Minimum liquidity $100,000
// Filter 2: Minimum pair age 4 hours
// Filter 3: Minimum 24h volume $10,000
// Filter 4: Minimum 24h transactions (50+)
// Filter 5: Must have valid price
// Filter 6: Solana chain only
// Filter 7: Minimum FDV $50k
```

### Issues Found

#### 1. Limited Search Terms
```typescript
const searchTerms = [
  'SOL', 'BONK', 'WIF', 'JUP', 'PYTH', 'JTO', 'RNDR', 'RAY',
  'ORCA', 'STEP', 'SAMO', 'FIDA', 'MNGO', 'COPE'
];
```
**Issue**: Only searches predefined tokens, misses new/trending tokens

#### 2. No User Filter Support
- Filters are hardcoded
- No way to pass user-defined filters

#### 3. Rate Limiting Not Handled
- No exponential backoff
- No request queuing

#### 4. Missing Data Sources
- Only DexScreener
- No Birdeye integration
- No Jupiter price data

---

## File: `src/server/routers/swap.ts`

### Current Implementation ✅ Mostly Good

#### 1. `getQuote` ✅ Good
- Jupiter API integration
- Proper slippage handling

#### 2. `swap` ⚠️ Simulation Only
```typescript
// For now, create a simulated transaction
const signature = `sim_${Date.now()}_...`;
```
**Issue**: Not executing real swaps

#### 3. `getSupportedTokens` ⚠️ Hardcoded
```typescript
const supportedTokens = [
  { mint: 'SOL', ... },
  { mint: 'EPjFWdd5...', symbol: 'USDC', ... },
  { mint: 'Es9vMFrz...', symbol: 'USDT', ... },
];
```
**Issue**: Should fetch from Jupiter token list

#### 4. `getSwapHistory` ✅ Good
- Proper pagination
- User-scoped

---

## Recommended Backend Fixes

### P0 - Critical
1. Add `getTokenDetails` endpoint for coin page
2. Enable real swap execution (with feature flag)
3. Add user-defined filter support to soulMarket

### P1 - High
4. Add `getTokenChart` endpoint
5. Add `getTokenTransactions` endpoint
6. Fetch supported tokens from Jupiter

### P2 - Medium
7. Add rate limiting/backoff
8. Add Birdeye as backup data source
9. Improve search to include trending tokens

### P3 - Low
10. Add WebSocket for real-time prices
11. Add price alerts backend
12. Add token comparison endpoint

---

## API Response Schemas

### Proposed `getTokenDetails` Response
```typescript
interface TokenDetails {
  // Basic Info
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  
  // Price Data
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  
  // Market Data
  marketCap: number;
  fdv: number;
  volume24h: number;
  liquidity: number;
  
  // Token Info
  totalSupply: number;
  circulatingSupply: number;
  holders: number;
  
  // Metadata
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  
  // Verification
  verified: boolean;
  pairAge: number; // hours
}
```

### Proposed `getTokenChart` Response
```typescript
interface ChartData {
  timeframe: '1h' | '4h' | '1d' | '1w' | '1m';
  data: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}
```
