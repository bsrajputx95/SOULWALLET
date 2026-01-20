/**
 * Script to clear Redis cache
 * Run with: railway run node scripts/clear-redis-cache.js
 */

const Redis = require('ioredis');

async function clearCache() {
    const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;

    if (!REDIS_URL) {
        console.error('REDIS_URL not found. Run with: railway run node scripts/clear-redis-cache.js');
        process.exit(1);
    }

    console.log('Connecting to Redis...');
    const redis = new Redis(REDIS_URL);

    try {
        console.log('Clearing market data caches...');

        // Delete specific keys
        const patterns = ['soulmarket*', 'trending*', 'birdeye*', 'token:*', 'search:*', 'pair:*'];

        for (const pattern of patterns) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`✓ Deleted ${keys.length} keys matching '${pattern}'`);
            } else {
                console.log(`- No keys matching '${pattern}'`);
            }
        }

        console.log('\n✅ Cache cleared successfully!');
    } catch (error) {
        console.error('Error clearing cache:', error);
    } finally {
        await redis.quit();
        process.exit(0);
    }
}

clearCache();
