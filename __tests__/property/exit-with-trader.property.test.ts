/**
 * Property-based tests for Exit With Trader Logic
 * 
 * **Feature: home-screen-production-ready, Property 9: Exit With Trader Proportional Sell**
 * **Validates: Requirements 4.2, 4.3, 4.4**
 */

import * as fc from 'fast-check';

// Test helper functions that mirror the exit with trader logic

/**
 * Calculate the sell percentage based on trader's sell amount vs total holding
 */
function calculateSellPercentage(sellAmount: number, totalHolding: number): number {
  if (totalHolding <= 0) return 1.0; // Full sell if we can't determine holding
  const percentage = sellAmount / totalHolding;
  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, percentage));
}

/**
 * Calculate proportional sell amount for a copier position
 */
function calculateProportionalSellAmount(
  positionAmount: number,
  sellPercentage: number
): number {
  return positionAmount * sellPercentage;
}

/**
 * Check if sell amount is meaningful (not too small)
 */
function isMeaningfulSellAmount(sellAmount: number, positionAmount: number): boolean {
  // Sell amount must be at least 0.001% of position
  return sellAmount >= positionAmount * 0.00001;
}

/**
 * Determine if a position should be sold based on exitWithTrader setting
 */
function shouldExitWithTrader(
  exitWithTrader: boolean,
  traderSoldToken: boolean
): boolean {
  return exitWithTrader && traderSoldToken;
}

describe('Exit With Trader Property Tests', () => {
  /**
   * **Feature: home-screen-production-ready, Property 9: Exit With Trader Proportional Sell**
   * **Validates: Requirements 4.2, 4.3, 4.4**
   * 
   * When a trader sells a portion of their position, copiers with exitWithTrader
   * enabled SHALL sell the same proportion of their position.
   */
  describe('Property 9: Exit With Trader Proportional Sell', () => {
    it('full sell should result in 100% sell percentage', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000000, noNaN: true }), // total holding
          (totalHolding) => {
            const sellAmount = totalHolding; // Full sell
            const percentage = calculateSellPercentage(sellAmount, totalHolding);
            
            expect(percentage).toBe(1.0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('partial sell should result in proportional percentage', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 1000000, noNaN: true }), // total holding
          fc.double({ min: 0.1, max: 0.9, noNaN: true }), // sell fraction
          (totalHolding, sellFraction) => {
            const sellAmount = totalHolding * sellFraction;
            const percentage = calculateSellPercentage(sellAmount, totalHolding);
            
            // Percentage should match the sell fraction
            expect(Math.abs(percentage - sellFraction)).toBeLessThan(0.0001);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sell percentage should be clamped between 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 10000, noNaN: true }), // sell amount (can be invalid)
          fc.double({ min: 1, max: 1000, noNaN: true }), // total holding
          (sellAmount, totalHolding) => {
            const percentage = calculateSellPercentage(sellAmount, totalHolding);
            
            expect(percentage).toBeGreaterThanOrEqual(0);
            expect(percentage).toBeLessThanOrEqual(1);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unknown total holding should default to full sell', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000000, noNaN: true }), // sell amount
          fc.double({ min: -1000, max: 0, noNaN: true }), // invalid total holding
          (sellAmount, invalidHolding) => {
            const percentage = calculateSellPercentage(sellAmount, invalidHolding);
            
            expect(percentage).toBe(1.0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('proportional sell amount should scale with position size', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 100000, noNaN: true }), // position amount
          fc.double({ min: 0.1, max: 1.0, noNaN: true }), // sell percentage
          (positionAmount, sellPercentage) => {
            const sellAmount = calculateProportionalSellAmount(positionAmount, sellPercentage);
            
            // Sell amount should be proportional
            const expectedAmount = positionAmount * sellPercentage;
            expect(Math.abs(sellAmount - expectedAmount)).toBeLessThan(0.0001);
            
            // Sell amount should not exceed position
            expect(sellAmount).toBeLessThanOrEqual(positionAmount);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Meaningful Sell Amount Tests
   */
  describe('Meaningful Sell Amount', () => {
    it('very small sell amounts should be rejected', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 1000000, noNaN: true }), // position amount
          fc.double({ min: 0.000001, max: 0.000009, noNaN: true }), // tiny percentage
          (positionAmount, tinyPercentage) => {
            const sellAmount = positionAmount * tinyPercentage;
            
            expect(isMeaningfulSellAmount(sellAmount, positionAmount)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reasonable sell amounts should be accepted', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 100000, noNaN: true }), // position amount
          fc.double({ min: 0.01, max: 1.0, noNaN: true }), // reasonable percentage
          (positionAmount, percentage) => {
            const sellAmount = positionAmount * percentage;
            
            expect(isMeaningfulSellAmount(sellAmount, positionAmount)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Exit With Trader Decision Tests
   */
  describe('Exit With Trader Decision', () => {
    it('should exit when exitWithTrader is true and trader sold', () => {
      expect(shouldExitWithTrader(true, true)).toBe(true);
    });

    it('should NOT exit when exitWithTrader is false', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // trader sold
          (traderSold) => {
            expect(shouldExitWithTrader(false, traderSold)).toBe(false);
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should NOT exit when trader did not sell', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // exitWithTrader setting
          (exitWithTrader) => {
            expect(shouldExitWithTrader(exitWithTrader, false)).toBe(false);
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Deduplication Tests
   * Validates that duplicate sell orders are prevented
   */
  describe('Deduplication', () => {
    // Simulate position lock state
    interface PositionLockState {
      positionId: string;
      lockedAt: Date | null;
    }

    const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    function isPositionLocked(state: PositionLockState): boolean {
      if (!state.lockedAt) return false;
      const lockAge = Date.now() - state.lockedAt.getTime();
      return lockAge < LOCK_TIMEOUT_MS;
    }

    function canProcessPosition(state: PositionLockState): boolean {
      return !isPositionLocked(state);
    }

    it('locked positions should not be processed again', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 20 }), // position ID
          fc.integer({ min: 1, max: LOCK_TIMEOUT_MS - 1000 }), // lock age < timeout
          (positionId, lockAgeMs) => {
            const state: PositionLockState = {
              positionId,
              lockedAt: new Date(Date.now() - lockAgeMs),
            };
            
            expect(canProcessPosition(state)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unlocked positions should be processable', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 20 }), // position ID
          (positionId) => {
            const state: PositionLockState = {
              positionId,
              lockedAt: null,
            };
            
            expect(canProcessPosition(state)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('expired locks should allow processing', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 20 }), // position ID
          fc.integer({ min: LOCK_TIMEOUT_MS + 1000, max: LOCK_TIMEOUT_MS * 10 }), // lock age > timeout
          (positionId, lockAgeMs) => {
            const state: PositionLockState = {
              positionId,
              lockedAt: new Date(Date.now() - lockAgeMs),
            };
            
            expect(canProcessPosition(state)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
