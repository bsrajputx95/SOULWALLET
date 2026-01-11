import 'reflect-metadata';
import { Connection } from '@solana/web3.js'
import { injectable } from 'tsyringe';
import { logger } from '../logger'

type RpcEndpointState = {
  url: string
  connection: Connection
  failures: number
  unhealthyUntilMs: number
  lastLatencyMs?: number
  lastCheckedAtMs: number
}

function uniqNonEmpty(urls: Array<string | undefined | null>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    const url = typeof raw === 'string' ? raw.trim() : ''
    if (!url) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/**
 * RPC Manager Service
 * Handles Solana RPC endpoint failover and health checks
 */
@injectable()
export class RpcManager {
  private endpoints: RpcEndpointState[]
  private healthCheckIntervalMs: number
  private failoverThreshold: number
  private unhealthyCooldownBaseMs: number
  private healthTimer: NodeJS.Timeout | null = null

  constructor() {
    const interval = Number(process.env.RPC_HEALTH_CHECK_INTERVAL || 60000)
    this.healthCheckIntervalMs = Number.isFinite(interval) && interval > 1000 ? interval : 60000

    const threshold = Number(process.env.RPC_FAILOVER_THRESHOLD || 3)
    this.failoverThreshold = Number.isFinite(threshold) && threshold >= 1 ? threshold : 3

    this.unhealthyCooldownBaseMs = 15000

    const urls = uniqNonEmpty([
      process.env.HELIUS_RPC_URL,
      process.env.QUICKNODE_RPC_URL,
      process.env.ALCHEMY_RPC_URL,
      process.env.SOLANA_RPC_URL,
      process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana',
      'https://solana.public-rpc.com',
    ])

    this.endpoints = urls.map((url) => ({
      url,
      connection: new Connection(url, 'confirmed'),
      failures: 0,
      unhealthyUntilMs: 0,
      lastCheckedAtMs: 0,
    }))
  }

  private ensureHealthLoop(): void {
    if (process.env.NODE_ENV === 'test') return
    if (this.healthTimer) return
    this.healthTimer = setInterval(() => {
      this.checkHealthAll().catch(() => undefined)
    }, this.healthCheckIntervalMs)
    this.healthTimer?.unref?.()
  }

  private cooldownMs(failures: number): number {
    const capped = Math.min(Math.max(failures, 1), 8)
    return this.unhealthyCooldownBaseMs * Math.pow(2, capped - 1)
  }

  private markUnhealthy(endpoint: RpcEndpointState, reason: string): void {
    endpoint.failures += 1
    endpoint.unhealthyUntilMs = Date.now() + this.cooldownMs(endpoint.failures)
    logger.warn(`RPC endpoint marked unhealthy: ${endpoint.url} (${reason})`)
  }

  private recordHealthy(endpoint: RpcEndpointState, latencyMs: number): void {
    endpoint.lastLatencyMs = latencyMs
    endpoint.lastCheckedAtMs = Date.now()
    endpoint.failures = 0
    endpoint.unhealthyUntilMs = 0
  }

  private shouldCheck(endpoint: RpcEndpointState): boolean {
    if (!endpoint.lastCheckedAtMs) return true
    return Date.now() - endpoint.lastCheckedAtMs > this.healthCheckIntervalMs
  }

  private async checkHealth(endpoint: RpcEndpointState): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      this.recordHealthy(endpoint, 0)
      return true
    }
    const start = Date.now()
    try {
      await endpoint.connection.getSlot('processed')
      const latency = Date.now() - start
      this.recordHealthy(endpoint, latency)
      return true
    } catch (error) {
      endpoint.lastCheckedAtMs = Date.now()
      const msg = error instanceof Error ? error.message : 'unknown_error'
      this.markUnhealthy(endpoint, `health_check_failed:${msg}`)
      return false
    }
  }

  async checkHealthAll(): Promise<void> {
    await Promise.all(
      this.endpoints.map(async (endpoint) => {
        if (Date.now() < endpoint.unhealthyUntilMs) return
        if (!this.shouldCheck(endpoint)) return
        await this.checkHealth(endpoint)
      })
    )
  }

  async getConnection(): Promise<Connection> {
    this.ensureHealthLoop()

    if (!this.endpoints.length) {
      throw new Error('No RPC endpoints configured')
    }

    const now = Date.now()
    const candidates = this.endpoints
      .filter((e) => e.unhealthyUntilMs <= now)
      .sort((a, b) => {
        const aFail = a.failures
        const bFail = b.failures
        if (aFail !== bFail) return aFail - bFail
        const aLat = a.lastLatencyMs ?? Number.POSITIVE_INFINITY
        const bLat = b.lastLatencyMs ?? Number.POSITIVE_INFINITY
        return aLat - bLat
      })

    const ordered = candidates.length ? candidates : [...this.endpoints].sort((a, b) => a.unhealthyUntilMs - b.unhealthyUntilMs)

    for (const endpoint of ordered) {
      if (endpoint.unhealthyUntilMs > now) continue
      if (this.shouldCheck(endpoint)) {
        const ok = await this.checkHealth(endpoint)
        if (!ok) continue
      }
      return endpoint.connection
    }

    const fallback = ordered[0]
    if (!fallback) {
      throw new Error('No RPC endpoints available')
    }

    const ok = await this.checkHealth(fallback)
    if (ok) return fallback.connection

    throw new Error('All RPC endpoints are unhealthy')
  }

  async withFailover<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt < this.failoverThreshold; attempt += 1) {
      const conn = await this.getConnection()
      try {
        return await fn(conn)
      } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : 'unknown_error'
        const endpoint = this.endpoints.find((e) => e.connection === conn)
        if (endpoint) this.markUnhealthy(endpoint, `call_failed:${message}`)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('RPC operation failed')
  }

  /**
   * Execute multiple RPC calls in a batch with failover support.
   * All calls use the same connection to minimize overhead.
   * @param calls Array of functions that take a connection and return a promise
   * @returns Array of results in the same order as calls
   */
  async batchCall<T>(calls: Array<(connection: Connection) => Promise<T>>): Promise<T[]> {
    if (calls.length === 0) return []

    return this.withFailover(async (connection) => {
      // Execute all calls in parallel using the same connection
      return Promise.all(calls.map(call => call(connection)))
    })
  }

  /**
   * Execute multiple heterogeneous RPC calls in a batch.
   * Each call can return a different type.
   * @param calls Array of call functions
   * @returns Tuple of results matching input types
   */
  async batchCallHeterogeneous<T extends readonly unknown[]>(
    ...calls: { [K in keyof T]: (connection: Connection) => Promise<T[K]> }
  ): Promise<T> {
    if (calls.length === 0) return [] as unknown as T

    return this.withFailover(async (connection) => {
      const results = await Promise.all(calls.map(call => call(connection)))
      return results as unknown as T
    })
  }
}

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<RpcManager>('RpcManager') 
 * 
 * Note: Lazy initialization to prevent container.resolve failures
 */
let _rpcManagerInstance: RpcManager | null = null;

export const rpcManager: RpcManager = new Proxy({} as RpcManager, {
  get(_target, prop) {
    if (!_rpcManagerInstance) {
      try {
        _rpcManagerInstance = container.resolve<RpcManager>('RpcManager');
      } catch {
        _rpcManagerInstance = new RpcManager();
      }
    }
    return (_rpcManagerInstance as any)[prop];
  }
});
