/**
 * Plan9 Step 3: Redis Pub/Sub Manager
 * Enables WebSocket event broadcasting across PM2 instances
 */

import Redis from 'ioredis'
import { logger } from '../logger'

// Pub/Sub channels
export type PubSubChannel =
    | `trader:transaction`
    | `user:${string}:notification`
    | `portfolio:${string}:update`
    | `copyTrade:${string}:executed`
    | `system:broadcast`

type MessageHandler<T = any> = (data: T) => void | Promise<void>

class PubSubManager {
    private publisher: Redis | null = null
    private subscriber: Redis | null = null
    private handlers: Map<string, Set<MessageHandler>> = new Map()
    private isConnected = false
    private reconnectAttempts = 0
    private maxReconnectAttempts = 10

    constructor() {
        this.initialize()
    }

    private initialize(): void {
        const redisUrl = process.env.REDIS_URL

        if (!redisUrl) {
            logger.warn('[PubSub] REDIS_URL not configured, pub/sub disabled')
            return
        }

        try {
            // Separate connections for pub and sub (required by Redis)
            this.publisher = new Redis(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => Math.min(times * 100, 3000),
            })

            this.subscriber = new Redis(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => Math.min(times * 100, 3000),
            })

            // Set up subscriber message handler
            this.subscriber.on('message', (channel: string, message: string) => {
                const handlers = this.handlers.get(channel)
                if (handlers && handlers.size > 0) {
                    try {
                        const data = JSON.parse(message)
                        handlers.forEach((handler) => {
                            try {
                                void Promise.resolve(handler(data)).catch((err) => {
                                    logger.error('[PubSub] Handler error', { channel, error: err })
                                })
                            } catch (err) {
                                logger.error('[PubSub] Handler error', { channel, error: err })
                            }
                        })
                    } catch (err) {
                        logger.error('[PubSub] Failed to parse message', { channel, error: err })
                    }
                }
            })

            // Connection event handlers
            this.publisher.on('connect', () => {
                logger.info('[PubSub] Publisher connected')
                this.reconnectAttempts = 0
            })

            this.subscriber.on('connect', () => {
                logger.info('[PubSub] Subscriber connected')
                this.isConnected = true
                this.reconnectAttempts = 0
                // Re-subscribe to all channels after reconnection
                this.resubscribeAll()
            })

            this.publisher.on('error', (err) => {
                logger.error('[PubSub] Publisher error', { error: err.message })
            })

            this.subscriber.on('error', (err) => {
                logger.error('[PubSub] Subscriber error', { error: err.message })
            })

            this.subscriber.on('close', () => {
                this.isConnected = false
                logger.warn('[PubSub] Subscriber connection closed')
            })

            // Connect both clients
            Promise.all([this.publisher.connect(), this.subscriber.connect()])
                .then(() => {
                    logger.info('[PubSub] Both clients connected successfully')
                })
                .catch((err) => {
                    logger.error('[PubSub] Failed to connect', { error: err.message })
                })
        } catch (err) {
            logger.error('[PubSub] Initialization failed', { error: err })
        }
    }

    private resubscribeAll(): void {
        if (!this.subscriber) return

        const channels = Array.from(this.handlers.keys())
        if (channels.length > 0) {
            void this.subscriber.subscribe(...channels, (err) => {
                if (err) {
                    logger.error('[PubSub] Failed to resubscribe', { error: err.message })
                } else {
                    logger.info('[PubSub] Resubscribed to channels', { count: channels.length })
                }
            })
        }
    }

    /**
     * Publish a message to a channel
     */
    async publish<T>(channel: PubSubChannel, data: T): Promise<void> {
        if (!this.publisher) {
            logger.debug('[PubSub] Publisher not available, skipping publish')
            return
        }

        try {
            const message = JSON.stringify(data)
            await this.publisher.publish(channel, message)
            logger.debug('[PubSub] Published message', { channel })
        } catch (err) {
            logger.error('[PubSub] Publish failed', { channel, error: err })
        }
    }

    /**
     * Subscribe to a channel with a handler
     */
    subscribe<T>(channel: PubSubChannel, handler: MessageHandler<T>): () => void {
        // Add handler to local map
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set())
        }
        this.handlers.get(channel)!.add(handler as MessageHandler)

        // Subscribe in Redis if connected
        if (this.subscriber && this.isConnected) {
            void this.subscriber.subscribe(channel, (err) => {
                if (err) {
                    logger.error('[PubSub] Subscribe failed', { channel, error: err.message })
                } else {
                    logger.debug('[PubSub] Subscribed to channel', { channel })
                }
            })
        }

        // Return unsubscribe function
        return () => {
            this.unsubscribe(channel, handler as MessageHandler)
        }
    }

    /**
     * Unsubscribe a handler from a channel
     */
    unsubscribe(channel: string, handler: MessageHandler): void {
        const handlers = this.handlers.get(channel)
        if (handlers) {
            handlers.delete(handler)
            if (handlers.size === 0) {
                this.handlers.delete(channel)
                // Unsubscribe from Redis if no more handlers
                if (this.subscriber) {
                    void this.subscriber.unsubscribe(channel)
                    logger.debug('[PubSub] Unsubscribed from channel', { channel })
                }
            }
        }
    }

    /**
     * Broadcast a notification to a specific user across all instances
     */
    async notifyUser<T>(userId: string, data: T): Promise<void> {
        await this.publish(`user:${userId}:notification`, data)
    }

    /**
     * Broadcast a trader transaction to all instances for copy trade processing
     */
    async broadcastTraderTransaction(data: {
        traderId: string
        signature: string
        tokenIn: string
        tokenOut: string
        amount: number
    }): Promise<void> {
        await this.publish('trader:transaction', data)
    }

    /**
     * Broadcast a portfolio update event
     */
    async notifyPortfolioUpdate(userId: string, data: any): Promise<void> {
        await this.publish(`portfolio:${userId}:update`, data)
    }

    /**
     * Broadcast a copy trade execution event
     */
    async notifyCopyTradeExecuted(
        userId: string,
        data: { positionId: string; txHash: string; type: 'BUY' | 'SELL' }
    ): Promise<void> {
        await this.publish(`copyTrade:${userId}:executed`, data)
    }

    /**
     * System-wide broadcast (e.g., maintenance notifications)
     */
    async systemBroadcast(data: { type: string; message: string }): Promise<void> {
        await this.publish('system:broadcast', data)
    }

    /**
     * Check if pub/sub is connected
     */
    isReady(): boolean {
        return this.isConnected && this.publisher !== null && this.subscriber !== null
    }

    /**
     * Get connection status
     */
    getStatus(): { publisher: string; subscriber: string; handlers: number } {
        return {
            publisher: this.publisher?.status || 'disconnected',
            subscriber: this.subscriber?.status || 'disconnected',
            handlers: Array.from(this.handlers.values()).reduce((sum, set) => sum + set.size, 0),
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        logger.info('[PubSub] Shutting down...')

        if (this.subscriber) {
            await this.subscriber.quit()
        }
        if (this.publisher) {
            await this.publisher.quit()
        }

        this.handlers.clear()
        this.isConnected = false
        logger.info('[PubSub] Shutdown complete')
    }
}

// Singleton instance
export const pubsub = new PubSubManager()

// Export types for consumers
export type { MessageHandler }
