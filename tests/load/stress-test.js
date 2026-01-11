/**
 * Plan9 Step 5: k6 Stress Test
 * Finds the system's breaking point by gradually increasing load
 * 
 * Run: npx k6 run tests/load/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const requestCount = new Counter('requests');

export const options = {
    stages: [
        { duration: '2m', target: 100 },   // Warm up
        { duration: '5m', target: 200 },   // Level 1
        { duration: '5m', target: 300 },   // Level 2
        { duration: '5m', target: 400 },   // Level 3
        { duration: '5m', target: 500 },   // Level 4
        { duration: '10m', target: 500 },  // Stay at max
        { duration: '2m', target: 0 },     // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(99)<3000'],  // 99th percentile under 3s
        errors: ['rate<0.30'],              // Breaking point at 30% errors
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

function trpcPost(procedure, input, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return http.post(`${BASE_URL}/api/trpc/${procedure}`, JSON.stringify({ json: input || {} }), { headers });
}

export function setup() {
    const email = `stress-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`;
    const password = 'LoadTestPassword123!';
    const signupRes = trpcPost('auth.signup', { email, password, confirmPassword: password });
    const data = signupRes.json();
    const token = data?.result?.data?.token || data?.token;
    if (!token) {
        throw new Error('Failed to get auth token for stress test');
    }
    return { token };
}

export default function (data) {
    requestCount.add(1);
    const token = data?.token;

    // Mix of endpoints to simulate real traffic
    const endpoints = [
        '/health',
        'market.getTopCoins',
        'market.trending',
    ];

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const res = endpoint === '/health' ? http.get(`${BASE_URL}/health`) : trpcPost(endpoint, {}, token);

    const passed = check(res, {
        'status is 2xx': (r) => r.status >= 200 && r.status < 300,
        'response time < 3000ms': (r) => r.timings.duration < 3000,
    });

    if (!passed) {
        errorRate.add(1);
    }

    sleep(0.5);
}

export function handleSummary(data) {
    // Calculate breaking point
    const breakingPoint = {
        maxVus: data.vus_max,
        totalRequests: data.metrics.requests ? data.metrics.requests.count : 0,
        errorRate: data.metrics.errors ? data.metrics.errors.rate : 0,
        p95Latency: data.metrics.http_req_duration ? data.metrics.http_req_duration.p95 : 0,
    };

    console.log('=== STRESS TEST RESULTS ===');
    console.log(`Max VUs: ${breakingPoint.maxVus}`);
    console.log(`Total Requests: ${breakingPoint.totalRequests}`);
    console.log(`Error Rate: ${(breakingPoint.errorRate * 100).toFixed(2)}%`);
    console.log(`P95 Latency: ${breakingPoint.p95Latency.toFixed(0)}ms`);

    return {
        'stress-test-summary.json': JSON.stringify(data, null, 2),
        stdout: JSON.stringify(breakingPoint, null, 2),
    };
}
