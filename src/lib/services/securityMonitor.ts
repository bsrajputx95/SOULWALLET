/**
 * Security Monitor Service
 * 
 * Real-time security monitoring for blockchain operations:
 * - Track failed simulations (alert if >5% failure rate)
 * - Monitor RPC failover events
 * - Detect unusual transaction patterns
 * - Alert on replay attack attempts
 * - Monitor gas price spikes
 * - Behavioral anomaly detection
 * - Auto-ban on exploit attempts
 * - Root/jailbreak device tracking
 */

import { logger } from '../logger'
import { EventEmitter } from 'events'

// Types
export type SecurityEventType =
    | 'SIMULATION_FAILED'
    | 'SIMULATION_SUCCESS'
    | 'RPC_FAILOVER'
    | 'RPC_HEALTHY'
    | 'REPLAY_ATTEMPT'
    | 'HIGH_GAS_PRICE'
    | 'LARGE_TRANSACTION'
    | 'HIGH_FREQUENCY_USER'
    | 'SLIPPAGE_VIOLATION'
    | 'TRANSACTION_TIMEOUT'
    | 'MEV_PROTECTION_USED'
    | 'LIMIT_VIOLATION'
    // New security event types
    | 'ROOT_DEVICE_DETECTED'
    | 'DEBUGGER_DETECTED'
    | 'EMULATOR_DETECTED'
    | 'FRIDA_DETECTED'
    | 'APK_TAMPERED'
    | 'EXPLOIT_ATTEMPT'
    | 'BEHAVIORAL_ANOMALY'
    | 'GEO_ANOMALY'
    | 'DEVICE_SWITCH'
    | 'AUTO_BAN_TRIGGERED'

export interface SecurityEvent {
    type: SecurityEventType
    userId: string | undefined
    timestamp: number
    data: Record<string, unknown>
}

interface MetricWindow {
    count: number
    failures: number
    startTime: number
}

interface AlertThresholds {
    simulationFailureRate: number // Alert if failure rate exceeds this (0.05 = 5%)
    rpcDowntimeMinutes: number // Alert if primary RPC down > this
    largeTransactionUsd: number // Alert for transactions over this amount
    highFrequencyPerMinute: number // Alert if user exceeds this tx count/min
    gasSpikeMulitplier: number // Alert if gas > average * this
}

export interface SecurityMetrics {
    simulationSuccessRate: number
    rpcHealthy: boolean
    primaryRpcDownSince: number | null
    averageTransactionTime: number
    failedTransactionRate: number
    mevProtectionUsageRate: number
    replayAttemptsBlocked: number
    slippageViolations: number
}

interface AlertHandler {
    (event: SecurityEvent, message: string): void
}

class SecurityMonitor extends EventEmitter {
    private events: SecurityEvent[] = []
    private maxEvents = 10000
    private simulationWindow: MetricWindow = { count: 0, failures: 0, startTime: Date.now() }
    private transactionWindow: MetricWindow = { count: 0, failures: 0, startTime: Date.now() }
    private windowDurationMs = 5 * 60 * 1000 // 5-minute window
    private userTxCounts: Map<string, { count: number; windowStart: number }> = new Map()
    private recentGasPrices: number[] = []
    private maxGasPrices = 100
    private primaryRpcDownSince: number | null = null
    private replayAttemptsBlocked = 0
    private slippageViolations = 0
    private mevUsed = 0
    private totalTransactions = 0
    private alertHandlers: AlertHandler[] = []
    private cleanupTimer: NodeJS.Timeout | null = null

    private thresholds: AlertThresholds = {
        simulationFailureRate: 0.05, // 5%
        rpcDowntimeMinutes: 5,
        largeTransactionUsd: 10000,
        highFrequencyPerMinute: 20,
        gasSpikeMulitplier: 3,
    }

    constructor() {
        super()
        this.startCleanupLoop()
    }

    /**
     * Register an alert handler for security events
     */
    onAlert(handler: AlertHandler): void {
        this.alertHandlers.push(handler)
    }

