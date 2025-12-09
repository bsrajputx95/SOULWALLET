/**
 * Property-based tests for Validation Functions
 * **Feature: home-screen-production-ready, Property 11: Solana Address Validation**
 * **Validates: Requirements 6.1, 14.1**
 * **Feature: home-screen-production-ready, Property 12: Price Impact Warning**
 * **Validates: Requirements 7.2**
 * **Feature: home-screen-production-ready, Property 15: Trader Profile Auto-Creation**
 * **Validates: Requirements 9.4**
 * **Feature: home-screen-production-ready, Property 16: Copy Trade Form Validation**
 * **Validates: Requirements 10.1, 14.2, 14.3**
 * **Feature: home-screen-production-ready, Property 17: Stop Loss Sign Conversion**
 * **Validates: Requirements 14.4**
 */
import * as fc from 'fast-check';
import { Keypair } from '@solana/web3.js';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

function validateSolanaAddress(address: string): ValidationResult {
  if (!address || address.trim() === '') {
    return { isValid: false, error: 'Address is required' };
  }
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44) {
    return { isValid: false, error: 'Invalid Solana address length' };
  }
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(trimmed)) {
    return { isValid: false, error: 'Invalid characters' };
  }
  return { isValid: true };
}

interface CopyTradeFormData {
  traderWallet: string;
  totalBudget: string;
  amountPerTrade: string;
}

interface FormValidationResult {
  isValid: boolean;
  errors?: Record<string, string>;
}

function validateCopyTradeForm(data: CopyTradeFormData): FormValidationResult {
  const errors: Record<string, string> = {};
  const walletResult = validateSolanaAddress(data.traderWallet);
  if (!walletResult.isValid) {
    errors.traderWallet = walletResult.error || 'Invalid wallet';
  }
  const totalBudget = parseFloat(data.totalBudget);
  if (isNaN(totalBudget) || totalBudget <= 0) {
    errors.totalBudget = 'Must be positive';
  }
  const amountPerTrade = parseFloat(data.amountPerTrade);
  if (isNaN(amountPerTrade) || amountPerTrade <= 0) {
    errors.amountPerTrade = 'Must be positive';
  } else if (!isNaN(totalBudget) && amountPerTrade > totalBudget) {
    errors.amountPerTrade = 'Cannot exceed budget';
  }
  return Object.keys(errors).length > 0 ? { isValid: false, errors } : { isValid: true };
}

function convertStopLossForStorage(input: number): number {
  return -Math.abs(input);
}

/**
 * Price impact warning logic - mirrors app/swap.tsx
 * Shows warning when price impact > 1%
 */
function shouldShowPriceImpactWarning(priceImpact: number): boolean {
  return priceImpact > 1;
}

