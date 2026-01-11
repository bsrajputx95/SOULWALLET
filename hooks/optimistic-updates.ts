/**
 * Optimistic Update Helpers for Wallet Operations
 * 
 * These helpers wrap the optimistic update functions from wallet-store
 * and provide a clean interface for use in solana-wallet-store transactions.
 * 
 * Call flow:
 * 1. Before transaction: applyOptimistic(mint, -amount, currentBalance)
 * 2. On success: confirmOptimistic(mint)
 * 3. On failure: revertOptimistic(mint)
 */

import { useWallet } from './wallet-store';

// SOL native mint address
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Apply optimistic update before a transaction
 * Shows the expected balance change immediately in UI
 */
export function applyOptimisticBalanceUpdate(
    tokenMint: string,
    delta: number,
    currentBalance: number
): boolean {
    try {
        const walletState = useWallet.getState();
        if (walletState?.applyOptimisticUpdate) {
            walletState.applyOptimisticUpdate(tokenMint, delta, currentBalance);
            return true;
        }
    } catch (e) {
        console.warn('[OptimisticUpdate] Failed to apply:', e);
    }
    return false;
}

/**
 * Confirm optimistic update after successful transaction
 * Drops the pending entry and triggers balance refetch
 */
export async function confirmOptimisticBalanceUpdate(tokenMint: string): Promise<boolean> {
    try {
        const walletState = useWallet.getState();
        if (walletState?.confirmOptimisticUpdate) {
            await walletState.confirmOptimisticUpdate(tokenMint);
            return true;
        }
    } catch (e) {
        console.warn('[OptimisticUpdate] Failed to confirm:', e);
    }
    return false;
}

/**
 * Revert optimistic update after failed transaction
 * Restores the previous balance in UI
 */
export function revertOptimisticBalanceUpdate(tokenMint: string): boolean {
    try {
        const walletState = useWallet.getState();
        if (walletState?.revertOptimisticUpdate) {
            walletState.revertOptimisticUpdate(tokenMint);
            return true;
        }
    } catch (e) {
        console.warn('[OptimisticUpdate] Failed to revert:', e);
    }
    return false;
}

/**
 * Wrapper for SOL send operations with optimistic updates
 */
export async function withOptimisticSolUpdate<T>(
    amount: number,
    currentBalance: number,
    operation: () => Promise<T>
): Promise<T> {
    // Apply optimistic update (negative delta for sending)
    applyOptimisticBalanceUpdate(SOL_MINT, -amount, currentBalance);

    try {
        const result = await operation();
        // Confirm on success
        await confirmOptimisticBalanceUpdate(SOL_MINT);
        return result;
    } catch (error) {
        // Revert on failure
        revertOptimisticBalanceUpdate(SOL_MINT);
        throw error;
    }
}

/**
 * Wrapper for token swap operations with optimistic updates
 */
export async function withOptimisticSwapUpdate<T>(
    inputMint: string,
    inputAmount: number,
    inputCurrentBalance: number,
    outputMint: string,
    expectedOutputAmount: number,
    outputCurrentBalance: number,
    operation: () => Promise<T>
): Promise<T> {
    // Apply optimistic updates for both input (negative) and output (positive)
    applyOptimisticBalanceUpdate(inputMint, -inputAmount, inputCurrentBalance);
    if (expectedOutputAmount > 0) {
        applyOptimisticBalanceUpdate(outputMint, expectedOutputAmount, outputCurrentBalance);
    }

    try {
        const result = await operation();
        // Confirm both on success
        await confirmOptimisticBalanceUpdate(inputMint);
        if (expectedOutputAmount > 0) {
            await confirmOptimisticBalanceUpdate(outputMint);
        }
        return result;
    } catch (error) {
        // Revert both on failure
        revertOptimisticBalanceUpdate(inputMint);
        if (expectedOutputAmount > 0) {
            revertOptimisticBalanceUpdate(outputMint);
        }
        throw error;
    }
}
