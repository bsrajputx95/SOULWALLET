/**
 * Birdeye Data Service
 * Integration with Birdeye API for wallet analytics and PnL data
 */

import axios from 'axios'
import NodeCache from 'node-cache'
import { logger } from '../logger'
import { BirdeyePnLSchema } from '../schemas/external-api'

class BirdeyeDataService {
  private cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache
  private baseUrl = 'https://public-api.birdeye.so';
  private apiKey = process.env.BIRDEYE_API_KEY || '';

  /**
   * Get wallet PnL data from Birdeye
   * @param walletAddress Solana wallet address
   * @returns Wallet PnL data including realized/unrealized profits
   */
  async getWalletPnL(walletAddress: string) {
    const cacheKey = `wallet_pnl:${walletAddress}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/v1/wallet/v2/pnl`, {
        params: {
          wallet: walletAddress,
        },
        headers: {
          'X-API-KEY': this.apiKey,
          'x-chain': 'solana',
          'accept': 'application/json',
        },
        timeout: 10000,
      });

      const raw = response.data
      const parsed = BirdeyePnLSchema.safeParse(raw)
      if (!parsed.success) {
        logger.error('Invalid Birdeye PnL response', {
          walletAddress,
          error: parsed.error,
        })
        const fallback = this.getFallbackPnL()
        this.cache.set(cacheKey, fallback)
        return fallback
      }
      this.cache.set(cacheKey, parsed.data)
      return parsed.data
    } catch (error: any) {
      logger.error(`Birdeye getWalletPnL error for ${walletAddress}:`, error.message)
      return this.getFallbackPnL()
    }
  }

  /**
   * Get wallet token list from Birdeye
   * @param walletAddress Solana wallet address
   * @returns List of tokens held in wallet
   */
  async getWalletTokens(walletAddress: string) {
    const cacheKey = `wallet_tokens:${walletAddress}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/v1/wallet/token_list`, {
        params: {
          wallet: walletAddress,
        },
        headers: {
          'X-API-KEY': this.apiKey,
          'x-chain': 'solana',
          'accept': 'application/json',
        },
        timeout: 10000,
      });

      const data = response.data;
      this.cache.set(cacheKey, data);
      return data;
    } catch (error: any) {
      logger.error(`Birdeye getWalletTokens error for ${walletAddress}:`, error.message);
      return { data: { items: [] } };
    }
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
      this.cache.del(`wallet_pnl:${walletAddress}`);
      this.cache.del(`wallet_tokens:${walletAddress}`);
    } else {
      this.cache.flushAll();
    }
  }
}

export const birdeyeData = new BirdeyeDataService();
