import prisma from '../lib/prisma';
import { PublicKey } from '@solana/web3.js';
import { TRPCError } from '@trpc/server';
import { WalletService } from './walletService';
import { logger } from '../lib/logger';

export class CopyTradingService {
  // Connection instance can be added when needed for blockchain operations

  // Create or update copy trading settings
  static async upsertSettings(params: {
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
        // maxSlippage = 0.5, // Not used in current implementation
        // exitWithTrader = true // Not used in current implementation
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

      // Check if settings already exist
      const existing = await prisma.copyTrading.findFirst({
        where: {
          userId,
          // TODO: Update to match actual schema fields
          // targetWalletAddress is not in the schema, may need trader relation
        }
      });

      if (existing) {
        // Update existing settings
        return await prisma.copyTrading.update({
          where: { id: existing.id },
          data: {
            totalBudget: totalAmount,
            amountPerTrade,
            stopLoss: stopLoss ?? null,
            takeProfit: takeProfit ?? null,
            // exitWithTrader is already in schema
            isActive: true
          }
        });
      } else {
        // Create new settings
        // Create placeholder trader profile if needed
        let traderId = '';
        const traderProfile = await prisma.traderProfile.findFirst({
          where: { walletAddress: targetWalletAddress }
        });
        
        if (traderProfile) {
          traderId = traderProfile.id;
        } else {
          const newTrader = await prisma.traderProfile.create({
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
          traderId = newTrader.id;
        }
        
        return await prisma.copyTrading.create({
          data: {
            userId,
            traderId,
            totalBudget: totalAmount,
            amountPerTrade,
            stopLoss: stopLoss ?? null,
            takeProfit: takeProfit ?? null,
            // exitWithTrader defaults to false in schema
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
  static async getUserSettings(userId: string) {
    try {
      const settings = await prisma.copyTrading.findMany({
        where: { userId },
        include: {
          positions: {
            orderBy: { updatedAt: 'desc' },
            take: 10
          }
        }
      });

      // Calculate performance for each setting
      const settingsWithPerformance = await Promise.all(
        settings.map(async (setting) => {
          const performance = await this.calculatePerformance(setting.id);
          return {
            ...setting,
            performance
          };
        })
      );

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
  static async getSetting(settingId: string, userId: string) {
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
  static async toggleActive(settingId: string, userId: string) {
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
  static async deleteSetting(settingId: string, userId: string) {
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
  static async executeCopyTrade(params: {
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

      // Check if we've already copied this trade
      // Check positions instead of copyTrade
      const existingTrade = await prisma.position.findFirst({
        where: {
          copyTradingId: settingId,
          entryTxHash: originalTxHash
        }
      });

      if (existingTrade) {
        return existingTrade;
      }

      // Calculate trade amount based on settings
      const tradeAmount = Math.min(setting.amountPerTrade, setting.totalBudget || 0);

      // Execute the swap using WalletService
      const swapResult = await WalletService.swapTokens({
        userId: setting.userId,
        fromMint: tokenIn,
        toMint: tokenOut,
        amount: tradeAmount,
        slippage: 0.5 // Default slippage
      });

      // Record the copy trade
      // Create position instead of copyTrade
      const copyTrade = await prisma.position.create({
        data: {
          copyTradingId: settingId,
          tokenMint: tokenOut,
          tokenSymbol: 'TOKEN', // TODO: Get actual symbol
          tokenName: 'Token', // TODO: Get actual name
          entryAmount: tradeAmount,
          entryPrice: tradeAmount,
          entryValue: tradeAmount,
          status: 'OPEN',
          entryTxHash: swapResult.signature,
          entryTimestamp: new Date()
        }
      });

      // Update remaining amount
      await prisma.copyTrading.update({
        where: { id: settingId },
        data: {
          totalBudget: setting.totalBudget - tradeAmount
        }
      });

      // Check stop loss and take profit
      await this.checkStopLossTakeProfit(settingId);

      return copyTrade;
    } catch (error) {
      logger.error('Error executing copy trade:', error);
      
      // Get the setting to retrieve the correct userId
      const setting = await prisma.copyTrading.findUnique({
        where: { id: params.settingId }
      });
      
      if (setting) {
        // Record failed trade with correct userId
        await prisma.position.create({
          data: {
            copyTradingId: params.settingId,
            tokenMint: params.tokenOut,
            tokenSymbol: 'TOKEN', // TODO: Get actual symbol
            tokenName: 'Token', // TODO: Get actual name
            entryAmount: params.amountIn,
            entryPrice: params.amountIn,
            entryValue: params.amountIn,
            status: 'CLOSED',
            exitReason: 'ERROR',
            entryTxHash: params.originalTxHash,
            entryTimestamp: new Date()
          }
        });
      }

      return null;
    }
  }

  // Calculate performance metrics
  private static async calculatePerformance(settingId: string) {
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
  private static async checkStopLossTakeProfit(settingId: string) {
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
  static async getTopTraders(limit = 10) {
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
