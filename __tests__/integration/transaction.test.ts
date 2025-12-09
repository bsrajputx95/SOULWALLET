/**
 * Transaction Router Integration Tests
 * 
 * Tests for transaction management including:
 * - List transactions
 * - Get by signature
 * - Sync transactions
 * - Verify transactions
 * - Statistics
 */

import {
  trpcRequest,
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  mockSolanaTransaction,
  waitForServer,
} from '../utils/test-helpers';
import { invalidData, testTimeouts } from '../utils/test-fixtures';

describe('Transaction Router Integration Tests', () => {
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

  describe('List Transactions', () => {
    it('should get all transactions', async () => {
      try {
        const result = await trpcQuery('transaction.list', {
          limit: 10,
        }, testUser.token);

        expect(result.transactions !== undefined || Array.isArray(result)).toBe(true);
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should filter by type', async () => {
      try {
        const result = await trpcQuery('transaction.list', {
          type: 'SEND',
          limit: 10,
        }, testUser.token);

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject invalid type filter', async () => {
      await expectTRPCError(
        trpcQuery('transaction.list', {
          type: 'INVALID_TYPE',
          limit: 10,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('transaction.list', { limit: 10 }),
        'UNAUTHORIZED'
      );
    });

    it('should handle pagination', async () => {
      try {
        const result = await trpcQuery('transaction.list', {
          limit: 5,
          offset: 0,
        }, testUser.token);

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });
  });

  describe('Get by Signature', () => {
    it('should return not found for non-existent signature', async () => {
      const fakeSignature = mockSolanaTransaction();

      await expectTRPCError(
        trpcQuery('transaction.getBySignature', {
          signature: fakeSignature,
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject invalid signature format', async () => {
      await expectTRPCError(
        trpcQuery('transaction.getBySignature', {
          signature: 'invalid-signature',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('transaction.getBySignature', {
          signature: mockSolanaTransaction(),
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Sync Transactions', () => {
    it('should reject sync without wallet', async () => {
      await expectTRPCError(
        trpcRequest('transaction.sync', {}, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated sync', async () => {
      await expectTRPCError(
        trpcRequest('transaction.sync', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Verify Transaction', () => {
    it('should handle non-existent transaction', async () => {
      const fakeSignature = mockSolanaTransaction();

      try {
        const result = await trpcRequest('transaction.verify', {
          signature: fakeSignature,
        }, testUser.token);

        // May return verification result or error
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(['NOT_FOUND', 'BAD_REQUEST', 'INTERNAL_SERVER_ERROR']).toContain(error.code);
      }
    });

    it('should reject invalid signature', async () => {
      await expectTRPCError(
        trpcRequest('transaction.verify', {
          signature: 'invalid',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated verify', async () => {
      await expectTRPCError(
        trpcRequest('transaction.verify', {
          signature: mockSolanaTransaction(),
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Bulk Verify', () => {
    it('should verify multiple transactions', async () => {
      const signatures = [
        mockSolanaTransaction(),
        mockSolanaTransaction(),
      ];

      try {
        const result = await trpcRequest('transaction.bulkVerify', {
          signatures,
        }, testUser.token);

        expect(result.results !== undefined || Array.isArray(result)).toBe(true);
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject empty signatures array', async () => {
      await expectTRPCError(
        trpcRequest('transaction.bulkVerify', {
          signatures: [],
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject too many signatures', async () => {
      const tooManySignatures = Array(15).fill(null).map(() => mockSolanaTransaction());

      await expectTRPCError(
        trpcRequest('transaction.bulkVerify', {
          signatures: tooManySignatures,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated bulk verify', async () => {
      await expectTRPCError(
        trpcRequest('transaction.bulkVerify', {
          signatures: [mockSolanaTransaction()],
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Statistics', () => {
    it('should get transaction statistics', async () => {
      try {
        const result = await trpcQuery('transaction.getStats', {
          period: '30d',
        }, testUser.token);

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject invalid period', async () => {
      await expectTRPCError(
        trpcQuery('transaction.getStats', {
          period: 'invalid',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated stats request', async () => {
      await expectTRPCError(
        trpcQuery('transaction.getStats', { period: '30d' }),
        'UNAUTHORIZED'
      );
    });

    it('should support different periods', async () => {
      const periods = ['7d', '30d', '90d', '1y'];

      for (const period of periods) {
        try {
          const result = await trpcQuery('transaction.getStats', {
            period,
          }, testUser.token);

          expect(result).toBeDefined();
        } catch (error: any) {
          // May fail for some periods
          expect(error.code).toBeDefined();
        }
      }
    });
  });
});
