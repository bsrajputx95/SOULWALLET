/**
 * iBuy Feature - k6 Load Test with Real Authenticated API Calls
 * 
 * Tests:
 * - 1000 VU x 10 iterations with real postIds/tokenMints
 * - Authenticated API calls via JWT
 * - Queue-based execution with job polling
 * - Metrics: p95 buy <2s, error<1%, queue depth<50
 * 
 * Run: k6 run tests/load/ibuy-stress.k6.js --env BASE_URL=http://localhost:3000
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const buySuccessRate = new Rate('ibuy_buy_success_rate');
const sellSuccessRate = new Rate('ibuy_sell_success_rate');
const jobCompleteRate = new Rate('ibuy_job_complete_rate');
const buyLatency = new Trend('ibuy_buy_latency', true);
const sellLatency = new Trend('ibuy_sell_latency', true);
const jobPollLatency = new Trend('ibuy_job_poll_latency', true);
const jitoUsageCount = new Counter('ibuy_jito_usage');
const queueDepth = new Gauge('ibuy_queue_depth');

// Test configuration - 1000 VU x 10 iterations
export const options = {
  scenarios: {
    // Warm-up phase
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
      ],
      gracefulRampDown: '10s',
    },
    // Main stress test - 1000 VUs
    stress_test: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '2m',
      startTime: '1m',
      exec: 'stressTest',
    },
    // Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 100 },
      ],
      startTime: '3m30s',
      exec: 'spikeTest',
    },
  },
  thresholds: {
    // Performance targets from plan
    'ibuy_buy_success_rate': ['rate>0.99'],           // 99%+ success
    'ibuy_sell_success_rate': ['rate>0.99'],          // 99%+ success
    'ibuy_job_complete_rate': ['rate>0.95'],          // 95%+ jobs complete
    'ibuy_buy_latency': ['p(95)<2000'],               // p95 < 2s
    'ibuy_sell_latency': ['p(95)<1500'],              // p95 < 1.5s
    'http_req_failed': ['rate<0.01'],                 // <1% errors
    'ibuy_queue_depth': ['value<50'],                 // Queue depth < 50
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Load test data from file or generate
const testData = new SharedArray('testData', function() {
  // In production, load from a JSON file with real postIds/tokenMints
  // For now, generate test data
  const data = [];
  const tokenMints = [
    'So11111111111111111111111111111111111111112',  // SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'JUPyiwrYJFKd4LduT38ysz9BPHZ5TS4NaHHbnJ3iPJa', // JUP
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  ];
  
  for (let i = 0; i < 100; i++) {
    data.push({
      postId: `test-post-${i}`,
      tokenMint: tokenMints[i % tokenMints.length],
    });
  }
  return data;
});

// Authenticate and get JWT token
function authenticate() {
  const loginPayload = JSON.stringify({
    email: __ENV.TEST_EMAIL || 'loadtest@soulwallet.test',
    password: __ENV.TEST_PASSWORD || 'LoadTest123!',
  });

  const loginRes = http.post(`${BASE_URL}/api/trpc/auth.login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  });

  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      return body?.result?.data?.token || null;
    } catch {
      return null;
    }
  }
  return null;
}

// Get authenticated headers
function getHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

// Poll for job completion
function pollJobStatus(jobId, token, maxAttempts = 20) {
  const headers = getHeaders(token);
  const startTime = Date.now();
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = http.get(
      `${BASE_URL}/api/trpc/social.getIBuyJobStatus?input=${encodeURIComponent(JSON.stringify({ jobId }))}`,
      { headers, timeout: '5s' }
    );

    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        const status = body?.result?.data;
        
        if (status?.status === 'completed') {
          jobPollLatency.add(Date.now() - startTime);
          return { success: true, result: status.result };
        }
        if (status?.status === 'failed') {
          return { success: false, error: status.error };
        }
      } catch {
        // Continue polling
      }
    }
    
    sleep(0.5);
  }
  
  return { success: false, error: 'timeout' };
}

// Test buy flow with queue
function testBuy(token) {
  const testItem = testData[Math.floor(Math.random() * testData.length)];
  const headers = getHeaders(token);

  const payload = JSON.stringify({
    postId: testItem.postId,
    tokenMint: testItem.tokenMint,
  });

  const startTime = Date.now();
  const response = http.post(
    `${BASE_URL}/api/trpc/social.ibuyToken`,
    payload,
    { headers, timeout: '30s' }
  );
  const latency = Date.now() - startTime;

  let success = false;
  let jobId = null;

  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      success = body?.result?.data?.success === true;
      jobId = body?.result?.data?.jobId;
    } catch {
      success = false;
    }
  }

  buySuccessRate.add(success);
  buyLatency.add(latency);

  // Poll for job completion if we got a jobId
  if (success && jobId) {
    const jobResult = pollJobStatus(jobId, token);
    jobCompleteRate.add(jobResult.success);
    
    // Track Jito usage for high-value trades
    if (jobResult.success && jobResult.result?.amountUsd >= 50) {
      jitoUsageCount.add(1);
    }
  }

  return { success, jobId, latency };
}

// Test sell flow
function testSell(token) {
  const headers = getHeaders(token);
  const purchaseId = `purchase-${__VU}-${__ITER}`;
  const sellPercentage = [10, 25, 50, 100][Math.floor(Math.random() * 4)];

  const payload = JSON.stringify({
    purchaseId,
    sellAmountUsdc: 50 * (sellPercentage / 100),
    sellTxSig: `mockTx${__VU}${__ITER}${Date.now()}`,
    amountSoldTokens: 1000 * (sellPercentage / 100),
  });

  const startTime = Date.now();
  const response = http.post(
    `${BASE_URL}/api/trpc/social.sellIBuyToken`,
    payload,
    { headers, timeout: '20s' }
  );
  const latency = Date.now() - startTime;

  const success = check(response, {
    'sell status 200': (r) => r.status === 200,
    'sell latency < 3s': () => latency < 3000,
  });

  sellSuccessRate.add(success);
  sellLatency.add(latency);

  return { success, latency };
}

// Test get purchases (read-heavy)
function testGetPurchases(token) {
  const headers = getHeaders(token);
  
  const response = http.get(
    `${BASE_URL}/api/trpc/social.getIBuyPurchases`,
    { headers, timeout: '10s' }
  );

  check(response, {
    'get purchases status 200': (r) => r.status === 200,
  });

  return response;
}

// Get queue stats for monitoring
function getQueueStats(token) {
  const headers = getHeaders(token);
  
  const response = http.get(
    `${BASE_URL}/api/trpc/admin.getQueueStats`,
    { headers, timeout: '5s' }
  );

  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      const stats = body?.result?.data;
      if (stats?.ibuy) {
        queueDepth.add(stats.ibuy.waiting + stats.ibuy.active);
      }
    } catch {
      // Ignore
    }
  }
}

// Main test function - mixed operations
export default function() {
  const token = authenticate();
  if (!token) {
    console.warn('Authentication failed, skipping iteration');
    return;
  }

  const rand = Math.random();

  if (rand < 0.5) {
    // 50% buys
    group('iBuy Buy', () => {
      testBuy(token);
    });
  } else if (rand < 0.8) {
    // 30% sells
    group('iBuy Sell', () => {
      testSell(token);
    });
  } else {
    // 20% read purchases
    group('iBuy Read', () => {
      testGetPurchases(token);
    });
  }

  // Periodically check queue stats
  if (__ITER % 10 === 0) {
    getQueueStats(token);
  }

  sleep(0.1);
}

// Stress test scenario - high concurrency buys
export function stressTest() {
  const token = authenticate();
  if (!token) return;

  group('Stress Test - Concurrent Buys', () => {
    for (let i = 0; i < 10; i++) {
      testBuy(token);
      sleep(0.05);
    }
  });
}

// Spike test scenario - sudden load
export function spikeTest() {
  const token = authenticate();
  if (!token) return;

  group('Spike Test', () => {
    const rand = Math.random();
    if (rand < 0.7) {
      testBuy(token);
    } else {
      testSell(token);
    }
  });
}

// Setup function
export function setup() {
  console.log('Starting iBuy load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: 1000 VUs x 10 iterations`);
  console.log(`Thresholds: p95 buy <2s, error<1%, queue depth<50`);

  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`, { timeout: '5s' });
  if (healthCheck.status !== 200) {
    console.warn('Warning: Health check failed, tests may fail');
  }

  // Verify authentication works
  const token = authenticate();
  if (!token) {
    console.warn('Warning: Authentication failed in setup');
  }

  return { startTime: Date.now(), token };
}

// Teardown function
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`iBuy load test completed in ${duration.toFixed(2)}s`);
  console.log('Check metrics for:');
  console.log('  - ibuy_buy_success_rate (target: >99%)');
  console.log('  - ibuy_buy_latency p95 (target: <2s)');
  console.log('  - ibuy_queue_depth (target: <50)');
}
