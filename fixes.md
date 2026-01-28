I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase has three critical issues affecting user experience: (1) Swap transactions fail with BigInt serialization errors despite existing `sanitizeBigInt` utility usage, (2) Wallet sessions expire prematurely requiring password re-entry on every app restart, and (3) Quick Buy token verification times out frequently on mobile networks. The swap router in `file:src/server/routers/swap.ts` already uses sanitization but may miss deeply nested BigInt fields. Session management in `file:hooks/solana-wallet-store.ts` stores credentials in SecureStore/AsyncStorage with 24-hour expiry but lacks persistence validation. Token verification in `file:src/server/routers/market.ts` uses 5-second timeouts without retry logic.

## Approach

Fix all three issues with targeted, minimal changes: (1) Add comprehensive deep sanitization to swap responses ensuring all nested BigInt fields are converted, (2) Enhance session persistence with validation checks and fallback mechanisms to prevent premature expiry, (3) Increase token verification timeouts and add retry logic with exponential backoff. Focus on reliability improvements without architectural changes, using existing utilities (`sanitize.ts`, `retry.ts`) and patterns. Add defensive error handling and logging throughout to prevent cascading failures.

## Implementation Steps

### 1. Fix Swap Serialization Error

**1.1 Enhance BigInt Sanitization in Swap Router**

In `file:src/server/routers/swap.ts`:

- **Lines 148-164**: The current sanitization might miss nested objects in `quote.routePlan` or other deep fields
- Add recursive deep sanitization before returning the swap response
- Ensure ALL fields including `quote.routePlan[].swapInfo`, `quote.platformFee`, and any nested objects are sanitized
- Wrap the entire return object in `sanitizeBigInt` to catch any missed fields

**Implementation:**
```
// After line 154, before return statement
const sanitizedResponse = sanitizeBigInt({
  swapTransaction: sanitizedSwapTx.swapTransaction,
  lastValidBlockHeight,
  transactionId: transaction.id,
  inputAmount: toSafeNumber(input.amount),
  outputAmount,
  priceImpact,
  fee: 0.00005,
});

return sanitizedResponse;
```

**1.2 Add Defensive Sanitization in Jupiter Swap Service**

In `file:src/lib/services/jupiterSwap.ts`:

- **Lines 266-274**: The manual conversion might miss fields
- Import `sanitizeBigInt` from `file:src/lib/utils/sanitize.ts`
- Apply sanitization to the entire `rawResponse` object before extracting fields
- This ensures any new fields added by Jupiter API are automatically handled

**Implementation:**
```
// After line 266, before extracting fields
const sanitizedResponse = sanitizeBigInt(rawResponse);

const swapResponse: SwapResponse = {
  swapTransaction: sanitizedResponse.swapTransaction,
  lastValidBlockHeight: toSafeNumber(sanitizedResponse.lastValidBlockHeight),
  prioritizationFeeLamports: sanitizedResponse.prioritizationFeeLamports 
    ? toSafeNumber(sanitizedResponse.prioritizationFeeLamports) 
    : undefined,
};
```

**1.3 Add Sanitization to Quote Response**

In `file:src/lib/services/jupiterSwap.ts`:

- **Lines 150-160**: The quote response might contain BigInt in `routePlan` or `platformFee`
- Apply `sanitizeBigInt` to the entire quote object after parsing
- This catches any nested BigInt fields in route plan steps

**Implementation:**
```
// After line 150, replace quote assignment
const rawQuote = await response.json();
const quote = sanitizeBigInt(rawQuote) as QuoteResponse;
```

**1.4 Add Error Logging for Debugging**

In `file:src/server/routers/swap.ts`:

- **Line 166**: Add detailed error logging to identify which field causes serialization issues
- Log the error type and problematic field path
- This helps identify any remaining serialization issues

**Implementation:**
```
// Replace line 166-170
} catch (error) {
  logger.error('Swap failed:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    inputMints: { from: input.fromMint, to: input.toMint },
  });
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Swap failed. Please try again.',
  });
}
```

### 2. Fix Session Persistence

**2.1 Add Session Validation on Save**

In `file:hooks/solana-wallet-store.ts`:

- **Lines 210-224**: Add validation after saving session to ensure it was persisted
- Read back the session immediately after saving to verify
- If validation fails, log warning but don't throw (graceful degradation)

**Implementation:**
```
// After line 220, add validation
const savedSession = await AsyncStorage.getItem(SESSION_KEY);
const savedPassword = await getSecureItem('wallet_session_pwd');

if (!savedSession || !savedPassword) {
  logger.warn('Session save validation failed - storage may not persist');
  // Don't throw - wallet is still unlocked, just won't auto-restore
} else {
  logger.info('Wallet session saved and validated, expires in 24 hours');
}
```

