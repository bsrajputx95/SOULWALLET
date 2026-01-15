/**
 * Dead Letter Queue Service - STUB FOR BETA
 * 
 * This is a no-op stub. Failed messages are logged but not persisted.
 * Full DLQ with persistence will be implemented post-beta.
 */

import { logger } from '../logger';

export interface DLQEntry {
    id: string;
    queueName: string;
    payload: any;
    error: string;
    failedAt: Date;
    retryCount: number;
    operation?: string;
    type?: string;
    originalPayload?: any;
    userId?: string;
}

class DeadLetterQueueService {
    async addToQueue(entry: Partial<DLQEntry>): Promise<void> {
        // Log the failed message but don't persist
        logger.warn('[DLQ-STUB] Message added to dead letter queue (not persisted)', {
            queueName: entry.queueName,
            error: entry.error,
        });
    }

    async getQueueEntries(_queueName?: string): Promise<DLQEntry[]> {
        return [];
    }

    async retryEntry(_id: string): Promise<boolean> {
        return false;
    }

    async deleteEntry(_id: string): Promise<boolean> {
        return true;
    }

    async getQueueStats(): Promise<{ total: number; byQueue: Record<string, number> }> {
        return { total: 0, byQueue: {} };
    }
}

export const deadLetterQueueService = new DeadLetterQueueService();
