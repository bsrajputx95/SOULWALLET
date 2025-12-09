import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
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
  slTpTriggeredAt: Date | null;
  copyTrading: {
    id: string;
    userId: string;
    stopLoss: number | null;
    takeProfit: number | null;
    exitWithTrader: boolean;
  };
}

// Lock timeout in milliseconds - positions locked longer than this are considered stale
const POSITION_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class PriceMonitor {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 5000; // Check every 5 seconds
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheExpiryMs = 4000; // Cache prices for 4 seconds
  private connection: Connection;

  constructor() {
    const rpcUrl = process.env.HELIUS_RPC_URL ||
      `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

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
      const now = new Date();
      const lockTimeout = new Date(now.getTime() - POSITION_LOCK_TIMEOUT_MS);

      // Get all open positions that are not currently locked (or lock has expired)
      const positions = await prisma.position.findMany({
        where: {
          status: 'OPEN',
          OR: [
            { slTpTriggeredAt: null },
            { slTpTriggeredAt: { lt: lockTimeout } }, // Lock expired, retry
          ],
        },
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
   * Acquire a lock on a position for SL/TP processing
   * Returns true if lock was acquired, false if position is already locked
   */
  private async acquirePositionLock(positionId: string): Promise<boolean> {
    try {
      const now = new Date();
      const lockTimeout = new Date(now.getTime() - POSITION_LOCK_TIMEOUT_MS);

      // Atomic update - only succeeds if position is not locked or lock expired
      const result = await prisma.position.updateMany({
        where: {
          id: positionId,
          status: 'OPEN',
          OR: [
            { slTpTriggeredAt: null },
            { slTpTriggeredAt: { lt: lockTimeout } },
          ],
        },
        data: {
          slTpTriggeredAt: now,
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.error(`Failed to acquire lock for position ${positionId}:`, error);
      return false;
    }
  }

  /**
   * Release a position lock (used when SL/TP check doesn't trigger)
   */
  private async releasePositionLock(positionId: string): Promise<void> {
    try {
      await prisma.position.update({
        where: { id: positionId },
        data: { slTpTriggeredAt: null },
      });
    } catch (error) {
      // Ignore errors - lock will expire naturally
      logger.debug(`Failed to release lock for position ${positionId}:`, error);
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
      // Skip if position is already locked (being processed)
      if (position.slTpTriggeredAt) {
        const lockAge = Date.now() - position.slTpTriggeredAt.getTime();
        if (lockAge < POSITION_LOCK_TIMEOUT_MS) {
          logger.debug(`Position ${position.id} is locked, skipping`);
          return null;
        }
        // Lock expired, will be retried
        logger.warn(`Position ${position.id} lock expired after ${lockAge}ms, retrying`);
      }

      // Calculate current P&L percentage using entry VALUE (accounts for fees/slippage)
      const currentValue = position.entryAmount * currentPrice;
      const plPercent = ((currentValue - position.entryValue) / position.entryValue) * 100;

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
        // Try to acquire lock before triggering
        const locked = await this.acquirePositionLock(position.id);
        if (!locked) {
          logger.debug(`Could not acquire lock for position ${position.id}, skipping SL trigger`);
          return null;
        }

        logger.info(
          `🔴 Stop Loss triggered for position ${position.id}: ` +
          `${position.tokenSymbol} at ${plPercent.toFixed(2)}% (SL: ${stopLoss}%)`
        );
        return { position, reason: 'STOP_LOSS' };
      }

      // Check Take Profit
      if (takeProfit !== null && plPercent >= takeProfit) {
        // Try to acquire lock before triggering
        const locked = await this.acquirePositionLock(position.id);
        if (!locked) {
          logger.debug(`Could not acquire lock for position ${position.id}, skipping TP trigger`);
          return null;
        }

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
   * Handle trader sell events with proportional sell support
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

      const lockTimeout = new Date(Date.now() - POSITION_LOCK_TIMEOUT_MS);

      // Find all positions that should exit with trader (not already locked)
      const positions = await prisma.position.findMany({
        where: {
          tokenMint: tx.tokenMint,
          status: 'OPEN',
          OR: [
            { slTpTriggeredAt: null },
            { slTpTriggeredAt: { lt: lockTimeout } },
          ],
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

      // Calculate proportional sell percentage based on trader's current remaining balance
      const traderSellAmount = tx.amount;

      // Get trader's remaining balance of this token to determine if partial sell
      const traderRemainingBalance = await this.getTraderTokenBalance(
        tx.monitoredWallet.walletAddress,
        tx.tokenMint
      );

      // If trader has remaining balance, it's a partial sell
      // Total holding before sell = remaining + sold amount
      const totalHoldingBeforeSell = traderRemainingBalance + traderSellAmount;
      const isPartialSell = traderRemainingBalance > 0 && totalHoldingBeforeSell > 0;
      const sellPercentage = isPartialSell
        ? this.calculateSellPercentage(traderSellAmount, totalHoldingBeforeSell)
        : 1.0;

      logger.info(
        `Trader sell detected: ${isPartialSell ? 'Partial' : 'Full'} exit - ` +
        `${(sellPercentage * 100).toFixed(1)}% of position`
      );

      // Queue sell orders for each position (with locking)
      for (const position of positions) {
        // Acquire lock to prevent duplicate sells
        const locked = await this.acquirePositionLock(position.id);
        if (!locked) {
          logger.debug(`Could not acquire lock for position ${position.id}, skipping trader exit`);
          continue;
        }

        // Calculate proportional sell amount
        const sellAmount = position.entryAmount * sellPercentage;

        // Only sell if amount is meaningful (> 0.001% of position)
        if (sellAmount < position.entryAmount * 0.00001) {
          logger.debug(`Sell amount too small for position ${position.id}, releasing lock`);
          await this.releasePositionLock(position.id);
          continue;
        }

        await executionQueue.addSellOrder({
          userId: position.copyTrading.userId,
          copyTradingId: position.copyTradingId,
          positionId: position.id,
          tokenMint: position.tokenMint,
          amount: sellAmount,
          reason: 'TRADER_SOLD',
          priority: 3, // Lower priority than SL/TP
        });

        logger.info(
          `Queued ${sellPercentage === 1.0 ? 'full' : `${(sellPercentage * 100).toFixed(1)}%`} ` +
          `sell for position ${position.id}: ${sellAmount} tokens`
        );
      }
    } catch (error) {
      logger.error('Error handling trader sell:', error);
    }
  }

  /**
   * Calculate the sell percentage based on trader's sell amount vs total holding
   */
  private calculateSellPercentage(sellAmount: number, totalHolding: number): number {
    if (totalHolding <= 0) return 1.0; // Full sell if we can't determine holding
    const percentage = sellAmount / totalHolding;
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, percentage));
  }

  /**
   * Get trader's current token balance from on-chain data
   * Used to determine if a sell is partial or full exit
   */
  private async getTraderTokenBalance(
    walletAddress: string,
    tokenMint: string
  ): Promise<number> {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(tokenMint);

      const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
      const account = await getAccount(this.connection, ata);

      // Assume 9 decimals for most SPL tokens, adjust if needed
      const decimals = 9;
      return Number(account.amount) / Math.pow(10, decimals);
    } catch (error) {
      // Token account may not exist (trader sold everything)
      // This is expected behavior, return 0
      logger.debug(`Could not fetch token balance for ${walletAddress}: ${error}`);
      return 0;
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
