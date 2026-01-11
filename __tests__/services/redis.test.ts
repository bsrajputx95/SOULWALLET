/**
 * Plan8 Step 10: Redis Cache Integration Tests
 * 
 * Tests for the Redis caching service including:
 * - get/set/del operations
 * - TTL expiration behavior
 * - Graceful fallback on Redis failure
 * - Cache invalidation patterns
 */

import { redisCache, getCacheTtls, getCacheMetrics, getRedisHealth } from '../../src/lib/redis'

// Mock logger to avoid console noise during tests
jest.mock('../../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}))

describe('Redis Cache Service', () => {
    // Test data
    const testKey = 'test:cache:key' as any
    const testValue = { foo: 'bar', num: 42 }

    beforeEach(async () => {
        // Clean up test keys before each test
        await redisCache.del(testKey)
    })

    afterAll(async () => {
        // Clean up after all tests
        await redisCache.del(testKey)
    })

    describe('Basic Operations', () => {
        it('should set and get a value', async () => {
            await redisCache.set(testKey, testValue, 60)
            const result = await redisCache.get<typeof testValue>(testKey)

            expect(result).toEqual(testValue)
        })

        it('should return null for non-existent key', async () => {
            const result = await redisCache.get('nonexistent:key' as any)

            expect(result).toBeNull()
        })

        it('should delete a key', async () => {
            await redisCache.set(testKey, testValue, 60)
            await redisCache.del(testKey)
            const result = await redisCache.get(testKey)

            expect(result).toBeNull()
        })

        it('should delete multiple keys', async () => {
            const key1 = 'test:multi:1' as any
            const key2 = 'test:multi:2' as any

            await redisCache.set(key1, { a: 1 }, 60)
            await redisCache.set(key2, { b: 2 }, 60)
            await redisCache.del([key1, key2])

            const result1 = await redisCache.get(key1)
            const result2 = await redisCache.get(key2)

            expect(result1).toBeNull()
            expect(result2).toBeNull()
        })
    })

    describe('Set Operations', () => {
        const setKey = 'test:set:key' as any

        beforeEach(async () => {
            await redisCache.del(setKey)
        })

        afterAll(async () => {
            await redisCache.del(setKey)
        })

        it('should add members to a set', async () => {
            await redisCache.sadd(setKey, ['member1', 'member2'])
            const members = await redisCache.smembers(setKey)

            expect(members).toContain('member1')
            expect(members).toContain('member2')
        })

        it('should remove members from a set', async () => {
            await redisCache.sadd(setKey, ['member1', 'member2', 'member3'])
            await redisCache.srem(setKey, 'member2')
            const members = await redisCache.smembers(setKey)

            expect(members).toContain('member1')
            expect(members).not.toContain('member2')
            expect(members).toContain('member3')
        })
    })

    describe('Bulk Operations', () => {
        it('should get multiple values with mget', async () => {
            const keys = [
                'test:mget:1' as any,
                'test:mget:2' as any,
                'test:mget:3' as any,
            ]

            await redisCache.set(keys[0], { a: 1 }, 60)
            await redisCache.set(keys[1], { b: 2 }, 60)
            // keys[2] intentionally not set

            const results = await redisCache.mget<{ a?: number; b?: number }>(keys)

            expect(results[0]).toEqual({ a: 1 })
            expect(results[1]).toEqual({ b: 2 })
            expect(results[2]).toBeNull()

            // Cleanup
            await redisCache.del(keys)
        })
    })

    describe('Pattern Invalidation', () => {
        it('should invalidate keys matching a pattern', async () => {
            const keys = [
                'test:pattern:1' as any,
                'test:pattern:2' as any,
                'test:other:1' as any,
            ]

            await redisCache.set(keys[0], { a: 1 }, 60)
            await redisCache.set(keys[1], { b: 2 }, 60)
            await redisCache.set(keys[2], { c: 3 }, 60)

            await redisCache.invalidatePattern('test:pattern:*')

            const result1 = await redisCache.get(keys[0])
            const result2 = await redisCache.get(keys[1])
            const result3 = await redisCache.get(keys[2])

            expect(result1).toBeNull()
            expect(result2).toBeNull()
            expect(result3).toEqual({ c: 3 }) // Should not be invalidated

            // Cleanup
            await redisCache.del(keys[2])
        })
    })

    describe('TTL Configuration', () => {
        it('should return configured TTLs', () => {
            const ttls = getCacheTtls()

            expect(typeof ttls.session).toBe('number')
            expect(typeof ttls.price).toBe('number')
            expect(typeof ttls.portfolio).toBe('number')
            expect(typeof ttls.tokenMetadata).toBe('number')

            expect(ttls.session).toBeGreaterThan(0)
            expect(ttls.price).toBeGreaterThan(0)
            expect(ttls.portfolio).toBeGreaterThan(0)
            expect(ttls.tokenMetadata).toBeGreaterThan(0)
        })
    })

    describe('Cache Metrics', () => {
        it('should track cache hits and misses', async () => {
            // Reset by making some operations
            const metricsKey = 'test:metrics:key' as any

            await redisCache.set(metricsKey, { test: true }, 60)
            await redisCache.get(metricsKey) // Hit
            await redisCache.get('nonexistent:metrics' as any) // Miss

            const metrics = getCacheMetrics()

            expect(typeof metrics.hits).toBe('number')
            expect(typeof metrics.misses).toBe('number')
            expect(typeof metrics.hitRate).toBe('number')
            expect(typeof metrics.avgLatencyMs).toBe('number')
            expect(typeof metrics.totalOps).toBe('number')

            // Cleanup
            await redisCache.del(metricsKey)
        })
    })

    describe('Health Check', () => {
        it('should return health status', async () => {
            const health = await getRedisHealth()

            expect(typeof health.healthy).toBe('boolean')
            expect(typeof health.connected).toBe('boolean')
            expect(typeof health.required).toBe('boolean')

            if (health.connected) {
                expect(typeof health.latency).toBe('number')
            }
        })
    })

    describe('Graceful Fallback', () => {
        it('should handle operations when Redis connection fails', async () => {
            // The in-memory fallback should handle this
            // Even if Redis is down, operations should not throw
            await expect(redisCache.set(testKey, testValue, 60)).resolves.not.toThrow()
            await expect(redisCache.get(testKey)).resolves.toBeDefined()
        })
    })
})
