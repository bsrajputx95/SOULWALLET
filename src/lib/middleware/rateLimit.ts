import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { TRPCError } from '@trpc/server';
import type { RateLimitContext } from './auth';
import { logger } from '../logger';



export interface RateLimitConfig {
  points: number; // Number of requests
  duration: number; // Per duration in seconds
  blockDuration?: number; // Block duration in seconds (defaults to duration)
  keyPrefix?: string; // Prefix for Redis keys
}

export interface RateLimitOptions {
  useRedis?: boolean;
  redisUrl?: string;
  defaultConfig?: RateLimitConfig;
  redisClient?: Redis;
}

/**
 * Rate limiter configurations for different endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints - balanced limits for security + usability
  login: {
    points: 10, // 10 attempts (was 3 - too strict for real usage!)
    duration: 900, // per 15 minutes (was 3600)
    blockDuration: 300, // block for 5 minutes (was 1800)
    keyPrefix: 'login',
  },
  signup: {
    points: 5, // 5 attempts (was 2 - too strict)
    duration: 3600, // per hour
    blockDuration: 1800, // block for 30 minutes (was 7200)
    keyPrefix: 'signup',
  },
  passwordReset: {
    points: 2, // Comment 4: 2 attempts per hour (stricter)
    duration: 3600, // per hour
    blockDuration: 7200, // block for 2 hours (escalated)
    keyPrefix: 'password_reset',
  },
  verifyOtp: {
    points: 5, // 5 attempts
    duration: 600, // per 10 minutes
    blockDuration: 1200, // block for 20 minutes (escalated)
    keyPrefix: 'verify_otp',
  },
  resetPassword: {
    points: 2, // Comment 4: 2 attempts per hour (stricter, alias for passwordReset)
    duration: 3600, // per hour
    blockDuration: 7200, // block for 2 hours (escalated)
    keyPrefix: 'reset_password',
  },
  changePassword: {
    points: 5, // 5 attempts
    duration: 3600, // per hour
    blockDuration: 3600, // block for 1 hour
    keyPrefix: 'change_password',
  },
  unlockAccount: {
    points: 3, // 3 attempts
    duration: 3600, // per hour
    blockDuration: 7200, // block for 2 hours (escalated)
    keyPrefix: 'unlock_account',
  },
  // Wallet operations - moderate limits
  walletCreate: {
    points: 5, // 5 wallet creations
    duration: 3600, // per hour
    blockDuration: 3600, // block for 1 hour
    keyPrefix: 'wallet_create',
  },
  walletImport: {
    points: 10, // 10 imports
    duration: 3600, // per hour
    blockDuration: 1800, // block for 30 minutes
    keyPrefix: 'wallet_import',
  },
  walletExport: {
    points: 3, // 3 exports
    duration: 3600, // per hour
    blockDuration: 3600, // block for 1 hour
    keyPrefix: 'wallet_export',
  },
  // Transaction operations
  transactionSend: {
    points: 20, // 20 transactions
    duration: 3600, // per hour
    blockDuration: 1800, // block for 30 minutes
    keyPrefix: 'transaction_send',
  },
  transactionHistory: {
    points: 50, // 50 requests
    duration: 300, // per 5 minutes
    blockDuration: 300, // block for 5 minutes
    keyPrefix: 'transaction_history',
  },
  // Swap operations
  swapQuote: {
    points: 100, // 100 quotes
    duration: 300, // per 5 minutes
    blockDuration: 300, // block for 5 minutes
    keyPrefix: 'swap_quote',
  },
  swapExecute: {
    points: 10, // 10 swaps
    duration: 3600, // per hour
    blockDuration: 1800, // block for 30 minutes
    keyPrefix: 'swap_execute',
  },
  // Portfolio operations
  portfolioSnapshot: {
    points: 20, // 20 snapshots
    duration: 3600, // per hour
    blockDuration: 1800, // block for 30 minutes
    keyPrefix: 'portfolio_snapshot',
  },
  portfolioHistory: {
    points: 30, // 30 requests
    duration: 300, // per 5 minutes
    blockDuration: 300, // block for 5 minutes
    keyPrefix: 'portfolio_history',
  },
  // Contact operations
  contactCreate: {
    points: 20, // 20 contacts
    duration: 3600, // per hour
    blockDuration: 1800, // block for 30 minutes
    keyPrefix: 'contact_create',
  },
  contactUpdate: {
    points: 50, // 50 updates
    duration: 3600, // per hour
    blockDuration: 900, // block for 15 minutes
    keyPrefix: 'contact_update',
  },
  // General API endpoints
  general: {
    points: 100, // 100 requests
    duration: 60, // per minute
    blockDuration: 60, // block for 1 minute
    keyPrefix: 'general',
  },
  // Strict rate limiting for sensitive operations
  strict: {
    points: 10, // 10 requests
    duration: 3600, // per hour
    blockDuration: 7200, // block for 2 hours (escalated)
    keyPrefix: 'strict',
  },
  // Admin operations - very strict
  admin: {
    points: 5, // 5 requests
    duration: 3600, // per hour
    blockDuration: 14400, // block for 4 hours
    keyPrefix: 'admin',
  },
} as const;

export class RateLimitService {
  private limiters: Map<string, RateLimiterMemory | RateLimiterRedis> = new Map();
  private useRedis: boolean;
  private redisClient?: Redis;

  constructor(options: RateLimitOptions = {}) {
    this.useRedis = options.useRedis || false;
    this.redisClient = options.redisClient;
    this.initializeLimiters(options);
  }

  private initializeLimiters(options: RateLimitOptions) {
    Object.entries(RATE_LIMIT_CONFIGS).forEach(([key, config]: [string, RateLimitConfig]) => {
      const limiterConfig = {
        points: config.points,
        duration: config.duration,
        blockDuration: config.blockDuration || config.duration,
      };

      let limiter: RateLimiterMemory | RateLimiterRedis;

      if (this.useRedis && (this.redisClient || options.redisUrl)) {
        const redis = this.redisClient || new Redis(options.redisUrl!, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
        });
        // Use Redis for distributed rate limiting
        limiter = new RateLimiterRedis({
          ...limiterConfig,
          storeClient: redis,
          keyPrefix: config.keyPrefix || 'rate_limit',
        });
      } else {
        // Use in-memory rate limiting
        limiter = new RateLimiterMemory({
          ...limiterConfig,
          keyPrefix: config.keyPrefix || 'rate_limit',
        });
      }

      this.limiters.set(key, limiter);
    });
  }

  /**
   * Check rate limit for a specific endpoint
   * Comment 3 fix: Enforce both IP-based and per-user rate limits independently
   * Comment 2: Integrate adaptive rate limiting
   * Comment 3: Integrate trusted IP bypass
   */
  async checkRateLimit(
    endpoint: keyof typeof RATE_LIMIT_CONFIGS,
    context: RateLimitContext
  ): Promise<{ bypassed?: boolean }> {
    // BETA MODE: Skip rate limiting entirely for beta testing
    if (process.env.BETA_MODE === 'true') {
      return { bypassed: true };
    }

    // Trusted IP bypass disabled for beta - all IPs subject to rate limiting

    const limiter = this.limiters.get(endpoint);
    if (!limiter) {
      throw new Error(`Rate limiter not found for endpoint: ${endpoint}`);
    }

    const config = RATE_LIMIT_CONFIGS[endpoint];

    // Consume IP-based rate limit first
    const ipKey = `ip:${context.ip}`;
    try {
      await limiter.consume(ipKey);
    } catch (rateLimiterRes: any) {
      if (rateLimiterRes && typeof rateLimiterRes.msBeforeNext === 'number') {
        const resetTime = new Date(Date.now() + rateLimiterRes.msBeforeNext);
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Too many ${endpoint} attempts from this IP. Try again after ${resetTime.toISOString()}`,
          cause: {
            retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000),
            limit: config.points,
            remaining: 0,
            resetTime: resetTime.toISOString(),
            limitType: 'IP',
          },
        });
      }
      logger.error('Error in IP rate limiting (possibly Redis)', rateLimiterRes);
      throw rateLimiterRes;
    }

    // Comment 3: Also enforce per-user rate limit when userId is present
    if (context.userId) {
      const userKey = `user:${context.userId}`;
      try {
        await limiter.consume(userKey);
      } catch (rateLimiterRes: any) {
        if (rateLimiterRes && typeof rateLimiterRes.msBeforeNext === 'number') {
          const resetTime = new Date(Date.now() + rateLimiterRes.msBeforeNext);
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Too many ${endpoint} attempts for this user. Try again after ${resetTime.toISOString()}`,
            cause: {
              retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000),
              limit: config.points,
              remaining: 0,
              resetTime: resetTime.toISOString(),
              limitType: 'USER',
            },
          });
        }
        logger.error('Error in user rate limiting (possibly Redis)', rateLimiterRes);
        throw rateLimiterRes;
      }
    }

    return { bypassed: false };
  }

  /**
   * Get rate limit status without consuming a point
   */
  async getRateLimitStatus(
    endpoint: keyof typeof RATE_LIMIT_CONFIGS,
    context: RateLimitContext
  ): Promise<{
    limit: number;
    remaining: number;
    resetTime: Date;
  }> {
    const limiter = this.limiters.get(endpoint);
    if (!limiter) {
      throw new Error(`Rate limiter not found for endpoint: ${endpoint}`);
    }

    const key = context.userId
      ? `${context.ip}:${context.userId}`
      : context.ip;

    const config = RATE_LIMIT_CONFIGS[endpoint];

    try {
      const rateLimiterRes = await limiter.get(key);

      if (rateLimiterRes) {
        return {
          limit: config.points,
          remaining: rateLimiterRes.remainingPoints || 0,
          resetTime: new Date(Date.now() + rateLimiterRes.msBeforeNext),
        };
      } else {
        return {
          limit: config.points,
          remaining: config.points,
          resetTime: new Date(Date.now() + config.duration * 1000),
        };
      }
    } catch (error) {
      // If there's an error getting status, assume no limits
      return {
        limit: config.points,
        remaining: config.points,
        resetTime: new Date(Date.now() + config.duration * 1000),
      };
    }
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  async resetRateLimit(
    endpoint: keyof typeof RATE_LIMIT_CONFIGS,
    context: RateLimitContext
  ): Promise<void> {
    const limiter = this.limiters.get(endpoint);
    if (!limiter) {
      throw new Error(`Rate limiter not found for endpoint: ${endpoint}`);
    }

    const key = context.userId
      ? `${context.ip}:${context.userId}`
      : context.ip;

    await limiter.delete(key);
  }

  /**
   * Block a specific key for a custom duration (admin function)
   */
  async blockKey(
    endpoint: keyof typeof RATE_LIMIT_CONFIGS,
    context: RateLimitContext,
    blockDurationSeconds: number
  ): Promise<void> {
    const limiter = this.limiters.get(endpoint);
    if (!limiter) {
      throw new Error(`Rate limiter not found for endpoint: ${endpoint}`);
    }

    const key = context.userId
      ? `${context.ip}:${context.userId}`
      : context.ip;

    const config = RATE_LIMIT_CONFIGS[endpoint];

    // Consume all points to trigger block
    try {
      await limiter.penalty(key, config.points, {
        customDuration: blockDurationSeconds,
      });
    } catch (error) {
      // Expected to throw when blocking
    }
  }

  /**
   * Get all rate limit statuses for monitoring (admin function)
   */
  async getAllRateLimitStatuses(context: RateLimitContext): Promise<{
    [endpoint: string]: {
      limit: number;
      remaining: number;
      resetTime: Date;
    };
  }> {
    const statuses: { [endpoint: string]: any } = {};

    for (const endpoint of Object.keys(RATE_LIMIT_CONFIGS) as (keyof typeof RATE_LIMIT_CONFIGS)[]) {
      try {
        statuses[endpoint] = await this.getRateLimitStatus(endpoint, context);
      } catch (error) {
        // Skip endpoints that error
        statuses[endpoint] = {
          limit: 0,
          remaining: 0,
          resetTime: new Date(),
          error: 'Failed to get status',
        };
      }
    }

    return statuses;
  }

  /**
   * Check if a key is currently blocked for an endpoint
   */
  async isBlocked(
    endpoint: keyof typeof RATE_LIMIT_CONFIGS,
    context: RateLimitContext
  ): Promise<boolean> {
    try {
      const status = await this.getRateLimitStatus(endpoint, context);
      return status.remaining === 0 && status.resetTime > new Date();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get rate limit metrics for monitoring
   */
  async getMetrics(): Promise<{
    totalEndpoints: number;
    activeEndpoints: number;
    configurations: typeof RATE_LIMIT_CONFIGS;
  }> {
    return {
      totalEndpoints: Object.keys(RATE_LIMIT_CONFIGS).length,
      activeEndpoints: this.limiters.size,
      configurations: RATE_LIMIT_CONFIGS,
    };
  }

  /**
   * Get Redis status for health monitoring
   */
  async getRedisStatus(): Promise<{ healthy: boolean; latency?: number; errorCount?: number; mode: 'redis' | 'memory' }> {
    if (!this.useRedis || !this.redisClient) {
      return { healthy: true, mode: 'memory' };
    }

    try {
      const start = Date.now();
      await this.redisClient.ping();
      const latency = Date.now() - start;
      return { healthy: true, latency, mode: 'redis', errorCount: 0 };
    } catch (error) {
      return { healthy: false, mode: 'redis', errorCount: 1 };
    }
  }
}

// Global rate limiter instance
let rateLimitService: RateLimitService;

/**
 * Initialize rate limiting service
 * Automatically detects Redis availability for production deployments.
 * Redis is recommended for production to ensure distributed rate limiting across multiple instances.
 */
export async function initializeRateLimiting(options: RateLimitOptions = {}): Promise<RateLimitService> {
  if (!rateLimitService) {
    // Automatically detect Redis availability for production deployments
    let useRedis = options.useRedis ?? false;
    let redisUrl = options.redisUrl;
    let redisClient: Redis | null = null;

    const fallbackToMemory = process.env.RATE_LIMIT_FALLBACK_TO_MEMORY !== 'false';
    const retryAttempts = parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3');
    const baseDelay = parseInt(process.env.REDIS_RETRY_DELAY || '1000');

    if (!options.useRedis && process.env.REDIS_URL && fallbackToMemory) {
      // Auto-detect Redis if not explicitly disabled
      try {
        redisClient = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 3000,
        });

        // Health check with exponential backoff retry
        let connected = false;
        let attempt = 0;
        const delays = Array.from({ length: retryAttempts }, (_, i) => baseDelay * Math.pow(2, i));
        while (!connected && attempt < retryAttempts) {
          try {
            await redisClient.connect();
            await redisClient.ping();
            connected = true;
            logger.info('✅ Redis connection established for rate limiting');
          } catch (error) {
            attempt++;
            if (attempt < retryAttempts) {
              const delay = delays[attempt - 1];
              logger.warn(`Redis connection attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              logger.warn('Redis connection failed after retries, falling back to memory-based rate limiting');
              try {
                redisClient.disconnect();
              } catch {
                void 0;
              }
              redisClient = null;
            }
          }
        }

        if (connected) {
          useRedis = true;
          redisUrl = process.env.REDIS_URL;
        }
      } catch (error) {
        logger.warn('Failed to initialize Redis for rate limiting:', error.message);
      }
    }

    logger.info('Rate limiting initialized', { mode: useRedis ? 'redis' : 'memory' });

    rateLimitService = new RateLimitService({ ...options, useRedis, redisUrl, redisClient });
  }
  return rateLimitService;
}

/**
 * Get the global rate limiter instance
 */
export function getRateLimiter(): RateLimitService {
  if (!rateLimitService) {
    rateLimitService = new RateLimitService();
  }
  return rateLimitService;
}

/**
 * Rate limiting middleware factory for tRPC
 */
export function createRateLimitMiddleware(endpoint: keyof typeof RATE_LIMIT_CONFIGS) {
  return async (context: RateLimitContext) => {
    const rateLimiter = getRateLimiter();
    await rateLimiter.checkRateLimit(endpoint, context);
  };
}

/**
 * Fastify rate limiting plugin with enhanced monitoring
 */
export async function fastifyRateLimitPlugin(fastify: any, options: RateLimitOptions = {}) {
  const rateLimiter = await initializeRateLimiting(options);

  fastify.decorateRequest('rateLimitContext', null);

  // Add rate limit context to request
  fastify.addHook('preHandler', async (request: any, _reply: any) => {
    const xfwdRaw = request?.headers?.['x-forwarded-for'];
    const xfwdStr = Array.isArray(xfwdRaw)
      ? (xfwdRaw[0] as string | undefined)
      : (typeof xfwdRaw === 'string' ? (xfwdRaw as string) : undefined);
    let ip: string = 'unknown';
    if (xfwdStr && xfwdStr.length > 0) {
      ip = xfwdStr.split(',')[0].trim();
    } else if (request?.socket?.remoteAddress) {
      ip = request.socket.remoteAddress;
    }

    const userAgent = request?.headers?.['user-agent'] as string | undefined;
    const userId = request?.auth?.user?.id;

    request.rateLimitContext = {
      ip,
      userAgent,
      userId,
    };
  });

  // Add comprehensive rate limit headers to response
  fastify.addHook('onSend', async (request: any, reply: any) => {
    if (request.rateLimitContext) {
      try {
        // Determine endpoint based on request path
        let endpoint: keyof typeof RATE_LIMIT_CONFIGS = 'general';

        // tRPC route mappings
        if (
          request.url?.includes('/api/trpc/auth.login') ||
          request.url?.includes('/api/v1/trpc/auth.login')
        ) endpoint = 'login';
        else if (
          request.url?.includes('/api/trpc/auth.signup') ||
          request.url?.includes('/api/v1/trpc/auth.signup')
        ) endpoint = 'signup';
        else if (
          request.url?.includes('/api/trpc/auth.verifyOtp') ||
          request.url?.includes('/api/v1/trpc/auth.verifyOtp')
        ) endpoint = 'verifyOtp';
        else if (
          request.url?.includes('/api/trpc/auth.resetPassword') ||
          request.url?.includes('/api/v1/trpc/auth.resetPassword')
        ) endpoint = 'resetPassword';
        else if (
          request.url?.includes('/api/trpc/auth.changePassword') ||
          request.url?.includes('/api/v1/trpc/auth.changePassword')
        ) endpoint = 'changePassword';
        else if (
          request.url?.includes('/api/trpc/wallet.send') ||
          request.url?.includes('/api/v1/trpc/wallet.send')
        ) endpoint = 'transactionSend';
        else if (
          request.url?.includes('/api/trpc/transaction.list') ||
          request.url?.includes('/api/v1/trpc/transaction.list')
        ) endpoint = 'transactionHistory';
        else if (
          request.url?.includes('/api/trpc/swap.getQuote') ||
          request.url?.includes('/api/v1/trpc/swap.getQuote')
        ) endpoint = 'swapQuote';
        else if (
          request.url?.includes('/api/trpc/swap.execute') ||
          request.url?.includes('/api/v1/trpc/swap.execute')
        ) endpoint = 'swapExecute';
        else if (
          request.url?.includes('/api/trpc/portfolio.snapshot') ||
          request.url?.includes('/api/v1/trpc/portfolio.snapshot')
        ) endpoint = 'portfolioSnapshot';
        else if (
          request.url?.includes('/api/trpc/portfolio.history') ||
          request.url?.includes('/api/v1/trpc/portfolio.history')
        ) endpoint = 'portfolioHistory';
        else if (
          request.url?.includes('/api/trpc/contact.create') ||
          request.url?.includes('/api/v1/trpc/contact.create')
        ) endpoint = 'contactCreate';
        else if (
          request.url?.includes('/api/trpc/contact.update') ||
          request.url?.includes('/api/v1/trpc/contact.update')
        ) endpoint = 'contactUpdate';
        // Legacy REST-like path fallbacks
        else if (request.url?.includes('/auth/login')) endpoint = 'login';
        else if (request.url?.includes('/auth/signup')) endpoint = 'signup';
        else if (request.url?.includes('/auth/verify-otp')) endpoint = 'verifyOtp';
        else if (request.url?.includes('/auth/reset-password')) endpoint = 'resetPassword';
        else if (request.url?.includes('/auth/change-password')) endpoint = 'changePassword';
        else if (request.url?.includes('/wallet/create')) endpoint = 'walletCreate';
        else if (request.url?.includes('/wallet/import')) endpoint = 'walletImport';
        else if (request.url?.includes('/wallet/export')) endpoint = 'walletExport';
        else if (request.url?.includes('/transaction/send')) endpoint = 'transactionSend';
        else if (request.url?.includes('/transaction/history')) endpoint = 'transactionHistory';
        else if (request.url?.includes('/swap/quote')) endpoint = 'swapQuote';
        else if (request.url?.includes('/swap/execute')) endpoint = 'swapExecute';
        else if (request.url?.includes('/portfolio/snapshot')) endpoint = 'portfolioSnapshot';
        else if (request.url?.includes('/portfolio/history')) endpoint = 'portfolioHistory';
        else if (request.url?.includes('/contact/create')) endpoint = 'contactCreate';
        else if (request.url?.includes('/contact/update')) endpoint = 'contactUpdate';
        else if (request.url?.includes('/admin/')) endpoint = 'admin';

        const status = await rateLimiter.getRateLimitStatus(endpoint, request.rateLimitContext);

        // Add standard rate limit headers
        reply.header('X-RateLimit-Limit', status.limit);
        reply.header('X-RateLimit-Remaining', status.remaining);
        reply.header('X-RateLimit-Reset', Math.ceil(status.resetTime.getTime() / 1000));

        // Add custom headers for enhanced monitoring
        reply.header('X-RateLimit-Endpoint', endpoint);
        reply.header('X-RateLimit-Policy', `${RATE_LIMIT_CONFIGS[endpoint].points}/${RATE_LIMIT_CONFIGS[endpoint].duration}s`);

        // Add warning header if approaching limit
        if (status.remaining <= Math.ceil(status.limit * 0.1)) {
          reply.header('X-RateLimit-Warning', 'Approaching rate limit');
        }
      } catch (error) {
        // Ignore errors when adding headers but log for debugging
        fastify.log.debug('Failed to add rate limit headers:', error);
      }
    }
  });

  // Add rate limit monitoring endpoint for admins
  fastify.get('/api/admin/rate-limits', async (request: any, reply: any) => {
    if (!request.rateLimitContext) {
      return reply.code(400).send({ error: 'Rate limit context not available' });
    }

    try {
      // Apply admin rate limiting
      await rateLimiter.checkRateLimit('admin', request.rateLimitContext);

      const metrics = await rateLimiter.getMetrics();
      const statuses = await rateLimiter.getAllRateLimitStatuses(request.rateLimitContext);

      return {
        metrics,
        statuses,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'TOO_MANY_REQUESTS') {
        return reply.code(429).send(error);
      }
      return reply.code(500).send({ error: 'Failed to get rate limit status' });
    }
  });

  return rateLimiter;
}

/**
 * Helper function to apply rate limiting to specific routes
 */
export async function applyRateLimit(
  endpoint: keyof typeof RATE_LIMIT_CONFIGS,
  context: RateLimitContext
): Promise<void> {
  const rateLimiter = getRateLimiter();
  await rateLimiter.checkRateLimit(endpoint, context);
}
