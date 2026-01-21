/**
 * Traders Router
 * Provides endpoints for top Solana traders/wallets with real performance data
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { birdeyeData } from '../../lib/services/birdeyeData';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { redisCache } from '../../lib/redis'



export const tradersRouter = router({
  /**
   * Get top 10 traders with real performance data from Birdeye
   * Falls back to seeded traders if no featured traders exist
   */
  getTopTraders: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(10),
      period: z.enum(['1d', '7d', '30d', 'all']).default('7d'),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 10;
      const cacheKey: `traders:top:${string}` = `traders:top:${limit}:${input?.period || '7d'}`
      const cached = await redisCache.get<any[]>(cacheKey)
      if (cached) return { success: true, data: cached as any, count: cached.length }
      try {
        // First try to get featured traders
        let traders = await prisma.traderProfile.findMany({
          where: { isFeatured: true },
          orderBy: { featuredOrder: 'asc' },
          take: limit,
        });

        // If no featured traders, get all traders ordered by creation date
        if (traders.length === 0) {
          traders = await prisma.traderProfile.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
          });
        }

        // If still no traders in DB, use hardcoded known high-performing wallets
        if (traders.length === 0) {
          const knownTraders = [
            { id: 'trader-1', walletAddress: '7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffXHsM', username: 'SolanaWhale1' },
            { id: 'trader-2', walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK', username: 'DeFiMaster' },
            { id: 'trader-3', walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', username: 'MemeTrader' },
            { id: 'trader-4', walletAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', username: 'AlphaHunter' },
            { id: 'trader-5', walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', username: 'TokenSniper' },
          ];

          const tradersWithData = await Promise.all(
            knownTraders.slice(0, limit).map(async (trader) => {
              try {
                const pnlData = await birdeyeData.getWalletPnL(trader.walletAddress);
                const totalPnL = (pnlData as any)?.data?.total_usd || 0;
                const realizedProfit = (pnlData as any)?.data?.realized_profit_usd || 0;
                const unrealizedProfit = (pnlData as any)?.data?.unrealized_usd || 0;
                const roi = (pnlData as any)?.data?.total_percent || 0;
                const totalTrades = (pnlData as any)?.data?.counts?.total_trade || 0;
                return {
                  id: trader.id,
                  name: trader.username,
                  walletAddress: trader.walletAddress,
                  verified: false,
                  roi,
                  totalPnL,
                  realizedProfit,
                  unrealizedProfit,
                  totalTrades,
                  period: input?.period || '7d',
                  lastActive: new Date().toISOString(),
                };
              } catch (error) {
                logger.error(`Error fetching data for ${trader.username}:`, error);
                return {
                  id: trader.id,
                  name: trader.username,
                  walletAddress: trader.walletAddress,
                  verified: false,
                  roi: 0,
                  totalPnL: 0,
                  realizedProfit: 0,
                  unrealizedProfit: 0,
                  totalTrades: 0,
                  period: input?.period || '7d',
                  lastActive: new Date().toISOString(),
                };
              }
            })
          );

          const sortedTraders = tradersWithData.sort((a, b) => (b.roi || 0) - (a.roi || 0));
          await redisCache.set(cacheKey, sortedTraders, 86400)
          return { success: true, data: sortedTraders, count: sortedTraders.length };
        }

        const tradersWithData = await Promise.all(
          traders.map(async (trader) => {
            try {
              const pnlData = await birdeyeData.getWalletPnL(trader.walletAddress);
              const totalPnL = (pnlData as any)?.data?.total_usd || 0;
              const realizedProfit = (pnlData as any)?.data?.realized_profit_usd || 0;
              const unrealizedProfit = (pnlData as any)?.data?.unrealized_usd || 0;
              const roi = (pnlData as any)?.data?.total_percent || 0;
              const totalTrades = (pnlData as any)?.data?.counts?.total_trade || 0;
              return {
                id: trader.id,
                name: trader.username || trader.id,
                walletAddress: trader.walletAddress,
                verified: false,
                roi,
                totalPnL,
                realizedProfit,
                unrealizedProfit,
                totalTrades,
                period: input?.period || '7d',
                lastActive: new Date().toISOString(),
              };
            } catch (error) {
              logger.error(`Error fetching data for ${trader.username || trader.id}:`, error);
              return {
                id: trader.id,
                name: trader.username || trader.id,
                walletAddress: trader.walletAddress,
                verified: false,
                roi: 0,
                totalPnL: 0,
                realizedProfit: 0,
                unrealizedProfit: 0,
                totalTrades: 0,
                period: input?.period || '7d',
                lastActive: new Date().toISOString(),
              };
            }
          })
        );

        const sortedTraders = tradersWithData.sort((a, b) => (b.roi || 0) - (a.roi || 0));
        await redisCache.set(cacheKey, sortedTraders, 86400)
        return { success: true, data: sortedTraders, count: sortedTraders.length };
      } catch (error) {
        logger.error('Error fetching top traders:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch top traders'
        });
      }
    }),

  /**
   * Get specific trader details by ID or wallet address
   */
  getTrader: protectedProcedure
    .input(z.object({
      identifier: z.string(), // Can be trader ID (trader1) or wallet address
    }))
    .query(async ({ input }) => {
      try {
        const trader = await prisma.traderProfile.findFirst({
          where: {
            OR: [
              { id: input.identifier },
              { walletAddress: input.identifier },
            ],
          },
        });

        if (!trader) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Trader not found'
          });
        }

        const [pnlData, tokensData] = await Promise.all([
          birdeyeData.getWalletPnL(trader.walletAddress),
          birdeyeData.getWalletTokens(trader.walletAddress),
        ]);

        const totalPnL = (pnlData as any)?.data?.total_usd || 0;
        const realizedProfit = (pnlData as any)?.data?.realized_profit_usd || 0;
        const unrealizedProfit = (pnlData as any)?.data?.unrealized_usd || 0;
        const roi = (pnlData as any)?.data?.total_percent || 0;

        return {
          success: true,
          data: {
            id: trader.id,
            name: trader.username || trader.id,
            walletAddress: trader.walletAddress,
            verified: false,
            // Performance
            roi,
            totalPnL,
            realizedProfit,
            unrealizedProfit,
            // Portfolio
            tokens: (tokensData as any)?.data?.items?.slice(0, 10) || [],
            totalTrades: (pnlData as any)?.data?.total_trades || 0,
            winRate: 0,
            // Stats
            avgTradeSize: 0,
            bestTrade: 0,
            worstTrade: 0,
            lastActive: new Date().toISOString(),
          },
        };
      } catch (error) {
        logger.error(`Error fetching trader ${input.identifier}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trader details'
        });
      }
    }),

  search: protectedProcedure
    .input(z.object({ q: z.string().min(1), limit: z.number().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const limit = input.limit ?? 10;
      try {
        const traders = await prisma.traderProfile.findMany({
          where: {
            AND: [
              {},
              {
                OR: [
                  { username: { contains: input.q } },
                  { walletAddress: { contains: input.q } },
                ],
              },
            ],
          },
          orderBy: { featuredOrder: 'asc' },
          take: limit,
        });
        return { success: true, data: traders, count: traders.length };
      } catch (error) {
        logger.error('Error searching traders', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to search traders' });
      }
    }),
});
