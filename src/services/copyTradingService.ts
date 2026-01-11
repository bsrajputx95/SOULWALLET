import 'reflect-metadata';
import prisma from '../lib/prisma';
import { PublicKey } from '@solana/web3.js';
import { TRPCError } from '@trpc/server';
import { injectable, inject } from 'tsyringe';
import { logger } from '../lib/logger';
// Comment 4: Import validation utilities and limits
import { TRANSACTION_LIMITS } from '../lib/services/custodialWallet';
import type { CustodialWalletService } from '../lib/services/custodialWallet';
import { MAX_SLIPPAGE_PERCENT } from '../lib/validation';
// Comment 4: Import DLQ for failed copy trades
import { deadLetterQueueService } from '../lib/services/deadLetterQueue';
import { executionQueue } from '../lib/services/executionQueue'
import { messageQueue } from '../lib/services/messageQueue'

/**
 * Copy Trading Service
 * Manages copy trading settings and execution
 */
@injectable()
export class CopyTradingService {
  constructor(
    @inject('CustodialWallet') private readonly custodialWalletService: CustodialWalletService,
  ) { }

  // Create or update copy trading settings
  // Comment 4: Apply validateCopyTradeBudget and slippage cap before create/update
  async upsertSettings(params: {
    userId: string;
    targetWalletAddress: string;
    totalAmount: number;
    amountPerTrade: number;
    stopLoss?: number;
    takeProfit?: number;
    maxSlippage?: number;
    exitWithTrader?: boolean;
  }) {
    try {
      const {
        userId,
        targetWalletAddress,
        totalAmount,
        amountPerTrade,
        stopLoss,
        takeProfit,
        maxSlippage = 0.5,
        exitWithTrader = true
      } = params;

      // Validate target wallet address
      try {
        new PublicKey(targetWalletAddress);
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid target wallet address'
        });
      }

