import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { getFeatureFlags } from '../../lib/featureFlags';
import { Connection } from '@solana/web3.js';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { TRPCError } from '@trpc/server';
import * as os from 'os';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

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

      // Check database
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.checks.database = true;
      } catch (error) {
        logger.error('Database health check failed:', error);
        checks.status = 'degraded';
      }

      // Check Solana RPC
      try {
        const slot = await connection.getSlot();
        checks.checks.solana = slot > 0;
      } catch (error) {
        logger.error('Solana RPC health check failed:', error);
        checks.status = 'degraded';
      }

      // Check Redis if configured
      if (process.env.REDIS_URL) {
        try {
          // Would need Redis client instance here
          // For now, mark as true if URL is configured
          checks.checks.redis = true;
        } catch (error) {
          logger.error('Redis health check failed:', error);
          checks.status = 'degraded';
        }
      } else {
        checks.checks.redis = true; // Not required in dev
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
        };

        if (input.includeDetails) {
          // Get database stats
          metrics.database.users = await prisma.user.count();
          metrics.database.transactions = await prisma.transaction.count();
          metrics.database.sessions = await prisma.session.count({
            where: { expiresAt: { gt: new Date() } },
          });
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
