/**
 * Adaptive Rate Limiter
 * 
 * Extends rate limiting with attack detection and automatic limit adjustment.
 * - Monitor rate limit violations per endpoint
 * - Detect attack patterns (>10% violation rate in 5 minutes)
 * - Automatically reduce limits by 50% during attacks
 * - Restore normal limits after 30 minutes of normal traffic
 * - Integrate with security monitor and alert manager
 */

import Redis from 'ioredis'
import { logger } from '../logger'
import { securityMonitor } from '../services/securityMonitor'
import { alertManager } from '../services/alertManager'
import { RATE_LIMIT_CONFIGS } from './rateLimit'

// Configuration
const ATTACK_DETECTION_THRESHOLD = parseFloat(process.env.ATTACK_DETECTION_THRESHOLD || '0.10') // 10%
const ATTACK_DETECTION_WINDOW_MINUTES = parseInt(process.env.ATTACK_DETECTION_WINDOW_MINUTES || '5')
const ADAPTATION_RESTORE_MINUTES = parseInt(process.env.ADAPTATION_RESTORE_MINUTES || '30')
const ENABLED = process.env.ENABLE_ADAPTIVE_RATE_LIMITING !== 'false'

type EndpointName = keyof typeof RATE_LIMIT_CONFIGS

interface EndpointMetrics {
    totalRequests: number
    violations: number
    windowStart: number
    adapted: boolean
    adaptedAt: number | null
    adaptationFactor: number
}

export interface AdaptiveState {
    endpoint: string
    adapted: boolean
    adaptationFactor: number
    adaptedAt: number | null
    violationRate: number
    restoredAt: number | null
}

class AdaptiveRateLimiter {
    private redis: Redis | null = null
    private metrics: Map<string, EndpointMetrics> = new Map()
    private windowDurationMs: number
    private restoreDurationMs: number
    private monitorTimer: NodeJS.Timeout | null = null

    constructor() {
        this.windowDurationMs = ATTACK_DETECTION_WINDOW_MINUTES * 60 * 1000
        this.restoreDurationMs = ADAPTATION_RESTORE_MINUTES * 60 * 1000
        void this.initRedis()
        this.initMetrics()
        this.startMonitorLoop()
    }

