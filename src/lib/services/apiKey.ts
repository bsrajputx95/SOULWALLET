import { ApiKeyScope, Prisma } from '@prisma/client'
import crypto from 'crypto'
import prisma from '../prisma'

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  if (!range || !bitsStr) return false
  const bits = Number(bitsStr)
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false
  const ipInt = ipToInt(ip)
  const rangeInt = ipToInt(range)
  if (ipInt === null || rangeInt === null) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
}

function isIpAllowed(ip: string, whitelist: string[]): boolean {
  if (!whitelist.length) return true
  return whitelist.some((allowed) => {
    if (!allowed) return false
    if (allowed.includes('/')) return isIpInCidr(ip, allowed)
    return allowed === ip
  })
}

function generateKeyMaterial(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export class ApiKeyService {
  static async createApiKey(params: {
    userId: string
    name: string
    scope?: ApiKeyScope
    permissions?: Prisma.InputJsonValue
    ipWhitelist?: string[]
    expiresAt?: Date | null
  }): Promise<{ key: string; keyPrefix: string; apiKeyId: string }> {
    const scope = params.scope ?? 'READ_ONLY'
    const material = generateKeyMaterial()
    const key = `sk_${material}`
    const keyPrefix = key.slice(0, 12)
    const keyHash = hashKey(key)

    const created = await prisma.apiKey.create({
      data: {
        userId: params.userId,
        name: params.name,
        keyHash,
        keyPrefix,
        scope,
        permissions: params.permissions ?? undefined,
        ipWhitelist: params.ipWhitelist ?? [],
        expiresAt: params.expiresAt ?? undefined,
        isActive: true,
      },
      select: { id: true },
    })

    return { key, keyPrefix, apiKeyId: created.id }
  }

  static async verifyApiKey(key: string, ipAddress: string): Promise<{
    ok: boolean
    reason?: string
    userId?: string
    apiKeyId?: string
    scope?: ApiKeyScope
  }> {
    const keyHash = hashKey(key)
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        userId: true,
        scope: true,
        permissions: true,
        ipWhitelist: true,
        isActive: true,
        expiresAt: true,
      },
    })

    if (!apiKey || !apiKey.isActive) return { ok: false, reason: 'inactive' }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return { ok: false, reason: 'expired', userId: apiKey.userId, apiKeyId: apiKey.id, scope: apiKey.scope }
    if (!isIpAllowed(ipAddress, apiKey.ipWhitelist ?? [])) return { ok: false, reason: 'ip_not_allowed', userId: apiKey.userId, apiKeyId: apiKey.id, scope: apiKey.scope }

    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
      })
      .catch(() => undefined)

    return { ok: true, userId: apiKey.userId, apiKeyId: apiKey.id, scope: apiKey.scope }
  }

  static async revokeApiKey(params: { userId: string; keyPrefix: string }): Promise<void> {
    await prisma.apiKey.updateMany({
      where: { userId: params.userId, keyPrefix: params.keyPrefix, isActive: true },
      data: { isActive: false },
    })
  }

  static async listApiKeys(userId: string) {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scope: true,
        ipWhitelist: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return keys
  }
}
