// @ts-nocheck
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { WalletService } from '../../services/walletService';
import { TRPCError } from '@trpc/server';

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

  // Send transaction
  sendTransaction: protectedProcedure
    .input(z.object({
      recipientAddress: z.string(),
      amount: z.number().positive(),
      tokenMint: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await WalletService.sendTransaction({
          userId: ctx.user.id,
          ...input
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send transaction'
        });
      }
    }),

  // Swap tokens
  swapTokens: protectedProcedure
    .input(z.object({
      fromMint: z.string(),
      toMint: z.string(),
      amount: z.number().positive(),
      slippage: z.number().min(0).max(50).default(0.5),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await WalletService.swapTokens({
          userId: ctx.user.id,
          ...input
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to swap tokens'
        });
      }
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
