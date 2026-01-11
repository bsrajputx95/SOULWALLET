/**
 * Database Performance Load Test (k6)
 *
 * Tests database performance under various load conditions:
 * - Scenario 1: Heavy read load (portfolio queries)
 * - Scenario 2: Heavy write load (transactions)
 * - Scenario 3: Mixed load with complex joins
 *
 * Run with: k6 run tests/load/database-performance.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const portfolioLatency = new Trend('portfolio_latency');
const transactionLatency = new Trend('transaction_latency');
const queryPerformanceLatency = new Trend('query_performance_latency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Test options
export const options = {
    scenarios: {
        // Scenario 1: Heavy read load (portfolio queries)
        heavy_reads: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 },  // Ramp up
                { duration: '2m', target: 50 },   // Stay at 50 VUs
                { duration: '30s', target: 0 },   // Ramp down
            ],
            gracefulRampDown: '10s',
            exec: 'heavyReads',
        },
        // Scenario 2: Heavy write load (transactions)
        heavy_writes: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 20 },
                { duration: '2m', target: 20 },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '10s',
            exec: 'heavyWrites',
            startTime: '3m30s', // Start after reads scenario
        },
        // Scenario 3: Mixed load
        mixed_load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 30 },
                { duration: '2m', target: 30 },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '10s',
            exec: 'mixedLoad',
            startTime: '7m', // Start after writes scenario
        },
    },
    thresholds: {
        // P95 latency should be under 1 second
        http_req_duration: ['p(95)<1000'],
        // Error rate should be under 1%
        errors: ['rate<0.01'],
        // Custom thresholds
        portfolio_latency: ['p(95)<500'],
        transaction_latency: ['p(95)<1000'],
        query_performance_latency: ['p(95)<500'],
    },
};

// Headers with auth
const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
};

/**
 * Scenario 1: Heavy Read Load
 * Simulates users checking their portfolio and viewing market data
 */
export function heavyReads() {
    group('Portfolio Reads', () => {
        // Get portfolio overview
        const portfolioRes = http.get(`${BASE_URL}/trpc/wallet.getPortfolio`, { headers });

        const portfolioSuccess = check(portfolioRes, {
            'portfolio status is 200': (r) => r.status === 200,
            'portfolio response time < 500ms': (r) => r.timings.duration < 500,
        });

        errorRate.add(!portfolioSuccess);
        portfolioLatency.add(portfolioRes.timings.duration);

        sleep(0.5);

        // Get transaction history
        const txHistoryRes = http.get(`${BASE_URL}/trpc/transaction.getHistory?input={}`, { headers });

        check(txHistoryRes, {
            'tx history status is 200': (r) => r.status === 200,
        });

        sleep(0.5);

        // Get market data (trending tokens)
        const marketRes = http.get(`${BASE_URL}/trpc/market.getTrending`, { headers });

        check(marketRes, {
            'market status is 200': (r) => r.status === 200,
        });
    });

    sleep(1);
}

/**
 * Scenario 2: Heavy Write Load
 * Simulates transaction processing and state updates
 */
export function heavyWrites() {
    group('Transaction Writes', () => {
        // Simulate transaction sync
        const syncPayload = JSON.stringify({
            signature: `test_${Date.now()}_${__VU}`,
        });

        const syncRes = http.post(
            `${BASE_URL}/trpc/transaction.sync`,
            syncPayload,
            { headers }
        );

        const syncSuccess = check(syncRes, {
            'sync status is 200 or 400': (r) => r.status === 200 || r.status === 400,
            'sync response time < 1000ms': (r) => r.timings.duration < 1000,
        });

        errorRate.add(syncRes.status >= 500);
        transactionLatency.add(syncRes.timings.duration);

        sleep(0.5);

        // Update session activity (simulated login activity)
        const activityRes = http.post(
            `${BASE_URL}/trpc/session.recordActivity`,
            JSON.stringify({ action: 'page_view' }),
            { headers }
        );

        check(activityRes, {
            'activity record status is OK': (r) => r.status < 500,
        });
    });

    sleep(1);
}

/**
 * Scenario 3: Mixed Load with Complex Queries
 * Simulates realistic user behavior with both reads and writes
 */
export function mixedLoad() {
    group('Mixed Operations', () => {
        // Read: Check health endpoint
        const healthRes = http.get(`${BASE_URL}/health`);

        check(healthRes, {
            'health check passes': (r) => r.status === 200,
        });

        sleep(0.2);

        // Read: Get user feed (requires joins)
        const feedRes = http.get(`${BASE_URL}/trpc/social.getFeed?input={}`, { headers });

        check(feedRes, {
            'feed status is 200': (r) => r.status === 200,
        });

        sleep(0.3);

        // Read: Get copy trading stats (aggregations)
        const copyTradingRes = http.get(`${BASE_URL}/trpc/copyTrading.getTop`, { headers });

        check(copyTradingRes, {
            'copy trading stats status is OK': (r) => r.status < 500,
        });

        sleep(0.3);

        // Read: Query performance endpoint (admin)
        const perfRes = http.get(`${BASE_URL}/api/admin/query-performance`, { headers });

        queryPerformanceLatency.add(perfRes.timings.duration);

        sleep(0.2);
    });

    sleep(0.5);
}

/**
 * Setup function - runs once before the test
 */
export function setup() {
    console.log('🚀 Starting database performance load test');
    console.log(`   Base URL: ${BASE_URL}`);
    console.log(`   Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Not provided'}`);

    // Verify server is up
    const healthRes = http.get(`${BASE_URL}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Server health check failed: ${healthRes.status}`);
    }

    return {
        startTime: new Date().toISOString(),
    };
}

/**
 * Teardown function - runs once after the test
 */
export function teardown(data) {
    console.log('✅ Database performance load test completed');
    console.log(`   Started: ${data.startTime}`);
    console.log(`   Ended: ${new Date().toISOString()}`);
}

/**
 * Default function (if no scenario specified)
 */
export default function () {
    heavyReads();
    sleep(1);
    heavyWrites();
    sleep(1);
    mixedLoad();
    sleep(1);
}
