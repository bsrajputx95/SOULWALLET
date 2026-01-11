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
        total_pnl_usd: 0,
        total_realized_profit_usd: 0,
        total_unrealized_profit_usd: 0,
        roi_percentage: 0,
        total_trades: 0,
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
}

export const birdeyeData = new BirdeyeDataService();
