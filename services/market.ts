import { api } from './api';

export interface MarketToken {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  logo: string;
  banner?: string;
}

export interface MarketTokensResponse {
  success: boolean;
  tokens: MarketToken[];
  cached: boolean;
  stale?: boolean;
}

// TrendingToken is the same as MarketToken
export type TrendingToken = MarketToken;

/**
 * Fetch top market tokens from backend (cached for 1 hour)
 */
export const fetchMarketTokens = async (): Promise<MarketTokensResponse> => {
  const response = await api.get<MarketTokensResponse>('/market/tokens');
  return response;
};

/**
 * Refresh market tokens (forces backend to bypass cache if implemented)
 */
export const refreshMarketTokens = async (): Promise<MarketTokensResponse> => {
  const response = await api.get<MarketTokensResponse>('/market/tokens?refresh=true');
  return response;
};

// Fetch trending tokens
export const fetchTrendingTokens = async (): Promise<{
  success: boolean;
  tokens?: TrendingToken[];
  lastUpdated?: string;
  error?: string;
}> => {
  const response = await api.get<{
    success: boolean;
    tokens: TrendingToken[];
    lastUpdated: string;
  }>('/market/trending');
  return response;
};
