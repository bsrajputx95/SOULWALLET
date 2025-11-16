import WebSocket from 'ws';
import { Connection, PublicKey } from '@solana/web3.js';
import prisma from '../prisma';
import { logger } from '../logger';
import { executionQueue } from './executionQueue';

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
  private connection: Connection;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;
  private monitoredWallets: Map<string, string> = new Map(); // wallet -> traderId

  constructor() {
    const rpcUrl = process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

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

    // Refresh monitored wallets every 5 minutes
    setInterval(() => this.loadMonitoredWallets(), 5 * 60 * 1000);
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

  private scheduleReconnect() {
    if (!this.isRunning || this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      logger.info('Attempting to reconnect WebSocket...');
      this.connectWebSocket();
    }, 5000); // Reconnect after 5 seconds
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

          // Add to execution queue
          if (parsed.type === 'BUY') {
            await executionQueue.addBuyOrder({
              userId: copyRelation.userId,
              copyTradingId: copyRelation.id,
              tokenMint: parsed.tokenMint,
              amount: copyRelation.amountPerTrade,
              detectedTxId,
            });
            copiesCreated++;
          } else if (parsed.type === 'SELL' && copyRelation.exitWithTrader) {
            // Find open positions for this token
            const positions = await prisma.position.findMany({
              where: {
                copyTradingId: copyRelation.id,
                tokenMint: parsed.tokenMint,
                status: 'OPEN',
              },
            });

            for (const position of positions) {
              await executionQueue.addSellOrder({
                userId: copyRelation.userId,
                copyTradingId: copyRelation.id,
                positionId: position.id,
                tokenMint: parsed.tokenMint,
                amount: position.entryAmount,
                reason: 'TRADER_SOLD',
              });
            }
            copiesCreated += positions.length;
          }
        } catch (error) {
          logger.error(`Failed to create copy order for user ${copyRelation.userId}:`, error);
        }
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
