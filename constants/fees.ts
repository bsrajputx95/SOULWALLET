export const FEES = {
  SWAP: {
    DEFAULT: 0.00005,
    SLIPPAGE_BPS: {
      DEFAULT: 100,
      MIN: 10,
      MAX: 500,
    },
    SLIPPAGE_PERCENT: {
      DEFAULT: 0.5,
      MIN: 0.1,
      MAX: 5,
    },
  },
  PRIORITY: {
    MAX_LAMPORTS: 100_000,
    MIN_LAMPORTS: 1_000,
    PERCENTILE: 50,
    URGENT_MULTIPLIER: 2,
  },
} as const;

