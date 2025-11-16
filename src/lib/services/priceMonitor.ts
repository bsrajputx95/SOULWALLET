import prisma from '../prisma';
import { logger } from '../logger';
import { jupiterSwap } from './jupiterSwap';
import { executionQueue } from './executionQueue';

interface PositionWithSettings {
  id: string;
  copyTradingId: string;
  tokenMint: string;
  tokenSymbol: string;
  entryPrice: number;
  entryAmount: number;
  entryValue: number;
  status: string;
  copyTrading: {
    id: string;
    userId: string;
    stopLoss: number | null;
    takeProfit: number | null;
    exitWithTrader: boolean;
  };
}

export class PriceMonitor {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 5000; // Check every 5 seconds
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheExpiryMs = 4000; // Cache prices for 4 seconds

  /**
   * Start the price monitoring service
   */
  async start() {
    if (this.isRunning) {
      logger.info('Price monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting price monitor...');

    // Start monitoring loop
    this.interval = setInterval(() => {
      this.checkAllPositions().catch(error => {
        logger.error('Error in price monitor loop:', error);
      });
    }, this.checkIntervalMs);

    // Run initial check
    await this.checkAllPositions();
  }

  /**
   * Stop the price monitoring service
   */
  stop() {
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    logger.info('Price monitor stopped');
  }

  /**
   * Check all open positions for SL/TP conditions
   */
  private async checkAllPositions() {
    try {
      // Get all open positions with copy trading settings
      const positions = await prisma.position.findMany({
        where: { status: 'OPEN' },
        include: {
          copyTrading: {
            select: {
              id: true,
              userId: true,
              stopLoss: true,
              takeProfit: true,
              exitWithTrader: true,
            },
          },
        },
      }) as PositionWithSettings[];

      if (positions.length === 0) {
        return;
      }

      logger.info(`Checking ${positions.length} open positions...`);

      // Get unique token mints
      const uniqueMints = [...new Set(positions.map(p => p.tokenMint))];
      
      // Fetch current prices
      const prices = await this.fetchPricesWithCache(uniqueMints);

      // Check each position
      const triggeredPositions: { position: PositionWithSettings; reason: string }[] = [];

      for (const position of positions) {
        const currentPrice = prices[position.tokenMint];
        
        if (!currentPrice || currentPrice === 0) {
          logger.warn(`No price found for token ${position.tokenMint}`);
          continue;
        }

        const triggered = await this.checkPosition(position, currentPrice);
        if (triggered) {
          triggeredPositions.push(triggered);
        }
      }

      // Process triggered positions
      for (const { position, reason } of triggeredPositions) {
        await this.triggerSell(position, reason);
      }

      if (triggeredPositions.length > 0) {
        logger.info(`Triggered ${triggeredPositions.length} sell orders`);
      }
    } catch (error) {
      logger.error('Error checking positions:', error);
    }
  }

  /**
   * Check a single position for SL/TP conditions
   */
  private async checkPosition(
    position: PositionWithSettings,
    currentPrice: number
  ): Promise<{ position: PositionWithSettings; reason: string } | null> {
    try {
      // Calculate current P&L percentage
      const plPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      
      const { stopLoss, takeProfit } = position.copyTrading;

      // Log position status periodically (every 10th check)
      if (Math.random() < 0.1) {
        logger.debug(
          `Position ${position.id}: ${position.tokenSymbol} - Entry: $${position.entryPrice.toFixed(6)}, ` +
          `Current: $${currentPrice.toFixed(6)}, P&L: ${plPercent.toFixed(2)}%`
        );
      }

      // Check Stop Loss
      if (stopLoss !== null && plPercent <= stopLoss) {
        logger.info(
          `🔴 Stop Loss triggered for position ${position.id}: ` +
          `${position.tokenSymbol} at ${plPercent.toFixed(2)}% (SL: ${stopLoss}%)`
        );
        return { position, reason: 'STOP_LOSS' };
      }

      // Check Take Profit
      if (takeProfit !== null && plPercent >= takeProfit) {
        logger.info(
          `🟢 Take Profit triggered for position ${position.id}: ` +
          `${position.tokenSymbol} at ${plPercent.toFixed(2)}% (TP: ${takeProfit}%)`
        );
        return { position, reason: 'TAKE_PROFIT' };
      }

      // Update token price cache in database (every minute)
      await this.updatePriceCache(position.tokenMint, position.tokenSymbol, currentPrice);

      return null;
    } catch (error) {
      logger.error(`Error checking position ${position.id}:`, error);
      return null;
    }
  }

  /**
   * Trigger a sell order for a position
   */
  private async triggerSell(position: PositionWithSettings, reason: string) {
    try {
      // Add to execution queue with medium priority
      await executionQueue.addSellOrder({
        userId: position.copyTrading.userId,
        copyTradingId: position.copyTradingId,
        positionId: position.id,
        tokenMint: position.tokenMint,
        amount: position.entryAmount,
        reason: reason as any,
        priority: 5, // Medium priority for SL/TP
      });

      logger.info(`Sell order queued for position ${position.id}: ${reason}`);
    } catch (error) {
      logger.error(`Failed to trigger sell for position ${position.id}:`, error);
    }
  }

  /**
   * Fetch prices with caching
   */
  private async fetchPricesWithCache(tokenMints: string[]): Promise<Record<string, number>> {
    const now = Date.now();
    const prices: Record<string, number> = {};
    const mintsToFetch: string[] = [];

    // Check cache first
    for (const mint of tokenMints) {
      const cached = this.priceCache.get(mint);
      if (cached && (now - cached.timestamp) < this.cacheExpiryMs) {
        prices[mint] = cached.price;
      } else {
        mintsToFetch.push(mint);
      }
    }

    // Fetch missing prices
    if (mintsToFetch.length > 0) {
      const fetchedPrices = await jupiterSwap.getPrices(mintsToFetch);
      
      for (const mint of mintsToFetch) {
        const price = fetchedPrices[mint] || 0;
        prices[mint] = price;
        
        // Update cache
        if (price > 0) {
          this.priceCache.set(mint, { price, timestamp: now });
        }
      }
    }

    return prices;
  }

  /**
   * Update price cache in database
   */
  private async updatePriceCache(tokenMint: string, tokenSymbol: string, price: number) {
    try {
      // Only update once per minute
      const existing = await prisma.tokenPrice.findUnique({
        where: { tokenMint },
      });

      const now = new Date();
      if (existing && (now.getTime() - existing.updatedAt.getTime()) < 60000) {
        return;
      }

      await prisma.tokenPrice.upsert({
        where: { tokenMint },
        update: {
          priceUSD: price,
          updatedAt: now,
        },
        create: {
          tokenMint,
          tokenSymbol,
          priceUSD: price,
        },
      });
    } catch (error) {
      // Ignore cache update errors
    }
  }

  /**
   * Handle trader sell events
   */
  async handleTraderSell(detectedTxId: string) {
    try {
      // Get the detected transaction
      const tx = await prisma.detectedTransaction.findUnique({
        where: { id: detectedTxId },
        include: {
          monitoredWallet: {
            include: {
              trader: true,
            },
          },
        },
      });

      if (!tx || tx.type !== 'SELL') {
        return;
      }

      // Find all positions that should exit with trader
      const positions = await prisma.position.findMany({
        where: {
          tokenMint: tx.tokenMint,
          status: 'OPEN',
          copyTrading: {
            trader: {
              walletAddress: tx.monitoredWallet.walletAddress,
            },
            exitWithTrader: true,
          },
        },
        include: {
          copyTrading: {
            select: {
              id: true,
              userId: true,
              exitWithTrader: true,
            },
          },
        },
      });

      logger.info(`Found ${positions.length} positions to exit with trader`);

      // Queue sell orders for each position
      for (const position of positions) {
        await executionQueue.addSellOrder({
          userId: position.copyTrading.userId,
          copyTradingId: position.copyTradingId,
          positionId: position.id,
          tokenMint: position.tokenMint,
          amount: position.entryAmount,
          reason: 'TRADER_SOLD',
          priority: 3, // Lower priority than SL/TP
        });
      }
    } catch (error) {
      logger.error('Error handling trader sell:', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  async getStats() {
    const [openPositions, totalPositions, avgPlPercent] = await Promise.all([
      prisma.position.count({ where: { status: 'OPEN' } }),
      prisma.position.count(),
      prisma.position.aggregate({
        where: { status: 'CLOSED', profitLossPercent: { not: null } },
        _avg: { profitLossPercent: true },
      }),
    ]);

    return {
      openPositions,
      totalPositions,
      avgPlPercent: avgPlPercent._avg.profitLossPercent || 0,
      cacheSize: this.priceCache.size,
      isRunning: this.isRunning,
    };
  }
}

// Export singleton instance
export const priceMonitor = new PriceMonitor();
