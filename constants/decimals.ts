export const DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  DEFAULT_TOKEN: 6,
  LAMPORTS_PER_SOL: 1_000_000_000,
  MICRO_LAMPORTS: 1_000_000,
} as const;

// Well-known mint addresses
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Known token decimals map
const KNOWN_TOKEN_DECIMALS: Record<string, number> = {
  [SOL_MINT]: DECIMALS.SOL,
  [USDC_MINT]: DECIMALS.USDC,
  [USDT_MINT]: DECIMALS.USDT,
};

/**
 * Get decimals for a token mint address
 * Returns known decimals for SOL/USDC/USDT, or default (6) for unknown tokens
 */
export function getTokenDecimals(mintAddress: string): number {
  return KNOWN_TOKEN_DECIMALS[mintAddress] ?? DECIMALS.DEFAULT_TOKEN;
}

/**
 * Convert human-readable amount to base units (lamports for SOL, smallest units for tokens)
 */
export function toBaseUnits(amount: number, mintAddress: string): number {
  const decimals = getTokenDecimals(mintAddress);
  return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Convert base units to human-readable amount
 */
export function fromBaseUnits(amount: number | string, mintAddress: string): number {
  const decimals = getTokenDecimals(mintAddress);
  return Number(amount) / Math.pow(10, decimals);
}
