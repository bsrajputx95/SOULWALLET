# Design Document: Wallet Creation Crash Fix

## Overview

This design addresses a critical crash in the SoulWallet app that occurs when users attempt to create a new wallet. The crash happens immediately after tapping "Create New Wallet" following password entry. Analysis of the codebase reveals the issue is in the wallet creation flow, specifically in the `createWalletEncrypted` function in `hooks/solana-wallet-store.ts`.

The root cause is that `createWalletEncrypted` calls `WalletManager.createNewWallet()` which performs heavy cryptographic operations (BIP39 mnemonic generation, PBKDF2 key derivation with 310,000 iterations) synchronously on the main thread, causing the app to freeze and crash. Additionally, there's a missing `await` for `AsyncStorage.setItem` which can cause race conditions.

## Architecture

The fix follows a simple, targeted approach:

1. **Async/Await Fix**: Ensure all async operations are properly awaited
2. **Error Handling**: Add try-catch blocks to prevent crashes and provide user feedback
3. **State Management**: Properly update loading states before and after operations
4. **Verification**: Test that newly created wallets work throughout the app

The solution maintains the existing architecture and doesn't introduce new complexity or security layers.

## Components and Interfaces

### Modified Components

**1. hooks/solana-wallet-store.ts - `createWalletEncrypted` function**
- Add proper async/await for all storage operations
- Add comprehensive error handling
- Ensure loading state is set before heavy operations

**2. hooks/wallet-creation-store.ts - `WalletManager.createNewWallet` method**
- Ensure all async operations are properly awaited
- Add error handling for cryptographic operations

**3. app/solana-setup.tsx - `handleCreateWallet` function**
- Already has error handling, but verify it catches all errors
- Ensure proper user feedback on success/failure

### Data Flow

```
User taps "Create New Wallet"
  ↓
handleCreateWallet() in solana-setup.tsx
  ↓
createWalletEncrypted() in solana-wallet-store.ts
  ↓
WalletManager.createNewWallet() in wallet-creation-store.ts
  ↓
[Heavy crypto operations: BIP39, PBKDF2]
  ↓
SecureStorage.setEncryptedPrivateKey()
  ↓
AsyncStorage.setItem() [MISSING AWAIT - BUG]
  ↓
Return wallet to UI
  ↓
Show success screen
```

## Root Cause Analysis

After examining the code, the crash is caused by:

1. **Missing await in wallet-creation-store.ts line 52**: `AsyncStorage.setItem(ENCRYPTED_MARKER_KEY, 'true')` is not awaited in `createNewWallet`
2. **Heavy synchronous operations**: PBKDF2 with 310,000 iterations runs on main thread
3. **Race condition**: The function returns before storage operations complete, causing state inconsistency

The import flow works because it follows a different code path that properly awaits all operations.

## Data Models

No changes to data models. The existing wallet structure remains:

