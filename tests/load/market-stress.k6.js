/**
 * Market Tab Load Test (k6)
 * Comment 5: Load testing for market endpoints
 * 
 * Run with: k6 run tests/load/market-stress.k6.js
 * 
 * Tests:
 * - SoulMarket endpoint under load
 * - Search endpoint stress test
 * - Trending endpoint performance
 * - Filter combinations
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const soulMarketDuration = new Trend('soulmarket_duration');
const searchDuration = new Trend('search_duration');
const trendingDuration = new Trend('trending_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp up to 500 users
    { duration: '1m', target: 1000 },  // Peak at 1000 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    errors: ['rate<0.01'],              // Error rate under 1%
    soulmarket_duration: ['p(95)<1000'], // SoulMarket under 1s
    search_duration: ['p(95)<500'],     // Search under 500ms
    trending_duration: ['p(95)<500'],   // Trending under 500ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Common headers
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Search terms for stress testing
const SEARCH_TERMS = [
  'SOL', 'BONK', 'WIF', 'JUP', 'PYTH', 'JTO', 'RAY', 'ORCA',
  'POPCAT', 'PENGU', 'AI16Z', 'GOAT', 'FARTCOIN', 'MEW',
];

export default function () {
  group('SoulMarket Endpoint', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/trpc/market.soulMarket`,
      JSON.stringify({}),
      { headers }
    );
    soulMarketDuration.add(Date.now() - start);

    const success = check(res, {
      'soulmarket status is 200': (r) => r.status === 200,
      'soulmarket has pairs': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result?.data?.pairs?.length > 0;
        } catch {
          return false;
        }
      },
      'soulmarket response time < 2s': (r) => r.timings.duration < 2000,
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  group('Search Endpoint', () => {
    const searchTerm = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const start = Date.now();
    
    const res = http.post(
      `${BASE_URL}/api/v1/trpc/market.search`,
      JSON.stringify({ query: searchTerm }),
      { headers }
    );
    searchDuration.add(Date.now() - start);

    const success = check(res, {
      'search status is 200': (r) => r.status === 200,
      'search has results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result?.data?.pairs !== undefined;
        } catch {
          return false;
        }
      },
      'search response time < 1s': (r) => r.timings.duration < 1000,
    });

    errorRate.add(!success);
  });

  sleep(0.5);

  group('Trending Endpoint', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/trpc/market.trending`,
      JSON.stringify({}),
      { headers }
    );
    trendingDuration.add(Date.now() - start);

    const success = check(res, {
      'trending status is 200': (r) => r.status === 200,
      'trending has pairs': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result?.data?.pairs?.length > 0;
        } catch {
          return false;
        }
      },
      'trending response time < 1s': (r) => r.timings.duration < 1000,
    });

    errorRate.add(!success);
  });

  sleep(1);
}

// Concurrent search stress test
export function searchStress() {
  const searches = SEARCH_TERMS.map(term => {
    return http.post(
      `${BASE_URL}/api/v1/trpc/market.search`,
      JSON.stringify({ query: term }),
      { headers }
    );
  });

  searches.forEach((res, i) => {
    check(res, {
      [`search ${SEARCH_TERMS[i]} success`]: (r) => r.status === 200,
    });
  });
}

// Filter combination test
export function filterCombinations() {
  const filterCombos = [
    { volume: true },
    { liquidity: true },
    { volume: true, liquidity: true },
    { volume: true, liquidity: true, verified: true },
    { buysRatio: true, txns: true },
    { priceChange: true, verified: true },
  ];

  filterCombos.forEach((filters, i) => {
    const res = http.post(
      `${BASE_URL}/api/v1/trpc/market.soulMarket`,
      JSON.stringify({ filters }),
      { headers }
    );

    check(res, {
      [`filter combo ${i} success`]: (r) => r.status === 200,
    });
  });
}

// Cache hit rate test
export function cacheHitTest() {
  // First request - cache miss
  const res1 = http.post(
    `${BASE_URL}/api/v1/trpc/market.soulMarket`,
    JSON.stringify({}),
    { headers }
  );

  // Second request - should be cache hit
  const res2 = http.post(
    `${BASE_URL}/api/v1/trpc/market.soulMarket`,
    JSON.stringify({}),
    { headers }
  );

  check(res2, {
    'cache hit faster': (r) => r.timings.duration < res1.timings.duration,
    'cache hit under 100ms': (r) => r.timings.duration < 100,
  });
}