    /**
     * Record a security event
     */
    recordEvent(type: SecurityEventType, userId: string | undefined, data: Record<string, unknown> = {}): void {
        const event: SecurityEvent = {
            type,
            userId,
            timestamp: Date.now(),
            data,
        }

        this.events.push(event)
        this.emit('event', event)
        this.processEvent(event)

        // Trim old events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents / 2)
        }
    }

    /**
     * Process event and trigger alerts if needed
     */
    private processEvent(event: SecurityEvent): void {
        switch (event.type) {
            case 'SIMULATION_SUCCESS':
                this.resetWindowIfNeeded(this.simulationWindow)
                this.simulationWindow.count++
                break

            case 'SIMULATION_FAILED':
                this.resetWindowIfNeeded(this.simulationWindow)
                this.simulationWindow.count++
                this.simulationWindow.failures++
                this.checkSimulationFailureRate()
                break

            case 'RPC_FAILOVER':
                if (this.primaryRpcDownSince === null) {
                    this.primaryRpcDownSince = Date.now()
                }
                logger.warn('RPC failover detected', event.data)
                break

            case 'RPC_HEALTHY':
                if (this.primaryRpcDownSince !== null) {
                    const downtimeMs = Date.now() - this.primaryRpcDownSince
                    if (downtimeMs > this.thresholds.rpcDowntimeMinutes * 60 * 1000) {
                        this.triggerAlert(event, `RPC was down for ${Math.round(downtimeMs / 1000 / 60)} minutes`)
                    }
                    this.primaryRpcDownSince = null
                }
                break

            case 'REPLAY_ATTEMPT':
                this.replayAttemptsBlocked++
                this.triggerAlert(event, `Replay attack attempt blocked for user ${event.userId}`)
                logger.warn('Replay attack attempt blocked', { userId: event.userId, ...event.data })
                break

            case 'HIGH_GAS_PRICE': {
                const gasPrice = event.data.gasPrice as number
                this.recentGasPrices.push(gasPrice)
                if (this.recentGasPrices.length > this.maxGasPrices) {
                    this.recentGasPrices.shift()
                }
                this.checkGasSpike(gasPrice, event)
                break
            }

            case 'LARGE_TRANSACTION': {
                const amount = event.data.amountUsd as number
                if (amount > this.thresholds.largeTransactionUsd) {
                    this.triggerAlert(event, `Large transaction detected: $${amount.toFixed(2)}`)
                }
                break
            }

            case 'HIGH_FREQUENCY_USER':
                this.checkHighFrequency(event)
                break

            case 'SLIPPAGE_VIOLATION':
                this.slippageViolations++
                this.triggerAlert(event, `Slippage violation: ${event.data.slippage}% exceeds 5% max`)
                break

            case 'TRANSACTION_TIMEOUT':
                this.resetWindowIfNeeded(this.transactionWindow)
                this.transactionWindow.count++
                this.transactionWindow.failures++
                break

            case 'MEV_PROTECTION_USED':
                this.mevUsed++
                this.totalTransactions++
                break

            case 'LIMIT_VIOLATION':
                this.triggerAlert(event, `Transaction limit violation: ${event.data.reason}`)
                break
        }
    }

    /**
     * Check and alert on simulation failure rate
     */
    private checkSimulationFailureRate(): void {
        if (this.simulationWindow.count < 20) return // Need minimum sample size

        const failureRate = this.simulationWindow.failures / this.simulationWindow.count
        if (failureRate > this.thresholds.simulationFailureRate) {
            const event = this.events[this.events.length - 1]
            if (event) {
                this.triggerAlert(
                    event,
                    `Simulation failure rate ${(failureRate * 100).toFixed(1)}% exceeds ${this.thresholds.simulationFailureRate * 100}% threshold`
                )
            }
        }
    }

    /**
     * Check for gas price spikes
     */
    private checkGasSpike(currentGas: number, event: SecurityEvent): void {
        if (this.recentGasPrices.length < 10) return

        const avgGas = this.recentGasPrices.reduce((a, b) => a + b, 0) / this.recentGasPrices.length
        if (currentGas > avgGas * this.thresholds.gasSpikeMulitplier) {
            this.triggerAlert(event, `Gas price spike: ${currentGas} lamports (${(currentGas / avgGas).toFixed(1)}x average)`)
        }
    }

    /**
     * Check for high-frequency user activity
     */
    private checkHighFrequency(event: SecurityEvent): void {
        const userId = event.userId
        if (!userId) return

        const now = Date.now()
        const userRecord = this.userTxCounts.get(userId)

        if (!userRecord || now - userRecord.windowStart > 60_000) {
            this.userTxCounts.set(userId, { count: 1, windowStart: now })
            return
        }

        userRecord.count++
        if (userRecord.count > this.thresholds.highFrequencyPerMinute) {
            this.triggerAlert(event, `High frequency activity: user ${userId} made ${userRecord.count} transactions in 1 minute`)
        }
    }

    /**
     * Reset metric window if expired
     */
    private resetWindowIfNeeded(window: MetricWindow): void {
        if (Date.now() - window.startTime > this.windowDurationMs) {
            window.count = 0
            window.failures = 0
            window.startTime = Date.now()
        }
    }

    /**
     * Trigger an alert
     */
    private triggerAlert(event: SecurityEvent, message: string): void {
        logger.error(`[SECURITY ALERT] ${message}`, { event })
        this.emit('alert', event, message)

        for (const handler of this.alertHandlers) {
            try {
                handler(event, message)
            } catch (err) {
                logger.error('Alert handler error:', err)
            }
        }
    }

    /**
     * Get current security metrics
     */
    getMetrics(): SecurityMetrics {
        this.resetWindowIfNeeded(this.simulationWindow)
        this.resetWindowIfNeeded(this.transactionWindow)

        const simulationSuccessRate =
            this.simulationWindow.count > 0 ? 1 - this.simulationWindow.failures / this.simulationWindow.count : 1

        const failedTransactionRate =
            this.transactionWindow.count > 0 ? this.transactionWindow.failures / this.transactionWindow.count : 0

        const avgTxTimes = this.events
            .filter((e) => e.type === 'SIMULATION_SUCCESS' && e.data.durationMs)
            .slice(-50)
            .map((e) => e.data.durationMs as number)

        const averageTransactionTime = avgTxTimes.length > 0 ? avgTxTimes.reduce((a, b) => a + b, 0) / avgTxTimes.length : 0

        const mevProtectionUsageRate = this.totalTransactions > 0 ? this.mevUsed / this.totalTransactions : 0

        return {
            simulationSuccessRate,
            rpcHealthy: this.primaryRpcDownSince === null,
            primaryRpcDownSince: this.primaryRpcDownSince,
            averageTransactionTime,
            failedTransactionRate,
            mevProtectionUsageRate,
            replayAttemptsBlocked: this.replayAttemptsBlocked,
            slippageViolations: this.slippageViolations,
        }
    }

    /**
     * Get recent security events
     */
    getRecentEvents(count = 100, type?: SecurityEventType): SecurityEvent[] {
        let filtered = this.events
        if (type) {
            filtered = filtered.filter((e) => e.type === type)
        }
        return filtered.slice(-count)
    }

    /**
     * Get events for a specific user
     */
    getUserEvents(userId: string, count = 50): SecurityEvent[] {
        return this.events.filter((e) => e.userId === userId).slice(-count)
    }

    /**
     * Periodic cleanup of old data
     */
    private startCleanupLoop(): void {
        if (process.env.NODE_ENV === 'test') return
        if (this.cleanupTimer) return
        this.cleanupTimer = setInterval(() => {
            // Cleanup old user tx counts
            const now = Date.now()
            for (const [userId, record] of this.userTxCounts) {
                if (now - record.windowStart > 5 * 60 * 1000) {
                    this.userTxCounts.delete(userId)
                }
            }

            // Trim events older than 1 hour
            const oneHourAgo = now - 60 * 60 * 1000
            this.events = this.events.filter((e) => e.timestamp > oneHourAgo)
        }, 60_000) // Every minute
        this.cleanupTimer.unref?.()
    }

    /**
     * Check RPC downtime and alert if needed (call periodically)
     */
    checkRpcDowntime(): void {
        if (this.primaryRpcDownSince !== null) {
            const downtimeMs = Date.now() - this.primaryRpcDownSince
            if (downtimeMs > this.thresholds.rpcDowntimeMinutes * 60 * 1000) {
                const event: SecurityEvent = {
                    type: 'RPC_FAILOVER',
                    userId: undefined,
                    timestamp: Date.now(),
                    data: { downtimeMinutes: Math.round(downtimeMs / 1000 / 60) },
                }
                this.triggerAlert(event, `Primary RPC has been down for ${Math.round(downtimeMs / 1000 / 60)} minutes`)
            }
        }
    }
}

