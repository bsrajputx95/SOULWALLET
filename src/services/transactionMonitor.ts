import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

let monitorInterval: NodeJS.Timeout | null = null;
let isMonitoring = false;

export async function startTransactionMonitor() {
  if (isMonitoring) {
    logger.info('Transaction monitor already running');
    return;
  }

  logger.info('Starting transaction monitor...');
  isMonitoring = true;

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

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

      for (const user of users) {
        if (!user.walletAddress) continue;

        try {
          const publicKey = new PublicKey(user.walletAddress);
          
          // Get recent signatures
          const signatures = await connection.getSignaturesForAddress(
            publicKey,
            { limit: 10 }
          );

          for (const sig of signatures) {
            // Check if we've already processed this transaction
            const existingTx = await prisma.transaction.findUnique({
              where: { signature: sig.signature }
            });

            if (!existingTx) {
              // Get transaction details
              const tx = await connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
              });

              if (tx) {
                // Extract account keys based on message version
                const message = tx.transaction.message;
                let accountKeys: string[] = [];
                
                if ('getAccountKeys' in message) {
                  const keys = message.getAccountKeys();
                  accountKeys = keys.staticAccountKeys.map(k => k.toString());
                } else if ('accountKeys' in message) {
                  accountKeys = (message as any).accountKeys.map((k: any) => k.toString());
                }
                
                // Determine if this is incoming or outgoing
                const preBalances = tx.meta?.preBalances || [];
                const postBalances = tx.meta?.postBalances || [];
                
                // Find user's account index
                const userAccountIndex = accountKeys.findIndex(key => key === user.walletAddress);
                
                if (userAccountIndex === -1) {
                  logger.warn(`User wallet not found in transaction ${sig.signature}`);
                  continue;
                }
                
                // Calculate balance change
                const preBalance = preBalances[userAccountIndex] || 0;
                const postBalance = postBalances[userAccountIndex] || 0;
                const balanceChange = postBalance - preBalance;
                
                const isReceive = balanceChange > 0;
                const amount = Math.abs(balanceChange) / LAMPORTS_PER_SOL;
                
                // Get fee
                const fee = ((tx.meta?.fee || 0) / LAMPORTS_PER_SOL);
                
                // Determine from/to addresses
                let fromAddress = 'unknown';
                let toAddress = 'unknown';
                
                if (accountKeys.length >= 2) {
                  if (isReceive) {
                    fromAddress = accountKeys[0] || 'unknown';
                    toAddress = user.walletAddress;
                  } else {
                    fromAddress = user.walletAddress;
                    toAddress = accountKeys[1] || 'unknown';
                  }
                }
                
                // Save transaction
                await prisma.transaction.create({
                  data: {
                    userId: user.id,
                    signature: sig.signature,
                    type: isReceive ? 'RECEIVE' : 'SEND',
                    amount: amount,
                    token: 'SOL',
                    tokenSymbol: 'SOL',
                    from: fromAddress,
                    to: toAddress,
                    status: tx.meta?.err ? 'FAILED' : 'CONFIRMED',
                    fee: fee,
                    createdAt: new Date(sig.blockTime ? sig.blockTime * 1000 : Date.now())
                  }
                });

                logger.info(`Processed ${isReceive ? 'RECEIVE' : 'SEND'} transaction ${sig.signature} for user ${user.id}: ${amount.toFixed(6)} SOL`);
              }
            }
          }
        } catch (error) {
          logger.error(`Error monitoring wallet ${user.walletAddress}:`, error);
        }
      }
    } catch (error) {
      logger.error('Transaction monitor error:', error);
    }
  }, 30000); // 30 seconds

  logger.info('Transaction monitor started');
}

export function stopTransactionMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    isMonitoring = false;
    logger.info('Transaction monitor stopped');
  }
}
