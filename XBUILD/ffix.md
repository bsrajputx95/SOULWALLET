I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The implementation is **production-ready for beta** with only **one critical bug** blocking send transactions. The codebase follows React Native and Solana best practices with proper security (client-side signing, encrypted storage, JWT auth). The XOR encryption is intentionally simple for beta (documented in code). Most validation exists but could be more robust for better UX.

## Approach

Fix the critical token retrieval bug first, then add essential validation and error handling to prevent common user mistakes. Add transaction retry logic for network reliability. Focus on **beta-essential fixes only** - no security overkill, no tests, no analytics. Keep changes minimal and targeted.

---

## Implementation Steps

### 1. **Fix Critical SendModal Token Bug** ⚠️ BLOCKING

**File**: `file:components/SendModal.tsx`

**Line 184** - Replace AsyncStorage with SecureStore:

```typescript
// BEFORE (BROKEN):
const authToken = await AsyncStorage.getItem('userToken');

// AFTER (FIXED):
const authToken = await SecureStore.getItemAsync('token');
```

**Import Update** - Add SecureStore import at top:
```typescript
import * as SecureStore from 'expo-secure-store';
```

**Remove AsyncStorage import** - No longer needed in this file.

---

### 2. **Add Input Validation**

#### **A. SendModal Address/Amount Validation**

**File**: `file:components/SendModal.tsx`

**Enhance `validateAddress` (lines 102-119)**:
- Add check for empty/whitespace-only input
- Trim input before validation
- Add specific error for self-send earlier in flow

**Enhance `validateAmount` (lines 122-133)**:
- Check for non-numeric input (NaN)
- Add max decimals check (9 for SOL)
- Add minimum amount check (> 0.00001 SOL to cover fees)

#### **B. Solana Setup PIN Validation**

**File**: `file:app/solana-setup.tsx`

**Enhance PIN validation (lines 64-71, 115-122)**:
- Add numeric-only check (reject letters/symbols)
- Add max length check (6 digits)
- Show real-time validation feedback

**Enhance Private Key Validation (lines 111-114)**:
- Check base58 format before calling importWallet
- Check length (should be 88 characters for Solana)
- Trim whitespace before validation

#### **C. Account Screen Validation**

**File**: `file:app/account.tsx`

**Add validation in `handleSave` (line 338)**:
- Email format validation (regex)
- Phone format validation (optional, basic check)
- Date of birth format validation (YYYY-MM-DD, past date only)
- First/Last name length limits (1-50 chars)

---

### 3. **Improve Error Messages**

#### **A. Wallet Service Errors**

**File**: `file:services/wallet.ts`

**Update error messages in:**

- `createWallet` (lines 104-106): Add specific errors for network issues vs backend issues
- `sendTransaction` (lines 309-311): Distinguish between:
  - Network errors ("Check your internet connection")
  - Insufficient balance ("Not enough SOL for transaction + fees")
  - Invalid PIN ("Incorrect PIN, please try again")
  - Transaction failed ("Transaction rejected by network")

#### **B. Backend Error Responses**

**File**: `file:soulwallet-backend/src/server.ts`

**Enhance error messages in:**

- `/transactions/prepare-send` (line 683): Return specific balance info
- `/transactions/broadcast` (line 768): Return transaction error details
- `/wallet/balances` (line 597): Handle RPC connection errors gracefully

---

### 4. **Add Transaction Retry Logic**

**File**: `file:services/wallet.ts`

**Add retry helper function** (before `sendTransaction`):

```typescript
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, i)));
    }
  }
};
```

**Update `sendTransaction` (line 229)**:
- Wrap `/transactions/prepare-send` fetch in retry (network issues)
- Wrap `/transactions/broadcast` fetch in retry (RPC issues)
- Don't retry on validation errors (400 status)
- Don't retry on auth errors (401 status)

---

### 5. **Add User Feedback Toasts**

**File**: `file:components/SendModal.tsx`

**Replace generic Alerts with specific messages:**

- Line 228: "❌ Transaction Failed" → Show actual error from backend
- Line 216: "✅ Transaction Sent!" → Keep, but add Solscan link as button
- Line 186: "Please log in again" → "Session expired, please log in"

**File**: `file:app/solana-setup.tsx`

**Improve feedback:**
- Line 99: "Wallet created successfully!" → "✅ Wallet created! Save your private key"
- Line 141: "Wallet imported successfully!" → "✅ Wallet imported and linked"
- Line 149: "Invalid private key" → "❌ Invalid private key format (must be base58)"

**File**: `file:app/account.tsx`

**Improve feedback:**
- Line 355: "Account settings updated successfully!" → "✅ Profile updated"
- Line 357: "Failed to update settings" → Show specific field error
- Line 200: "Password updated successfully" → "✅ Password changed"

---

## Summary Table

| File | Changes | Priority | Lines Affected |
|------|---------|----------|----------------|
| `SendModal.tsx` | Fix token retrieval bug | 🔴 CRITICAL | 184, imports |
| `SendModal.tsx` | Enhance validation | 🟡 HIGH | 102-133 |
| `SendModal.tsx` | Better error messages | 🟡 HIGH | 186, 216, 228 |
| `wallet.ts` | Add retry logic | 🟡 HIGH | 229-313 |
| `wallet.ts` | Better error messages | 🟢 MEDIUM | 104-311 |
| `solana-setup.tsx` | PIN/key validation | 🟢 MEDIUM | 64-122 |
| `solana-setup.tsx` | Better feedback | 🟢 MEDIUM | 99, 141, 149 |
| `account.tsx` | Input validation | 🟢 MEDIUM | 338-359 |
| `account.tsx` | Better feedback | 🟢 MEDIUM | 200, 355, 357 |
| `server.ts` | Better error responses | 🟢 LOW | 597, 683, 768 |

---

## Testing Checklist

After implementation, verify:

1. ✅ Send transaction works (fix token bug)
2. ✅ Invalid addresses rejected with clear message
3. ✅ Invalid amounts rejected with clear message
4. ✅ Invalid PIN rejected during wallet creation
5. ✅ Invalid private key rejected during import
6. ✅ Transaction retries on network failure
7. ✅ Profile validation prevents bad data
8. ✅ Error messages are user-friendly

---

## What's NOT Included (Beta Scope)

- ❌ Encryption upgrades (XOR is fine for beta per code comments)
- ❌ Unit tests (not requested)
- ❌ Analytics tracking (not requested)
- ❌ Advanced security features (beyond beta)
- ❌ Performance optimizations (works fine)
- ❌ UI/UX redesigns (current design is good)