export const securityMonitor = new SecurityMonitor()

// ============================================
// BEHAVIORAL ANOMALY DETECTION
// ============================================

interface UserBehaviorProfile {
    userId: string
    avgTransactionAmount: number
    avgTransactionsPerDay: number
    typicalActiveHours: number[] // 0-23
    typicalTokens: string[]
    lastKnownLocation?: string
    lastDeviceId?: string
    lastActivityTime: number
    riskScore: number
}

interface AnomalyCheckResult {
    isAnomaly: boolean
    anomalyScore: number // 0-100
    reasons: string[]
    action: 'allow' | 'require_2fa' | 'block'
}

// In-memory user behavior profiles (in production, use Redis/DB)
const userProfiles: Map<string, UserBehaviorProfile> = new Map()

// Exploit attempt tracking
const exploitAttempts: Map<string, { count: number; lastAttempt: number }> = new Map()

// Auto-ban list (in production, use DB)
const bannedUsers: Map<string, { reason: string; bannedAt: number; expiresAt: number | null }> = new Map()

/**
 * Check if user is banned
 */
export function isUserBanned(userId: string): { banned: boolean; reason?: string; expiresAt?: number | null } {
    const ban = bannedUsers.get(userId)
    if (!ban) return { banned: false }
    
    // Check if ban expired
    if (ban.expiresAt && Date.now() > ban.expiresAt) {
        bannedUsers.delete(userId)
        return { banned: false }
    }
    
    return { banned: true, reason: ban.reason, expiresAt: ban.expiresAt }
}