function getPriceImpactSeverity(priceImpact: number): 'none' | 'warning' | 'danger' {
  if (priceImpact > 5) return 'danger';
  if (priceImpact > 1) return 'warning';
  return 'none';
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function genBase58(len: number): string {
  let r = '';
  for (let i = 0; i < len; i++) r += BASE58[Math.floor(Math.random() * 58)];
  return r;
}

describe('Validation Property Tests', () => {
  describe('Property 12: Price Impact Warning', () => {
    test('shows warning when price impact > 1%', () => {
      fc.assert(fc.property(
        fc.double({ min: 1.01, max: 100, noNaN: true }),
        (priceImpact) => {
          expect(shouldShowPriceImpactWarning(priceImpact)).toBe(true);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('no warning when price impact <= 1%', () => {
      fc.assert(fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (priceImpact) => {
          expect(shouldShowPriceImpactWarning(priceImpact)).toBe(false);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('danger severity when price impact > 5%', () => {
      fc.assert(fc.property(
        fc.double({ min: 5.01, max: 100, noNaN: true }),
        (priceImpact) => {
          expect(getPriceImpactSeverity(priceImpact)).toBe('danger');
          return true;
        }
      ), { numRuns: 100 });
    });

    test('warning severity when 1% < price impact <= 5%', () => {
      fc.assert(fc.property(
        fc.double({ min: 1.01, max: 5, noNaN: true }),
        (priceImpact) => {
          expect(getPriceImpactSeverity(priceImpact)).toBe('warning');
          return true;
        }
      ), { numRuns: 100 });
    });

    test('no severity when price impact <= 1%', () => {
      fc.assert(fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (priceImpact) => {
          expect(getPriceImpactSeverity(priceImpact)).toBe('none');
          return true;
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 11: Solana Address Validation', () => {
    test('accepts valid keypair addresses', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        for (let i = 0; i < n; i++) {
          const addr = Keypair.generate().publicKey.toBase58();
          expect(validateSolanaAddress(addr).isValid).toBe(true);
        }
        return true;
      }), { numRuns: 100 });
    });

    test('rejects empty strings', () => {
      expect(validateSolanaAddress('').isValid).toBe(false);
    });

    test('rejects short strings', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 31 }), (len) => {
        expect(validateSolanaAddress(genBase58(len)).isValid).toBe(false);
        return true;
      }), { numRuns: 100 });
    });

    test('rejects long strings', () => {
      fc.assert(fc.property(fc.integer({ min: 45, max: 100 }), (len) => {
        expect(validateSolanaAddress(genBase58(len)).isValid).toBe(false);
        return true;
      }), { numRuns: 100 });
    });

    test('accepts valid length base58', () => {
      fc.assert(fc.property(fc.integer({ min: 32, max: 44 }), (len) => {
        expect(validateSolanaAddress(genBase58(len)).isValid).toBe(true);
        return true;
      }), { numRuns: 100 });
    });
  });

  describe('Property 16: Copy Trade Form Validation', () => {
    test('accepts valid form', () => {
      fc.assert(fc.property(
        fc.double({ min: 10, max: 10000, noNaN: true }),
        fc.double({ min: 0.1, max: 1, noNaN: true }),
        (budget, frac) => {
          const wallet = Keypair.generate().publicKey.toBase58();
          const result = validateCopyTradeForm({
            traderWallet: wallet,
            totalBudget: budget.toString(),
            amountPerTrade: (budget * frac).toString(),
          });
          expect(result.isValid).toBe(true);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('rejects non-positive budget', () => {
      fc.assert(fc.property(
        fc.double({ min: -1000, max: 0, noNaN: true }),
        (budget) => {
          const wallet = Keypair.generate().publicKey.toBase58();
          const result = validateCopyTradeForm({
            traderWallet: wallet,
            totalBudget: budget.toString(),
            amountPerTrade: '10',
          });
          expect(result.isValid).toBe(false);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('rejects amount exceeding budget', () => {
      fc.assert(fc.property(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 1.01, max: 10, noNaN: true }),
        (budget, mult) => {
          const wallet = Keypair.generate().publicKey.toBase58();
          const result = validateCopyTradeForm({
            traderWallet: wallet,
            totalBudget: budget.toString(),
            amountPerTrade: (budget * mult).toString(),
          });
          expect(result.isValid).toBe(false);
          return true;
        }
      ), { numRuns: 100 });
    });

    test('rejects invalid wallet', () => {
      const result = validateCopyTradeForm({
        traderWallet: 'invalid',
        totalBudget: '100',
        amountPerTrade: '10',
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('Property 15: Trader Profile Auto-Creation', () => {
    // Simulates the auto-creation logic from copyTrading.ts
    function shouldAutoCreateTraderProfile(walletAddress: string, existingProfile: boolean): boolean {
      if (existingProfile) return false;
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      return base58Regex.test(walletAddress);
    }

    test('creates profile for valid wallet without existing profile', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        for (let i = 0; i < n; i++) {
          const addr = Keypair.generate().publicKey.toBase58();
          expect(shouldAutoCreateTraderProfile(addr, false)).toBe(true);
        }
        return true;
      }), { numRuns: 100 });
    });

    test('does not create profile if one already exists', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        for (let i = 0; i < n; i++) {
          const addr = Keypair.generate().publicKey.toBase58();
          expect(shouldAutoCreateTraderProfile(addr, true)).toBe(false);
        }
        return true;
      }), { numRuns: 100 });
    });

    test('rejects invalid wallet addresses', () => {
      const invalidAddresses = ['invalid', '123', 'abc!@#', '', '   '];
      for (const addr of invalidAddresses) {
        expect(shouldAutoCreateTraderProfile(addr, false)).toBe(false);
      }
    });

    test('rejects addresses with invalid characters', () => {
      // Base58 excludes 0, O, I, l
      const invalidChars = ['0', 'O', 'I', 'l'];
      for (const char of invalidChars) {
        const invalidAddr = char.repeat(32);
        expect(shouldAutoCreateTraderProfile(invalidAddr, false)).toBe(false);
      }
    });
  });

  describe('Property 17: Stop Loss Sign Conversion', () => {
    test('positive becomes negative', () => {
      fc.assert(fc.property(fc.double({ min: 0.01, max: 100, noNaN: true }), (v) => {
        expect(convertStopLossForStorage(v)).toBe(-v);
        return true;
      }), { numRuns: 100 });
    });

    test('negative stays negative', () => {
      fc.assert(fc.property(fc.double({ min: -100, max: -0.01, noNaN: true }), (v) => {
        expect(convertStopLossForStorage(v)).toBe(v);
        return true;
      }), { numRuns: 100 });
    });

    test('idempotent', () => {
      fc.assert(fc.property(fc.double({ min: 0.01, max: 100, noNaN: true }), (v) => {
        const first = convertStopLossForStorage(v);
        expect(convertStopLossForStorage(first)).toBe(first);
        return true;
      }), { numRuns: 100 });
    });

    test('preserves absolute value', () => {
      fc.assert(fc.property(
        fc.double({ min: -100, max: 100, noNaN: true }).filter(v => v !== 0),
        (v) => {
          expect(Math.abs(convertStopLossForStorage(v))).toBe(Math.abs(v));
          return true;
        }
      ), { numRuns: 100 });
    });
  });
});


/**
 * **Feature: copy-trading-production, Property 11: Transaction Limit Enforcement**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */
describe('Property 11: Transaction Limit Enforcement', () => {
  // Transaction limits from custodialWallet.ts
  const TRANSACTION_LIMITS = {
    maxSingleTransaction: 100, // 100 SOL
    maxDailyTransaction: 1000, // 1000 SOL
    maxCopyBudget: 10000, // 10000 USDC
    maxPerTrade: 1000, // 1000 USDC
  };

  function validateTransactionAmount(amount: number): { valid: boolean; error?: string } {
    if (amount > TRANSACTION_LIMITS.maxSingleTransaction) {
      return {
        valid: false,
        error: `Transaction amount ${amount} SOL exceeds maximum single transaction limit of ${TRANSACTION_LIMITS.maxSingleTransaction} SOL`,
      };
    }
    return { valid: true };
  }

  function validateCopyTradeBudget(
    totalBudget: number,
    amountPerTrade: number
  ): { valid: boolean; error?: string } {
    if (totalBudget > TRANSACTION_LIMITS.maxCopyBudget) {
      return {
        valid: false,
        error: `Total budget ${totalBudget} USDC exceeds maximum of ${TRANSACTION_LIMITS.maxCopyBudget} USDC`,
      };
    }
    if (amountPerTrade > TRANSACTION_LIMITS.maxPerTrade) {
      return {
        valid: false,
        error: `Amount per trade ${amountPerTrade} USDC exceeds maximum of ${TRANSACTION_LIMITS.maxPerTrade} USDC`,
      };
    }
    return { valid: true };
  }

  test('accepts transactions within single transaction limit', () => {
    fc.assert(fc.property(
      fc.double({ min: 0.001, max: 100, noNaN: true }),
      (amount) => {
        const result = validateTransactionAmount(amount);
        expect(result.valid).toBe(true);
        return true;
      }
    ), { numRuns: 100 });
  });

  test('rejects transactions exceeding single transaction limit', () => {
    fc.assert(fc.property(
      fc.double({ min: 100.01, max: 10000, noNaN: true }),
      (amount) => {
        const result = validateTransactionAmount(amount);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds maximum');
        return true;
      }
    ), { numRuns: 100 });
  });

  test('accepts copy budget within limits', () => {
    fc.assert(fc.property(
      fc.double({ min: 10, max: 10000, noNaN: true }),
      fc.double({ min: 1, max: 1000, noNaN: true }),
      (budget, perTrade) => {
        const result = validateCopyTradeBudget(budget, perTrade);
        expect(result.valid).toBe(true);
        return true;
      }
    ), { numRuns: 100 });
  });

  test('rejects copy budget exceeding maximum', () => {
    fc.assert(fc.property(
      fc.double({ min: 10001, max: 100000, noNaN: true }),
      (budget) => {
        const result = validateCopyTradeBudget(budget, 100);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Total budget');
        return true;
      }
    ), { numRuns: 100 });
  });

  test('rejects amount per trade exceeding maximum', () => {
    fc.assert(fc.property(
      fc.double({ min: 1001, max: 10000, noNaN: true }),
      (perTrade) => {
        const result = validateCopyTradeBudget(5000, perTrade);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Amount per trade');
        return true;
      }
    ), { numRuns: 100 });
  });
});
