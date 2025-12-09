# Profit Sharing Audit - 5% Fee Mechanism

## Overview
When a copy trade closes with profit, 5% of the profit should be transferred to the trader's wallet. This document audits the complete profit sharing implementation.

---

## 1. Current Implementation (`src/lib/services/profitSharing.ts`)

### Flow
```
Position Closed with Profit
    ↓
processProfitSharing(positionId)
    ↓
Calculate 5% fee
    ↓
Convert USDC to SOL
    ↓
Send SOL to trader wallet
    ↓
Update Position with fee info
    ↓
Update CopyTrading totalFeesPaid
```

### Code Analysis

#### 1.1 Fee Calculation ✅
```typescript
private feePercentage = 0.05; // 5% fee

// Only charge fee if profit > 0
if (!position.profitLoss || position.profitLoss <= 0) {
  logger.info(`No profit for position ${positionId}, no fee charged`);
  return { success: true, feeAmount: 0 };
}

// Calculate 5% fee
const feeAmount = position.profitLoss * this.feePercentage;
```
✅ Correctly calculates 5% only on positive profit

#### 1.2 USDC to SOL Conversion ✅
```typescript
private async convertUSDCtoSOL(usdcAmount: number): Promise<number> {
  const solMint = 'So11111111111111111111111111111111111111112';
  const solPrice = await jupiterSwap.getPrice(solMint);

  if (!solPrice || solPrice <= 0) {
    logger.warn('Failed to get SOL price, using fallback price of $150');
    return usdcAmount / 150;
  }

  const solAmount = usdcAmount / solPrice;
  return solAmount;
}
```
✅ Uses real price with fallback

---

## 2. 🔴 CRITICAL ISSUES

### 2.1 STUB WALLET - FEES CANNOT BE SENT
```typescript
private async sendFeeToTrader(params: {
  fromUserId: string;
  toWallet: string;
  amountSOL: number;
}): Promise<string | null> {
  try {
    const { fromUserId, toWallet, amountSOL } = params;

    // Get user's wallet
    // Note: Currently using stub wallet for safety. In production, integrate proper wallet service
    const userWallet = Keypair.generate(); // ⚠️ STUB - RANDOM WALLET!
```

**THIS IS A CRITICAL BUG**
- Every fee transfer uses a newly generated random wallet
- This wallet has no funds
- Transaction will always fail
- Fees are never actually sent to traders

### 2.2 No Transaction Verification Before Recording
```typescript
// Update position with fee information
await prisma.position.update({
  where: { id: positionId },
  data: {
    feeAmount,
    feeTxHash,
  },
});
```
**ISSUE**: Records fee as paid even if transaction fails

### 2.3 Balance Check Uses Wrong Wallet
```typescript
const balance = await this.connection.getBalance(userWallet.publicKey);
```
**ISSUE**: Checks balance of stub wallet (always 0), not user's actual wallet

---

## 3. 🟠 HIGH PRIORITY ISSUES

### 3.1 No Retry on Failure
```typescript
if (!feeTxHash) {
  logger.error('Failed to send fee to trader');
  return { success: false, error: 'Failed to send fee transaction' };
}
```
**FIX**: Add retry logic with exponential backoff

### 3.2 Fee Recorded Even on Partial Failure
```typescript
// Update copy trading statistics
await prisma.copyTrading.update({
  where: { id: position.copyTradingId },
  data: {
    totalFeesPaid: { increment: feeAmount },
  },
});
```
**ISSUE**: Stats updated even if transaction failed

### 3.3 No Minimum Fee Threshold
```typescript
const feeAmount = position.profitLoss * this.feePercentage;
```
**ISSUE**: Could try to send 0.0001 SOL which costs more in fees than the amount
**FIX**: Add minimum threshold:
```typescript
const MIN_FEE_SOL = 0.001; // ~$0.15
if (feeInSOL < MIN_FEE_SOL) {
  logger.info(`Fee too small (${feeInSOL} SOL), skipping transfer`);
  return { success: true, feeAmount: 0, skipped: true };
}
```

---

## 4. Correct Implementation

### 4.1 Required Changes

