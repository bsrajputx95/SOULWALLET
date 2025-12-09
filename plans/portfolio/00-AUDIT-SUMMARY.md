# Portfolio Tab - Comprehensive Audit

## Date: December 9, 2025

## Overview
Audit of the Portfolio tab (`app/(tabs)/portfolio.tsx`) and related backend services to verify all data is real and functioning correctly.

---

## ✅ WORKING CORRECTLY (Real Data)

### Backend API (`src/server/routers/portfolio.ts`)

| Endpoint | Status | Data Source |
|----------|--------|-------------|
| `getOverview` | ✅ Real | Solana RPC + DexScreener |
| `getAssetBreakdown` | ✅ Real | Solana RPC + DexScreener |
| `getHistory` | ✅ Real | Database snapshots |
| `getPerformance` | ✅ Real | Database snapshots |
| `getPNL` | ✅ Real | Transaction history |
| `createSnapshot` | ✅ Real | Creates DB record |

### Wallet API (`src/server/routers/wallet.ts`)

| Endpoint | Status | Data Source |
|----------|--------|-------------|
| `getTokens` | ✅ Real | Solana RPC (SPL tokens) |
| `getTokenMetadata` | ✅ Real | Token registry |
| `linkWallet` | ✅ Real | Signature verification |

### Frontend Data Flow (`hooks/wallet-store.ts`)

| Data Point | Source | Status |
|------------|--------|--------|
| `totalBalance` | `portfolio.getOverview` | ✅ Real |
| `dailyPnl` | `portfolio.getPNL` | ✅ Real |
| `solPrice` | `portfolio.getOverview` | ✅ Real |
| `tokens` | `wallet.getTokens` + metadata | ✅ Real |
| `copiedWallets` | `copyTrading.getMyCopyTrades` | ✅ Real |

### Features Working

1. **Portfolio Value Display** ✅
   - Real SOL balance from Solana RPC
   - Real SPL token balances
   - Real prices from DexScreener (cached 5 min)
   - Real 24h change from snapshots

2. **Token Holdings Tab** ✅
   - Real token list from wallet
   - Real balances
   - Real prices
   - Percentage allocation calculated

3. **Copied Wallets Tab** ✅
   - Real copy trading data from database
   - ROI and PnL from positions
   - Edit modal for settings

4. **Watchlist Tab** ✅
   - Persisted to AsyncStorage
   - Shows tokens from watchlist
   - Links to coin detail page

5. **Earnings Cards** ✅
   - Copy Trade value from open positions
   - Self value calculated

6. **Pull-to-Refresh** ✅
   - Refreshes all data sources

7. **Auto-Refresh** ✅
   - Portfolio overview: 60 seconds
   - PnL: 5 minutes
   - Tokens: 60 seconds
   - Copy trades: 30 seconds

---

## 🔴 ISSUES FOUND

### 1. PnL Chart is Placeholder
```typescript
// app/(tabs)/portfolio.tsx - Line ~680
<View style={styles.chartPlaceholder}>
  <Text style={styles.chartPlaceholderText}>Chart visualization would appear here</Text>
</View>
```
**No actual chart implementation**

### 2. Token Prices Not Fetched for Holdings
```typescript
// hooks/wallet-store.ts - Lines 63-72
const tokens: Token[] = tokensQuery.data?.tokens.map(token => {
  return {
    // ...
    price: 1,        // HARDCODED!
    change24h: 0,    // HARDCODED!
    value: token.balance,  // Should be balance * price
  };
}) || [];
```
**Token prices are hardcoded to 1, not fetched from API**

### 3. Wallet Activity Button Does Nothing
```typescript
// app/(tabs)/portfolio.tsx - Line ~685
<Pressable style={styles.activityButton}>
  <Text style={styles.activityButtonText}>Wallet Activity</Text>
  <ChevronRight size={20} color={COLORS.textPrimary} />
</Pressable>
```
**No onPress handler**

### 4. Trade Modal Doesn't Execute Real Trades
```typescript
// app/(tabs)/portfolio.tsx - Token modal trade
Alert.alert(
  'Trade',
  `${tradeMode === 'buy' ? 'Buying' : 'Selling'} ${value} ${selectedToken?.symbol}`
);
// Just shows alert, doesn't execute swap
```
**Should navigate to swap screen like coin detail page**

### 5. Wallet Import Uses Mock Data
```typescript
// app/(tabs)/portfolio.tsx - Line ~840
const mockAddress = `sol${Math.random().toString(36).substring(2, 8)}...`;
const mockWalletData = {
  publicKey: `HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH`,  // HARDCODED!
  privateKey: `5KJvsngHeMpm884wtkJNzQGaCErckhHJBGFsvd3VyK5qMZXj3hS`,  // HARDCODED!
  mnemonic: importInput.trim()
};
```
**Wallet import doesn't actually derive keys from mnemonic**

### 6. Create Wallet Uses Static Mnemonic
```typescript
// app/(tabs)/portfolio.tsx - Line ~870
{[
  'abandon', 'ability', 'able', 'about', 'above', 'absent',
  'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'
].map((word, index) => (
```
**Static mnemonic, not randomly generated**

---

## 🟡 MEDIUM ISSUES

1. **Period Dropdown** - Works but could use better UX
2. **Chart Type Selector** - Line/Candle buttons exist but no chart
3. **Token Modal Chart** - Shows placeholder icon

---

## 🔧 FIXES APPLIED

### 1. Token Prices Now Real ✅
```typescript
// hooks/wallet-store.ts - Added assetBreakdownQuery
const assetBreakdownQuery = trpc.portfolio.getAssetBreakdown.useQuery(undefined, {
  refetchInterval: 60000,
});

// Now uses real prices from DexScreener
price: priceData?.price || 0,
value: priceData?.value || token.balance * (priceData?.price || 0),
```

### 2. Wallet Activity Button Now Works ✅
Opens Solscan transaction history for the connected wallet.

### 3. Trade Modal Now Navigates to Swap ✅
Instead of just showing an alert, now navigates to `/swap` with the correct tokens pre-selected.

### 4. PnL Chart Shows Real Data ✅
Shows actual portfolio value and daily P&L instead of placeholder text.

### 5. Fixed TypeScript Errors ✅
- Fixed `getOpenPositions` query input
- Fixed `NeonInput` error prop type
- Fixed `updateCopiedWallet` type issue

---

## ⚠️ REMAINING LIMITATIONS (Acceptable for MVP)

1. **24h Token Change** - Not available from current API (shows 0)
2. **Chart Visualization** - Shows values but no actual chart line

These are acceptable for MVP as:
- Users connect wallets via proper `/solana-setup` flow with real key generation
- Real portfolio values and P&L are displayed
- Token prices are real from DexScreener

## 🔧 ADDITIONAL FIX (December 9, 2025)

### Removed Mock Wallet Modal ✅
**Before:** Portfolio had a separate wallet modal with hardcoded mock data
**After:** Removed mock wallet modal - wallet creation/import now uses proper `/solana-setup` page

The `/solana-setup` page provides:
- Real `Keypair.generate()` for creating wallets
- Encrypted storage with user password (PBKDF2 + AES-256)
- Private key import with bs58 decoding
- Secure storage via expo-secure-store

---

## Files Modified

1. `hooks/wallet-store.ts` - Added real token price fetching
2. `app/(tabs)/portfolio.tsx` - Multiple fixes applied

---
