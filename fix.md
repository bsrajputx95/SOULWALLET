# SoulWallet - QuickBuy & Swap Fix Plan

## Executive Summary
Two critical issues are affecting the trading functionality:
1. **QuickBuy**: Token verification fails with "No procedure found on path 'market.verifyToken'"
2. **Swap**: Transaction fails with "Unable to transform response from server" (serialization error)

---

## Issue 1: QuickBuy Token Verification Failure

### Error Message
```
TRPCClientError: No procedure found on path "market.verifyToken"
```

### Root Cause Analysis
The `market.verifyToken` procedure exists in `src/server/routers/market.ts` (line 226-336) and is correctly registered in `appRouter` (src/server/index.ts line 56). The error indicates a **client-server type mismatch**.

**Likely causes:**
1. The client-side `AppRouter` types are stale/out of sync with the server
2. tRPC client is sending requests before types are regenerated after server changes
3. Possible build cache issue causing old types to be used

### Files Affected
- `components/QuickBuyModal.tsx` (line 92) - Client call
- `src/server/routers/market.ts` (line 226-336) - Server procedure
- `lib/trpc.ts` - tRPC client configuration
- `src/server/types.ts` - Type exports

### Fix Steps

#### Step 1: Regenerate Types (Immediate Fix)
```bash
# From project root
npm run build:server  # or yarn build:server
# Then regenerate client types
npx trpc-client-codegen  # if using codegen
```

If no codegen, ensure types are properly exported:

```typescript
// src/server/types.ts (verify this is correct)
import type { AppRouter as AppRouterType } from './index';
export type AppRouter = AppRouterType;
```

#### Step 2: Verify tRPC Version Consistency
Check `package.json` for consistent versions:
```json
{
  "@trpc/client": "^10.x.x",  // Must match server
  "@trpc/server": "^10.x.x",  // Must match client
  "@trpc/react-query": "^10.x.x"  // Must match both
}
```

Run:
```bash
npm ls @trpc/client @trpc/server @trpc/react-query
```

#### Step 3: Clear Build Cache
```bash
# Clear all caches
rm -rf node_modules/.cache
rm -rf .expo
rm -rf dist
rm -rf .next  # if Next.js
npm run clean  # if available
npm install
npm run build
```

#### Step 4: Verify Server Deployment
Ensure the deployed server has the latest `marketRouter`:
```bash
# Check if verifyToken exists in deployed server
curl -X POST https://your-api-url/api/v1/trpc/market.verifyToken \
  -H "Content-Type: application/json" \
  -d '{"json":{"tokenAddress":"So11111111111111111111111111111111111111112"}}'
```

---

## Issue 2: Swap Serialization Error

### Error Message
```
TRPCClientError: Unable to transform response from server
Response serialization error. Please try again.
```

### Root Cause Analysis
The Jupiter API returns `lastValidBlockHeight` as a BigInt, which superjson cannot serialize properly. The current code attempts to convert with `Number()` but this may fail for:
1. Very large BigInt values
2. Nested BigInt values in the response
3. String values that need parsing first

**Location of issue:** `src/server/routers/swap.ts` line 176-186

### Files Affected
- `src/server/routers/swap.ts` - Swap mutation handler
- `src/lib/services/jupiterSwap.ts` - Jupiter API wrapper
- `hooks/solana-wallet-store.ts` - Client-side swap execution

### Fix Steps

#### Step 1: Create BigInt Sanitization Utility
Create a new file `src/lib/utils/sanitize.ts`:

```typescript
/**
 * Recursively sanitize an object to convert BigInt values to numbers
 * Handles nested objects, arrays, and edge cases
 */
export function sanitizeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    // Safe conversion - check for overflow
    const num = Number(obj);
    if (!Number.isFinite(num)) {
      // For very large BigInts, convert to string
      return obj.toString() as unknown as T;
    }
    return num as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeBigInt) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeBigInt(value);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Safely convert a value to a finite number
 * Returns 0 for invalid inputs
 */
export function toSafeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'bigint') {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  
  return 0;
}
```

#### Step 2: Fix swap.ts Response Handling
Update `src/server/routers/swap.ts` (around line 95-186):

