/**
 * Birdeye Data Service
 * Integration with Birdeye API for wallet analytics and PnL data
 */

import axios from 'axios'
import http from 'http'
import https from 'https'
import { logger } from '../logger'
import { BirdeyePnLSchema, BirdeyePriceSchema } from '../schemas/external-api'
import { getCircuitBreaker } from './circuitBreaker'
import { retryWithBackoff } from '../utils/retry'
import { redisCache, getCacheTtls } from '../redis'

// Comment 5: 5s timeout for external calls
const EXTERNAL_CALL_TIMEOUT = Number.parseInt(process.env.EXTERNAL_CALL_TIMEOUT || '5000', 10)

const axiosInstance = axios.create({
  baseURL: 'https://public-api.birdeye.so',
  timeout: EXTERNAL_CALL_TIMEOUT, // Comment 5: Use 5s timeout
  headers: {
    accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'User-Agent': 'SoulWallet/1.0',
  },
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
})

class BirdeyeDataService {
  private apiKey = process.env.BIRDEYE_API_KEY || '';
  private readonly priceBreaker = getCircuitBreaker('price:birdeye')
  // Comment 1: Circuit breakers for wallet data
  private readonly pnlBreaker = getCircuitBreaker('birdeye:pnl')
  private readonly walletBreaker = getCircuitBreaker('birdeye:wallet')
  // Circuit breakers for market data
  private readonly trendingBreaker = getCircuitBreaker('birdeye:trending')
  private readonly topTokensBreaker = getCircuitBreaker('birdeye:soulmarket')

