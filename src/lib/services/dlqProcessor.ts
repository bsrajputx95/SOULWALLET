/**
 * DLQ Processor
 * 
 * Background job that processes failed transactions from the Dead Letter Queue.
 * Runs every 5 minutes via cron job to retry pending items.
 * 
 * Plan7 Step 5 implementation.
 */

import { deadLetterQueueService, DLQItem, DLQOperation } from './deadLetterQueue'
import { logger } from '../logger'

// Transaction execution functions (imported dynamically to avoid circular deps)
type ExecuteFunction = (payload: Record<string, unknown>, userId: string) => Promise<unknown>

interface OperationHandler {
    execute: ExecuteFunction
    validate?: (payload: Record<string, unknown>) => boolean
}

class DLQProcessor {
    private handlers: Map<DLQOperation, OperationHandler> = new Map()
    private isProcessing: boolean = false
    private batchSize: number = 10

    /**
     * Register a handler for a specific operation type
     */
    registerHandler(operation: DLQOperation, handler: OperationHandler): void {
        this.handlers.set(operation, handler)
        logger.info('DLQ handler registered', { operation })
    }

    /**
     * Process pending items in the queue
     */
    async processQueue(): Promise<{
        processed: number
        succeeded: number
        failed: number
        skipped: number
    }> {
        if (this.isProcessing) {
            logger.debug('DLQ processor already running, skipping')
            return { processed: 0, succeeded: 0, failed: 0, skipped: 0 }
        }

        this.isProcessing = true
        const stats = { processed: 0, succeeded: 0, failed: 0, skipped: 0 }

        try {
            const pendingItems = await deadLetterQueueService.getPendingItems(this.batchSize)

            if (pendingItems.length === 0) {
                logger.debug('No pending DLQ items to process')
                return stats
            }

            logger.info('Processing DLQ items', { count: pendingItems.length })

            for (const item of pendingItems) {
                stats.processed++

                try {
                    await this.processItem(item)
                    stats.succeeded++
                } catch (error) {
                    stats.failed++
                    logger.error('Failed to process DLQ item', {
                        dlqId: item.id,
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }

            logger.info('DLQ processing batch complete', stats)
            return stats
        } finally {
            this.isProcessing = false
        }
    }

    /**
     * Process a single DLQ item
     */
    private async processItem(item: DLQItem): Promise<void> {
        const handler = this.handlers.get(item.operation as DLQOperation)

        if (!handler) {
            logger.warn('No handler registered for DLQ operation', {
                dlqId: item.id,
                operation: item.operation,
            })
            return
        }

        // Mark as retrying
        await deadLetterQueueService.markRetrying(item.id)

        try {
            // Validate payload if validator exists
            if (handler.validate && !handler.validate(item.payload)) {
                throw new Error('Payload validation failed')
            }

            // Execute the retry
            await handler.execute(item.payload, item.userId)

            // Mark as resolved on success
            await deadLetterQueueService.markResolved(item.id)

            logger.info('DLQ item retry succeeded', {
                dlqId: item.id,
                operation: item.operation,
                retryCount: item.retryCount + 1,
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            // Mark as failed with new error
            await deadLetterQueueService.markFailed(item.id, errorMessage)

            logger.warn('DLQ item retry failed', {
                dlqId: item.id,
                operation: item.operation,
                retryCount: item.retryCount + 1,
                error: errorMessage,
            })
        }
    }

    /**
     * Get processor status
     */
    getStatus(): {
        isProcessing: boolean
        registeredHandlers: string[]
        batchSize: number
    } {
        return {
            isProcessing: this.isProcessing,
            registeredHandlers: Array.from(this.handlers.keys()),
            batchSize: this.batchSize,
        }
    }

    /**
     * Set batch size for processing
     */
    setBatchSize(size: number): void {
        this.batchSize = Math.max(1, Math.min(100, size))
    }
}

export const dlqProcessor = new DLQProcessor()

/**
 * Initialize DLQ handlers with actual operation implementations
 * Call this during application startup
 */
export async function initializeDLQHandlers(): Promise<void> {
    // Handler for SWAP operations
    dlqProcessor.registerHandler('SWAP', {
        execute: async (payload) => {
            // Import the singleton instance
            const { jupiterSwap } = await import('./jupiterSwap')

            // Need to get the wallet keypair - this requires more context
            // For DLQ retries, the payload should contain all needed data
            const quoteResponse = payload.quoteResponse as Parameters<typeof jupiterSwap.executeSwap>[0]['quoteResponse']
            const wallet = payload.wallet as Parameters<typeof jupiterSwap.executeSwap>[0]['wallet']

            if (!quoteResponse || !wallet) {
                throw new Error('SWAP retry requires quoteResponse and wallet in payload')
            }

            return jupiterSwap.executeSwap({
                quoteResponse,
                wallet,
                useMevProtection: payload.useMevProtection as boolean | undefined,
            })
        },
        validate: (payload) => {
            return (
                typeof payload.quoteResponse === 'object' &&
                payload.quoteResponse !== null
            )
        },
    })

    // Handler for SEND operations - these should go through wallet router
    dlqProcessor.registerHandler('SEND', {
        execute: async (payload) => {
            // SEND operations need the full transaction context
            // In practice, DLQ for SEND should contain the signed transaction
            const { rpcManager } = await import('./rpcManager')

            const signature = payload.signature as string
            if (!signature) {
                throw new Error('SEND retry requires signature in payload')
            }

            // Just verify the transaction went through
            const connection = await rpcManager.getConnection()
            const status = await connection.getSignatureStatus(signature)

            if (status?.value?.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`)
            }

            return { signature, status }
        },
        validate: (payload) => {
            return typeof payload.signature === 'string'
        },
    })

    // Handler for COPY_TRADE operations
    dlqProcessor.registerHandler('COPY_TRADE', {
        execute: async (payload) => {
            const { SERVICE_TOKENS, container } = await import('../di/container')
            const copyTradingService = container.resolve<any>(SERVICE_TOKENS.CopyTradingService)

            // copyTradingService instance method
            const settingId = payload.settingId as string
            const originalTxHash = payload.originalTxHash as string
            const tokenIn = payload.tokenIn as string
            const tokenOut = payload.tokenOut as string
            const amountIn = payload.amountIn as number

            return copyTradingService.executeCopyTrade({
                settingId,
                originalTxHash,
                tokenIn,
                tokenOut,
                amountIn,
            })
        },
        validate: (payload) => {
            return (
                typeof payload.settingId === 'string' &&
                typeof payload.tokenIn === 'string' &&
                typeof payload.tokenOut === 'string'
            )
        },
    })

    logger.info('DLQ handlers initialized')
}
