/**
 * Plan10 Step 5: Production Load Test
 * Validates system handles high-scale production load
 * 
 * Run: k6 run tests/load/production-load-test.js
 * With custom URL: k6 run -e API_URL=https://api.soulwallet.com tests/load/production-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency');
const apiLatency = new Trend('api_latency');
const successfulRequests = new Counter('successful_requests');

// Production load test configuration
export const options = {
    stages: [
        { duration: '2m', target: 100 },    // Warm up to 100 users
        { duration: '5m', target: 500 },    // Ramp up to 500 users
        { duration: '10m', target: 5000 },  // Ramp up to 5000 users
        { duration: '10m', target: 10000 }, // Ramp up to 10000 users
        { duration: '10m', target: 10000 }, // Sustain 10000 users
        { duration: '5m', target: 5000 },   // Scale down
        { duration: '2m', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
        http_req_failed: ['rate<0.01'],     // Less than 1% failure rate
        errors: ['rate<0.01'],              // Custom error rate < 1%
    },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Test scenarios with realistic distribution
const scenarios = {
    health: { weight: 10, path: '/health' },
    topCoins: { weight: 35, procedure: 'market.getTopCoins', input: {} },
    trending: { weight: 35, procedure: 'market.trending', input: {} },
    topTraders: { weight: 20, procedure: 'copyTrading.getTopTraders', input: {} },
};

// Weighted random selection
function selectScenario() {
    const totalWeight = Object.values(scenarios).reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const [name, scenario] of Object.entries(scenarios)) {
        random -= scenario.weight;
        if (random <= 0) {
            return { name, ...scenario };
        }
    }

    return { name: 'health', ...scenarios.health };
}

function trpcPost(procedure, input, token) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'k6-load-test/1.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return http.post(`${BASE_URL}/api/trpc/${procedure}`, JSON.stringify({ json: input || {} }), { headers, timeout: '30s' });
}

export default function (data) {
    const scenario = selectScenario();
    const token = data?.token;

    group(scenario.name, () => {
        const startTime = Date.now();

        const res = scenario.name === 'health'
            ? http.get(`${BASE_URL}/health`, { timeout: '30s' })
            : trpcPost(scenario.procedure, scenario.input, token);

        const duration = Date.now() - startTime;

        // Track latency by type
        if (scenario.name === 'health') {
            healthLatency.add(duration);
        } else {
            apiLatency.add(duration);
        }

        // Validate response
        const passed = check(res, {
            'status is 2xx': (r) => r.status >= 200 && r.status < 300,
            'response time < 500ms': (r) => r.timings.duration < 500,
            'response has body': (r) => r.body && r.body.length > 0,
        });

        if (passed) {
            successfulRequests.add(1);
        } else {
            errorRate.add(1);
        }
    });

    // Realistic user think time (0.5-2 seconds)
    sleep(0.5 + Math.random() * 1.5);
}

// Setup function
export function setup() {
    console.log('='.repeat(50));
    console.log('🚀 SoulWallet Production Load Test');
    console.log('='.repeat(50));
    console.log(`Target: ${BASE_URL}`);
    console.log(`Max VUs: 10000`);
    console.log(`Duration: ~39 minutes`);
    console.log('='.repeat(50));

    // Verify server is healthy
    const healthRes = http.get(`${BASE_URL}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Server not healthy: ${healthRes.status}`);
    }

    const email = `prodload-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`;
    const password = 'LoadTestPassword123!';
    const signupRes = trpcPost('auth.signup', { email, password, confirmPassword: password });
    const signupData = signupRes.json();
    const token = signupData?.result?.data?.token || signupData?.token;
    if (!token) {
        throw new Error('Failed to get auth token for production load test');
    }

    trpcPost('market.getTopCoins', {}, token);
    trpcPost('market.trending', {}, token);
    trpcPost('copyTrading.getTopTraders', {}, token);

    console.log('✅ Server is healthy, starting load test...');
    return { startTime: new Date().toISOString(), token };
}

// Teardown function
export function teardown(data) {
    console.log('='.repeat(50));
    console.log('📊 Load Test Complete');
    console.log(`Started: ${data.startTime}`);
    console.log(`Ended: ${new Date().toISOString()}`);
    console.log('='.repeat(50));
}

// Custom summary output
export function handleSummary(data) {
    const summary = {
        timestamp: new Date().toISOString(),
        target: BASE_URL,
        metrics: {
            totalRequests: data.metrics.http_reqs ? data.metrics.http_reqs.count : 0,
            successRate: data.metrics.successful_requests ?
                (data.metrics.successful_requests.count / (data.metrics.http_reqs?.count || 1) * 100).toFixed(2) : 0,
            p95Latency: data.metrics.http_req_duration ? data.metrics.http_req_duration['p(95)'] : 0,
            p99Latency: data.metrics.http_req_duration ? data.metrics.http_req_duration['p(99)'] : 0,
            avgLatency: data.metrics.http_req_duration ? data.metrics.http_req_duration.avg : 0,
            errorRate: data.metrics.errors ? (data.metrics.errors.rate * 100).toFixed(2) : 0,
        },
        thresholds: {
            p95Under500ms: data.metrics.http_req_duration ? data.metrics.http_req_duration['p(95)'] < 500 : false,
            errorRateUnder1Percent: data.metrics.errors ? data.metrics.errors.rate < 0.01 : true,
        },
    };

    console.log('\n📈 Production Load Test Summary:');
    console.log(`   Total Requests: ${summary.metrics.totalRequests}`);
    console.log(`   Success Rate: ${summary.metrics.successRate}%`);
    console.log(`   P95 Latency: ${summary.metrics.p95Latency.toFixed(0)}ms`);
    console.log(`   P99 Latency: ${summary.metrics.p99Latency.toFixed(0)}ms`);
    console.log(`   Error Rate: ${summary.metrics.errorRate}%`);
    console.log(`\n   Thresholds:`);
    console.log(`   - P95 < 500ms: ${summary.thresholds.p95Under500ms ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   - Errors < 1%: ${summary.thresholds.errorRateUnder1Percent ? '✅ PASS' : '❌ FAIL'}`);

    return {
        'production-load-test-summary.json': JSON.stringify(summary, null, 2),
    };
}
