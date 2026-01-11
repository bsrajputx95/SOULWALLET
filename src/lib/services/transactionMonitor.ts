import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';
import prisma from '../prisma';
import { logger } from '../logger';
import { executionQueue } from './executionQueue';
import { priceMonitor } from './priceMonitor';
import { messageQueue } from './messageQueue'

interface HeliusTransaction {
  signature: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  slot: number;
  timestamp: number;
  tokenTransfers?: {
    fromTokenAccount: string;
    toTokenAccount: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
  }[];
  nativeTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  accountData?: {
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: {
      userAccount: string;
      tokenAccount: string;
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
    }[];
  }[];
}

interface ParsedSwap {
  walletId: string;
  signature: string;
  type: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol?: string | undefined;
  amount: number;
  price: number;
  totalValue: number;
}

export class TransactionMonitor {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;
  private monitoredWallets: Map<string, string> = new Map(); // wallet -> traderId

  constructor() { }

  // Exponential backoff configuration for reconnection
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds max
  private heartbeatInterval: NodeJS.Timeout | null = null;

  async start() {
    if (this.isRunning) {
      logger.info('Transaction monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting transaction monitor...');

    // Load monitored wallets from database
    await this.loadMonitoredWallets();

    // Connect to WebSocket
    this.connectWebSocket();

    // Refresh monitored wallets every 30 seconds (reduced from 5 min for faster new trader detection)
    setInterval(() => this.loadMonitoredWallets(), 30 * 1000);
  }

  async stop() {
    this.isRunning = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    logger.info('Transaction monitor stopped');
  }

  private async loadMonitoredWallets() {
    try {
      const wallets = await prisma.monitoredWallet.findMany({
        where: { isActive: true },
        include: { trader: true },
      });

      this.monitoredWallets.clear();
      for (const wallet of wallets) {
        if (wallet.traderId) {
          this.monitoredWallets.set(wallet.walletAddress, wallet.traderId);
        }
      }

      logger.info(`Loaded ${this.monitoredWallets.size} monitored wallets`);
    } catch (error) {
      logger.error('Failed to load monitored wallets:', error);
    }
  }

  private connectWebSocket() {
    if (!this.isRunning) return;

    const wsUrl = process.env.HELIUS_WS_URL || `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        logger.info('WebSocket connected to Helius');
        this.reconnectAttempts = 0; // Reset backoff on successful connection
        this.startHeartbeat();
        this.subscribeToWallets();
      });

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.method === 'transactionNotification') {
            await this.handleTransaction(message.params.result);
          }
        } catch (error) {
          logger.error('Error processing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });

      this.ws.on('close', () => {
        logger.warn('WebSocket disconnected');
        this.stopHeartbeat();
        this.scheduleReconnect();
      });
    } catch (error) {
      logger.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private subscribeToWallets() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    for (const walletAddress of this.monitoredWallets.keys()) {
      const subscribeMessage = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'transactionSubscribe',
        params: [
          {
            accountInclude: [walletAddress],
          },
          {
            commitment: 'confirmed',
            encoding: 'jsonParsed',
            transactionDetails: 'full',
            showRewards: false,
            maxSupportedTransactionVersion: 0,
          },
        ],
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      logger.info(`Subscribed to wallet: ${walletAddress}`);
    }
  }

  // Heartbeat: ping WebSocket every 30s to detect stale connections
  private startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (!this.isRunning || this.reconnectTimeout) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    logger.info(`Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      logger.info('Attempting to reconnect WebSocket...');
      this.connectWebSocket();
    }, delay);
  }

  private async handleTransaction(tx: HeliusTransaction) {
    try {
      // Parse the transaction to determine if it's a swap
      const parsed = this.parseJupiterSwap(tx);

      if (!parsed) {
        // Not a swap transaction, ignore
        return;
      }

      // Find the monitored wallet
      const monitoredWallet = await prisma.monitoredWallet.findUnique({
        where: { walletAddress: parsed.walletId },
      });

      if (!monitoredWallet) {
        logger.warn(`Monitored wallet not found: ${parsed.walletId}`);
        return;
      }

      // Store the detected transaction
      const detectedTx = await prisma.detectedTransaction.create({
        data: {
          monitoredWalletId: monitoredWallet.id,
          txHash: parsed.signature,
          type: parsed.type,
          tokenMint: parsed.tokenMint,
          tokenSymbol: parsed.tokenSymbol,
          amount: parsed.amount,
          price: parsed.price,
          totalValue: parsed.totalValue,
        },
      });

      logger.info(`Detected ${parsed.type} transaction: ${parsed.signature}`);
      logger.info(`Token: ${parsed.tokenSymbol || parsed.tokenMint}, Amount: ${parsed.amount}, Value: $${parsed.totalValue}`);

      // Update last seen transaction
      await prisma.monitoredWallet.update({
        where: { id: monitoredWallet.id },
        data: {
          lastSeenTx: parsed.signature,
          lastSeenAt: new Date(),
        },
      });

      // Trigger copy trades for all active copiers
      await this.triggerCopyTrades(detectedTx.id, monitoredWallet.id, parsed);
    } catch (error) {
      logger.error('Error handling transaction:', error);
    }
  }

  private parseJupiterSwap(tx: HeliusTransaction): ParsedSwap | null {
    // Jupiter Program ID
    const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

    // Check if this is a Jupiter swap
    const isJupiterSwap = tx.type === 'SWAP' ||
      (tx.accountData && tx.accountData.some(a =>
        a.account === JUPITER_PROGRAM_ID));

    if (!isJupiterSwap) {
      return null;
    }

    // Extract token transfers
    const tokenTransfers = tx.tokenTransfers || [];
    if (tokenTransfers.length === 0) {
      return null;
    }

    const firstTransfer = tokenTransfers[0]
    if (!firstTransfer) return null
    const walletAddress = firstTransfer.fromUserAccount;

    // Check if wallet is monitored
    if (!this.monitoredWallets.has(walletAddress)) {
      return null;
    }

    // Determine trade type
    const isBuy = firstTransfer.fromUserAccount === walletAddress;

    return {
      walletId: walletAddress,
      signature: tx.signature,
      type: isBuy ? 'BUY' : 'SELL',
      tokenMint: firstTransfer.mint,
      tokenSymbol: undefined, // Would need to fetch from token registry
      amount: firstTransfer.tokenAmount,
      price: 0, // Would need to calculate from swap data
      totalValue: 0, // Would need to calculate
    };
  }

  private async triggerCopyTrades(
    detectedTxId: string,
    monitoredWalletId: string,
    parsed: ParsedSwap
  ) {
    try {
      // Find all active copy relationships for this trader
      const monitoredWallet = await prisma.monitoredWallet.findUnique({
        where: { id: monitoredWalletId },
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
      });

      if (!monitoredWallet?.trader) {
        return;
      }

      const copiers = monitoredWallet.trader.copiers;
      logger.info(`Found ${copiers.length} active copiers for trader ${monitoredWallet.trader.username}`);

      // Create copy orders for each copier
      let copiesCreated = 0;

      for (const copyRelation of copiers) {
        try {
          // Check if user has budget available
          const usedBudget = await this.calculateUsedBudget(copyRelation.id);
          const availableBudget = copyRelation.totalBudget - usedBudget;

          if (availableBudget < copyRelation.amountPerTrade) {
            logger.warn(`User ${copyRelation.userId} has insufficient budget for copy trade`);
            continue;
          }

          // Check max positions limit (optional, could be added to schema)
          const openPositions = await prisma.position.count({
            where: {
              copyTradingId: copyRelation.id,
              status: 'OPEN',
            },
          });

          const maxPositions = 10; // Could be a user setting
          if (openPositions >= maxPositions) {
            logger.warn(`User ${copyRelation.userId} has reached max positions limit`);
            continue;
          }

          // Add to execution queue - only handle BUY orders here
          // SELL orders are handled by priceMonitor.handleTraderSell to avoid duplicates
          if (parsed.type === 'BUY') {
            // Comment 2: Priority based on trader status (featured = 1, standard = 3)
            const priority = monitoredWallet.trader.isFeatured ? 1 : 3;

            const orderData = {
              userId: copyRelation.userId,
              copyTradingId: copyRelation.id,
              tokenMint: parsed.tokenMint,
              amount: copyRelation.amountPerTrade,
              detectedTxId,
              priority,
            }
            const executionQueueId = await executionQueue.createBuyOrderRecord(orderData)
            try {
              await messageQueue.publishCopyTradeBuy({ executionQueueId, ...orderData })
            } catch (mqError) {
              logger.warn('RabbitMQ publish failed; enqueuing copy trade directly', {
                error: mqError instanceof Error ? mqError.message : String(mqError),
                executionQueueId,
              })
              await executionQueue.enqueueBuyOrderJobOnly(orderData)
            }
            copiesCreated++;
          }
          // Note: SELL orders with exitWithTrader are handled by priceMonitor.handleTraderSell
          // This prevents duplicate sell orders from being queued
        } catch (error) {
          logger.error(`Failed to create copy order for user ${copyRelation.userId}:`, error);
        }
      }

      // Handle SELL transactions through priceMonitor to avoid duplicates
      if (parsed.type === 'SELL') {
        await priceMonitor.handleTraderSell(detectedTxId);
      }

      // Update detected transaction with copies created count
      await prisma.detectedTransaction.update({
        where: { id: detectedTxId },
        data: {
          processed: true,
          processedAt: new Date(),
          copiesCreated,
        },
      });

      logger.info(`Created ${copiesCreated} copy orders for transaction ${parsed.signature}`);
    } catch (error) {
      logger.error('Error triggering copy trades:', error);
    }
  }

  private async calculateUsedBudget(copyTradingId: string): Promise<number> {
    const openPositions = await prisma.position.aggregate({
      where: {
        copyTradingId,
        status: 'OPEN',
      },
      _sum: {
        entryValue: true,
      },
    });

    return openPositions._sum.entryValue || 0;
  }
}

// Export singleton instance
export const transactionMonitor = new TransactionMonitor();
