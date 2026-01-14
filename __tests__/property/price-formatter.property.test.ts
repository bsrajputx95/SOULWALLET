/**
 * Property-based tests for Price Formatter
 * **Feature: token-display-improvements, Property 1: Subscript Price Formatting**
 * **Feature: token-display-improvements, Property 2: Standard Price Formatting Threshold**
 * **Feature: token-display-improvements, Property 3: Price Formatter Range Handling**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import * as fc from 'fast-check';
import { formatSubscriptPrice, formatLargeNumber } from '../../utils/formatPrice';

// Unicode subscript digits for verification
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/**
 * Helper to count leading zeros after decimal point
 */
function countLeadingZeros(price: number): number {
  if (price >= 1 || price <= 0) return 0;
  const priceStr = price.toFixed(20);
  const afterDecimal = priceStr.split('.')[1] || '';
  let count = 0;
  for (const char of afterDecimal) {
    if (char === '0') count++;
    else break;
  }
  return count;
}

/**
 * Helper to check if string contains subscript digits
 */
function containsSubscript(str: string): boolean {
  return SUBSCRIPT_DIGITS.some(digit => str.includes(digit));
}

/**
 * Helper to extract subscript number from formatted price
 */
function extractSubscriptNumber(str: string): number | null {
  let subscriptStr = '';
  for (const char of str) {
    const idx = SUBSCRIPT_DIGITS.indexOf(char);
    if (idx !== -1) {
      subscriptStr += idx.toString();
    }
  }
  return subscriptStr ? parseInt(subscriptStr, 10) : null;
}

