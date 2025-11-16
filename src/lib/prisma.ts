import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Global type declaration for development hot-reload safety
declare global {
  var __prisma: PrismaClient | undefined;
  var __prismaConnected: boolean | undefined;
}

// Prisma client configuration based on environment
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    errorFormat: 'pretty',
  });
};

// Singleton instance - use globalThis in development to prevent multiple instances during hot-reload
const prisma = globalThis.__prisma || createPrismaClient();

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
  
  // Handle hot-reload cleanup
  if ((module as any).hot) {
    (module as any).hot.dispose(() => {
      prisma.$disconnect().catch(console.error);
      globalThis.__prisma = undefined;
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

/**
 * Get the Prisma client instance
 */
export const getPrismaClient = (): PrismaClient => {
  return prisma;
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
      
      // Test the connection with a simple query
      await prisma.$queryRaw`SELECT 1`;
      
      // Mark as connected in development
      if (process.env.NODE_ENV === 'development') {
        globalThis.__prismaConnected = true;
      }
      
      logger.info('✅ Database connection established and verified successfully');
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
    // Run a simple query to test connectivity
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
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

// Export the singleton instance as default
export default prisma;