**2.2 Add Fallback Session Storage**

In `file:hooks/solana-wallet-store.ts`:

- **Lines 217-220**: Add redundant storage in both AsyncStorage and SecureStore
- Store session metadata in both locations as backup
- On restore, try both locations (SecureStore first, AsyncStorage fallback)

**Implementation:**
```
// After line 217, add redundant storage
await Promise.all([
  AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)),
  setSecureItem('wallet_session_backup', JSON.stringify(session)),
]);

// Also store password in both locations
await Promise.all([
  setSecureItem('wallet_session_pwd', password),
  AsyncStorage.setItem('wallet_session_pwd_backup', password), // Less secure but better than nothing
]);
```

**2.3 Enhance Session Restore with Fallback**

In `file:hooks/solana-wallet-store.ts`:

- **Lines 227-254**: Add fallback logic to try backup storage if primary fails
- Try SecureStore first, then AsyncStorage backup
- Log which storage method succeeded for debugging

**Implementation:**
```
// Replace getValidSession function (lines 227-254)
const getValidSession = async (): Promise<{ session: WalletSession; password: string } | null> => {
  try {
    // Try primary storage first
    let sessionStr = await AsyncStorage.getItem(SESSION_KEY);
    let password = await getSecureItem('wallet_session_pwd');

    // Fallback to backup storage if primary failed
    if (!sessionStr) {
      logger.info('Primary session not found, trying backup...');
      sessionStr = await getSecureItem('wallet_session_backup');
    }
    if (!password) {
      logger.info('Primary password not found, trying backup...');
      password = await AsyncStorage.getItem('wallet_session_pwd_backup');
    }

    if (!sessionStr || !password) {
      logger.info('No session found in any storage location');
      return null;
    }

    const session: WalletSession = JSON.parse(sessionStr);

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      logger.info('Wallet session expired, clearing');
      await clearSession();
      return null;
    }

    logger.info('Valid session restored from storage');
    return { session, password };
  } catch (error) {
    logger.warn('Failed to get wallet session:', error);
    return null;
  }
};
```

**2.4 Add Session Refresh on App Resume**

In `file:hooks/solana-wallet-store.ts`:

- **After line 184**: Add AppState listener to refresh session expiry when app resumes
- Extend session expiry by 24 hours on each app resume if wallet is unlocked
- This prevents session expiry for active users

**Implementation:**
```
// Add after line 184, inside useEffect
import { AppState } from 'react-native';

const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
  if (nextAppState === 'active' && state.wallet && !state.needsUnlock) {
    // Wallet is unlocked, extend session
    const sessionData = await getValidSession();
    if (sessionData) {
      const extendedSession: WalletSession = {
        ...sessionData.session,
        expiresAt: Date.now() + SESSION_EXPIRY_MS,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(extendedSession));
      await setSecureItem('wallet_session_backup', JSON.stringify(extendedSession));
      logger.info('Session expiry extended on app resume');
    }
  }
});

return () => {
  appStateSubscription.remove();
};
```

**2.5 Clear Backup Storage on Session Clear**

In `file:hooks/solana-wallet-store.ts`:

- **Lines 257-265**: Also clear backup storage locations
- Ensure complete cleanup to prevent stale data

**Implementation:**
```
// Replace clearSession function (lines 257-265)
const clearSession = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(SESSION_KEY),
      AsyncStorage.removeItem('wallet_session_pwd_backup'),
      deleteSecureItem('wallet_session_pwd'),
      deleteSecureItem('wallet_session_backup'),
    ]);
    logger.info('Wallet session cleared from all storage locations');
  } catch (error) {
    logger.warn('Failed to clear wallet session:', error);
  }
};
```

### 3. Fix Quick Buy Token Verification

**3.1 Increase Timeout and Add Retry Logic**

In `file:src/server/routers/market.ts`:

- **Lines 234-241**: Increase timeout from 5s to 10s for strict API
- Add retry logic with exponential backoff using `file:src/lib/utils/retry.ts`
- Retry up to 3 times with 1s, 2s, 4s delays

