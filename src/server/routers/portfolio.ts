import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { marketData } from '../../lib/services/marketData';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

// Helper to fetch SPL token balances
interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
}

async function getSPLTokenBalances(publicKey: PublicKey): Promise<TokenBalance[]> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    return tokenAccounts.value
      .map(account => {
        const info = account.account.data.parsed.info;
        return {
          mint: info.mint as string,
          balance: parseFloat(info.tokenAmount.uiAmountString || '0'),
          decimals: info.tokenAmount.decimals as number,
        };
      })
      .filter(token => token.balance > 0); // Only include tokens with balance
  } catch (error) {
    logger.warn('Failed to fetch SPL token balances:', error);
    return [];
  }
}

// Helper to get token prices in batch
async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // Check cache first
  const cachedPrices = await prisma.tokenPrice.findMany({
    where: { tokenMint: { in: mints } },
  });
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const mintsToFetch: string[] = [];
  
  for (const mint of mints) {
    const cached = cachedPrices.find(p => p.tokenMint === mint);
    if (cached && cached.updatedAt > fiveMinutesAgo) {
      prices[mint] = cached.priceUSD;
    } else {
      mintsToFetch.push(mint);
    }
  }
  
  // Fetch missing prices from DexScreener
  for (const mint of mintsToFetch) {
    try {
      const tokenData = await marketData.getToken(mint);
      if (tokenData?.pairs?.[0]?.priceUsd) {
        const price = parseFloat(tokenData.pairs[0].priceUsd);
        prices[mint] = price;
        
        // Update cache
        await prisma.tokenPrice.upsert({
          where: { tokenMint: mint },
          create: {
            tokenMint: mint,
            tokenSymbol: tokenData.pairs[0].baseToken?.symbol || 'UNKNOWN',
            priceUSD: price,
          },
          update: {
            priceUSD: price,
            updatedAt: new Date(),
          },
        }).catch(() => {}); // Ignore cache update errors
      }
    } catch (error) {
      // Skip tokens we can't price
      logger.debug(`Could not fetch price for ${mint}`);
    }
  }
  
  return prices;
}

