import { z } from 'zod';
import { router, protectedProcedure } from '../trpc'
import { applyRateLimit } from '../../lib/middleware/rateLimit';
import { TRPCError } from '@trpc/server';
import prisma from '../../lib/prisma'
import { LockService } from '../../lib/services/lockService'

interface JupiterPriceResponse {
  data: Record<string, { price: number }>;
}

interface CopyTradingUpdateInput {
  totalBudget?: number;
  amountPerTrade?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  maxSlippage?: number;
  exitWithTrader?: boolean;
}

// Helper function to fetch current prices from Jupiter
async function fetchCurrentPrices(tokenMints: string[]): Promise<Record<string, number>> {
  if (tokenMints.length === 0) return {};
  
  try {
    const response = await fetch(
      `https://price.jup.ag/v4/price?ids=${tokenMints.join(',')}`
    );
    const data = await response.json() as JupiterPriceResponse;
    
    const prices: Record<string, number> = {};
    for (const mint of tokenMints) {
      prices[mint] = data?.data?.[mint]?.price || 0;
    }
    return prices;
  } catch (error) {
    console.error('Error fetching prices:', error);
    return {};
  }
}

export const copyTradingRouter = router({
  
  // ================================================
  // GET TOP TRADERS (Featured List)
  // ================================================
  getTopTraders: protectedProcedure
    .query(async ({ ctx }) => {
      const traders = await prisma.traderProfile.findMany({
        where: { isFeatured: true },
        orderBy: { featuredOrder: 'asc' },
        take: 10,
        include: {
          _count: {
            select: { copiers: { where: { isActive: true } } },
          },
        },
      });
      
      return traders.map(trader => ({
        ...trader,
        activeFollowers: trader._count.copiers,
      }));
    }),

  // ================================================
  // GET TRADER DETAILS
  // ================================================
  getTrader: protectedProcedure
    .input(z.object({
      walletAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    }))
    .query(async ({ ctx, input }) => {
      const trader = await prisma.traderProfile.findUnique({
        where: { walletAddress: input.walletAddress },
        include: {
          _count: {
            select: { 
              copiers: { where: { isActive: true } },
            },
          },
        },
      });
      
      if (!trader) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trader not found',
        });
      }
      
      return {
        ...trader,
        activeFollowers: trader._count.copiers,
      };
    }),

  // ================================================
  // START COPYING A TRADER
  // ================================================
  startCopying: protectedProcedure
    .input(z.object({
      walletAddress: z.string(),
      totalBudget: z.number().positive().max(1000000),
      amountPerTrade: z.number().positive().max(10000),
      stopLoss: z.number().min(-100).max(0).optional(),
      takeProfit: z.number().positive().max(1000).optional(),
      maxSlippage: z.number().positive().max(50).optional(),
      exitWithTrader: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:${userId}:${input.walletAddress}`
      
      // Validate amount per trade <= total budget
      if (input.amountPerTrade > input.totalBudget) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Amount per trade cannot exceed total budget',
        });
      }
      
      return await LockService.withLock(lockKey, async () => {
      // Find trader
      const trader = await prisma.traderProfile.findUnique({
        where: { walletAddress: input.walletAddress },
      });
      
      if (!trader) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trader not found',
        });
      }
      
      // Check if already copying
      const existing = await prisma.copyTrading.findUnique({
        where: {
          userId_traderId: {
            userId,
            traderId: trader.id,
          },
        },
      });
      
      if (existing && existing.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Already copying this trader',
        });
      }
      
      // Create or reactivate copy relationship
      const copyTrading = await prisma.copyTrading.upsert({
        where: {
          userId_traderId: {
            userId,
            traderId: trader.id,
          },
        },
        update: {
          isActive: true,
          totalBudget: input.totalBudget,
          amountPerTrade: input.amountPerTrade,
          stopLoss: input.stopLoss || null,
          takeProfit: input.takeProfit || null,
          maxSlippage: input.maxSlippage || 0.5,
          exitWithTrader: input.exitWithTrader,
        },
        create: {
          userId,
          traderId: trader.id,
          totalBudget: input.totalBudget,
          amountPerTrade: input.amountPerTrade,
          stopLoss: input.stopLoss || null,
          takeProfit: input.takeProfit || null,
          maxSlippage: input.maxSlippage || 0.5,
          exitWithTrader: input.exitWithTrader,
        },
        include: {
          trader: true,
        },
      });
      
      // Ensure wallet is monitored
      await prisma.monitoredWallet.upsert({
        where: { walletAddress: input.walletAddress },
        update: { 
          isActive: true,
          totalCopiers: { increment: 1 },
        },
        create: {
          walletAddress: input.walletAddress,
          traderId: trader.id,
          isActive: true,
          totalCopiers: 1,
        },
      });
      
      // Update trader's follower count
      await prisma.traderProfile.update({
        where: { id: trader.id },
        data: { totalFollowers: { increment: 1 } },
      });
      
      return copyTrading
      })
    }),

  // ================================================
  // UPDATE COPY SETTINGS
  // ================================================
  updateSettings: protectedProcedure
    .input(z.object({
      copyTradingId: z.string(),
      totalBudget: z.number().positive().optional(),
      amountPerTrade: z.number().positive().optional(),
      stopLoss: z.number().min(-100).max(0).optional(),
      takeProfit: z.number().positive().max(1000).optional(),
      maxSlippage: z.number().positive().max(50).optional(),
      exitWithTrader: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:update:${userId}`
      const { copyTradingId, ...rawUpdates } = input
      
      // Filter out undefined values and handle null conversion
      const updates: CopyTradingUpdateInput = {}
      if (rawUpdates.totalBudget !== undefined) updates.totalBudget = rawUpdates.totalBudget
      if (rawUpdates.amountPerTrade !== undefined) updates.amountPerTrade = rawUpdates.amountPerTrade
      if (rawUpdates.stopLoss !== undefined) updates.stopLoss = rawUpdates.stopLoss
      if (rawUpdates.takeProfit !== undefined) updates.takeProfit = rawUpdates.takeProfit
      if (rawUpdates.exitWithTrader !== undefined) updates.exitWithTrader = rawUpdates.exitWithTrader
      
      // Verify ownership
      const copyTrading = await prisma.copyTrading.findUnique({
        where: { id: copyTradingId },
      })
      
      if (!copyTrading || copyTrading.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update this copy trade',
        });
      }
      
      // Update settings
      return await LockService.withLock(lockKey, async () => {
        const updated = await prisma.copyTrading.update({
          where: { id: copyTradingId },
          data: updates,
          include: { trader: true },
        })
        return updated
      })
    }),

  // ================================================
  // STOP COPYING (Pause, Keep Positions)
  // ================================================
  stopCopying: protectedProcedure
    .input(z.object({
      copyTradingId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:stop:${userId}`
      
      // Verify ownership
      const copyTrading = await prisma.copyTrading.findUnique({
        where: { id: input.copyTradingId },
        include: { trader: true },
      });
      
      if (!copyTrading || copyTrading.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot stop this copy trade',
        });
      }
      
      // Deactivate
      const updated = await LockService.withLock(lockKey, async () => {
        const res = await prisma.copyTrading.update({
          where: { id: input.copyTradingId },
          data: { isActive: false },
          include: { trader: true },
        })
        return res
      })
      
      // Update trader follower count
      await prisma.traderProfile.update({
        where: { id: copyTrading.traderId },
        data: { totalFollowers: { decrement: 1 } },
      });
      
      // Update monitored wallet copier count
      await prisma.monitoredWallet.update({
        where: { walletAddress: copyTrading.trader.walletAddress },
        data: { totalCopiers: { decrement: 1 } },
      });
      
      return updated
    }),

  // ================================================
  // GET MY COPY TRADES
  // ================================================
  getMyCopyTrades: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      
      const copyTrades = await prisma.copyTrading.findMany({
        where: { userId },
        include: {
          trader: true,
          positions: {
            where: { status: 'OPEN' },
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { 
              positions: { where: { status: 'OPEN' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      return copyTrades.map(ct => ({
        ...ct,
        openPositionsCount: ct._count.positions,
      }));
    }),

  // ================================================
  // GET OPEN POSITIONS
  // ================================================
  getOpenPositions: protectedProcedure
    .input(z.object({
      copyTradingId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      const positions = await prisma.position.findMany({
        where: {
          status: 'OPEN',
          copyTrading: {
            userId,
            ...(input.copyTradingId ? { id: input.copyTradingId } : {}),
          },
        },
        include: {
          copyTrading: {
            include: { trader: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      // Fetch current prices for P&L calculation
      const tokenMints = [...new Set(positions.map(p => p.tokenMint))];
      const prices = await fetchCurrentPrices(tokenMints);
      
      return positions.map(position => {
        const currentPrice = prices[position.tokenMint] || position.entryPrice;
        const currentValue = position.entryAmount * currentPrice;
        const unrealizedPL = currentValue - position.entryValue;
        const unrealizedPLPercent = (unrealizedPL / position.entryValue) * 100;
        
        return {
          ...position,
          currentPrice,
          currentValue,
          unrealizedPL,
          unrealizedPLPercent,
        };
      });
    }),

  // ================================================
  // GET POSITION HISTORY
  // ================================================
  getPositionHistory: protectedProcedure
    .input(z.object({
      copyTradingId: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      const positions = await prisma.position.findMany({
        where: {
          status: 'CLOSED',
          copyTrading: {
            userId,
            ...(input.copyTradingId ? { id: input.copyTradingId } : {}),
          },
        },
        include: {
          copyTrading: {
            include: { trader: true },
          },
        },
        orderBy: { exitTimestamp: 'desc' },
        take: input.limit,
        skip: input.offset,
      });
      
      const total = await prisma.position.count({
        where: {
          status: 'CLOSED',
          copyTrading: {
            userId,
            ...(input.copyTradingId ? { id: input.copyTradingId } : {}),
          },
        },
      });
      
      return {
        positions,
        total,
        hasMore: (input.offset + input.limit) < total,
      };
    }),

  // ================================================
  // CLOSE POSITION MANUALLY
  // ================================================
  closePosition: protectedProcedure
    .input(z.object({
      positionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:close:${userId}`
      
      // Get position
      const position = await prisma.position.findUnique({
        where: { id: input.positionId },
        include: {
          copyTrading: true,
        },
      });
      
      if (!position) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Position not found',
        });
      }
      
      if (position.copyTrading.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot close this position',
        });
      }
      
      if (position.status !== 'OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Position is not open',
        });
      }
      
      // Add to execution queue (high priority)
      const queueItem = await LockService.withLock(lockKey, async () => {
        const res = await prisma.executionQueue.create({
          data: {
            type: 'SELL',
            userId,
            copyTradingId: position.copyTradingId,
            positionId: position.id,
            tokenMint: position.tokenMint,
            amount: position.entryAmount,
            maxSlippage: 2,
            priority: 10,
            status: 'PENDING',
          },
        })
        return res
      })
      
      return { success: true, queueId: queueItem.id, message: 'Position queued for closing' }
    }),

  // ================================================
  // GET STATISTICS
  // ================================================
  getStats: protectedProcedure
    .input(z.object({
      copyTradingId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      const whereClause: any = {
        copyTrading: {
          userId,
          ...(input.copyTradingId ? { id: input.copyTradingId } : {}),
        },
      };
      
      const [
        totalTrades,
        openTrades,
        profitableTrades,
        totalProfit,
        totalFees,
      ] = await Promise.all([
        prisma.position.count({
          where: { ...whereClause, status: 'CLOSED' },
        }),
        prisma.position.count({
          where: { ...whereClause, status: 'OPEN' },
        }),
        prisma.position.count({
          where: {
            ...whereClause,
            status: 'CLOSED',
            profitLoss: { gt: 0 },
          },
        }),
        prisma.position.aggregate({
          where: { ...whereClause, status: 'CLOSED' },
          _sum: { profitLoss: true },
        }),
        prisma.position.aggregate({
          where: { ...whereClause, status: 'CLOSED' },
          _sum: { feeAmount: true },
        }),
      ]);
      
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
      
      return {
        totalTrades,
        openTrades,
        profitableTrades,
        losingTrades: totalTrades - profitableTrades,
        winRate,
        totalProfit: totalProfit._sum.profitLoss || 0,
        totalFees: totalFees._sum.feeAmount || 0,
        netProfit: (totalProfit._sum.profitLoss || 0) - (totalFees._sum.feeAmount || 0),
      };
    }),

  // ================================================
  // GET TRADER PERFORMANCE CHART
  // ================================================
  getTraderPerformance: protectedProcedure
    .input(z.object({
      walletAddress: z.string(),
      period: z.enum(['7d', '30d', '90d']).default('30d'),
    }))
    .query(async ({ ctx, input }) => {
      const trader = await prisma.traderProfile.findUnique({
        where: { walletAddress: input.walletAddress },
      });
      
      if (!trader) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trader not found',
        });
      }
      
      // Return mock performance data for now
      // In production, this would fetch historical performance from a time-series database
      const days = input.period === '7d' ? 7 : input.period === '30d' ? 30 : 90;
      const data = [];
      const now = new Date();
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toISOString(),
          value: trader.totalROI * (1 - i / days) + Math.random() * 10 - 5,
        });
      }
      
      return {
        trader,
        performance: data,
      };
    }),
});
