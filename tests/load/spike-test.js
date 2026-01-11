/**
 * Plan9 Step 5: k6 Spike Test
 * Tests system behavior under sudden traffic spikes
 * 
 * Run: npx k6 run tests/load/spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '10s', target: 100 },   // Warm up
        { duration: '1m', target: 100 },    // Normal load
        { duration: '10s', target: 1000 },  // SPIKE to 1000 users!
        { duration: '3m', target: 1000 },   // Stay at spike
        { duration: '10s', target: 100 },   // Scale down
        { duration: '3m', target: 100 },    // Recovery period
        { duration: '10s', target: 0 },     // Scale down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],  // Allow higher latency during spike
        http_req_failed: ['rate<0.10'],     // Allow up to 10% failure during spike
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
    const res = http.get(`${BASE_URL}/health`);

    const passed = check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    if (!passed) {
        errorRate.add(1);
    }

    sleep(0.5);
}

export function handleSummary(data) {
    return {
        'spike-test-summary.json': JSON.stringify(data, null, 2),
    };
}
