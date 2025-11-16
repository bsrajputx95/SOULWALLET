import Redis from 'ioredis'

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null

export class LockService {
  static async acquireLock(key: string, ttl: number = 10000): Promise<boolean> {
    const lockKey = `lock:${key}`
    const val = Date.now().toString()
    if (!redis) return true
    const res = await redis.set(lockKey, val, 'PX', ttl, 'NX')
    return res === 'OK'
  }

  static async releaseLock(key: string): Promise<void> {
    if (!redis) return
    const lockKey = `lock:${key}`
    await redis.del(lockKey)
  }

  static async withLock<T>(key: string, fn: () => Promise<T>, ttl: number = 10000): Promise<T> {
    const ok = await this.acquireLock(key, ttl)
    if (!ok) throw new Error('LOCK_NOT_ACQUIRED')
    try {
      return await fn()
    } finally {
      await this.releaseLock(key)
    }
  }
}