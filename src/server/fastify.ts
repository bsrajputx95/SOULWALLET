import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { appRouter, initializeApp, routerConfig, getCleanupService } from './index';
import { createTRPCContext } from './trpc';
import { fastifyAuthPlugin } from '../lib/middleware/auth';
import { fastifyRateLimitPlugin, getRateLimiter } from '../lib/middleware/rateLimit';
import { disconnectDatabase, checkDatabaseHealth, getPoolMetrics } from '../lib/prisma';
import { logger } from '../lib/logger';
import { fastifyRequestIdPlugin } from '../lib/middleware/requestId';
import { apiLoggingPlugin } from '../lib/middleware/apiLogging';
import { getRequestId } from '../lib/middleware/requestId';
import { geoBlockMiddleware } from '../lib/middleware/geoBlock';
import Redis from 'ioredis';
import { collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';
// Comment 2: Import request size limits for enforcing body size
import { REQUEST_SIZE_LIMITS } from '../lib/middleware/requestSize';
// Comment 4: Import AuthorizationService for admin IP whitelisting
import { AuthorizationService } from '../lib/services/authorization';
import { rpcManager } from '../lib/services/rpcManager';
// Comment 1: Import queue manager for request queue limits
import { queueManager } from '../lib/services/queueManager';
import { getAllCircuitBreakerSnapshots } from '../lib/services/circuitBreaker';
import { executionQueue } from '../lib/services/executionQueue';
import { getCacheMetrics } from '../lib/redis';
// Business metrics for low-cardinality route normalization and counters
import { normalizeRoute, getBusinessMetricsRegistry } from '../lib/metrics';

// Initialize Sentry for backend error tracking
let sentryInitialized = false;
function initializeBackendSentry() {
  const dsn = process.env.SENTRY_BACKEND_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn || dsn === 'your-sentry-dsn-here' || dsn === 'disabled') {
    logger.info('â„¹ï¸  Backend Sentry not initialized (DSN not configured)');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

      // Filter sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['x-csrf-token'];
        }

        // Remove sensitive data from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            if (breadcrumb.data) {
              delete breadcrumb.data.password;
              delete breadcrumb.data.token;
              delete breadcrumb.data.privateKey;
              delete breadcrumb.data.mnemonic;
            }
            return breadcrumb;
          });
        }

        return event;
      },
    });

    sentryInitialized = true;
    logger.info('âœ… Backend Sentry initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize backend Sentry:', error);
  }
}

// Export for use in trpc.ts
export function isSentryInitialized() {
  return sentryInitialized;
}

export { Sentry };

/**
 * Generate a cryptographically secure CSRF token
 * Uses crypto.randomBytes for strong randomness instead of Math.random()
 * @returns A 32-character hex string token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create and configure Fastify server
 */
