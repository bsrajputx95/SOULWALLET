import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { createExtendedPrismaClient, type ExtendedPrismaClient } from './prismaExtended';
import { encryptionExtension } from './prisma/encryption';

// Global type declaration for development hot-reload safety
declare global {
  interface GlobalThis {
    __prisma?: PrismaClient;
    __extendedPrisma?: ExtendedPrismaClient;
    __prismaConnected?: boolean;
  }
}

/**
 * Comment 5: Connection Pool Configuration
 * - DB_CONNECTION_LIMIT: Max connections in pool (default: 10)
 * - DB_POOL_TIMEOUT: Wait timeout for connection from pool in seconds (default: 30)
 * - DB_CONNECT_TIMEOUT: Connection establishment timeout in seconds (default: 10)
 */
const POOL_CONFIG = {
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20'),
  poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '30'),
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10'),
  statementCacheSize: parseInt(process.env.DB_STATEMENT_CACHE_SIZE || '100'),
};

const POOL_ALERT_THRESHOLD = parseFloat(process.env.POOL_ALERT_THRESHOLD || '0.9'); // 90%
const POOL_MONITORING_ENABLED = process.env.ENABLE_POOL_MONITORING !== 'false';

/**
 * Connection pool metrics tracking
 */
interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingRequests: number;
  utilizationPercent: number;
  lastAlertTime: number | null;
}

const poolMetrics: PoolMetrics = {
  activeConnections: 0,
  idleConnections: 0,
  totalConnections: 0,
  waitingRequests: 0,
  utilizationPercent: 0,
  lastAlertTime: null,
};

/**
 * Build database URL with pool configuration
 * Appends connection pool parameters to DATABASE_URL
 */
function buildDatabaseUrlWithPooling(): string | undefined {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return undefined;

  try {
    const url = new URL(baseUrl);

    // Add pool configuration as query parameters
    url.searchParams.set('connection_limit', POOL_CONFIG.connectionLimit.toString());
    url.searchParams.set('pool_timeout', POOL_CONFIG.poolTimeout.toString());
    url.searchParams.set('connect_timeout', POOL_CONFIG.connectTimeout.toString());
    url.searchParams.set('statement_cache_size', POOL_CONFIG.statementCacheSize.toString());

    return url.toString();
  } catch (error) {
    logger.warn('[Prisma] Failed to parse DATABASE_URL for pool config, using original', { error });
    return baseUrl;
  }
}

// Prisma client configuration based on environment
const createPrismaClient = () => {
  // Apply pool configuration via URL params
  const pooledUrl = buildDatabaseUrlWithPooling();
  if (pooledUrl) {
    process.env.DATABASE_URL = pooledUrl;
  }

  logger.info('[Prisma] Creating client with pool configuration', {
    connectionLimit: POOL_CONFIG.connectionLimit,
    poolTimeout: POOL_CONFIG.poolTimeout,
    connectTimeout: POOL_CONFIG.connectTimeout,
    monitoringEnabled: POOL_MONITORING_ENABLED,
  });

  let client: PrismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    errorFormat: 'pretty',
  });

  // Comment 4 Fix: Add $use middleware for DB performance instrumentation
  // Records per-operation durations into Prometheus histogram
  if (typeof (client as any).$use === 'function') {
    (client as any).$use(async (params: any, next: any) => {
      const startTime = Date.now();
      const result = await next(params);
      const duration = Date.now() - startTime;

      // Emit query duration metric (will be picked up by Prometheus)
      try {
        // Import dynamically to avoid circular dependencies
        const { Histogram, Counter, register } = await import('prom-client');

        // Get or create histogram
        const existingHistogram = register.getSingleMetric('soulwallet_db_query_duration_ms');
        let queryHistogram = existingHistogram as any;

        if (!queryHistogram) {
          queryHistogram = new Histogram({
            name: 'soulwallet_db_query_duration_ms',
            help: 'Database query duration in milliseconds',
            labelNames: ['model', 'action'],
            buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
          });
        }

        queryHistogram.observe(
          { model: params.model || 'unknown', action: params.action },
          duration
        );

        // Track slow queries (> 500ms)
        if (duration > 500) {
          const existingCounter = register.getSingleMetric('soulwallet_db_slow_queries_total');
          let slowQueryCounter = existingCounter as any;

          if (!slowQueryCounter) {
            slowQueryCounter = new Counter({
              name: 'soulwallet_db_slow_queries_total',
              help: 'Total count of slow database queries (>500ms)',
              labelNames: ['model', 'action'],
            });
          }

          slowQueryCounter.inc({ model: params.model || 'unknown', action: params.action });

          logger.warn('[Prisma] Slow query detected', {
            model: params.model,
            action: params.action,
            durationMs: duration,
          });
        }
      } catch (err) {
        // Metrics emission failure should not break queries
        logger.debug('[Prisma] Failed to emit query metrics', { error: err });
      }

      return result;
    });
  } else {
    logger.warn('[Prisma] Prisma $use middleware unavailable; query metrics disabled');
  }

  if (process.env.PGCRYPTO_KEY) {
    client = client.$extends(encryptionExtension) as unknown as PrismaClient;
    logger.info('[Prisma] Encryption extension registered');
  } else {
    logger.warn('[Prisma] PGCRYPTO_KEY not set, encryption extension disabled');
  }

  return client;
};

