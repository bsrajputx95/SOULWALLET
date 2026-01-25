import { z } from 'zod';
import { router, protectedProcedure, financialProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import { getFeatureFlags } from '../../lib/featureFlags';
import prisma from '../../lib/prisma';
import { jupiterSwap } from '../../lib/services/jupiterSwap';
import { verifyTotpForUser } from '../../lib/middleware/auth'
import { auditLogService } from '../../lib/services/auditLog'
import { DECIMALS, FEES } from '@/constants'

// Jupiter API base URL
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';

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
      try {
        // Convert amount to smallest unit (assuming 6 decimals for most tokens)
        const amountInSmallestUnit = Math.floor(input.amount * DECIMALS.MICRO_LAMPORTS);

        const params = new URLSearchParams({
          inputMint: input.inputMint === 'SOL' ? 'So11111111111111111111111111111111111111112' : input.inputMint,
          outputMint: input.outputMint === 'SOL' ? 'So11111111111111111111111111111111111111112' : input.outputMint,
          amount: amountInSmallestUnit.toString(),
          slippageBps: Math.floor(input.slippage * 100).toString(),
        });

        const response = await fetch(`${JUPITER_API_URL}/quote?${params}`);

        if (!response.ok) {
          throw new Error(`Jupiter API error: ${response.status}`);
        }

        const quote = await response.json() as any;

        return {
          quote,
          inputAmount: input.amount,
          outputAmount: parseFloat(quote.outAmount || '0') / 1_000_000,
          priceImpact: quote.priceImpactPct || 0,
          route: quote.routePlan || [],
        };
      } catch (error) {
        logger.error('Get quote error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get swap quote',
        });
      }
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
      totpCode: z.string().length(6).optional(),
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
        where: { id: ctx.user.id },
        select: { walletAddress: true },
      });

      if (!user?.walletAddress) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wallet not found',
        });
      }

      try {
        if (!input.totpCode) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA code is required' })
        }
        await verifyTotpForUser(ctx.user.id, input.totpCode)

        // Get quote from Jupiter
        const quote = await jupiterSwap.getQuote({
          inputMint: input.fromMint,
          outputMint: input.toMint,
          amount: Math.floor(input.amount * DECIMALS.MICRO_LAMPORTS),
          slippageBps: Math.floor(input.slippage * (FEES.SWAP.SLIPPAGE_BPS.MAX / FEES.SWAP.SLIPPAGE_PERCENT.MAX)),
        });

        if (!quote) {
          throw new Error('Could not get swap quote');
        }

        // Get real swap transaction from Jupiter for client-side signing
        const swapTx = await jupiterSwap.getSwapTransaction({
          quoteResponse: quote,
          userPublicKey: user.walletAddress,
          wrapAndUnwrapSol: true,
          asLegacyTransaction: true, // Use legacy for better mobile compatibility
        });

        if (!swapTx?.swapTransaction) {
          throw new Error('Could not get swap transaction from Jupiter');
        }

        // Generate a pending signature for tracking (real signature comes from client after signing)
        const pendingSignature = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save transaction to database as PENDING (will be updated after client sends)
        const transaction = await prisma.transaction.create({
          data: {
            userId: ctx.user.id,
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
          userId: ctx.user.id,
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
            outputAmount: parseFloat(quote.outAmount || '0') / 1_000_000,
            priceImpact: quote.priceImpactPct || 0,
          },
          ipAddress: ctx.rateLimitContext?.ip || ctx.req?.ip || ctx.fingerprint?.ipAddress || 'unknown',
          userAgent,
        })


        // AML monitoring removed for beta

        return {
          // Return the real swap transaction for client-side signing
          swapTransaction: swapTx.swapTransaction,
          lastValidBlockHeight: swapTx.lastValidBlockHeight,
          transactionId: transaction.id,
          inputAmount: input.amount,
          outputAmount: parseFloat(quote.outAmount || '0') / 1_000_000,
          priceImpact: quote.priceImpactPct || 0,
          fee: 0.00005,
        };
      } catch (error) {
        logger.error('Swap failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Swap failed',
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
          message: 'Failed to execute swap',
        });
      }
    }),
  */

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
            userId: ctx.user.id,
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
