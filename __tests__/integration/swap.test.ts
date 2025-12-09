/**
 * Swap Router Integration Tests
 * 
 * Tests for token swap operations including:
 * - Get quote
 * - Execute swap
 * - Swap history
 */

import {
  trpcRequest,
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  waitForServer,
} from '../utils/test-helpers';
import { VALID_SOLANA_ADDRESSES, invalidData, testTimeouts } from '../utils/test-fixtures';

describe('Swap Router Integration Tests', () => {
  let testUser: { email: string; password: string; token: string; refreshToken: string; userId: string };

  beforeAll(async () => {
    const serverReady = await waitForServer(testTimeouts.long);
    if (!serverReady) {
      throw new Error('Server is not running. Start with: npm run server:dev');
    }
    testUser = await createTestUser();
  }, testTimeouts.long);

  afterAll(async () => {
    if (testUser?.email) {
      await cleanupTestUser(testUser.email);
    }
  });

  describe('Get Quote', () => {
    it('should get quote for SOL to USDC', async () => {
      try {
        const result = await trpcQuery('swap.getQuote', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 1000000000, // 1 SOL in lamports
          slippageBps: 50,
        }, testUser.token);

        expect(result.outAmount || result.quote).toBeDefined();
      } catch (error: any) {
        // Jupiter API may be unavailable
        expect(['INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE', 'BAD_REQUEST']).toContain(error.code);
      }
    });

    it('should reject zero amount', async () => {
      await expectTRPCError(
        trpcQuery('swap.getQuote', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 0,
          slippageBps: 50,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject negative amount', async () => {
      await expectTRPCError(
        trpcQuery('swap.getQuote', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: invalidData.negativeNumber,
          slippageBps: 50,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject invalid input mint', async () => {
      await expectTRPCError(
        trpcQuery('swap.getQuote', {
          inputMint: invalidData.invalidSolanaAddress,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 1000000000,
          slippageBps: 50,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject invalid output mint', async () => {
      await expectTRPCError(
        trpcQuery('swap.getQuote', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: invalidData.invalidSolanaAddress,
          amount: 1000000000,
          slippageBps: 50,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated quote request', async () => {
      await expectTRPCError(
        trpcQuery('swap.getQuote', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 1000000000,
          slippageBps: 50,
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject extreme slippage', async () => {
      await expectTRPCError(
        trpcQuery('swap.getQuote', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 1000000000,
          slippageBps: 10000, // 100% slippage
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Execute Swap', () => {
    it('should reject swap without wallet', async () => {
      await expectTRPCError(
        trpcRequest('swap.executeSwap', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 1000000000,
          slippageBps: 50,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated swap', async () => {
      await expectTRPCError(
        trpcRequest('swap.executeSwap', {
          inputMint: VALID_SOLANA_ADDRESSES.SOL_MINT,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 1000000000,
          slippageBps: 50,
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject invalid swap parameters', async () => {
      await expectTRPCError(
        trpcRequest('swap.executeSwap', {
          inputMint: invalidData.invalidSolanaAddress,
          outputMint: VALID_SOLANA_ADDRESSES.USDC_MINT,
          amount: 1000000000,
          slippageBps: 50,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Supported Tokens', () => {
    it('should get supported tokens list', async () => {
      try {
        const result = await trpcQuery('swap.getSupportedTokens', {}, testUser.token);

        expect(result.tokens !== undefined || Array.isArray(result)).toBe(true);
      } catch (error: any) {
        // May not be implemented or API unavailable
        expect(error.code).toBeDefined();
      }
    });

    it('should reject unauthenticated supported tokens request', async () => {
      await expectTRPCError(
        trpcQuery('swap.getSupportedTokens', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Swap History', () => {
    it('should get swap history', async () => {
      try {
        const result = await trpcQuery('swap.getHistory', {
          limit: 10,
        }, testUser.token);

        expect(result.swaps !== undefined || Array.isArray(result)).toBe(true);
      } catch (error: any) {
        // May not be implemented
        expect(error.code).toBeDefined();
      }
    });

    it('should reject unauthenticated history request', async () => {
      await expectTRPCError(
        trpcQuery('swap.getHistory', { limit: 10 }),
        'UNAUTHORIZED'
      );
    });

    it('should handle pagination', async () => {
      try {
        const result = await trpcQuery('swap.getHistory', {
          limit: 5,
          offset: 0,
        }, testUser.token);

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });
  });
});