export async function createServer(): Promise<FastifyInstance> {
  // Initialize DI container before anything else (Comment 1: DI Bootstrap)
  const { setupContainer } = await import('../lib/di/container');
  setupContainer();

  // Initialize Sentry before creating server
  initializeBackendSentry();

  // Initialize configuration from Vault (production) or env vars (development)
  // This MUST be called before accessing secrets
  const { initializeConfig, getConfig, checkFeatureFlag } = await import('../lib/config/bootstrap');
  const appConfig = await initializeConfig();

  logger.info('Configuration initialized', {
    source: appConfig.secretsSource,
    maintenanceMode: appConfig.maintenanceMode
  });

  const server = Fastify({
    logger: {
      level: routerConfig.logging.level as 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
    },
    bodyLimit: parseInt(routerConfig.limits.bodySize.replace('mb', '')) * 1024 * 1024,
    trustProxy: true,
  });

  // Maintenance mode check - block all non-health requests if enabled
  server.addHook('preHandler', async (request, reply) => {
    const config = getConfig();
    if (config.maintenanceMode && !request.url?.startsWith('/health')) {
      return reply.code(503).send({
        error: 'Service Unavailable',
        message: 'System is under maintenance. Please try again later.',
        maintenanceMode: true,
      });
    }
  });

  // Feature flag middleware - check swap/copy-trading availability
  server.addHook('preHandler', async (request: any, reply) => {
    const url = request.url || '';

    // Block swap operations if disabled
    if (url.includes('/swap') || url.includes('swap.')) {
      const swapEnabled = await checkFeatureFlag('swap-enabled', request.auth?.user?.id);
      if (!swapEnabled) {
        return reply.code(503).send({
          error: 'Feature Disabled',
          message: 'Swap functionality is temporarily disabled.',
        });
      }
    }

    // Block copy trading if disabled
    if (url.includes('/copyTrading') || url.includes('copyTrading.')) {
      const copyEnabled = await checkFeatureFlag('copy-trading-v2', request.auth?.user?.id);
      if (!copyEnabled && url.includes('v2')) {
        return reply.code(503).send({
          error: 'Feature Disabled',
          message: 'Copy Trading V2 is not available yet.',
        });
      }
    }
  });

  const metricsRegistry = new Registry();
  collectDefaultMetrics({ register: metricsRegistry, prefix: 'soulwallet_' });


  const httpRequestDurationSeconds = new Histogram({
    name: 'soulwallet_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
  });

  const appUp = new Gauge({
    name: 'soulwallet_up',
    help: '1 if the process is running',
    registers: [metricsRegistry],
  });

  const redisCacheHitsTotal = new Gauge({
    name: 'soulwallet_redis_cache_hits_total',
    help: 'Redis cache hits (cumulative)',
    registers: [metricsRegistry],
  });
  const redisCacheMissesTotal = new Gauge({
    name: 'soulwallet_redis_cache_misses_total',
    help: 'Redis cache misses (cumulative)',
    registers: [metricsRegistry],
  });
  const redisCacheErrorsTotal = new Gauge({
    name: 'soulwallet_redis_cache_errors_total',
    help: 'Redis cache errors (cumulative)',
    registers: [metricsRegistry],
  });
  const redisCacheSlowOpsTotal = new Gauge({
    name: 'soulwallet_redis_cache_slow_ops_total',
    help: 'Redis slow ops (cumulative)',
    registers: [metricsRegistry],
  });
  const redisCacheTotalOps = new Gauge({
    name: 'soulwallet_redis_cache_total_ops',
    help: 'Redis total ops (cumulative)',
    registers: [metricsRegistry],
  });
  const redisCacheHitRate = new Gauge({
    name: 'soulwallet_redis_cache_hit_rate',
    help: 'Redis cache hit rate (0..1)',
    registers: [metricsRegistry],
  });
  const redisCacheAvgLatencyMs = new Gauge({
    name: 'soulwallet_redis_cache_avg_latency_ms',
    help: 'Redis average op latency in milliseconds',
    registers: [metricsRegistry],
  });

  const prismaPoolActiveConnections = new Gauge({
    name: 'soulwallet_prisma_pool_active_connections',
    help: 'Prisma pool active connections',
    registers: [metricsRegistry],
  });
  const prismaPoolIdleConnections = new Gauge({
    name: 'soulwallet_prisma_pool_idle_connections',
    help: 'Prisma pool idle connections',
    registers: [metricsRegistry],
  });
  const prismaPoolTotalConnections = new Gauge({
    name: 'soulwallet_prisma_pool_total_connections',
    help: 'Prisma pool total connections',
    registers: [metricsRegistry],
  });
  const prismaPoolWaitingRequests = new Gauge({
    name: 'soulwallet_prisma_pool_waiting_requests',
    help: 'Prisma pool waiting requests',
    registers: [metricsRegistry],
  });
  const prismaPoolUtilizationPercent = new Gauge({
    name: 'soulwallet_prisma_pool_utilization_percent',
    help: 'Prisma pool utilization percent',
    registers: [metricsRegistry],
  });
  const prismaPoolAlertThresholdPercent = new Gauge({
    name: 'soulwallet_prisma_pool_alert_threshold_percent',
    help: 'Prisma pool alert threshold percent',
    registers: [metricsRegistry],
  });
  const prismaPoolHealthy = new Gauge({
    name: 'soulwallet_prisma_pool_healthy',
    help: '1 if Prisma pool utilization is below alert threshold',
    registers: [metricsRegistry],
  });

  // Sentry request tracking hook
  if (sentryInitialized) {
    server.addHook('onRequest', async (request, _reply) => {
      // Set request context for Sentry
      Sentry.setContext('request', {
        url: request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    });

    // Sentry error capturing hook
    server.addHook('onError', async (request, _reply, error) => {
      Sentry.captureException(error, {
        extra: {
          url: request.url,
          method: request.method,
          requestId: getRequestId(),
        },
      });
    });
  }

  server.addHook('onRequest', async (request: any) => {
    const url = request.url || '';
    if (url === '/metrics' || url.startsWith('/health')) return;
    request.__metricsStartTime = process.hrtime.bigint();
  });

  server.addHook('onResponse', async (request: any, reply: any) => {
    const start = request.__metricsStartTime as bigint | undefined;
    if (!start) return;
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;

    // Use normalizeRoute for low-cardinality labels
    // This maps tRPC routes to procedure names and strips IDs from REST routes
    const rawRoute =
      request.routeOptions?.url ||
      request.routerPath ||
      (typeof request.url === 'string' ? request.url.split('?')[0] : 'unknown');
    const route = normalizeRoute(rawRoute, request.method);

    httpRequestDurationSeconds.observe(
      { method: request.method, route, status_code: String(reply.statusCode) },
      durationSeconds
    );
  });

  // Health check cache
  const healthCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL = 5000; // 5 seconds
  const healthRefreshInFlight = new Map<string, Promise<any>>();

  function runHealthRefresh<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = healthRefreshInFlight.get(key) as Promise<T> | undefined
    if (existing) return existing
    const p = fn().finally(() => {
      healthRefreshInFlight.delete(key)
    })
    healthRefreshInFlight.set(key, p as any)
    return p
  }

  // Comment 2: Initialize pub/sub for cross-instance coordination in production
  if (process.env.NODE_ENV === 'production') {
    const { pubsub } = await import('../lib/services/pubsub')

    // Wait for pubsub to be ready or timeout after 5 seconds
    let waitTime = 0
    while (!pubsub.isReady() && waitTime < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waitTime += 100
    }

    if (pubsub.isReady()) {
      logger.info('[Fastify] Pub/sub initialized successfully', pubsub.getStatus())

      // Subscribe to cache invalidation events from other instances
      pubsub.subscribe('system:broadcast', (data: { type: string; message: string }) => {
        if (data.type === 'cache:invalidate') {
          logger.info('[Fastify] Cache invalidation received', data)
          healthCache.clear() // Clear local health cache
        }
      })
    } else {
      logger.warn('[Fastify] Pub/sub not ready after timeout, continuing without cross-instance coordination')
    }

    // Graceful shutdown
    server.addHook('onClose', async () => {
      await pubsub.shutdown()
    })
  }

  // Redis connection singleton (Audit Issue #7)
  let redisClient: Redis | null = null;

  function getRedisClient(): Redis | null {
    if (!process.env.REDIS_URL) return null;
    if (!redisClient) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) return null; // Stop retrying after 3 attempts
          return Math.min(times * 100, 3000);
        },
      });

      redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
      });
    }
    return redisClient;
  }

  // Helper functions for health checks
  async function checkRedisHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const client = getRedisClient();
    if (!client) return { healthy: false, error: 'Redis not configured' };
    try {
      const start = Date.now();
      await client.ping();
      const latency = Date.now() - start;
      // Don't disconnect - reuse the connection (Audit Issue #7)
      return { healthy: true, latency };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  async function checkSolanaHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await rpcManager.withFailover((connection) => connection.getSlot());
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  // Rate limiter status check (unused but kept for future use)
  // function checkRateLimiterStatus(): { healthy: boolean; error?: string } {
  //   if (routerConfig.security.rateLimit) {
  //     return { healthy: true };
  //   } else {
  //     return { healthy: false, error: 'Rate limiting disabled' };
  //   }
  // }

  // Register request ID plugin (before auth to ensure request ID is available)
  if (fastifyRequestIdPlugin) {
    await server.register(fastifyRequestIdPlugin)
  }

  /**
   * Comment 2: Global request size validation hook
   * Enforces Content-Length checks before body parsing to prevent DoS attacks
   * - Default: 10MB max (matches bodyLimit config)
   * - Returns 413 Payload Too Large when exceeded
   */
  server.addHook('preHandler', async (request, reply) => {
    const contentLength = request.headers['content-length'];

    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (!isNaN(size) && size > REQUEST_SIZE_LIMITS.MAX_BODY) {
        logger.warn('Request payload too large', {
          size,
          maxSize: REQUEST_SIZE_LIMITS.MAX_BODY,
          ip: request.ip,
          path: request.url
        });
        return reply.code(413).send({
          error: 'Payload Too Large',
          message: `Request body exceeds maximum size of 10MB. Current size: ${(size / (1024 * 1024)).toFixed(2)}MB`,
          maxSize: REQUEST_SIZE_LIMITS.MAX_BODY,
          currentSize: size,
        });
      }
    }
  });

  /**
   * Comment 1: Request queue limits preHandler
   * Prevents resource exhaustion by limiting concurrent requests per user/IP
   * - Acquires a slot before processing
   * - Returns 503 if queue is full
   * - Stores slotId on request for release in onResponse
   */
  server.addHook('preHandler', async (request: any, reply) => {
    // Skip queue management for health check endpoints
    const url = request.url || '';
    if (url === '/metrics' || url.startsWith('/health')) {
      return;
    }

    // Get user ID from auth context (if available) and IP
    const userId = request.auth?.user?.id;
    const ip = request.ip || 'unknown';

    // Try to acquire a queue slot
    const slotId = await queueManager.acquireSlot(userId, ip);

    if (slotId === null) {
      // Queue is full, return 503
      const queueStatus = await queueManager.getQueueStatus();
      logger.warn('[QueueManager] Request rejected - queue full', {
        ip,
        userId,
        queueDepth: queueStatus.globalQueueDepth,
        url,
      });
      return reply.code(503).send({
        error: 'Service Unavailable',
        message: 'Too many concurrent requests. Please try again.',
        retryAfter: 5,
        queueDepth: queueStatus.globalQueueDepth,
        maxQueueDepth: queueManager.getConfig().maxQueueDepth,
      });
    }

    // Store slotId on request for release in onResponse
    request.queueSlotId = slotId;
  });

  /**
   * Comment 1: Release queue slot on response
   */
  server.addHook('onResponse', async (request: any, _reply) => {
    if (request.queueSlotId) {
      await queueManager.releaseSlot(request.queueSlotId);
    }
  });

  /**
   * Comment 4: Admin IP whitelisting middleware for Fastify admin endpoints
   * Requires authenticated admin user and validates IP whitelist before allowing access
   */
  server.addHook('preHandler', async (request: any, reply: any) => {
    // Only apply to admin routes
    if (!request.url?.startsWith('/api/admin') && !request.url?.startsWith('/admin')) {
      return;
    }

    // Get auth context from request (set by auth plugin)
    const auth = request.auth;

    // Check if user is authenticated and is an admin
    if (!auth?.isAuthenticated || !auth.user || auth.user.role !== 'ADMIN') {
      await AuthorizationService.auditAuthorization(
        {
          userId: auth?.user?.id,
          role: auth?.user?.role,
          ipAddress: request.ip || 'unknown',
          userAgent: request.headers?.['user-agent'],
          endpoint: request.url,
        },
        false,
        'Admin access required but user is not authenticated or not admin'
      );
      return reply.code(403).send({ error: 'Admin access required' });
    }

    // Check admin IP whitelist
    const ipAllowed = await AuthorizationService.checkAdminIpWhitelist(
      auth.user.id,
      request.ip || 'unknown'
    );

    if (!ipAllowed) {
      await AuthorizationService.auditAuthorization(
        {
          userId: auth.user.id,
          role: auth.user.role,
          ipAddress: request.ip || 'unknown',
          userAgent: request.headers?.['user-agent'],
          endpoint: request.url,
        },
        false,
        'IP not whitelisted for admin operations'
      );
      return reply.code(403).send({ error: 'Admin access not allowed from this IP address' });
    }

    // Log successful admin access
    await AuthorizationService.auditAuthorization(
      {
        userId: auth.user.id,
        role: auth.user.role,
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers?.['user-agent'],
        endpoint: request.url,
      },
      true,
      'Admin access granted'
    );
  });

  /**
   * Comment 2: Global geo-blocking middleware for auth-related paths
   * Enforces OFAC/FATF geo-blocking at Fastify level for auth endpoints
   * - Applied to /api/trpc/auth.* and /api/auth/* paths
   * - Can be disabled via GEO_BLOCKING_ENABLED=false for non-prod environments
   * - Translates TRPCError to 403 Forbidden HTTP response
   */
  if (process.env.GEO_BLOCKING_ENABLED !== 'false') {
    server.addHook('onRequest', async (request, reply) => {
      const url = request.url || '';

      // Only apply geo-blocking to auth-related paths
      const isAuthPath = url.includes('/api/trpc/auth.') ||
        url.includes('/api/trpc/auth/') ||
        url.includes('/api/v1/trpc/auth.') ||
        url.includes('/api/v1/trpc/auth/') ||
        url.startsWith('/api/auth/') ||
        url.startsWith('/api/auth');

      if (!isAuthPath) {
        return;
      }

      try {
        await geoBlockMiddleware(request.ip || 'unknown');
      } catch (error: any) {
        // TRPCError from geoBlockMiddleware means the request is from a blocked region
        if (error?.code === 'FORBIDDEN' || error?.message?.includes('region')) {
          logger.warn('[GeoBlock] Auth request blocked by geo-restriction', {
            ip: request.ip,
            path: url,
            country: error?.cause || 'unknown',
          });
          return reply.code(403).send({
            error: 'Forbidden',
            message: 'Service unavailable in your region',
            code: 'GEO_BLOCKED',
          });
        }
        // For other errors, log warning and continue (fail-open for availability)
        logger.warn('[GeoBlock] Geo-check failed, allowing request (fail-open)', {
          ip: request.ip,
          path: url,
          error: error?.message,
        });
      }
    });

    logger.info('[GeoBlock] Global geo-blocking middleware enabled for auth paths');
  }

  server.get('/metrics', async (_request, reply) => {
    try {
      appUp.set(1);

      const cache = getCacheMetrics();
      redisCacheHitsTotal.set(cache.hits);
      redisCacheMissesTotal.set(cache.misses);
      redisCacheErrorsTotal.set(cache.errors);
      redisCacheSlowOpsTotal.set(cache.slowOps);
      redisCacheTotalOps.set(cache.totalOps);
      redisCacheHitRate.set(cache.hitRate);
      redisCacheAvgLatencyMs.set(cache.avgLatencyMs);

      const pool = getPoolMetrics();
      prismaPoolActiveConnections.set(pool.metrics.activeConnections);
      prismaPoolIdleConnections.set(pool.metrics.idleConnections);
      prismaPoolTotalConnections.set(pool.metrics.totalConnections);
      prismaPoolWaitingRequests.set(pool.metrics.waitingRequests);
      prismaPoolUtilizationPercent.set(pool.metrics.utilizationPercent);
      prismaPoolAlertThresholdPercent.set(pool.alertThreshold);
      prismaPoolHealthy.set(pool.healthy ? 1 : 0);

      const body = await metricsRegistry.metrics();
      reply.header('Content-Type', metricsRegistry.contentType);
      return reply.send(body);
    } catch (error: any) {
      logger.error('Failed to collect metrics', { error });
      return reply.code(500).send('Failed to collect metrics');
    }
  });

  // Prometheus AlertManager webhook endpoint
  // Receives alerts from Prometheus AlertManager and processes them
  server.post('/api/alerts/prometheus', async (request, reply) => {
    try {
      const { alertManager } = await import('../lib/services/alertManager');

      // Basic auth validation (optional, configured via environment)
      const authHeader = request.headers.authorization;
      const expectedUser = process.env.PROMETHEUS_WEBHOOK_USER || 'prometheus';
      const expectedPass = process.env.PROMETHEUS_WEBHOOK_PASSWORD;

      if (expectedPass) {
        const expectedAuth = `Basic ${Buffer.from(`${expectedUser}:${expectedPass}`).toString('base64')}`;
        if (authHeader !== expectedAuth) {
          logger.warn('[Prometheus Webhook] Unauthorized request', { ip: request.ip });
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      }

      const payload = request.body as any;

      // Validate payload structure
      if (!payload || !Array.isArray(payload.alerts)) {
        return reply.code(400).send({ error: 'Invalid payload: missing alerts array' });
      }

      // Process alerts
      const processedAlerts = await alertManager.handlePrometheusWebhook(payload);

      return reply.send({
        success: true,
        processed: processedAlerts.length,
        totalReceived: payload.alerts.length
      });
    } catch (error: any) {
      logger.error('[Prometheus Webhook] Error processing alerts', { error: error.message });
      return reply.code(500).send({ error: 'Failed to process alerts' });
    }
  });

  // Query Performance Admin Endpoint
  // Provides insights into database query performance using pg_stat_statements
  // Requires admin authentication and IP whitelisting (enforced by preHandler hook)
  server.get('/api/admin/query-performance', async (request: any, reply) => {
    try {
      const { queryPerformanceService } = await import('../lib/services/queryPerformance');

      // Get comprehensive performance summary
      const performance = await queryPerformanceService.getPerformanceSummary();

      // Optional: Get additional metrics
      const [indexUsage, tableBloat, longRunning] = await Promise.all([
        queryPerformanceService.getIndexUsage(),
        queryPerformanceService.getTableBloat(),
        queryPerformanceService.getLongRunningQueries(),
      ]);

      return reply.send({
        success: true,
        extensionAvailable: performance.extensionAvailable,
        slowQueries: performance.slowQueries,
        topByTime: performance.topByTime,
        n1Problems: performance.n1Problems,
        cacheHitRatio: performance.cacheHitRatio,
        indexUsage,
        tableBloat,
        longRunningQueries: longRunning,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[Query Performance] Error fetching metrics', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch query performance metrics' });
    }
  });

  // Reset query statistics (admin only)
  server.post('/api/admin/query-performance/reset', async (request: any, reply) => {
    try {
      const { queryPerformanceService } = await import('../lib/services/queryPerformance');

      const success = await queryPerformanceService.resetStats();

      if (success) {
        logger.info('[Query Performance] Statistics reset by admin', {
          userId: request.auth?.user?.id
        });
        return reply.send({ success: true, message: 'Query statistics reset successfully' });
      } else {
        return reply.code(500).send({ error: 'Failed to reset statistics' });
      }
    } catch (error: any) {
      logger.error('[Query Performance] Error resetting stats', { error: error.message });
      return reply.code(500).send({ error: 'Failed to reset query statistics' });
    }
  });

  // Register Swagger/OpenAPI documentation (Comment 3)
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'SoulWallet API',
        description: 'SoulWallet trading platform API - Solana swap, copy trading, and social features',
        version: '1.0.0',
      },
      servers: [
        { url: '/api/v1', description: 'Versioned API endpoint' },
      ],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'wallet', description: 'Wallet operations' },
        { name: 'swap', description: 'Token swap operations' },
        { name: 'copyTrading', description: 'Copy trading features' },
        { name: 'social', description: 'Social features' },
        { name: 'webhook', description: 'Webhook management' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // OpenAPI JSON endpoint
  server.get('/api/openapi.json', async (_request, reply) => {
    return reply.send(server.swagger());
  });

  // Register CORS with strict origin validation
  // 
  // CORS Behavior Notes:
  // - The CORS origin callback cannot distinguish request paths, so the !origin allowance
  //   applies to ALL routes (needed for server-to-server calls, curl, mobile apps without Origin)
  // - The onRequest hook below provides stricter path-based origin validation for production
  // - Requests without Origin header are allowed at CORS level but may be blocked by onRequest hook
  //   unless they include x-mobile-app-version header or target allowlisted paths
  //
  // Allowlisted paths (no origin validation required):
  // - /health, /health/* - Health check endpoints for monitoring
  // - /api, /api/docs - API info and documentation
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];

  // Add development origins
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:8081', 'exp://localhost:8081');
  }

  await server.register(cors, {
    origin: (origin, callback) => {
      // Allow requests without Origin header (server-to-server, curl, mobile apps)
      // Note: Production origin validation is enforced in onRequest hook below
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        server.log.warn({ origin, allowedOrigins }, 'CORS: Origin not allowed');
        callback(new Error('Not allowed by CORS policy'), false);
      }
    },
    credentials: true,
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Endpoint', 'X-RateLimit-Policy'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-trpc-source', 'x-client-version', 'x-mobile-app-version', 'X-CSRF-Token'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
  });

  // CSRF Protection Hook
  // Security Rationale: Prevents Cross-Site Request Forgery attacks by requiring a token
  // that must match between cookie and header on state-changing requests (POST, PUT, DELETE)
  // Enable with CSRF_ENABLED=true in production
  //
  // Implementation Notes:
  // - CSRF tokens are stateless: validated by matching cookie and X-CSRF-Token header
  // - Tokens are cryptographically generated using crypto.randomBytes (64 hex chars)
  // - SameSite=Strict cookie prevents cross-site request attacks
  //
  // Client Integration:
  // - Web clients: Token is automatically set via cookie on first GET request
  // - Mobile clients: Call GET /api/csrf to obtain token, then include in X-CSRF-Token header
  // - All state-changing requests (POST, PUT, DELETE) must include X-CSRF-Token header
  if (process.env.CSRF_ENABLED === 'true') {
    server.addHook('preHandler', async (request, reply) => {
      // Parse cookies from request header
      const parseCookies = (cookieHeader?: string): Record<string, string> => {
        const out: Record<string, string> = {};
        if (!cookieHeader) return out;
        cookieHeader.split(';').forEach((v) => {
          const idx = v.indexOf('=');
          const key = v.substring(0, idx).trim();
          const val = v.substring(idx + 1).trim();
          if (key) out[key] = decodeURIComponent(val);
        });
        return out;
      };

      const cookies = parseCookies(request.headers.cookie as string | undefined);
      const tokenHeader = request.headers['x-csrf-token'];
      const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
      const cookieToken = cookies['csrf_token'];
      const isGet = request.method === 'GET';

      // For GET requests without a CSRF cookie, generate and set a new token
      // This allows clients to obtain a token for subsequent state-changing requests
      if (isGet && !cookieToken) {
        const newToken = generateCsrfToken();
        // SameSite=Strict prevents the cookie from being sent in cross-site requests
        // HttpOnly is intentionally NOT set so JavaScript can read the token for header
        reply.header('Set-Cookie', `csrf_token=${encodeURIComponent(newToken)}; Path=/; SameSite=Strict`);
        return;
      }

      // For state-changing requests (POST, PUT, DELETE), validate CSRF token
      // Token must be present in both cookie and X-CSRF-Token header, and must match
      // This double-submit cookie pattern ensures the request originated from our app
      if (!isGet) {
        // Validate token length (should be 64 hex chars from crypto.randomBytes(32))
        const isValidTokenFormat = (t: string | undefined) => t && t.length >= 32;

        if (!isValidTokenFormat(token) || !isValidTokenFormat(cookieToken) || token !== cookieToken) {
          return reply.code(403).send({ error: 'Forbidden', message: 'Invalid CSRF token' });
        }
      }
    });
  }

  // Register security headers via Helmet
  // Security Rationale: Helmet provides essential HTTP security headers to protect against common web vulnerabilities
  if (routerConfig.security.helmet) {
    await server.register(helmet, {
      // Content Security Policy (CSP): Prevents XSS attacks by controlling which resources can be loaded
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],  // Only allow resources from same origin by default
          scriptSrc: (process.env.NODE_ENV === 'development'
            ? ["'self'", "'unsafe-inline'"]  // Allow inline scripts in dev for hot reload
            : ["'self'"]) as any,  // Production: strict script sources only
          styleSrc: ["'self'", "'unsafe-inline'"],  // Allow inline styles for React Native Web
          imgSrc: ["'self'", "data:", "https:", "blob:"],  // Allow images from various sources
          fontSrc: ["'self'", "data:"],  // Fonts from same origin or data URIs
          connectSrc: [
            "'self'",
            // Solana RPC endpoints for blockchain interactions
            "https://api.mainnet-beta.solana.com",
            "https://api.devnet.solana.com",
            "https://quote-api.jup.ag",
            "wss://api.mainnet-beta.solana.com",
            "wss://api.devnet.solana.com",
            ...(process.env.SOLANA_RPC_URL ? [process.env.SOLANA_RPC_URL] : []),
            ...(process.env.EXPO_PUBLIC_SOLANA_RPC_URL ? [process.env.EXPO_PUBLIC_SOLANA_RPC_URL] : []),
            // Common Solana RPC providers (Helius, Ankr, etc.)
            "https://api.helius-rpc.com",
            "https://rpc.helius.xyz",
            "https://rpc.ankr.com",
            "https://solana-api.projectserum.com",
            "https://ssc-dao.genesysgo.net"
          ],
          frameSrc: ["'none'"],  // Prevent embedding in iframes (clickjacking protection)
          objectSrc: ["'none'"],  // Block Flash and other plugins
          baseUri: ["'self'"],  // Prevent base tag hijacking
          formAction: ["'self'"],  // Forms can only submit to same origin
        },
      },
      // HSTS: Force HTTPS connections for 1 year, including subdomains
      // Security Rationale: Prevents SSL stripping attacks and ensures encrypted connections
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,  // Apply to all subdomains
        preload: true,  // Allow browser preload list inclusion
      },
      // X-Frame-Options: Prevent clickjacking by disallowing iframe embedding
      frameguard: { action: 'deny' },
      // X-Content-Type-Options: Prevent MIME type sniffing attacks
      noSniff: true,
      // Referrer-Policy: Control referrer information sent with requests
      // strict-origin-when-cross-origin: Send full URL for same-origin, only origin for cross-origin
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    } as any);
  }

  // Add additional security headers and origin validation
  // Security Rationale: Defense in depth - additional headers beyond Helmet for comprehensive protection
  //
  // Origin Validation Behavior (production only):
  // - Allowlisted paths (/health, /health/*, /api, /api/docs) skip origin validation entirely
  //   This is intentional for monitoring tools, load balancers, and documentation access
  // - All other paths require either:
  //   a) A valid Origin header matching ALLOWED_ORIGINS, OR
  //   b) The x-mobile-app-version header (for native mobile apps without Origin)
  // - This is stricter than CORS origin callback which cannot distinguish paths
  //
  // Mobile App Integration:
  // - Native mobile apps should include x-mobile-app-version header on all requests
  // - This header bypasses null-origin rejection for legitimate mobile clients
  // - Example: x-mobile-app-version: 1.0.0
  server.addHook('onRequest', async (request, reply) => {
    const url = request.url || '';
    // Allowlisted paths that don't require origin validation
    // - /health, /health/* - Health checks for monitoring/load balancers
    // - /api - API info endpoint
    // - /api/docs - API documentation
    // - /api/csrf - CSRF token endpoint (needed before origin can be validated)
    const allowlistPath = url.startsWith('/health') || url === '/api' || url === '/api/docs' || url === '/api/csrf';

    // Skip origin checks for public endpoints (health checks, docs, API info, CSRF)
    // These endpoints don't expose sensitive data and need to be accessible for monitoring
    if (allowlistPath) {
      return;
    }

    // Production origin validation
    // Security Rationale: Prevents requests from unauthorized origins (CSRF protection layer)
    if (process.env.NODE_ENV === 'production') {
      const origin = request.headers.origin;
      const hasMobileHeader = !!request.headers['x-mobile-app-version'];

      // Reject null origin in production (except for mobile apps with version header)
      // Security Rationale: Null origins can be spoofed and are often used in attacks
      // Mobile apps legitimately don't send Origin headers, so we use x-mobile-app-version
      if (!origin && !hasMobileHeader) {
        reply.code(403).send({ error: 'Forbidden', message: 'Null origin not allowed' });
        return;
      }

      // Validate Origin header matches ALLOWED_ORIGINS whitelist
      // Security Rationale: Only allow requests from known, trusted domains
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
      if (origin && !allowedOrigins.includes(origin)) {
        reply.code(403).send({ error: 'Forbidden', message: 'Origin not allowed' });
        return;
      }
    }

    // Force HTTPS redirect in production
    // Security Rationale: Ensures all traffic is encrypted, prevents man-in-the-middle attacks
    if (process.env.NODE_ENV === 'production' &&
      !request.headers['x-forwarded-proto']?.includes('https') &&
      request.hostname !== 'localhost') {
      reply.redirect(`https://${request.hostname}${request.url}`, 301);
      return;
    }

    // Additional security headers (defense in depth, supplements Helmet)
    // X-Frame-Options: Prevents clickjacking by disallowing iframe embedding
    reply.header('X-Frame-Options', 'DENY');
    // X-Content-Type-Options: Prevents MIME type sniffing attacks
    reply.header('X-Content-Type-Options', 'nosniff');
    // Referrer-Policy: Controls referrer information leakage
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions-Policy: Disables sensitive browser features not needed by the app
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

    // Remove server identification header
    // Security Rationale: Prevents attackers from identifying server technology for targeted attacks
    reply.removeHeader('X-Powered-By');
  });

  // Register custom auth plugin
  await server.register(fastifyAuthPlugin);

  // Register API logging plugin
  await server.register(apiLoggingPlugin);

  // Register custom rate limit plugin (handles all rate limiting)
  if (routerConfig.security.rateLimit) {
    await server.register(fastifyRateLimitPlugin);
  }

  server.addHook('onRequest', async (request, reply) => {
    try {
      if (
        request.url.startsWith('/api/trpc/auth') ||
        request.url.startsWith('/api/v1/trpc/auth')
      ) {
        await geoBlockMiddleware(request.ip)
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'FORBIDDEN') {
        return reply.code(403).send({ error: 'Forbidden', message: 'Service unavailable in your region' })
      }
      return
    }
  })

  // Register tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/api/v1/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: createTRPCContext,
      onError: (opts: any) => {
        const { path, error, type, ctx } = opts || {};
        // Log errors
        server.log.error({
          path,
          type,
          error: {
            name: error.name,
            message: error.message,
            code: error.code,
            cause: error.cause,
          },
          userId: ctx?.user?.id,
        }, 'tRPC Error');

        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production' && error?.code === 'INTERNAL_SERVER_ERROR') {
          error.message = 'Internal server error';
        }
      },
    },
  });

  // Legacy /api/trpc -> Redirect to versioned /api/v1/trpc with deprecation headers
  // Comment 2: API versioning - 301 redirect from unversioned to versioned endpoint
  server.all('/api/trpc/*', async (request, reply) => {
    const path = request.url.replace(/^\/api\/trpc/, '/api/v1/trpc');

    // Add deprecation headers
    reply.header('X-Deprecated', 'true');
    reply.header('X-Sunset-Date', '2026-07-01');
    reply.header('X-Replacement', path);
    reply.header('Deprecation', 'true');
    reply.header('Link', `<${path}>; rel="successor-version"`);

    // Log deprecation usage for monitoring
    logger.warn('Deprecated /api/trpc endpoint accessed', {
      originalUrl: request.url,
      redirectTo: path,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    return reply.redirect(path, 301);
  });

  // Health check endpoint (enhanced for comprehensive checks)
  server.get('/health', async (_request, _reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('full');
    if (cached) {
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.data, requestId };
      }
      void runHealthRefresh('full', async () => {
        const refreshRequestId = requestId
        let dbHealth, redisHealth, solanaHealth, rateLimiterStatus
        let circuitBreakers, dlq
        try {
          dbHealth = await checkDatabaseHealth()
        } catch (error) {
          logger.error('Database health check failed', { error, requestId: refreshRequestId })
          dbHealth = { healthy: false, latency: 0, error: 'Check failed' }
        }
        try {
          redisHealth = await checkRedisHealth()
        } catch (error) {
          logger.error('Redis health check failed', { error, requestId: refreshRequestId })
          redisHealth = { healthy: false, latency: 0, error: 'Check failed' }
        }
        try {
          solanaHealth = await checkSolanaHealth()
        } catch (error) {
          logger.error('Solana health check failed', { error, requestId: refreshRequestId })
          solanaHealth = { healthy: false, latency: 0, error: 'Check failed' }
        }
        try {
          const rateLimiter = getRateLimiter()
          rateLimiterStatus = await rateLimiter.getRedisStatus()
        } catch (error) {
          logger.error('Rate limiter health check failed', { error, requestId: refreshRequestId })
          rateLimiterStatus = { healthy: false, mode: 'unknown', error: 'Check failed' }
        }

        try {
          circuitBreakers = getAllCircuitBreakerSnapshots()
        } catch {
          circuitBreakers = []
        }

        try {
          dlq = await executionQueue.getDlqStats()
        } catch {
          dlq = { buy: 0, sell: 0 }
        }

        const overallStatus = dbHealth.healthy && redisHealth.healthy && solanaHealth.healthy && rateLimiterStatus.healthy ? 'healthy' : (dbHealth.healthy || redisHealth.healthy || solanaHealth.healthy || rateLimiterStatus.healthy ? 'degraded' : 'unhealthy');
        const data = {
          status: overallStatus,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          checks: {
            database: dbHealth,
            redis: redisHealth,
            solana: solanaHealth,
            rateLimiter: rateLimiterStatus,
            circuitBreakers,
            dlq,
          },
          requestId: refreshRequestId,
        }
        healthCache.set('full', { data, timestamp: Date.now() })
        return data
      })

      return { ...cached.data, requestId }
    }

    const data = await runHealthRefresh('full', async () => {
      let dbHealth, redisHealth, solanaHealth, rateLimiterStatus
      let circuitBreakers, dlq
      try {
        dbHealth = await checkDatabaseHealth()
      } catch (error) {
        logger.error('Database health check failed', { error, requestId })
        dbHealth = { healthy: false, latency: 0, error: 'Check failed' }
      }
      try {
        redisHealth = await checkRedisHealth()
      } catch (error) {
        logger.error('Redis health check failed', { error, requestId })
        redisHealth = { healthy: false, latency: 0, error: 'Check failed' }
      }
      try {
        solanaHealth = await checkSolanaHealth()
      } catch (error) {
        logger.error('Solana health check failed', { error, requestId })
        solanaHealth = { healthy: false, latency: 0, error: 'Check failed' }
      }
      try {
        const rateLimiter = getRateLimiter()
        rateLimiterStatus = await rateLimiter.getRedisStatus()
      } catch (error) {
        logger.error('Rate limiter health check failed', { error, requestId })
        rateLimiterStatus = { healthy: false, mode: 'unknown', error: 'Check failed' }
      }

      try {
        circuitBreakers = getAllCircuitBreakerSnapshots()
      } catch {
        circuitBreakers = []
      }

      try {
        dlq = await executionQueue.getDlqStats()
      } catch {
        dlq = { buy: 0, sell: 0 }
      }

      const overallStatus = dbHealth.healthy && redisHealth.healthy && solanaHealth.healthy && rateLimiterStatus.healthy ? 'healthy' : (dbHealth.healthy || redisHealth.healthy || solanaHealth.healthy || rateLimiterStatus.healthy ? 'degraded' : 'unhealthy');
      const data = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          database: dbHealth,
          redis: redisHealth,
          solana: solanaHealth,
          rateLimiter: rateLimiterStatus,
          circuitBreakers,
          dlq,
        },
        requestId,
      }
      healthCache.set('full', { data, timestamp: Date.now() })
      return data
    })
    return { ...data, requestId }
  });

  // ============================================
  // BATCH API ENDPOINTS (Performance Optimization)
  // ============================================

  // Batch fetch token prices
  server.post('/api/batch/prices', async (request: any, reply) => {
    try {
      const { tokenMints } = request.body as { tokenMints: string[] };

      if (!Array.isArray(tokenMints)) {
        return reply.code(400).send({ error: 'tokenMints must be an array' });
      }

      if (tokenMints.length > 50) {
        return reply.code(400).send({ error: 'Max 50 tokens per request' });
      }

      const { redisCache, getCacheTtls } = await import('../lib/redis');
      const { marketData } = await import('../lib/services/marketData');
      const ttls = getCacheTtls();

      const prices = await Promise.all(
        tokenMints.map(async (mint: string) => {
          try {
            // Check cache first
            const cacheKey = `price:${mint}` as any;
            const cached = await redisCache.get<{ price: number }>(cacheKey);
            if (cached?.price) {
              return { mint, price: cached.price, cached: true };
            }

            // Fetch from market data
            const tokenData = await marketData.getToken(mint);
            // Use tokenData.priceUsd directly (not pairs[0].priceUsd)
            let price: number | null = null;
            if (tokenData?.priceUsd) {
              const parsed = parseFloat(tokenData.priceUsd);
              if (Number.isFinite(parsed) && parsed > 0) {
                price = parsed;
              }
            }

            // Cache the result
            if (price) {
              await redisCache.set(cacheKey, { price }, ttls.price);
            }

            return { mint, price, cached: false };
          } catch (error) {
            return { mint, price: null, error: 'Fetch failed' };
          }
        })
      );

      return reply.send({
        success: true,
        count: prices.length,
        prices
      });
    } catch (error: any) {
      logger.error('[Batch Prices] Error', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch batch prices' });
    }
  });

  // Batch fetch user portfolios
  server.post('/api/batch/portfolio', async (request: any, reply) => {
    try {
      const { userIds } = request.body as { userIds: string[] };

      if (!Array.isArray(userIds)) {
        return reply.code(400).send({ error: 'userIds must be an array' });
      }

      if (userIds.length > 20) {
        return reply.code(400).send({ error: 'Max 20 users per request' });
      }

      const { redisCache, getCacheTtls } = await import('../lib/redis');
      const ttls = getCacheTtls();

      const portfolios = await Promise.all(
        userIds.map(async (userId: string) => {
          try {
            const cacheKey = `portfolio:${userId}` as any;
            const cached = await redisCache.get(cacheKey);

            if (cached) {
              return { userId, portfolio: cached, cached: true };
            }

            // Portfolio not cached - return null (client should fetch individually)
            return { userId, portfolio: null, cached: false };
          } catch (error) {
            return { userId, portfolio: null, error: 'Fetch failed' };
          }
        })
      );

      return reply.send({
        success: true,
        count: portfolios.length,
        portfolios
      });
    } catch (error: any) {
      logger.error('[Batch Portfolio] Error', { error: error.message });
      return reply.code(500).send({ error: 'Failed to fetch batch portfolios' });
    }
  });

  // Separate health check endpoints (with caching, error handling, and proper status codes)
  server.get('/health/db', async (_request, reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('db');
    if (cached) {
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.data, requestId };
      }
      void runHealthRefresh('db', async () => {
        try {
          const dbHealth = await checkDatabaseHealth()
          const data = { database: dbHealth, requestId }
          healthCache.set('db', { data, timestamp: Date.now() })
          return data
        } catch (error) {
          logger.error('Database health check failed', { error, requestId })
          const data = { database: { healthy: false, latency: 0, error: 'Check failed' }, requestId }
          healthCache.set('db', { data, timestamp: Date.now() })
          return data
        }
      })
      const cachedData = { ...cached.data, requestId }
      const status = cachedData.database?.healthy ? 200 : 503
      return reply.code(status).send(cachedData)
    }

    const data = await runHealthRefresh('db', async () => {
      try {
        const dbHealth = await checkDatabaseHealth()
        const data = { database: dbHealth, requestId }
        healthCache.set('db', { data, timestamp: Date.now() })
        return data
      } catch (error) {
        logger.error('Database health check failed', { error, requestId })
        const data = { database: { healthy: false, latency: 0, error: 'Check failed' }, requestId }
        healthCache.set('db', { data, timestamp: Date.now() })
        return data
      }
    })
    return reply.code(data.database?.healthy ? 200 : 503).send({ ...data, requestId })
  });

  server.get('/health/redis', async (_request, reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('redis');
    if (cached) {
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.data, requestId };
      }
      void runHealthRefresh('redis', async () => {
        try {
          if (!process.env.REDIS_URL) {
            const data = { redis: { healthy: true, required: false, message: 'Redis not configured' }, requestId }
            healthCache.set('redis', { data, timestamp: Date.now() })
            return data
          }
          const redisHealth = await checkRedisHealth()
          const data = { redis: redisHealth, requestId }
          healthCache.set('redis', { data, timestamp: Date.now() })
          return data
        } catch (error) {
          logger.error('Redis health check failed', { error, requestId })
          const data = { redis: { healthy: false, latency: 0, error: 'Check failed' }, requestId }
          healthCache.set('redis', { data, timestamp: Date.now() })
          return data
        }
      })
      const cachedData = { ...cached.data, requestId }
      const status = cachedData.redis?.healthy ? 200 : 503
      return reply.code(status).send(cachedData)
    }

    const data = await runHealthRefresh('redis', async () => {
      try {
        if (!process.env.REDIS_URL) {
          const data = { redis: { healthy: true, required: false, message: 'Redis not configured' }, requestId }
          healthCache.set('redis', { data, timestamp: Date.now() })
          return data
        }
        const redisHealth = await checkRedisHealth()
        const data = { redis: redisHealth, requestId }
        healthCache.set('redis', { data, timestamp: Date.now() })
        return data
      } catch (error) {
        logger.error('Redis health check failed', { error, requestId })
        const data = { redis: { healthy: false, latency: 0, error: 'Check failed' }, requestId }
        healthCache.set('redis', { data, timestamp: Date.now() })
        return data
      }
    })
    return reply.code(data.redis?.healthy ? 200 : 503).send({ ...data, requestId })
  });

  server.get('/health/solana', async (_request, reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('solana');
    if (cached) {
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.data, requestId };
      }
      void runHealthRefresh('solana', async () => {
        try {
          const solanaHealth = await checkSolanaHealth()
          const data = { solana: solanaHealth, requestId }
          healthCache.set('solana', { data, timestamp: Date.now() })
          return data
        } catch (error) {
          logger.error('Solana health check failed', { error, requestId })
          const data = { solana: { healthy: false, latency: 0, error: 'Check failed' }, requestId }
          healthCache.set('solana', { data, timestamp: Date.now() })
          return data
        }
      })
      const cachedData = { ...cached.data, requestId }
      const status = cachedData.solana?.healthy ? 200 : 503
      return reply.code(status).send(cachedData)
    }

    const data = await runHealthRefresh('solana', async () => {
      try {
        const solanaHealth = await checkSolanaHealth()
        const data = { solana: solanaHealth, requestId }
        healthCache.set('solana', { data, timestamp: Date.now() })
        return data
      } catch (error) {
        logger.error('Solana health check failed', { error, requestId })
        const data = { solana: { healthy: false, latency: 0, error: 'Check failed' }, requestId }
        healthCache.set('solana', { data, timestamp: Date.now() })
        return data
      }
    })
    return reply.code(data.solana?.healthy ? 200 : 503).send({ ...data, requestId })
  });

  server.get('/health/ready', async (_request, reply) => {
    const requestId = getRequestId();
    try {
      const dbHealth = await checkDatabaseHealth();
      const rateLimiter = getRateLimiter();
      const rateLimiterStatus = await rateLimiter.getRedisStatus();
      const ready = dbHealth.healthy && rateLimiterStatus.healthy; // Critical services only
      const data = {
        ready,
        services: { database: dbHealth, rateLimiter: rateLimiterStatus },
        requestId,
      };
      return reply.code(ready ? 200 : 503).send(data);
    } catch (error) {
      logger.error('Readiness health check failed', { error, requestId });
      return reply.code(503).send({ ready: false, error: 'Check failed', requestId });
    }
  });

  server.get('/health/live', async (_request, _reply) => {
    const requestId = getRequestId();
    // Liveness check - simple process check, no external services
    return {
      alive: true,
      uptime: process.uptime(),
      requestId,
    };
  });

  /**
   * Plan5 Step 5.3: Database Connection Pool Health Check
   * Returns pool utilization, configuration, and health status
   */
  server.get('/health/database/pool', async (_request, reply) => {
    const requestId = getRequestId();
    try {
      const { getPoolMetrics } = await import('../lib/prisma');
      const poolData = getPoolMetrics();
      const status = poolData.healthy ? 200 : 503;
      return reply.code(status).send({
        ...poolData,
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Pool health check failed', { error, requestId });
      return reply.code(503).send({
        healthy: false,
        error: 'Pool check failed',
        requestId,
      });
    }
  });

  /**
   * Plan5 Step 2.3: Adaptive Rate Limiting Monitoring Dashboard
   * Returns current adaptation state, violation rates, attack detection status
   * Requires admin authentication + IP whitelist
   */
  server.get('/api/admin/rate-limits/adaptive', async (request: any, reply) => {
    const requestId = getRequestId();
    try {
      // Check admin authentication (handled by global preHandler hook)
      const auth = request.auth;
      if (!auth?.isAuthenticated || auth.user?.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Admin access required', requestId });
      }

      const { adaptiveRateLimiter } = await import('../lib/middleware/adaptiveRateLimiter');
      const { queueManager } = await import('../lib/services/queueManager');
      const { trustedIpsService } = await import('../lib/services/trustedIps');
      const { alertManager } = await import('../lib/services/alertManager');

      return {
        adaptive: {
          metrics: adaptiveRateLimiter.getMetrics(),
          states: adaptiveRateLimiter.getAllStates(),
        },
        queue: {
          status: await queueManager.getQueueStatus(),
          config: queueManager.getConfig(),
        },
        trustedIps: trustedIpsService.getStatus(),
        alerts: alertManager.getStats(),
        requestId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Adaptive rate limit status check failed', { error, requestId });
      return reply.code(500).send({ error: 'Status check failed', requestId });
    }
  });

  // Admin cleanup endpoint
  server.post('/admin/cleanup', async (request, reply) => {
    try {
      const auth = (request as any).auth;
      if (!auth?.isAuthenticated) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Admin authentication required' });
      }
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      const adminKey = process.env.ADMIN_API_KEY;
      const providedKey = request.headers['x-admin-key'];
      const userEmail = auth.user?.email?.toLowerCase();
      const isAdmin = (adminKey && providedKey === adminKey) || (userEmail && adminEmails.includes(userEmail));
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Admin privileges required' });
      }

      // Get cleanup service
      const cleanupService = getCleanupService();
      if (!cleanupService) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'Cleanup service not initialized',
        });
      }

      // Parse request body for cleanup type
      const body = request.body as { type?: string; force?: boolean };
      const { type = 'all', force = false } = body;

      let result;
      switch (type) {
        case 'sessions':
          result = await cleanupService.cleanupExpiredSessions();
          break;
        case 'otps':
          result = await cleanupService.cleanupExpiredOTPs();
          break;
        case 'login-attempts':
          result = await cleanupService.cleanupOldLoginAttempts();
          break;
        case 'session-activities':
          result = await cleanupService.cleanupOldSessionActivities();
          break;
        case 'unlock-accounts':
          result = await cleanupService.unlockExpiredAccounts();
          break;
        case 'all':
        default:
          result = await cleanupService.runCleanup();
          break;
      }

      return {
        success: true,
        type,
        force,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      server.log.error({ error }, 'Admin cleanup failed');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Cleanup operation failed',
      });
    }
  });

  // Admin cleanup stats endpoint
  server.get('/admin/cleanup/stats', async (request, reply) => {
    try {
      const auth = (request as any).auth;
      if (!auth?.isAuthenticated) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Admin authentication required' });
      }
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      const adminKey = process.env.ADMIN_API_KEY;
      const providedKey = request.headers['x-admin-key'];
      const userEmail = auth.user?.email?.toLowerCase();
      const isAdmin = (adminKey && providedKey === adminKey) || (userEmail && adminEmails.includes(userEmail));
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Admin privileges required' });
      }

      // Get cleanup service
      const cleanupService = getCleanupService();
      if (!cleanupService) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'Cleanup service not initialized',
        });
      }

      const stats = await cleanupService.getCleanupStats();
      return {
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      server.log.error({ error }, 'Failed to get cleanup stats');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve cleanup statistics',
      });
    }
  });

  // API info endpoint
  server.get('/api', async (_request, _reply) => {
    return {
      name: 'SoulWallet API',
      version: '1.0.0',
      description: 'Backend API for SoulWallet application',
      endpoints: {
        health: '/health',
        trpc: '/api/v1/trpc',
        trpcLegacy: '/api/trpc',
        docs: '/api/docs',
      },
      timestamp: new Date().toISOString(),
    };
  });


  // CSRF token endpoint for native clients
  // Security Rationale: Native mobile apps cannot use cookies the same way as web browsers,
  // so this endpoint provides a way for mobile clients to obtain a CSRF token.
  // The token is returned in both the response body and as a cookie.
  //
  // Mobile Client Integration:
  // 1. Call GET /api/csrf to obtain a token (include x-mobile-app-version header)
  // 2. Store the token securely (e.g., in secure storage)
  // 3. Include the token in X-CSRF-Token header for all state-changing requests (POST, PUT, DELETE)
  // 4. Token is validated by matching cookie value with header value (double-submit pattern)
  //
  // Note: Mobile clients MUST include the x-mobile-app-version header when calling
  // protected endpoints without an Origin header to pass origin validation.
  if (process.env.CSRF_ENABLED === 'true') {
    server.get('/api/csrf', async (_request, reply) => {
      // Generate cryptographically secure token (64 hex chars)
      const token = generateCsrfToken();
      // Set cookie with SameSite=Strict to prevent cross-site request attacks
      // HttpOnly is NOT set so the token can be read by JavaScript for the header
      reply.header('Set-Cookie', `csrf_token=${encodeURIComponent(token)}; Path=/; SameSite=Strict`);
      return { token };
    });
  }

  // 404 handler
  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      statusCode: 404,
    });
  });

  // Error handler
  server.setErrorHandler((error: any, _request, reply) => {
    server.log.error(error);

    // Handle validation errors
    if (error.validation) {
      reply.code(400).send({
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.validation,
        statusCode: 400,
      });
      return;
    }

    // Handle rate limit errors
    if (error.statusCode === 429) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        statusCode: 429,
      });
      return;
    }

    // Generic error response
    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : error.message;

    reply.code(statusCode).send({
      error: error.name || 'Error',
      message,
      statusCode,
    });
  });

  // Register onClose hook to disconnect database
  server.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  return server;
}