export const portfolioRouter = router({
  /**
   * Get current portfolio overview
   */
  getOverview: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Handle no wallet gracefully - return zero balance
        if (!ctx.user.walletAddress) {
          return {
            totalValue: 0,
            solBalance: 0,
            solPrice: 0,
            change24h: 0,
            change24hValue: 0,
            recentTransactions: [],
            walletConnected: false,
            tokenCount: 0,
          };
        }

        const publicKey = new PublicKey(ctx.user.walletAddress);
        
        // Get SOL balance
        const solBalance = await connection.getBalance(publicKey);
        const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;

        // Get SPL token balances
        const splTokens = await getSPLTokenBalances(publicKey);

        // Get real SOL price from cache or DexScreener
        let solPrice = 100; // Default fallback price
        const solMint = 'So11111111111111111111111111111111111111112';
        
        try {
          // Try TokenPrice table first (cached price)
          const cachedPrice = await prisma.tokenPrice.findUnique({
            where: { tokenMint: solMint },
          });
          
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          
          if (cachedPrice && cachedPrice.updatedAt > fiveMinutesAgo) {
            // Use cached price if less than 5 minutes old
            solPrice = cachedPrice.priceUSD;
          } else {
            // Fetch fresh price from DexScreener
            try {
              const tokenData = await marketData.getToken(solMint);
              if (tokenData?.pairs?.[0]?.priceUsd) {
                solPrice = parseFloat(tokenData.pairs[0].priceUsd);
                
                // Update cache
                await prisma.tokenPrice.upsert({
                  where: { tokenMint: solMint },
                  create: {
                    tokenMint: solMint,
                    tokenSymbol: 'SOL',
                    priceUSD: solPrice,
                  },
                  update: { 
                    priceUSD: solPrice,
                    updatedAt: new Date(),
                  },
                });
              }
            } catch (err) {
              logger.warn('Failed to fetch SOL price from DexScreener, using cached/default', err);
            }
          }
        } catch (error) {
          logger.warn('Error fetching SOL price, using default', error);
        }
        
        // Calculate SOL value
        const solValue = solBalanceFormatted * solPrice;

        // Get prices for all SPL tokens and calculate total value
        let splTokensValue = 0;
        if (splTokens.length > 0) {
          const tokenMints = splTokens.map(t => t.mint);
          const tokenPrices = await getTokenPrices(tokenMints);
          
          for (const token of splTokens) {
            const price = tokenPrices[token.mint] || 0;
            splTokensValue += token.balance * price;
          }
        }

        // Total portfolio value = SOL + all SPL tokens
        const totalValue = solValue + splTokensValue;

        // Get recent transactions for activity
        const recentTransactions = await prisma.transaction.findMany({
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        // ✅ Calculate real 24h change from snapshots
        let change24h = 0;
        let change24hValue = 0;
        
        try {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const oldSnapshot = await prisma.portfolioSnapshot.findFirst({
            where: {
              userId: ctx.user.id,
              timestamp: { gte: oneDayAgo },
            },
            orderBy: { timestamp: 'asc' },
          });

          if (oldSnapshot && oldSnapshot.totalValueUSD > 0) {
            // Calculate real 24h change
            change24hValue = totalValue - oldSnapshot.totalValueUSD;
            change24h = (change24hValue / oldSnapshot.totalValueUSD) * 100;
          }
        } catch (error) {
          logger.warn('Could not calculate 24h change from snapshots', error);
        }

        return {
          totalValue,
          solBalance: solBalanceFormatted,
          solPrice,
          change24h,          // ✅ Real 24h change percentage
          change24hValue,     // ✅ Real 24h change in USD
          recentTransactions,
          walletConnected: true,
          tokenCount: splTokens.length + 1, // +1 for SOL
          splTokensValue,     // Value of all SPL tokens
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Get portfolio overview error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get portfolio overview',
        });
      }
    }),

  /**
   * Create a portfolio snapshot
   */
  createSnapshot: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        if (!ctx.user.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No wallet address found',
          });
        }

        const publicKey = new PublicKey(ctx.user.walletAddress);
        
        // Get current SOL balance
        const solBalance = await connection.getBalance(publicKey);
        const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;

        // Get real SOL price
        let solPrice = 100; // Default fallback
        const solMint = 'So11111111111111111111111111111111111111112';
        
        try {
          const cachedPrice = await prisma.tokenPrice.findUnique({
            where: { tokenMint: solMint },
          });
          
          if (cachedPrice && (Date.now() - cachedPrice.updatedAt.getTime()) < 300000) {
            solPrice = cachedPrice.priceUSD;
          } else {
            try {
              const tokenData = await marketData.getToken(solMint);
              if (tokenData?.pairs?.[0]?.priceUsd) {
                solPrice = parseFloat(tokenData.pairs[0].priceUsd);
              }
            } catch (err) {
              logger.warn('Using cached/default SOL price for snapshot', err);
            }
          }
        } catch (error) {
          logger.warn('Error fetching SOL price for snapshot', error);
        }
        
        const totalValue = solBalanceFormatted * solPrice;

        // Create snapshot
        const snapshot = await prisma.portfolioSnapshot.create({
          data: {
            userId: ctx.user.id,
            totalValueUSD: totalValue,
            tokens: {
              SOL: {
                symbol: 'SOL',
                balance: solBalanceFormatted,
                value: totalValue,
              },
            },
          },
        });

        return {
          success: true,
          snapshot,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Create portfolio snapshot error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create portfolio snapshot',
        });
      }
    }),

  /**
   * Get portfolio history/snapshots
   */
  getHistory: protectedProcedure
    .input(z.object({
      period: z.enum(['1D', '7D', '30D', '90D', '1Y']).default('7D'),
      limit: z.number().max(365).default(100),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Calculate date range based on period
        const now = new Date();
        const startDate = new Date();
        
        switch (input.period) {
          case '1D':
            startDate.setDate(now.getDate() - 1);
            break;
          case '7D':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30D':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90D':
            startDate.setDate(now.getDate() - 90);
            break;
          case '1Y':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }

        const snapshots = await prisma.portfolioSnapshot.findMany({
          where: {
            userId: ctx.user.id,
            timestamp: {
              gte: startDate,
            },
          },
          orderBy: { timestamp: 'asc' },
          take: input.limit,
        });

        // If no snapshots exist, create one with full portfolio value
        if (snapshots.length === 0 && ctx.user.walletAddress) {
          try {
            const publicKey = new PublicKey(ctx.user.walletAddress);
            const solMint = 'So11111111111111111111111111111111111111112';
            
            // Get SOL balance
            const solBalance = await connection.getBalance(publicKey);
            const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;
            
            // Get SPL token balances
            const splTokens = await getSPLTokenBalances(publicKey);
            
            // Get all prices
            const allMints = [solMint, ...splTokens.map(t => t.mint)];
            const prices = await getTokenPrices(allMints);
            
            const solPrice = prices[solMint] || 100;
            const solValue = solBalanceFormatted * solPrice;
            
            // Build tokens object for snapshot
            const tokens: Record<string, { symbol: string; balance: number; value: number }> = {
              SOL: {
                symbol: 'SOL',
                balance: solBalanceFormatted,
                value: solValue,
              },
            };
            
            let totalValue = solValue;
            
            for (const token of splTokens) {
              const price = prices[token.mint] || 0;
              const value = token.balance * price;
              totalValue += value;
              
              const cachedInfo = await prisma.tokenPrice.findUnique({
                where: { tokenMint: token.mint },
              });
              
              tokens[token.mint] = {
                symbol: cachedInfo?.tokenSymbol || 'UNKNOWN',
                balance: token.balance,
                value,
              };
            }

            const newSnapshot = await prisma.portfolioSnapshot.create({
              data: {
                userId: ctx.user.id,
                totalValueUSD: totalValue,
                tokens,
              },
            });

            logger.info(`Created initial portfolio snapshot for user ${ctx.user.id}: $${totalValue.toFixed(2)}`);

            return {
              snapshots: [newSnapshot],
              period: input.period,
            };
          } catch (error) {
            logger.error('Error creating initial snapshot:', error);
          }
        }

        return {
          snapshots,
          period: input.period,
        };
      } catch (error) {
        logger.error('Get portfolio history error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get portfolio history',
        });
      }
    }),

  /**
   * Get portfolio performance metrics
   */
  getPerformance: protectedProcedure
    .input(z.object({
      period: z.enum(['1D', '7D', '30D', '90D', '1Y']).default('30D'),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        
        switch (input.period) {
          case '1D':
            startDate.setDate(now.getDate() - 1);
            break;
          case '7D':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30D':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90D':
            startDate.setDate(now.getDate() - 90);
            break;
          case '1Y':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }

        // Get snapshots for the period
        const snapshots = await prisma.portfolioSnapshot.findMany({
          where: {
            userId: ctx.user.id,
            timestamp: {
              gte: startDate,
            },
          },
          orderBy: { timestamp: 'asc' },
        });

        if (snapshots.length < 2) {
          return {
            period: input.period,
            totalReturn: 0,
            totalReturnPercentage: 0,
            highestValue: 0,
            lowestValue: 0,
            averageValue: 0,
          };
        }

        const firstSnapshot = snapshots[0]!;
        const lastSnapshot = snapshots[snapshots.length - 1]!;
        
        const totalReturn = lastSnapshot.totalValueUSD - firstSnapshot.totalValueUSD;
        const totalReturnPercentage = (totalReturn / firstSnapshot.totalValueUSD) * 100;
        
        const values = snapshots.map(s => s.totalValueUSD);
        const highestValue = Math.max(...values);
        const lowestValue = Math.min(...values);
        const averageValue = values.reduce((sum, val) => sum + val, 0) / values.length;

        return {
          period: input.period,
          totalReturn,
          totalReturnPercentage,
          highestValue,
          lowestValue,
          averageValue,
          snapshotCount: snapshots.length,
        };
      } catch (error) {
        logger.error('Get portfolio performance error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get portfolio performance',
        });
      }
    }),

  /**
   * Get asset breakdown with all tokens
   */
  getAssetBreakdown: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Handle no wallet gracefully
        if (!ctx.user.walletAddress) {
          return {
            assets: [],
            totalValue: 0,
            walletConnected: false,
          };
        }

        const publicKey = new PublicKey(ctx.user.walletAddress);
        const solMint = 'So11111111111111111111111111111111111111112';
        
        // Get SOL balance
        const solBalance = await connection.getBalance(publicKey);
        const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;

        // Get SPL token balances
        const splTokens = await getSPLTokenBalances(publicKey);

        // Get all token prices (including SOL)
        const allMints = [solMint, ...splTokens.map(t => t.mint)];
        const prices = await getTokenPrices(allMints);
        
        const solPrice = prices[solMint] || 100;
        const solValue = solBalanceFormatted * solPrice;

        // Build assets array
        const assets: Array<{
          symbol: string;
          name: string;
          mint: string;
          balance: number;
          price: number;
          value: number;
          percentage: number;
        }> = [];

        // Add SOL
        assets.push({
          symbol: 'SOL',
          name: 'Solana',
          mint: solMint,
          balance: solBalanceFormatted,
          price: solPrice,
          value: solValue,
          percentage: 0, // Will calculate after total
        });

        // Add SPL tokens
        for (const token of splTokens) {
          const price = prices[token.mint] || 0;
          const value = token.balance * price;
          
          // Get token info from cache if available
          const cachedInfo = await prisma.tokenPrice.findUnique({
            where: { tokenMint: token.mint },
          });

          assets.push({
            symbol: cachedInfo?.tokenSymbol || 'UNKNOWN',
            name: cachedInfo?.tokenSymbol || 'Unknown Token',
            mint: token.mint,
            balance: token.balance,
            price,
            value,
            percentage: 0,
          });
        }

        // Calculate total value and percentages
        const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
        
        for (const asset of assets) {
          asset.percentage = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
        }

        // Sort by value descending
        assets.sort((a, b) => b.value - a.value);

        return {
          assets,
          totalValue,
          walletConnected: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Get asset breakdown error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get asset breakdown',
        });
      }
    }),

  /**
   * Get profit and loss calculation for a given period
   */
  getPNL: protectedProcedure
    .input(z.object({
      period: z.enum(['1d', '7d', '30d', 'all']).default('30d'),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        
        if (input.period !== 'all') {
          const days = { '1d': 1, '7d': 7, '30d': 30 }[input.period];
          startDate.setDate(startDate.getDate() - days);
        } else {
          startDate.setFullYear(2020); // Beginning of time for 'all'
        }

        // Get all transactions in the period
        const transactions = await prisma.transaction.findMany({
          where: {
            userId: ctx.user.id,
            createdAt: { 
              gte: startDate,
              lte: endDate,
            },
            status: 'CONFIRMED',
          },
          orderBy: { createdAt: 'asc' },
        });

        // Calculate P&L
        let totalReceived = 0;
        let totalSent = 0;
        let totalSwapFees = 0;
        let swapCount = 0;
        let sendCount = 0;
        let receiveCount = 0;

        for (const tx of transactions) {
          if (tx.type === 'RECEIVE') {
            totalReceived += tx.amount;
            receiveCount++;
          } else if (tx.type === 'SEND') {
            totalSent += tx.amount;
            sendCount++;
          } else if (tx.type === 'SWAP') {
            // For swaps, we'd need entry/exit prices for accurate P&L
            // For now, count fees
            totalSwapFees += tx.fee || 0;
            swapCount++;
          }
        }

        // Simple P&L calculation (received - sent - fees)
        const grossProfit = totalReceived - totalSent;
        const netProfit = grossProfit - totalSwapFees;
        
        // Get current portfolio value for percentage calculation
        // Instead of calling getOverview, calculate directly
        let currentValue = 0;
        if (ctx.user.walletAddress) {
          const publicKey = new PublicKey(ctx.user.walletAddress);
          const solBalance = await connection.getBalance(publicKey);
          const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;
          
          // Use a simple default price for P&L percentage calculation
          const solPrice = 100; // Can be enhanced to use real price if needed
          currentValue = solBalanceFormatted * solPrice;
        }
        
        // Calculate percentage returns if we have a current value
        const returnPercentage = currentValue > 0 
          ? (netProfit / currentValue) * 100 
          : 0;

        return {
          period: input.period,
          startDate,
          endDate,
          totalReceived,
          totalSent,
          totalSwapFees,
          grossProfit,
          netProfit,
          returnPercentage,
          transactionCount: transactions.length,
          breakdown: {
            sends: sendCount,
            receives: receiveCount,
            swaps: swapCount,
          },
        };
      } catch (error) {
        logger.error('Get P&L error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to calculate P&L',
        });
      }
    }),
});