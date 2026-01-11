/**
 * Dead Letter Queue Service
 * 
 * Handles failed transactions by queuing them for retry with exponential backoff.
 * Ensures no transaction is lost and enables manual recovery.
 * 
 * Plan7 Step 5 implementation.
 */

import prisma from '../prisma'
import { logger } from '../logger'

// DLQ Configuration
const DLQ_CONFIG = {
    maxRetries: Number.parseInt(process.env.DLQ_MAX_RETRIES || '3', 10),
    retryDelayMs: Number.parseInt(process.env.DLQ_RETRY_DELAY || '60000', 10),
    backoffMultiplier: 2,
    maxBackoffMs: 3600000, // 1 hour
    alertThreshold: Number.parseInt(process.env.DLQ_ALERT_THRESHOLD || '10', 10),
}

export type DLQOperation = 'SWAP' | 'SEND' | 'COPY_TRADE' | 'WITHDRAWAL'
export type DLQStatus = 'PENDING' | 'RETRYING' | 'RESOLVED' | 'FAILED' | 'MANUAL_REVIEW'

export interface DLQItem {
    id: string
    operation: DLQOperation
    payload: Record<string, unknown>
    error: string
    retryCount: number
    lastRetryAt: Date | null
    nextRetryAt: Date | null
    createdAt: Date
    resolvedAt: Date | null
    status: DLQStatus
    userId: string
}

export interface DLQCreateInput {
    operation: DLQOperation
    payload: Record<string, unknown>
    error: string
    userId: string
}

class DeadLetterQueueService {
    /**
     * Add a failed transaction to the DLQ
     */
    async addToQueue(input: DLQCreateInput): Promise<string> {
        try {
            const nextRetryAt = new Date(Date.now() + DLQ_CONFIG.retryDelayMs)

            const item = await prisma.deadLetterQueueItem.create({
                data: {
                    operation: input.operation,
                    payload: input.payload,
                    error: input.error,
                    userId: input.userId,
                    status: 'PENDING',
                    retryCount: 0,
                    nextRetryAt,
                },
            })

            logger.warn('Transaction added to Dead Letter Queue', {
                dlqId: item.id,
                operation: input.operation,
                userId: input.userId,
                error: input.error.substring(0, 200),
            })

            // Check if we need to alert
            await this.checkAlertThreshold()

            return item.id
        } catch (error) {
            logger.error('Failed to add item to DLQ', { input, error })
            throw error
        }
    }

    /**
     * Get pending items ready for retry
     */
    async getPendingItems(limit: number = 50): Promise<DLQItem[]> {
        const now = new Date()

        const items = await prisma.deadLetterQueueItem.findMany({
            where: {
                status: { in: ['PENDING', 'RETRYING'] },
                retryCount: { lt: DLQ_CONFIG.maxRetries },
                OR: [
                    { nextRetryAt: null },
                    { nextRetryAt: { lte: now } },
                ],
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        })

        return items as unknown as DLQItem[]
    }

    /**
     * Mark item as being processed
     */
    async markRetrying(id: string): Promise<void> {
        await prisma.deadLetterQueueItem.update({
            where: { id },
            data: {
                status: 'RETRYING',
                lastRetryAt: new Date(),
            },
        })
    }

    /**
     * Mark item as successfully resolved
     */
    async markResolved(id: string): Promise<void> {
        await prisma.deadLetterQueueItem.update({
            where: { id },
            data: {
                status: 'RESOLVED',
                resolvedAt: new Date(),
            },
        })

        logger.info('DLQ item resolved successfully', { dlqId: id })
    }

    /**
     * Mark item as failed and schedule next retry
     */
    async markFailed(id: string, error: string): Promise<void> {
        const item = await prisma.deadLetterQueueItem.findUnique({
            where: { id },
        })

        if (!item) return

        const newRetryCount = item.retryCount + 1
        const isMaxRetries = newRetryCount >= DLQ_CONFIG.maxRetries

        // Calculate next retry with exponential backoff
        const backoffDelay = Math.min(
            DLQ_CONFIG.retryDelayMs * Math.pow(DLQ_CONFIG.backoffMultiplier, newRetryCount),
            DLQ_CONFIG.maxBackoffMs
        )

        await prisma.deadLetterQueueItem.update({
            where: { id },
            data: {
                status: isMaxRetries ? 'MANUAL_REVIEW' : 'PENDING',
                retryCount: newRetryCount,
                error: error.substring(0, 1000),
                nextRetryAt: isMaxRetries ? null : new Date(Date.now() + backoffDelay),
            },
        })

        if (isMaxRetries) {
            logger.error('DLQ item exceeded max retries, requires manual review', {
                dlqId: id,
                retryCount: newRetryCount,
                operation: item.operation,
                userId: item.userId,
            })
        } else {
            logger.warn('DLQ item retry failed, scheduling next attempt', {
                dlqId: id,
                retryCount: newRetryCount,
                nextRetryIn: backoffDelay,
            })
        }
    }

    /**
     * Get items requiring manual review
     */
    async getManualReviewItems(limit: number = 50): Promise<DLQItem[]> {
        const items = await prisma.deadLetterQueueItem.findMany({
            where: { status: 'MANUAL_REVIEW' },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                user: {
                    select: { id: true, email: true, username: true },
                },
            },
        })

        return items as unknown as DLQItem[]
    }

