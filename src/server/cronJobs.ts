import cron from 'node-cron';
import { PerformanceSnapshotService } from '../services/performanceSnapshot';
import { JWTRotationService, jwtSecretCache } from '../lib/services/jwtRotation';
import { logRetentionService } from '../lib/services/logRetention';
import { logger } from '../lib/logger';

/**
 * Initialize cron jobs for background tasks
 */
export async function initializeCronJobs(): Promise<void> {
    logger.info('🔄 Initializing cron jobs...');

    // Initialize JWT secret cache from environment variables
    // This must happen before AuthService is used
    try {
        await jwtSecretCache.initialize();
        logger.info('✅ JWT secret cache initialized');
    } catch (error) {
        logger.error('Failed to initialize JWT secret cache:', error);
        // In production, this should be a fatal error
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT secret cache initialization failed - cannot start server');
        }
    }

    // Initialize JWT rotation tracking from environment (legacy - for DB tracking)
    try {
        await JWTRotationService.initializeFromEnv();
        logger.info('✅ JWT rotation tracking initialized');
    } catch (error) {
        logger.error('Failed to initialize JWT rotation tracking:', error);
    }

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

    // Weekly JWT rotation check - runs every Sunday at 3 AM
    // This checks if rotation is needed based on secret age and expires
    cron.schedule('0 3 * * 0', async () => {
        try {
            logger.info('Starting weekly JWT rotation check');
            const result = await JWTRotationService.checkAndRotate('system-cron');

            if (result.accessRotated || result.refreshRotated) {
                logger.warn('JWT secrets were rotated! Update environment variables immediately.', {
                    accessRotated: result.accessRotated,
                    refreshRotated: result.refreshRotated,
                });
            }

            logger.info('Completed JWT rotation check', {
                result: result.message.substring(0, 200)
            });
        } catch (error) {
            logger.error('Error in JWT rotation check job:', error);
        }
    });

    // Daily JWT secret cleanup - runs at 4 AM every day
    // Deactivates expired secrets and cleans up old records
    cron.schedule('0 4 * * *', async () => {
        try {
            logger.info('Starting daily JWT secret cleanup');
            const result = await JWTRotationService.cleanupExpiredSecrets();
            logger.info('Completed JWT secret cleanup', result);
        } catch (error) {
            logger.error('Error in JWT secret cleanup job:', error);
        }
    });

    // Daily log retention cleanup - runs at 2:30 AM every day (Plan6 Step 8)
    // Cleans session activities (90 days), login attempts (30 days), expired exports (7 days)
    cron.schedule('30 2 * * *', async () => {
        try {
            logger.info('Starting daily log retention cleanup');
            const result = await logRetentionService.cleanupExpiredLogs();
            logger.info('Completed log retention cleanup', {
                sessionActivitiesDeleted: result.sessionActivities,
                loginAttemptsDeleted: result.loginAttempts,
                expiredExportsDeleted: result.expiredExports,
            });

            // Also archive old audit logs
            const archiveResult = await logRetentionService.archiveOldAuditLogs();
            if (archiveResult.count > 0) {
                logger.info('Archived old audit logs', archiveResult);
            }
        } catch (error) {
            logger.error('Error in log retention cleanup job:', error);
        }
    });

    // GDPR deletion processing - runs daily at 3 AM
    // Processes pending deletion requests after 30-day grace period
    cron.schedule('0 3 * * *', async () => {
        try {
            logger.info('Starting GDPR deletion processing');
            const { gdprService } = await import('../lib/services/gdpr');
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();

            // Get configurable grace period and batch size from env
            const gracePeriodDays = parseInt(process.env.GDPR_DELETION_GRACE_PERIOD_DAYS || '30', 10);
            const batchSize = parseInt(process.env.GDPR_DELETION_BATCH_SIZE || '10', 10);

            // Calculate grace period date
            const graceDate = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000);

            // Find pending deletions that have passed grace period
            const pendingDeletions = await prisma.dataDeletionRequest.findMany({
                where: {
                    status: 'PENDING',
                    createdAt: { lt: graceDate }
                },
                take: batchSize,
                orderBy: { createdAt: 'asc' }
            });

            if (pendingDeletions.length === 0) {
                logger.debug('No pending GDPR deletions to process');
                await prisma.$disconnect();
                return;
            }

            logger.info(`Processing ${pendingDeletions.length} GDPR deletion requests`);

            let processed = 0;
            let failed = 0;

            for (const request of pendingDeletions) {
                try {
                    await gdprService.processDataDeletion(request.id, 'system-cron');
                    processed++;
                    logger.info('GDPR deletion completed', {
                        requestId: request.id,
                        userId: request.userId
                    });
                } catch (error) {
                    failed++;
                    logger.error('GDPR deletion failed for request', {
                        requestId: request.id,
                        error
                    });
                }
            }

            await prisma.$disconnect();
            logger.info('GDPR deletion processing completed', { processed, failed });
        } catch (error) {
            logger.error('Error in GDPR deletion job:', error);
        }
    });

    logger.info('✅ Cron jobs initialized');
    logger.info('   - Trader performance snapshots: Daily at 2:00 AM');
    logger.info('   - Log retention cleanup: Daily at 2:30 AM');
    logger.info('   - GDPR deletion processing: Daily at 3:00 AM');
    logger.info('   - JWT rotation check: Weekly on Sunday at 3:00 AM');
    logger.info('   - JWT secret cleanup: Daily at 4:00 AM');
    logger.info('   - DLQ processing: Every 5 minutes');
    logger.info('   - Market cache refresh: Every 2 minutes');

    // Market cache refresh - runs every 2 minutes (Comment 3)
    cron.schedule('*/2 * * * *', async () => {
        try {
            logger.debug('Running market cache refresh');
            const { warmMarketCache } = await import('../lib/services/marketData');
            await warmMarketCache();
        } catch (error) {
            logger.error('Error in market cache refresh job:', error);
        }
    });

    // Plan7: DLQ processor job - runs every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            logger.debug('Running DLQ processor job');
            const { dlqProcessor, initializeDLQHandlers } = await import('../lib/services/dlqProcessor');

            // Ensure handlers are initialized
            if (dlqProcessor.getStatus().registeredHandlers.length === 0) {
                await initializeDLQHandlers();
            }

            const result = await dlqProcessor.processQueue();
            if (result.processed > 0) {
                logger.info('DLQ processor completed', result);
            }
        } catch (error) {
            logger.error('Error in DLQ processor job:', error);
        }
    });
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

/**
 * Manually trigger JWT rotation check (for admin use)
 */
export async function runManualJWTRotationCheck(rotatedBy?: string): Promise<{
    accessRotated: boolean;
    refreshRotated: boolean;
    message: string;
}> {
    try {
        logger.info('Running manual JWT rotation check', { rotatedBy });
        const result = await JWTRotationService.checkAndRotate(rotatedBy);
        logger.info('Manual JWT rotation check completed', {
            accessRotated: result.accessRotated,
            refreshRotated: result.refreshRotated,
        });
        return result;
    } catch (error) {
        logger.error('Error in manual JWT rotation check:', error);
        throw error;
    }
}
