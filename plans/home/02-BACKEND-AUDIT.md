# Backend Audit - Home Screen APIs

## Overview
Complete audit of backend services powering the home screen including API endpoints, business logic, data integrity, and security.

---

## 1. Copy Trading Router (`src/server/routers/copyTrading.ts`)

### ✅ Working Correctly

1. **Rate Limiting** - Applied to mutations with `applyRateLimit('strict', ctx.rateLimitContext)`
2. **Input Validation** - Zod schemas validate all inputs
3. **Lock Service** - Uses `LockService.withLock()` for concurrent operations
4. **Ownership Verification** - Checks `userId` before allowing updates/deletes
5. **Budget Validation** - Ensures `amountPerTrade <= totalBudget`

### 🟠 Issues to Address

#### 1.1 getTopTraders Returns Only Featured
```typescript
const traders = await prisma.traderProfile.findMany({
  where: { isFeatured: true },
  orderBy: { featuredOrder: 'asc' },
  take: 10,
});
```
**ISSUE**: If no featured traders exist, returns empty array
**FIX**: Add fallback to top performers by ROI:
```typescript
let traders = await prisma.traderProfile.findMany({
  where: { isFeatured: true },
  orderBy: { featuredOrder: 'asc' },
  take: 10,
});
if (traders.length === 0) {
  traders = await prisma.traderProfile.findMany({
    orderBy: { totalROI: 'desc' },
    take: 10,
  });
}
```

#### 1.2 Missing Trader Creation in startCopying
```typescript
const trader = await prisma.traderProfile.findUnique({
  where: { walletAddress: input.walletAddress },
});
if (!trader) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Trader not found' });
}
```
**ISSUE**: Users can't copy arbitrary wallets - must be pre-registered
**FIX**: Auto-create trader profile if not exists (like in copyTradingService.ts)

#### 1.3 No Budget Check Before Starting
**ISSUE**: User can start copying without having funds
**FIX**: Add balance verification:
```typescript
// Check user has sufficient USDC balance
const userBalance = await getUserUSDCBalance(userId);
if (userBalance < input.totalBudget) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Insufficient USDC balance. Required: ${input.totalBudget}, Available: ${userBalance}`,
  });
}
```

---

## 2. Portfolio Router (`src/server/routers/portfolio.ts`)

### ✅ Working Correctly

1. **Real SOL Balance** - Fetches from Solana RPC
2. **Price Caching** - Uses TokenPrice table with 5-minute TTL
3. **24h Change Calculation** - Uses portfolio snapshots
4. **Snapshot Creation** - Properly stores historical data

### 🟠 Issues to Address

#### 2.1 Hardcoded Fallback SOL Price
```typescript
let solPrice = 100; // Default fallback price
```
**ISSUE**: If price fetch fails, shows incorrect portfolio value
**FIX**: 
1. Use last known price from cache
2. Show warning to user that price may be stale
3. Add price staleness indicator

#### 2.2 getPNL Uses Simple Calculation
```typescript
const grossProfit = totalReceived - totalSent;
const netProfit = grossProfit - totalSwapFees;
```
**ISSUE**: Doesn't account for token price changes
**FIX**: Calculate based on entry/exit prices for swaps

#### 2.3 No SPL Token Support in getOverview
```typescript
// Only SOL balance is fetched
const solBalance = await connection.getBalance(publicKey);
```
**FIX**: Add SPL token balance aggregation

---

## 3. Wallet Router (`src/server/routers/wallet.ts`)

### ✅ Working Correctly

1. **Signature Verification** - Uses tweetnacl for wallet linking
2. **Token Metadata** - Caches common tokens, fetches unknown
3. **Transaction Recording** - Verifies on-chain before recording
4. **Fee Estimation** - Calculates real network fees

### 🔴 Critical Issue

#### 3.1 Send Endpoint Commented Out
```typescript
/* 
send: protectedProcedure
  ...
*/
```
**STATUS**: Intentionally disabled - frontend uses client-side signing
**VERIFICATION NEEDED**: Ensure `recordTransaction` is called after client-side sends

### 🟠 Issues

#### 3.2 getTokens Returns All Non-Zero Tokens
```typescript
.filter(t => t.balance > 0);
```
**ISSUE**: Could return hundreds of spam tokens
**FIX**: Add whitelist or minimum value filter

#### 3.3 Token Metadata Cache is In-Memory
```typescript
const tokenMetadataCache: Record<string, ...> = { ... };
```
**ISSUE**: Lost on server restart
**FIX**: Move to Redis or database

---

## 4. Traders Router (`src/server/routers/traders.ts`)

### ✅ Working Correctly

1. **Birdeye Integration** - Fetches real PnL data
2. **Caching** - 5-minute cache for trader data
3. **Search** - Supports username and wallet address search

### 🟠 Issues

#### 4.1 Birdeye API Key Dependency
```typescript
private apiKey = process.env.BIRDEYE_API_KEY || '';
```
**ISSUE**: Empty string if not configured = silent failures
**FIX**: Throw error on startup if not configured

#### 4.2 No Rate Limiting on Birdeye Calls
**ISSUE**: Could hit Birdeye rate limits
**FIX**: Add request throttling

---

## 5. Market Router (Referenced but not shown)

### Verification Needed
- `trpc.market.trending` - Used in home screen
- `trpc.market.search` - Used for coin search

---

## 6. Security Audit

### ✅ Good Practices
1. All mutations use `protectedProcedure` (requires auth)
2. Rate limiting on sensitive operations
3. Input validation with Zod
4. Ownership checks before modifications

### 🟠 Improvements Needed

#### 6.1 Add Request Logging
```typescript
// Add to all mutations
logger.info('Copy trade started', {
  userId: ctx.user.id,
  traderId: trader.id,
  amount: input.totalBudget,
});
```

#### 6.2 Add Audit Trail
Create `AuditLog` model for sensitive operations:
- Copy trade start/stop
- Position close
- Settings changes

---

## 7. Data Integrity

### ✅ Good Practices
1. Unique constraints on `userId_traderId` for CopyTrading
2. Cascade deletes properly configured
3. Indexes on frequently queried fields

### 🟠 Issues

#### 7.1 No Foreign Key on ExecutionQueue
```typescript
userId          String
copyTradingId   String
```
**ISSUE**: No relation defined, orphan records possible
**FIX**: Add proper relations in schema

#### 7.2 Position Status is String, Not Enum
```typescript
status          String   @default("OPEN")
```
**FIX**: Create enum for type safety:
```prisma
enum PositionStatus {
  OPEN
  CLOSED
  PENDING
  FAILED
}
```

---

## 8. Action Items Summary

| Priority | Issue | File | Effort |
|----------|-------|------|--------|
| 🔴 | Auto-create trader profile | copyTrading.ts | 1hr |
| 🔴 | Add balance check before copy | copyTrading.ts | 2hr |
| 🟠 | Fallback for empty featured traders | copyTrading.ts | 30min |
| 🟠 | Better SOL price fallback | portfolio.ts | 1hr |
| 🟠 | SPL token support in overview | portfolio.ts | 3hr |
| 🟠 | Token spam filtering | wallet.ts | 1hr |
| 🟠 | Birdeye rate limiting | traders.ts | 2hr |
| 🟡 | Request logging | All routers | 2hr |
| 🟡 | Audit trail model | schema.prisma | 3hr |
| 🟡 | Position status enum | schema.prisma | 1hr |

**Total Estimated Effort: ~16 hours**
