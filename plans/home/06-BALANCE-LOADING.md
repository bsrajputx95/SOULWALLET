# Balance Loading & Display Audit

## Overview
Audit of how wallet balances are fetched, calculated, and displayed on the home screen.

---

## 1. Balance Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BALANCE DATA FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (wallet-store.ts)                                     │
│      │                                                          │
│      ├─> trpc.portfolio.getOverview ──────────────────────┐     │
│      │       Returns: totalValue, solBalance, solPrice    │     │
│      │                                                    │     │
│      ├─> trpc.portfolio.getPNL ───────────────────────────┤     │
│      │       Returns: netProfit (daily P&L)               │     │
│      │                                                    │     │
│      ├─> trpc.wallet.getTokens ───────────────────────────┤     │
│      │       Returns: SOL balance + SPL tokens            │     │
│      │                                                    │     │
│      └─> trpc.wallet.getTokenMetadata ────────────────────┤     │
│              Returns: symbol, name, logo for tokens       │     │
│                                                           │     │
│  Backend (portfolio.ts)                                   │     │
│      │                                                    │     │
│      ├─> Solana RPC: connection.getBalance() ─────────────┤     │
│      │                                                    │     │
│      ├─> TokenPrice table (cached SOL price) ─────────────┤     │
│      │                                                    │     │
│      └─> DexScreener API (fresh price if stale) ──────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Implementation

### 2.1 Wallet Store (`hooks/wallet-store.ts`)

```typescript
// Portfolio overview for real balance
const overviewQuery = trpc.portfolio.getOverview.useQuery(undefined, {
  refetchInterval: 60000, // Refresh every 60s
});

// Portfolio PnL for profit/loss
const pnlQuery = trpc.portfolio.getPNL.useQuery(
  { period: '1d' },
  { refetchInterval: 300000 } // Refresh every 5 minutes
);

// Get real values from backend
const totalBalance = overviewQuery.data?.totalValue || 0;
const dailyPnl = pnlQuery.data?.netProfit || 0;
const solPrice = overviewQuery.data?.solPrice || 0;
```

### 2.2 Home Screen Display (`app/(tabs)/index.tsx`)

```typescript
const { tokens, totalBalance, dailyPnl, refetch } = useWallet();

// WalletCard component
<WalletCard 
  balance={totalBalance} 
  dailyPnl={dailyPnl} 
  pnlPeriod={pnlPeriod} 
  onPeriodChange={setPnlPeriod} 
/>
```

### 2.3 Solana Wallet Store (`hooks/solana-wallet-store.ts`)

```typescript
// Direct RPC balance fetch
const refreshBalances = async (wallet?: Keypair) => {
  const solBalance = await state.connection.getBalance(currentWallet.publicKey);
  const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;
  
  // Get SPL token balances
  const tokenAccounts = await state.connection.getParsedTokenAccountsByOwner(
    currentWallet.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );
  // ...
};
```

---

## 3. Backend Implementation

### 3.1 Portfolio Overview (`src/server/routers/portfolio.ts`)

```typescript
getOverview: protectedProcedure.query(async ({ ctx }) => {
  const publicKey = new PublicKey(ctx.user.walletAddress);
  
  // Get SOL balance from RPC
  const solBalance = await connection.getBalance(publicKey);
  const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;

  // Get SOL price (cached or fresh)
  let solPrice = 100; // Fallback
  const cachedPrice = await prisma.tokenPrice.findUnique({
    where: { tokenMint: solMint },
  });
  
  if (cachedPrice && cachedPrice.updatedAt > fiveMinutesAgo) {
    solPrice = cachedPrice.priceUSD;
  } else {
    // Fetch from DexScreener
    const tokenData = await marketData.getToken(solMint);
    solPrice = parseFloat(tokenData.pairs[0].priceUsd);
  }
  
  const totalValue = solBalanceFormatted * solPrice;

  // Calculate 24h change from snapshots
  const oldSnapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId: ctx.user.id, timestamp: { gte: oneDayAgo } },
    orderBy: { timestamp: 'asc' },
  });

  let change24h = 0;
  if (oldSnapshot && oldSnapshot.totalValueUSD > 0) {
    change24h = ((totalValue - oldSnapshot.totalValueUSD) / oldSnapshot.totalValueUSD) * 100;
  }

  return { totalValue, solBalance, solPrice, change24h };
});
```

---

## 4. Issues Found

### 🔴 Critical Issues

#### 4.1 No Wallet Address = Silent Failure
```typescript
if (!ctx.user.walletAddress) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'No wallet address found',
  });
}
```
**ISSUE**: User sees error instead of prompt to connect wallet

**FIX**: Return zero balance with flag:
```typescript
if (!ctx.user.walletAddress) {
  return {
    totalValue: 0,
    solBalance: 0,
    solPrice: 0,
    walletConnected: false,
  };
}
```

#### 4.2 SPL Tokens Not Included in Total Value
```typescript
const totalValue = solBalanceFormatted * solPrice;
// Only SOL is counted!
```

