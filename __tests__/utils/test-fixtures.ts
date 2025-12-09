/**
 * Test Fixtures - Sample data for integration testing
 */

// Valid Solana addresses for testing
export const VALID_SOLANA_ADDRESSES = {
  SOL_MINT: 'So11111111111111111111111111111111111111112',
  USDC_MINT: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT_MINT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  SAMPLE_WALLET_1: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  SAMPLE_WALLET_2: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  SAMPLE_WALLET_3: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
};

/**
 * Mock user data
 */
export const mockUser = {
  email: 'testuser@example.com',
  password: 'SecurePassword123!',
  name: 'Test User',
  username: 'testuser',
};

/**
 * Create mock user with overrides
 */
export function createMockUser(overrides: Partial<typeof mockUser> = {}) {
  const timestamp = Date.now();
  return {
    ...mockUser,
    email: `test-${timestamp}@example.com`,
    username: `testuser-${timestamp}`,
    ...overrides,
  };
}

/**
 * Mock trader profile data
 */
export const mockTrader = {
  walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
  username: 'TopTrader',
  bio: 'Professional Solana trader with 5 years experience',
  totalFollowers: 150,
  totalTrades: 500,
  winRate: 68.5,
  totalROI: 245.8,
  avgTradeSize: 2.5,
  totalVolume: 1250.0,
  roi7d: 12.3,
  roi30d: 45.6,
  roi90d: 125.4,
  isFeatured: true,
};

/**
 * Create mock trader with overrides
 */
export function createMockTrader(overrides: Partial<typeof mockTrader> = {}) {
  return {
    ...mockTrader,
    ...overrides,
  };
}

/**
 * Mock token metadata
 */
export const mockToken = {
  mint: VALID_SOLANA_ADDRESSES.SOL_MINT,
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  price: 150.25,
  priceChange24h: 5.2,
  volume24h: 1500000000,
};

/**
 * Create mock token with overrides
 */
export function createMockToken(overrides: Partial<typeof mockToken> = {}) {
  return {
    ...mockToken,
    ...overrides,
  };
}

/**
 * Mock social post data
 */
export const mockPost = {
  content: 'Just made a great trade on $SOL! 🚀 #Solana #Trading',
  visibility: 'PUBLIC' as const,
  mentionedTokenSymbol: 'SOL',
  mentionedTokenMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
  mentionedTokenName: 'Solana',
};

/**
 * Create mock post with overrides
 */
export function createMockPost(overrides: Partial<typeof mockPost> = {}) {
  return {
    ...mockPost,
    ...overrides,
  };
}

/**
 * Mock transaction data
 */
export const mockTransaction = {
  signature: '5wHu1qwD7q4H3pqrJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJKJK',
  type: 'SEND' as const,
  amount: 1.5,
  token: 'SOL',
  tokenSymbol: 'SOL',
  from: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
  to: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_2,
  fee: 0.000005,
  status: 'CONFIRMED' as const,
};

/**
 * Create mock transaction with overrides
 */
export function createMockTransaction(overrides: Partial<typeof mockTransaction> = {}) {
  const timestamp = Date.now();
  return {
    ...mockTransaction,
    signature: `${timestamp}${Math.random().toString(36).slice(2)}`.padEnd(88, 'x'),
    ...overrides,
  };
}

/**
 * Mock copy trading settings
 */
export const mockCopyTradingSettings = {
  totalBudget: 100,
  amountPerTrade: 10,
  stopLoss: -15,
  takeProfit: 50,
  maxSlippage: 1,
  exitWithTrader: false,
};

/**
 * Create mock copy trading settings with overrides
 */
export function createMockCopyTradingSettings(overrides: Partial<typeof mockCopyTradingSettings> = {}) {
  return {
    ...mockCopyTradingSettings,
    ...overrides,
  };
}

/**
 * Mock Jupiter swap quote
 */
export const mockQuote = {
  inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
  outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
  inAmount: '1000000000', // 1 SOL in lamports
  outAmount: '150250000', // ~150.25 USDC
  priceImpactPct: 0.01,
  slippageBps: 50,
  otherAmountThreshold: '149748750',
};

/**
 * Create mock quote with overrides
 */
export function createMockQuote(overrides: Partial<typeof mockQuote> = {}) {
  return {
    ...mockQuote,
    ...overrides,
  };
}

/**
 * Mock position data
 */
export const mockPosition = {
  tokenMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
  tokenSymbol: 'USDC',
  tokenName: 'USD Coin',
  entryPrice: 1.0,
  entryAmount: 100,
  entryValue: 100,
  status: 'OPEN' as const,
};

/**
 * Create mock position with overrides
 */
export function createMockPosition(overrides: Partial<typeof mockPosition> = {}) {
  return {
    ...mockPosition,
    ...overrides,
  };
}

/**
 * Invalid test data for error testing
 */
export const invalidData = {
  invalidEmail: 'not-an-email',
  weakPassword: '123',
  invalidSolanaAddress: 'invalid-address',
  sqlInjection: "'; DROP TABLE users; --",
  xssAttempt: '<script>alert("xss")</script>',
  emptyString: '',
  veryLongString: 'a'.repeat(10000),
  negativeNumber: -100,
  zeroAmount: 0,
};

/**
 * Test timeouts
 */
export const testTimeouts = {
  short: 5000,
  medium: 15000,
  long: 30000,
  veryLong: 60000,
};
