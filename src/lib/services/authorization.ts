import { Role } from '@prisma/client'
import prisma from '../prisma'
import { logger } from '../logger'

export type AppRole = Role | 'PREMIUM'

const ROLE_HIERARCHY: Record<AppRole, number> = {
  USER: 1,
  PREMIUM: 2,
  ADMIN: 3,
}

export interface AuthorizationContext {
  userId?: string | undefined
  role?: AppRole | undefined
  ipAddress: string
  userAgent?: string | undefined
  endpoint: string
  apiKeyId?: string | undefined
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

export class AuthorizationService {
  static hasRole(userRole: AppRole | undefined, requiredRole: AppRole): boolean {
    const role = userRole ?? 'USER'
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole]
  }

  static async verifyOwnership(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<'owned' | 'not_owned' | 'not_found'> {
    try {
      switch (resourceType) {
        case 'CopyTrading': {
          const resource = await prisma.copyTrading.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          if (!resource) return 'not_found'
          return resource.userId === userId ? 'owned' : 'not_owned'
        }
        case 'Position': {
          const resource = await prisma.position.findUnique({
            where: { id: resourceId },
            select: { copyTrading: { select: { userId: true } } },
          })
          if (!resource) return 'not_found'
          return resource.copyTrading?.userId === userId ? 'owned' : 'not_owned'
        }
        case 'Transaction': {
          const resource = await prisma.transaction.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          if (!resource) return 'not_found'
          return resource.userId === userId ? 'owned' : 'not_owned'
        }
        case 'Contact': {
          const resource = await prisma.contact.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          if (!resource) return 'not_found'
          return resource.userId === userId ? 'owned' : 'not_owned'
        }
        case 'Post': {
          const resource = await prisma.post.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          if (!resource) return 'not_found'
          return resource.userId === userId ? 'owned' : 'not_owned'
        }
        case 'IBuyPurchase': {
          const resource = await prisma.iBuyPurchase.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          if (!resource) return 'not_found'
          return resource.userId === userId ? 'owned' : 'not_owned'
        }
        case 'CustodialWallet': {
          const resource = await prisma.custodialWallet.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          if (!resource) return 'not_found'
          return resource.userId === userId ? 'owned' : 'not_owned'
        }
        default:
          return 'not_owned'
      }
    } catch (error) {
      logger.error('Ownership verification error:', error)
      return 'not_owned'
    }
  }

  static async checkAdminIpWhitelist(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { adminIpWhitelist: true },
      })
      const whitelist = settings?.adminIpWhitelist ?? []
      return isIpAllowed(ipAddress, whitelist)
    } catch (error) {
      logger.error('Admin IP whitelist check error:', error)
      return false
    }
  }

  static async auditAuthorization(
    context: AuthorizationContext,
    allowed: boolean,
    reason?: string,
    resource?: { type: string; id: string }
  ): Promise<void> {
    try {
      await prisma.authorizationAudit.create({
        data: {
          userId: context.userId,
          action: context.endpoint,
          resource: resource?.type,
          resourceId: resource?.id,
          endpoint: context.endpoint,
          allowed,
          reason,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          role: context.role,
          apiKeyId: context.apiKeyId,
        },
      })
    } catch (error) {
      logger.error('Failed to audit authorization:', error)
    }
  }
}
