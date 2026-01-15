import Bull from 'bull';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import prisma from '../prisma';
import { logger } from '../logger';
import { jupiterSwap } from './jupiterSwap';
import { profitSharing } from './profitSharing';
import { custodialWalletService } from './custodialWallet';
import { rpcManager } from './rpcManager';
import { MAX_SLIPPAGE_BPS, MAX_SLIPPAGE_PERCENT } from '../validation';
import { auditLogService } from './auditLog'
import { LockService } from './lockService'
import { priceMonitor } from './priceMonitor'
import { jitoService } from './jitoService'
import { redisCache, type CacheKey } from '../redis'
import { transactionSecurityMiddleware } from './transactionSecurityMiddleware'

// USDC mint address on Solana mainnet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_DECIMALS = 6;

// Jito MEV protection threshold - use for trades > $100
const JITO_HIGH_VALUE_THRESHOLD = 100;

// Priority levels for queue processing (lower = higher priority)
// Bull uses priority where 1 is highest, 10+ is lowest
export const PRIORITY = {
  FEATURED_TRADER: 1,  // Featured/VIP traders get highest priority
  STANDARD: 3,         // Normal copy trades
  MANUAL: 5,           // User-initiated manual actions
  LOW: 10,             // Background/non-urgent tasks
} as const;

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

type TransactionProcessingData =
  | {
    kind: 'USER_WALLET'
    userId: string
    walletAddress: string
    signature: string
    blockTime: number | null
  }
  | {
    kind: 'TRADER_HELIUS'
    tx: any
  }

interface ProfitSharingJobData {
  positionId: string
  userId: string
  profitLoss: number
  traderId: string
}

// iBuy order data for priority queue processing
export interface IBuyOrderData {
  userId: string;
  postId: string;
  tokenMint: string;
  inputMint: string;
  amountUsd: number;
  slippageBps: number;
}

// iBuy job result for status tracking
export interface IBuyJobResult {
  success: boolean;
  purchaseId?: string;
  signature?: string;
  tokensReceived?: number;
  amountUsd?: number;
  error?: string;
}

class ExecutionQueue {
  private buyQueue: Bull.Queue<BuyOrderData>;
  private sellQueue: Bull.Queue<SellOrderData>;
  private transactionQueue: Bull.Queue<TransactionProcessingData>;
  private profitSharingQueue: Bull.Queue<ProfitSharingJobData>;
  private ibuyQueue: Bull.Queue<IBuyOrderData>;

  private async writeDlqItem(
    dlqKey: string,
    job: Bull.Job,
    err: Error
  ): Promise<void> {
    const client: any = (job.queue as any)?.client
    if (!client) return

    const item = {
      queue: job.queue.name,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts?.attempts ?? 1,
      failedReason: job.failedReason ?? undefined,
      error: err.message,
      data: job.data,
      timestamp: new Date().toISOString(),
    }

    try {
      await client.lpush(dlqKey, JSON.stringify(item))
      await client.ltrim(dlqKey, 0, 999)
      await client.expire(dlqKey, 60 * 60 * 24 * 7)
    } catch (dlqError) {
      logger.error('Failed to write DLQ item', { dlqKey, error: dlqError instanceof Error ? dlqError.message : String(dlqError) })
    }
  }

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.buyQueue = new Bull('copy-trades-buy', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.sellQueue = new Bull('copy-trades-sell', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.transactionQueue = new Bull('transaction-processing', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    })

    this.profitSharingQueue = new Bull('profit-sharing', redisUrl, {
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    })

    // iBuy queue with high concurrency for fast execution
    this.ibuyQueue = new Bull('ibuy-orders', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });

