/**
 * External Service Mocks
 * 
 * Provides mock implementations for external APIs to make tests
 * deterministic and resilient to network issues.
 */

import { VALID_SOLANA_ADDRESSES } from '../utils/test-fixtures';

/**
 * Mock Solana RPC responses
 */
export const mockSolanaRPC = {
  getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL in lamports
  
  getSlot: jest.fn().mockResolvedValue(123456789),
  
  getLatestBlockhash: jest.fn().mockResolvedValue({
    blockhash: 'mockBlockhash123456789',
    lastValidBlockHeight: 123456789,
  }),
  
  getFeeForMessage: jest.fn().mockResolvedValue({ value: 5000 }),
  
  getParsedTokenAccountsByOwner: jest.fn().mockResolvedValue({
    value: [
      {
        pubkey: { toString: () => 'mockTokenAccount1' },
        account: {
          data: {
            parsed: {
              info: {
                mint: VALID_SOLANA_ADDRESSES.USDC_MINT,
                tokenAmount: {
                  uiAmount: 100.5,
                  decimals: 6,
                },
              },
            },
          },
        },
      },
    ],
  }),
  
  getTransaction: jest.fn().mockResolvedValue({
    meta: {
      err: null,
      fee: 5000,
    },
    slot: 123456789,
  }),
  
  getParsedAccountInfo: jest.fn().mockResolvedValue({
    value: {
      data: {
        parsed: {
          type: 'mint',
          info: {
            decimals: 9,
          },
        },
      },
    },
  }),
};

/**
 * Mock Jupiter API responses
 */
export const mockJupiterAPI = {
  getQuote: jest.fn().mockResolvedValue({
    inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
    outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
    inAmount: '1000000000',
    outAmount: '150250000',
    priceImpactPct: 0.01,
    slippageBps: 50,
    otherAmountThreshold: '149748750',
    routePlan: [],
  }),
  
  getSwapTransaction: jest.fn().mockResolvedValue({
    swapTransaction: 'mockBase64Transaction',
    lastValidBlockHeight: 123456789,
  }),
  
  getSupportedTokens: jest.fn().mockResolvedValue([
    { address: VALID_SOLANA_ADDRESSES.SOL_MINT, symbol: 'SOL', name: 'Solana', decimals: 9 },
    { address: VALID_SOLANA_ADDRESSES.USDC_MINT, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { address: VALID_SOLANA_ADDRESSES.USDT_MINT, symbol: 'USDT', name: 'Tether', decimals: 6 },
  ]),
};

/**
 * Mock Market Data API responses (Birdeye, DexScreener)
 */
export const mockMarketDataAPI = {
  searchTokens: jest.fn().mockResolvedValue({
    tokens: [
      {
        address: VALID_SOLANA_ADDRESSES.SOL_MINT,
        symbol: 'SOL',
        name: 'Solana',
        price: 150.25,
        priceChange24h: 5.2,
        volume24h: 1500000000,
        marketCap: 65000000000,
      },
    ],
  }),
  
  getTrendingTokens: jest.fn().mockResolvedValue({
    tokens: [
      {
        address: VALID_SOLANA_ADDRESSES.SOL_MINT,
        symbol: 'SOL',
        name: 'Solana',
        price: 150.25,
        priceChange24h: 5.2,
      },
    ],
  }),
  
  getTokenDetails: jest.fn().mockResolvedValue({
    address: VALID_SOLANA_ADDRESSES.SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    price: 150.25,
    priceChange24h: 5.2,
    volume24h: 1500000000,
    marketCap: 65000000000,
    holders: 1000000,
  }),
  
  getTokenPrice: jest.fn().mockResolvedValue({
    price: 150.25,
    priceChange24h: 5.2,
  }),
};

/**
 * Mock Price API responses
 */
export const mockPriceAPI = {
  getPrice: jest.fn().mockImplementation((mint: string) => {
    const prices: Record<string, number> = {
      [VALID_SOLANA_ADDRESSES.SOL_MINT]: 150.25,
      [VALID_SOLANA_ADDRESSES.USDC_MINT]: 1.0,
      [VALID_SOLANA_ADDRESSES.USDT_MINT]: 1.0,
    };
    return Promise.resolve({ price: prices[mint] || 0 });
  }),
  
  getPrices: jest.fn().mockResolvedValue({
    [VALID_SOLANA_ADDRESSES.SOL_MINT]: { price: 150.25 },
    [VALID_SOLANA_ADDRESSES.USDC_MINT]: { price: 1.0 },
    [VALID_SOLANA_ADDRESSES.USDT_MINT]: { price: 1.0 },
  }),
};

/**
 * Setup all mocks
 */
export function setupExternalServiceMocks(): void {
  // Reset all mocks before each test
  jest.clearAllMocks();
}

/**
 * Restore all mocks
 */
export function restoreExternalServiceMocks(): void {
  jest.restoreAllMocks();
}

/**
 * Mock error scenarios
 */
export const mockErrorScenarios = {
  networkError: new Error('Network request failed'),
  timeoutError: new Error('Request timeout'),
  rpcError: new Error('RPC node unavailable'),
  rateLimitError: new Error('Rate limit exceeded'),
};

/**
 * Configure mock to simulate error
 */
export function simulateError(mock: jest.Mock, error: Error): void {
  mock.mockRejectedValueOnce(error);
}

/**
 * Configure mock to simulate empty response
 */
export function simulateEmptyResponse(mock: jest.Mock): void {
  mock.mockResolvedValueOnce({ tokens: [] });
}