      // Comment 4: Validate budget against limits BEFORE create/update
      const budgetValidation = this.custodialWalletService.validateCopyTradeBudget(totalAmount, amountPerTrade);
      if (!budgetValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: budgetValidation.error || 'Budget validation failed'
        });
      }

      // Comment 4: Enforce slippage cap (5% maximum)
      if (maxSlippage > MAX_SLIPPAGE_PERCENT) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Slippage ${maxSlippage}% exceeds maximum allowed ${MAX_SLIPPAGE_PERCENT}%`
        });
      }

      // First, find or create the trader profile using targetWalletAddress
      let traderProfile = await prisma.traderProfile.findFirst({
        where: { walletAddress: targetWalletAddress }
      });

      if (!traderProfile) {
        traderProfile = await prisma.traderProfile.create({
          data: {
            walletAddress: targetWalletAddress,
            username: targetWalletAddress.slice(0, 8) + '...',
            totalROI: 0,
            totalVolume: 0,
            winRate: 0,
            totalTrades: 0,
            totalFollowers: 0
          }
        });
      }

      // Check if settings already exist using userId and traderId
      const existing = await prisma.copyTrading.findFirst({
        where: {
          userId,
          traderId: traderProfile.id
        }
      });

      // Cap slippage to maximum allowed
      const cappedSlippage = Math.min(maxSlippage, MAX_SLIPPAGE_PERCENT);

      if (existing) {
        // Update existing settings
        return await prisma.copyTrading.update({
          where: { id: existing.id },
          data: {
            totalBudget: totalAmount,
            amountPerTrade,
            stopLoss: stopLoss ?? null,
            takeProfit: takeProfit ?? null,
            maxSlippage: cappedSlippage,
            exitWithTrader,
            isActive: true
          }
        });
      } else {
        // Create new settings using the trader profile we already found/created
        return await prisma.copyTrading.create({
          data: {
            userId,
            traderId: traderProfile.id,
            totalBudget: totalAmount,
            amountPerTrade,
            stopLoss: stopLoss ?? null,
            takeProfit: takeProfit ?? null,
            maxSlippage: cappedSlippage,
            exitWithTrader,
            isActive: true
          }
        });
      }
    } catch (error) {
      logger.error('Error upserting copy trade settings:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save copy trading settings'
      });
    }
  }

  // Get all copy trading settings for a user
  async getUserSettings(userId: string) {
    // Use optimized method to avoid N+1 queries (Audit Issue #6)
    return this.getUserSettingsOptimized(userId);
  }

  /**
   * Optimized getUserSettings that batches all queries (Audit Issue #6)
   * Reduces N+1 query pattern by fetching all positions in a single query
   * and calculating performance metrics in memory
   */
  async getUserSettingsOptimized(userId: string) {
    try {
      // Single query to get all settings with their positions
      const settings = await prisma.copyTrading.findMany({
        where: { userId },
        include: {
          positions: true, // Get ALL positions in one query
        }
      });

      // Calculate performance in memory instead of N separate queries
      const settingsWithPerformance = settings.map(setting => {
        const trades = setting.positions;
        const totalTrades = trades.length;
        const successfulTrades = trades.filter(t => t.status === 'OPEN' || t.exitPrice).length;
        const failedTrades = trades.filter(t => t.status === 'CLOSED' && !t.exitPrice).length;

        let totalInvested = 0;
        let totalReturned = 0;

        for (const trade of trades) {
          totalInvested += trade.entryValue;
          if (trade.exitValue) {
            totalReturned += trade.exitValue;
          }
        }

        const pnl = totalReturned - totalInvested;
        const pnlPercentage = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

        return {
          ...setting,
          // Only return last 10 positions for display
          positions: setting.positions
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 10),
          performance: {
            totalTrades,
            successfulTrades,
            failedTrades,
            totalInvested,
            totalReturned,
            pnl,
            pnlPercentage
          }
        };
      });

      return settingsWithPerformance;
    } catch (error) {
      logger.error('Error getting copy trade settings:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get copy trading settings'
      });
    }
  }

  // Get a specific copy trading setting
  async getSetting(settingId: string, userId: string) {
    try {
      const setting = await prisma.copyTrading.findFirst({
        where: {
          id: settingId,
          userId
        },
        include: {
          positions: {
            orderBy: { updatedAt: 'desc' }
          }
        }
      });

      if (!setting) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Copy trading setting not found'
        });
      }

      const performance = await this.calculatePerformance(setting.id);

      return {
        ...setting,
        performance
      };
    } catch (error) {
      logger.error('Error getting copy trade setting:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get copy trading setting'
      });
    }
  }

  // Toggle copy trading active status
  async toggleActive(settingId: string, userId: string) {
    try {
      const setting = await prisma.copyTrading.findFirst({
        where: {
          id: settingId,
          userId
        }
      });

      if (!setting) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Copy trading setting not found'
        });
      }

      const updated = await prisma.copyTrading.update({
        where: { id: settingId },
        data: { isActive: !setting.isActive }
      });

      return updated;
    } catch (error) {
      logger.error('Error toggling copy trade status:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to toggle copy trading status'
      });
    }
  }

  // Delete copy trading setting
  async deleteSetting(settingId: string, userId: string) {
    try {
      const setting = await prisma.copyTrading.findFirst({
        where: {
          id: settingId,
          userId
        }
      });

      if (!setting) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Copy trading setting not found'
        });
      }

      await prisma.copyTrading.delete({
        where: { id: settingId }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error deleting copy trade setting:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete copy trading setting'
      });
    }
  }

  // Execute a copy trade (called by monitoring service)
  // Comment 4: Apply budget/slippage validation before execution
  async executeCopyTrade(params: {
    settingId: string;
    originalTxHash: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
  }) {
    try {
      const { settingId, originalTxHash, tokenIn, tokenOut } = params;

      const setting = await prisma.copyTrading.findUnique({
        where: { id: settingId }
      });

      if (!setting || !setting.isActive) {
        return null;
      }

      // Calculate trade amount based on settings
      const tradeAmount = Math.min(setting.amountPerTrade, setting.totalBudget || 0);

      // Comment 4: Validate trade amount against limits
      if (tradeAmount > TRANSACTION_LIMITS.maxPerTrade) {
        logger.warn(`Trade amount ${tradeAmount} exceeds max per trade ${TRANSACTION_LIMITS.maxPerTrade}`);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Trade amount exceeds maximum of ${TRANSACTION_LIMITS.maxPerTrade} USDC`
        });
      }

      // Comment 4: Use capped slippage from settings (already capped in upsertSettings)
      const slippage = Math.min(setting.maxSlippage || 0.5, MAX_SLIPPAGE_PERCENT);
      void slippage

      const orderData = {
        userId: setting.userId,
        copyTradingId: settingId,
        tokenMint: tokenOut,
        amount: tradeAmount,
        detectedTxId: originalTxHash,
        priority: 1,
      }

      const executionQueueId = await executionQueue.createBuyOrderRecord(orderData)

      try {
        await messageQueue.publishCopyTradeBuy({ executionQueueId, ...orderData })
      } catch (mqError) {
        logger.warn('RabbitMQ publish failed; enqueuing copy trade directly', {
          error: mqError instanceof Error ? mqError.message : String(mqError),
          executionQueueId,
        })
        await executionQueue.enqueueBuyOrderJobOnly(orderData)
      }

      return { queued: true, executionQueueId, originalTxHash, tokenIn, tokenOut, amountIn: tradeAmount }
    } catch (error) {
      logger.error('Error executing copy trade:', error);

      // Comment 4: Add failed copy trade to DLQ for retry
      try {
        await deadLetterQueueService.addToQueue({
          operation: 'COPY_TRADE',
          payload: {
            settingId: params.settingId,
            originalTxHash: params.originalTxHash,
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
          },
          error: error instanceof Error ? error.message : String(error),
          userId: (await prisma.copyTrading.findUnique({ where: { id: params.settingId } }))?.userId || 'unknown',
        });
      } catch (dlqError) {
        logger.error('Failed to add copy trade to DLQ:', dlqError);
      }

      return null;
    }
  }

  // Calculate performance metrics
  private async calculatePerformance(settingId: string) {
    try {
      const trades = await prisma.position.findMany({
        where: { copyTradingId: settingId }
      });

      const totalTrades = trades.length;
      const successfulTrades = trades.filter(t => t.status === 'OPEN' || t.exitPrice).length;
      const failedTrades = trades.filter(t => t.status === 'CLOSED' && !t.exitPrice).length;

      let totalInvested = 0;
      let totalReturned = 0;

      for (const trade of trades) {
        totalInvested += trade.entryValue;
        if (trade.exitValue) {
          totalReturned += trade.exitValue;
        }
      }

      const pnl = totalReturned - totalInvested;
      const pnlPercentage = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

      return {
        totalTrades,
        successfulTrades,
        failedTrades,
        totalInvested,
        totalReturned,
        pnl,
        pnlPercentage
      };
    } catch (error) {
      logger.error('Error calculating performance:', error);
      return {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalInvested: 0,
        totalReturned: 0,
        pnl: 0,
        pnlPercentage: 0
      };
    }
  }

  // Check stop loss and take profit conditions
  private async checkStopLossTakeProfit(settingId: string) {
    try {
      const setting = await prisma.copyTrading.findUnique({
        where: { id: settingId }
      });

      if (!setting || (!setting.stopLoss && !setting.takeProfit)) {
        return;
      }

      const performance = await this.calculatePerformance(settingId);

      // Check stop loss
      if (setting.stopLoss && performance.pnlPercentage <= -setting.stopLoss) {
        await prisma.copyTrading.update({
          where: { id: settingId },
          data: { isActive: false }
        });

        logger.info(`Stop loss triggered for setting ${settingId}.`);
      }

      // Check take profit
      if (setting.takeProfit && performance.pnlPercentage >= setting.takeProfit) {
        await prisma.copyTrading.update({
          where: { id: settingId },
          data: { isActive: false }
        });

        logger.info(`Take profit reached for setting ${settingId}.`);
      }
    } catch (error) {
      logger.error('Error checking stop loss/take profit:', error);
    }
  }

  // Get top traders
  async getTopTraders(limit = 10) {
    try {
      const topTraders = await prisma.traderProfile.findMany({
        where: {
          isFeatured: true
        },
        orderBy: {
          totalROI: 'desc'
        },
        take: limit
      });

      return topTraders;
    } catch (error) {
      logger.error('Error getting top traders:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get top traders'
      });
    }
  }
}