```typescript
private async sendFeeToTrader(params: {
  fromUserId: string;
  toWallet: string;
  amountSOL: number;
}): Promise<string | null> {
  try {
    const { fromUserId, toWallet, amountSOL } = params;

    // OPTION 1: Get user's custodial wallet
    const userWallet = await this.getCustodialWallet(fromUserId);
    
    // OPTION 2: Get user's stored encrypted keypair
    // const userWallet = await walletService.getUserKeypair(fromUserId);
    
    if (!userWallet) {
      logger.error(`No wallet found for user ${fromUserId}`);
      return null;
    }

    // Verify balance
    const balance = await this.connection.getBalance(userWallet.publicKey);
    const requiredBalance = lamports + 5000; // Amount + fee

    if (balance < requiredBalance) {
      logger.error(
        `Insufficient balance for fee. Required: ${requiredBalance / LAMPORTS_PER_SOL} SOL, ` +
        `Available: ${balance / LAMPORTS_PER_SOL} SOL`
      );
      return null;
    }

    // Create and send transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userWallet.publicKey,
        toPubkey: new PublicKey(toWallet),
        lamports: Math.floor(amountSOL * LAMPORTS_PER_SOL),
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [userWallet],
      { commitment: 'confirmed' }
    );

    // VERIFY transaction succeeded
    const txInfo = await this.connection.getTransaction(signature, {
      commitment: 'confirmed',
    });

    if (!txInfo || txInfo.meta?.err) {
      logger.error(`Fee transaction failed: ${signature}`);
      return null;
    }

    logger.info(`Fee sent to trader: ${signature}`);
    return signature;
  } catch (error) {
    logger.error('Error sending fee to trader:', error);
    return null;
  }
}
```

### 4.2 Add Transaction Wrapper

```typescript
async processProfitSharing(positionId: string): Promise<ProfitSharingResult> {
  // Use database transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    const position = await tx.position.findUnique({
      where: { id: positionId },
      include: { copyTrading: { include: { trader: true, user: true } } },
    });

    if (!position || position.status !== 'CLOSED') {
      return { success: false, error: 'Invalid position' };
    }

    if (!position.profitLoss || position.profitLoss <= 0) {
      return { success: true, feeAmount: 0 };
    }

    const feeAmount = position.profitLoss * this.feePercentage;
    const feeInSOL = await this.convertUSDCtoSOL(feeAmount);

    // Check minimum
    if (feeInSOL < 0.001) {
      return { success: true, feeAmount: 0, skipped: true };
    }

    // Send fee
    const feeTxHash = await this.sendFeeToTrader({
      fromUserId: position.copyTrading.userId,
      toWallet: position.copyTrading.trader.walletAddress,
      amountSOL: feeInSOL,
    });

    if (!feeTxHash) {
      // Don't update records if transfer failed
      return { success: false, error: 'Fee transfer failed' };
    }

    // Only update after successful transfer
    await tx.position.update({
      where: { id: positionId },
      data: { feeAmount, feeTxHash },
    });

    await tx.copyTrading.update({
      where: { id: position.copyTradingId },
      data: { totalFeesPaid: { increment: feeAmount } },
    });

    return { success: true, feeAmount, feeTxHash };
  });
}
```

---

## 5. Testing Checklist

### Unit Tests Needed
- [ ] Fee calculation with various profit amounts
- [ ] Fee calculation with zero/negative profit
- [ ] USDC to SOL conversion
- [ ] Minimum fee threshold
- [ ] Balance check logic

### Integration Tests Needed
- [ ] End-to-end profit sharing flow
- [ ] Transaction verification
- [ ] Database record updates
- [ ] Failure recovery

### Manual Tests Needed
- [ ] Close profitable position → verify fee sent
- [ ] Close losing position → verify no fee
- [ ] Insufficient balance → verify graceful failure
- [ ] Network error → verify retry

---

## 6. Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 BLOCKER | Replace stub wallet with real wallet | 8hr |
| 🔴 | Add transaction verification | 2hr |
| 🔴 | Use database transaction for atomicity | 2hr |
| 🟠 | Add minimum fee threshold | 1hr |
| 🟠 | Add retry logic | 2hr |
| 🟠 | Fix balance check | 1hr |
| 🟡 | Add comprehensive logging | 1hr |
| 🟡 | Write unit tests | 4hr |
| 🟡 | Write integration tests | 4hr |

**Total Estimated Effort: ~25 hours**

---

## 7. Monitoring & Alerts

### Metrics to Track
1. Total fees collected (daily/weekly/monthly)
2. Fee transfer success rate
3. Average fee amount
4. Failed transfers count

### Alerts to Set Up
1. Fee transfer failure rate > 5%
2. Large fee transfer (> $100)
3. Trader wallet receiving unusual volume
4. Fee calculation anomalies

### Dashboard Queries
```sql
-- Daily fee summary
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as positions_closed,
  SUM(CASE WHEN feeAmount > 0 THEN 1 ELSE 0 END) as fees_charged,
  SUM(feeAmount) as total_fees
FROM positions
WHERE status = 'CLOSED'
GROUP BY DATE(createdAt)
ORDER BY date DESC;

-- Top traders by fees earned
SELECT 
  tp.username,
  tp.walletAddress,
  SUM(p.feeAmount) as total_fees_earned
FROM positions p
JOIN copy_trading ct ON p.copyTradingId = ct.id
JOIN trader_profiles tp ON ct.traderId = tp.id
WHERE p.feeAmount > 0
GROUP BY tp.id
ORDER BY total_fees_earned DESC
LIMIT 10;
```
