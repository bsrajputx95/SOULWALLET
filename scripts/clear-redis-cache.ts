/**
 * Script to clear Redis cache
 * Run with: npx ts-node scripts/clear-redis-cache.ts
 */

import Redis from 'ioredis';

async function clearCache() {
    const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;

    if (!REDIS_URL) {
        console.error('REDIS_URL not found. Run with: railway run npx ts-node scripts/clear-redis-cache.ts');
        process.exit(1);
    }

    const redis = new Redis(REDIS_URL);

    try {
        console.log('Clearing market data caches...');

        // Delete specific keys
        const patterns = ['soulmarket*', 'trending*', 'birdeye*', 'token:*', 'search:*'];

        for (const pattern of patterns) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`Deleted ${keys.length} keys matching '${pattern}'`);
            } else {
                console.log(`No keys matching '${pattern}'`);
            }
        }

        console.log('✅ Cache cleared successfully!');
    } catch (error) {
        console.error('Error clearing cache:', error);
    } finally {
        await redis.quit();
        process.exit(0);
    }
}

clearCache();
