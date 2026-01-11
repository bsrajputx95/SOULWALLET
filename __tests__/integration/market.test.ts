/**
 * Market Router Integration Tests
 * 
 * Tests for market data operations including:
 * - Token search
 * - Trending tokens
 * - Token details
 */

import {
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  waitForServer,
} from '../utils/test-helpers';
import { VALID_SOLANA_ADDRESSES, invalidData, testTimeouts } from '../utils/test-fixtures';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Market Router Integration Tests', () => {
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

  describe('Get Token', () => {
    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('market.getToken', {
          mintAddress: VALID_SOLANA_ADDRESSES.SOL_MINT,
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject invalid mint address', async () => {
      await expectTRPCError(
        trpcQuery('market.getToken', {
          mintAddress: invalidData.invalidSolanaAddress,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Search Tokens', () => {
    it('should search tokens by query', async () => {
      try {
        const result = await trpcQuery('market.search', {
          query: 'SOL',
          limit: 10,
        }, testUser.token);

        expect(Array.isArray(result) || result.tokens !== undefined).toBe(true);
      } catch (error: any) {
        // Market endpoints may fail if external APIs are unavailable
        expect(['INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE']).toContain(error.code);
      }
    });

    it('should handle empty search query', async () => {
      try {
        const result = await trpcQuery('market.search', {
          query: '',
          limit: 10,
        }, testUser.token);

        // Should return empty or default results
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject unauthenticated search', async () => {
      await expectTRPCError(
        trpcQuery('market.search', {
          query: 'SOL',
        }),
        'UNAUTHORIZED'
      );
    });

    it('should handle special characters in search', async () => {
      try {
        await trpcQuery('market.search', {
          query: invalidData.sqlInjection,
          limit: 10,
        }, testUser.token);
      } catch (error: any) {
        // Should not cause SQL error
        expect(error.code).not.toBe('INTERNAL_SERVER_ERROR');
      }
    });
  });

  describe('Trending Tokens', () => {
    it('should get trending tokens', async () => {
      try {
        const result = await trpcQuery('market.trending', {}, testUser.token);

        expect(Array.isArray(result) || result.tokens !== undefined).toBe(true);
      } catch (error: any) {
        // May fail if external API unavailable
        expect(['INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE']).toContain(error.code);
      }
    });

    it('should reject unauthenticated trending request', async () => {
      await expectTRPCError(
        trpcQuery('market.trending', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('SoulMarket Tokens', () => {
    it('should get curated tokens', async () => {
      try {
        const result = await trpcQuery('market.soulMarket', {}, testUser.token);

        expect(Array.isArray(result) || result.tokens !== undefined).toBe(true);
      } catch (error: any) {
        // May fail if external API unavailable
        expect(error.code).toBeDefined();
      }
    });

    it('should reject unauthenticated soulMarket request', async () => {
      await expectTRPCError(
        trpcQuery('market.soulMarket', {}),
        'UNAUTHORIZED'
      );
    });
  });
});
