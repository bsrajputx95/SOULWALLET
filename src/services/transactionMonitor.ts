import { PublicKey } from '@solana/web3.js';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { rpcManager } from '../lib/services/rpcManager';
import { executionQueue } from '../lib/services/executionQueue';

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isMonitoring = false;

/**
 * Comment 3: Transaction monitor refactored to use Bull queue
 * Instead of processing transactions synchronously, we now:
 * 1. Detect new transactions for monitored wallets
 * 2. Enqueue them via executionQueue.addTransactionProcessing()
 * 3. The queue processor handles the actual transaction parsing and DB writes
 * This allows horizontal scaling across PM2 instances
 */

export async function startTransactionMonitor() {
  if (isMonitoring) {
    logger.info('Transaction monitor already running');
    return;
  }

  logger.info('Starting transaction monitor (queue-based)...');
  isMonitoring = true;

  // Check for new transactions every 30 seconds
  monitorInterval = setInterval(async () => {
    try {
      // Get all wallets to monitor
      const users = await prisma.user.findMany({
        where: {
          walletAddress: { not: null }
        },
        select: {
          id: true,
          walletAddress: true
        }
      });

      let enqueuedCount = 0;

      for (const user of users) {
        if (!user.walletAddress) continue;

        try {
          const publicKey = new PublicKey(user.walletAddress);

          // Get recent signatures
          const signatures = await rpcManager.withFailover((connection) =>
            connection.getSignaturesForAddress(publicKey, { limit: 10 })
          );

          for (const sig of signatures) {
            // Check if we've already processed this transaction
            const existingTx = await prisma.transaction.findUnique({
              where: { signature: sig.signature }
            });

            if (!existingTx) {
              // Enqueue transaction for processing instead of processing inline
              await executionQueue.addTransactionProcessing({
                kind: 'USER_WALLET',
                userId: user.id,
                walletAddress: user.walletAddress,
                signature: sig.signature,
                blockTime: sig.blockTime ?? null,
              });
              enqueuedCount++;
            }
          }
        } catch (error) {
          logger.error(`Error monitoring wallet ${user.walletAddress}:`, error);
        }
      }

      if (enqueuedCount > 0) {
        logger.info(`Transaction monitor: enqueued ${enqueuedCount} transactions for processing`);
      }
    } catch (error) {
      logger.error('Transaction monitor error:', error);
    }
  }, 30000); // 30 seconds

  logger.info('Transaction monitor started (queue-based processing enabled)');
}

export function stopTransactionMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    isMonitoring = false;
    logger.info('Transaction monitor stopped');
  }
}