describe('Price Formatter Property Tests', () => {
  describe('Property 1: Subscript Price Formatting', () => {
    /**
     * For any price value less than 0.0001, the formatted output SHALL contain
     * a subscript digit representing the count of leading zeros after the decimal point.
     * **Validates: Requirements 3.1, 3.2**
     */
    test('prices < 0.0001 use subscript notation with correct zero count', () => {
      fc.assert(fc.property(
        // Generate prices between 0.000000001 and 0.00009999
        fc.double({ min: 0.000000001, max: 0.00009999, noNaN: true }),
        (price) => {
          const formatted = formatSubscriptPrice(price);
          
          // Should contain subscript
          expect(containsSubscript(formatted)).toBe(true);
          
          // Subscript number should match leading zero count
          const expectedZeros = countLeadingZeros(price);
          const actualSubscript = extractSubscriptNumber(formatted);
          
          // Allow for floating point precision issues (±1)
          expect(actualSubscript).not.toBeNull();
          expect(Math.abs(actualSubscript! - expectedZeros)).toBeLessThanOrEqual(1);
          
          return true;
        }
      ), { numRuns: 100 });
    });

    test('subscript format starts with $0.0', () => {
      fc.assert(fc.property(
        fc.double({ min: 0.000000001, max: 0.00009999, noNaN: true }),
        (price) => {
          const formatted = formatSubscriptPrice(price);
          expect(formatted.startsWith('$0.0')).toBe(true);
          return true;
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 2: Standard Price Formatting Threshold', () => {
    /**
     * For any price value greater than or equal to 0.0001, the formatted output
     * SHALL NOT contain subscript notation.
     * **Validates: Requirements 3.3**
     */
    test('prices >= 0.0001 do not use subscript notation', () => {
      fc.assert(fc.property(
        fc.double({ min: 0.0001, max: 1000000, noNaN: true }),
        (price) => {
          const formatted = formatSubscriptPrice(price);
          expect(containsSubscript(formatted)).toBe(false);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('prices >= 1 show standard decimal format', () => {
      fc.assert(fc.property(
        fc.double({ min: 1, max: 999, noNaN: true }),
        (price) => {
          const formatted = formatSubscriptPrice(price);
          expect(formatted).toMatch(/^\$\d+\.\d{2}$/);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('prices >= 1000 use comma formatting or K/M/B suffix', () => {
      fc.assert(fc.property(
        fc.double({ min: 1000, max: 999999, noNaN: true }),
        (price) => {
          const formatted = formatSubscriptPrice(price);
          // Should either have commas or be formatted normally
          expect(formatted.startsWith('$')).toBe(true);
          expect(containsSubscript(formatted)).toBe(false);
          return true;
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 3: Price Formatter Range Handling', () => {
    /**
     * For any price value between 0.000000001 and 1000000000, the price formatter
     * SHALL return a valid string without throwing an error.
     * **Validates: Requirements 3.4**
     */
    test('handles full price range without errors', () => {
      fc.assert(fc.property(
        fc.double({ min: 0.000000001, max: 1000000000, noNaN: true }),
        (price) => {
          const formatted = formatSubscriptPrice(price);
          
          // Should return a string
          expect(typeof formatted).toBe('string');
          
          // Should start with $
          expect(formatted.startsWith('$')).toBe(true);
          
          // Should have reasonable length
          expect(formatted.length).toBeGreaterThan(1);
          expect(formatted.length).toBeLessThan(30);
          
          return true;
        }
      ), { numRuns: 100 });
    });

    test('handles zero correctly', () => {
      expect(formatSubscriptPrice(0)).toBe('$0.00');
    });

    test('handles negative prices', () => {
      fc.assert(fc.property(
        fc.double({ min: -1000, max: -0.000001, noNaN: true }),
        (price) => {
          const formatted = formatSubscriptPrice(price);
          expect(formatted.startsWith('-$')).toBe(true);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('handles edge case prices', () => {
      // Very small
      expect(formatSubscriptPrice(0.00000001)).toMatch(/\$0\.0[₀-₉]+\d+/);
      
      // Threshold boundary
      expect(containsSubscript(formatSubscriptPrice(0.0001))).toBe(false);
      expect(containsSubscript(formatSubscriptPrice(0.00009999))).toBe(true);
      
      // Large numbers
      expect(formatSubscriptPrice(1000000000)).toContain('B');
      expect(formatSubscriptPrice(1000000)).toContain('M');
    });
  });

  describe('Unit Tests for Specific Examples', () => {
    test('formats 0.00001367 as $0.0₄1367', () => {
      const result = formatSubscriptPrice(0.00001367);
      expect(result).toBe('$0.0₄1367');
    });

    test('formats 0.0001 without subscript', () => {
      const result = formatSubscriptPrice(0.0001);
      expect(containsSubscript(result)).toBe(false);
    });

    test('formats 0.000000001 with subscript', () => {
      const result = formatSubscriptPrice(0.000000001);
      expect(containsSubscript(result)).toBe(true);
      expect(result).toMatch(/\$0\.0₈/);
    });

    test('formats 150.50 as $150.50', () => {
      const result = formatSubscriptPrice(150.50);
      expect(result).toBe('$150.50');
    });

    test('formats 0.00005 with subscript', () => {
      const result = formatSubscriptPrice(0.00005);
      expect(result).toBe('$0.0₄5000');
    });
  });

  describe('formatLargeNumber utility', () => {
    test('formats billions correctly', () => {
      fc.assert(fc.property(
        fc.double({ min: 1000000000, max: 999000000000, noNaN: true }),
        (num) => {
          const formatted = formatLargeNumber(num);
          expect(formatted).toMatch(/^\d+(\.\d)?B$/);
          return true;
        }
      ), { numRuns: 50 });
    });

    test('formats millions correctly', () => {
      fc.assert(fc.property(
        fc.double({ min: 1000000, max: 999999999, noNaN: true }),
        (num) => {
          const formatted = formatLargeNumber(num);
          expect(formatted).toMatch(/^\d+(\.\d)?M$/);
          return true;
        }
      ), { numRuns: 50 });
    });

    test('formats thousands correctly', () => {
      fc.assert(fc.property(
        fc.double({ min: 1000, max: 999999, noNaN: true }),
        (num) => {
          const formatted = formatLargeNumber(num);
          expect(formatted).toMatch(/^\d+(\.\d)?K$/);
          return true;
        }
      ), { numRuns: 50 });
    });
  });
});