    /**
     * Admin: Manually resolve an item
     */
    async adminResolve(id: string, adminId: string, notes?: string): Promise<void> {
        await prisma.deadLetterQueueItem.update({
            where: { id },
            data: {
                status: 'RESOLVED',
                resolvedAt: new Date(),
                // Store admin notes in payload
                payload: {
                    ...(await this.getItem(id))?.payload,
                    _adminResolution: {
                        resolvedBy: adminId,
                        resolvedAt: new Date().toISOString(),
                        notes,
                    },
                },
            },
        })

        logger.info('DLQ item manually resolved by admin', {
            dlqId: id,
            adminId,
            notes,
        })
    }

    /**
     * Admin: Force retry an item
     */
    async adminForceRetry(id: string): Promise<void> {
        await prisma.deadLetterQueueItem.update({
            where: { id },
            data: {
                status: 'PENDING',
                nextRetryAt: new Date(), // Immediate retry
            },
        })

        logger.info('DLQ item queued for immediate retry', { dlqId: id })
    }

    /**
     * Get a single DLQ item
     */
    async getItem(id: string): Promise<DLQItem | null> {
        const item = await prisma.deadLetterQueueItem.findUnique({
            where: { id },
        })
        return item as unknown as DLQItem | null
    }

    /**
     * Get DLQ statistics
     */
    async getStats(): Promise<{
        pending: number
        retrying: number
        manualReview: number
        resolved: number
        failed: number
        total: number
        oldestPending: Date | null
    }> {
        const [pending, retrying, manualReview, resolved, failed, total, oldest] = await Promise.all([
            prisma.deadLetterQueueItem.count({ where: { status: 'PENDING' } }),
            prisma.deadLetterQueueItem.count({ where: { status: 'RETRYING' } }),
            prisma.deadLetterQueueItem.count({ where: { status: 'MANUAL_REVIEW' } }),
            prisma.deadLetterQueueItem.count({ where: { status: 'RESOLVED' } }),
            prisma.deadLetterQueueItem.count({ where: { status: 'FAILED' } }),
            prisma.deadLetterQueueItem.count(),
            prisma.deadLetterQueueItem.findFirst({
                where: { status: 'PENDING' },
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            }),
        ])

        return {
            pending,
            retrying,
            manualReview,
            resolved,
            failed,
            total,
            oldestPending: oldest?.createdAt || null,
        }
    }

    /**
     * Check if DLQ depth exceeds alert threshold
     */
    private async checkAlertThreshold(): Promise<void> {
        const pendingCount = await prisma.deadLetterQueueItem.count({
            where: { status: { in: ['PENDING', 'RETRYING', 'MANUAL_REVIEW'] } },
        })

        if (pendingCount >= DLQ_CONFIG.alertThreshold) {
            logger.error('DLQ depth exceeds alert threshold', {
                pendingCount,
                threshold: DLQ_CONFIG.alertThreshold,
            })

            // Could integrate with alertManager here for notifications
        }
    }

    /**
     * Cleanup old resolved items (retention policy)
     */
    async cleanupResolved(olderThanDays: number = 30): Promise<number> {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

        const result = await prisma.deadLetterQueueItem.deleteMany({
            where: {
                status: 'RESOLVED',
                resolvedAt: { lt: cutoff },
            },
        })

        if (result.count > 0) {
            logger.info('Cleaned up old DLQ items', {
                deleted: result.count,
                olderThanDays,
            })
        }

        return result.count
    }

    /**
     * Get configuration
     */
    getConfig() {
        return { ...DLQ_CONFIG }
    }
}

export const deadLetterQueueService = new DeadLetterQueueService()
