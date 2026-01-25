import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { trpc } from '@/lib/trpc';
import { Alert } from 'react-native';

export interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  balance: number;
  value: number;
  logo?: string;
}

export interface CopiedWallet {
  id: string;
  username: string;
  walletAddress: string;
  roi: number;
  pnl: number;
  totalAmount?: number;
  amountPerTrade?: number;
  stopLoss?: number;
  takeProfit?: number;
  slippage?: number;
}

export interface QueueStatus {
  activeJobs: number;
  waitingJobs: number;
  failedJobs: number;
  health: 'healthy' | 'degraded' | 'down';
}

export interface OptimisticUpdate {
  tokenId: string;
  originalBalance: number;
  pendingDelta: number;
  timestamp: number;
}

export const [WalletProvider, useWallet] = createContextHook(() => {
  // ✅ Use portfolio overview for real balance and prices
  const overviewQuery = trpc.portfolio.getOverview.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every 60s
  });

  // ✅ Use portfolio PnL for real profit/loss
  const pnlQuery = trpc.portfolio.getPNL.useQuery(
    { period: '1d' },
    { refetchInterval: 300000 } // Refresh every 5 minutes
  );

  // Fetch token holdings for token list
  const tokensQuery = trpc.wallet.getTokens.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every 60s
  });

  // Fetch token metadata for all token mints
  const metadataQuery = trpc.wallet.getTokenMetadata.useQuery(
    { mints: tokensQuery.data?.tokens.map(token => token.mint) || [] },
    {
      enabled: !!tokensQuery.data?.tokens.length,
      refetchInterval: 300000, // Cache metadata for 5 minutes
    }
  );

  // Fetch asset breakdown for real token prices and values
  const assetBreakdownQuery = trpc.portfolio.getAssetBreakdown.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every 60s
  });

  // Fetch copy trades
  const copyTradesQuery = trpc.copyTrading.getMyCopyTrades.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // ✅ Copy wallet edit mutation
  const updateSettingsMutation = trpc.copyTrading.updateSettings.useMutation({
    onSuccess: () => {
      // Refetch copy trades after successful update
      void copyTradesQuery.refetch();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update copy trade settings');
    },
  });

  // ✅ Comment 3: Queue status polling
  const queueStatusQuery = trpc.queue.getStatus.useQuery(undefined, {
    refetchInterval: 10000, // Poll every 10 seconds
    retry: false, // Don't retry on failure
  });

  const queueStatus: QueueStatus = {
    activeJobs: queueStatusQuery.data?.activeJobs || 0,
    waitingJobs: queueStatusQuery.data?.waitingJobs || 0,
    failedJobs: queueStatusQuery.data?.failedJobs || 0,
    health: queueStatusQuery.data?.health || 'healthy',
  };

  // ✅ Comment 4: Optimistic UI state
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, OptimisticUpdate>>(new Map());

  // Apply optimistic update (called before transaction)
  const applyOptimisticUpdate = useCallback((tokenId: string, delta: number, currentBalance: number) => {
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      next.set(tokenId, {
        tokenId,
        originalBalance: currentBalance,
        pendingDelta: delta,
        timestamp: Date.now(),
      });
      return next;
    });
  }, []);

  // Revert optimistic update (called on transaction failure)
  const revertOptimisticUpdate = useCallback((tokenId: string) => {
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      next.delete(tokenId);
      return next;
    });
  }, []);

  // Confirm optimistic update (called on transaction success, then refetch)
  const confirmOptimisticUpdate = useCallback(async (tokenId: string) => {
    // Remove the optimistic update
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      next.delete(tokenId);
      return next;
    });
    // Refetch real data
    await tokensQuery.refetch();
    await assetBreakdownQuery.refetch();
  }, [tokensQuery, assetBreakdownQuery]);

  // Clean up stale optimistic updates (older than 60 seconds)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        for (const [key, update] of next.entries()) {
          if (now - update.timestamp > 60000) {
            next.delete(key);
          }
        }
        return next.size !== prev.size ? next : prev;
      });
    }, 30000);
    return () => clearInterval(cleanup);
  }, []);

  // ✅ Get real values from backend
  const totalBalance = overviewQuery.data?.totalValue || 0;
  const dailyPnl = pnlQuery.data?.netProfit || 0;
  const solPrice = overviewQuery.data?.solPrice || 0;

  // Build metadata lookup map from array
  const metadataMap = metadataQuery.data?.metadata?.reduce((acc, meta) => {
    acc[meta.mint] = meta;
    return acc;
  }, {} as Record<string, any>) || {};

  // Build asset price lookup from asset breakdown (real prices from DexScreener)
  const assetPriceMap = assetBreakdownQuery.data?.assets?.reduce((acc, asset) => {
    acc[asset.mint] = { price: asset.price, value: asset.value };
    return acc;
  }, {} as Record<string, { price: number; value: number }>) || {};

  // SOL token metadata constants
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const SOL_LOGO = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';

  // Transform tokens data with metadata, REAL prices, and optimistic updates
  // Now includes SOL as the first token
  const tokens: Token[] = useMemo(() => {
    // Create SOL token from backend sol balance
    const solBalance = tokensQuery.data?.sol || 0;
    const solOptimisticUpdate = optimisticUpdates.get(SOL_MINT);
    const adjustedSolBalance = solOptimisticUpdate
      ? solOptimisticUpdate.originalBalance + solOptimisticUpdate.pendingDelta
      : solBalance;

    const solToken: Token | null = solBalance > 0 || adjustedSolBalance > 0 ? {
      id: SOL_MINT,
      symbol: 'SOL',
      name: 'Solana',
      price: solPrice,
      change24h: 0,
      balance: adjustedSolBalance,
      value: adjustedSolBalance * solPrice,
      logo: SOL_LOGO,
    } : null;

    // Map SPL tokens
    const splTokens: Token[] = tokensQuery.data?.tokens.map(token => {
      const metadata = metadataMap[token.mint];
      const priceData = assetPriceMap[token.mint];
      const optimisticUpdate = optimisticUpdates.get(token.mint);

      // Apply optimistic balance if pending
      const balance = optimisticUpdate
        ? optimisticUpdate.originalBalance + optimisticUpdate.pendingDelta
        : token.balance;
      const price = priceData?.price || 0;

      return {
        id: token.mint,
        symbol: metadata?.symbol || 'UNKNOWN',
        name: metadata?.name || 'Unknown Token',
        price,                                    // ✅ Real price from DexScreener
        change24h: 0,                             // Would need historical data
        balance,                                  // ✅ With optimistic updates
        value: balance * price,                   // ✅ Recalculated with optimistic balance
        logo: metadata?.logoURI,
      };
    }) || [];

    // Return SOL first, then SPL tokens
    return solToken ? [solToken, ...splTokens] : splTokens;
  }, [tokensQuery.data, metadataMap, assetPriceMap, optimisticUpdates, solPrice]);

  // ✅ Memoize copiedWallets transformation
  const copiedWallets: CopiedWallet[] = useMemo(() => {
    return copyTradesQuery.data?.map(ct => ({
      id: ct.id,
      username: ct.trader.username || 'Unknown',
      walletAddress: ct.trader.walletAddress,
      roi: ct.trader.totalROI,
      pnl: ct.totalProfit,
      totalAmount: ct.totalBudget,
      amountPerTrade: ct.amountPerTrade,
      stopLoss: ct.stopLoss || undefined,
      takeProfit: ct.takeProfit || undefined,
      slippage: ct.slippage || undefined,
    })) || [];
  }, [copyTradesQuery.data]);

  const refetch = async () => {
    await Promise.all([
      overviewQuery.refetch(),
      pnlQuery.refetch(),
      tokensQuery.refetch(),
      metadataQuery.refetch(),
      assetBreakdownQuery.refetch(),
      copyTradesQuery.refetch(),
    ]);
  };

  const updateCopiedWallet = async (
    id: string,
    updates: Partial<CopiedWallet>,
    totpCode: string
  ): Promise<boolean> => {
    // ✅ Call trpc.copyTrading.updateSettings mutation
    try {
      await updateSettingsMutation.mutateAsync({
        copyTradingId: id,
        totalBudget: updates.totalAmount,
        amountPerTrade: updates.amountPerTrade,
        stopLoss: updates.stopLoss ? -Math.abs(updates.stopLoss) : undefined,
        takeProfit: updates.takeProfit ? Math.abs(updates.takeProfit) : undefined,
        maxSlippage: updates.slippage,
        totpCode,
      });
      return true;
    } catch (error) {
      console.error('[wallet-store] updateCopiedWallet error:', error);
      return false;
    }
  };

  return {
    tokens,
    copiedWallets,
    totalBalance,    // ✅ Real value from portfolio.getOverview
    dailyPnl,        // ✅ Real PnL from portfolio.getPNL
    solPrice,        // ✅ Real SOL price
    isLoading: overviewQuery.isLoading || pnlQuery.isLoading || tokensQuery.isLoading || metadataQuery.isLoading || assetBreakdownQuery.isLoading,
    refetch,
    updateCopiedWallet,
    isUpdatingCopyTrade: updateSettingsMutation.isPending, // ✅ Loading state for edit
    // ✅ Comment 3: Queue status
    queueStatus,
    isQueueHealthy: queueStatus.health === 'healthy',
    // ✅ Comment 4: Optimistic UI helpers
    applyOptimisticUpdate,
    revertOptimisticUpdate,
    confirmOptimisticUpdate,
    hasPendingOptimisticUpdates: optimisticUpdates.size > 0,
  };
});