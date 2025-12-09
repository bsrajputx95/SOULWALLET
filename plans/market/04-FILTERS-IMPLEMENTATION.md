# Advanced Filters Implementation

## Current Problem

Advanced filters are collected in UI but never applied:

```typescript
// app/(tabs)/market.tsx - Lines 560-575
onPress={() => {
  // Apply filters logic here - NOT IMPLEMENTED!
  if (__DEV__) {
    console.log('Applying filters:', {...});
  }
  setShowAdvancedFilters(false);
}}
```

## Solution Architecture

### 1. Create Filter Types

```typescript
// types/market-filters.ts

export interface MarketFilters {
  // Quick filters
  quickFilters: QuickFilterType[];
  
  // Range filters
  minLiquidity?: number;
  maxLiquidity?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minFDV?: number;
  maxFDV?: number;
  minVolume24h?: number;
  maxVolume24h?: number;
  
  // Age filter
  minAgeHours?: number;
  maxAgeHours?: number;
  
  // Transaction filters
  min24hTxns?: number;
  min24hBuys?: number;
  min24hSells?: number;
  
  // Pair filter
  pairToken?: string; // e.g., 'SOL', 'USDC'
  
  // Sorting
  sortBy?: 'liquidity' | 'volume' | 'change' | 'marketCap' | 'age';
  sortOrder?: 'asc' | 'desc';
}

export type QuickFilterType = 'volume' | 'liquidity' | 'change' | 'age' | 'verified';

export const DEFAULT_FILTERS: MarketFilters = {
  quickFilters: [],
  sortBy: 'liquidity',
  sortOrder: 'desc',
};
```

### 2. Update Market Store

```typescript
// hooks/market-store.ts

import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { trpc } from '@/lib/trpc';
import { MarketFilters, DEFAULT_FILTERS, QuickFilterType } from '@/types/market-filters';

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
  pairAge?: number; // hours
  logo?: string;
  verified?: boolean;
  pairToken?: string;
}

export const [MarketProvider, useMarket] = createContextHook(() => {
  const { data: soulMarketData, isLoading, refetch: refetchMarket } = trpc.market.soulMarket.useQuery(undefined, {
    refetchInterval: 300000,
  });

  // Filter state
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Transform API data to Token format
  const rawTokens = useMemo(() => {
    if (!soulMarketData || !('pairs' in soulMarketData) || !soulMarketData.pairs) return [];
    
    return (soulMarketData.pairs as any[]).map((pair: any) => ({
      id: pair.pairAddress || `${pair.chainId}-${pair.dexId}`,
      symbol: pair.baseToken?.symbol || 'UNKNOWN',
      name: pair.baseToken?.name || 'Unknown Token',
      price: parseFloat(pair.priceUsd || '0'),
      change24h: parseFloat(pair.priceChange?.h24 || '0'),
      liquidity: parseFloat(pair.liquidity?.usd || '0'),
      volume: parseFloat(pair.volume?.h24 || '0'),
      marketCap: parseFloat(pair.marketCap || '0'),
      fdv: parseFloat(pair.fdv || '0'),
      transactions: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      buys24h: pair.txns?.h24?.buys || 0,
      sells24h: pair.txns?.h24?.sells || 0,
      pairAge: pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) : undefined,
      logo: pair.info?.imageUrl,
      verified: pair.info?.verified || false,
      pairToken: pair.quoteToken?.symbol,
    }));
  }, [soulMarketData]);

  // Apply filters
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

    // Quick filters
    if (filters.quickFilters.includes('volume')) {
      result = result.filter(t => (t.volume || 0) >= 1000000); // $1M+
    }
    if (filters.quickFilters.includes('liquidity')) {
      result = result.filter(t => (t.liquidity || 0) >= 500000); // $500K+
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

    // Range filters
    if (filters.minLiquidity !== undefined) {
      result = result.filter(t => (t.liquidity || 0) >= filters.minLiquidity!);
    }
    if (filters.maxLiquidity !== undefined) {
      result = result.filter(t => (t.liquidity || 0) <= filters.maxLiquidity!);
    }
    if (filters.minMarketCap !== undefined) {
      result = result.filter(t => (t.marketCap || 0) >= filters.minMarketCap!);
    }
    if (filters.maxMarketCap !== undefined) {
      result = result.filter(t => (t.marketCap || 0) <= filters.maxMarketCap!);
    }
    if (filters.minFDV !== undefined) {
      result = result.filter(t => (t.fdv || 0) >= filters.minFDV!);
    }
    if (filters.maxFDV !== undefined) {
      result = result.filter(t => (t.fdv || 0) <= filters.maxFDV!);
    }
    if (filters.minVolume24h !== undefined) {
      result = result.filter(t => (t.volume || 0) >= filters.minVolume24h!);
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
        }
        return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [rawTokens, searchQuery, filters]);

  // Filter actions
  const toggleQuickFilter = useCallback((filter: QuickFilterType) => {
    setFilters(prev => ({
      ...prev,
      quickFilters: prev.quickFilters.includes(filter)
        ? prev.quickFilters.filter(f => f !== filter)
        : [...prev.quickFilters, filter]
    }));
  }, []);

  const setAdvancedFilters = useCallback((advancedFilters: Partial<MarketFilters>) => {
    setFilters(prev => ({ ...prev, ...advancedFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const refetch = useCallback(async () => {
    await refetchMarket();
  }, [refetchMarket]);

  return {
    tokens: filteredTokens,
    rawTokens,
    isLoading,
    filters,
    searchQuery,
    setSearchQuery,
    toggleQuickFilter,
    setAdvancedFilters,
    clearFilters,
    refetch,
    // Legacy compatibility
    activeFilters: filters.quickFilters,
    toggleFilter: toggleQuickFilter,
  };
});
```

