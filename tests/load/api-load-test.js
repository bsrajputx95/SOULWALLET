/**
 * Plan9 Step 5: k6 API Load Test
 * Normal load testing scenario with gradual ramp-up
 * 
 * Run: npx k6 run tests/load/api-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency');
const apiLatency = new Trend('api_latency');
const authLatency = new Trend('auth_latency');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const IS_CI = __ENV.CI === 'true';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '1000', 10);

function trpcPost(procedure, input, token) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return http.post(`${BASE_URL}/api/trpc/${procedure}`, JSON.stringify({ json: input || {} }), { headers });
}

function createTestUser() {
    const email = `loadtest-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`;
    const password = 'LoadTestPassword123!';
    const start = Date.now();
    const res = trpcPost('auth.signup', { email, password, confirmPassword: password });
    authLatency.add(Date.now() - start);
    const data = res.json();
    const token = data?.result?.data?.token || data?.token;
    return { token };
}

// Test configuration
export const options = {
    stages: IS_CI
        ? [
            { duration: '30s', target: MAX_VUS },
            { duration: '60s', target: MAX_VUS },
            { duration: '30s', target: 0 },
        ]
        : [
            { duration: '2m', target: Math.min(200, MAX_VUS) },
            { duration: '5m', target: Math.min(500, MAX_VUS) },
            { duration: '10m', target: MAX_VUS },
            { duration: '10m', target: MAX_VUS },
            { duration: '2m', target: 0 },
        ],
    thresholds: {
        http_req_duration: ['p(95)<200'],  // 95% of requests under 200ms
        http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
        errors: ['rate<0.01'],             // Less than 1% custom error rate
    },
    // Output for easy integration
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function (data) {
    const token = data?.token;

    // Health check endpoint
    group('Health Check', () => {
        const healthRes = http.get(`${BASE_URL}/health`);
        healthLatency.add(healthRes.timings.duration);

        const healthCheck = check(healthRes, {
            'health status is 200': (r) => r.status === 200,
            'health response time < 100ms': (r) => r.timings.duration < 100,
            'health body contains healthy': (r) => r.body && r.body.includes('healthy'),
        });

        if (!healthCheck) {
            errorRate.add(1);
        }
    });

    sleep(0.5);

    // Market data endpoints (read-heavy)
    group('Market Data', () => {
        // Top coins
        const topCoinsRes = trpcPost('market.getTopCoins', {}, token);
        apiLatency.add(topCoinsRes.timings.duration);

        const topCoinsCheck = check(topCoinsRes, {
            'top coins status is 200': (r) => r.status === 200,
            'top coins response time < 200ms': (r) => r.timings.duration < 200,
        });

        if (!topCoinsCheck) {
            errorRate.add(1);
        }

        sleep(0.3);

        // Trending tokens
        const trendingRes = trpcPost('market.trending', {}, token);
        apiLatency.add(trendingRes.timings.duration);

        check(trendingRes, {
            'trending status is 200': (r) => r.status === 200,
            'trending response time < 200ms': (r) => r.timings.duration < 200,
        });
    });

    sleep(0.5);

    // Copy trading endpoints (if auth available)
    group('Copy Trading', () => {
        const tradersRes = trpcPost('copyTrading.getTopTraders', {}, token);
        apiLatency.add(tradersRes.timings.duration);

        check(tradersRes, {
            'traders status is 200': (r) => r.status === 200,
            'traders response time < 200ms': (r) => r.timings.duration < 200,
        });
    });

    sleep(1);
}

// Setup function - runs once at the start
export function setup() {
    // Verify server is reachable
    const healthRes = http.get(`${BASE_URL}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Server not healthy: ${healthRes.status}`);
    }

    const { token } = createTestUser();
    if (!token) {
        throw new Error('Failed to get auth token for load test');
    }

    trpcPost('market.getTopCoins', {}, token);
    trpcPost('market.trending', {}, token);
    trpcPost('copyTrading.getTopTraders', {}, token);

    return {
        startTime: new Date().toISOString(),
        token,
    };
}

// Teardown function - runs once at the end
export function teardown(data) {
    console.log(`Load test completed. Started at: ${data.startTime}`);
}

export function handleSummary(data) {
    return {
        'api-load-test-summary.json': JSON.stringify(data, null, 2),
    };
}
