/**
 * Trusted IPs Service
 * 
 * Allows internal services and monitoring tools to bypass rate limits.
 * - Environment-based IP whitelist
 * - CIDR notation support (e.g., 10.0.0.0/8)
 * - Audit logging of all bypasses
 * - Redis cache for distributed access
 */

import Redis from 'ioredis'
import { logger } from '../logger'

// CIDR matching utilities
function ipToLong(ip: string): number {
    const parts = ip.split('.')
    if (parts.length !== 4) return 0
    const p0 = parts[0] ?? '0'
    const p1 = parts[1] ?? '0'
    const p2 = parts[2] ?? '0'
    const p3 = parts[3] ?? '0'
    return (
        (parseInt(p0) << 24) +
        (parseInt(p1) << 16) +
        (parseInt(p2) << 8) +
        parseInt(p3)
    ) >>> 0
}

function parseCidr(cidr: string): { ip: number; mask: number } | null {
    const parts = cidr.split('/')
    if (parts.length !== 2) return null

    const ipPart = parts[0] ?? ''
    const maskPart = parts[1] ?? ''
    const ip = ipToLong(ipPart)
    const maskBits = parseInt(maskPart)
    if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return null

    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0
    return { ip: ip & mask, mask }
}

function isIpInCidr(ip: string, cidr: string): boolean {
    const parsed = parseCidr(cidr)
    if (!parsed) return false

    const ipLong = ipToLong(ip)
    return (ipLong & parsed.mask) === parsed.ip
}

function isIpv6Localhost(ip: string): boolean {
    return ip === '::1' || ip === '::ffff:127.0.0.1'
}

export interface TrustedIpEntry {
    ip: string
    isCidr: boolean
    addedBy?: string
    addedAt: number
    reason?: string
}

export interface BypassAuditEntry {
    ip: string
    endpoint: string
    timestamp: number
    userId: string | undefined
}

class TrustedIpsService {
    private redis: Redis | null = null
    private trustedIps: TrustedIpEntry[] = []
    private bypassCache: Map<string, { trusted: boolean; expiry: number }> = new Map()
    private cacheTtlMs = 5 * 60 * 1000 // 5 minute cache
    private bypassLog: BypassAuditEntry[] = []
    private maxBypassLogSize = 1000
    private enabled: boolean

    constructor() {
        this.enabled = process.env.ENABLE_TRUSTED_IP_BYPASS !== 'false'
        this.loadFromEnv()
        void this.initRedis()
    }

