import Redis from 'ioredis'
import { randomBytes } from 'crypto'

function base64Url(bytes: Buffer): string {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

type StoredNonce = {
  value: string
  expiresAtMs: number
}

export class NonceManager {
  private ttlMs = 5 * 60 * 1000
  private redis: Redis | null = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true }) : null
  private memory = new Map<string, StoredNonce>()

  async generateNonce(userId: string, publicKey: string): Promise<string> {
    const nonce = base64Url(randomBytes(18))
    const expected = `${userId}|${publicKey}`

    if (this.redis) {
      try {
        if (this.redis.status === 'end') {
          this.redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true })
        }
        if (this.redis.status === 'wait' || this.redis.status === 'connecting') {
          await this.redis.connect()
        }
        const ok = await this.redis.set(this.key(nonce), expected, 'PX', this.ttlMs, 'NX')
        if (ok === 'OK') return nonce
        return await this.generateNonce(userId, publicKey)
      } catch {
        return this.generateNonceMemory(userId, publicKey, nonce)
      }
    }

    return this.generateNonceMemory(userId, publicKey, nonce)
  }

  async validateAndConsumeNonce(nonce: string, userId: string, publicKey: string): Promise<boolean> {
    const expected = `${userId}|${publicKey}`

    if (this.redis) {
      try {
        if (this.redis.status === 'end') {
          this.redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true })
        }
        if (this.redis.status === 'wait' || this.redis.status === 'connecting') {
          await this.redis.connect()
        }

        const lua = `
local val = redis.call("GET", KEYS[1])
if not val then return 0 end
if val ~= ARGV[1] then return -1 end
redis.call("DEL", KEYS[1])
return 1
`
        const res = await this.redis.eval(lua, 1, this.key(nonce), expected)
        return res === 1
      } catch {
        return this.validateAndConsumeNonceMemory(nonce, expected)
      }
    }

    return this.validateAndConsumeNonceMemory(nonce, expected)
  }

  async validateNonce(nonce: string, userId: string, publicKey: string): Promise<boolean> {
    const expected = `${userId}|${publicKey}`

    if (this.redis) {
      try {
        if (this.redis.status === 'end') {
          this.redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true })
        }
        if (this.redis.status === 'wait' || this.redis.status === 'connecting') {
          await this.redis.connect()
        }
        const val = await this.redis.get(this.key(nonce))
        return val === expected
      } catch {
        return this.validateNonceMemory(nonce, expected)
      }
    }

    return this.validateNonceMemory(nonce, expected)
  }

  private key(nonce: string): string {
    return `sig_nonce:${nonce}`
  }

  private generateNonceMemory(userId: string, publicKey: string, nonce: string): string {
    const expected = `${userId}|${publicKey}`
    if (this.memory.has(nonce)) return this.generateNonceMemory(userId, publicKey, base64Url(randomBytes(18)))
    this.memory.set(nonce, { value: expected, expiresAtMs: Date.now() + this.ttlMs })
    return nonce
  }

  private validateAndConsumeNonceMemory(nonce: string, expected: string): boolean {
    const entry = this.memory.get(nonce)
    if (!entry) return false
    if (Date.now() > entry.expiresAtMs) {
      this.memory.delete(nonce)
      return false
    }
    if (entry.value !== expected) return false
    this.memory.delete(nonce)
    return true
  }

  private validateNonceMemory(nonce: string, expected: string): boolean {
    const entry = this.memory.get(nonce)
    if (!entry) return false
    if (Date.now() > entry.expiresAtMs) {
      this.memory.delete(nonce)
      return false
    }
    return entry.value === expected
  }
}

export const nonceManager = new NonceManager()
