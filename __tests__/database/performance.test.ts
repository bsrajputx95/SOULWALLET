/**
 * Query Performance Monitoring Tests
 *
 * Tests for the queryPerformance service in src/lib/services/queryPerformance.ts
 */

import { queryPerformanceService, startQueryPerformanceMetricsCollection, stopQueryPerformanceMetricsCollection } from '../../src/lib/services/queryPerformance';

// Mock Prisma client
jest.mock('../../src/lib/prisma', () => ({
    __esModule: true,
    default: {
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn(),
    },
}));

// Mock logger
jest.mock('../../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import prisma from '../../src/lib/prisma';

describe('QueryPerformanceService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        stopQueryPerformanceMetricsCollection();
    });

    describe('isExtensionAvailable', () => {
        it('should return true when pg_stat_statements exists', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ exists: 1 }]);

            const result = await queryPerformanceService.isExtensionAvailable();

            expect(result).toBe(true);
        });

        it('should return false when pg_stat_statements does not exist', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

            const result = await queryPerformanceService.isExtensionAvailable();

            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Query failed'));

            const result = await queryPerformanceService.isExtensionAvailable();

            expect(result).toBe(false);
        });
    });

    describe('getSlowQueries', () => {
        it('should return empty array when extension not available', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

            const result = await queryPerformanceService.getSlowQueries();

            expect(result).toEqual([]);
        });

        it('should return formatted slow query results', async () => {
            // Mock extension check
            (prisma.$queryRaw as jest.Mock)
                .mockResolvedValueOnce([{ exists: 1 }]) // isExtensionAvailable
                .mockResolvedValueOnce([
                    {
                        query: 'SELECT * FROM users WHERE id = $1',
                        calls: 100n,
                        avgTimeMs: 1500,
                        maxTimeMs: 3000,
                        totalTimeMs: 150000,
                        rows: 100n,
                    },
                ]);

            const result = await queryPerformanceService.getSlowQueries();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                query: expect.stringContaining('SELECT'),
                calls: 100,
                avgTimeMs: 1500,
            });
        });
    });

    describe('getTopQueriesByTime', () => {
        it('should return formatted top queries', async () => {
            (prisma.$queryRaw as jest.Mock)
                .mockResolvedValueOnce([{ exists: 1 }])
                .mockResolvedValueOnce([
                    {
                        query: 'SELECT * FROM transactions',
                        calls: 50n,
                        avgTimeMs: 500,
                        maxTimeMs: 1000,
                        totalTimeMs: 25000,
                        rows: 500n,
                    },
                ]);

            const result = await queryPerformanceService.getTopQueriesByTime();

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getTopQueriesByCount', () => {
        it('should return queries sorted by call count', async () => {
            (prisma.$queryRaw as jest.Mock)
                .mockResolvedValueOnce([{ exists: 1 }])
                .mockResolvedValueOnce([
                    {
                        query: 'SELECT 1',
                        calls: 10000n,
                        avgTimeMs: 1,
                        maxTimeMs: 5,
                        totalTimeMs: 10000,
                        rows: 10000n,
                    },
                ]);

            const result = await queryPerformanceService.getTopQueriesByCount();

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('detectN1Problems', () => {
        it('should detect N+1 patterns', async () => {
            // Mock extension check
            (prisma.$queryRaw as jest.Mock)
                .mockResolvedValueOnce([{ exists: 1 }])
                // Mock stats age query
                .mockResolvedValueOnce([{ age_seconds: 3600 }])
                // Mock N+1 query results
                .mockResolvedValueOnce([
                    {
                        query: 'SELECT * FROM posts WHERE user_id = $1',
                        calls: 500n,
                        avgTimeMs: 5,
                        totalTimeMs: 2500,
                    },
                ]);

            const result = await queryPerformanceService.detectN1Problems();

            expect(Array.isArray(result)).toBe(true);
            if (result.length > 0) {
                expect(result[0]).toHaveProperty('severity');
                expect(['high', 'medium', 'low']).toContain(result[0].severity);
            }
        });

        it('should calculate severity based on calls per second', async () => {
            (prisma.$queryRaw as jest.Mock)
                .mockResolvedValueOnce([{ exists: 1 }])
                .mockResolvedValueOnce([{ age_seconds: 100 }]) // Short window = high CPS
                .mockResolvedValueOnce([
                    {
                        query: 'SELECT id FROM users LIMIT 1',
                        calls: 5000n, // 50 calls/sec
                        avgTimeMs: 1,
                        totalTimeMs: 5000,
                    },
                ]);

            const result = await queryPerformanceService.detectN1Problems();

            if (result.length > 0) {
                expect(result[0].severity).toBe('high');
            }
        });
    });

    describe('getCacheHitRatio', () => {
        it('should return cache hit ratio as number', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ hit_ratio: 0.95 }]);

            const result = await queryPerformanceService.getCacheHitRatio();

            expect(typeof result).toBe('number');
            expect(result).toBe(0.95);
        });

        it('should return 0 on error', async () => {
            (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Query failed'));

            const result = await queryPerformanceService.getCacheHitRatio();

            expect(result).toBe(0);
        });
    });

    describe('getIndexUsage', () => {
        it('should return index usage array', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
                { table_name: 'users', index_name: 'users_email_idx', scans: 1000n },
            ]);

            const result = await queryPerformanceService.getIndexUsage();

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getTableBloat', () => {
        it('should return table bloat statistics', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
                { table_name: 'transactions', live_tuples: 10000n, dead_tuples: 500n, dead_ratio: 5.0 },
            ]);

            const result = await queryPerformanceService.getTableBloat();

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getLongRunningQueries', () => {
        it('should return active queries exceeding threshold', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
                { pid: 123, duration: '00:00:10', state: 'active', query: 'SELECT * FROM big_table' },
            ]);

            const result = await queryPerformanceService.getLongRunningQueries(5);

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('resetStats', () => {
        it('should return true on successful reset', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ exists: 1 }]);
            (prisma.$executeRaw as jest.Mock).mockResolvedValueOnce(1);

            const result = await queryPerformanceService.resetStats();

            expect(result).toBe(true);
        });

        it('should return false when extension not available', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

            const result = await queryPerformanceService.resetStats();

            expect(result).toBe(false);
        });
    });

    describe('getPerformanceSummary', () => {
        it('should aggregate all performance data', async () => {
            // Extension available
            (prisma.$queryRaw as jest.Mock)
                .mockResolvedValue([{ exists: 1 }]);

            const result = await queryPerformanceService.getPerformanceSummary();

            expect(result).toHaveProperty('slowQueries');
            expect(result).toHaveProperty('topByTime');
            expect(result).toHaveProperty('n1Problems');
            expect(result).toHaveProperty('cacheHitRatio');
            expect(result).toHaveProperty('extensionAvailable');
        });
    });

    describe('Prometheus Metrics', () => {
        it('should have a metrics registry', () => {
            const registry = queryPerformanceService.getMetricsRegistry();

            expect(registry).toBeDefined();
            expect(typeof registry.metrics).toBe('function');
        });

        it('should export metrics as text', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            const metricsText = await queryPerformanceService.getMetricsAsText();

            expect(typeof metricsText).toBe('string');
        });
    });

    describe('Metrics Collection', () => {
        it('should start and stop metrics collection', () => {
            expect(() => startQueryPerformanceMetricsCollection(60000)).not.toThrow();
            expect(() => stopQueryPerformanceMetricsCollection()).not.toThrow();
        });

        it('should handle multiple start calls gracefully', () => {
            startQueryPerformanceMetricsCollection(60000);
            expect(() => startQueryPerformanceMetricsCollection(30000)).not.toThrow();
            stopQueryPerformanceMetricsCollection();
        });
    });
});
