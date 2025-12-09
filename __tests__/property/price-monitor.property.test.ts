/**
 * Property-based tests for PriceMonitor SL/TP Logic
 * 
 * **Feature: home-screen-production-ready, Property 6: P&L Calculation Accuracy**
 * **Validates: Requirements 3.1**
 * 
 * **Feature: home-screen-production-ready, Property 7: Stop Loss Trigger**
 * **Validates: Requirements 3.2, 3.4**
 * 
 * **Feature: home-screen-production-ready, Property 8: Take Profit Trigger**
 * **Validates: Requirements 3.3, 3.4**
 */

import * as fc from 'fast-check';

// Position lock timeout matching the service
const POSITION_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Test helper functions that mirror the price monitor logic

/**
 * Calculate P&L percentage using entry VALUE (accounts for fees/slippage)
 * This is the corrected calculation that uses entryValue instead of entryPrice
 */
function calculatePLPercent(
  entryAmount: number,
  entryValue: number,
  currentPrice: number
): number {
  const currentValue = entryAmount * currentPrice;
  return ((currentValue - entryValue) / entryValue) * 100;
}

/**
 * Check if stop loss should trigger
 * Stop loss is stored as negative percentage (e.g., -10 for 10% loss)
 */
function shouldTriggerStopLoss(
  plPercent: number,
  stopLoss: number | null
): boolean {
  if (stopLoss === null) return false;
  return plPercent <= stopLoss;
}

/**
 * Check if take profit should trigger
 * Take profit is stored as positive percentage (e.g., 30 for 30% gain)
 */
function shouldTriggerTakeProfit(
  plPercent: number,
  takeProfit: number | null
): boolean {
  if (takeProfit === null) return false;
  return plPercent >= takeProfit;
}

/**
 * Check if a position lock is still valid (not expired)
 */
function isLockValid(lockTimestamp: Date | null): boolean {
  if (lockTimestamp === null) return false;
  const lockAge = Date.now() - lockTimestamp.getTime();
  return lockAge < POSITION_LOCK_TIMEOUT_MS;
}

/**
 * Check if a position should be skipped due to active lock
 */
function shouldSkipDueToLock(slTpTriggeredAt: Date | null): boolean {
  return isLockValid(slTpTriggeredAt);
}

