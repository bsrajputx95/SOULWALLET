# Stop Loss, Take Profit & Exit With Trader - Logic Audit

## Overview
This document audits the automated position management features: Stop Loss (SL), Take Profit (TP), and Exit With Trader functionality.

---

## 1. Stop Loss & Take Profit Implementation

### 1.1 User Settings Storage
```prisma
model CopyTrading {
  stopLoss      Float?   // Negative percentage, e.g., -10 for 10% loss
  takeProfit    Float?   // Positive percentage, e.g., 30 for 30% gain
  exitWithTrader Boolean @default(false)
}
```

### 1.2 Frontend Input (`app/(tabs)/index.tsx`)
```typescript
<View style={styles.inputSection}>
  <Text style={styles.inputLabel}>Stop Loss (%)</Text>
  <TextInput
    placeholder="10"
    value={stopLoss}
    onChangeText={setStopLoss}
    keyboardType="numeric"
  />
</View>

<View style={styles.inputSection}>
  <Text style={styles.inputLabel}>Take Profit (%)</Text>
  <TextInput
    placeholder="30"
    value={takeProfit}
    onChangeText={setTakeProfit}
    keyboardType="numeric"
  />
</View>
```

### 1.3 Backend Validation (`src/server/routers/copyTrading.ts`)
```typescript
startCopying: protectedProcedure
  .input(z.object({
    stopLoss: z.number().min(-100).max(0).optional(),
    takeProfit: z.number().positive().max(1000).optional(),
  }))
```

### 1.4 Price Monitor Check (`src/lib/services/priceMonitor.ts`)
```typescript
private async checkPosition(
  position: PositionWithSettings,
  currentPrice: number
): Promise<{ position: PositionWithSettings; reason: string } | null> {
  // Calculate current P&L percentage
  const plPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
  
  const { stopLoss, takeProfit } = position.copyTrading;

  // Check Stop Loss
  if (stopLoss !== null && plPercent <= stopLoss) {
    logger.info(`🔴 Stop Loss triggered for position ${position.id}`);
    return { position, reason: 'STOP_LOSS' };
  }

  // Check Take Profit
  if (takeProfit !== null && plPercent >= takeProfit) {
    logger.info(`🟢 Take Profit triggered for position ${position.id}`);
    return { position, reason: 'TAKE_PROFIT' };
  }

  return null;
}
```

---

## 2. Issues Found

### 🔴 Critical Issues

#### 2.1 Stop Loss Sign Convention Mismatch
**Frontend:**
```typescript
stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
// User enters "10" for 10% stop loss
```

**Backend Validation:**
```typescript
stopLoss: z.number().min(-100).max(0).optional(),
// Expects negative number like -10
```

**Price Monitor:**
```typescript
if (stopLoss !== null && plPercent <= stopLoss) {
// If stopLoss = -10 and plPercent = -15, this triggers correctly
// But if stopLoss = 10 (positive), it would trigger immediately!
```

**FIX REQUIRED** in frontend:
```typescript
await createCopyTrade({
  stopLoss: stopLoss ? -Math.abs(parseFloat(stopLoss)) : undefined,
  // Always convert to negative
});
```

✅ **VERIFIED**: Frontend already does this:
```typescript
stopLoss: input.stopLoss ? -Math.abs(input.stopLoss) : undefined,
```

#### 2.2 No Position Lock During SL/TP Check
```typescript
// Multiple price checks could trigger same position
for (const position of positions) {
  const triggered = await this.checkPosition(position, currentPrice);
  if (triggered) {
    triggeredPositions.push(triggered);
  }
}
```

**ISSUE**: If price monitor runs twice quickly, same position could be sold twice

**FIX**:
```typescript
// Add to Position model
model Position {
  slTpTriggeredAt DateTime?  // Lock flag
}

// In checkPosition
if (position.slTpTriggeredAt) {
  return null; // Already being processed
}

// Before triggering
await prisma.position.update({
  where: { id: position.id },
  data: { slTpTriggeredAt: new Date() }
});
```

### 🟠 High Priority Issues

#### 2.3 Price Check Interval May Miss Rapid Moves
```typescript
private checkIntervalMs = 5000; // Check every 5 seconds
```

**ISSUE**: In volatile markets, price could spike past TP and back down in 5 seconds

**FIX OPTIONS**:
1. Reduce interval to 1-2 seconds (more API calls)
2. Use WebSocket price feeds
3. Set limit orders on-chain instead of monitoring

#### 2.4 No Trailing Stop Loss
**FEATURE GAP**: Users may want trailing SL that moves up with price

#### 2.5 SL/TP Based on Entry Price Only
```typescript
const plPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
```

**ISSUE**: Doesn't account for fees, slippage, or partial fills

**FIX**: Use actual entry value:
```typescript
const currentValue = position.entryAmount * currentPrice;
const plPercent = ((currentValue - position.entryValue) / position.entryValue) * 100;
```

---

## 3. Exit With Trader Implementation

### 3.1 User Setting
```typescript
exitWithTrader: z.boolean().default(false),
```

### 3.2 Transaction Monitor Detection
```typescript
// In parseJupiterSwap
const isBuy = firstTransfer.fromUserAccount === walletAddress;
return {
  type: isBuy ? 'BUY' : 'SELL',
  // ...
};
```

