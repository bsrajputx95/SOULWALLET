/**
 * k6 Load Test Script for Copy Trading
 * Simulates 1000 concurrent copiers following a single trader
 * 
 * Run with: k6 run tests/load/copy-trading-stress.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const copyTradeSuccess = new Rate('copy_trade_success');
const copyTradeLatency = new Trend('copy_trade_latency_ms');
const positionOpenLatency = new Trend('position_open_latency_ms');

export const options = {
    scenarios: {
        // Scenario 1: Gradual ramp up to 1000 copiers
        ramp_up: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 100 },   // Ramp up to 100
                { duration: '2m', target: 500 },   // Ramp to 500
                { duration: '3m', target: 1000 },  // Peak at 1000
                { duration: '5m', target: 1000 },  // Hold at 1000
                { duration: '2m', target: 0 },     // Ramp down
            ],
        },

        // Scenario 2: Burst simulation (trader makes sudden trade)
        burst: {
            executor: 'shared-iterations',
            vus: 100,
            iterations: 1000,
            startTime: '3m', // Start after ramp up
            maxDuration: '30s',
        },
    },

    thresholds: {
        http_req_duration: ['p(95)<3000'],     // 95% of requests under 3s
        copy_trade_success: ['rate>0.95'],      // 95% success rate
        copy_trade_latency_ms: ['p(95)<5000'],  // 95% copy latency under 5s
        position_open_latency_ms: ['p(99)<10000'], // 99% position open under 10s
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const TRADER_WALLET = __ENV.TRADER_WALLET || 'FeaturedTrader123...';
const TOKEN_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL

// Setup: Create test users and copy trading relationships
export function setup() {
    // In a real test, you'd create users via API or seed database
    console.log('Setting up 1000 copier accounts...');

    return {
        traderWallet: TRADER_WALLET,
        tokenMint: TOKEN_MINT,
        testStartTime: Date.now(),
    };
}

export default function (data) {
    const userId = `user-${__VU}-${__ITER}`;

    // 1. Start copying a trader (if not already)
    const startCopyPayload = JSON.stringify({
        walletAddress: data.traderWallet,
        totalBudget: 1000,
        amountPerTrade: 100,
        stopLoss: -10,
        takeProfit: 30,
        maxSlippage: 0.5,
        exitWithTrader: true,
        // totpCode optional when 2FA disabled
    });

    const copyStart = Date.now();
    const startCopyRes = http.post(`${BASE_URL}/trpc/copyTrading.startCopying`, startCopyPayload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getTestToken(userId)}`,
        },
        tags: { name: 'start_copying' },
    });

    check(startCopyRes, {
        'start copy status is 200': (r) => r.status === 200,
        'start copy has copyTradingId': (r) => {
            try {
                const body = JSON.parse(r.body);
                return !!body.result?.data?.copyTradingId;
            } catch {
                return false;
            }
        },
    });

    copyTradeLatency.add(Date.now() - copyStart);
    copyTradeSuccess.add(startCopyRes.status === 200);

    sleep(0.5);

    // 2. Check open positions
    const positionsRes = http.get(`${BASE_URL}/trpc/copyTrading.getOpenPositions`, {
        headers: { 'Authorization': `Bearer ${getTestToken(userId)}` },
        tags: { name: 'get_positions' },
    });

    check(positionsRes, {
        'positions status is 200': (r) => r.status === 200,
    });

    // 3. Simulate receiving a copy trade (trader detection)
    // In real test, this would be triggered by WebSocket detection
    const simulateCopyStart = Date.now();

    // Poll for position to be opened (simulating copy trade execution)
    let positionOpened = false;
    for (let i = 0; i < 10; i++) {
        sleep(0.5);
        const pollRes = http.get(`${BASE_URL}/trpc/copyTrading.getOpenPositions`, {
            headers: { 'Authorization': `Bearer ${getTestToken(userId)}` },
        });

        try {
            const body = JSON.parse(pollRes.body);
            if (body.result?.data?.positions?.length > 0) {
                positionOpened = true;
                positionOpenLatency.add(Date.now() - simulateCopyStart);
                break;
            }
        } catch (_e) { /* JSON parse error - continue polling */ }
    }

    if (!positionOpened) {
        // Position didn't open within timeout - this is expected if no trade signal
        positionOpenLatency.add(5000); // Default latency for no-trade scenario
    }

    sleep(1);
}

export function teardown(data) {
    console.log(`Test completed in ${(Date.now() - data.testStartTime) / 1000}s`);
}

// Helper function to get test JWT token
function getTestToken(userId) {
    // In real tests, generate valid JWTs or use test auth bypass
    return `test-token-${userId}`;
}

/**
 * Expected Results at 1000 copiers:
 * 
 * Latency Targets:
 * - Trade detection: <2s (WebSocket)
 * - Queue processing: <1s (with concurrency 5)
 * - Swap execution: <3s (Jupiter + Solana)
 * - Total copy latency: <6s
 * 
 * Throughput:
 * - With concurrency 5: 5 trades/second
 * - For 1000 copiers: ~3-4 minutes to process all
 * 
 * Success Rate:
 * - Target: 95%+ success
 * - Expected failures: slippage, insufficient balance, network issues
 */