  /**
   * Get wallet PnL data from Birdeye
   * Comment 1+2+5: Wrapped with circuit breaker, retry, and 5s timeout
   * @param walletAddress Solana wallet address
   * @returns Wallet PnL data including realized/unrealized profits
   */
  async getWalletPnL(walletAddress: string) {
    const cacheKey: `birdeye:wallet:pnl:${string}` = `birdeye:wallet:pnl:${walletAddress}`
    const cached = await redisCache.get<any>(cacheKey)
    if (cached) return cached

    return this.pnlBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const response = await axiosInstance.get(`/v1/wallet/v2/pnl`, {
            params: {
              wallet: walletAddress,
            },
            headers: {
              'X-API-KEY': this.apiKey,
              'x-chain': 'solana',
              'accept': 'application/json',
            },
            timeout: EXTERNAL_CALL_TIMEOUT, // Comment 5: 5s timeout
          });

          const raw = response.data
          const parsed = BirdeyePnLSchema.safeParse(raw)
          if (!parsed.success) {
            logger.error('Invalid Birdeye PnL response', {
              walletAddress,
              error: parsed.error,
            })
            return this.getFallbackPnL()
          }
          await redisCache.set(cacheKey, parsed.data, 300)
          return parsed.data
        }, { maxRetries: 2, initialDelayMs: 500 });
      },
      // Circuit breaker fallback
      () => {
        logger.warn('Birdeye PnL circuit breaker open, returning fallback');
        return this.getFallbackPnL()
      }
    );
  }

  /**
   * Get wallet token list from Birdeye
   * Comment 1+2+5: Wrapped with circuit breaker, retry, and 5s timeout
   * @param walletAddress Solana wallet address
   * @returns List of tokens held in wallet
   */
  async getWalletTokens(walletAddress: string) {
    const cacheKey: `birdeye:wallet:tokens:${string}` = `birdeye:wallet:tokens:${walletAddress}`
    const cached = await redisCache.get<any>(cacheKey)
    if (cached) return cached

    return this.walletBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const response = await axiosInstance.get(`/v1/wallet/token_list`, {
            params: {
              wallet: walletAddress,
            },
            headers: {
              'X-API-KEY': this.apiKey,
              'x-chain': 'solana',
              'accept': 'application/json',
            },
            timeout: EXTERNAL_CALL_TIMEOUT, // Comment 5: 5s timeout
          });

          const data = response.data;
          await redisCache.set(cacheKey, data, 300)
          return data;
        }, { maxRetries: 2, initialDelayMs: 500 });
      },
      // Circuit breaker fallback
      () => {
        logger.warn('Birdeye wallet tokens circuit breaker open, returning empty');
        return { data: { items: [] } };
      }
    );
  }

  /**
   * Get token price in USD from Birdeye
   * Comment 1+2+5: Already wrapped with circuit breaker, now add retry and 5s timeout
   */
  async getTokenPriceUSD(tokenMint: string): Promise<number | null> {
    if (!this.apiKey) return null

    const cacheKey: `birdeye:price:${string}` = `birdeye:price:${tokenMint}`
    const cached = await redisCache.get<number>(cacheKey)
    if (typeof cached === 'number') return cached

    return this.priceBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const response = await axiosInstance.get(`/defi/price`, {
            params: {
              address: tokenMint,
            },
            headers: {
              'X-API-KEY': this.apiKey,
              'x-chain': 'solana',
              'accept': 'application/json',
            },
            timeout: EXTERNAL_CALL_TIMEOUT, // Comment 5: 5s timeout
          })

          const parsed = BirdeyePriceSchema.safeParse(response.data)
          if (!parsed.success) return null

          const price =
            parsed.data.data?.value ??
            parsed.data.data?.price ??
            null

          if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
            return null
          }

          await redisCache.set(cacheKey, price, getCacheTtls().price)
          return price
        }, { maxRetries: 2, initialDelayMs: 300 });
      },
      () => null
    )
  }

  async getTokenPricesUSD(tokenMints: string[]): Promise<Record<string, number>> {
    if (tokenMints.length === 0) return {}

    const uniqueMints = [...new Set(tokenMints)]
    const results: Record<string, number> = {}
    const keys = uniqueMints.map((m): `birdeye:price:${string}` => `birdeye:price:${m}`)
    const cached = await redisCache.mget<number>(keys)

    const missing: string[] = []
    for (let i = 0; i < uniqueMints.length; i++) {
      const mint = uniqueMints[i]!
      const val = cached[i]
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        results[mint] = val
      } else {
        missing.push(mint)
      }
    }

    const queue = [...missing]
    const concurrency = 5
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
          const mint = queue.shift()
          if (!mint) break
          const price = await this.getTokenPriceUSD(mint)
          results[mint] = price ?? 0
        }
      })
    )

    return results
  }

  /**
   * Get fallback PnL data when API is unavailable
   */
  private getFallbackPnL() {
    return {
      success: false,
      data: {
        total_usd: 0,
        realized_profit_usd: 0,
        unrealized_usd: 0,
        total_percent: 0,
        realized_profit_percent: 0,
        unrealized_percent: 0,
        counts: { total_trade: 0 },
      }
    };
  }

  /**
   * Clear cache for a specific wallet or all wallets
   */
  clearCache(walletAddress?: string) {
    if (walletAddress) {
      void redisCache.del([
        `birdeye:wallet:pnl:${walletAddress}`,
        `birdeye:wallet:tokens:${walletAddress}`,
      ])
    } else {
      void redisCache.invalidatePattern('birdeye:*')
    }
  }

  /**
   * Calculate seconds until next 15:00 UTC
   * Used for trending token cache TTL
   */
  private getSecondsUntilNext15UTC(): number {
    const now = new Date()
    const target = new Date(now)
    target.setUTCHours(15, 0, 0, 0)

    // If already past 15:00 UTC today, set to tomorrow
    if (now >= target) {
      target.setUTCDate(target.getUTCDate() + 1)
    }

    return Math.floor((target.getTime() - now.getTime()) / 1000)
  }

  /**
   * Calculate seconds until next hour
   * Used for SoulMarket cache TTL
   */
  private getSecondsUntilNextHour(): number {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0)
    return Math.floor((nextHour.getTime() - now.getTime()) / 1000)
  }

  /**
   * Get trending tokens from Birdeye
   * Cached until next 15:00 UTC (daily refresh)
   * @param limit Number of tokens to fetch (default 10)
   */
  async getTrendingTokens(limit: number = 10) {
    const cacheKey = 'birdeye:trending:daily' as const
    const cached = await redisCache.get<any>(cacheKey)
    if (cached) return cached

    return this.trendingBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const response = await axiosInstance.get('/defi/token_trending', {
            params: {
              sort_by: 'rank',
              sort_type: 'asc',
              offset: 0,
              limit: Math.min(limit, 20), // Birdeye max is 20
            },
            headers: {
              'X-API-KEY': this.apiKey,
              'x-chain': 'solana',
              'accept': 'application/json',
            },
            timeout: EXTERNAL_CALL_TIMEOUT,
          })

          const data = response.data
          if (!data?.success || !data?.data?.tokens) {
            logger.warn('Invalid Birdeye trending response', { response: data })
            return { pairs: [] }
          }

          // Transform Birdeye format to our standard format
          const pairs = data.data.tokens.map((token: any) => ({
            baseToken: {
              address: token.address,
              symbol: token.symbol,
              name: token.name,
            },
            priceUsd: String(token.price || 0),
            priceChange: {
              h24: token.priceChange24h || 0,
            },
            volume: {
              h24: String(token.v24hUSD || 0),
            },
            liquidity: {
              usd: String(token.liquidity || 0),
            },
            info: {
              imageUrl: token.logoURI || null,
            },
            chainId: 'solana',
            pairAddress: token.address, // Use token address as pair address for navigation
          }))

          const result = { pairs }
          const ttl = this.getSecondsUntilNext15UTC()
          await redisCache.set(cacheKey, result, ttl)
          logger.info(`Birdeye trending cached with ${pairs.length} tokens, TTL: ${ttl}s`)
          return result
        }, { maxRetries: 2, initialDelayMs: 500 })
      },
      () => {
        logger.warn('Birdeye trending circuit breaker open, returning empty')
        return { pairs: [] }
      }
    )
  }

  /**
   * Get top tokens by volume for SoulMarket
   * Cached for 1 hour (hourly refresh)
   * @param limit Number of tokens to fetch (default 30)
   */
  async getTopTokens(limit: number = 30) {
    const cacheKey = 'birdeye:soulmarket:hourly' as const
    const cached = await redisCache.get<any>(cacheKey)
    if (cached) return cached

    return this.topTokensBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const response = await axiosInstance.get('/defi/v3/token/list', {
            params: {
              sort_by: 'v24hUSD',
              sort_type: 'desc',
              offset: 0,
              limit: Math.min(limit, 50), // Limit to 50 max
            },
            headers: {
              'X-API-KEY': this.apiKey,
              'x-chain': 'solana',
              'accept': 'application/json',
            },
            timeout: EXTERNAL_CALL_TIMEOUT,
          })

          const data = response.data
          if (!data?.success || !data?.data?.tokens) {
            logger.warn('Invalid Birdeye top tokens response', { response: data })
            return { pairs: [] }
          }

          // Transform Birdeye format to our standard format
          const pairs = data.data.tokens.map((token: any) => ({
            baseToken: {
              address: token.address,
              symbol: token.symbol,
              name: token.name,
            },
            priceUsd: String(token.price || 0),
            priceChange: {
              h24: token.priceChange24hPercent || 0,
            },
            volume: {
              h24: String(token.v24hUSD || 0),
            },
            liquidity: {
              usd: String(token.liquidity || 0),
            },
            info: {
              imageUrl: token.logoURI || null,
            },
            chainId: 'solana',
            pairAddress: token.address,
          }))

          const result = { pairs }
          const ttl = this.getSecondsUntilNextHour()
          await redisCache.set(cacheKey, result, ttl)
          logger.info(`Birdeye SoulMarket cached with ${pairs.length} tokens, TTL: ${ttl}s`)
          return result
        }, { maxRetries: 2, initialDelayMs: 500 })
      },
      () => {
        logger.warn('Birdeye top tokens circuit breaker open, returning empty')
        return { pairs: [] }
      }
    )
  }
}

export const birdeyeData = new BirdeyeDataService();
