/**
 * Transaction Status Updater Service
 * Updates PENDING transactions to CONFIRMED/FAILED based on blockchain status
 */

import { Connection } from '@solana/web3.js';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

let updateInterval: NodeJS.Timeout | null = null;
let isUpdating = false;

export async function startTransactionStatusUpdater() {
  if (isUpdating) {
    logger.info('Transaction status updater already running');
    return;
  }

  logger.info('Starting transaction status updater...');
  isUpdating = true;

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

  // Check transaction status every 60 seconds
  updateInterval = setInterval(async () => {
    try {
      // Get all PENDING transactions
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          status: 'PENDING'
        },
        orderBy: { createdAt: 'desc' },
        take: 100 // Process up to 100 pending transactions per run
      });

      if (pendingTransactions.length === 0) {
        return;
      }

      logger.info(`Checking status for ${pendingTransactions.length} pending transactions`);

      for (const tx of pendingTransactions) {
        try {
          // Skip simulated signatures
          if (tx.signature.startsWith('sim_') || tx.signature.startsWith('simulated_')) {
            // Mark as confirmed after 5 minutes for simulated txs
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (tx.createdAt < fiveMinutesAgo) {
              await prisma.transaction.update({
                where: { id: tx.id },
                data: { status: 'CONFIRMED' }
              });
              logger.info(`Marked simulated transaction ${tx.signature} as CONFIRMED`);
            }
            continue;
          }

          // Check transaction status on blockchain
          const txInfo = await connection.getTransaction(tx.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (txInfo) {
            // Transaction found - update status
            const newStatus = txInfo.meta?.err ? 'FAILED' : 'CONFIRMED';
            
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { 
                status: newStatus
              }
            });

            logger.info(`Updated transaction ${tx.signature} to ${newStatus}`);
          } else {
            // Transaction not found yet - check if it's too old (24 hours)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (tx.createdAt < oneDayAgo) {
              // Mark as FAILED if not confirmed after 24 hours
              await prisma.transaction.update({
                where: { id: tx.id },
                data: { 
                  status: 'FAILED',
                  notes: tx.notes 
                    ? `${tx.notes} (Transaction not found after 24 hours)`
                    : 'Transaction not found after 24 hours'
                }
              });

              logger.warn(`Marked transaction ${tx.signature} as FAILED (not found after 24 hours)`);
            }
          }
        } catch (error) {
          logger.error(`Error updating transaction ${tx.signature}:`, error);
        }
      }
    } catch (error) {
      logger.error('Transaction status updater error:', error);
    }
  }, 60000); // 60 seconds

  logger.info('Transaction status updater started');
}

export function stopTransactionStatusUpdater() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    isUpdating = false;
    logger.info('Transaction status updater stopped');
  }
}
