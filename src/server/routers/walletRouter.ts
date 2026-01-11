// @ts-nocheck
import { z } from 'zod';
import { router, protectedProcedure, financialProcedure } from '../trpc';
import { WalletService } from '../../services/walletService';
import { TRPCError } from '@trpc/server';
import { verifyTotpForUser } from '../../lib/middleware/auth';
import { withIdempotency, deleteIdempotencyRecord } from '../../lib/middleware/idempotency';
import { deadLetterQueueService } from '../../lib/services/deadLetterQueue';

export const walletRouter = router({
  // Get wallet balance
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const wallet = await ctx.prisma.wallet.findFirst({
        where: { userId: ctx.user.id, isPrimary: true },
      });

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No primary wallet found'
        });
      }

      return await WalletService.getBalance(wallet.publicKey);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get balance'
      });
    }
  }),

  // Get token holdings
  getHoldings: protectedProcedure.query(async ({ ctx }) => {
    try {
      const wallet = await ctx.prisma.wallet.findFirst({
        where: { userId: ctx.user.id, isPrimary: true },
      });

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No primary wallet found'
        });
      }

      return await WalletService.getTokenHoldings(wallet.id);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get holdings'
      });
    }
  }),

  // Create new wallet
  createWallet: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await WalletService.createWallet(ctx.user.id);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create wallet'
      });
    }
  }),

  // Import wallet
  importWallet: protectedProcedure
    .input(z.object({
      privateKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await WalletService.importWallet(ctx.user.id, input.privateKey);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to import wallet'
        });
      }
    }),

  // Send transaction (Comment 3+4 fix: requires 2FA + audit/AML logging + idempotency + DLQ)
  sendTransaction: financialProcedure
    .input(z.object({
      recipientAddress: z.string(),
      amount: z.number().positive(),
      tokenMint: z.string().optional(),
      totpCode: z.string().length(6, '2FA code must be 6 digits'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Comment 3: Apply idempotency to prevent duplicate transactions
      const { data: result, fromCache } = await withIdempotency(
        ctx.user.id,
        'wallet.sendTransaction',
        input,
        async () => {
          try {
            // Verify TOTP code before executing transaction
            await verifyTotpForUser(ctx.user.id, input.totpCode);

            const txResult = await WalletService.sendTransaction({
              userId: ctx.user.id,
              recipientAddress: input.recipientAddress,
              amount: input.amount,
              tokenMint: input.tokenMint,
            });

            // Comment 3 fix: Log to audit trail after successful send
            try {
              const { auditLogService } = await import('../../lib/services/auditLog');
              const { amlService } = await import('../../lib/services/kyc');

              await auditLogService.logFinancialOperation({
                userId: ctx.user.id,
                operation: 'SEND',
                resourceType: 'Transaction',
                resourceId: txResult.signature || txResult.txHash || 'unknown',
                amount: input.amount,
                currency: input.tokenMint || 'SOL',
                feeAmount: txResult.fee || 0,
                metadata: {
                  recipientAddress: input.recipientAddress,
                  tokenMint: input.tokenMint,
                  signature: txResult.signature,
                },
                ipAddress: ctx.rateLimitContext?.ip || '0.0.0.0',
                userAgent: ctx.rateLimitContext?.userAgent,
              });

              await amlService.monitorTransaction(
                ctx.user.id,
                txResult.signature || 'unknown',
                input.amount,
                input.tokenMint || 'SOL'
              );
            } catch (auditError) {
              console.error('Audit/AML logging failed:', auditError);
            }

            return txResult;
          } catch (error) {
            // Comment 4: Add failed transaction to DLQ for retry
            try {
              await deadLetterQueueService.addToQueue({
                operation: 'SEND',
                payload: {
                  recipientAddress: input.recipientAddress,
                  amount: input.amount,
                  tokenMint: input.tokenMint,
                },
                error: error instanceof Error ? error.message : String(error),
                userId: ctx.user.id,
              });
            } catch (dlqError) {
              console.error('Failed to add to DLQ:', dlqError);
            }

            if (error instanceof TRPCError) throw error;
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to send transaction'
            });
          }
        }
      );

      if (fromCache) {
        console.log('Returning cached idempotent response for sendTransaction');
      }

      return result;
    }),

  // Swap tokens (Comment 3+4 fix: requires 2FA + audit/AML logging + idempotency + DLQ)
  swapTokens: financialProcedure
    .input(z.object({
      fromMint: z.string(),
      toMint: z.string(),
      amount: z.number().positive(),
      slippage: z.number().min(0).max(5).default(0.5),
      totpCode: z.string().length(6, '2FA code must be 6 digits'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Comment 3: Apply idempotency to prevent duplicate swaps
      const { data: result, fromCache } = await withIdempotency(
        ctx.user.id,
        'wallet.swapTokens',
        input,
        async () => {
          try {
            // Verify TOTP code before executing swap
            await verifyTotpForUser(ctx.user.id, input.totpCode);

            const swapResult = await WalletService.swapTokens({
              userId: ctx.user.id,
              fromMint: input.fromMint,
              toMint: input.toMint,
              amount: input.amount,
              slippage: input.slippage,
            });

            // Comment 3 fix: Log to audit trail after successful swap
            try {
              const { auditLogService } = await import('../../lib/services/auditLog');
              const { amlService } = await import('../../lib/services/kyc');

              await auditLogService.logFinancialOperation({
                userId: ctx.user.id,
                operation: 'SWAP',
                resourceType: 'Transaction',
                resourceId: swapResult.signature || swapResult.txHash || 'unknown',
                amount: input.amount,
                currency: input.fromMint,
                feeAmount: swapResult.fee || 0,
                metadata: {
                  fromMint: input.fromMint,
                  toMint: input.toMint,
                  slippage: input.slippage,
                  outputAmount: swapResult.outputAmount,
                  signature: swapResult.signature,
                },
                ipAddress: ctx.rateLimitContext?.ip || '0.0.0.0',
                userAgent: ctx.rateLimitContext?.userAgent,
              });

              await amlService.monitorTransaction(
                ctx.user.id,
                swapResult.signature || 'unknown',
                input.amount,
                input.fromMint
              );
            } catch (auditError) {
              console.error('Audit/AML logging failed:', auditError);
            }

            return swapResult;
          } catch (error) {
            // Comment 4: Add failed swap to DLQ for retry
            try {
              await deadLetterQueueService.addToQueue({
                operation: 'SWAP',
                payload: {
                  fromMint: input.fromMint,
                  toMint: input.toMint,
                  amount: input.amount,
                  slippage: input.slippage,
                },
                error: error instanceof Error ? error.message : String(error),
                userId: ctx.user.id,
              });
            } catch (dlqError) {
              console.error('Failed to add to DLQ:', dlqError);
            }

            if (error instanceof TRPCError) throw error;
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to swap tokens'
            });
          }
        }
      );

      if (fromCache) {
        console.log('Returning cached idempotent response for swapTokens');
      }

      return result;
    }),

  // Get transaction history
  getTransactionHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await WalletService.getTransactionHistory(ctx.user.id, input.limit);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get transaction history'
        });
      }
    }),

  // Get wallet info
  getWalletInfo: protectedProcedure.query(async ({ ctx }) => {
    try {
      const wallets = await ctx.prisma.wallet.findMany({
        where: { userId: ctx.user.id },
        select: {
          id: true,
          publicKey: true,
          isPrimary: true,
          balance: true,
          network: true,
          createdAt: true,
        }
      });

      return wallets;
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get wallet info'
      });
    }
  }),

  // Set primary wallet
  setPrimaryWallet: protectedProcedure
    .input(z.object({
      walletId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify wallet belongs to user
        const wallet = await ctx.prisma.wallet.findFirst({
          where: {
            id: input.walletId,
            userId: ctx.user.id
          }
        });

        if (!wallet) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Wallet not found'
          });
        }

        // Set all wallets to non-primary
        await ctx.prisma.wallet.updateMany({
          where: { userId: ctx.user.id },
          data: { isPrimary: false }
        });

        // Set selected wallet as primary
        await ctx.prisma.wallet.update({
          where: { id: input.walletId },
          data: { isPrimary: true }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to set primary wallet'
        });
      }
    }),
});