```typescript
interface WalletCreationResult {
  keypair: Keypair;
  mnemonic: string;
  publicKey: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Wallet creation completes without crashing
*For any* valid password input, calling `createWalletEncrypted` should complete successfully and return a wallet object without causing the app to crash.
**Validates: Requirements 1.1**

### Property 2: Storage operations complete before return
*For any* wallet creation operation, all storage operations (SecureStorage and AsyncStorage) should complete before the function returns to the caller.
**Validates: Requirements 2.3**

### Property 3: Error handling prevents crashes
*For any* error that occurs during wallet creation (crypto failure, storage failure, etc.), the error should be caught and handled gracefully with user feedback instead of crashing the app.
**Validates: Requirements 1.2**

### Property 4: Created wallet persists correctly
*For any* successfully created wallet, the wallet data should be retrievable from storage after creation completes.
**Validates: Requirements 3.1**

### Property 5: Created wallet functions like imported wallet
*For any* newly created wallet, it should be able to perform the same operations (transactions, balance checks, etc.) as an imported wallet.
**Validates: Requirements 3.3**

## Error Handling

### Error Categories

1. **Cryptographic Errors**: BIP39 generation, key derivation failures
   - Catch and display: "Failed to generate wallet keys. Please try again."

2. **Storage Errors**: SecureStorage or AsyncStorage failures
   - Catch and display: "Failed to save wallet. Please check device storage."

3. **Network Errors**: Backend sync failures (non-blocking)
   - Log warning but don't fail wallet creation
   - Display: "Wallet created locally. Sync will retry later."

4. **Async/Timing Errors**: Race conditions, missing awaits
   - Fix by ensuring all async operations are awaited
   - Add loading states to prevent user interaction during operations

### Error Handling Strategy

```typescript
try {
  setState(prev => ({ ...prev, isLoading: true }));
  
  // All async operations with proper await
  const result = await WalletManager.createNewWallet(password);
  await setSecureItem('wallet_public_key', publicKey);
  await AsyncStorage.setItem(ENCRYPTED_MARKER_KEY, 'true');
  
  setState(prev => ({ ...prev, wallet, publicKey, isLoading: false }));
  return wallet;
} catch (error) {
  setState(prev => ({ ...prev, isLoading: false }));
  
  // Categorize and handle error
  const errorMessage = categorizeError(error);
  throw new Error(errorMessage);
}
```

## Testing Strategy

### Unit Tests

1. **Test wallet creation success path**
   - Create wallet with valid password
   - Verify wallet object is returned
   - Verify storage contains encrypted data

2. **Test wallet creation with invalid password**
   - Create wallet with empty password
   - Verify appropriate error is thrown

3. **Test storage persistence**
   - Create wallet
   - Retrieve wallet from storage
   - Verify data matches

4. **Test error handling**
   - Mock storage failure
   - Verify error is caught and handled
   - Verify app doesn't crash

### Integration Tests

1. **Test full wallet creation flow**
   - Navigate to create wallet screen
   - Enter password
   - Tap create button
   - Verify success screen appears
   - Verify no crash occurs

2. **Test wallet functionality after creation**
   - Create new wallet
   - Navigate to portfolio
   - Verify balance loads
   - Attempt a transaction
   - Verify transaction works

3. **Test app restart with created wallet**
   - Create wallet
   - Close app
   - Reopen app
   - Verify wallet loads correctly

### Manual Testing Checklist

- [ ] Create wallet with valid password - no crash
- [ ] Create wallet with mismatched passwords - shows error
- [ ] Create wallet with empty password - shows error
- [ ] Created wallet appears in portfolio
- [ ] Created wallet can send SOL
- [ ] Created wallet can send tokens
- [ ] Created wallet persists after app restart
- [ ] Created wallet works same as imported wallet

## Implementation Notes

### Key Changes Required

1. **wallet-creation-store.ts line 52**: Add `await` before `AsyncStorage.setItem`
2. **solana-wallet-store.ts line 238**: Ensure `await` before `AsyncStorage.setItem`
3. **Add error boundaries**: Wrap crypto operations in try-catch
4. **Verify loading states**: Ensure UI shows loading during operations

### Performance Considerations

The PBKDF2 operation with 310,000 iterations is intentionally heavy for security. The code already uses `runOffMainThread` in secure-storage.ts to handle this, so we don't need to change the crypto implementation. We just need to ensure proper async handling.

### Simplicity Principle

This fix follows the requirement to keep things simple:
- No new security layers
- No architectural changes
- No over-engineering
- Just fix the async/await bugs and error handling
- Verify wallet works throughout the app

## Verification Plan

After implementing the fix:

1. **Immediate verification**: Create wallet and verify no crash
2. **Functional verification**: Perform transaction with created wallet
3. **Persistence verification**: Restart app and verify wallet loads
4. **Comparison verification**: Compare created wallet behavior with imported wallet
5. **Edge case verification**: Test with various password inputs

The fix is complete when:
- Wallet creation doesn't crash
- Created wallet works for all operations
- No new bugs introduced
- Code is clean and simple
