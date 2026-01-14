/**
 * Price formatting utilities for SoulWallet
 * Includes subscript notation for very small prices (like DexScreener)
 */

// Unicode subscript digits: ₀₁₂₃₄₅₆₇₈₉
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/**
 * Convert a number to subscript notation
 * @param num - Number to convert (e.g., 4 -> ₄)
 */
function toSubscript(num: number): string {
  return String(num)
    .split('')
    .map(digit => SUBSCRIPT_DIGITS[parseInt(digit, 10)] || digit)
    .join('');
}

/**
 * Format price with subscript notation for small values
 * Example: 0.00001367 -> $0.0₄1367
 * 
 * For prices with more than 4 leading zeros after decimal,
 * uses subscript to show zero count (like DexScreener)
 * 
 * @param price - The price to format
 * @returns Formatted price string with $ prefix
 */
export function formatSubscriptPrice(price: number): string {
  // Handle edge cases
  if (price === 0) return '$0.00';
  if (!isFinite(price) || isNaN(price)) return '$0.00';
  if (price < 0) return '-' + formatSubscriptPrice(Math.abs(price));
  
  // For prices >= 0.0001, use standard formatting
  if (price >= 0.0001) {
    if (price >= 1000000000) return `$${(price / 1000000000).toFixed(2)}B`;
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  }
  
  // For very small prices, use subscript notation
  // Convert to string with enough precision
  const priceStr = price.toFixed(20);
  const parts = priceStr.split('.');
  const afterDecimal = parts[1] || '';
  
  // Count leading zeros after decimal
  let zeroCount = 0;
  for (const char of afterDecimal) {
    if (char === '0') {
      zeroCount++;
    } else {
      break;
    }
  }
  
  // Get significant digits after zeros (up to 4 digits)
  const significantPart = afterDecimal.slice(zeroCount, zeroCount + 4);
  
  // Format: $0.0₄1367
  return `$0.0${toSubscript(zeroCount)}${significantPart}`;
}

/**
 * Standard price formatter (without subscript)
 * For use in places where subscript isn't needed
 */
export function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (!isFinite(price) || isNaN(price)) return '$0.00';
  
  if (price < 0.000001) return '$' + price.toExponential(2);
  if (price < 0.01) return '$' + price.toFixed(6);
  if (price < 1) return '$' + price.toFixed(4);
  if (price < 1000) return '$' + price.toFixed(2);
  return '$' + price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Format large numbers with K/M/B suffix
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}
