# Copy Trading Deep Dive - Core Mechanics Audit

## Overview
This is the flagship feature of SoulWallet. This document provides a comprehensive audit of the entire copy trading flow from user setup to trade execution.

---

## 1. Copy Trading Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COPY TRADING FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. USER SETUP                                                      │
│     └─> Frontend: Copy Modal → startCopying mutation                │
│         └─> Creates CopyTrading record                              │
│         └─> Creates/Updates MonitoredWallet                         │
│         └─> Updates TraderProfile follower count                    │
│                                                                     │
│  2. TRANSACTION MONITORING                                          │
│     └─> transactionMonitor.ts: WebSocket to Helius                  │
│         └─> Detects Jupiter swaps from monitored wallets            │
│         └─> Creates DetectedTransaction record                      │
│         └─> Triggers copy trades for all active copiers             │
│                                                                     │
│  3. TRADE EXECUTION                                                 │
│     └─> executionQueue.ts: Bull queue processing                    │
│         └─> BUY: Get Jupiter quote → Execute swap → Create Position │
│         └─> SELL: Get quote → Execute swap → Update Position        │
│                                                                     │
│  4. POSITION MONITORING                                             │
│     └─> priceMonitor.ts: Polls prices every 5 seconds               │
│         └─> Checks SL/TP conditions                                 │
│         └─> Triggers sell orders when conditions met                │
│                                                                     │
│  5. PROFIT SHARING                                                  │
│     └─> profitSharing.ts: On position close                         │
│         └─> Calculate 5% of profit                                  │
│         └─> Transfer to trader wallet                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component-by-Component Audit

### 2.1 Transaction Monitor (`src/lib/services/transactionMonitor.ts`)

#### ✅ Working Correctly
- WebSocket connection to Helius
- Automatic reconnection on disconnect
- Monitored wallet refresh every 5 minutes
- Jupiter swap detection
- Detected transaction storage

#### 🔴 Critical Issues

##### 2.1.1 No Wallet Keypair for Copiers
```typescript
// In triggerCopyTrades, we add to queue but execution needs wallet
await executionQueue.addBuyOrder({
  userId: copyRelation.userId,
  copyTradingId: copyRelation.id,
  tokenMint: parsed.tokenMint,
  amount: copyRelation.amountPerTrade,
  detectedTxId,
});
```
**ISSUE**: The execution queue needs the user's wallet keypair to sign transactions, but we only pass userId.

**FIX REQUIRED**: 
1. Store encrypted wallet keys server-side (security concern)
2. OR use a custodial solution
3. OR implement a signing service

##### 2.1.2 Token Symbol Not Fetched
```typescript
return {
  ...
  tokenSymbol: undefined, // Would need to fetch from token registry
  ...
};
```
**FIX**: Fetch from Jupiter token list or Metaplex

##### 2.1.3 Price Not Calculated
```typescript
price: 0, // Would need to calculate from swap data
totalValue: 0, // Would need to calculate
```
**FIX**: Parse Jupiter swap instruction data for amounts

#### 🟠 High Priority Issues

##### 2.1.4 Single WebSocket Connection
**ISSUE**: If Helius WebSocket fails, all monitoring stops
**FIX**: Add redundant connection or polling fallback

##### 2.1.5 No Duplicate Transaction Check
```typescript
// Could process same transaction twice if WebSocket reconnects
```
**FIX**: Check `DetectedTransaction` before processing

---

### 2.2 Execution Queue (`src/lib/services/executionQueue.ts`)

#### ✅ Working Correctly
- Bull queue with retry logic (3 attempts, exponential backoff)
- Separate queues for BUY and SELL
- Priority support
- Database record keeping

#### 🔴 Critical Issues

##### 2.2.1 STUB WALLET - CANNOT EXECUTE REAL TRADES
```typescript
// Line 85-86 in BUY processor
const userWalletAddress = await walletService.getUserWalletAddress(userId);
// Fallback stub wallet for compilation/runtime safety
const userWallet = Keypair.generate();
```
**THIS IS THE MOST CRITICAL BUG** - Every trade uses a random new wallet!

**FIX REQUIRED**:
```typescript
// Option 1: Server-side wallet (requires secure key storage)
const userWallet = await walletService.getUserKeypair(userId);
if (!userWallet) {
  throw new Error('User wallet not configured for copy trading');
}

// Option 2: Custodial wallet per user
const custodialWallet = await getCustodialWallet(userId);

// Option 3: User must pre-sign transactions (complex)
```

##### 2.2.2 Same Issue in SELL Processor
```typescript
// Line 140-141
const userWallet = Keypair.generate(); // STUB!
```

#### 🟠 High Priority Issues

##### 2.2.3 No Balance Check Before Buy
```typescript
// Should verify user has USDC before attempting swap
const userBalance = await getUSDCBalance(userWallet.publicKey);
if (userBalance < amount) {
  throw new Error('Insufficient USDC balance');
}
```

##### 2.2.4 Hardcoded Token Decimals
```typescript
amount: amount * Math.pow(10, 9), // Assuming 9 decimals for most tokens
```
**FIX**: Fetch actual decimals from token metadata

##### 2.2.5 No Slippage from User Settings
```typescript
slippageBps: 100, // 1% slippage - hardcoded
```
**FIX**: Use `copyTrading.maxSlippage` from user settings

---

### 2.3 Price Monitor (`src/lib/services/priceMonitor.ts`)

