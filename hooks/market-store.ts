import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { trpc } from '@/lib/trpc';

export interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  liquidity?: number;
  volume?: number;
  transactions?: number; // 24h transactions count (mock)
  logo?: string;
}

type FilterType = 'volume' | 'liquidity' | 'change' | 'age' | 'verified';

export const [MarketProvider, useMarket] = createContextHook(() => {
  // ✅ Fetch real SoulMarket tokens from backend
  const { data: soulMarketData, isLoading: isLoadingMarket, refetch: refetchMarket } = trpc.market.soulMarket.useQuery(undefined, {
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Transform DexScreener data to Token format
  const tokens = useMemo(() => {
    if (!soulMarketData || !('pairs' in soulMarketData) || !soulMarketData.pairs) return [];
    
    return (soulMarketData.pairs as any[]).map((pair: any) => ({
      id: pair.pairAddress || `${pair.chainId}-${pair.dexId}`,
      symbol: pair.baseToken?.symbol || 'UNKNOWN',
      name: pair.baseToken?.name || 'Unknown Token',
      price: parseFloat(pair.priceUsd || '0'),
      change24h: parseFloat(pair.priceChange?.h24 || '0'),
      liquidity: parseFloat(pair.liquidity?.usd || '0'),
      volume: parseFloat(pair.volume?.h24 || '0'),
      transactions: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      logo: pair.info?.imageUrl,
    }));
  }, [soulMarketData]);

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
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleFilter = useCallback((filter: FilterType) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  }, []);

  const refetch = useCallback(async () => {
    await refetchMarket();
  }, [refetchMarket]);

  const contextValue = useMemo(() => ({
    tokens,
    isLoading,
    activeFilters,
    toggleFilter,
    searchQuery,
    setSearchQuery,
    refetch,
  }), [tokens, isLoading, activeFilters, toggleFilter, searchQuery, refetch]);

  return contextValue;
});
