# Portfolio Tab Analysis - Issues & Fixes

## Executive Summary

The Portfolio tab has **8 critical issues**, including a completely broken earnings display feature. The iBuy positions and Copy Trading positions are not integrated, causing the "Copy Trade" earnings card to always show `$0`.

---

## Critical Issues

### 1. **CRITICAL: Mocked `openPositionsQuery` - Broken Earnings Display**

**File:** `app/(tabs)/portfolio.tsx` (Line 471)

**Problem:**
```typescript
const openPositionsQuery = { data: [] as any[], isLoading: false, refetch: async () => ({}) };
```

This is a HARDCODED MOCK with empty data! The earnings cards calculate values from this:
- Copy Trade earnings: Always `$0`
- Self earnings: Shows full balance (incorrect calculation)

**Impact:** Users cannot see their iBuy positions or copy trading P&L in the portfolio tab.

**Fix Required:**
```typescript
// Add state for positions
const [iBuyPositions, setIBuyPositions] = useState<IBuyPosition[]>([]);
const [copyPositions, setCopyPositions] = useState<CopyPosition[]>([]);

// Fetch on mount/focus
const loadPositions = useCallback(async () => {
  const [iBuyRes, copyRes] = await Promise.all([
    getMyIBuyBag(),
    fetchCopyPositions(token)
  ]);
  if (iBuyRes.success) setIBuyPositions(iBuyRes.positions || []);
  if (copyRes.success) setCopyPositions(copyRes.positions || []);
}, []);
```

---

### 2. **HIGH: Incorrect Daily PnL Calculation**

**File:** `app/(tabs)/portfolio.tsx` (Lines 283-292)

**Problem:**
```typescript
const dailyPnl = React.useMemo(() => {
  return tokens.reduce((total, token) => {
    if (token.change24h && token.usdValue) {
      // PnL = USD Value * (change24h / 100)
      return total + (token.usdValue * (token.change24h / 100));
    }
    return total;
  }, 0);
}, [tokens]);
```

This calculates what the token's price changed in 24h, NOT the user's actual profit/loss. A user who bought SOL at $100 sees the same "PnL" as someone who bought at $80, which is wrong.

**Impact:** Misleading information - shows market movement, not user profit.

**Fix Required:**
- Store entry price when tokens are acquired
- Calculate: `(currentPrice - entryPrice) * tokenAmount`
- OR remove this feature until proper cost basis tracking is implemented

---

### 3. **HIGH: Missing AbortController for API Calls**

**File:** `app/(tabs)/portfolio.tsx` (Function `fetchWalletData`, line 307)

**Problem:**
```typescript
const fetchWalletData = useCallback(async (isRefresh = false) => {
  // ... API calls without abort support
  const portfolio = await fetchBalances(token);
}, []);
```

If user navigates away while fetching, state updates on unmounted component = memory leak.

**Fix Required:**
```typescript
const fetchWalletData = useCallback(async (isRefresh = false, signal?: AbortSignal) => {
  // Check abort before each state update
  if (signal?.aborted) return;
  setTokens(...);
}, []);

// In useFocusEffect
const controller = new AbortController();
fetchWalletData(false, controller.signal);
return () => controller.abort();
```

---

### 4. **MEDIUM: Token List Not Memoized**

**File:** `app/(tabs)/portfolio.tsx` (Line 735)

**Problem:**
```typescript
{tokens.map(token => (
  <Pressable key={token.id} ...>
    {/* Token card */}
  </Pressable>
))}
```

Similar to Market tab issue we fixed - no React.memo on token items causes unnecessary re-renders.

**Fix Required:**
```typescript
const TokenItem = React.memo(({ token, onPress }: TokenItemProps) => (
  <Pressable onPress={onPress}>...</Pressable>
), (prev, next) => 
  prev.token.id === next.token.id && 
  prev.token.usdValue === next.token.usdValue &&
  prev.token.change24h === next.token.change24h
);
```

---

### 5. **MEDIUM: TokenLogo Component Not Memoized**

**File:** `app/(tabs)/portfolio.tsx` (Lines 65-83)

**Problem:** `TokenLogo` is defined inside the main component but not memoized. It re-renders on every parent update.

**Fix Required:**
```typescript
const TokenLogo = React.memo<{ token: Token }>(({ token }) => {
  const [failed, setFailed] = useState(false);
  // ... render
});
```

---

### 6. **MEDIUM: Edit Modal State Persists After Close**

**File:** `app/(tabs)/portfolio.tsx` (Lines 394-399, 1207-1240)

**Problem:**
```typescript
// State set when opening modal
setEditAmount(wallet.totalAmount?.toString() || '1000');

// Modal closed without saving - state NOT reset!
setSelectedWallet(null); // Only this is called
```

