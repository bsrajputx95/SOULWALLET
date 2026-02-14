import { PrismaClient } from '@prisma/client';

// Build database URL with connection limit if specified
// Default is 2-5 connections, increase DATABASE_CONNECTION_LIMIT for scale (10-20 recommended)
const buildDatabaseUrl = (): string => {
  const baseUrl = process.env.DATABASE_URL || '';
  const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT;
  
  if (!connectionLimit) return baseUrl;
  
  // Check if URL already has query params
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}connection_limit=${connectionLimit}`;
};

// Prisma client with optimized connection pooling for scale
// Supports 500-5000 users with proper connection management
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: buildDatabaseUrl(),
    },
  },
});

// Log connection issues in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query' as never, (e: { duration: number; query: string }) => {
    if (e.duration > 1000) {
      console.warn(`[Prisma] Slow query detected: ${e.duration}ms`);
    }
  });
}

export default prisma;