**Implementation:**
```
// Replace lines 234-241
import { retryWithBackoff } from '../../lib/utils/retry';

const strictResponse = await retryWithBackoff(
  async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // Increased to 10s

    try {
      const response = await fetch(`https://tokens.jup.ag/token/${address}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  },
  { 
    maxRetries: 3, 
    initialDelayMs: 1000,
    maxDelayMs: 4000,
  }
);
```

**3.2 Add Retry to Quote API Fallback**

In `file:src/server/routers/market.ts`:

- **Lines 274-282**: Increase timeout from 5s to 10s for quote API
- Add same retry logic as strict API
- This handles transient network issues on mobile

**Implementation:**
```
// Replace lines 274-282
const quoteResponse = await retryWithBackoff(
  async () => {
    const quoteController = new AbortController();
    const quoteTimeout = setTimeout(() => quoteController.abort(), 10000); // Increased to 10s

    try {
      const response = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${address}&amount=10000000&slippageBps=100`,
        { signal: quoteController.signal }
      );
      clearTimeout(quoteTimeout);
      return response;
    } catch (error) {
      clearTimeout(quoteTimeout);
      throw error;
    }
  },
  { 
    maxRetries: 3, 
    initialDelayMs: 1000,
    maxDelayMs: 4000,
  }
);
```

**3.3 Add Better Error Messages**

In `file:src/server/routers/market.ts`:

- **Lines 329-335**: Improve error messages to distinguish between timeout and network errors
- Add specific guidance for each error type

**Implementation:**
```
// Replace lines 329-335
} catch (error) {
  if (error instanceof TRPCError) throw error;
  
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  if (errorMsg.includes('AbortError') || errorMsg.includes('timeout')) {
    throw new TRPCError({
      code: 'TIMEOUT',
      message: 'Token verification timed out after multiple retries. The network may be slow or the token may not exist.',
    });
  }
  
  if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Network error during token verification. Please check your connection and try again.',
    });
  }
  
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unable to verify token. Please check the address and try again.',
  });
}
```

**3.4 Add Loading State Feedback in QuickBuyModal**

In `file:components/QuickBuyModal.tsx`:

- **Lines 82-84**: Add more detailed loading messages during verification
- Show retry attempts to user for transparency
- This improves perceived performance

**Implementation:**
```
// Add state for retry count
const [retryCount, setRetryCount] = useState(0);

// Update verification loading message (around line 262-266)
{isVerifying ? (
  <View style={styles.verifyingContainer}>
    <ActivityIndicator size="small" color={COLORS.solana} />
    <Text style={styles.verifyingText}>
      Verifying token{retryCount > 0 ? ` (attempt ${retryCount + 1}/4)` : ''}...
    </Text>
  </View>
) : (
  <Search size={20} color={COLORS.solana} />
)}
```

**3.5 Add Timeout Configuration Constant**

In `file:constants/timeouts.ts`:

- **After line 16**: Add specific timeout for token verification
- Make it configurable for future adjustments

**Implementation:**
```
// Add after line 16
TOKEN_VERIFICATION: {
  TIMEOUT_MS: 10_000,
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1_000,
},
```

### 4. Add Comprehensive Error Logging

**4.1 Enhance Client Logger**

In `file:lib/client-logger.ts`:

- **After line 24**: Add structured logging for critical errors
- Include timestamp and error context
- This helps debug issues in production

**Implementation:**
```
// Add after line 24
logCritical: (context: string, error: any, metadata?: Record<string, any>) => {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : String(error),
    metadata,
  };
  console.error('[CRITICAL]', JSON.stringify(errorDetails, null, 2));
},
```

**4.2 Add Critical Error Logging to Swap**

In `file:hooks/solana-wallet-store.ts`:

- **Line 969**: Use new critical logger for swap failures
- Include full error context for debugging

**Implementation:**
```
// Replace line 969
logger.logCritical('Swap execution failed', error, {
  inputMint: inputMintForOptimistic,
  outputMint: outputMintForOptimistic,
  amount: inputAmountForOptimistic,
});
```

### 5. Testing & Validation

**5.1 Test Swap Serialization**
- Execute swaps with various token pairs
- Verify no serialization errors in response
- Check that all BigInt fields are converted to numbers/strings

**5.2 Test Session Persistence**
- Create wallet and unlock with password
- Close app completely (force quit)
- Reopen app and verify wallet auto-restores without password prompt
- Test session expiry after 24 hours
- Test app resume session extension

**5.3 Test Token Verification**
- Test with valid tokens (verified and unverified)
- Test with invalid/non-existent addresses
- Test on slow network (throttle to 3G)
- Verify retry attempts and timeout handling
- Check error messages are user-friendly

## Summary

This plan addresses all three critical issues with minimal, targeted changes:

1. **Swap Serialization**: Deep sanitization of all response objects ensures no BigInt fields escape
2. **Session Persistence**: Redundant storage + validation + app resume extension prevents premature expiry
3. **Token Verification**: Increased timeouts + retry logic + better errors handles mobile network issues

All changes use existing utilities and patterns, maintain backward compatibility, and add defensive error handling throughout.