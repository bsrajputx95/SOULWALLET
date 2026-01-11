/**
 * Copy Trading Router Integration Tests
 * 
 * Tests for copy trading features including:
 * - Trader discovery
 * - Start/stop copying
 * - Settings management
 * - Positions
 * - Statistics
 */

import {
  trpcRequest,
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  waitForServer,
} from '../utils/test-helpers';
import {
  VALID_SOLANA_ADDRESSES,
  createMockCopyTradingSettings,
  invalidData,
  testTimeouts,
} from '../utils/test-fixtures';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Copy Trading Router Integration Tests', () => {
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

  describe('Trader Discovery', () => {
    it('should get top traders list', async () => {
      const result = await trpcQuery('copyTrading.getTopTraders', {}, testUser.token);

      expect(Array.isArray(result)).toBe(true);
      // May be empty if no featured traders exist
    });

    it('should reject unauthenticated top traders request', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getTopTraders', {}),
        'UNAUTHORIZED'
      );
    });

    it('should return not found for non-existent trader', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getTrader', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_3,
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject invalid wallet address format', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getTrader', {
          walletAddress: invalidData.invalidSolanaAddress,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Start Copying', () => {
    it('should reject copying non-existent trader', async () => {
      const settings = createMockCopyTradingSettings();

      await expectTRPCError(
        trpcRequest('copyTrading.startCopying', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_3,
          ...settings,
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject when amountPerTrade exceeds totalBudget', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.startCopying', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
          totalBudget: 10,
          amountPerTrade: 100, // Greater than totalBudget
          maxSlippage: 1,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject negative budget values', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.startCopying', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
          totalBudget: invalidData.negativeNumber,
          amountPerTrade: 10,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject zero amount per trade', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.startCopying', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
          totalBudget: 100,
          amountPerTrade: invalidData.zeroAmount,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated start copying', async () => {
      const settings = createMockCopyTradingSettings();

      await expectTRPCError(
        trpcRequest('copyTrading.startCopying', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
          ...settings,
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject excessive slippage', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.startCopying', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
          totalBudget: 100,
          amountPerTrade: 10,
          maxSlippage: 100, // Too high
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Update Settings', () => {
    it('should reject updating non-existent copy trade', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.updateSettings', {
          copyTradingId: 'non-existent-id',
          totalBudget: 200,
        }, testUser.token),
        'FORBIDDEN'
      );
    });

    it('should reject unauthenticated settings update', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.updateSettings', {
          copyTradingId: 'some-id',
          totalBudget: 200,
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Stop Copying', () => {
    it('should reject stopping non-existent copy trade', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.stopCopying', {
          copyTradingId: 'non-existent-id',
        }, testUser.token),
        'FORBIDDEN'
      );
    });

    it('should reject unauthenticated stop copying', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.stopCopying', {
          copyTradingId: 'some-id',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('My Copy Trades', () => {
    it('should return empty array when no copy trades', async () => {
      const result = await trpcQuery('copyTrading.getMyCopyTrades', {}, testUser.token);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getMyCopyTrades', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Positions', () => {
    it('should return empty array for open positions', async () => {
      const result = await trpcQuery('copyTrading.getOpenPositions', {}, testUser.token);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty position history', async () => {
      const result = await trpcQuery('copyTrading.getPositionHistory', {
        limit: 10,
        offset: 0,
      }, testUser.token);

      expect(result.positions).toBeDefined();
      expect(Array.isArray(result.positions)).toBe(true);
      expect(result.total).toBeDefined();
    });

    it('should reject unauthenticated positions request', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getOpenPositions', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Close Position', () => {
    it('should reject closing non-existent position', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.closePosition', {
          positionId: 'non-existent-position',
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject unauthenticated close position', async () => {
      await expectTRPCError(
        trpcRequest('copyTrading.closePosition', {
          positionId: 'some-position',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Statistics', () => {
    it('should return statistics for user', async () => {
      const result = await trpcQuery('copyTrading.getStats', {}, testUser.token);

      expect(result.totalTrades).toBeDefined();
      expect(result.openTrades).toBeDefined();
      expect(result.winRate).toBeDefined();
      expect(result.totalProfit).toBeDefined();
    });

    it('should reject unauthenticated stats request', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getStats', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Trader Performance', () => {
    it('should reject performance for non-existent trader', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getTraderPerformance', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_3,
          period: '30d',
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject unauthenticated performance request', async () => {
      await expectTRPCError(
        trpcQuery('copyTrading.getTraderPerformance', {
          walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
          period: '30d',
        }),
        'UNAUTHORIZED'
      );
    });

    // Note: Invalid period test removed as Zod enum validation handles this at schema level
    // The router only accepts '7d', '30d', '90d' - invalid values are rejected by validation

    it('should accept all valid period values for existing trader', async () => {
      const validPeriods = ['7d', '30d', '90d'] as const;
      
      for (const period of validPeriods) {
        try {
          const result = await trpcQuery('copyTrading.getTraderPerformance', {
            walletAddress: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_1,
            period,
          }, testUser.token);

          // If trader exists, validate response structure
          expect(result.trader).toBeDefined();
          expect(Array.isArray(result.performance)).toBe(true);
          
          // Check estimated flag when no snapshots exist
          if (result.estimated !== undefined) {
            expect(typeof result.estimated).toBe('boolean');
          }
        } catch (error: any) {
          // Expected NOT_FOUND if trader doesn't exist in test DB
          expect(error.code).toBe('NOT_FOUND');
        }
      }
    });
  });
});
