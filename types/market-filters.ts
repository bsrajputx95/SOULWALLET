/**
 * Market Filter Types
 * Defines filter structures for the market tab
 */

export type QuickFilterType = 'volume' | 'liquidity' | 'change' | 'age' | 'verified' | 'buysRatio' | 'txns' | 'priceChange';

export interface MarketFilters {
  // Quick filters
  quickFilters: QuickFilterType[];
  
  // Range filters (undefined means no filter)
  minLiquidity: number | undefined;
  maxLiquidity: number | undefined;
  minMarketCap: number | undefined;
  maxMarketCap: number | undefined;
  minFDV: number | undefined;
  maxFDV: number | undefined;
  minVolume24h: number | undefined;
  maxVolume24h: number | undefined;
  
  // Age filter (hours)
  minAgeHours: number | undefined;
  maxAgeHours: number | undefined;
  
  // Transaction filters
  min24hTxns: number | undefined;
  min24hBuys: number | undefined;
  min24hSells: number | undefined;
  
  // Beast filter additions (Comment 2)
  buyRatioMin: number | undefined;      // Minimum buy ratio (0-1), e.g., 0.6 = 60%
  minPriceChange24h: number | undefined; // Minimum absolute price change %
  
  // Pair filter
  pairToken: string | undefined;
  
  // Sorting
  sortBy: 'liquidity' | 'volume' | 'change' | 'marketCap' | 'age' | 'price' | undefined;
  sortOrder: 'asc' | 'desc' | undefined;
}

export const DEFAULT_FILTERS: MarketFilters = {
  quickFilters: [],
  minLiquidity: undefined,
  maxLiquidity: undefined,
  minMarketCap: undefined,
  maxMarketCap: undefined,
  minFDV: undefined,
  maxFDV: undefined,
  minVolume24h: undefined,
  maxVolume24h: undefined,
  minAgeHours: undefined,
  maxAgeHours: undefined,
  min24hTxns: undefined,
  min24hBuys: undefined,
  min24hSells: undefined,
  buyRatioMin: undefined,
  minPriceChange24h: undefined,
  pairToken: undefined,
  sortBy: 'liquidity',
  sortOrder: 'desc',
};

/**
 * Parse a string value with K/M/B suffix to number
 */
export function parseFilterValue(val: string): number | undefined {
  if (!val || !val.trim()) return undefined;
  
  const trimmed = val.trim().toUpperCase();
  const num = parseFloat(trimmed);
  
  if (isNaN(num)) return undefined;
  
  if (trimmed.endsWith('K')) return num * 1000;
  if (trimmed.endsWith('M')) return num * 1000000;
  if (trimmed.endsWith('B')) return num * 1000000000;
  
  return num;
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: MarketFilters): number {
  let count = filters.quickFilters.length;
  
  if (filters.minLiquidity !== undefined) count++;
  if (filters.maxLiquidity !== undefined) count++;
  if (filters.minMarketCap !== undefined) count++;
  if (filters.maxMarketCap !== undefined) count++;
  if (filters.minFDV !== undefined) count++;
  if (filters.maxFDV !== undefined) count++;
  if (filters.minVolume24h !== undefined) count++;
  if (filters.maxVolume24h !== undefined) count++;
  if (filters.minAgeHours !== undefined) count++;
  if (filters.maxAgeHours !== undefined) count++;
  if (filters.min24hTxns !== undefined) count++;
  if (filters.min24hBuys !== undefined) count++;
  if (filters.min24hSells !== undefined) count++;
  if (filters.buyRatioMin !== undefined) count++;
  if (filters.minPriceChange24h !== undefined) count++;
  if (filters.pairToken) count++;
  
  return count;
}