/**
 * Comment 5: Manually increment active connection count (call before query)
 * Note: Prisma $use middleware is deprecated, so manual tracking is recommended
 */
export const incrementPoolUsage = (): void => {
  if (!POOL_MONITORING_ENABLED) return;

  poolMetrics.activeConnections++;
  poolMetrics.totalConnections = Math.max(poolMetrics.totalConnections, poolMetrics.activeConnections);
  poolMetrics.utilizationPercent = (poolMetrics.activeConnections / POOL_CONFIG.connectionLimit) * 100;

  // Check for high utilization alert
  if (poolMetrics.utilizationPercent >= POOL_ALERT_THRESHOLD * 100) {
    const now = Date.now();
    // Throttle alerts to max once per 5 minutes
    if (!poolMetrics.lastAlertTime || now - poolMetrics.lastAlertTime > 5 * 60 * 1000) {
      poolMetrics.lastAlertTime = now;
      logger.warn('[Prisma] Connection pool utilization high', {
        activeConnections: poolMetrics.activeConnections,
        connectionLimit: POOL_CONFIG.connectionLimit,
        utilizationPercent: poolMetrics.utilizationPercent.toFixed(1),
      });
    }
  }
};

/**
 * Comment 5: Manually decrement active connection count (call after query)
 */
export const decrementPoolUsage = (): void => {
  if (!POOL_MONITORING_ENABLED) return;

  poolMetrics.activeConnections = Math.max(0, poolMetrics.activeConnections - 1);
  poolMetrics.idleConnections = Math.max(0, poolMetrics.totalConnections - poolMetrics.activeConnections);
  poolMetrics.utilizationPercent = (poolMetrics.activeConnections / POOL_CONFIG.connectionLimit) * 100;
};

// Singleton instance - use globalThis in development to prevent multiple instances during hot-reload
const basePrisma = globalThis.__prisma || createPrismaClient();

// Comment 1: Wrap with extended client for cache invalidation
const extendedPrisma = globalThis.__extendedPrisma || createExtendedPrismaClient(basePrisma);

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = basePrisma;
  globalThis.__extendedPrisma = extendedPrisma;

  // Handle hot-reload cleanup
  if ((module as any).hot) {
    (module as any).hot.dispose(() => {
      basePrisma.$disconnect().catch(console.error);
      globalThis.__prisma = undefined;
      globalThis.__extendedPrisma = undefined;
      globalThis.__prismaConnected = undefined;
    });
  }

  // Handle process cleanup in development
  process.on('beforeExit', () => {
    if (globalThis.__prisma) {
      globalThis.__prisma.$disconnect().catch(console.error);
    }
  });
}

// For backward compatibility, expose both base and extended clients
const prisma = basePrisma;

/**
 * Get the Prisma client instance
 */
export const getPrismaClient = (): PrismaClient => {
  return prisma;
};