**FIX**: Add SPL token values:
```typescript
// Get SPL token balances
const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
  programId: TOKEN_PROGRAM_ID,
});

let splValue = 0;
for (const account of tokenAccounts.value) {
  const info = account.account.data.parsed.info;
  const tokenPrice = await getTokenPrice(info.mint);
  splValue += info.tokenAmount.uiAmount * tokenPrice;
}

const totalValue = (solBalanceFormatted * solPrice) + splValue;
```

### 🟠 High Priority Issues

#### 4.3 Hardcoded Fallback Price
```typescript
let solPrice = 100; // Default fallback price
```
**ISSUE**: If all price sources fail, shows wildly incorrect balance

**FIX**: 
1. Use last known price from database
2. Show "price unavailable" warning
3. Don't show USD value if price unknown

#### 4.4 24h Change Requires Snapshots
```typescript
const oldSnapshot = await prisma.portfolioSnapshot.findFirst({
  where: { userId: ctx.user.id, timestamp: { gte: oneDayAgo } },
});
```
**ISSUE**: New users have no snapshots, always shows 0% change

**FIX**: Create snapshot on first balance fetch

#### 4.5 Refresh Intervals Not Synced
```typescript
// wallet-store.ts
overviewQuery: refetchInterval: 60000  // 1 minute
pnlQuery: refetchInterval: 300000      // 5 minutes
tokensQuery: refetchInterval: 60000    // 1 minute
```
**ISSUE**: Balance and P&L can be out of sync

**FIX**: Use same interval or trigger together

### 🟡 Medium Priority Issues

#### 4.6 No Loading State Coordination
```typescript
isLoading: overviewQuery.isLoading || pnlQuery.isLoading || tokensQuery.isLoading
```
**ISSUE**: Shows loading if ANY query is loading, even on background refresh

**FIX**: Distinguish initial load from background refresh:
```typescript
const isInitialLoading = overviewQuery.isLoading && !overviewQuery.data;
const isRefreshing = overviewQuery.isFetching && overviewQuery.data;
```

#### 4.7 RPC Failover Not Used for Balance
```typescript
// solana-wallet-store.ts has RPC failover
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  // ...
];

// But portfolio.ts uses single endpoint
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
```

**FIX**: Share RPC failover logic between frontend and backend

---

## 5. WalletCard Component Analysis

### Current Props
```typescript
interface WalletCardProps {
  balance: number;
  dailyPnl: number;
  pnlPeriod: '1d' | '7d' | '30d' | '1y';
  onPeriodChange: (period: '1d' | '7d' | '30d' | '1y') => void;
}
```

### Missing Features
1. **Loading skeleton** - Show placeholder while loading
2. **Error state** - Show retry button on failure
3. **Price staleness indicator** - Warn if price is old
4. **Refresh button** - Manual refresh option
5. **Currency toggle** - USD/SOL display option

---

## 6. Performance Optimization

### Current Issues
1. **Multiple RPC calls** - Balance fetched in multiple places
2. **No request deduplication** - Same data fetched by different components
3. **No optimistic updates** - UI waits for server response

### Recommended Improvements

#### 6.1 Centralized Balance Cache
```typescript
// Create a balance service
class BalanceService {
  private cache: Map<string, { balance: number; timestamp: number }> = new Map();
  private TTL = 30000; // 30 seconds

  async getBalance(publicKey: string): Promise<number> {
    const cached = this.cache.get(publicKey);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.balance;
    }
    
    const balance = await this.fetchBalance(publicKey);
    this.cache.set(publicKey, { balance, timestamp: Date.now() });
    return balance;
  }
}
```

#### 6.2 WebSocket for Real-Time Updates
```typescript
// Subscribe to account changes
connection.onAccountChange(publicKey, (accountInfo) => {
  const newBalance = accountInfo.lamports / LAMPORTS_PER_SOL;
  updateBalanceState(newBalance);
});
```

#### 6.3 Optimistic Balance Updates
```typescript
// After sending transaction
const optimisticBalance = currentBalance - amount - fee;
setBalance(optimisticBalance);

// Then verify with RPC
const actualBalance = await refreshBalance();
setBalance(actualBalance);
```

---

## 7. Testing Checklist

### Unit Tests
- [ ] Balance calculation with various SOL amounts
- [ ] Price fetching with cache hit/miss
- [ ] 24h change calculation
- [ ] SPL token value aggregation

### Integration Tests
- [ ] Full balance fetch flow
- [ ] Price cache update
- [ ] Snapshot creation
- [ ] Error handling

### Manual Tests
- [ ] New user with no wallet → shows connect prompt
- [ ] User with SOL only → correct balance
- [ ] User with SOL + tokens → correct total
- [ ] Price API down → graceful degradation
- [ ] RPC down → failover works

---

## 8. Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 | Add SPL tokens to total value | 4hr |
| 🔴 | Handle no wallet gracefully | 1hr |
| 🟠 | Better price fallback | 2hr |
| 🟠 | Create initial snapshot | 1hr |
| 🟠 | Sync refresh intervals | 1hr |
| 🟡 | Add loading states | 2hr |
| 🟡 | Share RPC failover | 2hr |
| 🟡 | WebSocket balance updates | 4hr |
| 🟡 | Optimistic updates | 3hr |

**Total Estimated Effort: ~20 hours**
