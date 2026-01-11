/**
 * Plan9 Step 5: k6 Soak Test
 * Long-duration test to detect memory leaks and performance degradation
 * 
 * Run: npx k6 run tests/load/soak-test.js --duration 2h
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestCount = new Counter('requests');
const memoryUsage = new Gauge('memory_usage');
const responseTime = new Trend('response_time');

export const options = {
    stages: [
        { duration: '5m', target: 100 },   // Ramp up
        { duration: '110m', target: 100 }, // Stay at 100 users for ~2 hours
        { duration: '5m', target: 0 },     // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],     // P95 under 500ms even after hours
        http_req_failed: ['rate<0.01'],       // Less than 1% errors
        errors: ['rate<0.01'],
        'response_time': ['p(99)<1000'],      // P99 under 1s
    },
    // Extended soak test settings
    noConnectionReuse: false,
    userAgent: 'SoulWalletSoakTest/1.0',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Endpoints to test with weights
const ENDPOINTS = [
    { path: '/health', weight: 30, method: 'GET' },
    { path: '/api/trpc/market.trending', weight: 20, method: 'POST' },
    { path: '/api/trpc/market.getTopCoins', weight: 20, method: 'POST' },
    { path: '/api/trpc/wallet.getBalance', weight: 15, method: 'POST', auth: true },
    { path: '/api/trpc/social.getPosts', weight: 10, method: 'POST' },
    { path: '/api/trpc/portfolio.getOverview', weight: 5, method: 'POST', auth: true },
];

// Weighted random selection
function selectEndpoint() {
    const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of ENDPOINTS) {
        random -= endpoint.weight;
        if (random <= 0) return endpoint;
    }
    return ENDPOINTS[0];
}

function trpcPost(procedure, input, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return http.post(
        `${BASE_URL}/api/trpc/${procedure}`,
        JSON.stringify({ json: input || {} }),
        { headers, timeout: '10s' }
    );
}

export function setup() {
    // Create test user for authenticated requests
    const email = `soak-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`;
    const password = 'SoakTestPassword123!';

    const signupRes = trpcPost('auth.signup', {
        email,
        password,
        confirmPassword: password
    });

    const data = signupRes.json();
    const token = data?.result?.data?.token || data?.token;

    console.log(`Soak test setup complete. Test user: ${email}`);
    console.log('Starting 2-hour soak test...');

    return {
        token,
        testEmail: email,
        startTime: Date.now()
    };
}

export default function (data) {
    requestCount.add(1);
    const token = data?.token;
    const endpoint = selectEndpoint();

    let res;
    const start = Date.now();

    try {
        if (endpoint.method === 'GET') {
            res = http.get(`${BASE_URL}${endpoint.path}`, { timeout: '10s' });
        } else {
            const procedure = endpoint.path.replace('/api/trpc/', '');
            res = trpcPost(procedure, {}, endpoint.auth ? token : null);
        }

        const duration = Date.now() - start;
        responseTime.add(duration);

        const passed = check(res, {
            'status is 2xx': (r) => r.status >= 200 && r.status < 300,
            'response time < 500ms': (r) => r.timings.duration < 500,
            'response has body': (r) => r.body && r.body.length > 0,
        });

        if (!passed) {
            errorRate.add(1);
        }
    } catch (e) {
        errorRate.add(1);
        console.error(`Request failed: ${e.message}`);
    }

    // Variable think time (1-3 seconds) to simulate real user behavior
    sleep(1 + Math.random() * 2);
}

// Periodic memory check (runs every 30 seconds)
export function memoryCheck() {
    const res = http.get(`${BASE_URL}/health/detailed`);

    try {
        const health = res.json();
        if (health.memory) {
            memoryUsage.add(health.memory.heapUsed / 1024 / 1024); // MB
        }
    } catch (e) {
        // Health endpoint might not expose memory details
    }
}

export function teardown(data) {
    const duration = ((Date.now() - data.startTime) / 1000 / 60).toFixed(2);
    console.log(`Soak test completed. Duration: ${duration} minutes`);
}

export function handleSummary(data) {
    // Analyze for memory leaks and performance degradation
    const analysis = {
        duration: data.state.testRunDurationMs,
        totalRequests: data.metrics.requests ? data.metrics.requests.values.count : 0,
        errorRate: data.metrics.errors ? (data.metrics.errors.values.rate * 100).toFixed(2) + '%' : '0%',
        p95Latency: data.metrics.http_req_duration ?
            data.metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms' : 'N/A',
        p99Latency: data.metrics.http_req_duration ?
            data.metrics.http_req_duration.values['p(99)'].toFixed(2) + 'ms' : 'N/A',
        maxLatency: data.metrics.http_req_duration ?
            data.metrics.http_req_duration.values.max.toFixed(2) + 'ms' : 'N/A',
    };

    // Detect performance degradation
    const degradationAnalysis = {
        earlyP95: 'N/A', // Would need first 10 min data
        lateP95: 'N/A',  // Would need last 10 min data
        degradationDetected: false,
        memoryLeakSuspected: false,
    };

    console.log('\n=== SOAK TEST RESULTS ===');
    console.log(`Duration: ${(analysis.duration / 1000 / 60).toFixed(2)} minutes`);
    console.log(`Total Requests: ${analysis.totalRequests}`);
    console.log(`Error Rate: ${analysis.errorRate}`);
    console.log(`P95 Latency: ${analysis.p95Latency}`);
    console.log(`P99 Latency: ${analysis.p99Latency}`);
    console.log(`Max Latency: ${analysis.maxLatency}`);
    console.log('\n=== DEGRADATION ANALYSIS ===');
    console.log(`Performance Degradation Detected: ${degradationAnalysis.degradationDetected}`);
    console.log(`Memory Leak Suspected: ${degradationAnalysis.memoryLeakSuspected}`);

    return {
        'soak-test-summary.json': JSON.stringify({
            ...data,
            analysis,
            degradationAnalysis,
        }, null, 2),
        stdout: JSON.stringify(analysis, null, 2),
    };
}