    private async initRedis(): Promise<void> {
        const redisUrl = process.env.REDIS_URL
        if (!redisUrl) return

        try {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            })
            await this.redis.connect()
        } catch (error) {
            logger.warn('[AdaptiveRateLimiter] Redis connection failed', { error })
            this.redis = null
        }
    }

    private initMetrics(): void {
        for (const endpoint of Object.keys(RATE_LIMIT_CONFIGS)) {
            this.metrics.set(endpoint, {
                totalRequests: 0,
                violations: 0,
                windowStart: Date.now(),
                adapted: false,
                adaptedAt: null,
                adaptationFactor: 1,
            })
        }
    }

    private startMonitorLoop(): void {
        if (!ENABLED) return
        if (this.monitorTimer) return

        // Check for attack patterns every minute
        this.monitorTimer = setInterval(() => {
            this.checkAttackPatterns()
            this.checkRestoration()
        }, 60_000)
        this.monitorTimer.unref?.()
    }

    /**
     * Check if adaptive rate limiting is enabled
     */
    isEnabled(): boolean {
        return ENABLED
    }

    /**
     * Track a request for an endpoint
     */
    trackRequest(endpoint: EndpointName): void {
        if (!ENABLED) return

        const metrics = this.metrics.get(endpoint)
        if (!metrics) return

        this.resetWindowIfNeeded(metrics)
        metrics.totalRequests++

        // Store in Redis if available
        if (this.redis) {
            const key = `adaptive:endpoint:${endpoint}:requests`
            this.redis.incr(key).catch(() => { })
            this.redis.expire(key, ATTACK_DETECTION_WINDOW_MINUTES * 60 + 60).catch(() => { })
        }
    }

    /**
     * Track a rate limit violation
     */
    trackViolation(endpoint: EndpointName, context: { ip: string | undefined; userId: string | undefined }): void {
        if (!ENABLED) return

        const metrics = this.metrics.get(endpoint)
        if (!metrics) return

        this.resetWindowIfNeeded(metrics)
        metrics.violations++

        // Log to security monitor
        securityMonitor.recordEvent('LIMIT_VIOLATION', context.userId, {
            endpoint,
            ip: context.ip,
            violations: metrics.violations,
            totalRequests: metrics.totalRequests,
        })

        // Store in Redis if available
        if (this.redis) {
            const key = `adaptive:endpoint:${endpoint}:violations`
            this.redis.incr(key).catch(() => { })
            this.redis.expire(key, ATTACK_DETECTION_WINDOW_MINUTES * 60 + 60).catch(() => { })
        }
    }

    /**
     * Get adaptation factor for an endpoint
     * Returns < 1 if under attack (e.g., 0.5 = 50% reduction)
     */
    getAdaptationFactor(endpoint: EndpointName): number {
        if (!ENABLED) return 1

        const metrics = this.metrics.get(endpoint)
        return metrics?.adaptationFactor ?? 1
    }

    /**
     * Get adapted points for an endpoint
     */
    getAdaptedPoints(endpoint: EndpointName): number {
        const config = RATE_LIMIT_CONFIGS[endpoint]
        const factor = this.getAdaptationFactor(endpoint)
        return Math.max(1, Math.floor(config.points * factor))
    }

    /**
     * Check if an endpoint is under attack
     */
    async isUnderAttack(endpoint: EndpointName): Promise<boolean> {
        const metrics = this.metrics.get(endpoint)
        if (!metrics) return false

        this.resetWindowIfNeeded(metrics)
        return metrics.adapted
    }

    /**
     * Get violation rate for an endpoint
     */
    getViolationRate(endpoint: EndpointName): number {
        const metrics = this.metrics.get(endpoint)
        if (!metrics || metrics.totalRequests === 0) return 0

        this.resetWindowIfNeeded(metrics)
        return metrics.violations / metrics.totalRequests
    }

    /**
     * Check all endpoints for attack patterns
     */
    private checkAttackPatterns(): void {
        for (const [endpoint, metrics] of this.metrics) {
            this.resetWindowIfNeeded(metrics)

            // Need minimum sample size
            if (metrics.totalRequests < 20) continue

            const violationRate = metrics.violations / metrics.totalRequests

            if (violationRate > ATTACK_DETECTION_THRESHOLD && !metrics.adapted) {
                // Attack detected! Adapt limits
                void this.adaptLimits(endpoint as EndpointName, 0.5)
            }
        }
    }

    /**
     * Check if any adapted endpoints can be restored
     */
    private checkRestoration(): void {
        for (const [endpoint, metrics] of this.metrics) {
            if (!metrics.adapted || !metrics.adaptedAt) continue

            const timeSinceAdaption = Date.now() - metrics.adaptedAt

            // Check if enough time has passed and violation rate is low
            if (timeSinceAdaption >= this.restoreDurationMs) {
                this.resetWindowIfNeeded(metrics)

                const violationRate = metrics.totalRequests > 0 ? metrics.violations / metrics.totalRequests : 0

                // Restore if violation rate is below 5%
                if (violationRate < ATTACK_DETECTION_THRESHOLD / 2) {
                    void this.restoreNormalLimits(endpoint as EndpointName)
                }
            }
        }
    }

    /**
     * Adapt limits for an endpoint under attack
     */
    private async adaptLimits(endpoint: EndpointName, factor: number): Promise<void> {
        const metrics = this.metrics.get(endpoint)
        if (!metrics) return

        metrics.adapted = true
        metrics.adaptedAt = Date.now()
        metrics.adaptationFactor = factor

        // Store in Redis
        if (this.redis) {
            await this.redis.hset(`adaptive:endpoint:${endpoint}:state`, {
                adapted: 'true',
                adaptedAt: Date.now().toString(),
                adaptationFactor: factor.toString(),
            })
        }

        logger.warn('[AdaptiveRateLimiter] Attack detected, adapting limits', {
            endpoint,
            factor,
            violationRate: this.getViolationRate(endpoint),
        })

        // Send critical alert
        await alertManager.sendAlert(
            'ATTACK_DETECTED',
            'CRITICAL',
            `Rate limit attack detected on ${endpoint}. Limits reduced by ${(1 - factor) * 100}%`,
            {
                endpoint,
                adaptationFactor: factor,
                violationRate: this.getViolationRate(endpoint),
                originalPoints: RATE_LIMIT_CONFIGS[endpoint].points,
                adaptedPoints: this.getAdaptedPoints(endpoint),
            }
        )

        // Record in security monitor
        securityMonitor.recordEvent('HIGH_FREQUENCY_USER', undefined, {
            type: 'ADAPTIVE_RATE_LIMIT_ACTIVATED',
            endpoint,
            factor,
        })
    }

    /**
     * Restore normal limits for an endpoint
     */
    private async restoreNormalLimits(endpoint: EndpointName): Promise<void> {
        const metrics = this.metrics.get(endpoint)
        if (!metrics) return

        const wasAdapted = metrics.adapted
        metrics.adapted = false
        metrics.adaptedAt = null
        metrics.adaptationFactor = 1

        // Store in Redis
        if (this.redis) {
            await this.redis.hset(`adaptive:endpoint:${endpoint}:state`, {
                adapted: 'false',
                adaptedAt: '',
                adaptationFactor: '1',
            })
        }

        if (wasAdapted) {
            logger.info('[AdaptiveRateLimiter] Restored normal limits', { endpoint })

            await alertManager.sendAlert(
                'ADAPTIVE_RATE_LIMIT_RESTORED',
                'INFO',
                `Normal rate limits restored for ${endpoint}`,
                {
                    endpoint,
                    currentViolationRate: this.getViolationRate(endpoint),
                }
            )
        }
    }

    /**
     * Reset metric window if expired
     */
    private resetWindowIfNeeded(metrics: EndpointMetrics): void {
        if (Date.now() - metrics.windowStart > this.windowDurationMs) {
            metrics.totalRequests = 0
            metrics.violations = 0
            metrics.windowStart = Date.now()
        }
    }

    /**
     * Get state for all endpoints (for monitoring)
     */
    getAllStates(): AdaptiveState[] {
        const states: AdaptiveState[] = []

        for (const [endpoint, metrics] of this.metrics) {
            this.resetWindowIfNeeded(metrics)

            states.push({
                endpoint,
                adapted: metrics.adapted,
                adaptationFactor: metrics.adaptationFactor,
                adaptedAt: metrics.adaptedAt,
                violationRate: metrics.totalRequests > 0 ? metrics.violations / metrics.totalRequests : 0,
                restoredAt: null,
            })
        }

        return states
    }

    /**
     * Get metrics for monitoring
     */
    getMetrics(): {
        enabled: boolean
        attackThreshold: number
        windowMinutes: number
        restoreMinutes: number
        endpointsUnderAttack: string[]
        totalViolations: number
        totalRequests: number
    } {
        let totalViolations = 0
        let totalRequests = 0
        const endpointsUnderAttack: string[] = []

        for (const [endpoint, metrics] of this.metrics) {
            this.resetWindowIfNeeded(metrics)
            totalViolations += metrics.violations
            totalRequests += metrics.totalRequests
            if (metrics.adapted) {
                endpointsUnderAttack.push(endpoint)
            }
        }

        return {
            enabled: ENABLED,
            attackThreshold: ATTACK_DETECTION_THRESHOLD,
            windowMinutes: ATTACK_DETECTION_WINDOW_MINUTES,
            restoreMinutes: ADAPTATION_RESTORE_MINUTES,
            endpointsUnderAttack,
            totalViolations,
            totalRequests,
        }
    }

    /**
     * Manually trigger adaptation (admin function)
     */
    async manualAdapt(endpoint: EndpointName, factor: number): Promise<void> {
        await this.adaptLimits(endpoint, factor)
    }

    /**
     * Manually restore limits (admin function)
     */
    async manualRestore(endpoint: EndpointName): Promise<void> {
        await this.restoreNormalLimits(endpoint)
    }
}

// Singleton instance
export const adaptiveRateLimiter = new AdaptiveRateLimiter()
