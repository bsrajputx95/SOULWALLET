/**
 * Centralized price formatting utilities
 * Re-exports from utils/formatPrice for consistency
 */

export {
    formatPrice,
    formatSubscriptPrice,
    formatLargeNumber,
} from '../utils/formatPrice';

/**
 * Format a percentage value with sign
 * @param value - The percentage value
 * @returns Formatted percentage string with + or - prefix
 */
export const formatPercentage = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

/**
 * Format a large number with commas as thousand separators
 * @param num - The number to format
 * @returns Formatted number string
 */
export const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
};

/**
 * Format token balance based on value magnitude
 * Small values show more decimal places
 * @param balance - The token balance
 * @param decimals - Number of decimal places for the token
 * @returns Formatted balance string
 */
export const formatTokenBalance = (balance: number, decimals: number = 9): string => {
    if (balance === 0) return '0';
    if (balance < 0.0001) return balance.toExponential(4);
    if (balance < 1) return balance.toFixed(decimals > 6 ? 6 : decimals);
    if (balance < 1000) return balance.toFixed(4);
    return formatLargeNumber(balance);
};

/**
 * Format currency value with $ prefix
 * @param value - The value to format
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number): string => {
    if (value === 0) return '$0';
    return `$${formatPrice(value).replace('$', '')}`;
};

/**
 * Format a compact number for display in limited space
 * @param num - The number to format
 * @returns Compact formatted string
 */
export const formatCompact = (num: number): string => {
    const formatter = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1,
    });
    return formatter.format(num);
};
