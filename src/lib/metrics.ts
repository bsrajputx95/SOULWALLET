/**
 * Business Metrics Module
 * 
 * Provides Prometheus counters and histograms for business operations.
 * These metrics are used in Grafana dashboards and alerting rules.
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// Use the global default registry for all business metrics
const register = new Registry();

// =============================================================================
// AUTHENTICATION METRICS
// =============================================================================

/** Total authentication requests */
export const authRequestsTotal = new Counter({
    name: 'soulwallet_auth_requests_total',
    help: 'Total authentication requests',
    labelNames: ['method', 'status'] as const,
    registers: [register],
});

/** Successful authentication attempts */
export const authSuccessTotal = new Counter({
    name: 'soulwallet_auth_success_total',
    help: 'Successful authentication attempts',
    labelNames: ['method'] as const,
    registers: [register],
});

/** Failed authentication attempts */
export const authFailuresTotal = new Counter({
    name: 'soulwallet_auth_failures_total',
    help: 'Failed authentication attempts',
    labelNames: ['method', 'reason'] as const,
    registers: [register],
});

/** Authentication duration */
export const authDurationSeconds = new Histogram({
    name: 'soulwallet_auth_duration_seconds',
    help: 'Authentication request duration in seconds',
    labelNames: ['method'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [register],
});

/** Active sessions gauge */
export const activeSessionsGauge = new Gauge({
    name: 'soulwallet_active_sessions',
    help: 'Number of active user sessions',
    registers: [register],
});

// =============================================================================
// WALLET METRICS
// =============================================================================

/** Total wallet operations */
export const walletOperationsTotal = new Counter({
    name: 'soulwallet_wallet_operations_total',
    help: 'Total wallet operations',
    labelNames: ['operation', 'status'] as const,
    registers: [register],
});

/** Wallet operation duration */
export const walletOperationDurationSeconds = new Histogram({
    name: 'soulwallet_wallet_operation_duration_seconds',
    help: 'Wallet operation duration in seconds',
    labelNames: ['operation'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});

/** Linked wallets count */
export const linkedWalletsTotal = new Gauge({
    name: 'soulwallet_linked_wallets_total',
    help: 'Total number of linked wallets',
    registers: [register],
});

// =============================================================================
// COPY TRADING METRICS
// =============================================================================

/** Copy trading requests total */
export const copyTradingRequestsTotal = new Counter({
    name: 'soulwallet_copy_trading_requests_total',
    help: 'Total copy trading requests',
    labelNames: ['action', 'status'] as const,
    registers: [register],
});

/** Copy trading success rate */
export const copyTradingSuccessTotal = new Counter({
    name: 'soulwallet_copy_trading_success_total',
    help: 'Successful copy trading operations',
    labelNames: ['action'] as const,
    registers: [register],
});

/** Copy trading failures */
export const copyTradingFailuresTotal = new Counter({
    name: 'soulwallet_copy_trading_failures_total',
    help: 'Failed copy trading operations',
    labelNames: ['action', 'reason'] as const,
    registers: [register],
});

/** Copy trading operation duration */
export const copyTradingDurationSeconds = new Histogram({
    name: 'soulwallet_copy_trading_duration_seconds',
    help: 'Copy trading operation duration in seconds',
    labelNames: ['action'] as const,
    buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
    registers: [register],
});

/** Active copy positions gauge */
export const activeCopyPositionsGauge = new Gauge({
    name: 'soulwallet_active_copy_positions',
    help: 'Number of active copy trading positions',
    registers: [register],
});

/** Active followers gauge */
export const activeFollowersGauge = new Gauge({
    name: 'soulwallet_active_followers',
    help: 'Number of active followers',
    registers: [register],
});

// =============================================================================
// TRANSACTION METRICS
// =============================================================================

/** Total transactions processed */
export const transactionsTotal = new Counter({
    name: 'soulwallet_transactions_total',
    help: 'Total transactions processed',
    labelNames: ['type', 'status'] as const,
    registers: [register],
});

/** Transaction processing duration */
export const transactionDurationSeconds = new Histogram({
    name: 'soulwallet_transaction_duration_seconds',
    help: 'Transaction processing duration in seconds',
    labelNames: ['type'] as const,
    buckets: [0.5, 1, 2.5, 5, 10, 30, 60],
    registers: [register],
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Record an authentication attempt
 */
export function recordAuthAttempt(
    method: 'login' | 'register' | 'logout' | 'refresh' | '2fa',
    success: boolean,
    durationMs: number,
    failureReason?: string
) {
    const status = success ? 'success' : 'failure';
    authRequestsTotal.inc({ method, status });

    if (success) {
        authSuccessTotal.inc({ method });
    } else {
        authFailuresTotal.inc({ method, reason: failureReason || 'unknown' });
    }

    authDurationSeconds.observe({ method }, durationMs / 1000);
}

/**
 * Record a wallet operation
 */
export function recordWalletOperation(
    operation: 'link' | 'unlink' | 'verify' | 'balance' | 'transaction' | 'portfolio',
    success: boolean,
    durationMs: number
) {
    const status = success ? 'success' : 'failure';
    walletOperationsTotal.inc({ operation, status });
    walletOperationDurationSeconds.observe({ operation }, durationMs / 1000);
}

/**
 * Record a copy trading operation
 */
export function recordCopyTradingOperation(
    action: 'start' | 'stop' | 'modify' | 'execute' | 'profit_share',
    success: boolean,
    durationMs: number,
    failureReason?: string
) {
    const status = success ? 'success' : 'failure';
    copyTradingRequestsTotal.inc({ action, status });

    if (success) {
        copyTradingSuccessTotal.inc({ action });
    } else {
        copyTradingFailuresTotal.inc({ action, reason: failureReason || 'unknown' });
    }

    copyTradingDurationSeconds.observe({ action }, durationMs / 1000);
}

/**
 * Record a transaction
 */
export function recordTransaction(
    type: 'swap' | 'transfer' | 'stake' | 'unstake' | 'copy',
    success: boolean,
    durationMs: number
) {
    const status = success ? 'success' : 'failure';
    transactionsTotal.inc({ type, status });
    transactionDurationSeconds.observe({ type }, durationMs / 1000);
}

/**
 * Normalize route for low-cardinality metrics
 * Maps tRPC routes to procedure names and strips IDs from REST routes
 */
export function normalizeRoute(url: string, _method?: string): string {
    // Handle tRPC routes
    if (url.includes('/api/v1/trpc/')) {
        const match = url.match(/\/api\/v1\/trpc\/([^?]+)/);
        if (match && match[1]) {
            return `/api/v1/trpc/${match[1].split(',')[0]}`;
        }
        return '/api/v1/trpc/unknown';
    }
    if (url.includes('/api/trpc/')) {
        const match = url.match(/\/api\/trpc\/([^?]+)/);
        if (match && match[1]) {
            // Return just the procedure name without query params
            return `/api/trpc/${match[1].split(',')[0]}`;
        }
        return '/api/trpc/unknown';
    }

    // Handle common REST patterns - strip IDs
    const normalized: string = url
        .replace(/\/[a-f0-9]{24,}/gi, '/:id') // MongoDB ObjectIds
        .replace(/\/[0-9a-fA-F-]{36}/g, '/:uuid') // UUIDs
        .replace(/\/[0-9]+/g, '/:id') // Numeric IDs
        .replace(/\/[1-9A-HJ-NP-Za-km-z]{32,44}/g, '/:wallet') // Solana wallet addresses
        .split('?')[0] || url; // Remove query strings

    return normalized;
}

/**
 * Get the business metrics registry
 * This should be merged with the main metrics registry in fastify.ts
 */
export function getBusinessMetricsRegistry(): Registry {
    return register;
}

/**
 * Export all collected metrics as a single string
 */
export async function getBusinessMetrics(): Promise<string> {
    return register.metrics();
}

/**
 * Comment 4 Fix: Get combined metrics including query performance
 * This merges business metrics with database query performance metrics
 */
export async function getAllMetrics(): Promise<string> {
    const businessMetrics = await register.metrics();

    try {
        const { queryPerformanceService } = await import('./services/queryPerformance');
        const dbMetrics = await queryPerformanceService.getMetricsAsText();
        return businessMetrics + '\n' + dbMetrics;
    } catch (error) {
        // If query performance service fails, just return business metrics
        return businessMetrics;
    }
}

