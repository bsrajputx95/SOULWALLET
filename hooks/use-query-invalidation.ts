/**
 * Query invalidation utilities for tRPC
 * Task 13.2: Add query invalidation after mutations
 */
import { trpc } from '@/lib/trpc';

/**
 * Hook providing query invalidation utilities
 */
export function useQueryInvalidation() {
  const utils = trpc.useUtils();

  return {
    /**
     * Invalidate all copy trading related queries
     */
    invalidateCopyTrading: async () => {
      await Promise.all([
        utils.copyTrading.getMyCopyTrades.invalidate(),
        utils.copyTrading.getStats.invalidate(),
        utils.copyTrading.getOpenPositions.invalidate(),
        utils.copyTrading.getTopTraders.invalidate(),
      ]);
    },

    /**
     * Invalidate portfolio related queries
     */
    invalidatePortfolio: async () => {
      await Promise.all([
        utils.portfolio.getOverview.invalidate(),
        utils.portfolio.getHistory.invalidate(),
      ]);
    },

    /**
     * Invalidate wallet related queries
     */
    invalidateWallet: async () => {
      await Promise.all([
        utils.wallet.getBalance.invalidate(),
        utils.wallet.getTransactions.invalidate(),
      ]);
    },

    /**
     * Invalidate social feed queries
     */
    invalidateSocial: async () => {
      await utils.social.getFeed.invalidate();
    },

    /**
     * Invalidate all queries (use sparingly)
     */
    invalidateAll: async () => {
      await utils.invalidate();
    },
  };
}
