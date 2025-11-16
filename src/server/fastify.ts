import type { FastifyInstance} from 'fastify';
import Fastify from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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

/**
 * Create and configure Fastify server
 */
export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: routerConfig.logging.level as 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
    },
    bodyLimit: parseInt(routerConfig.limits.bodySize.replace('mb', '')) * 1024 * 1024,
    trustProxy: true,
  });

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
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  
  // Add development origins
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:8081', 'exp://localhost:8081');
  }

  await server.register(cors, {
    origin: (origin, callback) => {
      // Only allow null origin in development
      if (!origin) {
        if (process.env.NODE_ENV === 'production') {
          callback(new Error('Origin required in production'), false);
          return;
        }
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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-trpc-source', 'x-client-version', 'x-mobile-app-version'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
  });

  if (process.env.CSRF_ENABLED === 'true') {
    server.addHook('preHandler', async (request, reply) => {
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
      if (isGet && !cookieToken) {
        const newToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        reply.header('Set-Cookie', `csrf_token=${encodeURIComponent(newToken)}; Path=/; SameSite=Strict`);
        return;
      }
      if (!isGet) {
        if (!token || !cookieToken || token !== cookieToken) {
          return reply.code(403).send({ error: 'Forbidden', message: 'Invalid CSRF token' });
        }
      }
    });
  }

  // Register security headers
  if (routerConfig.security.helmet) {
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: (process.env.NODE_ENV === 'development' 
            ? ["'self'","'unsafe-inline'"] 
            : ["'self'"]) as any,
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: [
            "'self'",
            "https://api.mainnet-beta.solana.com",
            "https://api.devnet.solana.com",
            "https://quote-api.jup.ag",
            "wss://api.mainnet-beta.solana.com",
            "wss://api.devnet.solana.com",
            ...(process.env.SOLANA_RPC_URL ? [process.env.SOLANA_RPC_URL] : []),
            ...(process.env.EXPO_PUBLIC_SOLANA_RPC_URL ? [process.env.EXPO_PUBLIC_SOLANA_RPC_URL] : []),
            // Common Solana RPC providers
            "https://api.helius-rpc.com",
            "https://rpc.helius.xyz",
            "https://rpc.ankr.com",
            "https://solana-api.projectserum.com",
            "https://ssc-dao.genesysgo.net"
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    } as any);
  }

  // Add additional security headers
  server.addHook('onRequest', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      const origin = request.headers.origin;
      const hasMobileHeader = !!request.headers['x-mobile-app-version'];
      const url = request.url || '';
      const allowlistPath = url.startsWith('/health') || url.startsWith('/api/docs');
      if (!origin && !hasMobileHeader && !allowlistPath) {
        reply.code(403).send({ error: 'Forbidden', message: 'Null origin not allowed' });
        return;
      }
      // Validate Origin header matches ALLOWED_ORIGINS
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
      if (origin && !allowedOrigins.includes(origin)) {
        reply.code(403).send({ error: 'Forbidden', message: 'Origin not allowed' });
        return;
      }
    }

    // Force HTTPS in production
    if (process.env.NODE_ENV === 'production' &&
        !request.headers['x-forwarded-proto']?.includes('https') &&
        request.hostname !== 'localhost') {
      reply.redirect(`https://${request.hostname}${request.url}`, 301);
      return;
    }

    // Additional security headers
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

    // Remove server identification
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

  // CSRF token endpoint for native clients (web uses cookie directly)
  if (process.env.CSRF_ENABLED === 'true') {
    server.get('/api/csrf', async (_request, reply) => {
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
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
    console.error('Failed to start development server:', error);
    process.exit(1);
  }
}

// Auto-start in development if this file is run directly
if (require.main === module && process.env.NODE_ENV !== 'test') {
  startDevServer();
}
