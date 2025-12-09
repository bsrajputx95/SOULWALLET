import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Service to create and manage historical performance snapshots for traders
 */
export class PerformanceSnapshotService {
    /**
     * Create daily snapshots for all active traders
     * Should be called by cron job daily
     */
    static async createDailySnapshots(): Promise<void> {
        try {
            logger.info('Starting daily performance snapshot creation');

            const traders = await prisma.traderProfile.findMany({
                where: { isFeatured: true }, // Only track featured traders
                include: {
                    copiers: {
                        where: { isActive: true },
                        include: {
                            positions: {
                                where: { status: 'CLOSED' },
                                orderBy: { exitTimestamp: 'desc' },
                            },
                        },
                    },
                },
            });

            const snapshotsToCreate = [];

            for (const trader of traders) {
                // Calculate total PnL from all copiers
                let totalPnL = 0;
                let totalTrades = 0;

                for (const copier of trader.copiers) {
                    for (const position of copier.positions) {
                        if (position.profitLoss) {
                            totalPnL += position.profitLoss;
                            totalTrades++;
                        }
                    }
                }

                // Calculate ROI percentage
                const roi = trader.totalROI || 0;

                // Create snapshot
                snapshotsToCreate.push({
                    traderId: trader.id,
                    date: new Date(),
                    roi,
                    totalPnL,
                    totalTrades,
                    totalFollowers: trader.totalFollowers,
                    winRate: trader.winRate,
                });
            }

            if (snapshotsToCreate.length > 0) {
                await prisma.traderPerformanceSnapshot.createMany({
                    data: snapshotsToCreate,
                });

                logger.info(`Created ${snapshotsToCreate.length} trader performance snapshots`);
            } else {
                logger.info('No trader snapshots to create');
            }
        } catch (error) {
            logger.error('Error creating daily performance snapshots:', error);
            throw error;
        }
    }

    /**
     * Get historical performance data for a trader
     */
    static async getTraderPerformance(
        traderId: string,
        days: number
    ): Promise<Array<{ date: Date; roi: number; totalPnL: number }>> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const snapshots = await prisma.traderPerformanceSnapshot.findMany({
                where: {
                    traderId,
                    date: { gte: startDate },
                },
                orderBy: { date: 'asc' },
                select: {
                    date: true,
                    roi: true,
                    totalPnL: true,
                },
            });

            return snapshots;
        } catch (error) {
            logger.error('Error fetching trader performance:', error);
            return [];
        }
    }

    /**
     * Calculate current performance for a trader (real-time)
     */
    static async calculateCurrentPerformance(traderId: string): Promise<{
        roi: number;
        totalPnL: number;
        totalTrades: number;
        winRate: number;
    }> {
        try {
            const trader = await prisma.traderProfile.findUnique({
                where: { id: traderId },
                include: {
                    copiers: {
                        where: { isActive: true },
                        include: {
                            positions: {
                                where: { status: 'CLOSED' },
                            },
                        },
                    },
                },
            });

            if (!trader) {
                return { roi: 0, totalPnL: 0, totalTrades: 0, winRate: 0 };
            }

            let totalPnL = 0;
            let totalTrades = 0;
            let winningTrades = 0;

            for (const copier of trader.copiers) {
                for (const position of copier.positions) {
                    totalTrades++;
                    if (position.profitLoss) {
                        totalPnL += position.profitLoss;
                        if (position.profitLoss > 0) {
                            winningTrades++;
                        }
                    }
                }
            }

            const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

            return {
                roi: trader.totalROI,
                totalPnL,
                totalTrades,
                winRate,
            };
        } catch (error) {
            logger.error('Error calculating current performance:', error);
            return { roi: 0, totalPnL: 0, totalTrades: 0, winRate: 0 };
        }
    }
}
