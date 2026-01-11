/**
 * Queue Manager Service
 * 
 * Prevents resource exhaustion by limiting concurrent requests per user/IP.
 * - Track concurrent requests per user/IP
 * - Enforce max queue depth (1000 pending requests)
 * - Redis storage with memory fallback
 * - Metrics for monitoring
 */

import 'reflect-metadata';
import Redis from 'ioredis'
import { injectable } from 'tsyringe';
import { logger } from '../logger'
import { LIMITS } from '../../../constants'

// Configuration
const MAX_CONCURRENT_PER_USER = LIMITS.QUEUE.MAX_CONCURRENT_PER_USER
const MAX_CONCURRENT_PER_IP = LIMITS.QUEUE.MAX_CONCURRENT_PER_IP
const MAX_QUEUE_DEPTH = LIMITS.QUEUE.MAX_DEPTH
const QUEUE_TIMEOUT_MS = LIMITS.QUEUE.TIMEOUT_MS
const SLOT_TTL_SECONDS = Math.ceil(QUEUE_TIMEOUT_MS / 1000) + LIMITS.QUEUE.SLOT_TTL_BUFFER_SECONDS

export interface QueueMetrics {
    globalQueueDepth: number
    userCounts: Map<string, number>
    ipCounts: Map<string, number>
    queueFull: boolean
    utilizationPercent: number
}

interface SlotInfo {
    userId: string | undefined
    ip: string
    acquiredAt: number
    slotId: string
}

/**
 * Queue Manager
 * Manages request queuing and rate limiting per user/IP
 */
@injectable()
export class QueueManager {
    private redis: Redis | null = null
    private memoryQueue: Map<string, number> = new Map()
    private globalDepth = 0
    private activeSlots: Map<string, SlotInfo> = new Map()
    private slotCounter = 0

    constructor() {
        void this.initRedis()
    }

    private async initRedis(): Promise<void> {
        const redisUrl = process.env.REDIS_URL
        if (!redisUrl) {
            logger.info('[QueueManager] No Redis URL, using memory-based queue')
            return
        }

        try {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            })

