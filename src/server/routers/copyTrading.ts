import { z } from 'zod';
import { router, protectedProcedure, financialProcedure, createOwnershipProcedure } from '../trpc'
import { applyRateLimit } from '../../lib/middleware/rateLimit';
import { TRPCError } from '@trpc/server';
import prisma from '../../lib/prisma'
import { LockService } from '../../lib/services/lockService'
import { logger } from '../../lib/logger';
import { TRANSACTION_LIMITS } from '../../lib/services/custodialWallet';
import type { CustodialWalletService } from '../../lib/services/custodialWallet';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { verifyTotpForUser } from '../../lib/middleware/auth'
import type { RpcManager } from '../../lib/services/rpcManager';
import { MAX_SLIPPAGE_PERCENT, validateSlippage } from '../../lib/validation'
import { auditLogService } from '../../lib/services/auditLog'
import type { JupiterSwap } from '../../lib/services/jupiterSwap'
import { redisCache } from '../../lib/redis'
import { container } from '../../lib/di/container';

// Lazy resolve services from DI container (resolved when first called, after setupContainer)
let _custodialWalletService: CustodialWalletService | null = null;
let _rpcManager: RpcManager | null = null;
let _jupiterSwap: JupiterSwap | null = null;

function getCustodialWalletService(): CustodialWalletService {
  if (!_custodialWalletService) {
    _custodialWalletService = container.resolve<CustodialWalletService>('CustodialWallet');
  }
  return _custodialWalletService;
}

function getRpcManager(): RpcManager {
  if (!_rpcManager) {
    _rpcManager = container.resolve<RpcManager>('RpcManager');
  }
  return _rpcManager;
}

function getJupiterSwap(): JupiterSwap {
  if (!_jupiterSwap) {
    _jupiterSwap = container.resolve<JupiterSwap>('JupiterSwap');
  }
  return _jupiterSwap;
}

// USDC mint address on Solana mainnet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;

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
    return await getJupiterSwap().getPrices(tokenMints)
  } catch (error) {
    logger.error('Error fetching prices from Jupiter', error);
    return {};
  }
}

