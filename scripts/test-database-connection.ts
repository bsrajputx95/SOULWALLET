import { PrismaClient } from '@prisma/client';
import { logger } from '../src/lib/logger';

const testDatabaseConnection = async () => {
  const startTime = Date.now();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    logger.info('🔄 Testing database connection...');
    logger.info(`DATABASE_URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

    // Test 1: Basic connectivity
    await prisma.$connect();
    logger.info('✅ Database connection established');

    // Test 2: Query execution
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    logger.info('✅ Query execution successful', { result });

    // Test 3: Check migrations status (handle fresh database without migrations table)
    try {
      const migrations = await prisma.$queryRaw`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5`;
      logger.info('✅ Migration history retrieved', { count: (migrations as any[]).length });
    } catch (migrationError: any) {
      // Check if error is due to missing _prisma_migrations table (Postgres error code 42P01)
      if (migrationError.code === '42P01' || migrationError.message?.includes('_prisma_migrations') && migrationError.message?.includes('does not exist')) {
        logger.warn('⚠️ _prisma_migrations table not found; migrations may not have been applied yet');
      } else {
        // Re-throw unexpected errors
        throw migrationError;
      }
    }

    // Test 4: Latency check
    const latencyStart = Date.now();
    await prisma.user.count();
    const latency = Date.now() - latencyStart;
    logger.info('✅ Latency test', { latency: `${latency}ms` });

    // Test 5: Connection pool (simulate concurrent queries)
    const poolTest = await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.transaction.count(),
    ]);
    logger.info('✅ Connection pool test', { results: poolTest });

    const totalTime = Date.now() - startTime;
    logger.info('🎉 All database tests passed', { totalTime: `${totalTime}ms` });

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Database connection test failed', {
      error: error.message,
      code: error.code,
      meta: error.meta,
    });
    await prisma.$disconnect();
    process.exit(1);
  }
};

testDatabaseConnection();