            await this.redis.connect()
            logger.info('[QueueManager] Connected to Redis')
        } catch (error) {
            logger.warn('[QueueManager] Redis connection failed, using memory fallback', {
                error: error instanceof Error ? error.message : String(error),
            })
            this.redis = null
        }
    }

    /**
     * Generate unique slot ID
     */
    private generateSlotId(): string {
        return `slot_${Date.now()}_${++this.slotCounter}`
    }

    /**
     * Acquire a request slot
     * @returns slotId if acquired, null if queue is full
     */
    async acquireSlot(userId: string | undefined, ip: string): Promise<string | null> {
        const slotId = this.generateSlotId()

        if (this.redis) {
            return this.acquireSlotRedis(userId, ip, slotId)
        }
        return this.acquireSlotMemory(userId, ip, slotId)
    }

    private async acquireSlotRedis(
        userId: string | undefined,
        ip: string,
        slotId: string
    ): Promise<string | null> {
        try {
            const multi = this.redis!.multi()

            // Check global queue depth
            const globalKey = 'queue:global:depth'
            const userKey = userId ? `queue:user:${userId}:count` : null
            const ipKey = `queue:ip:${ip}:count`

            // Get current counts
            const [globalDepth, userCount, ipCount] = await Promise.all([
                this.redis!.get(globalKey).then((v) => parseInt(v || '0')),
                userKey ? this.redis!.get(userKey).then((v) => parseInt(v || '0')) : Promise.resolve(0),
                this.redis!.get(ipKey).then((v) => parseInt(v || '0')),
            ])

            // Check limits
            if (globalDepth >= MAX_QUEUE_DEPTH) {
                logger.warn('[QueueManager] Global queue full', { globalDepth, maxDepth: MAX_QUEUE_DEPTH })
                return null
            }

            if (userId && userCount >= MAX_CONCURRENT_PER_USER) {
                logger.warn('[QueueManager] User queue full', { userId, userCount, max: MAX_CONCURRENT_PER_USER })
                return null
            }

            if (ipCount >= MAX_CONCURRENT_PER_IP) {
                logger.warn('[QueueManager] IP queue full', { ip, ipCount, max: MAX_CONCURRENT_PER_IP })
                return null
            }

            // Increment counters with TTL
            multi.incr(globalKey)
            multi.expire(globalKey, SLOT_TTL_SECONDS)
            if (userKey) {
                multi.incr(userKey)
                multi.expire(userKey, SLOT_TTL_SECONDS)
            }
            multi.incr(ipKey)
            multi.expire(ipKey, SLOT_TTL_SECONDS)

            // Store slot info
            multi.set(`queue:slot:${slotId}`, JSON.stringify({ userId, ip }), 'EX', SLOT_TTL_SECONDS)

            await multi.exec()

            // Track locally for release
            this.activeSlots.set(slotId, { userId, ip, acquiredAt: Date.now(), slotId })

            return slotId
        } catch (error) {
            logger.error('[QueueManager] Redis error during acquire', { error })
            // Fallback to memory
            return this.acquireSlotMemory(userId, ip, slotId)
        }
    }

    private acquireSlotMemory(
        userId: string | undefined,
        ip: string,
        slotId: string
    ): string | null {
        // Check global depth
        if (this.globalDepth >= MAX_QUEUE_DEPTH) {
            logger.warn('[QueueManager] Memory queue full', { depth: this.globalDepth })
            return null
        }

        // Check user limit
        const userKey = userId ? `user:${userId}` : null
        if (userKey) {
            const userCount = this.memoryQueue.get(userKey) || 0
            if (userCount >= MAX_CONCURRENT_PER_USER) {
                logger.warn('[QueueManager] User limit reached (memory)', { userId, count: userCount })
                return null
            }
        }

        // Check IP limit
        const ipKey = `ip:${ip}`
        const ipCount = this.memoryQueue.get(ipKey) || 0
        if (ipCount >= MAX_CONCURRENT_PER_IP) {
            logger.warn('[QueueManager] IP limit reached (memory)', { ip, count: ipCount })
            return null
        }

        // Increment counters
        this.globalDepth++
        if (userKey) {
            this.memoryQueue.set(userKey, (this.memoryQueue.get(userKey) || 0) + 1)
        }
        this.memoryQueue.set(ipKey, (this.memoryQueue.get(ipKey) || 0) + 1)

        // Track slot
        this.activeSlots.set(slotId, { userId, ip, acquiredAt: Date.now(), slotId })

        return slotId
    }

    /**
     * Release a request slot
     */
    async releaseSlot(slotId: string): Promise<void> {
        const slotInfo = this.activeSlots.get(slotId)
        if (!slotInfo) {
            return // Already released or never acquired
        }

        this.activeSlots.delete(slotId)

        if (this.redis) {
            await this.releaseSlotRedis(slotInfo)
        } else {
            this.releaseSlotMemory(slotInfo)
        }
    }

    private async releaseSlotRedis(slotInfo: SlotInfo): Promise<void> {
        try {
            const multi = this.redis!.multi()

            multi.decr('queue:global:depth')
            if (slotInfo.userId) {
                multi.decr(`queue:user:${slotInfo.userId}:count`)
            }
            multi.decr(`queue:ip:${slotInfo.ip}:count`)
            multi.del(`queue:slot:${slotInfo.slotId}`)

            await multi.exec()
        } catch (error) {
            logger.error('[QueueManager] Redis error during release', { error })
            // Fallback to memory cleanup
            this.releaseSlotMemory(slotInfo)
        }
    }

    private releaseSlotMemory(slotInfo: SlotInfo): void {
        this.globalDepth = Math.max(0, this.globalDepth - 1)

        if (slotInfo.userId) {
            const userKey = `user:${slotInfo.userId}`
            const current = this.memoryQueue.get(userKey) || 0
            if (current <= 1) {
                this.memoryQueue.delete(userKey)
            } else {
                this.memoryQueue.set(userKey, current - 1)
            }
        }

        const ipKey = `ip:${slotInfo.ip}`
        const currentIp = this.memoryQueue.get(ipKey) || 0
        if (currentIp <= 1) {
            this.memoryQueue.delete(ipKey)
        } else {
            this.memoryQueue.set(ipKey, currentIp - 1)
        }
    }

    /**
     * Check if queue is currently full
     */
    async isQueueFull(): Promise<boolean> {
        if (this.redis) {
            try {
                const depth = await this.redis.get('queue:global:depth')
                return parseInt(depth || '0') >= MAX_QUEUE_DEPTH
            } catch {
                return this.globalDepth >= MAX_QUEUE_DEPTH
            }
        }
        return this.globalDepth >= MAX_QUEUE_DEPTH
    }

    /**
     * Get current queue metrics
     */
    async getQueueStatus(): Promise<QueueMetrics> {
        let globalQueueDepth: number
        const userCounts = new Map<string, number>()
        const ipCounts = new Map<string, number>()

        if (this.redis) {
            try {
                globalQueueDepth = parseInt((await this.redis.get('queue:global:depth')) || '0')

                // Scan for user and IP counts
                const keys = await this.redis.keys('queue:user:*:count')
                for (const key of keys) {
                    const userId = key.split(':')[2] ?? 'unknown'
                    const count = parseInt((await this.redis.get(key)) || '0')
                    userCounts.set(userId, count)
                }

                const ipKeys = await this.redis.keys('queue:ip:*:count')
                for (const key of ipKeys) {
                    const ip = key.split(':')[2] ?? 'unknown'
                    const count = parseInt((await this.redis.get(key)) || '0')
                    ipCounts.set(ip, count)
                }
            } catch {
                globalQueueDepth = this.globalDepth
            }
        } else {
            globalQueueDepth = this.globalDepth
            for (const [key, value] of this.memoryQueue) {
                if (key.startsWith('user:')) {
                    userCounts.set(key.replace('user:', ''), value)
                } else if (key.startsWith('ip:')) {
                    ipCounts.set(key.replace('ip:', ''), value)
                }
            }
        }

        return {
            globalQueueDepth,
            userCounts,
            ipCounts,
            queueFull: globalQueueDepth >= MAX_QUEUE_DEPTH,
            utilizationPercent: (globalQueueDepth / MAX_QUEUE_DEPTH) * 100,
        }
    }

    /**
     * Get active slot count
     */
    getActiveSlotCount(): number {
        return this.activeSlots.size
    }

    /**
     * Cleanup stale slots (called periodically)
     */
    cleanupStaleSlots(): void {
        const now = Date.now()
        const staleThreshold = QUEUE_TIMEOUT_MS

        for (const [slotId, slotInfo] of this.activeSlots) {
            if (now - slotInfo.acquiredAt > staleThreshold) {
                logger.warn('[QueueManager] Cleaning up stale slot', { slotId, age: now - slotInfo.acquiredAt })
                void this.releaseSlot(slotId)
            }
        }
    }

    /**
     * Get configuration for monitoring
     */
    getConfig(): {
        maxConcurrentPerUser: number
        maxConcurrentPerIp: number
        maxQueueDepth: number
        queueTimeoutMs: number
    } {
        return {
            maxConcurrentPerUser: MAX_CONCURRENT_PER_USER,
            maxConcurrentPerIp: MAX_CONCURRENT_PER_IP,
            maxQueueDepth: MAX_QUEUE_DEPTH,
            queueTimeoutMs: QUEUE_TIMEOUT_MS,
        }
    }
}

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<QueueManager>('QueueManager') 
 * 
 * Note: Lazy initialization to prevent container.resolve failures
 * when module is imported before container setup
 */
let _queueManagerInstance: QueueManager | null = null;

export const queueManager: QueueManager = new Proxy({} as QueueManager, {
    get(_target, prop) {
        if (!_queueManagerInstance) {
            try {
                _queueManagerInstance = container.resolve<QueueManager>('QueueManager');
            } catch {
                _queueManagerInstance = new QueueManager();
            }
        }
        const value = (_queueManagerInstance as any)[prop];
        if (typeof value === 'function') {
            return value.bind(_queueManagerInstance);
        }
        return value;
    }
});

// Start cleanup interval
if (process.env.NODE_ENV !== 'test') {
    const timer = setInterval(() => {
        queueManager.cleanupStaleSlots()
    }, 60_000) as unknown as NodeJS.Timeout;
    timer.unref?.()
}

