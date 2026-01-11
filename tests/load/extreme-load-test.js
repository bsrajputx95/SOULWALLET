import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

const DEFAULT_STAGES = [
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 5000 },
    { duration: '10m', target: 20000 },
    { duration: '10m', target: 50000 },
    { duration: '20m', target: 50000 },
    { duration: '5m', target: 0 },
];

const SMOKE_STAGES = [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 20 },
    { duration: '20s', target: 20 },
    { duration: '10s', target: 0 },
];

const stages = (__ENV.EXTREME_PROFILE || '').toLowerCase() === 'smoke' || __ENV.EXTREME_FAST === '1'
    ? SMOKE_STAGES
    : DEFAULT_STAGES;

export const options = {
    stages,
    thresholds: {
        http_req_duration: ['p(95)<500'],    // 95% of requests under 500ms
        http_req_failed: ['rate<0.01'],      // Error rate under 1%
        errors: ['rate<0.01'],               // Custom error rate under 1%
    },
    // Distributed execution settings
    noConnectionReuse: false,
    userAgent: 'SoulWallet-LoadTest/1.0',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Simulated user behavior weights - using PUBLIC endpoints only
const ENDPOINTS = {
    health: { weight: 25, path: '/health' },
    market: { weight: 30, path: '/api/trpc/market.soulMarket' },
    trending: { weight: 25, path: '/api/trpc/market.trending' },
    topCoins: { weight: 20, path: '/api/trpc/market.getTopCoins' },
};

function selectEndpoint() {
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const [name, config] of Object.entries(ENDPOINTS)) {
        cumulative += config.weight;
        if (rand <= cumulative) {
            return { name, ...config };
        }
    }
    return { name: 'health', ...ENDPOINTS.health };
}

export default function () {
    const endpoint = selectEndpoint();

    group(endpoint.name, () => {
        const start = Date.now();
        const res = http.get(`${BASE_URL}${endpoint.path}`, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, br',
            },
            timeout: '30s',
        });

        const latency = Date.now() - start;
        apiLatency.add(latency);

        const success = check(res, {
            'status is 200': (r) => r.status === 200,
            'response time < 500ms': (r) => r.timings.duration < 500,
            'has valid body': (r) => r.body && r.body.length > 0,
        });

        if (!success) {
            errorRate.add(1);
        } else {
            errorRate.add(0);
        }
    });

    // Random sleep between 0.5-2 seconds to simulate real user behavior
    sleep(0.5 + Math.random() * 1.5);
}

export function handleSummary(data) {
    return {
        'extreme-load-results.json': JSON.stringify(data, null, 2),
        stdout: textSummary(data),
    };
}

function textSummary(data) {
    const metrics = data.metrics;
    const peakVUs = (stages || []).reduce((max, stage) => Math.max(max, stage.target || 0), 0);
    return `
================================================================================
EXTREME LOAD TEST RESULTS (PEAK ${peakVUs} VU)
================================================================================

Total Requests: ${metrics.http_reqs?.values?.count || 0}
Failed Requests: ${metrics.http_req_failed?.values?.rate ? (metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%

Response Times:
  - P50: ${metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms
  - P90: ${metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 0}ms
  - P95: ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms
  - P99: ${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 0}ms

Thresholds:
  - P95 < 500ms: ${metrics.http_req_duration?.values?.['p(95)'] < 500 ? '✓ PASS' : '✗ FAIL'}
  - Error Rate < 1%: ${(metrics.http_req_failed?.values?.rate || 0) < 0.01 ? '✓ PASS' : '✗ FAIL'}

================================================================================
`;
}
