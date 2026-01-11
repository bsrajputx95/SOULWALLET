/**
 * Idempotency Middleware
 * 
 * Prevents duplicate transaction execution by caching responses keyed by
 * a unique idempotency key (userId + endpoint + requestBody hash).
 * 
 * Plan7 Step 4 implementation.
 */

import crypto from 'crypto'
import Redis from 'ioredis'
import { logger } from '../logger'

// TTL for idempotency keys (24 hours default)
const IDEMPOTENCY_TTL = Number.parseInt(process.env.IDEMPOTENCY_TTL || '86400', 10)

interface IdempotencyRecord {
    key: string
    response: unknown
    createdAt: number
    statusCode: number
}

let redis: Redis | null = null

/**
 * Get or create Redis connection for idempotency
 */
function getRedis(): Redis {
    if (!redis) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keyPrefix: 'idempotency:',
        })

        redis.on('error', (err) => {
            logger.error('Idempotency Redis error', { error: err.message })
        })
    }
    return redis
}

/**
 * Generate idempotency key from request parameters
 */
export function generateIdempotencyKey(
    userId: string,
    endpoint: string,
    requestBody: unknown
): string {
    const bodyString = JSON.stringify(requestBody || {})
    const data = `${userId}:${endpoint}:${bodyString}`
    return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Check if a request with this idempotency key was already processed
 */
export async function getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    try {
        const redis = getRedis()
        const data = await redis.get(key)

        if (!data) return null

        return JSON.parse(data) as IdempotencyRecord
    } catch (error) {
        logger.warn('Failed to get idempotency record', { key, error })
        return null
    }
}

/**
 * Store the response for an idempotency key
 */
export async function setIdempotencyRecord(
    key: string,
    response: unknown,
    statusCode: number = 200
): Promise<void> {
    try {
        const redis = getRedis()
        const record: IdempotencyRecord = {
            key,
            response,
            createdAt: Date.now(),
            statusCode,
        }

        await redis.setex(key, IDEMPOTENCY_TTL, JSON.stringify(record))

        logger.debug('Stored idempotency record', { key, ttl: IDEMPOTENCY_TTL })
    } catch (error) {
        logger.warn('Failed to store idempotency record', { key, error })
        // Don't throw - idempotency is best-effort
    }
}

/**
 * Check if a key exists (without parsing the full record)
 */
export async function hasIdempotencyKey(key: string): Promise<boolean> {
    try {
        const redis = getRedis()
        const exists = await redis.exists(key)
        return exists === 1
    } catch (error) {
        return false
    }
}

/**
 * Delete an idempotency record (for failed transactions that should be retryable)
 */
export async function deleteIdempotencyRecord(key: string): Promise<void> {
    try {
        const redis = getRedis()
        await redis.del(key)
    } catch (error) {
        logger.warn('Failed to delete idempotency record', { key, error })
    }
}

/**
 * Idempotency wrapper for tRPC mutations
 * 
 * Usage:
 * ```typescript
 * const result = await withIdempotency(
 *   ctx.user.id,
 *   'wallet.swap',
 *   input,
 *   async () => {
 *     // Execute the actual swap
 *     return await executeSwap(input)
 *   }
 * )
 * ```
 */
export async function withIdempotency<T>(
    userId: string,
    operation: string,
    input: unknown,
    execute: () => Promise<T>
): Promise<{ data: T; fromCache: boolean }> {
    const key = generateIdempotencyKey(userId, operation, input)

    // Check for existing record
    const existing = await getIdempotencyRecord(key)
    if (existing) {
        logger.info('Returning cached idempotency response', {
            key,
            operation,
            userId,
            age: Date.now() - existing.createdAt,
        })
        return { data: existing.response as T, fromCache: true }
    }

    // Execute the operation
    try {
        const result = await execute()

        // Store successful response
        await setIdempotencyRecord(key, result, 200)

        return { data: result, fromCache: false }
    } catch (error) {
        // Don't cache errors - allow retries
        // But log the duplicate attempt prevention
        logger.debug('Operation failed, not caching for idempotency', {
            key,
            operation,
            error: error instanceof Error ? error.message : String(error),
        })
        throw error
    }
}

/**
 * Extract or generate idempotency key from request headers/input
 */
export function extractIdempotencyKey(
    headers: Record<string, string | string[] | undefined>,
    fallbackGenerator: () => string
): string {
    const headerKey = headers['idempotency-key'] || headers['x-idempotency-key']

    if (typeof headerKey === 'string' && headerKey.length > 0) {
        return headerKey
    }

    // Generate automatic key
    return fallbackGenerator()
}

/**
 * Middleware factory for tRPC procedures that need idempotency
 */
export function createIdempotencyMiddleware(operationName: string) {
    return async <T>(opts: {
        ctx: { user?: { id: string } }
        input: unknown
        next: () => Promise<T>
    }): Promise<T> => {
        const userId = opts.ctx.user?.id

        if (!userId) {
            // No user, skip idempotency
            return opts.next()
        }

        const { data } = await withIdempotency(
            userId,
            operationName,
            opts.input,
            opts.next
        )

        return data
    }
}

/**
 * Get statistics about idempotency keys
 */
export async function getIdempotencyStats(): Promise<{
    enabled: boolean
    ttlSeconds: number
    redisConnected: boolean
}> {
    let redisConnected = false

    try {
        const redis = getRedis()
        await redis.ping()
        redisConnected = true
    } catch {
        redisConnected = false
    }

    return {
        enabled: process.env.IDEMPOTENCY_ENABLED !== 'false',
        ttlSeconds: IDEMPOTENCY_TTL,
        redisConnected,
    }
}
