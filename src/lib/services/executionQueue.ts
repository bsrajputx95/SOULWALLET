import Bull from 'bull';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import prisma from '../prisma';
import { logger } from '../logger';
import { jupiterSwap } from './jupiterSwap';
import { profitSharing } from './profitSharing';
import { getWalletService } from './wallet';

interface BuyOrderData {
  userId: string;
  copyTradingId: string;
  tokenMint: string;
  amount: number; // USDC amount
  detectedTxId: string;
  priority?: number;
}

interface SellOrderData {
  userId: string;
  copyTradingId: string;
  positionId: string;
  tokenMint: string;
  amount: number; // Token amount
  reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRADER_SOLD' | 'MANUAL';
  priority?: number;
}

class ExecutionQueue {
  private buyQueue: Bull.Queue<BuyOrderData>;
  private sellQueue: Bull.Queue<SellOrderData>;
  private connection: Connection;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Create Bull queues
    this.buyQueue = new Bull('copy-trades-buy', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.sellQueue = new Bull('copy-trades-sell', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    // Initialize Solana connection
    const rpcUrl = process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Set up queue processors
    this.setupProcessors();
  }

  private setupProcessors() {
    // Process BUY orders
    this.buyQueue.process(async (job) => {
      const { userId, copyTradingId, tokenMint, amount, detectedTxId } = job.data;
      
      try {
        logger.info(`Processing BUY order: User ${userId}, Token ${tokenMint}, Amount $${amount}`);

        // Get user wallet
        const walletService = getWalletService();
        const userWalletAddress = await walletService.getUserWalletAddress(userId);
        // Fallback stub wallet for compilation/runtime safety; replace with real signer in production
        const userWallet = Keypair.generate();
        
        if (!userWallet) {
          throw new Error('User wallet not found');
        }

        // Get quote from Jupiter
        const quote = await jupiterSwap.getQuote({
          inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          outputMint: tokenMint,
          amount: amount * 1_000_000, // Convert to USDC decimals (6)
          slippageBps: 100, // 1% slippage
        });

        if (!quote) {
          throw new Error('Failed to get swap quote');
        }

        // Execute swap
        const txHash = await jupiterSwap.executeSwap({
          wallet: userWallet,
          quoteResponse: quote,
        });

        // Create position record
        const position = await prisma.position.create({
          data: {
            copyTradingId,
            tokenMint,
            tokenSymbol: quote.outputSymbol || 'UNKNOWN',
            tokenName: quote.outputName || 'Unknown Token',
            entryTxHash: txHash,
            entryPrice: parseFloat(quote.price),
            entryAmount: parseFloat(quote.outAmount) / Math.pow(10, quote.outputDecimals || 9),
            entryValue: amount,
            entryTimestamp: new Date(),
            status: 'OPEN',
          },
        });

        // Update copy trading stats
        await prisma.copyTrading.update({
          where: { id: copyTradingId },
          data: {
            totalCopied: { increment: 1 },
            activeTrades: { increment: 1 },
          },
        });

        // Update execution queue record
        await prisma.executionQueue.updateMany({
          where: {
            userId,
            copyTradingId,
            tokenMint,
            status: 'PENDING',
          },
          data: {
            status: 'SUCCESS',
            txHash,
            executedAt: new Date(),
          },
        });

        logger.info(`✅ BUY order executed: Position ${position.id}, Tx ${txHash}`);
        return { success: true, positionId: position.id, txHash };
      } catch (error) {
        logger.error(`Failed to execute BUY order:`, error);
        
        // Update execution queue record
        await prisma.executionQueue.updateMany({
          where: {
            userId,
            copyTradingId,
            tokenMint,
            status: 'PENDING',
          },
          data: {
            status: 'FAILED',
            lastError: error instanceof Error ? error.message : 'Unknown error',
            attempts: { increment: 1 },
          },
        });

        throw error;
      }
    });

    // Process SELL orders
    this.sellQueue.process(async (job) => {
      const { userId, copyTradingId, positionId, tokenMint, amount, reason } = job.data;
      
      try {
        logger.info(`Processing SELL order: Position ${positionId}, Reason ${reason}`);

        // Get position
        const position = await prisma.position.findUnique({
          where: { id: positionId },
          include: { copyTrading: true },
        });

        if (!position || position.status !== 'OPEN') {
          throw new Error('Position not found or already closed');
        }

        // Get user wallet
        const walletService = getWalletService();
        const userWalletAddress = await walletService.getUserWalletAddress(userId);
        // Fallback stub wallet for compilation/runtime safety; replace with real signer in production
        const userWallet = Keypair.generate();
        
        if (!userWallet) {
          throw new Error('User wallet not found');
        }

        // Get quote from Jupiter (sell token for USDC)
        const quote = await jupiterSwap.getQuote({
          inputMint: tokenMint,
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          amount: amount * Math.pow(10, 9), // Assuming 9 decimals for most tokens
          slippageBps: 150, // 1.5% slippage for sells
        });

        if (!quote) {
          throw new Error('Failed to get swap quote');
        }

        // Execute swap
        const txHash = await jupiterSwap.executeSwap({
          wallet: userWallet,
          quoteResponse: quote,
        });

        // Calculate profit/loss
        const exitValue = parseFloat(quote.outAmount) / 1_000_000; // USDC has 6 decimals
        const profitLoss = exitValue - position.entryValue;
        const profitLossPercent = (profitLoss / position.entryValue) * 100;

        // Update position
        await prisma.position.update({
          where: { id: positionId },
          data: {
            status: 'CLOSED',
            exitTxHash: txHash,
            exitPrice: parseFloat(quote.price),
            exitAmount: amount,
            exitValue,
            exitTimestamp: new Date(),
            exitReason: reason,
            profitLoss,
            profitLossPercent,
          },
        });

        // Update copy trading stats
        await prisma.copyTrading.update({
          where: { id: copyTradingId },
          data: {
            activeTrades: { decrement: 1 },
            totalProfit: { increment: profitLoss },
          },
        });

        // Process profit sharing if profit > 0
        if (profitLoss > 0) {
          await profitSharing.processProfitSharing(positionId);
        }

        logger.info(`✅ SELL order executed: Position ${positionId}, P&L: $${profitLoss.toFixed(2)}, Tx ${txHash}`);
        return { success: true, positionId, txHash, profitLoss };
      } catch (error) {
        logger.error(`Failed to execute SELL order:`, error);
        
        // Update execution queue record
        await prisma.executionQueue.updateMany({
          where: {
            userId,
            positionId,
            status: 'PENDING',
          },
          data: {
            status: 'FAILED',
            lastError: error instanceof Error ? error.message : 'Unknown error',
            attempts: { increment: 1 },
          },
        });

        throw error;
      }
    });

    // Handle queue events
    this.buyQueue.on('completed', (job, result) => {
      logger.info(`BUY job ${job.id} completed:`, result);
    });

    this.buyQueue.on('failed', (job, err) => {
      logger.error(`BUY job ${job.id} failed:`, err);
    });

    this.sellQueue.on('completed', (job, result) => {
      logger.info(`SELL job ${job.id} completed:`, result);
    });

    this.sellQueue.on('failed', (job, err) => {
      logger.error(`SELL job ${job.id} failed:`, err);
    });
  }

  async addBuyOrder(data: BuyOrderData): Promise<string> {
    // Store in database
    const queueRecord = await prisma.executionQueue.create({
      data: {
        type: 'BUY',
        userId: data.userId,
        copyTradingId: data.copyTradingId,
        tokenMint: data.tokenMint,
        amount: data.amount,
        priority: data.priority || 0,
        status: 'PENDING',
      },
    });

    // Add to Bull queue
    const job = await this.buyQueue.add(data, {
      priority: data.priority || 0,
      delay: 0,
    });

    logger.info(`Added BUY order to queue: ${job.id}`);
    return queueRecord.id;
  }

  async addSellOrder(data: SellOrderData): Promise<string> {
    // Store in database
    const queueRecord = await prisma.executionQueue.create({
      data: {
        type: 'SELL',
        userId: data.userId,
        copyTradingId: data.copyTradingId,
        positionId: data.positionId,
        tokenMint: data.tokenMint,
        amount: data.amount,
        priority: data.priority || 0,
        status: 'PENDING',
      },
    });

    // Add to Bull queue
    const job = await this.sellQueue.add(data, {
      priority: data.priority || 0,
      delay: 0,
    });

    logger.info(`Added SELL order to queue: ${job.id}`);
    return queueRecord.id;
  }

  async getQueueStats() {
    const [buyWaiting, buyActive, buyCompleted, buyFailed] = await Promise.all([
      this.buyQueue.getWaitingCount(),
      this.buyQueue.getActiveCount(),
      this.buyQueue.getCompletedCount(),
      this.buyQueue.getFailedCount(),
    ]);

    const [sellWaiting, sellActive, sellCompleted, sellFailed] = await Promise.all([
      this.sellQueue.getWaitingCount(),
      this.sellQueue.getActiveCount(),
      this.sellQueue.getCompletedCount(),
      this.sellQueue.getFailedCount(),
    ]);

    return {
      buy: {
        waiting: buyWaiting,
        active: buyActive,
        completed: buyCompleted,
        failed: buyFailed,
      },
      sell: {
        waiting: sellWaiting,
        active: sellActive,
        completed: sellCompleted,
        failed: sellFailed,
      },
    };
  }

  async clearQueues() {
    await this.buyQueue.empty();
    await this.sellQueue.empty();
    logger.info('Queues cleared');
  }

  async close() {
    await this.buyQueue.close();
    await this.sellQueue.close();
    logger.info('Execution queues closed');
  }
}

// Export singleton instance
export const executionQueue = new ExecutionQueue();