#### ✅ Working Correctly
- 5-second polling interval
- Price caching (4 seconds)
- SL/TP condition checking
- Database price cache updates

#### 🟠 Issues

##### 2.3.1 No Position Lock During Check
```typescript
// Multiple price checks could trigger same position
const triggered = await this.checkPosition(position, currentPrice);
```
**FIX**: Add position-level locking:
```typescript
const lockKey = `position-check:${position.id}`;
await LockService.withLock(lockKey, async () => {
  // Check and trigger
});
```

##### 2.3.2 Exit With Trader Not Fully Implemented
```typescript
async handleTraderSell(detectedTxId: string) {
  // This is called but needs to be triggered from transactionMonitor
}
```
**FIX**: Ensure transactionMonitor calls this for SELL transactions

---

### 2.4 Copy Trading Service (`src/services/copyTradingService.ts`)

#### ✅ Working Correctly
- Upsert settings with validation
- Performance calculation
- Top traders query
- SL/TP checking

#### 🟠 Issues

##### 2.4.1 executeCopyTrade Uses WalletService.swapTokens
```typescript
const swapResult = await WalletService.swapTokens({
  userId: setting.userId,
  fromMint: tokenIn,
  toMint: tokenOut,
  amount: tradeAmount,
  slippage: 0.5
});
```
**VERIFICATION NEEDED**: Check if WalletService.swapTokens has same wallet issue

##### 2.4.2 No Concurrent Trade Limit
**FIX**: Add check for max concurrent positions per user

---

## 3. Data Flow Verification

### 3.1 CopyTrading Record
```prisma
model CopyTrading {
  id            String   @id
  userId        String
  traderId      String
  isActive      Boolean  @default(true)
  totalBudget   Float
  amountPerTrade Float
  stopLoss      Float?
  takeProfit    Float?
  maxSlippage   Float    @default(0.5)
  exitWithTrader Boolean @default(false)
  totalCopied   Int      @default(0)
  activeTrades  Int      @default(0)
  totalProfit   Float    @default(0)
  totalFeesPaid Float    @default(0)
}
```
✅ Schema looks complete

### 3.2 Position Record
```prisma
model Position {
  id              String
  copyTradingId   String
  tokenMint       String
  tokenSymbol     String
  entryTxHash     String
  entryPrice      Float
  entryAmount     Float
  entryValue      Float
  exitTxHash      String?
  exitPrice       Float?
  profitLoss      Float?
  feeAmount       Float?
  feeTxHash       String?
  status          String   @default("OPEN")
}
```
✅ Schema looks complete

---

## 4. Critical Path Testing Checklist

### Setup Phase
- [ ] User can start copying a trader
- [ ] CopyTrading record created correctly
- [ ] MonitoredWallet created/updated
- [ ] TraderProfile follower count incremented

### Detection Phase
- [ ] WebSocket connects to Helius
- [ ] Trader swap detected
- [ ] DetectedTransaction created
- [ ] Copy orders queued for all copiers

### Execution Phase
- [ ] ⚠️ User wallet retrieved (CURRENTLY BROKEN)
- [ ] Jupiter quote obtained
- [ ] Swap executed on-chain
- [ ] Position record created
- [ ] CopyTrading stats updated

### Monitoring Phase
- [ ] Price monitor running
- [ ] SL condition triggers sell
- [ ] TP condition triggers sell
- [ ] Exit with trader triggers sell

### Closing Phase
- [ ] Position closed correctly
- [ ] P&L calculated
- [ ] Profit sharing executed (if profit)
- [ ] Stats updated

---

## 5. Action Items

| Priority | Issue | Component | Effort |
|----------|-------|-----------|--------|
| 🔴 BLOCKER | Stub wallet in executionQueue | executionQueue.ts | 8hr |
| 🔴 BLOCKER | Stub wallet in profitSharing | profitSharing.ts | 4hr |
| 🔴 | Token symbol/price not parsed | transactionMonitor.ts | 4hr |
| 🟠 | WebSocket redundancy | transactionMonitor.ts | 4hr |
| 🟠 | Balance check before buy | executionQueue.ts | 2hr |
| 🟠 | Use user's slippage setting | executionQueue.ts | 1hr |
| 🟠 | Position locking | priceMonitor.ts | 2hr |
| 🟡 | Duplicate transaction check | transactionMonitor.ts | 1hr |
| 🟡 | Concurrent position limit | copyTradingService.ts | 2hr |

**Total Estimated Effort: ~28 hours**

---

## 6. Recommended Architecture Change

### Current Problem
Server needs user's private key to sign transactions, which is a security risk.

### Recommended Solutions (in order of preference)

#### Option A: Custodial Wallets (Simplest)
- Create a custodial wallet for each user on signup
- Store encrypted keys server-side with HSM
- User deposits funds to custodial wallet for copy trading
- Pros: Simple, reliable
- Cons: Custodial risk, regulatory concerns

#### Option B: Smart Contract Delegation
- User approves a smart contract to trade on their behalf
- Contract enforces limits (budget, per-trade amount)
- Pros: Non-custodial, transparent
- Cons: Complex, gas costs

#### Option C: Pre-Signed Transactions
- When trader makes a trade, generate unsigned transactions for copiers
- Push to copiers' devices for signing
- Pros: Fully non-custodial
- Cons: Latency, user must be online

**RECOMMENDATION**: Start with Option A for MVP, migrate to Option B for production.
