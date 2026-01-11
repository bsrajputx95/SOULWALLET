import Redis, { Cluster, type RedisOptions } from 'ioredis'
import { logger } from './logger'
import { getCircuitBreaker } from './services/circuitBreaker'
import { TIMEOUTS } from '@/constants'

export type CacheKey =
  | `session:${string}`
  | `session:${string}:lastActivityAt`
  | `user:${string}:sessions`
  | `user:${string}:profile`
  | `token:${string}`
  | `tokenMetadata:${string}`
  | `search:${string}`
  | `pair:${string}:${string}`
  | 'trending'
  | 'soulmarket'
  | 'featureFlags'
  | `ohlcv:${string}:${string}`
  | `birdeye:price:${string}`
  | `birdeye:wallet:pnl:${string}`
  | `birdeye:wallet:tokens:${string}`
  | `traders:top:${string}`
  | `portfolio:snapshot:${string}`
  | 'portfolio:sol:price'
  | `ibuy:quote:${string}:${string}` // iBuy quote cache: tokenMint:inputMint
  | `ibuy:job:${string}` // iBuy job status cache

type RedisClient = Redis | Cluster

type CacheMetrics = {
  hits: number
  misses: number
  errors: number
  slowOps: number
  totalOps: number
  totalLatencyMs: number
}

// Comment 2: Connection pool configuration
const POOL_MIN = TIMEOUTS.REDIS.POOL_MIN
const POOL_MAX = TIMEOUTS.REDIS.POOL_MAX
const POOL_ACQUIRE_TIMEOUT_MS = TIMEOUTS.REDIS.POOL_ACQUIRE_TIMEOUT_MS

const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  slowOps: 0,
  totalOps: 0,
  totalLatencyMs: 0,
}

const memoryValues = new Map<CacheKey, { payload: string; expiresAtMs: number }>()
const memorySets = new Map<CacheKey, Set<string>>()

function memoryGetPayload(key: CacheKey): string | null {
  const entry = memoryValues.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAtMs) {
    memoryValues.delete(key)
    return null
  }
  return entry.payload
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

// Comment 2: Connection pool for Redis clients
const pool: RedisClient[] = []
let poolInitialized = false
let primaryClient: RedisClient | null = null
const breaker = getCircuitBreaker('redis:cache')

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildRetryStrategy() {
  const maxRetries = readIntEnv('REDIS_MAX_RETRIES', 3)
  return (times: number) => {
    if (times > maxRetries) return null
    const delay = Math.min(50 * Math.pow(2, times), 3000)
    return delay
  }
}

function getRedisUrl(): string | null {
  const raw = process.env.REDIS_URL
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim()
  if (process.env.NODE_ENV === 'development') return 'redis://localhost:6379'
  return null
}

function parseClusterNodes(): Array<{ host: string; port: number }> {
  const raw = process.env.REDIS_CLUSTER_NODES
  if (!raw) return []
  return raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, portRaw] = entry.split(':')
      const port = Number.parseInt(portRaw ?? '', 10)
      return { host: host ?? 'localhost', port: Number.isFinite(port) ? port : 6379 }
    })
}

