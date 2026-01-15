/**
 * DLQ Processor Service - STUB FOR BETA
 * 
 * This is a no-op stub. DLQ processing is disabled for beta.
 * Full DLQ processing with retry logic will be implemented post-beta.
 */

import { logger } from '../logger';

type DLQHandler = (entry: any) => Promise<boolean>;

class DLQProcessor {
    private handlers: Map<string, DLQHandler> = new Map();

    registerHandler(queueName: string, handler: DLQHandler): void {
        this.handlers.set(queueName, handler);
        logger.debug('[DLQ-STUB] Handler registered', { queueName });
    }

    async processQueue(): Promise<{ processed: number; failed: number }> {
        // No-op - no entries to process
        return { processed: 0, failed: 0 };
    }

    getStatus(): { registeredHandlers: string[]; queueDepth: number } {
        return {
            registeredHandlers: Array.from(this.handlers.keys()),
            queueDepth: 0,
        };
    }
}

export const dlqProcessor = new DLQProcessor();

export function initializeDLQHandlers(): void {
    // No-op for beta
    logger.debug('[DLQ-STUB] DLQ handlers initialization skipped for beta');
}
