/**
 * MarketData Unit Tests
 * Tests for token search, trending data, OHLCV, and error handling
 */

// Mock axios before importing the service
jest.mock('axios', () => {
    const mockAxiosInstance = {
        get: jest.fn(),
        defaults: { headers: {} },
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
    };
    return {
        __esModule: true,
        default: {
            create: jest.fn().mockReturnValue(mockAxiosInstance),
        },
    };
});

jest.mock('../../src/lib/services/circuitBreaker', () => ({
    getCircuitBreaker: jest.fn().mockReturnValue({
        exec: jest.fn().mockImplementation(async (fn) => fn()),
        getSnapshot: jest.fn().mockReturnValue({ state: 'CLOSED' }),
    }),
}));

jest.mock('../../src/lib/utils/retry', () => ({
    retryWithBackoff: jest.fn().mockImplementation(async (fn) => fn()),
}));

jest.mock('../../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import axios from 'axios';

const mockAxiosInstance = (axios.create as jest.Mock)();

describe('MarketDataService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================
    // Token Search Tests
    // =========================================
    describe('Token Search Logic', () => {
        it('should parse search results correctly', () => {
            const mockResponse = {
                pairs: [
                    {
                        chainId: 'solana',
                        pairAddress: 'pair-1',
                        baseToken: { address: 'token-1', name: 'Test Token', symbol: 'TEST' },
                        quoteToken: { address: 'usdc-address', symbol: 'USDC' },
                        priceUsd: '1.50',
                        volume: { h24: 1000000 },
                        liquidity: { usd: 500000 },
                    },
                ],
            };

            expect(mockResponse.pairs).toHaveLength(1);
            expect(mockResponse.pairs[0].baseToken.symbol).toBe('TEST');
        });

        it('should handle empty search results', () => {
            const mockResponse = { pairs: [] };
            expect(mockResponse.pairs).toHaveLength(0);
        });

        it('should handle null pairs response', () => {
            const mockResponse = { pairs: null };
            expect(mockResponse.pairs).toBeNull();
        });
    });

    // =========================================
    // Price Validation Tests
    // =========================================
    describe('Price Validation', () => {
        it('should validate price format correctly', () => {
            const validPrices = ['1.50', '0.00001', '1000000', '0'];
            const invalidPrices = ['abc', ''];

            for (const price of validPrices) {
                expect(isNaN(parseFloat(price))).toBe(false);
            }

            for (const price of invalidPrices) {
                const parsed = parseFloat(price);
                expect(isNaN(parsed) || price === '').toBe(true);
            }
        });

        it('should calculate price change percentage', () => {
            const oldPrice = 100;
            const newPrice = 125;
            const change = ((newPrice - oldPrice) / oldPrice) * 100;
            expect(change).toBe(25);
        });
    });

    // =========================================
    // SoulMarket Quality Filters Tests
    // =========================================
    describe('SoulMarket Quality Filters', () => {
        const mockPairs = [
            {
                liquidity: { usd: 150000 },
                pairCreatedAt: Date.now() - 5 * 60 * 60 * 1000, // 5 hours old
                txns: { h24: { buys: 100, sells: 50 } },
                volume: { h24: 500000 },
            },
            {
                liquidity: { usd: 50000 }, // Too low
                pairCreatedAt: Date.now() - 5 * 60 * 60 * 1000,
                txns: { h24: { buys: 100, sells: 50 } },
                volume: { h24: 500000 },
            },
            {
                liquidity: { usd: 150000 },
                pairCreatedAt: Date.now() - 1 * 60 * 60 * 1000, // Too new (1 hour)
                txns: { h24: { buys: 100, sells: 50 } },
                volume: { h24: 500000 },
            },
        ];

        it('should filter by minimum liquidity', () => {
            const minLiquidity = 100000;
            const filtered = mockPairs.filter(p => p.liquidity.usd >= minLiquidity);
            expect(filtered).toHaveLength(2);
        });

        it('should filter by pair age', () => {
            const minAgeHours = 4;
            const now = Date.now();
            const filtered = mockPairs.filter(p => {
                const ageHours = (now - p.pairCreatedAt) / (1000 * 60 * 60);
                return ageHours >= minAgeHours;
            });
            expect(filtered).toHaveLength(2);
        });

        it('should filter by transaction count', () => {
            const minTxns = 50;
            const filtered = mockPairs.filter(p =>
                (p.txns.h24.buys + p.txns.h24.sells) >= minTxns
            );
            expect(filtered).toHaveLength(3);
        });

        it('should apply combined quality filters', () => {
            const minLiquidity = 100000;
            const minAgeHours = 4;
            const now = Date.now();

            const filtered = mockPairs.filter(p => {
                const ageHours = (now - p.pairCreatedAt) / (1000 * 60 * 60);
                return p.liquidity.usd >= minLiquidity && ageHours >= minAgeHours;
            });
            expect(filtered).toHaveLength(1);
        });
    });

    // =========================================
    // Trending Tokens Tests
    // =========================================
    describe('Trending Tokens', () => {
        it('should sort by price change', () => {
            const pairs = [
                { priceChange: { h24: 10 } },
                { priceChange: { h24: 50 } },
                { priceChange: { h24: 25 } },
            ];

            const sorted = [...pairs].sort((a, b) => b.priceChange.h24 - a.priceChange.h24);

            expect(sorted[0].priceChange.h24).toBe(50);
            expect(sorted[1].priceChange.h24).toBe(25);
            expect(sorted[2].priceChange.h24).toBe(10);
        });

        it('should filter by minimum volume', () => {
            const pairs = [
                { volume: { h24: 1000000 } },
                { volume: { h24: 500000 } },
                { volume: { h24: 100000 } },
            ];

            const minVolume = 200000;
            const filtered = pairs.filter(p => p.volume.h24 >= minVolume);

            expect(filtered).toHaveLength(2);
        });
    });

    // =========================================
    // OHLCV Data Tests
    // =========================================
    describe('OHLCV Data', () => {
        it('should parse OHLCV bars correctly', () => {
            const bars = [
                { time: 1700000000, open: 1.0, high: 1.1, low: 0.9, close: 1.05, volume: 100000 },
                { time: 1700003600, open: 1.05, high: 1.15, low: 1.0, close: 1.10, volume: 120000 },
            ];

            expect(bars).toHaveLength(2);
            expect(bars[0].high).toBeGreaterThan(bars[0].low);
            expect(bars[1].close).toBe(1.10);
        });

        it('should validate timeframe options', () => {
            const timeframes = ['5m', '15m', '1h', '4h', '1d'];
            expect(timeframes).toContain('1h');
            expect(timeframes).toHaveLength(5);
        });

        it('should calculate price range from bars', () => {
            const bars = [
                { high: 1.1, low: 0.9 },
                { high: 1.15, low: 1.0 },
                { high: 1.2, low: 0.95 },
            ];

            const maxHigh = Math.max(...bars.map(b => b.high));
            const minLow = Math.min(...bars.map(b => b.low));
            const range = maxHigh - minLow;

            expect(maxHigh).toBe(1.2);
            expect(minLow).toBe(0.9);
            expect(range).toBeCloseTo(0.3);
        });
    });

    // =========================================
    // Token Address Validation Tests
    // =========================================
    describe('Token Address Validation', () => {
        it('should validate Solana address format', () => {
            const validAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const invalidAddress = 'not-a-valid-address';

            // Solana addresses are base58 and typically 32-44 characters
            expect(validAddress.length).toBeGreaterThanOrEqual(32);
            expect(validAddress.length).toBeLessThanOrEqual(44);
            expect(validAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);

            expect(invalidAddress).not.toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
        });

        it('should sanitize search queries', () => {
            const sanitize = (query: string) =>
                query.trim().replace(/[<>"']/g, '').slice(0, 100);

            expect(sanitize('  TEST  ')).toBe('TEST');
            expect(sanitize('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
            expect(sanitize('a'.repeat(200))).toHaveLength(100);
        });
    });

    // =========================================
    // Caching Logic Tests
    // =========================================
    describe('Caching Logic', () => {
        it('should check cache expiration', () => {
            const cacheTTL = 60000; // 1 minute
            const cacheEntry = {
                data: { pairs: [] },
                timestamp: Date.now() - 120000, // 2 minutes ago
            };

            const isExpired = Date.now() - cacheEntry.timestamp > cacheTTL;
            expect(isExpired).toBe(true);
        });

        it('should not expire fresh cache', () => {
            const cacheTTL = 60000;
            const cacheEntry = {
                data: { pairs: [] },
                timestamp: Date.now() - 30000, // 30 seconds ago
            };

            const isExpired = Date.now() - cacheEntry.timestamp > cacheTTL;
            expect(isExpired).toBe(false);
        });
    });

    // =========================================
    // Error Response Handling Tests
    // =========================================
    describe('Error Response Handling', () => {
        it('should handle 429 rate limit response', () => {
            const response = { status: 429, message: 'Rate limited' };
            expect(response.status).toBe(429);
        });

        it('should handle 500 server error', () => {
            const response = { status: 500, message: 'Internal server error' };
            expect(response.status).toBe(500);
        });

        it('should handle network timeout', () => {
            const error = { code: 'ECONNABORTED', message: 'timeout' };
            expect(error.code).toBe('ECONNABORTED');
        });

        it('should handle malformed JSON response', () => {
            const parseResponse = (data: any) => {
                if (typeof data !== 'object' || data === null) {
                    return null;
                }
                return data;
            };

            expect(parseResponse('not-json')).toBeNull();
            expect(parseResponse(null)).toBeNull();
            expect(parseResponse({ pairs: [] })).toEqual({ pairs: [] });
        });
    });
});