**Impact:** User opens modal again - sees old values instead of current config.

**Fix Required:**
```typescript
const handleCloseModal = () => {
  setSelectedWallet(null);
  // Reset all edit states
  setEditAmount('');
  setEditAmountPerTrade('');
  setEditSL('');
  setEditTP('');
  setEditSlippage('');
};
```

---

### 7. **LOW: "Self" Earnings Calculation Logic Flawed**

**File:** `app/(tabs)/portfolio.tsx` (Line 670)

**Problem:**
```typescript
${(Math.max(0, totalBalance - ((openPositionsQuery.data || []).reduce(...))))
```

This assumes:
- Self earnings = Total balance - Copy trade positions value
- But copy positions value is mocked to empty
- So it shows total balance as "self earnings"

**Impact:** Wrong calculation when positions are actually loaded.

**Fix Required:**
```typescript
const copyTradeValue = copyPositions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
const iBuyValue = iBuyPositions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
const selfValue = Math.max(0, totalBalance - copyTradeValue - iBuyValue);
```

---

### 8. **LOW: Pull-to-Refresh Race Conditions**

**File:** `app/(tabs)/portfolio.tsx` (Lines 553-561)

**Problem:**
```typescript
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  await refetch();
  await openPositionsQuery.refetch(); // Does nothing (mock)
  await loadWatchlist();
  // ... more calls
  setRefreshing(false);
}, [...]);
```

- No error handling - if one fails, others don't run
- No parallel execution with Promise.all
- Mock `openPositionsQuery.refetch()` is called (does nothing)

**Fix Required:**
```typescript
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await Promise.all([
      refetch(),
      loadPositions(), // New function that fetches iBuy + copy positions
      loadWatchlist(),
      loadCopyConfig(),
      loadCopyWallet()
    ]);
  } catch (err) {
    showAlert('Error', 'Failed to refresh some data');
  } finally {
    setRefreshing(false);
  }
}, [...]);
```

---

## Backend Status

### iBuy Positions API ✅ Available
- `GET /ibuy/positions` - Returns user's iBuy positions with P&L
- Service: `getMyIBuyBag()` in `services/ibuy.ts`

### Copy Trading Positions API ✅ Available  
- `GET /copy-trade/positions` - Returns copy trading positions
- Service: `fetchCopyPositions()` in `services/copyTrading.ts`

### Wallet Balances API ✅ Working
- `GET /wallet/balances` - Returns SOL + SPL token balances
- Jupiter Price API + DexScreener fallback implemented

---

## Performance Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Token list not memoized | Medium | Re-renders on every state change |
| TokenLogo not memoized | Medium | Re-renders for all tokens |
| Missing AbortController | Medium | Memory leaks on rapid navigation |
| Multiple sequential awaits | Low | Slower refresh times |

---

## Recommendations

### Immediate (Pre-Beta)
1. **Fix the mocked `openPositionsQuery`** - Highest priority
2. **Add positions fetching** - iBuy + Copy Trading
3. **Fix edit modal state reset**

### Short Term (Post-Beta)
4. Add proper cost basis tracking for real PnL
5. Memoize token list components
6. Add AbortController to all async operations

### Long Term
7. Implement real portfolio chart with historical data
8. Add transaction history in portfolio tab

---

## Current Data Flow (Broken)

```
Portfolio Tab
├── fetchWalletData() → /wallet/balances ✅ Working
│   └── Shows token holdings
├── loadCopyConfig() → /copy-trade/config ✅ Working  
│   └── Shows copy trading setup (not positions!)
├── openPositionsQuery → MOCKED ❌ BROKEN
│   └── Always returns empty array
└── Result: Earnings cards show $0
```

## Expected Data Flow (Fixed)

```
Portfolio Tab
├── fetchWalletData() → /wallet/balances ✅ Working
├── loadCopyConfig() → /copy-trade/config ✅ Working
├── loadIBuyPositions() → /ibuy/positions ← NEW
│   └── Real iBuy positions with P&L
├── loadCopyPositions() → /copy-trade/positions ← NEW
│   └── Real copy trading positions
└── Result: Accurate earnings display
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/(tabs)/portfolio.tsx` | Add positions fetching, fix mock, memoize components |
| `services/ibuy.ts` | Already has `getMyIBuyBag()` - just use it |
| `services/copyTrading.ts` | Already has `fetchCopyPositions()` - just use it |

---

## Testing Checklist

- [ ] iBuy positions appear in portfolio
- [ ] Copy trading positions appear in portfolio  
- [ ] Earnings cards show correct values
- [ ] Edit modal resets state on close
- [ ] Pull-to-refresh fetches all data
- [ ] Token list scrolls smoothly (60fps)
- [ ] No memory leaks on rapid tab switching