### 3. Update Market Screen

```typescript
// app/(tabs)/market.tsx - Update advanced filters apply button

const applyAdvancedFilters = () => {
  // Parse numeric values
  const parseNumber = (val: string): number | undefined => {
    if (!val.trim()) return undefined;
    // Handle K, M, B suffixes
    const num = val.toUpperCase();
    if (num.endsWith('K')) return parseFloat(num) * 1000;
    if (num.endsWith('M')) return parseFloat(num) * 1000000;
    if (num.endsWith('B')) return parseFloat(num) * 1000000000;
    return parseFloat(num) || undefined;
  };

  setAdvancedFilters({
    minLiquidity: parseNumber(minLiquidity),
    maxLiquidity: parseNumber(maxLiquidity),
    minMarketCap: parseNumber(minMarketCap),
    maxMarketCap: parseNumber(maxMarketCap),
    minFDV: parseNumber(minFDV),
    maxFDV: parseNumber(maxFDV),
    minAgeHours: parseNumber(minAge),
    maxAgeHours: parseNumber(maxAge),
    min24hTxns: parseNumber(min24hTxns),
    min24hBuys: parseNumber(min24hBuys),
    min24hSells: parseNumber(min24hSells),
    minVolume24h: parseNumber(min24hVolume),
    pairToken: pairFilter.trim() || undefined,
  });
  
  setShowAdvancedFilters(false);
};

// Update apply button
<Pressable 
  style={styles.applyButton}
  onPress={applyAdvancedFilters}
>
  <Text style={styles.applyButtonText}>Apply Filters</Text>
</Pressable>
```

### 4. Add Filter Count Badge

```typescript
// Show active filter count
const activeFilterCount = useMemo(() => {
  let count = filters.quickFilters.length;
  if (filters.minLiquidity !== undefined) count++;
  if (filters.maxLiquidity !== undefined) count++;
  if (filters.minMarketCap !== undefined) count++;
  // ... etc
  return count;
}, [filters]);

// In header
<Pressable style={styles.filterButton} onPress={() => setShowFilters(!showFilters)}>
  <Settings size={24} color={COLORS.solana} />
  {activeFilterCount > 0 && (
    <View style={styles.filterBadge}>
      <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
    </View>
  )}
</Pressable>
```

## Testing

1. Test each quick filter individually
2. Test range filters with various values
3. Test K/M/B suffix parsing
4. Test filter combinations
5. Test clear filters
6. Test sorting options