/**
 * Plan9 Step 4.3: Read Replica Client for scaling database reads
 * Uses DATABASE_READ_REPLICA_URL if configured, otherwise falls back to primary
 */
let readReplicaClient: PrismaClient | null = null;

export const getPrismaReadClient = (): PrismaClient => {
  const readReplicaUrl = process.env.DATABASE_READ_REPLICA_URL;

  // If no read replica configured, use primary
  if (!readReplicaUrl) {
    return prisma;
  }

  // Create read replica client on first use
  if (!readReplicaClient) {
    logger.info('[Prisma] Creating read replica client');
    readReplicaClient = new PrismaClient({
      datasources: {
        db: { url: readReplicaUrl }
      },
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      errorFormat: 'pretty',
    });
  }

  return readReplicaClient;
};

/**
 * Disconnect read replica client on shutdown
 */
export const disconnectReadReplica = async (): Promise<void> => {
  if (readReplicaClient) {
    await readReplicaClient.$disconnect();
    readReplicaClient = null;
    logger.info('[Prisma] Read replica client disconnected');
  }
};

/**
 * Connect to the database with retry logic and exponential backoff
 */
export const connectDatabase = async (): Promise<void> => {
  // Check if already connected in development to avoid redundant connections
  if (process.env.NODE_ENV === 'development' && globalThis.__prismaConnected) {
    logger.info('🔄 Database already connected (hot-reload detected)');
    return;
  }

  const maxRetries = 5;
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds max delay

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`🔄 Attempting database connection (attempt ${attempt}/${maxRetries})...`);

      await prisma.$connect();

      // Plan2 Step 2: Use $executeRaw for health check - safe constant query, no SQL injection risk
      await prisma.$executeRaw`SELECT 1`;

      // Mark as connected in development
      if (process.env.NODE_ENV === 'development') {
        globalThis.__prismaConnected = true;
      }

      logger.info('✅ Database connection established and verified successfully', {
        poolConfig: POOL_CONFIG,
      });
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay); // Exponential backoff with max cap

      logger.error(`❌ Database connection attempt ${attempt} failed:`, error);

      if (isLastAttempt) {
        logger.error('💥 All database connection attempts failed');
        throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      logger.info(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Disconnect from the database
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    logger.info('🔄 Disconnecting from database...');
    await prisma.$disconnect();

    // Reset connection state in development
    if (process.env.NODE_ENV === 'development') {
      globalThis.__prismaConnected = false;
    }

    logger.info('✅ Database disconnected successfully');
  } catch (error) {
    logger.error('❌ Error disconnecting from database:', error);
    throw error;
  }
};

/**
 * Check database health and connectivity
 */
export const checkDatabaseHealth = async (): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> => {
  const startTime = Date.now();

  try {
    // Plan2 Step 2: Use $executeRaw for health check - safe constant query, no SQL injection risk
    await prisma.$executeRaw`SELECT 1`;

    const latency = Date.now() - startTime;

    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    logger.error('❌ Database health check failed:', error);

    return {
      healthy: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
};

/**
 * Comment 5: Get connection pool metrics for monitoring
 */
export const getPoolMetrics = (): {
  config: typeof POOL_CONFIG;
  metrics: Omit<PoolMetrics, 'lastAlertTime'>;
  healthy: boolean;
  alertThreshold: number;
} => {
  return {
    config: POOL_CONFIG,
    metrics: {
      activeConnections: poolMetrics.activeConnections,
      idleConnections: poolMetrics.idleConnections,
      totalConnections: poolMetrics.totalConnections,
      waitingRequests: poolMetrics.waitingRequests,
      utilizationPercent: poolMetrics.utilizationPercent,
    },
    healthy: poolMetrics.utilizationPercent < POOL_ALERT_THRESHOLD * 100,
    alertThreshold: POOL_ALERT_THRESHOLD * 100,
  };
};

/**
 * Comment 5: Get connection pool configuration
 */
export const getPoolConfig = (): typeof POOL_CONFIG => {
  return { ...POOL_CONFIG };
};

// Export the singleton instance as default (with cache invalidation)
export default extendedPrisma;

// Export base prisma for cases where extension is not needed
export { prisma as basePrisma };
