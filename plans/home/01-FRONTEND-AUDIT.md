# Frontend Audit - Home Screen

## Overview
Complete audit of the home screen frontend implementation including UI/UX, error handling, state management, and accessibility.

---

## 1. Home Screen Component (`app/(tabs)/index.tsx`)

### ✅ Working Correctly

1. **Tab Navigation** - Coins/Traders/Copy tabs work properly
2. **Pull-to-Refresh** - RefreshControl implemented correctly
3. **Search Debouncing** - 300ms debounce for coins, 500ms for traders
4. **Real Data Integration** - Using tRPC queries for real data
5. **Copy Trading Modal** - Form fields present and functional
6. **Error Boundaries** - Wrapped around tab content sections

### 🔴 Critical Issues

#### 1.1 Missing `validateCopyTradeForm` Function
```typescript
// Line ~870: Function called but not defined in visible code
if (!validateCopyTradeForm()) return;
```
**FIX REQUIRED**: Implement validation function:
```typescript
const validateCopyTradeForm = () => {
  if (selectedTrader === 'Manual Setup' && !selectedTraderWallet?.trim()) {
    Alert.alert('Error', 'Please enter a wallet address');
    return false;
  }
  if (!selectedTraderWallet || selectedTraderWallet.length < 32) {
    Alert.alert('Error', 'Invalid wallet address');
    return false;
  }
  const amount = parseFloat(copyAmount);
  const perTrade = parseFloat(amountPerTrade);
  if (isNaN(amount) || amount <= 0) {
    Alert.alert('Error', 'Enter a valid total amount');
    return false;
  }
  if (isNaN(perTrade) || perTrade <= 0 || perTrade > amount) {
    Alert.alert('Error', 'Amount per trade must be positive and less than total');
    return false;
  }
  return true;
};
```

#### 1.2 Missing `validateSolanaAddress` Function
```typescript
// Line ~280: Function called but not defined
if (!validateSolanaAddress(sendAddress)) {
```
**FIX REQUIRED**: Add validation:
```typescript
const validateSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};
```

### 🟠 High Priority Issues

#### 1.3 Swap Modal Uses Mock Exchange Rate
```typescript
// Line ~310-315
const mockRate = fromToken === 'SOL' ? 150 : 0.0067;
const estimated = (parseFloat(swapAmount) * mockRate).toFixed(2);
```
**FIX**: Fetch real quote from Jupiter API before displaying

#### 1.4 Send Modal Not Using Real Transaction
```typescript
// Line ~280-295: handleSend just shows alert, doesn't call real send
onPress: () => {
  console.log('Sending:', { sendAddress, sendAmount, selectedToken });
  setShowSendModal(false);
  Alert.alert('Success', 'Transaction sent successfully!');
}
```
**FIX**: Route to `/send-receive?flow=send` or call real `sendSol`/`sendToken`

#### 1.5 Receive Modal Missing QR Code Generation
```typescript
// Line ~580: Just shows QrCode icon, not actual QR
<QrCode size={120} color={COLORS.solana} />
```
**FIX**: Use `react-native-qrcode-svg` to generate real QR (already used in send-receive.tsx)

### 🟡 Medium Priority Issues

#### 1.6 Hardcoded Demo Wallet Address
```typescript
// Line ~220
const walletAddress = solanaPublicKey || user?.walletAddress || 'DemoWallet1234567890abcdef...';
```
**FIX**: Show "Connect Wallet" prompt instead of demo address

#### 1.7 Copy Trade Stats Not Updating After Action
```typescript
// After createCopyTrade or stopCopyTrade, should invalidate queries
```
**FIX**: Add query invalidation:
```typescript
const utils = trpc.useUtils();
// After mutation success:
utils.copyTrading.getMyCopyTrades.invalidate();
utils.copyTrading.getStats.invalidate();
```

#### 1.8 Missing Loading State for Copy Trade Creation
```typescript
// isCreating is used but button doesn't show spinner
{isCreating ? 'SETTING UP...' : 'START COPYING'}
```
**FIX**: Add ActivityIndicator when isCreating is true

---

## 2. Wallet Store (`hooks/wallet-store.ts`)

### ✅ Working Correctly
- Real portfolio overview query
- Real PnL query
- Token metadata fetching
- Copy trades integration

### 🟠 Issues

#### 2.1 No Error Handling for Failed Queries
```typescript
const totalBalance = overviewQuery.data?.totalValue || 0;
```
**FIX**: Add error states and display to user

#### 2.2 Missing Retry Logic
**FIX**: Add retry configuration to queries:
```typescript
trpc.portfolio.getOverview.useQuery(undefined, {
  refetchInterval: 60000,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

---

## 3. Solana Wallet Store (`hooks/solana-wallet-store.ts`)

### ✅ Working Correctly
- RPC failover with multiple endpoints
- Encrypted wallet storage
- Transaction simulation before send
- Fee estimation
- Token balance fetching

### 🟠 Issues

#### 3.1 Hardcoded Confirmation Timeout
```typescript
const CONFIRMATION_TIMEOUT_MS = 60000;
```
**FIX**: Make configurable and add user feedback during wait

#### 3.2 Silent Failures in refreshBalances
```typescript
} catch (error) {
  // Silent fail - balances will be retried on next action
}
```
**FIX**: At minimum log to Sentry, optionally show toast

---

## 4. Component Audits

### 4.1 TraderCard.tsx ✅
- Clean implementation
- Proper accessibility with onPress handlers
- ROI color coding works

### 4.2 TokenCard.tsx ✅
- Price formatting handles edge cases
- Navigation to coin detail works
- Logo fallback implemented

---

## 5. Accessibility Audit

### Missing Items
1. **Tab buttons** - Need `accessibilityRole="tab"` and `accessibilityState`
2. **Search inputs** - Need `accessibilityLabel`
3. **Modal close buttons** - Need `accessibilityLabel="Close modal"`
4. **Copy trade form** - Inputs need labels for screen readers

### Fixes Required
```typescript
// Tab example
<TouchableOpacity
  style={[styles.tab, activeTab === 'coins' && styles.activeTab]}
  onPress={() => setActiveTab('coins')}
  accessibilityRole="tab"
  accessibilityState={{ selected: activeTab === 'coins' }}
  accessibilityLabel="Trending coins tab"
>
```

---

## 6. Action Items Summary

| Priority | Issue | File | Effort |
|----------|-------|------|--------|
| 🔴 | Add validateCopyTradeForm | index.tsx | 30min |
| 🔴 | Add validateSolanaAddress | index.tsx | 15min |
| 🟠 | Real swap quote in modal | index.tsx | 2hr |
| 🟠 | Fix send modal to use real tx | index.tsx | 1hr |
| 🟠 | Real QR code generation | index.tsx | 30min |
| 🟠 | Query invalidation after mutations | index.tsx | 30min |
| 🟡 | Remove demo wallet fallback | index.tsx | 15min |
| 🟡 | Add error states to wallet store | wallet-store.ts | 1hr |
| 🟡 | Accessibility improvements | index.tsx | 2hr |

**Total Estimated Effort: ~8 hours**
