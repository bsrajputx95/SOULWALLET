/**
 * Query Performance Monitoring Service
 * Provides query performance analytics using pg_stat_statements extension.
 * Enables slow query detection, N+1 problem identification, and performance metrics.
 * @module queryPerformance
 */

import prisma from '../prisma';
import { logger } from '../logger';
import { Gauge, Registry } from 'prom-client';

// Row type for pg_stat_statements queries
interface StatRow {
    query: string;
    calls: number | bigint;
    avgTimeMs: number;
    maxTimeMs: number;
    totalTimeMs: number;
    rows: number | bigint;
}

// Prometheus metrics for query performance
const queryPerformanceRegistry = new Registry();

const slowQueriesGauge = new Gauge({
    name: 'soulwallet_db_slow_queries_total',
    help: 'Total number of slow queries (>1s)',
    registers: [queryPerformanceRegistry],
});

const queryAvgTimeGauge = new Gauge({
    name: 'soulwallet_db_query_avg_time_ms',
    help: 'Average query execution time in milliseconds',
    registers: [queryPerformanceRegistry],
});

const n1ProblemsGauge = new Gauge({
    name: 'soulwallet_db_n1_problems_total',
    help: 'Number of potential N+1 query patterns detected',
    registers: [queryPerformanceRegistry],
});

const cacheHitRatioGauge = new Gauge({
    name: 'soulwallet_db_cache_hit_ratio',
    help: 'Database cache hit ratio (0-1)',
    registers: [queryPerformanceRegistry],
});

export interface QueryStats {
    queryid: bigint;
    query: string;
    calls: number;
    total_exec_time: number;
    mean_exec_time: number;
    min_exec_time: number;
    max_exec_time: number;
    rows: number;
    shared_blks_hit: number;
    shared_blks_read: number;
}

export interface SlowQuery {
    query: string;
    calls: number;
    avgTimeMs: number;
    maxTimeMs: number;
    totalTimeMs: number;
    rows: number;
}

export interface N1Problem {
    query: string;
    calls: number;
    avgTimeMs: number;
    totalTimeMs: number;
    callsPerSecond: number;
    severity: 'high' | 'medium' | 'low';
}

class QueryPerformanceService {
    private readonly DEFAULT_MIN_DURATION_MS = 1000; // 1 second
    private readonly N1_CALLS_THRESHOLD = 100; // Queries with >100 calls
    private readonly N1_AVG_TIME_THRESHOLD = 10; // Average time <10ms per call