export const copyTradingRouter = router({

  // ================================================
  // SETUP CUSTODIAL WALLET
  // ================================================
  setupCustodialWallet: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;

      try {
        // Create or get existing custodial wallet
        const publicKey = await getCustodialWalletService().getOrCreateWallet(userId);

        logger.info(`Custodial wallet setup for user ${userId}: ${publicKey}`);

        return {
          success: true,
          publicKey,
          message: 'Custodial wallet ready. Deposit USDC to start copy trading.',
        };
      } catch (error) {
        logger.error(`Failed to setup custodial wallet for user ${userId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to setup custodial wallet',
        });
      }
    }),

  // ================================================
  // GET CUSTODIAL WALLET BALANCE
  // ================================================
  getCustodialBalance: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      try {
        // Check if user has a custodial wallet
        const publicKey = await getCustodialWalletService().getPublicKey(userId);

        if (!publicKey) {
          return {
            hasWallet: false,
            publicKey: null,
            solBalance: 0,
            usdcBalance: 0,
          };
        }

        // Get SOL balance
        const solBalance = await getCustodialWalletService().getBalance(userId);

        // Get USDC balance
        let usdcBalance = 0;
        try {
          const connection = await getRpcManager().getConnection();

          const walletPubkey = new PublicKey(publicKey);
          const usdcMint = new PublicKey(USDC_MINT);
          const ata = await getAssociatedTokenAddress(usdcMint, walletPubkey);
          const account = await getAccount(connection, ata);
          usdcBalance = Number(account.amount) / Math.pow(10, USDC_DECIMALS);
        } catch {
          // Token account may not exist yet
          usdcBalance = 0;
        }

        return {
          hasWallet: true,
          publicKey,
          solBalance,
          usdcBalance,
          limits: TRANSACTION_LIMITS,
        };
      } catch (error) {
        logger.error(`Failed to get custodial balance for user ${userId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get wallet balance',
        });
      }
    }),

  // ================================================
  // GET TOP TRADERS (Featured List with Fallback)
  // ================================================
  getTopTraders: protectedProcedure
    .query(async () => {
      const cacheKey = 'traders:top:default' as const
      const cached = await redisCache.get<any>(cacheKey)
      if (cached) return cached

      // First try to get featured traders
      let traders = await prisma.traderProfile.findMany({
        where: { isFeatured: true },
        orderBy: { featuredOrder: 'asc' },
        take: 10,
        select: {
          id: true,
          walletAddress: true,
          username: true,
          avatarUrl: true,
          bio: true,
          totalFollowers: true,
          totalTrades: true,
          winRate: true,
          totalROI: true,
          avgTradeSize: true,
          totalVolume: true,
          roi7d: true,
          roi30d: true,
          roi90d: true,
          isFeatured: true,
          featuredOrder: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      // Fallback: If no featured traders, get top performers by ROI
      if (traders.length === 0) {
        traders = await prisma.traderProfile.findMany({
          where: {
            totalROI: { gt: 0 }, // Only profitable traders
          },
          orderBy: { totalROI: 'desc' },
          take: 10,
          select: {
            id: true,
            walletAddress: true,
            username: true,
            avatarUrl: true,
            bio: true,
            totalFollowers: true,
            totalTrades: true,
            winRate: true,
            totalROI: true,
            avgTradeSize: true,
            totalVolume: true,
            roi7d: true,
            roi30d: true,
            roi90d: true,
            isFeatured: true,
            featuredOrder: true,
            createdAt: true,
            updatedAt: true,
          }
        });
      }

      const result = traders.map((trader: typeof traders[0]) => ({
        ...trader,
        activeFollowers: trader.totalFollowers,
      }))

      await redisCache.set(cacheKey, result, 60)
      return result
    }),

  // ================================================
  // GET TRADER DETAILS
  // ================================================
  getTrader: protectedProcedure
    .input(z.object({
      walletAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    }))
    .query(async ({ input }) => {
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
  startCopying: financialProcedure
    .input(z.object({
      walletAddress: z.string(),
      totalBudget: z.number().positive().max(1000000),
      amountPerTrade: z.number().positive().max(10000),
      stopLoss: z.number().min(-100).max(0).optional(),
      takeProfit: z.number().positive().max(1000).optional(),
      maxSlippage: z.number().positive().max(5).optional(),
      exitWithTrader: z.boolean().default(false),
      minProfitForSharing: z.number().nonnegative().max(1000).optional(), // Minimum profit (USDC) for 5% fee
      totpCode: z.string().length(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:${userId}:${input.walletAddress}`

      // 2FA removed - allow copy trading without verification

      // Validate amount per trade <= total budget
      if (input.amountPerTrade > input.totalBudget) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Amount per trade cannot exceed total budget',
        });
      }

      // Validate budget limits
      const budgetValidation = getCustodialWalletService().validateCopyTradeBudget(
        input.totalBudget,
        input.amountPerTrade
      );
      if (!budgetValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: budgetValidation.error || 'Budget validation failed',
        });
      }

      if (input.maxSlippage !== undefined) {
        const slippageValidation = validateSlippage(input.maxSlippage)
        if (!slippageValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: slippageValidation.error || 'Invalid slippage',
          });
        }
      }

      // Check if user has custodial wallet with sufficient balance
      const hasWallet = await getCustodialWalletService().hasWallet(userId);
      if (!hasWallet) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Please set up a custodial wallet first by calling setupCustodialWallet',
        });
      }

      return await LockService.withLock(lockKey, async () => {
        // Find trader or auto-create if valid Solana address
        let trader = await prisma.traderProfile.findUnique({
          where: { walletAddress: input.walletAddress },
        });

        // Auto-create trader profile if not found (Property 15: Trader Profile Auto-Creation)
        if (!trader) {
          // Validate the wallet address format
          const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
          if (!base58Regex.test(input.walletAddress)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid Solana wallet address',
            });
          }

          // Create a new trader profile for this wallet
          trader = await prisma.traderProfile.create({
            data: {
              walletAddress: input.walletAddress,
              username: `Trader ${input.walletAddress.slice(0, 6)}...${input.walletAddress.slice(-4)}`,
              bio: 'Auto-created trader profile',
              totalROI: 0,
              winRate: 0,
              totalTrades: 0,
              totalFollowers: 0,
              isFeatured: false,
            },
          });

          logger.info('Auto-created trader profile', { walletAddress: input.walletAddress, traderId: trader.id });
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
            maxSlippage: Math.min(input.maxSlippage ?? 0.5, MAX_SLIPPAGE_PERCENT),
            exitWithTrader: input.exitWithTrader,
            minProfitForSharing: input.minProfitForSharing ?? 0,
          },
          create: {
            userId,
            traderId: trader.id,
            totalBudget: input.totalBudget,
            amountPerTrade: input.amountPerTrade,
            stopLoss: input.stopLoss || null,
            takeProfit: input.takeProfit || null,
            maxSlippage: Math.min(input.maxSlippage ?? 0.5, MAX_SLIPPAGE_PERCENT),
            exitWithTrader: input.exitWithTrader,
            minProfitForSharing: input.minProfitForSharing ?? 0,
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

        await auditLogService.logFinancialOperation({
          userId,
          operation: 'COPY_TRADING_START',
          resourceType: 'CopyTrading',
          resourceId: copyTrading.id,
          amount: input.totalBudget,
          currency: 'USDC',
          metadata: {
            traderWalletAddress: input.walletAddress,
            traderId: trader.id,
            totalBudget: input.totalBudget,
            amountPerTrade: input.amountPerTrade,
            stopLoss: input.stopLoss ?? null,
            takeProfit: input.takeProfit ?? null,
            maxSlippage: Math.min(input.maxSlippage ?? 0.5, MAX_SLIPPAGE_PERCENT),
            exitWithTrader: input.exitWithTrader,
          },
          ipAddress: ctx.rateLimitContext.ip,
          userAgent: ctx.fingerprint?.userAgent,
        })

        return copyTrading
      })
    }),

  // ================================================
  // UPDATE COPY SETTINGS
  // ================================================
  updateSettings: createOwnershipProcedure('CopyTrading', 'copyTradingId')
    .input(z.object({
      copyTradingId: z.string(),
      totalBudget: z.number().positive().optional(),
      amountPerTrade: z.number().positive().optional(),
      stopLoss: z.number().min(-100).max(0).optional(),
      takeProfit: z.number().positive().max(1000).optional(),
      maxSlippage: z.number().positive().max(5).optional(),
      exitWithTrader: z.boolean().optional(),
      totpCode: z.string().length(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:update:${userId}`
      const { copyTradingId, ...rawUpdates } = input

      // 2FA removed - allow updates without verification

      // Filter out undefined values and handle null conversion
      const updates: CopyTradingUpdateInput = {}
      if (rawUpdates.totalBudget !== undefined) updates.totalBudget = rawUpdates.totalBudget
      if (rawUpdates.amountPerTrade !== undefined) updates.amountPerTrade = rawUpdates.amountPerTrade
      if (rawUpdates.stopLoss !== undefined) updates.stopLoss = rawUpdates.stopLoss
      if (rawUpdates.takeProfit !== undefined) updates.takeProfit = rawUpdates.takeProfit
      if (rawUpdates.exitWithTrader !== undefined) updates.exitWithTrader = rawUpdates.exitWithTrader
      if (rawUpdates.maxSlippage !== undefined) {
        const slippageValidation = validateSlippage(rawUpdates.maxSlippage)
        if (!slippageValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: slippageValidation.error || 'Invalid slippage',
          })
        }
      }

      // Update settings
      return await LockService.withLock(lockKey, async () => {
        const existing = await prisma.copyTrading.findUnique({
          where: { id: copyTradingId },
          select: { totalBudget: true, amountPerTrade: true },
        })
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Copy trade not found' })
        }

        const nextTotalBudget = rawUpdates.totalBudget ?? existing.totalBudget
        const nextAmountPerTrade = rawUpdates.amountPerTrade ?? existing.amountPerTrade
        if (nextAmountPerTrade > nextTotalBudget) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Amount per trade cannot exceed total budget',
          })
        }

        const budgetValidation = getCustodialWalletService().validateCopyTradeBudget(
          nextTotalBudget,
          nextAmountPerTrade
        )
        if (!budgetValidation.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: budgetValidation.error || 'Budget validation failed',
          })
        }

        if (rawUpdates.maxSlippage !== undefined) {
          updates.maxSlippage = Math.min(rawUpdates.maxSlippage, MAX_SLIPPAGE_PERCENT)
        }

        const updated = await prisma.copyTrading.update({
          where: { id: copyTradingId },
          data: updates,
          include: { trader: true },
        })

        await auditLogService.logFinancialOperation({
          userId,
          operation: 'COPY_TRADING_UPDATE_SETTINGS',
          resourceType: 'CopyTrading',
          resourceId: updated.id,
          amount: updated.totalBudget,
          currency: 'USDC',
          metadata: {
            updatedFields: Object.keys(updates),
            updates,
          },
          ipAddress: ctx.rateLimitContext.ip,
          userAgent: ctx.fingerprint?.userAgent,
        })

        return updated
      })
    }),

  // ================================================
  // STOP COPYING (Pause, Keep Positions)
  // ================================================
  stopCopying: createOwnershipProcedure('CopyTrading', 'copyTradingId')
    .input(z.object({
      copyTradingId: z.string(),
      totpCode: z.string().length(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:stop:${userId}`

      if (!input.totpCode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA code is required' })
      }
      await verifyTotpForUser(userId, input.totpCode)

      // Verify ownership
      const copyTrading = await prisma.copyTrading.findUnique({
        where: { id: input.copyTradingId },
        include: { trader: true },
      });

      if (!copyTrading) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Copy trade not found' })
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

      await auditLogService.logFinancialOperation({
        userId,
        operation: 'COPY_TRADING_STOP',
        resourceType: 'CopyTrading',
        resourceId: updated.id,
        metadata: {
          traderId: copyTrading.traderId,
          traderWalletAddress: copyTrading.trader.walletAddress,
        },
        ipAddress: ctx.rateLimitContext.ip,
        userAgent: ctx.fingerprint?.userAgent,
      })

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

      return copyTrades.map((ct: typeof copyTrades[0]) => ({
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
      const tokenMints = [...new Set(positions.map((p: { tokenMint: string }) => p.tokenMint))] as string[];
      const prices = await fetchCurrentPrices(tokenMints);

      return positions.map((position: { tokenMint: string; entryPrice: number; entryAmount: number; entryValue: number }) => {
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
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const where = {
        status: 'CLOSED',
        copyTrading: {
          userId,
          ...(input.copyTradingId ? { id: input.copyTradingId } : {}),
        },
      } as const

      const orderBy = [{ exitTimestamp: 'desc' }, { id: 'desc' }] as const

      let positions = [] as Awaited<ReturnType<typeof prisma.position.findMany>>
      let nextCursor: string | undefined

      if (input.cursor) {
        positions = await prisma.position.findMany({
          where,
          include: {
            copyTrading: {
              include: { trader: true },
            },
          },
          orderBy,
          take: input.limit + 1,
          cursor: { id: input.cursor },
          skip: 1,
        })

        if (positions.length > input.limit) {
          const next = positions.pop()
          nextCursor = next?.id
        }
      } else {
        positions = await prisma.position.findMany({
          where,
          include: {
            copyTrading: {
              include: { trader: true },
            },
          },
          orderBy,
          take: input.limit,
          skip: input.offset,
        })
      }

      const total = await prisma.position.count({
        where,
      });

      return {
        positions,
        total,
        hasMore: input.cursor ? Boolean(nextCursor) : (input.offset + input.limit) < total,
        nextCursor,
      };
    }),

  // ================================================
  // CLOSE POSITION MANUALLY
  // ================================================
  closePosition: createOwnershipProcedure('Position', 'positionId')
    .input(z.object({
      positionId: z.string(),
      totpCode: z.string().length(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await applyRateLimit('strict', ctx.rateLimitContext)
      const userId = ctx.user.id
      const lockKey = `copy-trade:close:${userId}`

      if (!input.totpCode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA code is required' })
      }
      await verifyTotpForUser(userId, input.totpCode)

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

      await auditLogService.logFinancialOperation({
        userId,
        operation: 'POSITION_CLOSE_REQUEST',
        resourceType: 'Position',
        resourceId: position.id,
        amount: position.entryAmount,
        currency: 'USDC',
        metadata: {
          queueId: queueItem.id,
          copyTradingId: position.copyTradingId,
          tokenMint: position.tokenMint,
          maxSlippage: 2,
        },
        ipAddress: ctx.rateLimitContext.ip,
        userAgent: ctx.fingerprint?.userAgent,
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
    .query(async ({ input }) => {
      const trader = await prisma.traderProfile.findUnique({
        where: { walletAddress: input.walletAddress },
      });

      if (!trader) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trader not found',
        });
      }

      // Calculate days from period
      const days = input.period === '7d' ? 7 : input.period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch historical snapshots from database
      const snapshots = await prisma.traderPerformanceSnapshot.findMany({
        where: {
          traderId: trader.id,
          date: { gte: startDate },
        },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          roi: true,
          totalPnL: true,
        },
      });

      // If we have snapshots, use them
      if (snapshots.length > 0) {
        return {
          trader,
          performance: snapshots.map((s: { date: Date; roi: number; totalPnL: number }) => ({
            date: s.date.toISOString(),
            value: s.roi,
            pnl: s.totalPnL,
          })),
        };
      }

      // Fallback: Calculate current performance and create simple historical projection
      // This is used when snapshots haven't been created yet (first deployment)
      const currentPerf = await prisma.position.aggregate({
        where: {
          copyTrading: { traderId: trader.id },
          status: 'CLOSED',
          exitTimestamp: { gte: startDate },
        },
        _sum: { profitLoss: true },
      });

      const currentROI = trader.totalROI;
      const currentPnL = currentPerf._sum.profitLoss || 0;

      // Generate estimated historical data based on current ROI
      const estimated = [];
      const now = new Date();

      for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Simple linear progression (rough estimate until snapshots exist)
        const progress = (days - i) / days;
        estimated.push({
          date: date.toISOString(),
          value: currentROI * progress,
          pnl: currentPnL * progress,
        });
      }

      return {
        trader,
        performance: estimated,
        estimated: true, // Flag to indicate this is estimated data
      };
    }),
});
