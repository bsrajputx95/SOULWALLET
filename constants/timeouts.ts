export const TIMEOUTS = {
  EXTERNAL_API: 15_000,
  TRANSACTION_CONFIRMATION: 30_000,
  CIRCUIT_BREAKER: 10_000,
  RETRY: {
    MAX_ATTEMPTS: 4,
    INITIAL_DELAY_MS: 1_000,
    MAX_DELAY_MS: 30_000,
    BACKOFF_MULTIPLIER: 2,
  },
  CACHE_TTL_SECONDS: {
    SESSION: 86_400,
    PRICE: 60,
    PORTFOLIO: 300,
    TOKEN_METADATA: 3_600,
  },
  TOKEN_VERIFICATION: {
    TIMEOUT_MS: 10_000,
    MAX_RETRIES: 3,
    INITIAL_DELAY_MS: 1_000,
  },
  REDIS: {
    POOL_MIN: 2,
    POOL_MAX: 10,
    POOL_ACQUIRE_TIMEOUT_MS: 5_000,
  },
} as const;

// IBUY-specific configuration for handling new/unlisted tokens
export const IBUY_CONFIG = {
  // Consider token "new" if created within this timeframe
  NEW_TOKEN_THRESHOLD_SECONDS: 120,
  // Retry configuration for quote fetching
  MAX_RETRY_ATTEMPTS: 5,
  // Delays between retry attempts (ms): immediate, 5s, 10s, 20s, 30s
  RETRY_DELAYS_MS: [0, 5_000, 10_000, 20_000, 30_000] as readonly number[],
  // Extended quote cache TTL for retries (seconds)
  QUOTE_CACHE_TTL_SECONDS: 60,
  // Higher slippage allowed for new tokens (5%)
  MAX_SLIPPAGE_NEW_TOKEN_BPS: 500,
  // Standard slippage for established tokens
  MAX_SLIPPAGE_STANDARD_BPS: 100,
  // Timeout for multi-DEX quote aggregation
  MULTI_DEX_TIMEOUT_MS: 8_000,
  // Status poll interval for client
  STATUS_POLL_INTERVAL_MS: 2_000,
} as const;

