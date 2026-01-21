/**
 * Price formatting utilities for displaying cryptocurrency prices
 * Formats very small prices with subscript notation like DexScreener: $0.0(4)52
 */

/**
 * Format a price using subscript notation for very small values
 * Example: 0.00000452 becomes "0.0(5)452" where (5) indicates 5 zeros after decimal
 * 
 * @param price - The price to format
 * @returns Formatted price string
 */
export function formatSubscriptPrice(price: number): string {
    if (price === 0) return '0.00';
    if (!isFinite(price)) return '0.00';

    // For larger prices, use standard formatting
    if (price >= 1) {
        return price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    if (price >= 0.01) {
        return price.toFixed(4);
    }

    if (price >= 0.0001) {
        return price.toFixed(6);
    }

    // For very small prices, use subscript notation
    // Convert to string in fixed notation (not scientific)
    const priceStr = price.toFixed(20);

    // Find the position of the first non-zero digit after decimal
    const match = priceStr.match(/^0\.0*([1-9])/);
    if (!match) {
        // No significant digits found, return as is
        return price.toFixed(8);
    }

    // Count zeros after decimal point before first non-zero digit
    const decimalPart = priceStr.split('.')[1] || '';
    let zeroCount = 0;
    for (let i = 0; i < decimalPart.length; i++) {
        if (decimalPart[i] === '0') {
            zeroCount++;
        } else {
            break;
        }
    }

    // Get significant digits (3-4 digits after the leading zeros)
    const significantDigits = decimalPart.slice(zeroCount, zeroCount + 4).replace(/0+$/, '') || '0';

    // Format as subscript notation: 0.0(n)XXX where n is zero count
    if (zeroCount >= 4) {
        return `0.0(${zeroCount})${significantDigits}`;
    }

    // For 1-3 zeros, just show them normally
    return price.toFixed(zeroCount + 4);
}

/**
 * Format a price change percentage with sign
 * @param change - The change percentage
 * @returns Formatted change string with + or - sign
 */
export function formatPriceChange(change: number): string {
    if (!isFinite(change)) return '+0.0%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
}

/**
 * Format large numbers with K/M/B suffixes
 * @param num - The number to format
 * @returns Formatted string with suffix
 */
export function formatLargeNumber(num: number): string {
    if (!isFinite(num) || num === 0) return '$0';
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
}