    private loadFromEnv(): void {
        const envIps = process.env.TRUSTED_IPS || '127.0.0.1,::1'
        const ips = envIps.split(',').map((ip) => ip.trim()).filter(Boolean)

        for (const ip of ips) {
            const isCidr = ip.includes('/')
            this.trustedIps.push({
                ip,
                isCidr,
                addedAt: Date.now(),
                reason: 'Environment configuration',
            })
        }

        logger.info('[TrustedIps] Loaded trusted IPs from environment', {
            count: this.trustedIps.length,
        })
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

            // Load additional trusted IPs from Redis
            await this.loadFromRedis()
        } catch (error) {
            logger.warn('[TrustedIps] Redis connection failed', { error })
            this.redis = null
        }
    }

    private async loadFromRedis(): Promise<void> {
        if (!this.redis) return

        try {
            const entries = await this.redis.hgetall('trusted:ips:list')
            for (const [ip, data] of Object.entries(entries)) {
                try {
                    const entry = JSON.parse(data) as TrustedIpEntry
                    // Don't duplicate entries from env
                    if (!this.trustedIps.some((e) => e.ip === ip)) {
                        this.trustedIps.push(entry)
                    }
                } catch {
                    // Invalid JSON, skip
                }
            }
        } catch (error) {
            logger.warn('[TrustedIps] Failed to load from Redis', { error })
        }
    }

    /**
     * Check if an IP is trusted
     */
    async isTrustedIp(ip: string): Promise<boolean> {
        if (!this.enabled) return false

        // Normalize IPv6 localhost
        const normalizedIp = isIpv6Localhost(ip) ? '127.0.0.1' : ip.replace('::ffff:', '')

        // Check cache first
        const cached = this.bypassCache.get(normalizedIp)
        if (cached && cached.expiry > Date.now()) {
            return cached.trusted
        }

        // Check against trusted IPs
        let trusted = false
        for (const entry of this.trustedIps) {
            if (entry.isCidr) {
                if (isIpInCidr(normalizedIp, entry.ip)) {
                    trusted = true
                    break
                }
            } else {
                if (entry.ip === normalizedIp || entry.ip === ip) {
                    trusted = true
                    break
                }
            }
        }

        // Update cache
        this.bypassCache.set(normalizedIp, {
            trusted,
            expiry: Date.now() + this.cacheTtlMs,
        })

        return trusted
    }

    /**
     * Log a bypass event for audit trail
     */
    logBypass(ip: string, endpoint: string, userId?: string): void {
        const entry: BypassAuditEntry = {
            ip,
            endpoint,
            timestamp: Date.now(),
            userId,
        }

        this.bypassLog.push(entry)

        // Trim old entries
        if (this.bypassLog.length > this.maxBypassLogSize) {
            this.bypassLog = this.bypassLog.slice(-this.maxBypassLogSize / 2)
        }

        logger.info('[TrustedIps] Rate limit bypassed', entry)

        // Store in Redis if available
        if (this.redis) {
            this.redis.lpush('trusted:ips:bypass_log', JSON.stringify(entry)).catch(() => { })
            this.redis.ltrim('trusted:ips:bypass_log', 0, this.maxBypassLogSize).catch(() => { })
        }
    }

    /**
     * Add a trusted IP dynamically (admin function)
     */
    async addTrustedIp(ip: string, reason: string, adminId: string): Promise<void> {
        const isCidr = ip.includes('/')

        // Validate IP/CIDR format
        if (isCidr) {
            if (!parseCidr(ip)) {
                throw new Error(`Invalid CIDR format: ${ip}`)
            }
        } else {
            // Basic IP validation
            if (!ip.match(/^(\d{1,3}\.){3}\d{1,3}$/) && ip !== '::1') {
                throw new Error(`Invalid IP format: ${ip}`)
            }
        }

        const entry: TrustedIpEntry = {
            ip,
            isCidr,
            addedBy: adminId,
            addedAt: Date.now(),
            reason,
        }

        // Check if already exists
        const existing = this.trustedIps.find((e) => e.ip === ip)
        if (existing) {
            throw new Error(`IP ${ip} is already trusted`)
        }

        this.trustedIps.push(entry)

        // Clear cache for this IP
        this.bypassCache.delete(ip)

        // Store in Redis
        if (this.redis) {
            await this.redis.hset('trusted:ips:list', ip, JSON.stringify(entry))
        }

        logger.info('[TrustedIps] Added trusted IP', { ip, adminId, reason })
    }

    /**
     * Remove a trusted IP (admin function)
     */
    async removeTrustedIp(ip: string, adminId: string): Promise<void> {
        const index = this.trustedIps.findIndex((e) => e.ip === ip)
        if (index === -1) {
            throw new Error(`IP ${ip} is not in trusted list`)
        }

        this.trustedIps.splice(index, 1)

        // Clear cache
        this.bypassCache.delete(ip)

        // Remove from Redis
        if (this.redis) {
            await this.redis.hdel('trusted:ips:list', ip)
        }

        logger.info('[TrustedIps] Removed trusted IP', { ip, adminId })
    }

    /**
     * List all trusted IPs
     */
    listTrustedIps(): TrustedIpEntry[] {
        return [...this.trustedIps]
    }

    /**
     * Get recent bypass log entries
     */
    getBypassLog(count = 100): BypassAuditEntry[] {
        return this.bypassLog.slice(-count)
    }

    /**
     * Check if trusted IP bypass is enabled
     */
    isEnabled(): boolean {
        return this.enabled
    }

    /**
     * Get status for monitoring
     */
    getStatus(): {
        enabled: boolean
        trustedIpCount: number
        bypassLogSize: number
        cacheSize: number
    } {
        return {
            enabled: this.enabled,
            trustedIpCount: this.trustedIps.length,
            bypassLogSize: this.bypassLog.length,
            cacheSize: this.bypassCache.size,
        }
    }
}

// Singleton instance
export const trustedIpsService = new TrustedIpsService()
