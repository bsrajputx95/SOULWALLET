import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@/lib/create-context-hook';

export interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  liquidity?: number;
  volume?: number;
  age?: string;
  logo?: string;
}

type FilterType = 'volume' | 'liquidity' | 'change' | 'age' | 'verified';

export const [MarketProvider, useMarket] = createContextHook(() => {
  const [tokens] = useState<Token[]>([
    {
      id: '1',
      symbol: 'SOL',
      name: 'Solana',
      price: 98.45,
      change24h: 5.2,
      liquidity: 2500000,
      volume: 45000000,
      age: '2h',
    },
    {
      id: '2',
      symbol: 'WIF',
      name: 'dogwifhat',
      price: 2.34,
      change24h: -3.1,
      liquidity: 1200000,
      volume: 8500000,
      age: '5h',
    },
    {
      id: '3',
      symbol: 'JUP',
      name: 'Jupiter',
      price: 0.87,
      change24h: 12.5,
      liquidity: 890000,
      volume: 3200000,
      age: '1d',
    },
    {
      id: '4',
      symbol: 'BONK',
      name: 'Bonk',
      price: 0.000023,
      change24h: 8.7,
      liquidity: 650000,
      volume: 1800000,
      age: '3h',
    },
  ]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  }, []);

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
