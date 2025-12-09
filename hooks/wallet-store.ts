import { useState, useEffect } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { trpc } from '@/lib/trpc';

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

  // Transform tokens data with metadata and REAL prices
  const tokens: Token[] = tokensQuery.data?.tokens.map(token => {
    const metadata = metadataMap[token.mint];
    const priceData = assetPriceMap[token.mint];
    return {
      id: token.mint,
      symbol: metadata?.symbol || 'UNKNOWN',
      name: metadata?.name || 'Unknown Token',
      price: priceData?.price || 0,           // ✅ Real price from DexScreener
      change24h: 0,                            // Would need historical data
      balance: token.balance,
      value: priceData?.value || token.balance * (priceData?.price || 0), // ✅ Real value
      logo: metadata?.logoURI,
    };
  }) || [];

  // Transform copy trades data
  const copiedWallets: CopiedWallet[] = copyTradesQuery.data?.map(ct => ({
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

  const updateCopiedWallet = async (_id: string, _updates: Partial<CopiedWallet>) => {
    // This would call trpc.copyTrading.updateSettings
    // For now, just refetch
    await refetch();
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
  };
});