function createRedisClient(): RedisClient | null {
  const url = getRedisUrl()
  if (!url && process.env.REDIS_CLUSTER_MODE !== 'true') return null

  const connectTimeout = readIntEnv('REDIS_CONNECT_TIMEOUT', 10_000)
  const maxRetriesPerRequest = readIntEnv('REDIS_MAX_RETRIES', 3)
  const commonOptions: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest,
    connectTimeout,
    retryStrategy: buildRetryStrategy(),
  }

  try {
    let newClient: RedisClient
    if (process.env.REDIS_CLUSTER_MODE === 'true') {
      const nodes = parseClusterNodes()
      if (nodes.length === 0) return null
      newClient = new Cluster(nodes, { redisOptions: commonOptions })
    } else {
      newClient = new Redis(url!, commonOptions)
    }

    newClient.on('error', async (err: unknown) => {
      metrics.errors++
      logger.warn('[Redis] Client error', { error: err instanceof Error ? err.message : String(err) })
      try {
        const Sentry = await import('@sentry/node')
        Sentry.captureException(err, { tags: { component: 'redis' } })
      } catch {
        void 0
      }
    })

    return newClient
  } catch (error) {
    metrics.errors++
    logger.warn('[Redis] Failed to create client', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

// Comment 2: Initialize the connection pool with min clients
function initializePool(): void {
  if (poolInitialized) return

  for (let i = 0; i < POOL_MIN; i++) {
    const client = createRedisClient()
    if (client) {
      pool.push(client)
    }
  }

  if (pool.length > 0) {
    primaryClient = pool[0]!
    poolInitialized = true
    logger.info(`[Redis] Connection pool initialized with ${pool.length} clients`)
  }
}

// Comment 2: Acquire a client from the pool
function acquireClient(): RedisClient | null {
  if (!poolInitialized) {
    initializePool()
  }

  // Return primary client for simple operations (most cases)
  if (primaryClient) return primaryClient

  // If pool has clients, use the first available
  if (pool.length > 0) return pool[0]!

  // Try to create a new client if under max
  if (pool.length < POOL_MAX) {
    const newClient = createRedisClient()
    if (newClient) {
      pool.push(newClient)
      if (!primaryClient) primaryClient = newClient
      return newClient
    }
  }

  return null
}

// Comment 2: Graceful shutdown of all pool connections
export async function shutdownRedisPool(): Promise<void> {
  logger.info(`[Redis] Shutting down connection pool (${pool.length} clients)...`)

  const disconnectPromises = pool.map(async (client) => {
    try {
      await client.quit()
    } catch (err) {
      logger.warn('[Redis] Error disconnecting client', { error: err })
    }
  })

  await Promise.all(disconnectPromises)
  pool.length = 0
  primaryClient = null
  poolInitialized = false

  logger.info('[Redis] Connection pool shut down')
}

// For backward compatibility
export function getRedisClient(): RedisClient | null {
  return acquireClient()
}

async function timed<T>(op: string, key: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  metrics.totalOps++
  try {
    return await fn()
  } finally {
    const latency = Date.now() - start
    metrics.totalLatencyMs += latency
    if (latency > 100) {
      metrics.slowOps++
      logger.warn('[Redis] Slow op', { op, key, latency })
    }
  }
}

export async function healthCheck(): Promise<boolean> {
  const c = getRedisClient()
  if (!c) return false
  try {
    await c.ping()
    return true
  } catch {
    return false
  }
}

export async function getRedisHealth(): Promise<{
  healthy: boolean
  connected: boolean
  latency?: number
  memory?: string
  required: boolean
}> {
  const c = getRedisClient()
  const required = !!process.env.REDIS_URL || process.env.REDIS_CLUSTER_MODE === 'true'
  if (!c) return { healthy: !required, connected: false, required }

  try {
    const start = Date.now()
    await c.ping()
    const latency = Date.now() - start
    const info = await c.info('memory')
    const match = info.match(/used_memory_human:([^\r\n]+)/)
    const memory = match?.[1]?.trim()
    return { healthy: true, connected: true, latency, ...(memory ? { memory } : {}), required }
  } catch (error) {
    return {
      healthy: false,
      connected: c.status === 'ready',
      required,
      error: error instanceof Error ? error.message : String(error),
    } as any
  }
}

export function getCacheMetrics(): {
  hits: number
  misses: number
  hitRate: number
  errors: number
  avgLatencyMs: number
  slowOps: number
  totalOps: number
} {
  const totalLookups = metrics.hits + metrics.misses
  const hitRate = totalLookups === 0 ? 0 : metrics.hits / totalLookups
  const avgLatencyMs = metrics.totalOps === 0 ? 0 : metrics.totalLatencyMs / metrics.totalOps
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    hitRate,
    errors: metrics.errors,
    avgLatencyMs,
    slowOps: metrics.slowOps,
    totalOps: metrics.totalOps,
  }
}

async function safeJsonParse<T>(raw: string): Promise<T | null> {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const redisCache = {
  async get<T>(key: CacheKey): Promise<T | null> {
    const c = getRedisClient()
    if (!c) {
      const raw = memoryGetPayload(key)
      if (raw == null) {
        metrics.misses++
        return null
      }
      const parsed = await safeJsonParse<T>(raw)
      if (parsed == null) {
        metrics.misses++
        return null
      }
      metrics.hits++
      return parsed
    }

    try {
      const raw = await breaker.exec(
        () => timed('get', key, () => c.get(key)),
        () => null
      )
      if (raw == null) {
        metrics.misses++
        return null
      }
      const parsed = await safeJsonParse<T>(raw)
      if (parsed == null) {
        metrics.misses++
        return null
      }
      metrics.hits++
      return parsed
    } catch {
      metrics.errors++
      metrics.misses++
      return null
    }
  },

  async mget<T>(keys: CacheKey[]): Promise<Array<T | null>> {
    const c = getRedisClient()
    if (!c) {
      const results: Array<T | null> = []
      for (const key of keys) {
        const raw = memoryGetPayload(key)
        if (raw == null) {
          metrics.misses++
          results.push(null)
          continue
        }
        const parsed = await safeJsonParse<T>(raw)
        if (parsed == null) {
          metrics.misses++
          results.push(null)
          continue
        }
        metrics.hits++
        results.push(parsed)
      }
      return results
    }

    if (keys.length === 0) return []

    try {
      const raw = await breaker.exec<Array<string | null>>(
        () => timed('mget', keys[0]!, () => c.mget(...keys)),
        () => keys.map(() => null) as Array<string | null>
      )

      const results: Array<T | null> = []
      for (const entry of raw) {
        if (entry == null) {
          metrics.misses++
          results.push(null)
          continue
        }
        const parsed = await safeJsonParse<T>(entry)
        if (parsed == null) {
          metrics.misses++
          results.push(null)
          continue
        }
        metrics.hits++
        results.push(parsed)
      }

      return results
    } catch {
      metrics.errors++
      metrics.misses += keys.length
      return keys.map(() => null)
    }
  },

  async set(key: CacheKey, value: unknown, ttlSeconds?: number): Promise<void> {
    const c = getRedisClient()
    const payload = JSON.stringify(value)
    if (!c) {
      const expiresAtMs =
        ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : Number.POSITIVE_INFINITY
      memoryValues.set(key, { payload, expiresAtMs })
      return
    }
    try {
      await breaker.exec(
        () =>
          timed('set', key, async () => {
            if (ttlSeconds && ttlSeconds > 0) {
              await c.set(key, payload, 'EX', ttlSeconds)
            } else {
              await c.set(key, payload)
            }
          }),
        () => void 0
      )
    } catch {
      metrics.errors++
    }
  },

  async sadd(key: CacheKey, members: string | string[]): Promise<void> {
    const c = getRedisClient()
    const arr = Array.isArray(members) ? members : [members]
    if (arr.length === 0) return

    if (!c) {
      const set = memorySets.get(key) ?? new Set<string>()
      for (const m of arr) set.add(m)
      memorySets.set(key, set)
      return
    }

    try {
      await breaker.exec(
        () => timed('sadd', key, () => c.sadd(key, ...arr)),
        () => 0
      )
    } catch {
      metrics.errors++
    }
  },

  async srem(key: CacheKey, members: string | string[]): Promise<void> {
    const c = getRedisClient()
    const arr = Array.isArray(members) ? members : [members]
    if (arr.length === 0) return

    if (!c) {
      const set = memorySets.get(key)
      if (!set) return
      for (const m of arr) set.delete(m)
      if (set.size === 0) memorySets.delete(key)
      return
    }

    try {
      await breaker.exec(
        () => timed('srem', key, () => c.srem(key, ...arr)),
        () => 0
      )
    } catch {
      metrics.errors++
    }
  },

  async smembers(key: CacheKey): Promise<string[]> {
    const c = getRedisClient()
    if (!c) return Array.from(memorySets.get(key) ?? [])

    try {
      const members = await breaker.exec(
        () => timed('smembers', key, () => c.smembers(key)),
        () => []
      )
      return Array.isArray(members) ? members : []
    } catch {
      metrics.errors++
      return []
    }
  },

  async del(keys: CacheKey | CacheKey[]): Promise<void> {
    const c = getRedisClient()
    const arr = Array.isArray(keys) ? keys : [keys]
    if (arr.length === 0) return
    if (!c) {
      for (const k of arr) {
        memoryValues.delete(k)
        memorySets.delete(k)
      }
      return
    }
    try {
      await breaker.exec(
        () => timed('del', arr[0]!, () => c.del(...arr)),
        () => 0
      )
    } catch {
      metrics.errors++
    }
  },

  async invalidatePattern(pattern: string): Promise<void> {
    const c = getRedisClient()
    if (!c) {
      const re = patternToRegex(pattern)
      for (const key of memoryValues.keys()) {
        if (re.test(key)) memoryValues.delete(key)
      }
      for (const key of memorySets.keys()) {
        if (re.test(key)) memorySets.delete(key)
      }
      return
    }

    let cursor = '0'
    try {
      do {
        const res = await breaker.exec(
          () => timed('scan', pattern, () => c.scan(cursor, 'MATCH', pattern, 'COUNT', 500)),
          () => ['0', []] as [string, string[]]
        )
        cursor = res[0]
        const keys = res[1]
        if (keys.length > 0) {
          await breaker.exec(
            () => timed('del', pattern, () => c.del(...keys)),
            () => 0
          )
        }
      } while (cursor !== '0')
    } catch {
      metrics.errors++
    }
  },
}

export function getCacheTtls() {
  return {
    session: readIntEnv('CACHE_TTL_SESSION', TIMEOUTS.CACHE_TTL_SECONDS.SESSION),
    price: readIntEnv('CACHE_TTL_PRICE', TIMEOUTS.CACHE_TTL_SECONDS.PRICE),
    portfolio: readIntEnv('CACHE_TTL_PORTFOLIO', TIMEOUTS.CACHE_TTL_SECONDS.PORTFOLIO),
    tokenMetadata: readIntEnv('CACHE_TTL_TOKEN_METADATA', TIMEOUTS.CACHE_TTL_SECONDS.TOKEN_METADATA),
  }
}