### 3.3 Trigger Copy Sells
```typescript
// In triggerCopyTrades
} else if (parsed.type === 'SELL' && copyRelation.exitWithTrader) {
  // Find open positions for this token
  const positions = await prisma.position.findMany({
    where: {
      copyTradingId: copyRelation.id,
      tokenMint: parsed.tokenMint,
      status: 'OPEN',
    },
  });

  for (const position of positions) {
    await executionQueue.addSellOrder({
      userId: copyRelation.userId,
      copyTradingId: copyRelation.id,
      positionId: position.id,
      tokenMint: parsed.tokenMint,
      amount: position.entryAmount,
      reason: 'TRADER_SOLD',
    });
  }
}
```

### 3.4 Price Monitor Handler
```typescript
async handleTraderSell(detectedTxId: string) {
  const tx = await prisma.detectedTransaction.findUnique({
    where: { id: detectedTxId },
    include: { monitoredWallet: { include: { trader: true } } },
  });

  if (!tx || tx.type !== 'SELL') return;

  const positions = await prisma.position.findMany({
    where: {
      tokenMint: tx.tokenMint,
      status: 'OPEN',
      copyTrading: {
        trader: { walletAddress: tx.monitoredWallet.walletAddress },
        exitWithTrader: true,
      },
    },
  });

  for (const position of positions) {
    await executionQueue.addSellOrder({
      // ...
      reason: 'TRADER_SOLD',
    });
  }
}
```

---

## 4. Issues with Exit With Trader

### 🟠 High Priority Issues

#### 4.1 Duplicate Sell Orders
**ISSUE**: Both `triggerCopyTrades` and `handleTraderSell` could queue sells for same position

**FIX**: Remove duplicate logic, use only one path:
```typescript
// In transactionMonitor.ts triggerCopyTrades
if (parsed.type === 'SELL') {
  // Let priceMonitor.handleTraderSell handle this
  await priceMonitor.handleTraderSell(detectedTx.id);
  return;
}
```

#### 4.2 Partial Sells Not Handled
**ISSUE**: If trader sells 50% of position, copier sells 100%

**FIX**: Calculate proportional sell:
```typescript
const traderSellPercent = parsed.amount / traderTotalHolding;
const copierSellAmount = position.entryAmount * traderSellPercent;
```

#### 4.3 No Confirmation of Trader Intent
**ISSUE**: Trader might be rebalancing, not exiting

**CONSIDERATION**: Add delay or confirmation threshold

---

## 5. Manual Position Close

### 5.1 Current Implementation
```typescript
closePosition: protectedProcedure
  .input(z.object({ positionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Verify ownership
    // Add to execution queue with high priority
    const queueItem = await prisma.executionQueue.create({
      data: {
        type: 'SELL',
        priority: 10, // High priority
        // ...
      },
    });
    return { success: true, queueId: queueItem.id };
  }),
```

### 5.2 Issues

#### 5.2.1 No Immediate Feedback
**ISSUE**: User doesn't know if close succeeded until queue processes

**FIX**: Return estimated time or use WebSocket for status updates

#### 5.2.2 No Cancel Option
**ISSUE**: Once queued, user can't cancel

**FIX**: Add cancel endpoint that removes from queue if not yet processed

---

## 6. Testing Scenarios

### Stop Loss Tests
| Scenario | Entry | SL | Current | Expected |
|----------|-------|-----|---------|----------|
| Normal trigger | $100 | -10% | $89 | SELL |
| Exact boundary | $100 | -10% | $90 | SELL |
| Above SL | $100 | -10% | $91 | HOLD |
| No SL set | $100 | null | $50 | HOLD |

### Take Profit Tests
| Scenario | Entry | TP | Current | Expected |
|----------|-------|-----|---------|----------|
| Normal trigger | $100 | 30% | $131 | SELL |
| Exact boundary | $100 | 30% | $130 | SELL |
| Below TP | $100 | 30% | $129 | HOLD |
| No TP set | $100 | null | $200 | HOLD |

### Exit With Trader Tests
| Scenario | Expected |
|----------|----------|
| Trader sells 100%, exitWithTrader=true | Copier sells 100% |
| Trader sells 100%, exitWithTrader=false | Copier holds |
| Trader sells 50%, exitWithTrader=true | Copier sells 50% (after fix) |
| Trader buys more | No action |

---

## 7. Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 | Add position lock for SL/TP | 2hr |
| 🟠 | Fix duplicate sell orders | 2hr |
| 🟠 | Handle partial trader sells | 4hr |
| 🟠 | Use entry value for P&L calc | 1hr |
| 🟡 | Reduce price check interval | 1hr |
| 🟡 | Add trailing stop loss | 8hr |
| 🟡 | Add close position feedback | 2hr |
| 🟡 | Add cancel close option | 2hr |

**Total Estimated Effort: ~22 hours**

---

## 8. Recommended Improvements

### 8.1 On-Chain Limit Orders
Instead of polling prices, set actual limit orders on Jupiter/Serum:
- More reliable execution
- No missed triggers
- Lower server load

### 8.2 Price Alerts
Notify user when approaching SL/TP:
- 80% of SL reached → warning
- 90% of TP reached → notification

### 8.3 Position Dashboard
Real-time view of all positions with:
- Current P&L
- Distance to SL/TP
- Time held
- Trader's current position
