import axios from 'axios';
import NodeCache from 'node-cache';
import { z } from 'zod';

class MarketDataService {
  private cache = new NodeCache({ stdTTL: 30 }); // 30 seconds default TTL
  private base = 'https://api.dexscreener.com/latest';
  private failureCount = 0;
  private static MAX_FAILURES = 3;

  private DexPairsSchema = z.object({ pairs: z.array(z.any()).optional() });
  private DexTokenSchema = z.object({ baseToken: z.object({ address: z.string().optional(), symbol: z.string().optional(), name: z.string().optional() }).optional(), priceUsd: z.string().optional() }).partial();
  private DexPairSchema = z.object({ baseToken: z.object({ address: z.string().optional(), symbol: z.string().optional(), name: z.string().optional() }).optional(), pairAddress: z.string().optional(), chainId: z.string().optional(), priceUsd: z.string().optional() }).partial();

  async getToken(address: string) {
    const key = `token:${address}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const { data } = await axios.get(`${this.base}/dex/tokens/${address}`)
    const validated = this.DexTokenSchema.safeParse(data)
    const result = validated.success ? data : { baseToken: { address }, priceUsd: '0' }
    this.cache.set(key, result)
    return result
  }

  async search(q: string) {
    const key = `search:${q}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const { data } = await axios.get(`${this.base}/dex/search`, { params: { q } });
    const validated = this.DexPairsSchema.safeParse(data);
    const result = validated.success ? data : { pairs: [] };
    this.cache.set(key, result);
    return result;
  }