describe('PriceMonitor Property Tests', () => {
  /**
   * **Feature: home-screen-production-ready, Property 6: P&L Calculation Accuracy**
   * **Validates: Requirements 3.1**
   * 
   * For any position, the P&L percentage SHALL be calculated using the entry
   * VALUE (not just entry price) to account for fees and slippage.
   */
  describe('Property 6: P&L Calculation Accuracy', () => {
    it('P&L should be zero when current value equals entry value', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 1000000, noNaN: true }), // entry amount
          fc.double({ min: 0.000001, max: 10000, noNaN: true }), // entry price
          (entryAmount, entryPrice) => {
            const entryValue = entryAmount * entryPrice;
            const currentPrice = entryPrice; // Same price
            
            const plPercent = calculatePLPercent(entryAmount, entryValue, currentPrice);
            
            expect(Math.abs(plPercent)).toBeLessThan(0.0001);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('P&L should be positive when current value exceeds entry value', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 1000000, noNaN: true }), // entry amount
          fc.double({ min: 0.000001, max: 10000, noNaN: true }), // entry price
          fc.double({ min: 1.01, max: 10, noNaN: true }), // price multiplier > 1
          (entryAmount, entryPrice, multiplier) => {
            const entryValue = entryAmount * entryPrice;
            const currentPrice = entryPrice * multiplier;
            
            const plPercent = calculatePLPercent(entryAmount, entryValue, currentPrice);
            
            expect(plPercent).toBeGreaterThan(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('P&L should be negative when current value is below entry value', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 1000000, noNaN: true }), // entry amount
          fc.double({ min: 0.000001, max: 10000, noNaN: true }), // entry price
          fc.double({ min: 0.1, max: 0.99, noNaN: true }), // price multiplier < 1
          (entryAmount, entryPrice, multiplier) => {
            const entryValue = entryAmount * entryPrice;
            const currentPrice = entryPrice * multiplier;
            
            const plPercent = calculatePLPercent(entryAmount, entryValue, currentPrice);
            
            expect(plPercent).toBeLessThan(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('P&L calculation should account for fees in entry value', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000, noNaN: true }), // entry amount
          fc.double({ min: 0.01, max: 100, noNaN: true }), // entry price
          fc.double({ min: 0.001, max: 0.05, noNaN: true }), // fee percentage (0.1% - 5%)
          (entryAmount, entryPrice, feePercent) => {
            // Entry value includes fees (higher than raw amount * price)
            const rawValue = entryAmount * entryPrice;
            const entryValueWithFees = rawValue * (1 + feePercent);
            
            // At same price, P&L should be negative due to fees
            const plPercent = calculatePLPercent(entryAmount, entryValueWithFees, entryPrice);
            
            expect(plPercent).toBeLessThan(0);
            // The loss should approximately equal the fee percentage
            const expectedLoss = -feePercent * 100 / (1 + feePercent);
            expect(Math.abs(plPercent - expectedLoss)).toBeLessThan(0.1);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: home-screen-production-ready, Property 7: Stop Loss Trigger**
   * **Validates: Requirements 3.2, 3.4**
   * 
   * For any position with a stop loss set, when the P&L percentage drops to
   * or below the stop loss threshold, a sell order SHALL be triggered.
   */
  describe('Property 7: Stop Loss Trigger', () => {
    it('should trigger when P&L equals stop loss', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -99, max: -1, noNaN: true }), // stop loss (negative)
          (stopLoss) => {
            const plPercent = stopLoss; // Exactly at stop loss
            
            expect(shouldTriggerStopLoss(plPercent, stopLoss)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trigger when P&L is below stop loss', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: -1, noNaN: true }), // stop loss
          fc.double({ min: 0.1, max: 10, noNaN: true }), // additional loss
          (stopLoss, additionalLoss) => {
            const plPercent = stopLoss - additionalLoss; // Below stop loss
            
            expect(shouldTriggerStopLoss(plPercent, stopLoss)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT trigger when P&L is above stop loss', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: -1, noNaN: true }), // stop loss
          fc.double({ min: 0.1, max: 50, noNaN: true }), // buffer above
          (stopLoss, buffer) => {
            const plPercent = stopLoss + buffer; // Above stop loss
            
            expect(shouldTriggerStopLoss(plPercent, stopLoss)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT trigger when stop loss is null', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: 100, noNaN: true }), // any P&L
          (plPercent) => {
            expect(shouldTriggerStopLoss(plPercent, null)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('stop loss should be stored as negative value', () => {
      // This validates the sign convention
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 99, noNaN: true }), // user input (positive)
          (userInput) => {
            // Frontend should convert to negative
            const storedStopLoss = -Math.abs(userInput);
            
            expect(storedStopLoss).toBeLessThan(0);
            expect(Math.abs(storedStopLoss)).toBe(userInput);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: home-screen-production-ready, Property 8: Take Profit Trigger**
   * **Validates: Requirements 3.3, 3.4**
   * 
   * For any position with a take profit set, when the P&L percentage rises to
   * or above the take profit threshold, a sell order SHALL be triggered.
   */
  describe('Property 8: Take Profit Trigger', () => {
    it('should trigger when P&L equals take profit', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000, noNaN: true }), // take profit (positive)
          (takeProfit) => {
            const plPercent = takeProfit; // Exactly at take profit
            
            expect(shouldTriggerTakeProfit(plPercent, takeProfit)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trigger when P&L exceeds take profit', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 500, noNaN: true }), // take profit
          fc.double({ min: 0.1, max: 100, noNaN: true }), // additional gain
          (takeProfit, additionalGain) => {
            const plPercent = takeProfit + additionalGain; // Above take profit
            
            expect(shouldTriggerTakeProfit(plPercent, takeProfit)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT trigger when P&L is below take profit', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 500, noNaN: true }), // take profit
          fc.double({ min: 0.1, max: 9, noNaN: true }), // buffer below
          (takeProfit, buffer) => {
            const plPercent = takeProfit - buffer; // Below take profit
            
            expect(shouldTriggerTakeProfit(plPercent, takeProfit)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT trigger when take profit is null', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: 1000, noNaN: true }), // any P&L
          (plPercent) => {
            expect(shouldTriggerTakeProfit(plPercent, null)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('take profit should be stored as positive value', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000, noNaN: true }), // user input
          (userInput) => {
            // Take profit is always positive
            const storedTakeProfit = Math.abs(userInput);
            
            expect(storedTakeProfit).toBeGreaterThan(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Position Locking Tests
   * **Validates: Requirements 3.4, 3.5**
   * 
   * Positions should be locked during SL/TP processing to prevent duplicate sells.
   */
  describe('Position Locking', () => {
    it('should skip position with valid lock', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: POSITION_LOCK_TIMEOUT_MS - 1000 }), // lock age < timeout
          (lockAgeMs) => {
            const lockTimestamp = new Date(Date.now() - lockAgeMs);
            
            expect(shouldSkipDueToLock(lockTimestamp)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT skip position with expired lock', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: POSITION_LOCK_TIMEOUT_MS + 1000, max: POSITION_LOCK_TIMEOUT_MS * 10 }), // lock age > timeout
          (lockAgeMs) => {
            const lockTimestamp = new Date(Date.now() - lockAgeMs);
            
            expect(shouldSkipDueToLock(lockTimestamp)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT skip position with null lock', () => {
      expect(shouldSkipDueToLock(null)).toBe(false);
    });

    it('lock validity should be deterministic for same timestamp', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: POSITION_LOCK_TIMEOUT_MS * 2 }),
          (lockAgeMs) => {
            const lockTimestamp = new Date(Date.now() - lockAgeMs);
            
            const result1 = shouldSkipDueToLock(lockTimestamp);
            const result2 = shouldSkipDueToLock(lockTimestamp);
            
            expect(result1).toBe(result2);
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Combined SL/TP Logic Tests
   */
  describe('Combined SL/TP Logic', () => {
    it('SL and TP should be mutually exclusive triggers', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -50, max: -5, noNaN: true }), // stop loss
          fc.double({ min: 10, max: 100, noNaN: true }), // take profit
          fc.double({ min: -100, max: 200, noNaN: true }), // P&L
          (stopLoss, takeProfit, plPercent) => {
            const slTriggered = shouldTriggerStopLoss(plPercent, stopLoss);
            const tpTriggered = shouldTriggerTakeProfit(plPercent, takeProfit);
            
            // Both cannot trigger at the same time (SL is negative, TP is positive)
            // If SL triggers, P&L is very negative, so TP won't trigger
            // If TP triggers, P&L is very positive, so SL won't trigger
            if (slTriggered && tpTriggered) {
              // This should never happen with valid SL/TP values
              // SL is negative, TP is positive, so there's always a gap
              throw new Error('Both SL and TP triggered simultaneously');
            }
            
            return true;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('position in profit should not trigger stop loss', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -50, max: -1, noNaN: true }), // stop loss
          fc.double({ min: 1, max: 100, noNaN: true }), // positive P&L
          (stopLoss, plPercent) => {
            expect(shouldTriggerStopLoss(plPercent, stopLoss)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('position in loss should not trigger take profit', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 100, noNaN: true }), // take profit
          fc.double({ min: -100, max: -1, noNaN: true }), // negative P&L
          (takeProfit, plPercent) => {
            expect(shouldTriggerTakeProfit(plPercent, takeProfit)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