/**
 * Ban a user
 */
export function banUser(userId: string, reason: string, durationMs?: number): void {
    const expiresAt = durationMs ? Date.now() + durationMs : null
    bannedUsers.set(userId, { reason, bannedAt: Date.now(), expiresAt })
    
    securityMonitor.recordEvent('AUTO_BAN_TRIGGERED', userId, {
        reason,
        expiresAt,
        permanent: !durationMs,
    })
    
    logger.error(`[SECURITY] User banned: ${userId}`, { reason, expiresAt })
}

/**
 * Record exploit attempt and auto-ban if threshold exceeded
 */
export function recordExploitAttempt(userId: string, exploitType: string): void {
    const record = exploitAttempts.get(userId) || { count: 0, lastAttempt: 0 }
    
    // Reset count if last attempt was >1 hour ago
    if (Date.now() - record.lastAttempt > 60 * 60 * 1000) {
        record.count = 0
    }
    
    record.count++
    record.lastAttempt = Date.now()
    exploitAttempts.set(userId, record)
    
    securityMonitor.recordEvent('EXPLOIT_ATTEMPT', userId, { exploitType, attemptCount: record.count })
    
    // Auto-ban after 3 exploit attempts
    if (record.count >= 3) {
        banUser(userId, `Multiple exploit attempts: ${exploitType}`, 24 * 60 * 60 * 1000) // 24-hour ban
    }
}

/**
 * Record root/jailbreak device detection
 */
export function recordRootedDevice(userId: string, deviceInfo: Record<string, unknown>): void {
    securityMonitor.recordEvent('ROOT_DEVICE_DETECTED', userId, deviceInfo)
    
    // Update user profile risk score
    const profile = userProfiles.get(userId)
    if (profile) {
        profile.riskScore = Math.min(100, profile.riskScore + 30)
    }
    
    logger.warn(`[SECURITY] Rooted device detected for user: ${userId}`, deviceInfo)
}

/**
 * Record debugger/Frida detection
 */
export function recordDebuggerDetected(userId: string, debuggerType: string): void {
    securityMonitor.recordEvent('DEBUGGER_DETECTED', userId, { debuggerType })
    
    // This is a serious security event - consider immediate action
    recordExploitAttempt(userId, `debugger_${debuggerType}`)
    
    logger.error(`[SECURITY] Debugger detected for user: ${userId}`, { debuggerType })
}

/**
 * Record APK tampering detection
 */
export function recordApkTampered(userId: string, signatureInfo: Record<string, unknown>): void {
    securityMonitor.recordEvent('APK_TAMPERED', userId, signatureInfo)
    
    // APK tampering is a critical security event - immediate ban
    banUser(userId, 'APK tampering detected', null) // Permanent ban
    
    logger.error(`[SECURITY] APK tampering detected for user: ${userId}`, signatureInfo)
}

/**
 * Check for behavioral anomalies
 */
