/**
 * Property-based tests for Coin Data Completeness
 * **Feature: home-screen-production-ready, Property 14: Coin Data Completeness**
 * **Validates: Requirements 8.4**
 */
import * as fc from 'fast-check';

interface CoinData {
  symbol: string;
  name: string;
  price: number | null;
  change24h: number | null;
  volume: number | null;
  marketCap?: number | null;
}

/**
 * Validates that coin data has all required fields for display
 */
function isCoinDataComplete(coin: CoinData): boolean {
  return (
    coin.price !== null &&
    coin.price !== undefined &&
    coin.change24h !== null &&
    coin.change24h !== undefined &&
    coin.volume !== null &&
    coin.volume !== undefined
  );
}

/**
 * Filters out incomplete coin data from a list
 */
function filterCompleteCoinData(coins: CoinData[]): CoinData[] {
  return coins.filter(isCoinDataComplete);
}

/**
 * Generates a complete coin data object
 */
const completeCoinArb = fc.record({
  symbol: fc.string({ minLength: 2, maxLength: 10 }),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  price: fc.double({ min: 0.000001, max: 100000, noNaN: true }),
  change24h: fc.double({ min: -100, max: 1000, noNaN: true }),
  volume: fc.double({ min: 0, max: 1e12, noNaN: true }),
});


describe('Coin Data Property Tests', () => {
  describe('Property 14: Coin Data Completeness', () => {
    test('complete coin data passes validation', () => {
      fc.assert(fc.property(completeCoinArb, (coin) => {
        expect(isCoinDataComplete(coin)).toBe(true);
        return true;
      }), { numRuns: 100 });
    });

    test('coin with null price fails validation', () => {
      fc.assert(fc.property(completeCoinArb, (coin) => {
        const incompleteCoin = { ...coin, price: null };
        expect(isCoinDataComplete(incompleteCoin)).toBe(false);
        return true;
      }), { numRuns: 100 });
    });

    test('coin with null change24h fails validation', () => {
      fc.assert(fc.property(completeCoinArb, (coin) => {
        const incompleteCoin = { ...coin, change24h: null };
        expect(isCoinDataComplete(incompleteCoin)).toBe(false);
        return true;
      }), { numRuns: 100 });
    });

    test('coin with null volume fails validation', () => {
      fc.assert(fc.property(completeCoinArb, (coin) => {
        const incompleteCoin = { ...coin, volume: null };
        expect(isCoinDataComplete(incompleteCoin)).toBe(false);
        return true;
      }), { numRuns: 100 });
    });

    test('filter removes incomplete coins', () => {
      fc.assert(fc.property(
        fc.array(completeCoinArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 19 }),
        (coins, nullIndex) => {
          if (nullIndex < coins.length) {
            // Make one coin incomplete
            const mixedCoins: CoinData[] = coins.map(c => ({
              symbol: c.symbol,
              name: c.name,
              price: c.price,
              change24h: c.change24h,
              volume: c.volume,
            }));
            const coinToModify = mixedCoins[nullIndex]!;
            mixedCoins[nullIndex] = {
              symbol: coinToModify.symbol,
              name: coinToModify.name,
              price: null,
              change24h: coinToModify.change24h,
              volume: coinToModify.volume,
            };
            
            const filtered = filterCompleteCoinData(mixedCoins);
            expect(filtered.length).toBe(coins.length - 1);
            expect(filtered.every(isCoinDataComplete)).toBe(true);
          }
          return true;
        }
      ), { numRuns: 50 });
    });

    test('all filtered coins have required fields', () => {
      fc.assert(fc.property(
        fc.array(completeCoinArb, { minLength: 0, maxLength: 50 }),
        (coins) => {
          const filtered = filterCompleteCoinData(coins);
          for (const coin of filtered) {
            expect(coin.price).not.toBeNull();
            expect(coin.change24h).not.toBeNull();
            expect(coin.volume).not.toBeNull();
          }
          return true;
        }
      ), { numRuns: 100 });
    });
  });
});
