import { router, protectedProcedure } from '../trpc';
import { logger } from '../../lib/logger';

/**
 * Queue router for exposing execution queue status to clients.
 * Enables transparency about transaction processing status.
 */
export const queueRouter = router({
    /**
     * Get current queue status including active jobs and health indicators.
     * Used by QueueStatusBanner component to show users when system is under load.
     */
    getStatus: protectedProcedure.query(async () => {
        try {
            // Import execution queue dynamically to avoid circular deps
            const { executionQueue } = await import('../../lib/services/executionQueue');

            // Get queue statistics
            const stats = await executionQueue.getQueueStats();

            // Calculate total active jobs across all queues
            const activeJobs =
                (stats.buy?.active || 0) +
                (stats.sell?.active || 0) +
                (stats.transaction?.active || 0) +
                (stats.profit?.active || 0);

            // Calculate total failed jobs
            const failedJobs =
                (stats.buy?.failed || 0) +
                (stats.sell?.failed || 0) +
                (stats.transaction?.failed || 0) +
                (stats.profit?.failed || 0);

            // Calculate total completed jobs for ratio-based health
            const completedJobs =
                (stats.buy?.completed || 0) +
                (stats.sell?.completed || 0) +
                (stats.transaction?.completed || 0) +
                (stats.profit?.completed || 0);

            // Check if queues are responsive
            const waitingJobs =
                (stats.buy?.waiting || 0) +
                (stats.sell?.waiting || 0) +
                (stats.transaction?.waiting || 0) +
                (stats.profit?.waiting || 0);

            // Determine health status based on RECENT failure rate, not lifetime counts
            // Use ratio of failed to total processed to avoid permanent degraded state
            let health: 'healthy' | 'degraded' | 'down' = 'healthy';

            const totalProcessed = completedJobs + failedJobs;
            const failureRatio = totalProcessed > 0 ? failedJobs / totalProcessed : 0;

            // Only consider failure rate if we have meaningful sample size (> 10 jobs)
            if (totalProcessed > 10) {
                if (failureRatio > 0.5) {
                    // More than 50% failure rate = down
                    health = 'down';
                } else if (failureRatio > 0.1) {
                    // More than 10% failure rate = degraded
                    health = 'degraded';
                }
            }

            // Also check current queue backlog - if many waiting with none processing
            if (waitingJobs > 100 && activeJobs === 0) {
                health = health === 'healthy' ? 'degraded' : health;
            }

            // Check for active DLQ backlog (recent failures that haven't been retried)
            // If more than 5 jobs actively failing AND high active count, we're degraded
            if (failedJobs > 5 && activeJobs > 20 && health === 'healthy') {
                health = 'degraded';
            }

            return {
                activeJobs,
                waitingJobs,
                failedJobs,
                health,
                queues: {
                    buy: {
                        active: stats.buy?.active || 0,
                        waiting: stats.buy?.waiting || 0,
                        failed: stats.buy?.failed || 0,
                    },
                    sell: {
                        active: stats.sell?.active || 0,
                        waiting: stats.sell?.waiting || 0,
                        failed: stats.sell?.failed || 0,
                    },
                    transaction: {
                        active: stats.transaction?.active || 0,
                        waiting: stats.transaction?.waiting || 0,
                        failed: stats.transaction?.failed || 0,
                    },
                    profit: {
                        active: stats.profit?.active || 0,
                        waiting: stats.profit?.waiting || 0,
                        failed: stats.profit?.failed || 0,
                    },
                },
            };
        } catch (error) {
            logger.error('Failed to get queue status:', error);

            // Return degraded status if we can't get queue info
            return {
                activeJobs: 0,
                waitingJobs: 0,
                failedJobs: 0,
                health: 'degraded' as const,
                queues: {
                    buy: { active: 0, waiting: 0, failed: 0 },
                    sell: { active: 0, waiting: 0, failed: 0 },
                    transaction: { active: 0, waiting: 0, failed: 0 },
                    profit: { active: 0, waiting: 0, failed: 0 },
                },
            };
        }
    }),
});
