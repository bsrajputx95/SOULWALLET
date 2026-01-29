import { z } from 'zod';
import { router, protectedProcedure, financialProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import { getFeatureFlags } from '../../lib/featureFlags';
import prisma from '../../lib/prisma';
import { swapService } from '../../lib/services/swapService';
import { auditLogService } from '../../lib/services/auditLog'
import { FEES, toBaseUnits, fromBaseUnits } from '../../../constants'
// BigInt sanitization removed - SuperJSON handles serialization


export const swapRouter = router({
  /**
   * Get Jupiter quote for token swap
   */
  getQuote: protectedProcedure
    .input(z.object({
      inputMint: z.string(),
      outputMint: z.string(),
      amount: z.number().positive(),
      slippage: z.number().min(FEES.SWAP.SLIPPAGE_PERCENT.MIN).max(FEES.SWAP.SLIPPAGE_PERCENT.MAX).default(FEES.SWAP.SLIPPAGE_PERCENT.DEFAULT),
    }))
    .query(async ({ input }) => {
      // Convert input amount to base units using proper decimals
      const inputAmountBaseUnits = toBaseUnits(input.amount, input.inputMint);

      const quote = await swapService.getQuote({
        inputMint: input.inputMint,
        outputMint: input.outputMint,
        amount: inputAmountBaseUnits,
        slippageBps: Math.floor(input.slippage * 100),
      });

      // Convert output amount using output mint decimals
      const outputAmount = fromBaseUnits(quote.outAmount, input.outputMint);
      const priceImpact = Number(quote.priceImpactPct);
      return {
        quote,
        inputAmount: input.amount,
        outputAmount,
        priceImpact,
        route: quote.routePlan || [],
      };
    }),

  /**
   * Execute swap transaction
   */
  swap: financialProcedure
    .input(z.object({
      fromMint: z.string(),
      toMint: z.string(),
      amount: z.number().positive(),
      slippage: z.number().min(0).max(5).default(0.5),
    }))
    .mutation(async ({ input, ctx }) => {
      const { swapEnabled } = getFeatureFlags();
      if (!swapEnabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Swap feature is disabled',
        });
      }

      // Get user wallet
      const user = await prisma.user.findUnique({
        where: { id: ctx.user!.id },
        select: { walletAddress: true },
      });

      if (!user?.walletAddress) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wallet not found',
        });
      }

      try {
        // Convert input amount to base units using proper decimals for the input token
        const inputAmountBaseUnits = toBaseUnits(input.amount, input.fromMint);

        // Get quote via service (cached) - pass base units
        const quote = await swapService.getQuote({
          inputMint: input.fromMint,
          outputMint: input.toMint,
          amount: inputAmountBaseUnits,
          slippageBps: Math.floor(input.slippage * 100),
        });

        if (!quote) {
          throw new Error('Could not get swap quote');
        }

        // Get real swap transaction from Jupiter for client-side signing
        // Pass base units for amount
        const swapTx = await swapService.prepareSwap({
          inputMint: input.fromMint,
          outputMint: input.toMint,
          amount: inputAmountBaseUnits,
          slippageBps: Math.floor(input.slippage * 100),
          userId: ctx.user!.id,
          walletAddress: user.walletAddress,
        });

        if (!swapTx?.swapTransaction) {
          throw new Error('Could not get swap transaction from Jupiter');
        }

        // Generate a pending signature for tracking (real signature comes from client after signing)
        const pendingSignature = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save transaction to database as PENDING (will be updated after client sends)
        const transaction = await prisma.transaction.create({
          data: {
            userId: ctx.user!.id,
            signature: pendingSignature,
            type: 'SWAP',
            amount: input.amount,
            token: input.fromMint,
            tokenSymbol: input.fromMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : input.fromMint.slice(0, 8),
            from: user.walletAddress,
            to: user.walletAddress,
            fee: 0.00005,
            status: 'PENDING',
          },
        });

        const uaHeader = ctx.req?.headers?.['user-agent']
        const userAgent = Array.isArray(uaHeader) ? uaHeader[0] : (typeof uaHeader === 'string' ? uaHeader : ctx.fingerprint?.userAgent)
        const tokenSymbol = input.fromMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : input.fromMint.slice(0, 8)

        await auditLogService.logFinancialOperation({
          userId: ctx.user!.id,
          operation: 'SWAP',
          resourceType: 'Transaction',
          resourceId: transaction.id,
          amount: input.amount,
          currency: tokenSymbol,
          feeAmount: 0.00005,
          metadata: {
            pendingSignature,
            fromMint: input.fromMint,
            toMint: input.toMint,
            slippage: input.slippage,
            outputAmount: fromBaseUnits(quote.outAmount || '0', input.toMint),
            priceImpact: quote.priceImpactPct || 0,
          },
          ipAddress: ctx.rateLimitContext?.ip || ctx.req?.ip || ctx.fingerprint?.ipAddress || 'unknown',
          userAgent,
        })

        // Log response types for debugging
        const computedOutputAmount = fromBaseUnits(quote.outAmount, input.toMint);
        logger.info('Swap response types:', {
          swapTransaction: typeof swapTx.swapTransaction,
          lastValidBlockHeight: typeof swapTx.lastValidBlockHeight,
          transactionId: typeof transaction.id,
          inputAmount: typeof input.amount,
          outputAmount: typeof computedOutputAmount,
          priceImpact: typeof Number(quote.priceImpactPct),
          fee: typeof 0.00005
        });

        // Validate JSON serializability
        try {
          JSON.stringify({
            swapTransaction: swapTx.swapTransaction,
            lastValidBlockHeight: swapTx.lastValidBlockHeight,
            transactionId: transaction.id,
            inputAmount: input.amount,
            outputAmount: computedOutputAmount,
            priceImpact: Number(quote.priceImpactPct),
            fee: 0.00005
          });
          logger.info('Swap response JSON validation: PASSED');
        } catch (jsonError: any) {
          logger.error('Swap response JSON validation: FAILED', {
            error: jsonError.message,
            problematicFields: Object.entries({
              swapTransaction: swapTx.swapTransaction,
              lastValidBlockHeight: swapTx.lastValidBlockHeight,
              transactionId: transaction.id,
              inputAmount: input.amount,
              outputAmount: computedOutputAmount,
              priceImpact: Number(quote.priceImpactPct),
              fee: 0.00005
            }).filter(([_k, v]) => {
              try { JSON.stringify(v); return false; } catch { return true; }
            }).map(([k]) => k)
          });
          throw new Error('Response contains non-serializable values');
        }

        // Return raw values - SuperJSON handles BigInt serialization
        return {
          swapTransaction: swapTx.swapTransaction,
          lastValidBlockHeight: swapTx.lastValidBlockHeight,
          transactionId: transaction.id,
          inputAmount: input.amount,
          outputAmount: computedOutputAmount,
          priceImpact: Number(quote.priceImpactPct),
          fee: 0.00005,
        };
      } catch (error: any) {
        logger.error('Swap failed:', {
          error: error?.message || String(error),
          stack: error?.stack,
          inputMints: { from: input.fromMint, to: input.toMint },
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Swap failed. Please try again.',
        });
      }
    }),

  /**
   * @deprecated This endpoint creates simulated transactions only.
   * Frontend should use client-side wallet signing and call wallet.recordTransaction instead.
   * 
   * DEPRECATED - DO NOT USE
   * Use wallet.recordTransaction endpoint instead after client-side signing
   * 
   * Commented out to prevent accidental use. Uncomment for testing if needed.
   */
  /*
  executeSwap: protectedProcedure
    .input(z.object({
      route: z.any(), // Jupiter route object
      inputMint: z.string(),
      outputMint: z.string(),
      inputAmount: z.number(),
      outputAmount: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { swapEnabled, simulationMode } = getFeatureFlags();
        if (!swapEnabled) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Swap feature is disabled' });
        }
        if (!simulationMode) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'On-chain swap is not enabled in this environment' });
        }
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User wallet not found',
          });
        }

        // In a real implementation, you would:
        // 1. Get the swap transaction from Jupiter
        // 2. Sign it with the user's wallet
        // 3. Send it to the network
        // 4. Monitor for confirmation

        // For now, simulate a successful swap
        const signature = 'swap_signature_' + Date.now();

        // Save swap transaction to database
        const swapTransaction = await prisma.transaction.create({
          data: {
            userId: ctx.user.id,
            signature,
            type: 'SWAP',
            amount: input.inputAmount,
            token: input.inputMint,
            tokenSymbol: input.inputMint === 'SOL' ? 'SOL' : input.inputMint,
            from: user.walletAddress,
            to: user.walletAddress, // Swap is to same wallet
            fee: 0.001, // Estimated swap fee
            status: 'PENDING',
            notes: `Swapped ${input.inputAmount} ${input.inputMint} for ${input.outputAmount} ${input.outputMint}`,
          },
        });

        return {
          success: true,
          signature,
          transaction: swapTransaction,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Execute swap error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Swap execution failed',
        });
      }
    }),
  */

  /**
   * Confirm swap after client-side signing
   * Called by frontend after transaction is sent to update status with real signature
   */
  confirmSwap: protectedProcedure
    .input(z.object({
      transactionId: z.string(),
      signature: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify the transaction belongs to this user
        const transaction = await prisma.transaction.findUnique({
          where: { id: input.transactionId },
          select: { userId: true, status: true },
        });

        if (!transaction) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Transaction not found',
          });
        }

        if (transaction.userId !== ctx.user!.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Not authorized to update this transaction',
          });
        }

        // Update the transaction with the real signature and mark as processing
        await swapService.updateSwapStatus(input.transactionId, 'PROCESSING', input.signature);

        logger.info(`Swap confirmed: ${input.transactionId} with signature ${input.signature.substring(0, 16)}...`);

        return { success: true, status: 'PROCESSING' };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Confirm swap error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to confirm swap',
        });
      }
    }),

  /**
   * Poll swap status
   */
  getSwapStatus: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .query(async ({ input }) => swapService.getSwapStatus(input.transactionId)),

  /**
   * Get supported tokens for swapping
   */
  getSupportedTokens: protectedProcedure
    .query(async () => {
      try {
        // In a real implementation, you would fetch this from Jupiter or maintain your own list
        const supportedTokens = [
          {
            mint: 'SOL',
            symbol: 'SOL',
            name: 'Solana',
            decimals: 9,
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          },
          {
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
          },
          {
            mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 6,
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
          },
        ];

        return { tokens: supportedTokens };
      } catch (error) {
        logger.error('Get supported tokens error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get supported tokens',
        });
      }
    }),

  /**
   * Get swap history
   */
  getSwapHistory: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const swaps = await prisma.transaction.findMany({
          where: {
            userId: ctx.user!.id,
            type: 'SWAP',
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit + 1,
          ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        });

        let nextCursor: string | undefined;
        if (swaps.length > input.limit) {
          const next = swaps.pop();
          nextCursor = next?.id;
        }

        return {
          swaps,
          nextCursor,
        };
      } catch (error) {
        logger.error('Get swap history error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get swap history',
        });
      }
    }),
});
