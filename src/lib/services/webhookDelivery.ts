/**
 * Webhook Delivery Service
 * Handles sending webhook notifications with HMAC signing, retry logic, and delivery tracking
 * Plan: Phase 5 - Webhook System Implementation
 * 
 * Uses Bull queue for reliable delivery with Redis backing
 */
import crypto from 'crypto';
import Bull from 'bull';
import prisma from '../prisma';
import { logger } from '../logger';
import { WEBHOOK_CONFIG } from '../../../constants/webhookEvents';

interface WebhookPayload {
    event: string;
    timestamp: string;
    data: Record<string, unknown>;
}

interface WebhookJob {
    webhookId: string;
    url: string;
    payload: WebhookPayload;
    signature: string;
    event: string;
    attempt: number;
}

// Initialize Bull queue for webhook delivery
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let webhookQueue: Bull.Queue<WebhookJob> | null = null;

/**
 * Initialize the webhook queue (called at server startup)
 */
export function initializeWebhookQueue(): void {
    if (process.env.REDIS_URL) {
        try {
            webhookQueue = new Bull<WebhookJob>('webhooks', redisUrl, {
                defaultJobOptions: {
                    attempts: WEBHOOK_CONFIG.MAX_RETRIES,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: 100,
                    removeOnFail: 100,
                },
            });

            void webhookQueue.process(async (job) => {
                await deliverWebhook(job.data);
            });

            webhookQueue.on('failed', (job, err) => {
                logger.error('Webhook delivery job failed', {
                    webhookId: job.data.webhookId,
                    event: job.data.event,
                    error: err.message,
                    attemptsMade: job.attemptsMade,
                });
            });

            logger.info('Webhook queue initialized');
        } catch (error) {
            logger.warn('Failed to initialize webhook queue, webhooks will be delivered synchronously', { error });
        }
    }
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
}

/**
 * Send webhook notification to a user's registered endpoint
 * This is the main entry point for triggering webhook deliveries
 */
export async function sendWebhookNotification(
    userId: string,
    event: string,
    data: Record<string, unknown>
): Promise<void> {
    try {
        // Find all active webhooks for this user that subscribe to this event
        const webhooks = await prisma.webhook.findMany({
            where: {
                userId,
                active: true,
                events: { has: event },
            },
        });

        if (webhooks.length === 0) {
            return; // No webhooks registered for this event
        }

        const payload: WebhookPayload = {
            event,
            timestamp: new Date().toISOString(),
            data,
        };

        // Queue webhook delivery for each matching webhook
        for (const webhook of webhooks) {
            const signature = generateSignature(payload, webhook.secret);

            const job: WebhookJob = {
                webhookId: webhook.id,
                url: webhook.url,
                payload,
                signature,
                event,
                attempt: 0,
            };

            // Use Bull queue for reliable delivery if available
            if (webhookQueue) {
                await webhookQueue.add(job);
            } else {
                // Direct delivery if queue not available (fallback)
                await deliverWebhook(job);
            }
        }
    } catch (error) {
        logger.error('Failed to send webhook notification', { userId, event, error });
    }
}

/**
 * Deliver a webhook to its endpoint
 * Called by queue processor or directly
 */
export async function deliverWebhook(job: WebhookJob): Promise<void> {
    const { webhookId, url, payload, signature, event, attempt } = job;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            WEBHOOK_CONFIG.TIMEOUT_MS
        );

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature,
                'X-Webhook-Event': event,
                'X-Webhook-Timestamp': payload.timestamp,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        // Record delivery
        await prisma.webhookDelivery.create({
            data: {
                webhookId,
                event,
                payload,
                status: response.ok ? 'SUCCESS' : 'FAILED',
                responseCode: response.status,
                error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
                attempt: attempt + 1,
            },
        });

        if (!response.ok) {
            throw new Error(`Webhook delivery failed: HTTP ${response.status}`);
        }

        logger.info('Webhook delivered successfully', {
            webhookId,
            event,
            attempt: attempt + 1,
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Webhook delivery failed', {
            webhookId,
            event,
            attempt: attempt + 1,
            error: errorMessage,
        });

        // Record failed delivery
        await prisma.webhookDelivery.create({
            data: {
                webhookId,
                event,
                payload,
                status: 'FAILED',
                error: errorMessage.slice(0, 500),
                attempt: attempt + 1,
            },
        });

        // Re-throw to trigger Bull retry
        throw error;
    }
}

/**
 * Close the webhook queue (for graceful shutdown)
 */
export async function closeWebhookQueue(): Promise<void> {
    if (webhookQueue) {
        await webhookQueue.close();
        webhookQueue = null;
        logger.info('Webhook queue closed');
    }
}

/**
 * Emit a webhook event for a user
 * Convenience wrapper for common use cases
 */
export const webhookEmitter = {
    tradeExecuted: (userId: string, data: {
        tradeId: string;
        symbol: string;
        side: 'BUY' | 'SELL';
        amount: number;
        price: number;
        signature: string;
    }) => sendWebhookNotification(userId, 'trade.executed', data),

    tradeFailed: (userId: string, data: {
        tradeId?: string;
        symbol: string;
        side: 'BUY' | 'SELL';
        amount: number;
        error: string;
    }) => sendWebhookNotification(userId, 'trade.failed', data),

    positionOpened: (userId: string, data: {
        positionId: string;
        symbol: string;
        entryPrice: number;
        amount: number;
    }) => sendWebhookNotification(userId, 'position.opened', data),

    positionClosed: (userId: string, data: {
        positionId: string;
        symbol: string;
        entryPrice: number;
        exitPrice: number;
        pnl: number;
        reason: 'manual' | 'stop_loss' | 'take_profit' | 'trader_exit';
    }) => sendWebhookNotification(userId, 'position.closed', data),

    balanceChanged: (userId: string, data: {
        token: string;
        previousBalance: number;
        newBalance: number;
        changeType: 'deposit' | 'withdrawal' | 'trade' | 'fee';
    }) => sendWebhookNotification(userId, 'balance.changed', data),

    copyTradingStarted: (userId: string, data: {
        traderId: string;
        traderAddress: string;
        settings: Record<string, unknown>;
    }) => sendWebhookNotification(userId, 'copy_trading.started', data),

    copyTradingStopped: (userId: string, data: {
        traderId: string;
        reason: 'manual' | 'budget_exhausted' | 'stop_loss';
    }) => sendWebhookNotification(userId, 'copy_trading.stopped', data),

    copyTradingTradeCopied: (userId: string, data: {
        traderId: string;
        originalSignature: string;
        copiedSignature: string;
        symbol: string;
        amount: number;
    }) => sendWebhookNotification(userId, 'copy_trading.trade_copied', data),
};

export default webhookEmitter;