  async getPair(chain: string, pairAddress: string) {
    const key = `pair:${chain}:${pairAddress}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const { data } = await axios.get(`${this.base}/dex/pairs/${chain}/${pairAddress}`)
    const validated = this.DexPairSchema.safeParse(data)
    const result = validated.success ? data : { baseToken: {}, pairAddress, chainId: chain, priceUsd: '0' }
    this.cache.set(key, result)
    return result
  }

  /**
   * Get SoulMarket curated tokens with quality filters
   * Filters: Liquidity 100k+, Pair age 4h+, Volume, Transactions
   */
  async getSoulMarket() {
    const key = 'soulmarket';
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      // Search for popular Solana ecosystem tokens + broader market
      const searchTerms = [
        'SOL', 'BONK', 'WIF', 'JUP', 'PYTH', 'JTO', 'RNDR', 'RAY',
        'ORCA', 'STEP', 'SAMO', 'FIDA', 'MNGO', 'COPE'
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

      // Apply quality filters
      const filteredPairs = allPairs.filter((pair: any) => {
        // Filter 1: Minimum liquidity $100,000
        const liquidity = parseFloat(pair.liquidity?.usd || '0');
        if (liquidity < 100000) return false;

        // Filter 2: Minimum pair age 4 hours
        const pairCreatedAt = pair.pairCreatedAt;
        if (pairCreatedAt) {
          const pairAge = now - pairCreatedAt;
          if (pairAge < MIN_PAIR_AGE_MS) return false;
        }

        // Filter 3: Minimum 24h volume $10,000
        const volume24h = parseFloat(pair.volume?.h24 || '0');
        if (volume24h < 10000) return false;

        // Filter 4: Minimum 24h transactions (50+)
        const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
        if (txns24h < 50) return false;

        // Filter 5: Must have valid price
        const price = parseFloat(pair.priceUsd || '0');
        if (price <= 0) return false;

        // Filter 6: Solana chain only
        if (pair.chainId !== 'solana') return false;

        // Filter 7: Minimum FDV $50k (if available)
        if (pair.fdv && parseFloat(pair.fdv) < 50000) return false;

        return true;
      });

      // Sort by liquidity (descending) for quality
      const sortedByLiquidity = filteredPairs.sort((a: any, b: any) => {
        const liquidityA = parseFloat(a.liquidity?.usd || '0');
        const liquidityB = parseFloat(b.liquidity?.usd || '0');
        return liquidityB - liquidityA;
      });

      // Remove duplicates based on base token address
      const uniquePairs = sortedByLiquidity.filter((pair: any, index: number, self: any[]) =>
        index === self.findIndex((p: any) => p.baseToken?.address === pair.baseToken?.address)
      );

      const soulMarket = { pairs: uniquePairs.slice(0, 50) };
      this.cache.set(key, soulMarket, 300);
      return soulMarket;
    } catch (error) {
      this.failureCount += 1;
      if (this.failureCount >= MarketDataService.MAX_FAILURES) {
        this.failureCount = 0;
        const fallback = this.cache.get('soulmarket');
        if (fallback) return fallback as any;
      }
      return { pairs: [] };
    }
  }

  async trending() {
    const key = 'trending';
    const cached = this.cache.get(key);
    if (cached) return cached;

    // Stablecoins to exclude
    const STABLECOIN_SYMBOLS = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX', 'LUSD', 'GUSD', 'PAX', 'PYUSD', 'USDD'];
    const STABLECOIN_ADDRESSES = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD', // BRZ
    ];

    try {
      // Search for popular trending Solana meme/utility tokens (NO stablecoins)
      const trendingTokens = ['BONK', 'WIF', 'POPCAT', 'JUP', 'PYTH', 'JTO', 'RNDR', 'RAY', 'ORCA', 'PENGU', 'AI16Z', 'GOAT', 'FARTCOIN'];

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

      // Apply quality filters
      const filteredPairs = allPairs.filter((pair: any) => {
        // Must be Solana chain
        if (pair.chainId !== 'solana') return false;

        // Filter out stablecoins by symbol
        const symbol = pair.baseToken?.symbol?.toUpperCase() || '';
        if (STABLECOIN_SYMBOLS.includes(symbol)) return false;

        // Filter out stablecoins by address
        const address = pair.baseToken?.address || '';
        if (STABLECOIN_ADDRESSES.includes(address)) return false;

        // Minimum liquidity $50,000
        const liquidity = parseFloat(pair.liquidity?.usd || '0');
        if (liquidity < 50000) return false;

        // Minimum 24h volume $25,000
        const volume24h = parseFloat(pair.volume?.h24 || '0');
        if (volume24h < 25000) return false;

        // Must have valid price
        const price = parseFloat(pair.priceUsd || '0');
        if (price <= 0) return false;

        return true;
      });

      // Sort by absolute price change (most volatile = trending)
      const sortedByTrending = filteredPairs.sort((a: any, b: any) => {
        const changeA = Math.abs(parseFloat(a.priceChange?.h24 || '0'));
        const changeB = Math.abs(parseFloat(b.priceChange?.h24 || '0'));
        return changeB - changeA;
      });

      // Remove duplicates based on base token address
      const uniquePairs = sortedByTrending.filter((pair: any, index: number, self: any[]) =>
        index === self.findIndex((p: any) => p.baseToken?.address === pair.baseToken?.address)
      );

      const trending = { pairs: uniquePairs.slice(0, 20) };
      this.cache.set(key, trending, 120); // Cache for 2 minutes for fresher data
      return trending;
    } catch (error) {
      // Fallback to simple solana search
      return this.search('solana');
    }
  }

  /**
   * Get OHLCV (price history) data for a token pair
   * Uses DexScreener's undocumented chart API
   */
  async getOHLCV(pairAddress: string, timeframe: '5m' | '15m' | '1h' | '4h' | '1d' = '1h') {
    const key = `ohlcv:${pairAddress}:${timeframe}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
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

      // DexScreener chart API
      const url = `https://io.dexscreener.com/dex/chart/amm/v3/solana/${pairAddress}?res=${resolution}&cb=${Math.floor(now / 60)}`;

      const { data } = await axios.get(url, {
        timeout: 10000,
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
      this.cache.set(key, ohlcv, 60);
      return ohlcv;
    } catch (error) {
      console.error('OHLCV fetch error:', error);
      // Return empty array on error
      return [];
    }
  }
}

export const marketData = new MarketDataService();