/**
 * Start the server
 */
export async function startServer(port = 3001, host = '0.0.0.0'): Promise<FastifyInstance> {
  try {
    // Validate environment variables first
    const { validateEnvironment } = await import('../lib/validateEnv');
    validateEnvironment();

    // Initialize the application (handles database connection)
    await initializeApp();

    // Create server
    const server = await createServer();

    // Start listening
    await server.listen({ port, host });

    // Send PM2 ready signal if running under PM2
    if (process.send) {
      process.send('ready');
    }

    server.log.info(`ðŸš€ Server running at http://${host}:${port}`);
    server.log.info(`ðŸ“š API docs available at http://${host}:${port}/api/docs`);
    server.log.info(`ðŸ” Health check at http://${host}:${port}/health`);

    // Initialize performance snapshot cron job (daily at midnight UTC)
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PERFORMANCE_SNAPSHOTS === 'true') {
      try {
        const cron = await import('node-cron');
        const { PerformanceSnapshotService } = await import('../services/performanceSnapshot');

        // Schedule daily snapshots at midnight UTC
        cron.schedule('0 0 * * *', async () => {
          server.log.info('Running daily performance snapshot creation...');
          try {
            await PerformanceSnapshotService.createDailySnapshots();
            server.log.info('âœ… Daily performance snapshots created successfully');
          } catch (error) {
            server.log.error({ error }, 'âŒ Failed to create daily performance snapshots');
            // Audit Issue #18: Report cron job errors to Sentry
            if (sentryInitialized) {
              Sentry.captureException(error, {
                tags: { job: 'daily_performance_snapshot' },
                extra: { timestamp: new Date().toISOString() },
              });
            }
          }
        });

        server.log.info('âœ… Performance snapshot cron job initialized');
      } catch (error) {
        server.log.warn({ error }, 'âš ï¸  Failed to initialize performance snapshot cron job');
      }
    }

    // Handle PM2 graceful shutdown message
    if (process.send) {
      process.on('message', (msg) => {
        if (msg === 'shutdown') {
          server.log.info('Received PM2 shutdown message, shutting down gracefully...');
          server.close().then(() => {
            process.exit(0);
          }).catch((error) => {
            server.log.error({ error }, 'Error during PM2 shutdown');
            process.exit(1);
          });
        }
      });
    }

    return server;
  } catch (error: any) {
    logger.error('âŒ Failed to start server:', error?.message || error);
    console.error('STARTUP ERROR:', error);
    process.exit(1);
  }
}

/**
 * Development server with auto-restart
 */
export async function startDevServer(): Promise<void> {
  const port = parseInt(process.env.PORT || '3001');
  const host = process.env.HOST || '0.0.0.0';

  try {
    const server = await startServer(port, host);

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      server.log.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.close();
        process.exit(0);
      } catch (error) {
        server.log.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon

  } catch (error) {
    logger.error('Failed to start development server', error);
    process.exit(1);
  }
}

// Auto-start in development if this file is run directly
if (require.main === module && process.env.NODE_ENV !== 'test') {
  void startDevServer();
}
