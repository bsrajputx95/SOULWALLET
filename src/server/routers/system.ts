import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { getFeatureFlags } from '../../lib/featureFlags';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { TRPCError } from '@trpc/server';
import * as os from 'os';
import { JWTRotationService } from '../../lib/services/jwtRotation'
import { rpcManager } from '../../lib/services/rpcManager'
import { getCacheMetrics, getRedisHealth } from '../../lib/redis'

export const systemRouter = router({
  /**
   * Get feature flags
   */
  getFeatureFlags: publicProcedure.query(async () => {
    return getFeatureFlags();
  }),

  /**
   * Health check endpoint
   */
  healthCheck: publicProcedure.query(async () => {
    try {
      const checks = {
        status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: false,
          solana: false,
          redis: false,
        },
        version: process.env.npm_package_version || '1.0.0',
      };

      // Check database - Plan2 Step 2: Use $executeRaw for health check (safe constant query)
      try {
        await prisma.$executeRaw`SELECT 1`;
        checks.checks.database = true;
      } catch (error) {
        logger.error('Database health check failed:', error);
        checks.status = 'degraded';
      }

      // Check Solana RPC
      try {
        const slot = await rpcManager.withFailover((connection) => connection.getSlot());
        checks.checks.solana = slot > 0;
      } catch (error) {
        logger.error('Solana RPC health check failed:', error);
        checks.status = 'degraded';
      }

      // Check Redis if configured
      try {
        const redisHealth = await getRedisHealth()
        checks.checks.redis = redisHealth.healthy
        if (!redisHealth.healthy) {
          checks.status = 'degraded'
        }
      } catch (error) {
        logger.error('Redis health check failed:', error);
        checks.status = 'degraded';
      }

      // Set overall status
      const allHealthy = Object.values(checks.checks).every(v => v === true);
      if (!allHealthy && checks.status === 'healthy') {
        checks.status = 'degraded';
      }

      return checks;
    } catch (error) {
      logger.error('Health check error:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        error: 'Health check failed',
      };
    }
  }),

  /**
   * Get system metrics
   */
  metrics: protectedProcedure
    .input(z.object({
      includeDetails: z.boolean().default(false),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Check if user is admin
        if (ctx.user.role !== 'ADMIN') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const metrics = {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: {
            used: process.memoryUsage().heapUsed / 1024 / 1024,
            total: process.memoryUsage().heapTotal / 1024 / 1024,
            rss: process.memoryUsage().rss / 1024 / 1024,
          },
          cpu: process.cpuUsage(),
          system: {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem() / 1024 / 1024 / 1024,
            freeMemory: os.freemem() / 1024 / 1024 / 1024,
            loadAverage: os.loadavg(),
          },
          database: {
            users: 0,
            transactions: 0,
            sessions: 0,
          },
          redis: null as null | { health: Awaited<ReturnType<typeof getRedisHealth>>; cache: ReturnType<typeof getCacheMetrics> },
        };

        if (input.includeDetails) {
          // Get database stats
          metrics.database.users = await prisma.user.count();
          metrics.database.transactions = await prisma.transaction.count();
          metrics.database.sessions = await prisma.session.count({
            where: { expiresAt: { gt: new Date() } },
          });

          metrics.redis = {
            health: await getRedisHealth(),
            cache: getCacheMetrics(),
          }
        }

        return metrics;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Get metrics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get metrics',
        });
      }
    }),

  /**
   * Get system logs (admin only)
   */
  logs: protectedProcedure
    .input(z.object({
      level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Check if user is admin
        if (ctx.user.role !== 'ADMIN') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        // In production, this would fetch from a logging service
        // For now, return mock data
        return {
          logs: [],
          total: 0,
          level: input.level,
          message: 'Logging service not configured',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Get logs error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get logs',
        });
      }
    }),

  migrateCustodialWallets: protectedProcedure
    .input(z.object({
      batchSize: z.number().min(1).max(1000).default(100),
    }))
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        })
      }
      // Key migration - not required for beta
      return { success: true, migrated: 0, message: 'Key migration not required for beta' }
    }),

  getKeyOperationLogs: protectedProcedure
    .input(z.object({
      operation: z.string().optional(),
      userId: z.string().optional(),
      take: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        })
      }
      try {
        const where: any = {}
        if (input.operation) where.operation = input.operation
        if (input.userId) where.userId = input.userId
        return await prisma.keyOperationLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.take,
        })
      } catch (error) {
        logger.error('Get key operation logs error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch key operation logs',
        })
      }
    }),

  /**
   * Get JWT rotation status (admin only)
   */
  getJWTRotationStatus: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        })
      }
      try {
        return await JWTRotationService.getRotationStatus()
      } catch (error) {
        logger.error('Get JWT rotation status error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get JWT rotation status',
        })
      }
    }),

  /**
   * Get API version and build info
   */
  version: publicProcedure.query(async () => {
    return {
      version: process.env.npm_package_version || '1.0.0',
      build: process.env.BUILD_NUMBER || 'dev',
      environment: process.env.NODE_ENV || 'development',
      commit: process.env.GIT_COMMIT || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Ping endpoint for monitoring
   */
  ping: publicProcedure.query(async () => {
    return {
      pong: true,
      timestamp: Date.now(),
    };
  }),
});
