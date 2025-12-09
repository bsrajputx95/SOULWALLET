import cron from 'node-cron';
import { PerformanceSnapshotService } from '../services/performanceSnapshot';
import { logger } from '../lib/logger';

/**
 * Initialize cron jobs for background tasks
 */
export function initializeCronJobs(): void {
    logger.info('🔄 Initializing cron jobs...');

    // Daily trader performance snapshots - runs at 2 AM every day
    cron.schedule('0 2 * * *', async () => {
        try {
            logger.info('Starting daily trader performance snapshot job');
            await PerformanceSnapshotService.createDailySnapshots();
            logger.info('Completed daily trader performance snapshot job');
        } catch (error) {
            logger.error('Error in daily performance snapshot job:', error);
        }
    });

    logger.info('✅ Cron jobs initialized');
    logger.info('   - Trader performance snapshots: Daily at 2:00 AM');
}

/**
 * Run manual snapshot creation (for testing or initial setup)
 */
export async function runManualSnapshot(): Promise<void> {
    try {
        logger.info('Running manual trader performance snapshot');
        await PerformanceSnapshotService.createDailySnapshots();
        logger.info('Manual snapshot completed');
    } catch (error) {
        logger.error('Error in manual snapshot:', error);
        throw error;
    }
}
