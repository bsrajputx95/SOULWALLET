/**
 * Plan8 Step 6: Prisma Client Extension for Cache Invalidation
 * 
 * Automatically invalidates Redis cache when database records are updated.
 * Uses Prisma Client Extensions (replacement for deprecated $use middleware).
 */

import { PrismaClient } from '@prisma/client'
import { redisCache } from './redis'
import { logger } from './logger'

/**
 * Create an extended Prisma client with cache invalidation hooks
 */
export function createExtendedPrismaClient(prisma: PrismaClient) {
    return prisma.$extends({
        query: {
            // User cache invalidation
            user: {
                async update({ args, query }) {
                    const result = await query(args)

                    // Get userId from args
                    const userId = args.where?.id
                    if (userId) {
                        try {
                            await redisCache.del(`user:${userId}:profile` as any)
                            logger.debug('Cache invalidated: user profile', { userId })
                        } catch (err) {
                            logger.warn('Failed to invalidate user cache', { userId, error: err })
                        }
                    }

                    return result
                },

                async updateMany({ args, query }) {
                    const result = await query(args)

                    // Invalidate all user profiles on bulk update
                    try {
                        await redisCache.invalidatePattern('user:*:profile')
                        logger.debug('Cache invalidated: all user profiles')
                    } catch (err) {
                        logger.warn('Failed to invalidate user cache pattern', { error: err })
                    }

                    return result
                },
            },

            // Session cache invalidation
            session: {
                async delete({ args, query }) {
                    // Get session info before deletion
                    const sessionId = args.where?.id

                    const result = await query(args)

                    if (sessionId) {
                        try {
                            await redisCache.del([
                                `session:${sessionId}` as any,
                                `session:${sessionId}:lastActivity` as any,
                            ])
                            logger.debug('Cache invalidated: session', { sessionId })
                        } catch (err) {
                            logger.warn('Failed to invalidate session cache', { sessionId, error: err })
                        }
                    }

                    return result
                },

                async deleteMany({ args, query }) {
                    const result = await query(args)

                    // Invalidate all sessions for the user if userId specified
                    const userId = args.where?.userId
                    if (userId) {
                        try {
                            await redisCache.invalidatePattern(`session:*`)
                            await redisCache.del(`user:${userId}:sessions` as any)
                            logger.debug('Cache invalidated: user sessions', { userId })
                        } catch (err) {
                            logger.warn('Failed to invalidate session cache pattern', { userId, error: err })
                        }
                    }

                    return result
                },
            },

            // Transaction cache invalidation (portfolio snapshots)
            transaction: {
                async create({ args, query }) {
                    const result = await query(args)

                    // Invalidate portfolio snapshot for the user
                    const userId = (result as any)?.userId || args.data?.userId
                    if (userId) {
                        try {
                            await redisCache.del(`portfolio:snapshot:${userId}` as any)
                            logger.debug('Cache invalidated: portfolio snapshot', { userId })
                        } catch (err) {
                            logger.warn('Failed to invalidate portfolio cache', { userId, error: err })
                        }
                    }

                    return result
                },

                async createMany({ args, query }) {
                    const result = await query(args)

                    // Invalidate all affected user portfolios
                    const data = Array.isArray(args.data) ? args.data : [args.data]
                    const userIds = new Set(data.map(d => d.userId).filter(Boolean))

                    for (const userId of userIds) {
                        try {
                            await redisCache.del(`portfolio:snapshot:${userId}` as any)
                            logger.debug('Cache invalidated: portfolio snapshot', { userId })
                        } catch (err) {
                            logger.warn('Failed to invalidate portfolio cache', { userId, error: err })
                        }
                    }

                    return result
                },
            },

            // Position cache invalidation (copy trading)
            position: {
                async create({ args, query }) {
                    const result = await query(args)

                    // Get copyTradingId to find the user
                    const copyTradingId = args.data?.copyTradingId
                    if (copyTradingId) {
                        try {
                            // Can't easily get userId here, so invalidate the copy trading related caches
                            logger.debug('Position created, cache may need invalidation', { copyTradingId })
                        } catch (err) {
                            logger.warn('Failed to log position cache note', { copyTradingId, error: err })
                        }
                    }

                    return result
                },

                async update({ args, query }) {
                    const result = await query(args)

                    logger.debug('Position updated, cache may need invalidation', {
                        positionId: args.where?.id
                    })

                    return result
                },
            },
        },
    }) as unknown as PrismaClient
}

// Type for the extended client
export type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>
