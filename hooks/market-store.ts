import { useState, useCallback, useMemo, useEffect } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { trpc } from '@/lib/trpc';
import { 
  MarketFilters, 
  DEFAULT_FILTERS, 
  QuickFilterType,
  countActiveFilters 
} from '../types/market-filters';

export interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  liquidity?: number;
  volume?: number;
  marketCap?: number;
  fdv?: number;
  transactions?: number;
  buys24h?: number;
  sells24h?: number;
  buyRatio?: number; // buys / (buys + sells)
  pairAge?: number; // hours since pair creation
  logo?: string;
  verified?: boolean;
  pairToken?: string;
}

// QuickFilterType is used for backward compatibility with activeFilters

const PAGE_SIZE = 20;

export const [MarketProvider, useMarket] = createContextHook(() => {
  // ✅ Fetch real SoulMarket tokens from backend
  const { data: soulMarketData, isLoading: isLoadingMarket, refetch: refetchMarket } = trpc.market.soulMarket.useQuery(undefined, {
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Filter state
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);

  // Dummy data for UI testing when no real data is available
  const DUMMY_TOKENS: Token[] = [
    {
      id: 'dummy-sol-1',
      symbol: 'SOL',
      name: 'Solana',
      price: 185.42,
      change24h: 5.23,
      liquidity: 2500000,
      volume: 45000000,
      marketCap: 85000000000,
      fdv: 85000000000,
      transactions: 24000,
      buys24h: 15000,
      sells24h: 9000,
      buyRatio: 0.625, // 15000 / 24000
      pairAge: 8760, // 1 year
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      verified: true,
      pairToken: 'USDC',
    },
    {
      id: 'dummy-wif-2',
      symbol: 'WIF',
      name: 'dogwifhat',
      price: 2.34,
      change24h: -3.1,
      liquidity: 1200000,
      volume: 8500000,
      marketCap: 2300000000,
      fdv: 2300000000,
      transactions: 8500,
      buys24h: 4200,
      sells24h: 4300,
      buyRatio: 0.494, // 4200 / 8500
      pairAge: 720, // 30 days
      logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm.png',
      verified: true,
      pairToken: 'SOL',
    },
    {
      id: 'dummy-jup-3',
      symbol: 'JUP',
      name: 'Jupiter',
      price: 0.87,
      change24h: 12.5,
      liquidity: 890000,
      volume: 3200000,
      marketCap: 1200000000,
      fdv: 1500000000,
      transactions: 12000,
      buys24h: 8000,
      sells24h: 4000,
      buyRatio: 0.667, // 8000 / 12000
      pairAge: 2160, // 90 days
      logo: 'https://static.jup.ag/jup/icon.png',
      verified: true,
      pairToken: 'USDC',
    },
    {
      id: 'dummy-bonk-4',
      symbol: 'BONK',
      name: 'Bonk',
      price: 0.000023,
      change24h: 8.7,
      liquidity: 650000,
      volume: 1800000,
      marketCap: 1500000000,
      fdv: 2000000000,
      transactions: 18000,
      buys24h: 12000,
      sells24h: 6000,
      buyRatio: 0.667, // 12000 / 18000
      pairAge: 4320, // 180 days
      logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      verified: true,
      pairToken: 'SOL',
    },
    {
      id: 'dummy-ray-5',
      symbol: 'RAY',
      name: 'Raydium',
      price: 4.85,
      change24h: 2.7,
      liquidity: 2200000,
      volume: 15000000,
      marketCap: 750000000,
      fdv: 1000000000,
      transactions: 15000,
      buys24h: 9000,
      sells24h: 6000,
      buyRatio: 0.6, // 9000 / 15000
      pairAge: 17520, // 2 years
      logo: 'https://raw.githubusercontent.com/raydium-io/media-assets/master/logo/logo-only-icon.svg',
      verified: true,
      pairToken: 'USDC',
    },
  ];

  // Transform DexScreener data to Token format with extended fields
  const rawTokens = useMemo(() => {
    if (!soulMarketData || !('pairs' in soulMarketData) || !soulMarketData.pairs || (soulMarketData.pairs as any[]).length === 0) {
      // Return dummy data for UI testing when no real data
      return DUMMY_TOKENS;
    }
    
    return (soulMarketData.pairs as any[]).map((pair: any) => {
      const buys24h = pair.txns?.h24?.buys || 0;
      const sells24h = pair.txns?.h24?.sells || 0;
      const totalTxns = buys24h + sells24h;
      
      return {
        id: pair.pairAddress || `${pair.chainId}-${pair.dexId}`,
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        name: pair.baseToken?.name || 'Unknown Token',
        price: parseFloat(pair.priceUsd || '0'),
        change24h: parseFloat(pair.priceChange?.h24 || '0'),
        liquidity: parseFloat(pair.liquidity?.usd || '0'),
        volume: parseFloat(pair.volume?.h24 || '0'),
        marketCap: parseFloat(pair.marketCap || '0'),
        fdv: parseFloat(pair.fdv || '0'),
        transactions: totalTxns,
        buys24h,
        sells24h,
        buyRatio: totalTxns > 0 ? buys24h / totalTxns : 0,
        pairAge: pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) : undefined,
        logo: pair.info?.imageUrl,
        verified: pair.info?.verified || false,
        pairToken: pair.quoteToken?.symbol,
      };
    });
  }, [soulMarketData]);

  // Apply all filters
  const filteredTokens = useMemo(() => {
    let result = [...rawTokens];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(token =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query)
      );
    }

    // Quick filters (Beast filter thresholds - Comment 2)
    if (filters.quickFilters.includes('volume')) {
      result = result.filter(t => (t.volume || 0) >= 1000000); // $1M+ (beast threshold)
    }
    if (filters.quickFilters.includes('liquidity')) {
      result = result.filter(t => (t.liquidity || 0) >= 500000); // $500K+ (beast threshold)
    }
    if (filters.quickFilters.includes('change')) {
      result = result.filter(t => t.change24h > 0);
    }
    if (filters.quickFilters.includes('age')) {
      result = result.filter(t => (t.pairAge || Infinity) <= 24); // < 24h old
    }
    if (filters.quickFilters.includes('verified')) {
      result = result.filter(t => t.verified);
    }
    // New beast filter chips (Comment 2)
    if (filters.quickFilters.includes('buysRatio')) {
      result = result.filter(t => (t.buyRatio || 0) >= 0.6); // 60%+ buy ratio
    }
    if (filters.quickFilters.includes('txns')) {
      result = result.filter(t => (t.transactions || 0) >= 500); // 500+ txns
    }
    if (filters.quickFilters.includes('priceChange')) {
      result = result.filter(t => Math.abs(t.change24h) >= 5); // 5%+ price change
    }

    // Range filters - Liquidity
    if (filters.minLiquidity !== undefined) {
      result = result.filter(t => (t.liquidity || 0) >= filters.minLiquidity!);
    }
    if (filters.maxLiquidity !== undefined) {
      result = result.filter(t => (t.liquidity || 0) <= filters.maxLiquidity!);
    }

    // Range filters - Market Cap
    if (filters.minMarketCap !== undefined) {
      result = result.filter(t => (t.marketCap || 0) >= filters.minMarketCap!);
    }
    if (filters.maxMarketCap !== undefined) {
      result = result.filter(t => (t.marketCap || 0) <= filters.maxMarketCap!);
    }

    // Range filters - FDV
    if (filters.minFDV !== undefined) {
      result = result.filter(t => (t.fdv || 0) >= filters.minFDV!);
    }
    if (filters.maxFDV !== undefined) {
      result = result.filter(t => (t.fdv || 0) <= filters.maxFDV!);
    }

    // Range filters - Volume
    if (filters.minVolume24h !== undefined) {
      result = result.filter(t => (t.volume || 0) >= filters.minVolume24h!);
    }
    if (filters.maxVolume24h !== undefined) {
      result = result.filter(t => (t.volume || 0) <= filters.maxVolume24h!);
    }

    // Age filters
    if (filters.minAgeHours !== undefined) {
      result = result.filter(t => (t.pairAge || 0) >= filters.minAgeHours!);
    }
    if (filters.maxAgeHours !== undefined) {
      result = result.filter(t => (t.pairAge || Infinity) <= filters.maxAgeHours!);
    }

    // Transaction filters
    if (filters.min24hTxns !== undefined) {
      result = result.filter(t => (t.transactions || 0) >= filters.min24hTxns!);
    }
    if (filters.min24hBuys !== undefined) {
      result = result.filter(t => (t.buys24h || 0) >= filters.min24hBuys!);
    }
    if (filters.min24hSells !== undefined) {
      result = result.filter(t => (t.sells24h || 0) >= filters.min24hSells!);
    }

    // Pair filter
    if (filters.pairToken) {
      result = result.filter(t => 
        t.pairToken?.toLowerCase() === filters.pairToken!.toLowerCase()
      );
    }

    // Advanced beast filters (Comment 2)
    if (filters.buyRatioMin !== undefined) {
      result = result.filter(t => (t.buyRatio || 0) >= filters.buyRatioMin!);
    }
    if (filters.minPriceChange24h !== undefined) {
      result = result.filter(t => Math.abs(t.change24h) >= filters.minPriceChange24h!);
    }

    // Sorting
    if (filters.sortBy) {
      result.sort((a, b) => {
        let aVal = 0, bVal = 0;
        switch (filters.sortBy) {
          case 'liquidity': aVal = a.liquidity || 0; bVal = b.liquidity || 0; break;
          case 'volume': aVal = a.volume || 0; bVal = b.volume || 0; break;
          case 'change': aVal = a.change24h; bVal = b.change24h; break;
          case 'marketCap': aVal = a.marketCap || 0; bVal = b.marketCap || 0; break;
          case 'age': aVal = a.pairAge || Infinity; bVal = b.pairAge || Infinity; break;
          case 'price': aVal = a.price; bVal = b.price; break;
        }
        return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [rawTokens, searchQuery, filters]);

  // Paginated tokens
  const paginatedTokens = useMemo(() => {
    return filteredTokens.slice(0, page * PAGE_SIZE);
  }, [filteredTokens, page]);

  const hasMore = paginatedTokens.length < filteredTokens.length;

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, searchQuery]);

  // Legacy tokens export (now uses filtered + paginated)
  const tokens = paginatedTokens;

  // REMOVED OLD DUMMY DATA
  /*
  const [tokens] = useState<Token[]>([
    {
      id: '1',
      symbol: 'SOL',
      name: 'Solana',
      price: 98.45,
      change24h: 5.2,
      liquidity: 2500000,
      volume: 45000000,
      transactions: 24000,
    },
    {
      id: '2',
      symbol: 'WIF',
      name: 'dogwifhat',
      price: 2.34,
      change24h: -3.1,
      liquidity: 1200000,
      volume: 8500000,
      transactions: 8500,
    },
    {
      id: '3',
      symbol: 'JUP',
      name: 'Jupiter',
      price: 0.87,
      change24h: 12.5,
      liquidity: 890000,
      volume: 3200000,
      transactions: 12000,
    },
    {
      id: '4',
      symbol: 'BONK',
      name: 'Bonk',
      price: 0.000023,
      change24h: 8.7,
      liquidity: 650000,
      volume: 1800000,
      transactions: 18000,
    },
    {
      id: '5',
      symbol: 'PEPE',
      name: 'Pepe',
      price: 0.0000012,
      change24h: 15.4,
      liquidity: 420000,
      volume: 6200000,
      transactions: 4200,
    },
    {
      id: '6',
      symbol: 'SHIB',
      name: 'Shiba Inu',
      price: 0.000021,
      change24h: -1.2,
      liquidity: 1500000,
      volume: 32000000,
      transactions: 32000,
    },
    {
      id: '7',
      symbol: 'DOGE',
      name: 'Dogecoin',
      price: 0.20,
      change24h: 3.3,
      liquidity: 5000000,
      volume: 78000000,
      transactions: 7800,
    },
    {
      id: '8',
      symbol: 'SAMO',
      name: 'Samoyedcoin',
      price: 0.012,
      change24h: 5.1,
      liquidity: 300000,
      volume: 2500000,
      transactions: 2500,
    },
    {
      id: '9',
      symbol: 'RAY',
      name: 'Raydium',
      price: 0.48,
      change24h: 2.7,
      liquidity: 2200000,
      volume: 15000000,
      transactions: 15000,
    },
    {
      id: '10',
      symbol: 'ORCA',
      name: 'Orca',
      price: 2.15,
      change24h: -0.9,
      liquidity: 1000000,
      volume: 4200000,
      transactions: 4200,
    },
    {
      id: '11',
      symbol: 'STEP',
      name: 'Step Finance',
      price: 0.034,
      change24h: 7.9,
      liquidity: 190000,
      volume: 1200000,
      transactions: 1200,
    },
    {
      id: '12',
      symbol: 'GMT',
      name: 'STEPN',
      price: 0.29,
      change24h: -4.2,
      liquidity: 800000,
      volume: 9000000,
      transactions: 9000,
    },
    {
      id: '13',
      symbol: 'ATLAS',
      name: 'Star Atlas',
      price: 0.0024,
      change24h: 6.4,
      liquidity: 600000,
      volume: 4200000,
      transactions: 4200,
    },
    {
      id: '14',
      symbol: 'POLIS',
      name: 'Polis',
      price: 0.87,
      change24h: 1.8,
      liquidity: 450000,
      volume: 2100000,
      transactions: 2100,
    },
    {
      id: '15',
      symbol: 'UXD',
      name: 'UXD Stablecoin',
      price: 1.00,
      change24h: 0.0,
      liquidity: 3000000,
      volume: 11000000,
      transactions: 11000,
    },
    {
      id: '16',
      symbol: 'SBR',
      name: 'Saber',
      price: 0.0021,
      change24h: -2.5,
      liquidity: 350000,
      volume: 1800000,
      transactions: 1800,
    },
    {
      id: '17',
      symbol: 'SUNNY',
      name: 'Sunny',
      price: 0.0008,
      change24h: 9.2,
      liquidity: 120000,
      volume: 1500000,
      transactions: 1500,
    },
    {
      id: '18',
      symbol: 'COPE',
      name: 'COPE',
      price: 0.34,
      change24h: -1.7,
      liquidity: 250000,
      volume: 1300000,
      transactions: 1300,
    },
    {
      id: '19',
      symbol: 'KIN',
      name: 'Kin',
      price: 0.000015,
      change24h: 2.1,
      liquidity: 700000,
      volume: 5100000,
      transactions: 5100,
    },
    {
      id: '20',
      symbol: 'FIDA',
      name: 'Bonfida',
      price: 0.56,
      change24h: 3.9,
      liquidity: 900000,
      volume: 3600000,
      transactions: 3600,
    },
    {
      id: '21',
      symbol: 'SRM',
      name: 'Serum',
      price: 0.12,
      change24h: -5.5,
      liquidity: 1200000,
      volume: 8000000,
      transactions: 8000,
    },
    {
      id: '22',
      symbol: 'MNGO',
      name: 'Mango',
      price: 0.45,
      change24h: 4.5,
      liquidity: 850000,
      volume: 4700000,
      transactions: 4700,
    },
    {
      id: '23',
      symbol: 'USDC',
      name: 'USD Coin',
      price: 1.00,
      change24h: 0.0,
      liquidity: 10000000,
      volume: 250000000,
      transactions: 250000,
    },
    {
      id: '24',
      symbol: 'USDT',
      name: 'Tether',
      price: 1.00,
      change24h: 0.0,
      liquidity: 12000000,
      volume: 300000000,
      transactions: 300000,
    },
  ]);
  */
  
  const isLoading = isLoadingMarket;

  // Filter actions
  const toggleQuickFilter = useCallback((filter: QuickFilterType) => {
    setFilters((prev: MarketFilters) => ({
      ...prev,
      quickFilters: prev.quickFilters.includes(filter)
        ? prev.quickFilters.filter((f: QuickFilterType) => f !== filter)
        : [...prev.quickFilters, filter]
    }));
  }, []);

  const setAdvancedFilters = useCallback((advancedFilters: Partial<MarketFilters>) => {
    setFilters((prev: MarketFilters) => ({ ...prev, ...advancedFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setPage(p => p + 1);
    }
  }, [hasMore]);

  const refetch = useCallback(async () => {
    await refetchMarket();
  }, [refetchMarket]);

  // Count active filters for badge
  const activeFilterCount = countActiveFilters(filters);

  const contextValue = useMemo(() => ({
    // Token data
    tokens,
    rawTokens,
    totalCount: filteredTokens.length,
    isLoading,
    hasMore,
    
    // Filter state
    filters,
    searchQuery,
    activeFilterCount,
    
    // Filter actions
    setSearchQuery,
    toggleQuickFilter,
    setAdvancedFilters,
    clearFilters,
    
    // Pagination
    loadMore,
    
    // Refresh
    refetch,
    
    // Legacy compatibility
    activeFilters: filters.quickFilters,
    toggleFilter: toggleQuickFilter,
  }), [
    tokens, rawTokens, filteredTokens.length, isLoading, hasMore,
    filters, searchQuery, activeFilterCount,
    toggleQuickFilter, setAdvancedFilters, clearFilters,
    loadMore, refetch
  ]);

  return contextValue;
});
