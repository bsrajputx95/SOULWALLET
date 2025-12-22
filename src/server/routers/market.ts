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

  // Get detailed token info for coin detail page
  getTokenDetails: protectedProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20),
      address: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        // Search for token by symbol
        const searchResult = await marketData.search(input.symbol);

        if (!searchResult.pairs || searchResult.pairs.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Token not found'
          });
        }

        // Find best match (Solana, highest liquidity)
        const solanaPairs = (searchResult.pairs as any[]).filter(
          (p: any) => p.chainId === 'solana'
        );

        const pair = solanaPairs.length > 0
          ? solanaPairs.sort((a: any, b: any) =>
            parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
          )[0]
          : searchResult.pairs[0];

        return {
          // Basic Info
          address: pair.baseToken?.address || '',
          symbol: pair.baseToken?.symbol || input.symbol,
          name: pair.baseToken?.name || 'Unknown',
          decimals: pair.baseToken?.decimals || 9,
          logo: pair.info?.imageUrl || null,

          // Price Data
          price: parseFloat(pair.priceUsd || '0'),
          priceChange1h: parseFloat(pair.priceChange?.h1 || '0'),
          priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
          priceChange7d: parseFloat(pair.priceChange?.d7 || '0'),

          // Market Data
          marketCap: parseFloat(pair.marketCap || '0'),
          fdv: parseFloat(pair.fdv || '0'),
          volume24h: parseFloat(pair.volume?.h24 || '0'),
          liquidity: parseFloat(pair.liquidity?.usd || '0'),

          // Transaction Data
          txns24h: {
            buys: pair.txns?.h24?.buys || 0,
            sells: pair.txns?.h24?.sells || 0,
            total: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          },

          // Holders (not available from DexScreener, would need separate API)
          holders: 0,

          // Metadata
          website: pair.info?.websites?.[0] || null,
          twitter: pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url || null,
          telegram: pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url || null,
          description: pair.info?.description || null,

          // Verification
          verified: pair.info?.verified || false,
          pairAge: pair.pairCreatedAt
            ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000)
            : null,
          pairAddress: pair.pairAddress,
          dexId: pair.dexId,
          chainId: pair.chainId,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch token details'
        });
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

  // Get price history (OHLCV) for charting
  getPriceHistory: protectedProcedure
    .input(z.object({
      pairAddress: z.string().min(10),
      timeframe: z.enum(['5m', '15m', '1h', '4h', '1d']).default('1h'),
    }))
    .query(async ({ input }) => {
      try {
        const ohlcv = await marketData.getOHLCV(input.pairAddress, input.timeframe);
        return {
          data: ohlcv,
          timeframe: input.timeframe,
          pairAddress: input.pairAddress,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch price history'
        });
      }
    }),
});