export function checkBehavioralAnomaly(
    userId: string,
    transactionAmount: number,
    tokenSymbol: string,
    deviceId?: string,
    location?: string
): AnomalyCheckResult {
    const profile = userProfiles.get(userId)
    const reasons: string[] = []
    let anomalyScore = 0
    
    if (!profile) {
        // New user, create profile
        userProfiles.set(userId, {
            userId,
            avgTransactionAmount: transactionAmount,
            avgTransactionsPerDay: 1,
            typicalActiveHours: [new Date().getHours()],
            typicalTokens: [tokenSymbol],
            lastKnownLocation: location,
            lastDeviceId: deviceId,
            lastActivityTime: Date.now(),
            riskScore: 0,
        })
        return { isAnomaly: false, anomalyScore: 0, reasons: [], action: 'allow' }
    }
    
    // Check 1: Transaction amount anomaly (>10x average)
    if (transactionAmount > profile.avgTransactionAmount * 10) {
        anomalyScore += 30
        reasons.push(`Transaction ${transactionAmount} is ${(transactionAmount / profile.avgTransactionAmount).toFixed(1)}x average`)
    }
    
    // Check 2: Unusual hour
    const currentHour = new Date().getHours()
    if (!profile.typicalActiveHours.includes(currentHour)) {
        anomalyScore += 10
        reasons.push(`Unusual activity hour: ${currentHour}`)
    }
    
    // Check 3: New token (not in typical tokens)
    if (!profile.typicalTokens.includes(tokenSymbol)) {
        anomalyScore += 5
        // Add to typical tokens if not anomalous overall
    }
    
    // Check 4: Device switch
    if (deviceId && profile.lastDeviceId && deviceId !== profile.lastDeviceId) {
        anomalyScore += 20
        reasons.push('Device changed since last activity')
        securityMonitor.recordEvent('DEVICE_SWITCH', userId, {
            oldDevice: profile.lastDeviceId,
            newDevice: deviceId,
        })
    }
    
    // Check 5: Geo anomaly (impossible travel)
    if (location && profile.lastKnownLocation && location !== profile.lastKnownLocation) {
        const timeSinceLastActivity = Date.now() - profile.lastActivityTime
        // If location changed and last activity was <1 hour ago, flag as suspicious
        if (timeSinceLastActivity < 60 * 60 * 1000) {
            anomalyScore += 40
            reasons.push(`Location changed from ${profile.lastKnownLocation} to ${location} in ${Math.round(timeSinceLastActivity / 60000)} minutes`)
            securityMonitor.recordEvent('GEO_ANOMALY', userId, {
                oldLocation: profile.lastKnownLocation,
                newLocation: location,
                timeDiffMinutes: Math.round(timeSinceLastActivity / 60000),
            })
        }
    }
    
    // Add base risk score from profile
    anomalyScore += profile.riskScore * 0.3
    
    // Determine action
    let action: 'allow' | 'require_2fa' | 'block' = 'allow'
    if (anomalyScore >= 80) {
        action = 'block'
    } else if (anomalyScore >= 40) {
        action = 'require_2fa'
    }
    
    // Record anomaly if significant
    if (anomalyScore >= 40) {
        securityMonitor.recordEvent('BEHAVIORAL_ANOMALY', userId, {
            anomalyScore,
            reasons,
            action,
        })
    }
    
    // Update profile
    profile.lastActivityTime = Date.now()
    if (deviceId) profile.lastDeviceId = deviceId
    if (location) profile.lastKnownLocation = location
    
    // Update averages (exponential moving average)
    profile.avgTransactionAmount = profile.avgTransactionAmount * 0.9 + transactionAmount * 0.1
    
    // Add current hour to typical hours if not present
    if (!profile.typicalActiveHours.includes(currentHour)) {
        profile.typicalActiveHours.push(currentHour)
        if (profile.typicalActiveHours.length > 12) {
            profile.typicalActiveHours.shift()
        }
    }
    
    // Add token to typical tokens
    if (!profile.typicalTokens.includes(tokenSymbol)) {
        profile.typicalTokens.push(tokenSymbol)
        if (profile.typicalTokens.length > 20) {
            profile.typicalTokens.shift()
        }
    }
    
    return {
        isAnomaly: anomalyScore >= 40,
        anomalyScore: Math.min(100, anomalyScore),
        reasons,
        action,
    }
}

/**
 * Get user's current risk score
 */
export function getUserRiskScore(userId: string): number {
    const profile = userProfiles.get(userId)
    return profile?.riskScore || 0
}

/**
 * Reset user's risk score (admin action)
 */
export function resetUserRiskScore(userId: string): void {
    const profile = userProfiles.get(userId)
    if (profile) {
        profile.riskScore = 0
    }
}

/**
 * Unban a user (admin action)
 */
export function unbanUser(userId: string): boolean {
    return bannedUsers.delete(userId)
}

/**
 * Get all banned users
 */
export function getBannedUsers(): Array<{ userId: string; reason: string; bannedAt: number; expiresAt: number | null }> {
    return Array.from(bannedUsers.entries()).map(([userId, ban]) => ({
        userId,
        ...ban,
    }))
}
