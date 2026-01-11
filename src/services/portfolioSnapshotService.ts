/**
 * Portfolio Snapshot Service
 * Automatically creates portfolio snapshots for all users
 * to enable accurate 24h/7d/30d change calculations
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { marketData } from '../lib/services/marketData';
import { rpcManager } from '../lib/services/rpcManager';
import { redisCache, getCacheTtls } from '../lib/redis'

let snapshotInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export async function startPortfolioSnapshotService() {
  if (isRunning) {
    logger.info('Portfolio snapshot service already running');
    return;
  }

  logger.info('Starting portfolio snapshot service...');
  isRunning = true;

  // Create snapshots every hour
  snapshotInterval = setInterval(async () => {
    try {
      await createSnapshotsForAllUsers();
    } catch (error) {
      logger.error('Portfolio snapshot service error:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Run immediately on startup
  await createSnapshotsForAllUsers();

  logger.info('Portfolio snapshot service started - running every hour');
}

export function stopPortfolioSnapshotService() {
  if (snapshotInterval) {
    clearInterval(snapshotInterval);
    snapshotInterval = null;
    isRunning = false;
    logger.info('Portfolio snapshot service stopped');
  }
}

async function createSnapshotsForAllUsers() {
  try {
    // Get all users with wallet addresses
    const users = await prisma.user.findMany({
      where: {
        walletAddress: { not: null }
      },
      select: {
        id: true,
        walletAddress: true
      }
    });

    logger.info(`Creating portfolio snapshots for ${users.length} users...`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        await createSnapshotForUser(user.id, user.walletAddress!);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Failed to create snapshot for user ${user.id}:`, error);
      }
    }

    logger.info(`Portfolio snapshots created: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    logger.error('Error creating snapshots for all users:', error);
  }
}

async function createSnapshotForUser(userId: string, walletAddress: string) {
  const recentSnapshot = await prisma.portfolioSnapshot.findFirst({
    where: {
      userId,
      timestamp: { gte: new Date(Date.now() - 55 * 60 * 1000) },
    },
  });

  if (recentSnapshot) {
    return;
  }

  const publicKey = new PublicKey(walletAddress);

  const solBalance = await rpcManager.withFailover((connection) => connection.getBalance(publicKey));
  const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;

  let solPrice = 100;
  const solMint = 'So11111111111111111111111111111111111111112';
  const ttls = getCacheTtls();

  try {
    // Comment 4: First check Redis cache for SOL price
    const cachedSolPrice = await redisCache.get<number>('portfolio:sol:price');
    if (typeof cachedSolPrice === 'number' && cachedSolPrice > 0) {
      solPrice = cachedSolPrice;
      logger.debug(`Using cached SOL price: $${solPrice}`);
    } else {
      // Fallback to database cache
      const cachedPrice = await prisma.tokenPrice.findUnique({
        where: { tokenMint: solMint },
      });

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (cachedPrice && cachedPrice.updatedAt > fiveMinutesAgo) {
        solPrice = cachedPrice.priceUSD;
        // Cache in Redis for faster access
        await redisCache.set('portfolio:sol:price', solPrice, ttls.price);
      } else {
        try {
          const tokenData = await marketData.getToken(solMint);
          if (tokenData?.pairs?.[0]?.priceUsd) {
            solPrice = parseFloat(tokenData.pairs[0].priceUsd);

            // Cache SOL price in Redis
            await redisCache.set('portfolio:sol:price', solPrice, ttls.price);

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
          logger.debug(`Using cached/default price for snapshot (user ${userId})`, err);
        }
      }
    }
  } catch (error) {
    logger.debug(`Error fetching SOL price for snapshot (user ${userId})`, error);
  }

  const totalValue = solBalanceFormatted * solPrice;

  const snapshot = await prisma.portfolioSnapshot.create({
    data: {
      userId,
      totalValueUSD: totalValue,
      tokens: {
        SOL: {
          symbol: 'SOL',
          balance: solBalanceFormatted,
          value: totalValue,
          price: solPrice,
        },
      },
    },
  });

  // Comment 4: Cache the snapshot in Redis with portfolio TTL
  const snapshotData = {
    totalValueUSD: totalValue,
    tokens: {
      SOL: {
        symbol: 'SOL',
        balance: solBalanceFormatted,
        value: totalValue,
        price: solPrice,
      },
    },
    timestamp: snapshot.timestamp,
  };
  await redisCache.set(`portfolio:snapshot:${userId}` as any, snapshotData, ttls.portfolio);

  logger.debug(`Snapshot created and cached for user ${userId}: $${totalValue.toFixed(2)}`);
}

/**
 * Manual trigger for creating a snapshot for a specific user
 */
export async function createManualSnapshot(userId: string, walletAddress: string) {
  try {
    await createSnapshotForUser(userId, walletAddress);
    logger.info(`Manual snapshot created for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to create manual snapshot for user ${userId}:`, error);
    throw error;
  }
}
