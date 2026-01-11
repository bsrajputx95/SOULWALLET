import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { PublicKey } from '@solana/web3.js';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { rpcManager } from '../../lib/services/rpcManager';
import { auditLogService } from '../../lib/services/auditLog'
import { amlService } from '../../lib/services/kyc'

export const transactionRouter = router({
  /**
   * Get transaction history with pagination and filters
   */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().max(100).default(20),
      cursor: z.string().optional(),
      type: z.enum(['SEND', 'RECEIVE', 'SWAP']).optional(),
      search: z.string().optional(), // Search by signature
    }))
    .query(async ({ input, ctx }) => {
      try {
        const where: any = {
          userId: ctx.user.id,
        };

        if (input.type) {
          where.type = input.type;
        }

        if (input.search) {
          where.signature = {
            contains: input.search,
          };
        }

        const transactions = await prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.limit + 1,
          skip: input.cursor ? 1 : 0,  // Comment 2 Fix: Avoid cursor duplication
          ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        });

        let nextCursor: string | undefined;
        if (transactions.length > input.limit) {
          const next = transactions.pop();
          nextCursor = next?.id;
        }

        return {
          transactions,
          nextCursor,
        };
      } catch (error) {
        logger.error('Get transaction list error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get transaction history',
        });
      }
    }),

  /**
   * Get transaction by signature
   */
  getBySignature: protectedProcedure
    .input(z.object({
      signature: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const transaction = await prisma.transaction.findFirst({
          where: {
            signature: input.signature,
            userId: ctx.user.id, // Ensure user can only access their own transactions
          },
        });

        if (!transaction) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Transaction not found',
          });
        }

        // Try to get additional details from the blockchain
        let blockchainData = null;
        try {
          const confirmedTransaction = await rpcManager.withFailover((connection) =>
            connection.getTransaction(input.signature, { maxSupportedTransactionVersion: 0 })
          );
          
          if (confirmedTransaction) {
            blockchainData = {
              blockTime: confirmedTransaction.blockTime,
              slot: confirmedTransaction.slot,
              confirmations: 'finalized', // Assuming finalized if we can fetch it
            };
          }
        } catch (blockchainError) {
          logger.warn('Could not fetch blockchain data for transaction:', blockchainError);
        }

        return {
          transaction,
          blockchainData,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Get transaction by signature error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get transaction details',
        });
      }
    }),

  /**
   * Sync transactions from blockchain
   */
  sync: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User wallet not found',
          });
        }

        const publicKey = new PublicKey(user.walletAddress);
        
        // Get recent transactions from the blockchain
        const signatures = await rpcManager.withFailover((connection) =>
          connection.getSignaturesForAddress(publicKey, { limit: 50 })
        );

        let newTransactionCount = 0;

        for (const signatureInfo of signatures) {
          // Check if we already have this transaction
          const existingTransaction = await prisma.transaction.findUnique({
            where: { signature: signatureInfo.signature },
          });

          if (!existingTransaction) {
            // Fetch transaction details
            const transaction = await rpcManager.withFailover((connection) =>
              connection.getTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 })
            );

            if (transaction) {
              // Parse transaction to determine type, amount, etc.
              // This is a simplified version - real implementation would need more sophisticated parsing
              const accountKeys = transaction.transaction.message.getAccountKeys();
              const staticAccountKeys = accountKeys.staticAccountKeys;
              const isReceive = staticAccountKeys.some(
                (key, index) => key.equals(publicKey) && 
                  transaction.meta?.postBalances?.[index] && 
                  transaction.meta?.preBalances?.[index] !== undefined &&
                  transaction.meta.postBalances[index] > transaction.meta.preBalances[index]
              );

              const postBalance = transaction.meta?.postBalances?.[0] || 0;
              const preBalance = transaction.meta?.preBalances?.[0] || 0;
              const balanceChange = postBalance - preBalance;
              const amount = Math.abs(balanceChange || 0) / 1_000_000_000; // Convert lamports to SOL

              const created = await prisma.transaction.create({
                data: {
                  userId: ctx.user.id,
                  signature: signatureInfo.signature,
                  type: isReceive ? 'RECEIVE' : 'SEND',
                  amount,
                  token: 'SOL',
                  tokenSymbol: 'SOL',
                  from: isReceive ? 'unknown' : user.walletAddress,
                  to: isReceive ? user.walletAddress : 'unknown',
                  fee: (transaction.meta?.fee || 0) / 1_000_000_000,
                  status: signatureInfo.confirmationStatus === 'finalized' ? 'CONFIRMED' : 'PENDING',
                  createdAt: new Date((signatureInfo.blockTime || Date.now() / 1000) * 1000),
                },
              });

              const uaHeader = ctx.req?.headers?.['user-agent']
              const userAgent = Array.isArray(uaHeader) ? uaHeader[0] : (typeof uaHeader === 'string' ? uaHeader : ctx.fingerprint?.userAgent)
              const ipAddress = ctx.rateLimitContext?.ip || ctx.req?.ip || ctx.fingerprint?.ipAddress || 'unknown'

              await auditLogService.logFinancialOperation({
                userId: ctx.user.id,
                operation: isReceive ? 'RECEIVE' : 'SEND',
                resourceType: 'Transaction',
                resourceId: created.id,
                amount,
                currency: 'SOL',
                feeAmount: (transaction.meta?.fee || 0) / 1_000_000_000,
                metadata: {
                  signature: signatureInfo.signature,
                  status: signatureInfo.confirmationStatus === 'finalized' ? 'CONFIRMED' : 'PENDING',
                  from: isReceive ? 'unknown' : user.walletAddress,
                  to: isReceive ? user.walletAddress : 'unknown',
                },
                ipAddress,
                userAgent,
              })

              try {
                await amlService.monitorTransaction(
                  ctx.user.id,
                  created.id,
                  signatureInfo.signature,
                  amount,
                  'SOL',
                  { type: isReceive ? 'RECEIVE' : 'SEND' }
                )
              } catch (error) {
                logger.warn('AML monitoring failed for synced transaction', { userId: ctx.user.id, transactionId: created.id, error })
              }

              newTransactionCount++;
            }
          }
        }

        return {
          success: true,
          newTransactions: newTransactionCount,
          message: `Synced ${newTransactionCount} new transactions`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Sync transactions error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sync transactions',
        });
      }
    }),

  /**
   * Verify transaction on blockchain
   */
  verifyTransaction: protectedProcedure
    .input(z.object({
      signature: z.string().min(1, 'Transaction signature is required'),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Get transaction from database
        const dbTransaction = await prisma.transaction.findFirst({
          where: {
            signature: input.signature,
            userId: ctx.user.id,
          },
        });

        if (!dbTransaction) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Transaction not found in database',
          });
        }

        // Verify on blockchain with failover
        const blockchainTransaction = await rpcManager.withFailover((connection) =>
          connection.getTransaction(input.signature, { maxSupportedTransactionVersion: 0 })
        );

        if (!blockchainTransaction) {
          return {
            isVerified: false,
            dbTransaction,
            blockchainData: null,
            message: 'Transaction not found on blockchain',
          };
        }

        // Extract blockchain data
        const blockchainData = {
          signature: input.signature,
          blockTime: blockchainTransaction.blockTime,
          slot: blockchainTransaction.slot,
          confirmations: blockchainTransaction.meta?.err ? 'failed' : 'finalized',
          fee: blockchainTransaction.meta?.fee || 0,
          success: !blockchainTransaction.meta?.err,
          error: blockchainTransaction.meta?.err,
        };

        // Verify transaction integrity
        const isVerified = 
          blockchainData.success &&
          blockchainData.fee === (dbTransaction.fee * 1_000_000_000) && // Convert SOL to lamports
          blockchainData.confirmations === 'finalized';

        // Update database with blockchain verification
        if (isVerified && dbTransaction.status !== 'CONFIRMED') {
          await prisma.transaction.update({
            where: { id: dbTransaction.id },
            data: {
              status: 'CONFIRMED',
            },
          });
        }

        return {
          isVerified,
          dbTransaction,
          blockchainData,
          message: isVerified ? 'Transaction verified successfully' : 'Transaction verification failed',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Transaction verification error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify transaction',
        });
      }
    }),

  /**
   * Bulk verify transactions
   */
  bulkVerify: protectedProcedure
    .input(z.object({
      signatures: z.array(z.string()).max(10, 'Maximum 10 signatures allowed'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const results = [];

        for (const signature of input.signatures) {
          try {
            // Get transaction from database
            const dbTransaction = await prisma.transaction.findFirst({
              where: {
                signature,
                userId: ctx.user.id,
              },
            });

            if (!dbTransaction) {
              results.push({
                signature,
                isVerified: false,
                message: 'Transaction not found in database',
              });
              continue;
            }

            // Verify on blockchain
            const blockchainTransaction = await rpcManager.withFailover((connection) =>
              connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 })
            );

            if (!blockchainTransaction) {
              results.push({
                signature,
                isVerified: false,
                message: 'Transaction not found on blockchain',
              });
              continue;
            }

            const isVerified = !blockchainTransaction.meta?.err;

            // Update database if verified
            if (isVerified && dbTransaction.status !== 'CONFIRMED') {
              await prisma.transaction.update({
                where: { id: dbTransaction.id },
                data: {
                  status: 'CONFIRMED',
                },
              });
            }

            results.push({
              signature,
              isVerified,
              message: isVerified ? 'Verified' : 'Failed verification',
            });
          } catch (error) {
            logger.error(`Error verifying transaction ${signature}:`, error);
            results.push({
              signature,
              isVerified: false,
              message: 'Verification error',
            });
          }
        }

        const verifiedCount = results.filter(r => r.isVerified).length;

        return {
          success: true,
          results,
          summary: {
            total: input.signatures.length,
            verified: verifiedCount,
            failed: input.signatures.length - verifiedCount,
          },
        };
      } catch (error) {
        logger.error('Bulk verification error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to perform bulk verification',
        });
      }
    }),

  /**
   * Get transaction statistics
   */
  getStats: protectedProcedure
    .input(z.object({
      period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const now = new Date();
        let startDate: Date;

        switch (input.period) {
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case '1y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        }

        const transactions = await prisma.transaction.findMany({
          where: {
            userId: ctx.user.id,
            createdAt: {
              gte: startDate,
            },
          },
        });

        const stats = {
          totalTransactions: transactions.length,
          sent: transactions.filter(tx => tx.type === 'SEND').length,
          received: transactions.filter(tx => tx.type === 'RECEIVE').length,
          swapped: transactions.filter(tx => tx.type === 'SWAP').length,
          totalVolume: transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0),
          totalFees: transactions.reduce((sum: number, tx: any) => sum + (tx.fee || 0), 0),
        };

        return stats;
      } catch (error) {
        logger.error('Get transaction stats error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get transaction statistics',
        });
      }
    }),
});
