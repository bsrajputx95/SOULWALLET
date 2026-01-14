import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { marketData } from '../../lib/services/marketData';
import { redisCache } from '../../lib/redis';

// Well-known token logos for popular Solana tokens as fallback
const WELL_KNOWN_TOKEN_LOGOS: Record<string, string> = {
  'SOL': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  'RAY': 'https://raw.githubusercontent.com/raydium-io/media-assets/master/logo/logo_200x200.png',
  'JUP': 'https://static.jup.ag/jup/icon.png',
  'USDC': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  'USDT': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  'BONK': 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  'WIF': 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link',
  'POPCAT': 'https://bafkreidvnhdzuq3pvhnzq26hjydmhrr2xw2flkxkflg7swmrxnx7c7xvey.ipfs.nftstorage.link',
  'PYTH': 'https://pyth.network/token.svg',
  'JTO': 'https://metadata.jito.network/token/jto/icon.png',
  'ORCA': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  'MNGO': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac/token.png',
  'RENDER': 'https://assets.coingecko.com/coins/images/11636/small/rndr.png',
  'FIDA': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp/logo.svg',
  'STEP': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT/logo.png',
  'SRM': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png',
  'COPE': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh/logo.png',
  'SAMO': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/logo.png',
  'MEME': 'https://assets.coingecko.com/coins/images/31614/small/meme_logo.png',
};

function getWellKnownTokenLogo(symbol?: string): string | null {
  if (!symbol) return null;
  return WELL_KNOWN_TOKEN_LOGOS[symbol.toUpperCase()] || null;
}

export const marketRouter = router({
  getTopCoins: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).partial().optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const cached = await redisCache.get<any>('soulmarket');
      if (cached?.pairs && Array.isArray(cached.pairs)) {
        return { pairs: cached.pairs.slice(0, limit) };
      }

      void marketData.getSoulMarket().catch(() => void 0);

      const fallbackSymbols = ['SOL', 'USDC', 'USDT', 'JUP', 'PYTH', 'RAY', 'ORCA', 'BONK', 'WIF', 'POPCAT'];
      const pairs = fallbackSymbols.slice(0, limit).map((symbol) => ({
        baseToken: { symbol },
        priceUsd: '0',
        liquidity: { usd: '0' },
        volume: { h24: '0' },
        chainId: 'solana',
        pairAddress: null,
        info: { imageUrl: getWellKnownTokenLogo(symbol) },
      }));

      return { pairs };
    }),

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
          // Logo with multiple fallback sources
          logo: pair.info?.imageUrl
            || pair.info?.header  // Some tokens have header image
            || getWellKnownTokenLogo(pair.baseToken?.symbol) // Fallback to well-known tokens
            || null,

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
  trending: publicProcedure
    .query(async () => {
      try {
        // Check cache first (key must match marketData.trending() which uses 'trending:daily')
        const cached = await redisCache.get<any>('trending:daily');
        if (cached) return cached;
        
        // Fetch trending data synchronously to ensure we return data
        const data = await marketData.trending();
        return data;
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch trending tokens' });
      }
    }),

  // SoulMarket - Curated tokens with quality filters
  soulMarket: publicProcedure
    .query(async () => {
      try {
        const cached = await redisCache.get<any>('soulmarket');
        if (cached) return cached;
        void marketData.getSoulMarket().catch(() => void 0);
        return { pairs: [] };
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
