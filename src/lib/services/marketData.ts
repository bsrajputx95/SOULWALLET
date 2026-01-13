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
   * Get SoulMarket tokens from DexScreener's boosted tokens API
   * Simple: Return top 30 Solana trending tokens, refreshed hourly
   * No complex filters - show what DexScreener considers trending
   */
  async getSoulMarket() {
    const key = 'soulmarket' as const;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    return this.trendingBreaker.exec(
      async () => {
        try {
          // Use DexScreener's boosted tokens API - these are trending/promoted tokens
          const { data } = await axios.get('https://api.dexscreener.com/token-boosts/top/v1', {
            timeout: EXTERNAL_CALL_TIMEOUT,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'SoulWallet/1.0'
            }
          });

          // Filter for Solana chain only, take top 30
          const solanaTokens = (data || [])
            .filter((token: any) => token.chainId === 'solana')
            .slice(0, 30)
            .map((token: any) => ({
              // Format to match expected structure
              baseToken: {
                address: token.tokenAddress,
                symbol: token.description?.split(' ')[0] || 'TOKEN',
                name: token.description || 'Unknown',
              },
              chainId: 'solana',
              url: token.url,
              icon: token.icon ? `https://cdn.dexscreener.com/icons/${token.icon}` : undefined,
              header: token.header,
              links: token.links || [],
              boostAmount: token.totalAmount,
            }));

          const soulMarket = { pairs: solanaTokens };
          await redisCache.set(key, soulMarket, 3600); // Cache for 1 hour
          return soulMarket;
        } catch (error) {
          logger.error('Failed to fetch SoulMarket tokens:', error);
          return { pairs: [] };
        }
      },
      async () => {
        logger.warn('SoulMarket circuit breaker open, returning cached or empty');
        const fallback = await redisCache.get<any>(key);
        return fallback || { pairs: [] };
      }
    );
  }

  /**
   * Get trending tokens from DexScreener's boosted tokens API
   * Simple: Just return top 10 Solana trending tokens from DexScreener
   * No complex filters - show what DexScreener considers trending
   */
  async trending() {
    const key = 'trending' as const;
    const cached = await redisCache.get<any>(key);
    if (cached) return cached;

    return this.trendingBreaker.exec(
      async () => {
        try {
          // Use DexScreener's boosted tokens API - these are the trending/promoted tokens
          const { data } = await axios.get('https://api.dexscreener.com/token-boosts/top/v1', {
            timeout: EXTERNAL_CALL_TIMEOUT,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'SoulWallet/1.0'
            }
          });

          // Filter for Solana chain only, take top 10
          const solanaTokens = (data || [])
            .filter((token: any) => token.chainId === 'solana')
            .slice(0, 10)
            .map((token: any) => ({
              // Format to match expected structure
              baseToken: {
                address: token.tokenAddress,
                symbol: token.description?.split(' ')[0] || 'TOKEN',
                name: token.description || 'Unknown',
              },
              chainId: 'solana',
              url: token.url,
              icon: token.icon ? `https://cdn.dexscreener.com/icons/${token.icon}` : undefined,
              header: token.header,
              links: token.links || [],
              boostAmount: token.totalAmount,
            }));

          const trending = { pairs: solanaTokens };
          await redisCache.set(key, trending, 300); // Cache for 5 minutes
          return trending;
        } catch (error) {
          logger.error('Failed to fetch trending tokens:', error);
          return { pairs: [] };
        }
      },
      async () => {
        logger.warn('Trending circuit breaker open, returning cached or empty');
        const fallback = await redisCache.get<any>(key);
        return fallback || { pairs: [] };
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
