import axios from 'axios';
import http from 'http';
import https from 'https';
import { z } from 'zod';
import { getCircuitBreaker } from './circuitBreaker';
import { retryWithBackoff } from '../utils/retry';
import { logger } from '../logger';
import { redisCache, getCacheTtls } from '../redis'

// Comment 5: 5s timeout for external calls
const EXTERNAL_CALL_TIMEOUT = Number.parseInt(process.env.EXTERNAL_CALL_TIMEOUT || '5000', 10);

// Configured axios instance with keep-alive (Audit Issue #9)
const axiosInstance = axios.create({
  baseURL: 'https://api.dexscreener.com/latest',
  timeout: EXTERNAL_CALL_TIMEOUT, // Comment 5: Use 5s timeout
  headers: {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'User-Agent': 'SoulWallet/1.0',
  },
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

class MarketDataService {
  private readonly priceBreaker = getCircuitBreaker('price:dexscreener');
  // Comment 1: Circuit breakers for each operation
  private readonly searchBreaker = getCircuitBreaker('dexscreener:search');
  private readonly pairBreaker = getCircuitBreaker('dexscreener:pair');
  private readonly trendingBreaker = getCircuitBreaker('dexscreener:trending');
  private readonly ohlcvBreaker = getCircuitBreaker('dexscreener:ohlcv');

  private DexPairsSchema = z.object({ pairs: z.array(z.any()).optional() });
  private DexTokenSchema = z.object({ baseToken: z.object({ address: z.string().optional(), symbol: z.string().optional(), name: z.string().optional() }).optional(), priceUsd: z.string().optional() }).partial();
  private DexPairSchema = z.object({ baseToken: z.object({ address: z.string().optional(), symbol: z.string().optional(), name: z.string().optional() }).optional(), pairAddress: z.string().optional(), chainId: z.string().optional(), priceUsd: z.string().optional() }).partial();

  async getToken(address: string) {
    const { price: priceTtlSeconds } = getCacheTtls()
    const key: `token:${string}` = `token:${address}`;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    return this.priceBreaker.exec(
      async () => {
        const { data } = await axiosInstance.get(`/dex/tokens/${address}`)
        const validated = this.DexTokenSchema.safeParse(data)
        const result = validated.success ? data : { baseToken: { address }, priceUsd: '0' }
        await redisCache.set(key, result, priceTtlSeconds)
        return result
      },
      async () => {
        const result = { baseToken: { address }, priceUsd: '0' }
        await redisCache.set(key, result, priceTtlSeconds)
        return result
      }
    )
  }

  /**
   * Search Dexscreener
   * Comment 1+2+5: Wrapped with circuit breaker, retry, 5s timeout
   */
  async search(q: string) {
    const { price: priceTtlSeconds } = getCacheTtls()
    const key: `search:${string}` = `search:${q}`;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    return this.searchBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const { data } = await axiosInstance.get(`/dex/search`, {
            params: { q },
            timeout: EXTERNAL_CALL_TIMEOUT
          });
          const validated = this.DexPairsSchema.safeParse(data);
          const result = validated.success ? data : { pairs: [] };
          await redisCache.set(key, result, priceTtlSeconds);
          return result;
        }, { maxRetries: 2, initialDelayMs: 500 });
      },
      () => {
        logger.warn('Dexscreener search circuit breaker open');
        return { pairs: [] };
      }
    );
  }

  /**
   * Get pair data from Dexscreener
   * Comment 1+2+5: Wrapped with circuit breaker, retry, 5s timeout
   */
  async getPair(chain: string, pairAddress: string) {
    const { price: priceTtlSeconds } = getCacheTtls()
    const key: `pair:${string}:${string}` = `pair:${chain}:${pairAddress}`;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    return this.pairBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const { data } = await axiosInstance.get(`/dex/pairs/${chain}/${pairAddress}`, {
            timeout: EXTERNAL_CALL_TIMEOUT
          });
          const validated = this.DexPairSchema.safeParse(data);
          const result = validated.success ? data : { baseToken: {}, pairAddress, chainId: chain, priceUsd: '0' };
          await redisCache.set(key, result, priceTtlSeconds);
          return result;
        }, { maxRetries: 2, initialDelayMs: 500 });
      },
      () => {
        logger.warn('Dexscreener getPair circuit breaker open');
        return { baseToken: {}, pairAddress, chainId: chain, priceUsd: '0' };
      }
    );
  }

  /**
   * Get SoulMarket curated tokens with BEAST quality filters
   * Beast Filters: Liquidity >$500k, Volume >$1M, Txns >500, Buy ratio >60%, Price change >5%
   * Solana-only, no stablecoins, sorted by verified first then volume
   */
  async getSoulMarket() {
    const key = 'soulmarket' as const;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    // Stablecoins to exclude - comprehensive list
    const STABLECOIN_SYMBOLS = [
      'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX', 'LUSD', 'GUSD', 'PAX', 'PYUSD', 'USDD',
      'USDH', 'UXD', 'EURC', 'USDR', 'USDJ', 'UST', 'CUSD', 'SUSD', 'HUSD', 'MUSD', 'DUSD', 'OUSD',
      'ZUSD', 'NUSD', 'AUSD', 'FUSD', 'RUSD', 'XUSD', 'YUSD', 'WUSD', 'VUSD', 'KUSD', 'PUSD',
      'USD', 'USDS', 'USDX', 'USDN', 'USDK', 'USDQ', 'USDL', 'USDM', 'USDO', 'USDW', 'USDY',
      'BRZ', 'BRLT', 'TRYB', 'BIDR', 'IDRT', 'XSGD', 'XIDR', 'EURS', 'EURT', 'JEUR', 'AGEUR',
      'STEUR', 'CEUR', 'SEUR', 'GBPT', 'GYEN', 'JPYC', 'CADC', 'NZDS', 'XCHF', 'DCHF', 'FDUSD',
    ];
    const STABLECOIN_ADDRESSES = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD', // BRZ
      'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
      '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT', // UXD
      'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', // EURC
      '9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i', // UST (wormhole)
      'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1', // USDCet (wormhole)
      'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM', // USDCpo (wormhole)
      'Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS', // PAI
      '9iLH8T7zoWhY7sBmj1WK9ENbWdS1nL8n9wAxaeRitTa6', // USH
      'EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCCb39Aq1Ci1D', // USDH (Hubble)
    ];

    const isStablecoinByName = (name: string): boolean => {
      const lowerName = name.toLowerCase();
      return lowerName.includes('usd') ||
        lowerName.includes('dollar') ||
        lowerName.includes('stablecoin') ||
        lowerName.includes('stable') ||
        lowerName.includes('tether') ||
        lowerName.includes('dai ') ||
        lowerName === 'dai';
    };

    return this.trendingBreaker.exec(
      async () => {
        // Expanded search terms - 35+ popular Solana ecosystem tokens
        const searchTerms = [
          // Top Solana ecosystem tokens
          'SOL', 'JUP', 'PYTH', 'JTO', 'RAY', 'ORCA', 'BONK', 'WIF',
          // Popular meme coins
          'POPCAT', 'PENGU', 'AI16Z', 'GOAT', 'FARTCOIN', 'MEW', 'BOME', 'SLERF',
          'PNUT', 'CHILLGUY', 'GIGA', 'MOODENG', 'TREMP', 'MOTHER', 'MYRO',
          // DeFi tokens
          'RNDR', 'HNT', 'MOBILE', 'IOT', 'MSOL', 'JITOSOL', 'BSOL', 'MARINADE',
          // Gaming/NFT/Utility tokens
          'SAMO', 'FIDA', 'STEP', 'ATLAS', 'POLIS', 'DUST', 'FORGE', 'TENSOR',
        ];

        const results = await Promise.all(
          searchTerms.map(async (token) => {
            try {
              return await this.search(token);
            } catch (error) {
              return { pairs: [] };
            }
          })
        );

        // Combine all pairs
        const allPairs = results.flatMap(r => r.pairs || []);

        // Current time for age calculation
        const now = Date.now();
        const MIN_PAIR_AGE_HOURS = 4;
        const MIN_PAIR_AGE_MS = MIN_PAIR_AGE_HOURS * 60 * 60 * 1000;

        // Apply BEAST quality filters
        const filteredPairs = allPairs.filter((pair: any) => {
          // Filter 0: Solana chain only
          if (pair.chainId !== 'solana') return false;

          // Filter 1: Exclude stablecoins by symbol
          const symbol = pair.baseToken?.symbol?.toUpperCase() || '';
          if (STABLECOIN_SYMBOLS.includes(symbol)) return false;
          if (symbol.includes('USD') || symbol.includes('STABLE')) return false;

          // Filter 2: Exclude stablecoins by address
          const address = pair.baseToken?.address || '';
          if (STABLECOIN_ADDRESSES.includes(address)) return false;

          // Filter 3: Exclude stablecoins by name
          const name = pair.baseToken?.name || '';
          if (isStablecoinByName(name)) return false;

          // BEAST Filter 4: Minimum liquidity $500,000
          const liquidity = parseFloat(pair.liquidity?.usd || '0');
          if (liquidity < 500000) return false;

          // Filter 5: Minimum pair age 4 hours
          const pairCreatedAt = pair.pairCreatedAt;
          if (pairCreatedAt) {
            const pairAge = now - pairCreatedAt;
            if (pairAge < MIN_PAIR_AGE_MS) return false;
          }

          // BEAST Filter 6: Minimum 24h volume $1,000,000
          const volume24h = parseFloat(pair.volume?.h24 || '0');
          if (volume24h < 1000000) return false;

          // BEAST Filter 7: Minimum 24h transactions 500
          const buys24h = pair.txns?.h24?.buys || 0;
          const sells24h = pair.txns?.h24?.sells || 0;
          const txns24h = buys24h + sells24h;
          if (txns24h < 500) return false;

          // BEAST Filter 8: Buy ratio > 60% (buys / (buys + sells))
          if (txns24h > 0) {
            const buyRatio = buys24h / txns24h;
            if (buyRatio < 0.6) return false;
          }

          // BEAST Filter 9: Absolute price change > 5%
          const priceChange = Math.abs(parseFloat(pair.priceChange?.h24 || '0'));
          if (priceChange < 5) return false;

          // Filter 10: Must have valid price
          const price = parseFloat(pair.priceUsd || '0');
          if (price <= 0) return false;

          // Filter 11: Minimum FDV $100k
          if (pair.fdv && parseFloat(pair.fdv) < 100000) return false;

          return true;
        });

        // Sort by verified first, then volume DESC
        const sortedPairs = filteredPairs.sort((a: any, b: any) => {
          // Primary sort: verified pairs first
          const verifiedA = a.info?.verified ? 1 : 0;
          const verifiedB = b.info?.verified ? 1 : 0;
          if (verifiedB !== verifiedA) return verifiedB - verifiedA;

          // Secondary sort: volume DESC
          const volumeA = parseFloat(a.volume?.h24 || '0');
          const volumeB = parseFloat(b.volume?.h24 || '0');
          return volumeB - volumeA;
        });

        // Remove duplicates based on base token address
        const uniquePairs = sortedPairs.filter((pair: any, index: number, self: any[]) =>
          index === self.findIndex((p: any) => p.baseToken?.address === pair.baseToken?.address)
        );

        const soulMarket = { pairs: uniquePairs.slice(0, 50) };
        await redisCache.set(key, soulMarket, 300);
        return soulMarket;
      },
      async () => {
        logger.warn('SoulMarket circuit breaker open, returning cached or empty');
        const fallback = await redisCache.get<any>(key);
        return fallback || { pairs: [] };
      }
    );
  }

  /**
   * Get trending tokens with BEAST quality filters
   * Beast Filters: Liquidity >$500k, Volume >$1M, Txns >500, Buy ratio >60%, Price change >5%
   * Solana-only, no stablecoins, sorted by verified first then volume
   */
  async trending() {
    const key = 'trending' as const;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    // Stablecoins to exclude - comprehensive list
    const STABLECOIN_SYMBOLS = [
      'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX', 'LUSD', 'GUSD', 'PAX', 'PYUSD', 'USDD',
      'USDH', 'UXD', 'EURC', 'USDR', 'USDJ', 'UST', 'CUSD', 'SUSD', 'HUSD', 'MUSD', 'DUSD', 'OUSD',
      'ZUSD', 'NUSD', 'AUSD', 'FUSD', 'RUSD', 'XUSD', 'YUSD', 'WUSD', 'VUSD', 'KUSD', 'PUSD',
      'USD', 'USDS', 'USDX', 'USDN', 'USDK', 'USDQ', 'USDL', 'USDM', 'USDO', 'USDW', 'USDY',
      'BRZ', 'BRLT', 'TRYB', 'BIDR', 'IDRT', 'XSGD', 'XIDR', 'EURS', 'EURT', 'JEUR', 'AGEUR',
      'STEUR', 'CEUR', 'SEUR', 'GBPT', 'GYEN', 'JPYC', 'CADC', 'NZDS', 'XCHF', 'DCHF',
    ];
    const STABLECOIN_ADDRESSES = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD', // BRZ
      'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
      '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT', // UXD
      'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', // EURC
      '9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i', // UST (wormhole)
      'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1', // USDCet (wormhole)
      'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM', // USDCpo (wormhole)
      'Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS', // PAI
      '9iLH8T7zoWhY7sBmj1WK9ENbWdS1nL8n9wAxaeRitTa6', // USH
      'EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCCb39Aq1Ci1D', // USDH (Hubble)
    ];

    const isStablecoinByName = (name: string): boolean => {
      const lowerName = name.toLowerCase();
      return lowerName.includes('usd') ||
        lowerName.includes('dollar') ||
        lowerName.includes('stablecoin') ||
        lowerName.includes('stable') ||
        lowerName.includes('tether') ||
        lowerName.includes('dai ') ||
        lowerName === 'dai';
    };

    return this.trendingBreaker.exec(
      async () => {
        // Search for popular trending Solana meme/utility tokens (NO stablecoins)
        const trendingTokens = ['BONK', 'WIF', 'POPCAT', 'JUP', 'PYTH', 'JTO', 'RNDR', 'RAY', 'ORCA', 'PENGU', 'AI16Z', 'GOAT', 'FARTCOIN', 'SOL', 'MEW', 'BOME', 'SLERF'];

        const results = await Promise.all(
          trendingTokens.map(async (token) => {
            try {
              return await this.search(token);
            } catch (error) {
              return { pairs: [] };
            }
          })
        );

        // Combine all pairs
        const allPairs = results.flatMap(r => r.pairs || []);

        // Simple filters - only exclude stablecoins and require basic validity
        const filteredPairs = allPairs.filter((pair: any) => {
          // Must be Solana chain
          if (pair.chainId !== 'solana') return false;

          // Filter out stablecoins by symbol
          const symbol = pair.baseToken?.symbol?.toUpperCase() || '';
          if (STABLECOIN_SYMBOLS.includes(symbol)) return false;
          if (symbol.includes('USD') || symbol.includes('STABLE')) return false;

          // Filter out stablecoins by address
          const address = pair.baseToken?.address || '';
          if (STABLECOIN_ADDRESSES.includes(address)) return false;

          // Filter out stablecoins by name
          const name = pair.baseToken?.name || '';
          if (isStablecoinByName(name)) return false;

          // Must have valid price (basic quality check)
          const price = parseFloat(pair.priceUsd || '0');
          if (price <= 0) return false;

          // Must have some liquidity (very low threshold)
          const liquidity = parseFloat(pair.liquidity?.usd || '0');
          if (liquidity < 1000) return false;

          return true;
        });

        // Sort by volume DESC
        const sortedByTrending = filteredPairs.sort((a: any, b: any) => {
          const volumeA = parseFloat(a.volume?.h24 || '0');
          const volumeB = parseFloat(b.volume?.h24 || '0');
          return volumeB - volumeA;
        });

        // Remove duplicates based on base token address
        const uniquePairs = sortedByTrending.filter((pair: any, index: number, self: any[]) =>
          index === self.findIndex((p: any) => p.baseToken?.address === pair.baseToken?.address)
        );

        const trending = { pairs: uniquePairs.slice(0, 20) };
        await redisCache.set(key, trending, 120); // Cache for 2 minutes
        return trending;
      },
      () => {
        logger.warn('Trending circuit breaker open, returning fallback');
        return this.search('solana');
      }
    );
  }

  /**
   * Get OHLCV (price history) data for a token pair
   * Comment 1+2+5: Wrapped with circuit breaker, retry, 5s timeout
   * Uses DexScreener's undocumented chart API
   */
  async getOHLCV(pairAddress: string, timeframe: '5m' | '15m' | '1h' | '4h' | '1d' = '1h') {
    const key: `ohlcv:${string}:${string}` = `ohlcv:${pairAddress}:${timeframe}`;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    return this.ohlcvBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          // DexScreener uses specific resolution values
          const resolutionMap: Record<string, string> = {
            '5m': '5',
            '15m': '15',
            '1h': '60',
            '4h': '240',
            '1d': '1440'
          };
          const resolution = resolutionMap[timeframe] || '60';

          // Cache buster for real-time data
          const now = Math.floor(Date.now() / 1000);

          // DexScreener chart API with 5s timeout
          const url = `https://io.dexscreener.com/dex/chart/amm/v3/solana/${pairAddress}?res=${resolution}&cb=${Math.floor(now / 60)}`;

          const { data } = await axios.get(url, {
            timeout: EXTERNAL_CALL_TIMEOUT,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'SoulWallet/1.0'
            }
          });

          // Parse response - DexScreener returns bars in specific format
          const bars = data?.bars || [];
          const ohlcv = bars.map((bar: any) => ({
            time: bar.timestamp || bar.t,
            open: parseFloat(bar.open || bar.o || '0'),
            high: parseFloat(bar.high || bar.h || '0'),
            low: parseFloat(bar.low || bar.l || '0'),
            close: parseFloat(bar.close || bar.c || '0'),
            volume: parseFloat(bar.volume || bar.v || '0'),
          })).filter((b: any) => b.time && b.close > 0);

          // Cache for 1 minute for real-time feel
          await redisCache.set(key, ohlcv, 60);
          return ohlcv;
        }, { maxRetries: 2, initialDelayMs: 500 });
      },
      () => {
        logger.warn('OHLCV circuit breaker open, returning empty');
        return [];
      }
    );
  }
}

export const marketData = new MarketDataService();

/**
 * Warm the market cache on server startup
 * Comment 3: Pre-fetches SoulMarket and trending data to ensure fast initial loads
 */
export async function warmMarketCache(): Promise<void> {
  logger.info('Warming market cache...');
  const startTime = Date.now();

  try {
    // Prefetch SoulMarket (top 50 tokens)
    await marketData.getSoulMarket();
    logger.info('SoulMarket cache warmed');

    // Prefetch trending tokens
    await marketData.trending();
    logger.info('Trending cache warmed');

    // Prefetch popular token prices (SOL, BONK, WIF, JUP)
    const popularTokens = [
      'So11111111111111111111111111111111111111112', // SOL
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
    ];

    await Promise.all(popularTokens.map(addr => marketData.getToken(addr)));
    logger.info('Popular token prices cached');

    const duration = Date.now() - startTime;
    logger.info(`Market cache warmed successfully in ${duration}ms`);
  } catch (error) {
    logger.error('Failed to warm market cache:', error);
    // Don't throw - cache warming is best-effort
  }
}
