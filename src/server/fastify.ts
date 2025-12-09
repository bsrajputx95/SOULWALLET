import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { appRouter, initializeApp, routerConfig, getCleanupService } from './index';
import { createTRPCContext } from './trpc';
import { fastifyAuthPlugin } from '../lib/middleware/auth';
import { fastifyRateLimitPlugin, getRateLimiter } from '../lib/middleware/rateLimit';
import { disconnectDatabase, checkDatabaseHealth } from '../lib/prisma';
import { logger } from '../lib/logger';
import { fastifyRequestIdPlugin } from '../lib/middleware/requestId';
import { apiLoggingPlugin } from '../lib/middleware/apiLogging';
import { getRequestId } from '../lib/middleware/requestId';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';

// Initialize Sentry for backend error tracking
let sentryInitialized = false;
function initializeBackendSentry() {
  const dsn = process.env.SENTRY_BACKEND_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn || dsn === 'your-sentry-dsn-here' || dsn === 'disabled') {
    logger.info('ℹ️  Backend Sentry not initialized (DSN not configured)');
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
    logger.info('✅ Backend Sentry initialized successfully');
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
  // Initialize Sentry before creating server
  initializeBackendSentry();

  const server = Fastify({
    logger: {
      level: routerConfig.logging.level as 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
    },
    bodyLimit: parseInt(routerConfig.limits.bodySize.replace('mb', '')) * 1024 * 1024,
    trustProxy: true,
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

  // Health check cache
  const healthCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL = 5000; // 5 seconds

  // Helper functions for health checks
  async function checkRedisHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    if (!process.env.REDIS_URL) return { healthy: false, error: 'Redis not configured' };
    try {
      const client = new Redis(process.env.REDIS_URL);
      const start = Date.now();
      await client.ping();
      const latency = Date.now() - start;
      client.disconnect();
      return { healthy: true, latency };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  async function checkSolanaHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      const start = Date.now();
      await connection.getSlot();
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

  // Register tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
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

  // Health check endpoint (enhanced for comprehensive checks)
  server.get('/health', async (_request, _reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('full');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, requestId };
    }

    let dbHealth, redisHealth, solanaHealth, rateLimiterStatus;
    try {
      dbHealth = await checkDatabaseHealth();
    } catch (error) {
      logger.error('Database health check failed', { error, requestId });
      dbHealth = { healthy: false, latency: 0, error: 'Check failed' };
    }
    try {
      redisHealth = await checkRedisHealth();
    } catch (error) {
      logger.error('Redis health check failed', { error, requestId });
      redisHealth = { healthy: false, latency: 0, error: 'Check failed' };
    }
    try {
      solanaHealth = await checkSolanaHealth();
    } catch (error) {
      logger.error('Solana health check failed', { error, requestId });
      solanaHealth = { healthy: false, latency: 0, error: 'Check failed' };
    }
    try {
      const rateLimiter = getRateLimiter();
      rateLimiterStatus = await rateLimiter.getRedisStatus();
    } catch (error) {
      logger.error('Rate limiter health check failed', { error, requestId });
      rateLimiterStatus = { healthy: false, mode: 'unknown', error: 'Check failed' };
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
      },
      requestId,
    };
    healthCache.set('full', { data, timestamp: Date.now() });
    return data;
  });

  // Separate health check endpoints (with caching, error handling, and proper status codes)
  server.get('/health/db', async (_request, reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('db');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, requestId };
    }
    try {
      const dbHealth = await checkDatabaseHealth();
      const data = { database: dbHealth, requestId };
      healthCache.set('db', { data, timestamp: Date.now() });
      return reply.code(dbHealth.healthy ? 200 : 503).send(data);
    } catch (error) {
      logger.error('Database health check failed', { error, requestId });
      const data = { database: { healthy: false, latency: 0, error: 'Check failed' }, requestId };
      healthCache.set('db', { data, timestamp: Date.now() });
      return reply.code(503).send(data);
    }
  });

  server.get('/health/redis', async (_request, reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('redis');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, requestId };
    }
    try {
      // Check if Redis is configured
      if (!process.env.REDIS_URL) {
        const data = { redis: { healthy: true, required: false, message: 'Redis not configured' }, requestId };
        healthCache.set('redis', { data, timestamp: Date.now() });
        return reply.code(200).send(data);
      }

      const redisHealth = await checkRedisHealth();
      const data = { redis: redisHealth, requestId };
      healthCache.set('redis', { data, timestamp: Date.now() });
      return reply.code(redisHealth.healthy ? 200 : 503).send(data);
    } catch (error) {
      logger.error('Redis health check failed', { error, requestId });
      const data = { redis: { healthy: false, latency: 0, error: 'Check failed' }, requestId };
      healthCache.set('redis', { data, timestamp: Date.now() });
      return reply.code(503).send(data);
    }
  });

  server.get('/health/solana', async (_request, reply) => {
    const requestId = getRequestId();
    const cached = healthCache.get('solana');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, requestId };
    }
    try {
      const solanaHealth = await checkSolanaHealth();
      const data = { solana: solanaHealth, requestId };
      healthCache.set('solana', { data, timestamp: Date.now() });
      return reply.code(solanaHealth.healthy ? 200 : 503).send(data);
    } catch (error) {
      logger.error('Solana health check failed', { error, requestId });
      const data = { solana: { healthy: false, latency: 0, error: 'Check failed' }, requestId };
      healthCache.set('solana', { data, timestamp: Date.now() });
      return reply.code(503).send(data);
    }
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
        trpc: '/api/trpc',
        docs: '/api/docs',
      },
      timestamp: new Date().toISOString(),
    };
  });

  // API documentation endpoint (basic)
  server.get('/api/docs', async (_request, reply) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SoulWallet API Documentation</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .method { font-weight: bold; color: #007acc; }
        .path { font-family: monospace; background: #f5f5f5; padding: 2px 5px; }
        .description { margin-top: 10px; color: #666; }
      </style>
    </head>
    <body>
      <h1>SoulWallet API Documentation</h1>
      <p>Welcome to the SoulWallet API. This API provides authentication and user management services.</p>
      
      <h2>Authentication Endpoints</h2>
      
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/trpc/auth.signup</span></div>
        <div class="description">Register a new user account</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/trpc/auth.login</span></div>
        <div class="description">Login with email and password</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/trpc/auth.logout</span></div>
        <div class="description">Logout and invalidate session</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/trpc/auth.requestPasswordReset</span></div>
        <div class="description">Request password reset via email OTP</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/trpc/auth.resetPassword</span></div>
        <div class="description">Reset password using OTP</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/trpc/auth.verifyOTP</span></div>
        <div class="description">Verify OTP code</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/trpc/auth.getCurrentUser</span></div>
        <div class="description">Get current authenticated user</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/trpc/auth.refreshToken</span></div>
        <div class="description">Refresh JWT access token</div>
      </div>
      
      <h2>Utility Endpoints</h2>
      
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/health</span></div>
        <div class="description">Server health check</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api</span></div>
        <div class="description">API information</div>
      </div>
      
      <p><strong>Note:</strong> All tRPC endpoints use POST method for mutations and GET for queries. 
      The actual HTTP method may vary based on the tRPC adapter configuration.</p>
    </body>
    </html>
    `;

    reply.type('text/html').send(html);
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
  server.setErrorHandler((error, _request, reply) => {
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

    server.log.info(`🚀 Server running at http://${host}:${port}`);
    server.log.info(`📚 API docs available at http://${host}:${port}/api/docs`);
    server.log.info(`🔍 Health check at http://${host}:${port}/health`);

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
            server.log.info('✅ Daily performance snapshots created successfully');
          } catch (error) {
            server.log.error({ error }, '❌ Failed to create daily performance snapshots');
          }
        });

        server.log.info('✅ Performance snapshot cron job initialized');
      } catch (error) {
        server.log.warn({ error }, '⚠️  Failed to initialize performance snapshot cron job');
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
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
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
  startDevServer();
}