    this.setupProcessors();
  }

  private async processUserWalletTransaction(job: Bull.Job<TransactionProcessingData>) {
    if (job.data.kind !== 'USER_WALLET') return { skipped: true }

    const { userId, walletAddress, signature, blockTime } = job.data
    const lockKey = `user-tx:${signature}`
    const locked = await LockService.acquireLock(lockKey, 30_000)
    if (!locked) return { skipped: true }

    try {
      const existingTx = await prisma.transaction.findUnique({ where: { signature } })
      if (existingTx) return { skipped: true }

      const tx = await rpcManager.withFailover((connection) =>
        connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 })
      )

      if (!tx) return { skipped: true }

      const message = tx.transaction.message
      let accountKeys: string[] = []

      if ('getAccountKeys' in message) {
        const keys = message.getAccountKeys()
        accountKeys = keys.staticAccountKeys.map((k) => k.toString())
      } else if ('accountKeys' in message) {
        accountKeys = (message as any).accountKeys.map((k: any) => k.toString())
      }

      const preBalances = tx.meta?.preBalances || []
      const postBalances = tx.meta?.postBalances || []

      const userAccountIndex = accountKeys.findIndex((key) => key === walletAddress)
      if (userAccountIndex === -1) return { skipped: true }

      const preBalance = preBalances[userAccountIndex] || 0
      const postBalance = postBalances[userAccountIndex] || 0
      const balanceChange = postBalance - preBalance

      const isReceive = balanceChange > 0
      const amount = Math.abs(balanceChange) / LAMPORTS_PER_SOL
      const fee = (tx.meta?.fee || 0) / LAMPORTS_PER_SOL

      let fromAddress = 'unknown'
      let toAddress = 'unknown'

      if (accountKeys.length >= 2) {
        if (isReceive) {
          fromAddress = accountKeys[0] || 'unknown'
          toAddress = walletAddress
        } else {
          fromAddress = walletAddress
          toAddress = accountKeys[1] || 'unknown'
        }
      }

      const created = await prisma.transaction.create({
        data: {
          userId,
          signature,
          type: isReceive ? 'RECEIVE' : 'SEND',
          amount,
          token: 'SOL',
          tokenSymbol: 'SOL',
          from: fromAddress,
          to: toAddress,
          status: tx.meta?.err ? 'FAILED' : 'CONFIRMED',
          fee,
          createdAt: new Date(blockTime ? blockTime * 1000 : Date.now()),
        },
      })

      await auditLogService.logFinancialOperation({
        userId,
        operation: isReceive ? 'RECEIVE' : 'SEND',
        resourceType: 'Transaction',
        resourceId: created.id,
        amount,
        currency: 'SOL',
        feeAmount: fee,
        metadata: {
          signature,
          status: tx.meta?.err ? 'FAILED' : 'CONFIRMED',
          from: fromAddress,
          to: toAddress,
        },
        ipAddress: 'system',
        userAgent: 'executionQueue',
      })



      return { success: true, transactionId: created.id }
    } finally {
      await LockService.releaseLock(lockKey)
    }
  }

  private async processTraderHeliusTransaction(job: Bull.Job<TransactionProcessingData>) {
    if (job.data.kind !== 'TRADER_HELIUS') return { skipped: true }

    const tx = job.data.tx as any
    if (!tx?.signature) return { skipped: true }

    const lockKey = `trader-tx:${tx.signature}`
    const locked = await LockService.acquireLock(lockKey, 60_000)
    if (!locked) return { skipped: true }

    try {
      const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
      const isJupiterSwap =
        tx.type === 'SWAP' ||
        (tx.accountData && tx.accountData.some((a: any) => a?.account === JUPITER_PROGRAM_ID))
      if (!isJupiterSwap) return { skipped: true }

      const tokenTransfers = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : []
      if (tokenTransfers.length === 0) return { skipped: true }

      const candidateWallets = Array.from(
        new Set(
          tokenTransfers
            .flatMap((t: any) => [t?.fromUserAccount, t?.toUserAccount])
            .filter((v: any) => typeof v === 'string' && v.length > 0)
        )
      )

      if (candidateWallets.length === 0) return { skipped: true }

      const monitoredWallet = await prisma.monitoredWallet.findFirst({
        where: { walletAddress: { in: candidateWallets }, isActive: true },
      })

      if (!monitoredWallet) return { skipped: true }

      const relevantTransfer = tokenTransfers.find(
        (t: any) =>
          t?.fromUserAccount === monitoredWallet.walletAddress || t?.toUserAccount === monitoredWallet.walletAddress
      )
      if (!relevantTransfer) return { skipped: true }

      const parsedType = relevantTransfer.toUserAccount === monitoredWallet.walletAddress ? 'BUY' : 'SELL'
      const tokenMint = typeof relevantTransfer.mint === 'string' ? relevantTransfer.mint : ''
      if (!tokenMint) return { skipped: true }

      const amount = typeof relevantTransfer.tokenAmount === 'number' ? relevantTransfer.tokenAmount : 0

      const detectedTx = await prisma.detectedTransaction.create({
        data: {
          monitoredWalletId: monitoredWallet.id,
          txHash: tx.signature,
          type: parsedType,
          tokenMint,
          tokenSymbol: null,
          amount,
          price: 0,
          totalValue: 0,
        },
      })

      await prisma.monitoredWallet.update({
        where: { id: monitoredWallet.id },
        data: {
          lastSeenTx: tx.signature,
          lastSeenAt: new Date(),
        },
      })

      const monitoredWalletWithCopiers = await prisma.monitoredWallet.findUnique({
        where: { id: monitoredWallet.id },
        include: {
          trader: {
            include: {
              copiers: {
                where: { isActive: true },
                include: { user: true },
              },
            },
          },
        },
      })

      if (!monitoredWalletWithCopiers?.trader) return { skipped: true }

      const copiers = monitoredWalletWithCopiers.trader.copiers
      let copiesCreated = 0

      for (const copyRelation of copiers) {
        try {
          const openPositionsAgg = await prisma.position.aggregate({
            where: { copyTradingId: copyRelation.id, status: 'OPEN' },
            _sum: { entryValue: true },
          })
          const usedBudget = openPositionsAgg._sum.entryValue || 0
          const availableBudget = copyRelation.totalBudget - usedBudget
          if (availableBudget < copyRelation.amountPerTrade) continue

          const openPositions = await prisma.position.count({
            where: { copyTradingId: copyRelation.id, status: 'OPEN' },
          })

          const maxPositions = 10
          if (openPositions >= maxPositions) continue

          if (parsedType === 'BUY') {
            await this.addBuyOrder({
              userId: copyRelation.userId,
              copyTradingId: copyRelation.id,
              tokenMint,
              amount: copyRelation.amountPerTrade,
              detectedTxId: detectedTx.id,
            })
            copiesCreated++
          }
        } catch (error) {
          logger.error(`Failed to create copy order for user ${copyRelation.userId}:`, error)
        }
      }

      if (parsedType === 'SELL') {
        await priceMonitor.handleTraderSell(detectedTx.id)
      }

      await prisma.detectedTransaction.update({
        where: { id: detectedTx.id },
        data: {
          processed: true,
          processedAt: new Date(),
          copiesCreated,
        },
      })

      return { success: true, detectedTxId: detectedTx.id, copiesCreated }
    } finally {
      await LockService.releaseLock(lockKey)
    }
  }

  private async processProfitSharing(job: Bull.Job<ProfitSharingJobData>) {
    const { positionId } = job.data
    const lockKey = `profit:${positionId}`
    const locked = await LockService.acquireLock(lockKey, 120_000)
    if (!locked) return { skipped: true }

    try {
      return await profitSharing.processProfitSharing(positionId)
    } finally {
      await LockService.releaseLock(lockKey)
    }
  }

  /**
   * Process iBuy order with Redis quote caching and Jito MEV protection
   */
  private async processIBuyOrder(job: Bull.Job<IBuyOrderData>): Promise<IBuyJobResult> {
    const { userId, postId, tokenMint, inputMint, amountUsd, slippageBps } = job.data
    const lockKey = `ibuy:${userId}:${postId}`
    const locked = await LockService.acquireLock(lockKey, 60_000)
    if (!locked) return { success: false, error: 'Could not acquire lock' }

    try {
      logger.info(`[iBuy Queue] Processing order: User ${userId}, Token ${tokenMint}, Amount ${amountUsd} USD`)

      // Get user's custodial wallet
      const userWallet = await custodialWalletService.getKeypair(userId)
      if (!userWallet) {
        throw new Error(`Custodial wallet not found for user ${userId}`)
      }

      // Get post for token info
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { mentionedTokenSymbol: true, mentionedTokenName: true },
      })

      const isSolInput = inputMint === SOL_MINT

      // Check balance before swap
      if (isSolInput) {
        const balance = await custodialWalletService.getBalance(userId)
        const requiredSol = amountUsd / 100 // Rough USD to SOL estimate
        if (balance < requiredSol) {
          throw new Error(`Insufficient SOL balance. Have: ${balance.toFixed(4)} SOL, Need: ~${requiredSol.toFixed(4)} SOL`)
        }
      } else {
        const usdcBalance = await custodialWalletService.getTokenBalance(userId, USDC_MINT)
        if (usdcBalance < amountUsd) {
          throw new Error(`Insufficient USDC balance. Have: ${usdcBalance.toFixed(2)} USDC, Need: ${amountUsd.toFixed(2)} USDC`)
        }
      }

      // Try to get cached quote first (10s TTL)
      const quoteCacheKey: CacheKey = `ibuy:quote:${tokenMint}:${inputMint}`
      let quote = await redisCache.get<any>(quoteCacheKey)

      if (!quote) {
        // Calculate input amount
        const amountIn = isSolInput
          ? Math.round(amountUsd * LAMPORTS_PER_SOL / 100) // Rough USD to SOL
          : Math.round(amountUsd * 1e6) // USDC has 6 decimals

        quote = await jupiterSwap.getQuote({
          inputMint,
          outputMint: tokenMint,
          amount: amountIn,
          slippageBps: Math.min(slippageBps, MAX_SLIPPAGE_BPS),
          asLegacyTransaction: false,
        })

        if (quote) {
          // Cache quote for 10 seconds
          await redisCache.set(quoteCacheKey, quote, 10)
        }
      }

      if (!quote) {
        throw new Error('Failed to get quote from Jupiter')
      }

      // Use Jito MEV protection for trades >= $50
      const useJitoMev = jitoService.isEnabled() && amountUsd >= 50

      logger.info(`[iBuy Queue] Executing swap: ${amountUsd} ${isSolInput ? 'SOL' : 'USDC'} → ${tokenMint.slice(0, 8)}... (Jito: ${useJitoMev})`)

      const signature = await jupiterSwap.executeSwap({
        wallet: userWallet,
        quoteResponse: quote,
        useMevProtection: useJitoMev,
        tradeValueUsd: amountUsd,
      })

      // Use actual output decimals from quote
      const outputDecimals = quote.outputDecimals ?? 9
      const tokensReceived = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals)

      // Record purchase in database
      const purchase = await prisma.iBuyPurchase.create({
        data: {
          userId,
          postId,
          tokenMint,
          tokenSymbol: post?.mentionedTokenSymbol || tokenMint.slice(0, 6),
          tokenName: post?.mentionedTokenName || 'Unknown Token',
          amountBought: tokensReceived,
          amountRemaining: tokensReceived,
          priceInUsdc: amountUsd,
          buyTxSig: signature,
        },
      })

      // Audit log
      await auditLogService.logFinancialOperation({
        userId,
        operation: 'IBUY_PURCHASE',
        resourceType: 'IBuyPurchase',
        resourceId: purchase.id,
        amount: amountUsd,
        currency: isSolInput ? 'SOL' : 'USDC',
        metadata: {
          postId,
          tokenMint,
          signature,
          tokensReceived,
          useJitoMev,
        },
        ipAddress: 'system',
        userAgent: 'executionQueue',
      })

      logger.info(`[iBuy Queue] ✅ Purchase recorded: ${purchase.id}, tx: ${signature.slice(0, 16)}...`)

      return {
        success: true,
        purchaseId: purchase.id,
        signature,
        tokensReceived,
        amountUsd,
      }
    } catch (error) {
      logger.error(`[iBuy Queue] Failed:`, error)
      throw error
    } finally {
      await LockService.releaseLock(lockKey)
    }
  }

  /**
   * Get token balance for a wallet
   */
  private async getTokenBalance(
    walletPubkey: PublicKey,
    tokenMint: string,
    decimals: number
  ): Promise<number> {
    try {
      const connection = await rpcManager.getConnection();
      const mintPubkey = new PublicKey(tokenMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
      const account = await getAccount(connection, ata);
      return Number(account.amount) / Math.pow(10, decimals);
    } catch {
      return 0;
    }
  }

  private setupProcessors() {
    // Process BUY orders with concurrency of 5 for faster copy trade execution
    void this.buyQueue.process(5, async (job) => {
      const { userId, copyTradingId, tokenMint, amount } = job.data;

      try {
        logger.info(`Processing BUY order: User ${userId}, Token ${tokenMint}, Amount ${amount} USDC`);

        // Get user's custodial wallet keypair - REAL WALLET
        const userWallet = await custodialWalletService.getKeypair(userId);
        if (!userWallet) {
          throw new Error(`Custodial wallet not found for user ${userId}. Set up copy trading wallet first.`);
        }

        // Get copy trading settings for slippage
        const copyTrading = await prisma.copyTrading.findUnique({
          where: { id: copyTradingId },
          select: { maxSlippage: true },
        });
        const slippagePercent = Math.min(copyTrading?.maxSlippage || 1, MAX_SLIPPAGE_PERCENT);
        const slippageBps = Math.min(Math.round(slippagePercent * 100), MAX_SLIPPAGE_BPS);



        const amountValidation = await custodialWalletService.validateCopyTradeExecutionAmount(amount, userId);
        if (!amountValidation.valid) {
          await prisma.executionQueue.updateMany({
            where: { userId, copyTradingId, tokenMint, status: 'PENDING' },
            data: { status: 'FAILED', lastError: amountValidation.error || 'Invalid amount', attempts: { increment: 1 } },
          });
          return { success: false, error: amountValidation.error || 'Invalid amount' };
        }

        // Verify sufficient USDC balance before swap
        const usdcBalance = await this.getTokenBalance(userWallet.publicKey, USDC_MINT, USDC_DECIMALS);
        if (usdcBalance < amount) {
          throw new Error(`Insufficient USDC. Required: ${amount}, Available: ${usdcBalance.toFixed(2)}`);
        }

        // Get quote from Jupiter with user's slippage
        const quote = await jupiterSwap.getQuote({
          inputMint: USDC_MINT,
          outputMint: tokenMint,
          amount: amount * Math.pow(10, USDC_DECIMALS),
          slippageBps,
        });
        if (!quote) throw new Error('Failed to get swap quote from Jupiter');

        const simulation = await jupiterSwap.simulateSwap({ wallet: userWallet, quoteResponse: quote });
        if (!simulation.ok) {
          await prisma.executionQueue.updateMany({
            where: { userId, copyTradingId, tokenMint, status: 'PENDING' },
            data: { status: 'FAILED', lastError: simulation.error || 'Simulation failed', attempts: { increment: 1 } },
          });
          return { success: false, error: simulation.error || 'Simulation failed' };
        }

        // Use Jito MEV protection for high-value trades
        const useJitoMev = jitoService.isEnabled() && amount >= JITO_HIGH_VALUE_THRESHOLD;

        if (useJitoMev) {
          logger.info(`[Jito] MEV protection enabled for high-value BUY: $${amount}`);
        }

        // Execute swap directly with MEV protection
        const txHash = await jupiterSwap.executeSwap({
          wallet: userWallet,
          quoteResponse: quote,
          useMevProtection: useJitoMev,
          tradeValueUsd: amount,
        });

        // Create position record
        const position = await prisma.position.create({
          data: {
            copyTradingId,
            tokenMint,
            tokenSymbol: quote.outputSymbol || 'UNKNOWN',
            tokenName: quote.outputName || 'Unknown Token',
            entryTxHash: txHash,
            entryPrice: parseFloat(quote.price!),
            entryAmount: parseFloat(quote.outAmount) / Math.pow(10, quote.outputDecimals || 9),
            entryValue: amount,
            entryTimestamp: new Date(),
            status: 'OPEN',
          },
        });

        await auditLogService.logFinancialOperation({
          userId,
          operation: 'COPY_TRADE_BUY_EXECUTED',
          resourceType: 'Position',
          resourceId: position.id,
          amount,
          currency: 'USDC',
          metadata: {
            copyTradingId,
            tokenMint,
            txHash,
            detectedTxId: job.data.detectedTxId,
          },
          ipAddress: 'system',
          userAgent: 'executionQueue',
        })



        // Update stats
        await prisma.copyTrading.update({
          where: { id: copyTradingId },
          data: { totalCopied: { increment: 1 }, activeTrades: { increment: 1 } },
        });

        await prisma.executionQueue.updateMany({
          where: { userId, copyTradingId, tokenMint, status: 'PENDING' },
          data: { status: 'SUCCESS', txHash, executedAt: new Date() },
        });

        logger.info(`✅ BUY executed: Position ${position.id}, Tx ${txHash}`);
        return { success: true, positionId: position.id, txHash };
      } catch (error) {
        logger.error(`Failed BUY order:`, error);
        await prisma.executionQueue.updateMany({
          where: { userId, copyTradingId, tokenMint, status: 'PENDING' },
          data: { status: 'FAILED', lastError: error instanceof Error ? error.message : 'Unknown', attempts: { increment: 1 } },
        });
        throw error;
      }
    });


    // Process SELL orders with concurrency of 3 for faster SL/TP execution
    void this.sellQueue.process(3, async (job) => {
      const { userId, copyTradingId, positionId, tokenMint, amount, reason } = job.data;

      try {
        logger.info(`Processing SELL order: Position ${positionId}, Reason ${reason}`);

        const position = await prisma.position.findUnique({
          where: { id: positionId },
          include: { copyTrading: true },
        });
        if (!position || position.status !== 'OPEN') {
          throw new Error('Position not found or already closed');
        }

        // Get user's custodial wallet keypair - REAL WALLET
        const userWallet = await custodialWalletService.getKeypair(userId);
        if (!userWallet) {
          throw new Error(`Custodial wallet not found for user ${userId}`);
        }

        // Get slippage from copy trading settings (slightly higher for sells)
        const slippagePercent = Math.min(position.copyTrading.maxSlippage || 1.5, MAX_SLIPPAGE_PERCENT);
        const slippageBps = Math.min(Math.round(slippagePercent * 100), MAX_SLIPPAGE_BPS);

        // Comment 2: Run pre-flight check before execution
        const preFlightResult = await transactionSecurityMiddleware.preFlightCheck(
          {
            type: 'COPY_TRADE_SELL',
            userId,
            wallet: userWallet,
            inputMint: tokenMint,
            amountUsd: position.entryValue, // Approximate USD value
          },
          {
            maxSlippage: slippagePercent,
            useMevProtection: true,
          }
        );

        if (!preFlightResult.passed) {
          await prisma.executionQueue.updateMany({
            where: { userId, positionId, status: 'PENDING' },
            data: { status: 'FAILED', lastError: preFlightResult.error || 'Pre-flight check failed', attempts: { increment: 1 } },
          });
          return { success: false, error: preFlightResult.error || 'Pre-flight check failed' };
        }

        // Get quote from Jupiter (sell token for USDC)
        const quote = await jupiterSwap.getQuote({
          inputMint: tokenMint,
          outputMint: USDC_MINT,
          amount: amount * Math.pow(10, 9), // Assuming 9 decimals
          slippageBps,
        });
        if (!quote) throw new Error('Failed to get swap quote');

        const simulation = await jupiterSwap.simulateSwap({ wallet: userWallet, quoteResponse: quote });
        if (!simulation.ok) {
          await prisma.executionQueue.updateMany({
            where: { userId, positionId, status: 'PENDING' },
            data: { status: 'FAILED', lastError: simulation.error || 'Simulation failed', attempts: { increment: 1 } },
          });
          return { success: false, error: simulation.error || 'Simulation failed' };
        }

        // Use Jito MEV protection for high-value sells
        const sellValueUsd = position.entryValue;
        const useJitoMevSell = jitoService.isEnabled() && sellValueUsd >= JITO_HIGH_VALUE_THRESHOLD;

        if (useJitoMevSell) {
          logger.info(`[Jito] MEV protection enabled for high-value SELL: $${sellValueUsd}`);
        }

        // Execute swap directly with MEV protection
        const txHash = await jupiterSwap.executeSwap({
          wallet: userWallet,
          quoteResponse: quote,
          useMevProtection: useJitoMevSell,
          tradeValueUsd: sellValueUsd,
        });

        // Calculate profit/loss
        const exitValue = parseFloat(quote.outAmount) / Math.pow(10, USDC_DECIMALS);
        const profitLoss = exitValue - position.entryValue;
        const profitLossPercent = (profitLoss / position.entryValue) * 100;

        // Update position
        await prisma.position.update({
          where: { id: positionId },
          data: {
            status: 'CLOSED',
            exitTxHash: txHash,
            exitPrice: parseFloat(quote.price!),
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
          data: { activeTrades: { decrement: 1 }, totalProfit: { increment: profitLoss } },
        });

        await prisma.executionQueue.updateMany({
          where: { userId, positionId, status: 'PENDING' },
          data: { status: 'SUCCESS', txHash, executedAt: new Date() },
        });

        await auditLogService.logFinancialOperation({
          userId,
          operation: 'COPY_TRADE_SELL_EXECUTED',
          resourceType: 'Position',
          resourceId: positionId,
          amount: exitValue,
          currency: 'USDC',
          feeAmount: null,
          metadata: {
            copyTradingId,
            tokenMint,
            txHash,
            reason,
            profitLoss,
            profitLossPercent,
          },
          ipAddress: 'system',
          userAgent: 'executionQueue',
        })



        // Process profit sharing if profit > 0
        if (profitLoss > 0) {
          await this.addProfitSharing({
            positionId,
            userId,
            profitLoss,
            traderId: position.copyTrading.traderId,
          })
        }

        logger.info(`✅ SELL executed: Position ${positionId}, P&L: ${profitLoss.toFixed(2)}, Tx ${txHash}`);
        return { success: true, positionId, txHash, profitLoss };
      } catch (error) {
        logger.error(`Failed SELL order:`, error);
        await prisma.executionQueue.updateMany({
          where: { userId, positionId, status: 'PENDING' },
          data: { status: 'FAILED', lastError: error instanceof Error ? error.message : 'Unknown', attempts: { increment: 1 } },
        });
        throw error;
      }
    });

    void this.transactionQueue.process(async (job) => {
      if (job.data.kind === 'USER_WALLET') return this.processUserWalletTransaction(job)
      if (job.data.kind === 'TRADER_HELIUS') return this.processTraderHeliusTransaction(job)
      return { skipped: true }
    })

    void this.profitSharingQueue.process(async (job) => {
      return this.processProfitSharing(job)
    })

    // iBuy queue processor with concurrency of 10 for fast execution
    void this.ibuyQueue.process(10, async (job) => {
      return this.processIBuyOrder(job)
    })

    // Queue event handlers
    this.buyQueue.on('completed', (job, result) => logger.info(`BUY job ${job.id} completed:`, result));
    this.buyQueue.on('failed', async (job, err) => {
      logger.error(`BUY job ${job.id} failed:`, err)
      const maxAttempts = typeof job.opts?.attempts === 'number' ? job.opts.attempts : 1
      if (job.attemptsMade >= maxAttempts) {
        await this.writeDlqItem('dlq:copy-trades-buy', job, err instanceof Error ? err : new Error(String(err)))
      }
    });
    this.sellQueue.on('completed', (job, result) => logger.info(`SELL job ${job.id} completed:`, result));
    this.sellQueue.on('failed', async (job, err) => {
      logger.error(`SELL job ${job.id} failed:`, err)
      const maxAttempts = typeof job.opts?.attempts === 'number' ? job.opts.attempts : 1
      if (job.attemptsMade >= maxAttempts) {
        await this.writeDlqItem('dlq:copy-trades-sell', job, err instanceof Error ? err : new Error(String(err)))
      }
    });

    this.transactionQueue.on('completed', (job, result) => logger.info(`TX job ${job.id} completed:`, result))
    this.transactionQueue.on('failed', async (job, err) => {
      logger.error(`TX job ${job.id} failed:`, err)
      const maxAttempts = typeof job.opts?.attempts === 'number' ? job.opts.attempts : 1
      if (job.attemptsMade >= maxAttempts) {
        await this.writeDlqItem('dlq:transaction-processing', job, err instanceof Error ? err : new Error(String(err)))
      }
    })

    this.profitSharingQueue.on('completed', (job, result) =>
      logger.info(`PROFIT job ${job.id} completed:`, result)
    )
    this.profitSharingQueue.on('failed', async (job, err) => {
      logger.error(`PROFIT job ${job.id} failed:`, err)
      const maxAttempts = typeof job.opts?.attempts === 'number' ? job.opts.attempts : 1
      if (job.attemptsMade >= maxAttempts) {
        await this.writeDlqItem('dlq:profit-sharing', job, err instanceof Error ? err : new Error(String(err)))
      }
    })

    // iBuy queue event handlers
    this.ibuyQueue.on('completed', async (job, result: IBuyJobResult) => {
      logger.info(`IBUY job ${job.id} completed:`, result)
      // Cache job result for status polling
      const cacheKey: CacheKey = `ibuy:job:${job.id}`
      await redisCache.set(cacheKey, { status: 'completed', result }, 300) // 5 min TTL
    })
    this.ibuyQueue.on('failed', async (job, err) => {
      logger.error(`IBUY job ${job.id} failed:`, err)
      // Cache failure for status polling
      const cacheKey: CacheKey = `ibuy:job:${job.id}`
      await redisCache.set(cacheKey, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err)
      }, 300)
      const maxAttempts = typeof job.opts?.attempts === 'number' ? job.opts.attempts : 1
      if (job.attemptsMade >= maxAttempts) {
        await this.writeDlqItem('dlq:ibuy-orders', job, err instanceof Error ? err : new Error(String(err)))
      }
    })
  }


  async addBuyOrder(data: BuyOrderData): Promise<string> {
    const executionQueueId = await this.createBuyOrderRecord(data)
    await this.enqueueBuyOrderJobOnly(data)
    return executionQueueId
  }

  async createBuyOrderRecord(data: BuyOrderData): Promise<string> {
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
    })
    return queueRecord.id
  }

  async enqueueBuyOrderJobOnly(data: BuyOrderData): Promise<string> {
    const job = await this.buyQueue.add(data, { priority: data.priority || 0, delay: 0 })
    logger.info(`Added BUY order to queue: ${job.id}`)
    return String(job.id)
  }

  async addSellOrder(data: SellOrderData): Promise<string> {
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

    const job = await this.sellQueue.add(data, { priority: data.priority || 0, delay: 0 });
    logger.info(`Added SELL order to queue: ${job.id}`);
    return queueRecord.id;
  }

  async addTransactionProcessing(data: TransactionProcessingData): Promise<string> {
    const jobId =
      data.kind === 'USER_WALLET'
        ? `user:${data.userId}:${data.signature}`
        : `trader:${(data as any).tx?.signature || Date.now()}`
    const job = await this.transactionQueue.add(data, { jobId })
    return String(job.id)
  }

  async addProfitSharing(data: ProfitSharingJobData): Promise<string> {
    const job = await this.profitSharingQueue.add(data, { jobId: `profit:${data.positionId}` })
    return String(job.id)
  }

  /**
   * Add iBuy order to priority queue
   * Returns jobId for status polling
   */
  async addIBuyOrder(data: IBuyOrderData, options?: { priority?: number }): Promise<string> {
    const priority = options?.priority ?? PRIORITY.STANDARD
    const job = await this.ibuyQueue.add(data, {
      priority,
      delay: 0,
      jobId: `ibuy:${data.userId}:${data.postId}:${Date.now()}`,
    })
    logger.info(`[iBuy Queue] Added order: ${job.id}, priority: ${priority}`)

    // Cache initial status
    const cacheKey: CacheKey = `ibuy:job:${job.id}`
    await redisCache.set(cacheKey, { status: 'pending' }, 300)

    return String(job.id)
  }

  /**
   * Get iBuy job status for polling
   */
  async getIBuyJobStatus(jobId: string): Promise<{
    status: 'pending' | 'active' | 'completed' | 'failed';
    result?: IBuyJobResult;
    error?: string;
  }> {
    // Check cache first
    const cacheKey: CacheKey = `ibuy:job:${jobId}`
    const cached = await redisCache.get<any>(cacheKey)
    if (cached) {
      return cached
    }

    // Check job directly
    const job = await this.ibuyQueue.getJob(jobId)
    if (!job) {
      return { status: 'failed', error: 'Job not found' }
    }

    const state = await job.getState()
    if (state === 'completed') {
      const result = job.returnvalue as IBuyJobResult
      return { status: 'completed', result }
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason || 'Unknown error' }
    }
    if (state === 'active') {
      return { status: 'active' }
    }
    return { status: 'pending' }
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

    const [txWaiting, txActive, txCompleted, txFailed] = await Promise.all([
      this.transactionQueue.getWaitingCount(),
      this.transactionQueue.getActiveCount(),
      this.transactionQueue.getCompletedCount(),
      this.transactionQueue.getFailedCount(),
    ])

    const [profitWaiting, profitActive, profitCompleted, profitFailed] = await Promise.all([
      this.profitSharingQueue.getWaitingCount(),
      this.profitSharingQueue.getActiveCount(),
      this.profitSharingQueue.getCompletedCount(),
      this.profitSharingQueue.getFailedCount(),
    ])

    const [ibuyWaiting, ibuyActive, ibuyCompleted, ibuyFailed] = await Promise.all([
      this.ibuyQueue.getWaitingCount(),
      this.ibuyQueue.getActiveCount(),
      this.ibuyQueue.getCompletedCount(),
      this.ibuyQueue.getFailedCount(),
    ])

    return {
      buy: { waiting: buyWaiting, active: buyActive, completed: buyCompleted, failed: buyFailed },
      sell: { waiting: sellWaiting, active: sellActive, completed: sellCompleted, failed: sellFailed },
      transaction: { waiting: txWaiting, active: txActive, completed: txCompleted, failed: txFailed },
      profit: { waiting: profitWaiting, active: profitActive, completed: profitCompleted, failed: profitFailed },
      ibuy: { waiting: ibuyWaiting, active: ibuyActive, completed: ibuyCompleted, failed: ibuyFailed },
    };
  }

  async getDlqStats(): Promise<{ buy: number; sell: number; transaction: number; profit: number; ibuy: number }> {
    const client: any = (this.buyQueue as any)?.client
    if (!client) return { buy: 0, sell: 0, transaction: 0, profit: 0, ibuy: 0 }

    try {
      const [buy, sell, transaction, profit, ibuy] = await Promise.all([
        client.llen('dlq:copy-trades-buy'),
        client.llen('dlq:copy-trades-sell'),
        client.llen('dlq:transaction-processing'),
        client.llen('dlq:profit-sharing'),
        client.llen('dlq:ibuy-orders'),
      ])

      return {
        buy: typeof buy === 'number' ? buy : parseInt(String(buy || '0'), 10),
        sell: typeof sell === 'number' ? sell : parseInt(String(sell || '0'), 10),
        transaction:
          typeof transaction === 'number' ? transaction : parseInt(String(transaction || '0'), 10),
        profit: typeof profit === 'number' ? profit : parseInt(String(profit || '0'), 10),
        ibuy: typeof ibuy === 'number' ? ibuy : parseInt(String(ibuy || '0'), 10),
      }
    } catch {
      return { buy: 0, sell: 0, transaction: 0, profit: 0, ibuy: 0 }
    }
  }

  async clearQueues() {
    await this.buyQueue.empty();
    await this.sellQueue.empty();
    await this.transactionQueue.empty()
    await this.profitSharingQueue.empty()
    await this.ibuyQueue.empty()
    logger.info('Queues cleared');
  }

  async close() {
    await this.buyQueue.close();
    await this.sellQueue.close();
    await this.transactionQueue.close()
    await this.profitSharingQueue.close()
    await this.ibuyQueue.close()
    logger.info('Execution queues closed');
  }
}

export const executionQueue = new ExecutionQueue();
