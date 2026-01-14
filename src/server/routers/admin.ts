import { z } from 'zod'
import prisma from '../../lib/prisma'
import { router, adminProcedureSecure } from '../trpc'
import { trustedIpsService } from '../../lib/services/trustedIps'
import { queueManager } from '../../lib/services/queueManager'
import { alertManager } from '../../lib/services/alertManager'

export const adminRouter = router({
  // ========================================
  // Trusted IP Management (Plan5 Step 3.3)
  // ========================================

  addTrustedIp: adminProcedureSecure
    .input(
      z.object({
        ip: z.string().min(1, 'IP address required'),
        reason: z.string().min(1, 'Reason required'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await trustedIpsService.addTrustedIp(input.ip, input.reason, ctx.user.id)
      return { success: true, ip: input.ip }
    }),

  removeTrustedIp: adminProcedureSecure
    .input(
      z.object({
        ip: z.string().min(1, 'IP address required'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await trustedIpsService.removeTrustedIp(input.ip, ctx.user.id)
      return { success: true, ip: input.ip }
    }),

  listTrustedIps: adminProcedureSecure
    .query(async () => {
      return {
        trustedIps: trustedIpsService.listTrustedIps(),
        status: trustedIpsService.getStatus(),
        bypassLog: trustedIpsService.getBypassLog(50),
      }
    }),

  testIpTrust: adminProcedureSecure
    .input(
      z.object({
        ip: z.string().min(1, 'IP address required'),
      })
    )
    .query(async ({ input }) => {
      const isTrusted = await trustedIpsService.isTrustedIp(input.ip)
      return { ip: input.ip, isTrusted }
    }),

  // ========================================
  // Adaptive Rate Limiting - REMOVED
  // ========================================
  // Endpoints removed: getAdaptiveRateLimitStatus, manualAdaptRateLimit, manualRestoreRateLimit

  // ========================================
  // Queue Status (Plan5 Step 1)
  // ========================================

  getQueueStatus: adminProcedureSecure
    .query(async () => {
      return {
        status: await queueManager.getQueueStatus(),
        config: queueManager.getConfig(),
        activeSlots: queueManager.getActiveSlotCount(),
        timestamp: new Date().toISOString(),
      }
    }),

  // ========================================
  // Alert Status (Plan5 Step 4)
  // ========================================

  getAlertStatus: adminProcedureSecure
    .query(async () => {
      return {
        stats: alertManager.getStats(),
        recentAlerts: alertManager.getAlertHistory(24),
        timestamp: new Date().toISOString(),
      }
    }),

  // ========================================
  // Authorization Audits (existing)
  // ========================================

  getAuthorizationAudits: adminProcedureSecure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        userId: z.string().optional(),
        allowed: z.boolean().optional(),
        action: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const skip = (input.page - 1) * input.limit
      const where = {
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.allowed !== undefined ? { allowed: input.allowed } : {}),
        ...(input.action ? { action: input.action } : {}),
      } as const

      const [audits, total] = await Promise.all([
        prisma.authorizationAudit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: input.limit,
        }),
        prisma.authorizationAudit.count({ where }),
      ])

      return {
        audits,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          pages: Math.ceil(total / input.limit),
        },
      }
    }),

  updateUserRole: adminProcedureSecure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['USER', 'PREMIUM', 'ADMIN']),
      })
    )
    .mutation(async ({ input }) => {
      const user = await prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
        select: { id: true, email: true, role: true },
      })
      return { success: true, user }
    }),

  // ========================================
  // KYC/AML/GDPR - REMOVED
  // ========================================
  // Endpoints removed: listKYCVerifications, getKYCVerification, approveKYC, rejectKYC,
  // getOpenAMLAlerts, resolveAMLAlert, listDataDeletionRequests, processDataDeletion

  // ========================================
  // Security Management - REMOVED
  // ========================================
  // Endpoints removed: getBannedUsers, banUser, unbanUser, getSecurityMetrics,
  // getUserSecurityProfile, resetUserRiskScore

  // Global poster management
  setGlobalPoster: adminProcedureSecure
    .input(
      z.object({
        userId: z.string().min(1),
        isGlobalPoster: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      // Note: This would require adding isGlobalPoster field to User model
      // For now, global posters are managed via environment variable
      // This endpoint is a placeholder for future database-backed implementation
      return {
        success: false,
        message: 'Global posters are currently managed via GLOBAL_POSTER_USERNAMES environment variable',
      }
    }),
})