```typescript
// At the top, add import
import { sanitizeBigInt, toSafeNumber } from '../../lib/utils/sanitize';

// In the swap mutation, replace lines 171-186 with:
try {
  if (!input.totpCode) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA code is required' })
  }
  await verifyTotpForUser(ctx.user.id, input.totpCode)

  // Get quote from Jupiter
  const quote = await jupiterSwap.getQuote({
    inputMint: input.fromMint,
    outputMint: input.toMint,
    amount: Math.floor(input.amount * DECIMALS.MICRO_LAMPORTS),
    slippageBps: Math.floor(input.slippage * (FEES.SWAP.SLIPPAGE_BPS.MAX / FEES.SWAP.SLIPPAGE_PERCENT.MAX)),
  });

  if (!quote) {
    throw new Error('Could not get swap quote');
  }

  // Get swap transaction
  const swapTx = await jupiterSwap.getSwapTransaction({
    quoteResponse: quote,
    userPublicKey: user.walletAddress,
    wrapAndUnwrapSol: true,
    asLegacyTransaction: true,
  });

  if (!swapTx?.swapTransaction) {
    throw new Error('Could not get swap transaction from Jupiter');
  }

  // ... (transaction creation code stays the same)

  // CRITICAL: Sanitize ALL numeric values before returning
  // This prevents BigInt serialization errors
  const outputAmount = toSafeNumber(quote.outAmount) / 1_000_000;
  const priceImpact = toSafeNumber(quote.priceImpactPct);
  const lastValidBlockHeight = toSafeNumber(swapTx.lastValidBlockHeight);

  return {
    swapTransaction: swapTx.swapTransaction,
    lastValidBlockHeight,
    transactionId: transaction.id,
    inputAmount: toSafeNumber(input.amount),
    outputAmount,
    priceImpact,
    fee: 0.00005,
  };
} catch (error) {
  logger.error('Swap failed:', error);
  
  // Check for serialization errors specifically
  const errorMsg = error instanceof Error ? error.message : String(error);
  if (errorMsg.includes('BigInt') || errorMsg.includes('serialize') || errorMsg.includes('transform')) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Response processing error. Please try again.',
    });
  }
  
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Swap failed',
  });
}
```

#### Step 3: Fix jupiterSwap.ts Response Type
Update `src/lib/services/jupiterSwap.ts` to sanitize responses:

```typescript
// Update getSwapTransaction method (around line 242-279)
async getSwapTransaction(params: SwapTransactionParams): Promise<SwapResponse | null> {
  return this.swapBreaker.exec(
    async () => {
      return retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUTS.EXTERNAL_API);

        try {
          const response = await fetch(`${this.baseUrl}/swap`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
            signal: controller.signal,
          });

          if (!response.ok) {
            const error = await response.text();
            logger.error(`Failed to get swap transaction: ${response.status} - ${error}`);
            throw new Error(`Swap transaction fetch failed: ${error}`);
          }

          const rawResponse = await response.json();
          
          // CRITICAL: Sanitize the response to handle BigInt values
          const swapResponse: SwapResponse = {
            swapTransaction: rawResponse.swapTransaction,
            lastValidBlockHeight: Number(rawResponse.lastValidBlockHeight) || 0,
            prioritizationFeeLamports: rawResponse.prioritizationFeeLamports 
              ? Number(rawResponse.prioritizationFeeLamports) 
              : undefined,
          };
          
          return swapResponse;
        } finally {
          clearTimeout(timeout);
        }
      }, { maxRetries: TIMEOUTS.RETRY.MAX_ATTEMPTS, initialDelayMs: TIMEOUTS.RETRY.INITIAL_DELAY_MS });
    },
    () => {
      logger.warn('Jupiter swap circuit breaker open, returning null');
      return null;
    }
  );
}
```

#### Step 4: Improve Client-Side Error Handling
Update `hooks/solana-wallet-store.ts` (around line 957-1007):

```typescript
} catch (error: any) {
  // Revert optimistic updates
  if (inputMintForOptimistic) {
    revertOptimisticBalanceUpdate(inputMintForOptimistic);
  }
  if (outputMintForOptimistic && expectedOutputForOptimistic > 0) {
    revertOptimisticBalanceUpdate(outputMintForOptimistic);
  }

  logger.error('Error executing swap:', error);
  setState(prev => ({ ...prev, isLoading: false }));

  const errorMessage = error?.message || String(error);

  // More specific error detection
  if (errorMessage.includes('transform') || 
      errorMessage.includes('serialize') ||
      errorMessage.includes('superjson') || 
      errorMessage.includes('BigInt') ||
      errorMessage.includes('Response processing')) {
    throw new Error('Transaction data error. Please try again.');
  }

  // ... rest of error handling
}
```

---

## Verification Steps

### After Applying Fixes

1. **Rebuild the project:**
   ```bash
   npm run clean
   npm install
   npm run build
   ```

2. **Test QuickBuy:**
   - Enter a valid token address (e.g., USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
   - Verify token info loads correctly
   - Check console for any tRPC errors

3. **Test Swap:**
   - Attempt a small SOL → USDC swap
   - Verify the swap quote loads
   - Complete the swap with 2FA
   - Check transaction completes without serialization errors

4. **Server-side verification:**
   ```bash
   # Test verifyToken endpoint
   curl -X POST https://your-api/api/v1/trpc/market.verifyToken \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"json":{"tokenAddress":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}}'
   ```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/utils/sanitize.ts` | NEW: BigInt sanitization utilities |
| `src/server/routers/swap.ts` | FIX: Sanitize all numeric responses |
| `src/lib/services/jupiterSwap.ts` | FIX: Sanitize Jupiter API responses |
| `hooks/solana-wallet-store.ts` | FIX: Improved error detection |

---

## Priority
- **P0 (Critical)**: Both fixes are critical for MVP functionality
- **Estimated effort**: 2-4 hours
- **Risk**: Low - changes are isolated to response handling

## Notes
- Do NOT add new features - focus only on making existing functionality work
- Test with real tokens and small amounts first
- Monitor server logs for any new serialization errors after deployment