    /**
     * Check if pg_stat_statements extension is available
     */
    async isExtensionAvailable(): Promise<boolean> {
        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements' LIMIT 1
      `;
            return result.length > 0;
        } catch (error) {
            logger.warn('pg_stat_statements extension not available', { error });
            return false;
        }
    }

    /**
     * Get queries that exceed the minimum duration threshold
     */
    async getSlowQueries(minDurationMs: number = this.DEFAULT_MIN_DURATION_MS): Promise<SlowQuery[]> {
        if (!(await this.isExtensionAvailable())) {
            return [];
        }

        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT 
          query,
          calls,
          mean_exec_time as "avgTimeMs",
          max_exec_time as "maxTimeMs",
          total_exec_time as "totalTimeMs",
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > ${minDurationMs}
        ORDER BY mean_exec_time DESC
        LIMIT 50
      `;

            // Update Prometheus metric
            slowQueriesGauge.set(result.length);

            return result.map((row: StatRow) => ({
                query: this.truncateQuery(row.query),
                calls: Number(row.calls),
                avgTimeMs: Number(row.avgTimeMs),
                maxTimeMs: Number(row.maxTimeMs),
                totalTimeMs: Number(row.totalTimeMs),
                rows: Number(row.rows),
            }));
        } catch (error) {
            logger.error('Failed to get slow queries', { error });
            return [];
        }
    }

    /**
     * Get top 20 queries by total execution time
     */
    async getTopQueriesByTime(): Promise<SlowQuery[]> {
        if (!(await this.isExtensionAvailable())) {
            return [];
        }

        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT 
          query,
          calls,
          mean_exec_time as "avgTimeMs",
          max_exec_time as "maxTimeMs",
          total_exec_time as "totalTimeMs",
          rows
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 20
      `;

            // Update average time gauge
            if (result.length > 0) {
                const avgTime = result.reduce((acc: number, r: StatRow) => acc + Number(r.avgTimeMs), 0) / result.length;
                queryAvgTimeGauge.set(avgTime);
            }

            return result.map((row: StatRow) => ({
                query: this.truncateQuery(row.query),
                calls: Number(row.calls),
                avgTimeMs: Number(row.avgTimeMs),
                maxTimeMs: Number(row.maxTimeMs),
                totalTimeMs: Number(row.totalTimeMs),
                rows: Number(row.rows),
            }));
        } catch (error) {
            logger.error('Failed to get top queries by time', { error });
            return [];
        }
    }

    /**
     * Get top 20 queries by call count
     */
    async getTopQueriesByCount(): Promise<SlowQuery[]> {
        if (!(await this.isExtensionAvailable())) {
            return [];
        }

        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT 
          query,
          calls,
          mean_exec_time as "avgTimeMs",
          max_exec_time as "maxTimeMs",
          total_exec_time as "totalTimeMs",
          rows
        FROM pg_stat_statements
        ORDER BY calls DESC
        LIMIT 20
      `;

            return result.map((row: StatRow) => ({
                query: this.truncateQuery(row.query),
                calls: Number(row.calls),
                avgTimeMs: Number(row.avgTimeMs),
                maxTimeMs: Number(row.maxTimeMs),
                totalTimeMs: Number(row.totalTimeMs),
                rows: Number(row.rows),
            }));
        } catch (error) {
            logger.error('Failed to get top queries by count', { error });
            return [];
        }
    }

    /**
     * Detect potential N+1 query problems
     * N+1 pattern: High call count with low individual execution time
     */
    async detectN1Problems(): Promise<N1Problem[]> {
        if (!(await this.isExtensionAvailable())) {
            return [];
        }

        try {
            // Get stats snapshot time for calculating calls per second
            const statsAge = await prisma.$queryRaw<any[]>`
        SELECT EXTRACT(EPOCH FROM (now() - stats_reset)) as age_seconds
        FROM pg_stat_statements_info
        LIMIT 1
      `;

            const ageSeconds = statsAge[0]?.age_seconds || 3600; // Default 1 hour

            const result = await prisma.$queryRaw<any[]>`
        SELECT 
          query,
          calls,
          mean_exec_time as "avgTimeMs",
          total_exec_time as "totalTimeMs"
        FROM pg_stat_statements
        WHERE calls > ${this.N1_CALLS_THRESHOLD}
          AND mean_exec_time < ${this.N1_AVG_TIME_THRESHOLD}
        ORDER BY calls DESC
        LIMIT 20
      `;

            const problems = result.map((row: { query: string; calls: number | bigint; avgTimeMs: number; totalTimeMs: number }) => {
                const callsPerSecond = Number(row.calls) / Number(ageSeconds);
                let severity: 'high' | 'medium' | 'low' = 'low';

                if (callsPerSecond > 10) severity = 'high';
                else if (callsPerSecond > 1) severity = 'medium';

                return {
                    query: this.truncateQuery(row.query),
                    calls: Number(row.calls),
                    avgTimeMs: Number(row.avgTimeMs),
                    totalTimeMs: Number(row.totalTimeMs),
                    callsPerSecond,
                    severity,
                };
            });

            // Update Prometheus metric
            n1ProblemsGauge.set(problems.filter((p: N1Problem) => p.severity === 'high').length);

            return problems;
        } catch (error) {
            logger.error('Failed to detect N+1 problems', { error });
            return [];
        }
    }

    /**
     * Get database cache hit ratio
     */
    async getCacheHitRatio(): Promise<number> {
        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT 
          CASE 
            WHEN (blks_hit + blks_read) = 0 THEN 1
            ELSE blks_hit::float / (blks_hit + blks_read)
          END as hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
      `;

            const ratio = Number(result[0]?.hit_ratio || 0);
            cacheHitRatioGauge.set(ratio);
            return ratio;
        } catch (error) {
            logger.error('Failed to get cache hit ratio', { error });
            return 0;
        }
    }

    /**
     * Get index usage statistics
     */
    async getIndexUsage(): Promise<any[]> {
        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT
          schemaname,
          relname as table_name,
          indexrelname as index_name,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 20
      `;

            return result;
        } catch (error) {
            logger.error('Failed to get index usage', { error });
            return [];
        }
    }

    /**
     * Get table bloat statistics
     */
    async getTableBloat(): Promise<any[]> {
        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT
          schemaname,
          relname as table_name,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          CASE WHEN n_live_tup > 0 
            THEN round(100 * n_dead_tup::numeric / n_live_tup, 2)
            ELSE 0 
          END as dead_ratio
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 0
        ORDER BY n_dead_tup DESC
        LIMIT 20
      `;

            return result;
        } catch (error) {
            logger.error('Failed to get table bloat', { error });
            return [];
        }
    }

    /**
     * Get long-running queries (currently executing)
     */
    async getLongRunningQueries(minSeconds: number = 5): Promise<any[]> {
        try {
            const result = await prisma.$queryRaw<any[]>`
        SELECT
          pid,
          now() - query_start as duration,
          state,
          query
        FROM pg_stat_activity
        WHERE state = 'active'
          AND query NOT LIKE '%pg_stat_activity%'
          AND query_start < now() - interval '${minSeconds} seconds'
        ORDER BY query_start ASC
        LIMIT 20
      `;

            return result.map((row) => ({
                ...row,
                query: this.truncateQuery(row.query),
            }));
        } catch (error) {
            logger.error('Failed to get long-running queries', { error });
            return [];
        }
    }

    /**
     * Reset pg_stat_statements statistics (admin only)
     */
    async resetStats(): Promise<boolean> {
        if (!(await this.isExtensionAvailable())) {
            return false;
        }

        try {
            await prisma.$executeRaw`SELECT pg_stat_statements_reset()`;
            logger.info('pg_stat_statements statistics reset');
            return true;
        } catch (error) {
            logger.error('Failed to reset pg_stat_statements', { error });
            return false;
        }
    }

    /**
     * Get comprehensive performance summary
     */
    async getPerformanceSummary(): Promise<{
        slowQueries: SlowQuery[];
        topByTime: SlowQuery[];
        n1Problems: N1Problem[];
        cacheHitRatio: number;
        extensionAvailable: boolean;
    }> {
        const extensionAvailable = await this.isExtensionAvailable();

        if (!extensionAvailable) {
            return {
                slowQueries: [],
                topByTime: [],
                n1Problems: [],
                cacheHitRatio: 0,
                extensionAvailable: false,
            };
        }

        const [slowQueries, topByTime, n1Problems, cacheHitRatio] = await Promise.all([
            this.getSlowQueries(),
            this.getTopQueriesByTime(),
            this.detectN1Problems(),
            this.getCacheHitRatio(),
        ]);

        return {
            slowQueries,
            topByTime,
            n1Problems,
            cacheHitRatio,
            extensionAvailable: true,
        };
    }

    /**
     * Truncate long query strings for display
     */
    private truncateQuery(query: string, maxLength: number = 200): string {
        if (!query) return '';
        query = query.replace(/\s+/g, ' ').trim();
        if (query.length <= maxLength) return query;
        return query.substring(0, maxLength) + '...';
    }

    /**
     * Get Prometheus metrics registry for query performance
     */
    getMetricsRegistry(): Registry {
        return queryPerformanceRegistry;
    }

    /**
     * Comment 4 Fix: Collect and update all metrics (call periodically)
     * This populates the Prometheus gauges so they can be scraped
     */
    async collectMetrics(): Promise<void> {
        try {
            await Promise.all([
                this.getSlowQueries(),      // Updates slowQueriesGauge
                this.getTopQueriesByTime(), // Updates queryAvgTimeGauge
                this.detectN1Problems(),    // Updates n1ProblemsGauge
                this.getCacheHitRatio(),    // Updates cacheHitRatioGauge
            ]);
        } catch (error) {
            logger.error('Failed to collect query performance metrics', { error });
        }
    }

    /**
     * Comment 4 Fix: Export metrics as Prometheus text format
     * Call this from the /metrics endpoint to include DB metrics
     */
    async getMetricsAsText(): Promise<string> {
        await this.collectMetrics();
        return queryPerformanceRegistry.metrics();
    }
}

export const queryPerformanceService = new QueryPerformanceService();

/**
 * Comment 4 Fix: Start periodic metrics collection
 * Collects query performance metrics every 60 seconds for Prometheus scraping
 */
let metricsCollectionInterval: ReturnType<typeof setInterval> | null = null;

export function startQueryPerformanceMetricsCollection(intervalMs: number = 60000): void {
    if (metricsCollectionInterval) {
        clearInterval(metricsCollectionInterval);
    }

    // Initial collection
    queryPerformanceService.collectMetrics().catch(err =>
        logger.error('Initial query performance metrics collection failed', { error: err })
    );

    // Periodic collection
    metricsCollectionInterval = setInterval(() => {
        queryPerformanceService.collectMetrics().catch(err =>
            logger.error('Periodic query performance metrics collection failed', { error: err })
        );
    }, intervalMs);

    logger.info(`[QueryPerformance] Metrics collection started (interval: ${intervalMs}ms)`);
}

export function stopQueryPerformanceMetricsCollection(): void {
    if (metricsCollectionInterval) {
        clearInterval(metricsCollectionInterval);
        metricsCollectionInterval = null;
        logger.info('[QueryPerformance] Metrics collection stopped');
    }
}

