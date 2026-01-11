import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const walletCreationDuration = new Trend('wallet_creation_duration');
const balanceFetchDuration = new Trend('balance_fetch_duration');
const tokensFetchDuration = new Trend('tokens_fetch_duration');
const swapQuoteDuration = new Trend('swap_quote_duration');
const errorRate = new Rate('error_rate');
const successfulWalletOps = new Counter('successful_wallet_ops');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_PATH = '/api/trpc';

export const options = {
    stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 50 },   // Stay at 50 users
        { duration: '30s', target: 100 }, // Spike to 100 users
        { duration: '1m', target: 100 },  // Stay at 100 users
        { duration: '30s', target: 0 },   // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // 95% of requests should complete under 2s
        http_req_failed: ['rate<0.05'],    // Less than 5% failure rate
        wallet_creation_duration: ['p(95)<3000'],
        balance_fetch_duration: ['p(95)<1000'],
        tokens_fetch_duration: ['p(95)<1500'],
        swap_quote_duration: ['p(95)<2000'],
        error_rate: ['rate<0.1'],
    },
};

// Helper function for tRPC requests
function trpcRequest(procedure, input = {}, token = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // tRPC batch format
    const url = `${BASE_URL}${API_PATH}/${procedure}`;

    return http.post(url, JSON.stringify(input), { headers });
}

function trpcQuery(procedure, input = {}, token = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const inputStr = JSON.stringify(input);
    const encodedInput = encodeURIComponent(inputStr);
    const url = `${BASE_URL}${API_PATH}/${procedure}?input=${encodedInput}`;

    return http.get(url, { headers });
}

// Test user authentication
function authenticateUser() {
    const email = `loadtest_${__VU}_${Date.now()}@test.com`;
    const password = 'LoadTest123!';

    // Sign up
    const signupRes = trpcRequest('auth.signup', { email, password, username: `user${__VU}${Date.now()}` });

    if (signupRes.status === 200) {
        const data = JSON.parse(signupRes.body);
        return data?.result?.data?.json?.token || null;
    }

    // If signup fails, try login
    const loginRes = trpcRequest('auth.login', { email, password });
    if (loginRes.status === 200) {
        const data = JSON.parse(loginRes.body);
        return data?.result?.data?.json?.token || null;
    }

    return null;
}

export default function () {
    const token = authenticateUser();

    if (!token) {
        errorRate.add(1);
        console.warn('Authentication failed');
        sleep(1);
        return;
    }

    group('Wallet Operations', () => {
        // Get wallet balance
        group('Get Balance', () => {
            const start = new Date();
            const res = trpcQuery('wallet.getBalance', {}, token);
            balanceFetchDuration.add(new Date() - start);

            const success = check(res, {
                'balance status is 200': (r) => r.status === 200,
                'balance has data': (r) => {
                    try {
                        const data = JSON.parse(r.body);
                        return data?.result?.data?.json !== undefined;
                    } catch {
                        return false;
                    }
                },
            });

            if (success) {
                successfulWalletOps.add(1);
            } else {
                errorRate.add(1);
            }
        });

        sleep(0.5);

        // Get token balances
        group('Get Tokens', () => {
            const start = new Date();
            const res = trpcQuery('wallet.getTokens', {}, token);
            tokensFetchDuration.add(new Date() - start);

            const success = check(res, {
                'tokens status is 200': (r) => r.status === 200,
                'tokens has data': (r) => {
                    try {
                        const data = JSON.parse(r.body);
                        return data?.result?.data?.json !== undefined;
                    } catch {
                        return false;
                    }
                },
            });

            if (success) {
                successfulWalletOps.add(1);
            } else {
                errorRate.add(1);
            }
        });

        sleep(0.5);

        // Get fee estimate
        group('Estimate Fee', () => {
            const res = trpcQuery('wallet.estimateFee', {
                to: '11111111111111111111111111111111',
                amount: 0.001,
                token: 'SOL',
            }, token);

            const success = check(res, {
                'fee estimation responds': (r) => r.status === 200 || r.status === 400,
            });

            if (success) {
                successfulWalletOps.add(1);
            } else {
                errorRate.add(1);
            }
        });
    });

    group('Market Data', () => {
        // Get trending tokens
        group('Trending Tokens', () => {
            const res = trpcQuery('market.trending', {}, token);

            check(res, {
                'trending status is 200': (r) => r.status === 200,
            });
        });

        sleep(0.3);

        // Search tokens
        group('Search Tokens', () => {
            const res = trpcQuery('market.searchTokens', { query: 'SOL' }, token);

            check(res, {
                'search responds': (r) => r.status === 200 || r.status === 400,
            });
        });
    });

    group('Swap Operations', () => {
        // Get swap quote
        group('Get Swap Quote', () => {
            const start = new Date();
            const res = trpcQuery('swap.getQuote', {
                inputMint: 'So11111111111111111111111111111111111111112',
                outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                amount: 1000000, // 0.001 SOL in lamports
                slippageBps: 50,
            }, token);
            swapQuoteDuration.add(new Date() - start);

            check(res, {
                'quote responds': (r) => r.status === 200 || r.status === 400,
            });
        });
    });

    group('Portfolio', () => {
        // Get portfolio overview
        group('Portfolio Overview', () => {
            const res = trpcQuery('portfolio.overview', {}, token);

            check(res, {
                'portfolio responds': (r) => r.status === 200 || r.status === 400,
            });
        });
    });

    // Cleanup delay
    sleep(1);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'tests/load/results/wallet-flows-summary.json': JSON.stringify(data, null, 2),
    };
}

function textSummary(data, options) {
    const lines = [
        '='.repeat(60),
        'WALLET FLOWS LOAD TEST SUMMARY',
        '='.repeat(60),
        '',
        `Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`,
        `Failed Requests: ${data.metrics.http_req_failed?.values?.rate?.toFixed(4) || 0}`,
        `Avg Request Duration: ${data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms`,
        `P95 Request Duration: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms`,
        '',
        'Custom Metrics:',
        `  Balance Fetch P95: ${data.metrics.balance_fetch_duration?.values?.['p(95)']?.toFixed(2) || 0}ms`,
        `  Tokens Fetch P95: ${data.metrics.tokens_fetch_duration?.values?.['p(95)']?.toFixed(2) || 0}ms`,
        `  Swap Quote P95: ${data.metrics.swap_quote_duration?.values?.['p(95)']?.toFixed(2) || 0}ms`,
        `  Error Rate: ${data.metrics.error_rate?.values?.rate?.toFixed(4) || 0}`,
        `  Successful Wallet Ops: ${data.metrics.successful_wallet_ops?.values?.count || 0}`,
        '',
        '='.repeat(60),
    ];

    return lines.join('\n');
}
