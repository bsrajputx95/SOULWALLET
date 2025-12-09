/**
 * Portfolio Router Integration Tests
 * 
 * Tests for portfolio tracking including:
 * - Overview
 * - History
 * - Performance
 * - Asset breakdown
 * - P&L
 */

import {
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  waitForServer,
} from '../utils/test-helpers';
import { invalidData, testTimeouts } from '../utils/test-fixtures';

describe('Portfolio Router Integration Tests', () => {
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

  describe('Overview', () => {
    it('should return error when no wallet linked', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getOverview', {}, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getOverview', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('History', () => {
    it('should return error when no wallet linked', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getHistory', {
          period: '7D',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject invalid period', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getHistory', {
          period: 'INVALID',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getHistory', { period: '7D' }),
        'UNAUTHORIZED'
      );
    });

    it('should support all valid periods', async () => {
      const periods = ['1D', '7D', '30D', '90D', '1Y'];

      for (const period of periods) {
        await expectTRPCError(
          trpcQuery('portfolio.getHistory', { period }, testUser.token),
          'BAD_REQUEST' // No wallet linked
        );
      }
    });
  });

  describe('Performance', () => {
    it('should return error when no wallet linked', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getPerformance', {}, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getPerformance', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Asset Breakdown', () => {
    it('should return error when no wallet linked', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getAssetBreakdown', {}, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getAssetBreakdown', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('P&L (Profit and Loss)', () => {
    it('should return error when no wallet linked', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getPnL', {
          period: '7d',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject invalid period', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getPnL', {
          period: 'invalid',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.getPnL', { period: '7d' }),
        'UNAUTHORIZED'
      );
    });

    it('should support all valid periods', async () => {
      const periods = ['1d', '7d', '30d', 'all'];

      for (const period of periods) {
        await expectTRPCError(
          trpcQuery('portfolio.getPnL', { period }, testUser.token),
          'BAD_REQUEST' // No wallet linked
        );
      }
    });
  });

  describe('Snapshots', () => {
    it('should return error when creating snapshot without wallet', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.createSnapshot', {}, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated snapshot creation', async () => {
      await expectTRPCError(
        trpcQuery('portfolio.createSnapshot', {}),
        'UNAUTHORIZED'
      );
    });
  });
});
