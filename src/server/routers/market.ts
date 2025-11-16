import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { marketData } from '../../lib/services/marketData';

export const marketRouter = router({
  // Get token details by mint/address
  getToken: protectedProcedure
    .input(z.object({ address: z.string().min(10) }))
    .query(async ({ input }) => {
      try {
        return await marketData.getToken(input.address);
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch token data' });
      }
    }),

  // Search tokens/pairs
  search: protectedProcedure
    .input(z.object({ q: z.string().min(1), limit: z.number().min(1).max(50).optional(), cursor: z.number().min(0).optional() }))
    .query(async ({ input }) => {
      try {
        const data = await marketData.search(input.q);
        const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
        const total = pairs.length;
        const limit = input.limit ?? 20;
        const start = input.cursor ?? 0;
        const end = Math.min(start + limit, total);
        const sliced = pairs.slice(start, end);
        const nextCursor = end < total ? end : null;
        return { pairs: sliced, total, hasMore: end < total, cursor: nextCursor };
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Search failed' });
      }
    }),

  // Trending (fallback implementation)
  trending: protectedProcedure
    .query(async () => {
      try {
        return await marketData.trending();
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch trending tokens' });
      }
    }),

  // SoulMarket - Curated tokens with quality filters
  soulMarket: protectedProcedure
    .query(async () => {
      try {
        return await marketData.getSoulMarket();
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch SoulMarket tokens' });
      }
    }),
});
