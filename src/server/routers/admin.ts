import { z } from 'zod'
import prisma from '../../lib/prisma'
import { router, adminProcedureSecure } from '../trpc'
import { trustedIpsService } from '../../lib/services/trustedIps'
import { adaptiveRateLimiter } from '../../lib/middleware/adaptiveRateLimiter'
import { queueManager } from '../../lib/services/queueManager'
import { alertManager } from '../../lib/services/alertManager'
import { amlService, kycService } from '../../lib/services/kyc'
import { gdprService } from '../../lib/services/gdpr'

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
  // Adaptive Rate Limiting (Plan5 Step 2.3)
  // ========================================

  getAdaptiveRateLimitStatus: adminProcedureSecure
    .query(async () => {
      return {
        metrics: adaptiveRateLimiter.getMetrics(),
        states: adaptiveRateLimiter.getAllStates(),
        timestamp: new Date().toISOString(),
      }
    }),

  manualAdaptRateLimit: adminProcedureSecure
    .input(
      z.object({
        endpoint: z.string(),
        factor: z.number().min(0.1).max(1).default(0.5),
      })
    )
    .mutation(async ({ input }) => {
      await adaptiveRateLimiter.manualAdapt(input.endpoint as any, input.factor)
      return { success: true, endpoint: input.endpoint, factor: input.factor }
    }),

  manualRestoreRateLimit: adminProcedureSecure
    .input(
      z.object({
        endpoint: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await adaptiveRateLimiter.manualRestore(input.endpoint as any)
      return { success: true, endpoint: input.endpoint }
    }),

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

  listKYCVerifications: adminProcedureSecure
    .input(
      z.object({
        status: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const skip = (input.page - 1) * input.limit
      const where = {
        ...(input.status ? { status: input.status } : {}),
      } as const

      const [verifications, total] = await Promise.all([
        prisma.kYCVerification.findMany({
          where,
          include: { user: { select: { id: true, email: true, username: true } } },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: input.limit,
        }),
        prisma.kYCVerification.count({ where }),
      ])

      return {
        success: true,
        verifications,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          pages: Math.ceil(total / input.limit),
        },
      }
    }),

  getKYCVerification: adminProcedureSecure
    .input(
      z
        .object({
          userId: z.string().optional(),
          verificationId: z.string().optional(),
          includeDecrypted: z.boolean().default(false),
        })
        .refine((v) => Boolean(v.userId || v.verificationId), {
          message: 'userId or verificationId is required',
        })
    )
    .query(async ({ input }) => {
      const verification = input.verificationId
        ? await prisma.kYCVerification.findUnique({
            where: { id: input.verificationId },
            include: { user: { select: { id: true, email: true, username: true } } },
          })
        : await prisma.kYCVerification.findUnique({
            where: { userId: input.userId as string },
            include: { user: { select: { id: true, email: true, username: true } } },
          })

      if (!verification) {
        return { success: true, verification: null, decryptedData: null }
      }

      const decryptedData = input.includeDecrypted ? await kycService.getDecryptedKYCData(verification.userId) : null
      return { success: true, verification, decryptedData }
    }),

  approveKYC: adminProcedureSecure
    .input(
      z.object({
        verificationId: z.string().min(1),
        tier: z.number().int().min(1).max(5).default(1),
        riskScore: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await kycService.approveKYC(input.verificationId, ctx.user.id, input.tier, input.riskScore)
      return { success: true }
    }),

  rejectKYC: adminProcedureSecure
    .input(
      z.object({
        verificationId: z.string().min(1),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await kycService.rejectKYC(input.verificationId, ctx.user.id, input.reason)
      return { success: true }
    }),

  getOpenAMLAlerts: adminProcedureSecure
    .input(
      z.object({
        severity: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const alerts = await amlService.getOpenAlerts({ severity: input.severity, limit: input.limit })
      return { success: true, alerts }
    }),

  resolveAMLAlert: adminProcedureSecure
    .input(
      z.object({
        alertId: z.string().min(1),
        resolution: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await amlService.resolveAlert(input.alertId, ctx.user.id, input.resolution)
      return { success: true }
    }),

  listDataDeletionRequests: adminProcedureSecure
    .input(
      z.object({
        status: z.string().optional(),
        userId: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const skip = (input.page - 1) * input.limit
      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
      } as const

      const [requests, total] = await Promise.all([
        prisma.dataDeletionRequest.findMany({
          where,
          include: { user: { select: { id: true, email: true, username: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: input.limit,
        }),
        prisma.dataDeletionRequest.count({ where }),
      ])

      return {
        success: true,
        requests,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          pages: Math.ceil(total / input.limit),
        },
      }
    }),

  processDataDeletion: adminProcedureSecure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await gdprService.processDataDeletion(input.requestId, ctx.user.id)
      return { success: true }
    }),

  // ========================================
  // Security Management (Anti-Exploit)
  // ========================================

  getBannedUsers: adminProcedureSecure
    .query(async () => {
      const { getBannedUsers } = await import('../../lib/services/securityMonitor')
      return {
        bannedUsers: getBannedUsers(),
        timestamp: new Date().toISOString(),
      }
    }),

  banUser: adminProcedureSecure
    .input(
      z.object({
        userId: z.string().min(1),
        reason: z.string().min(1),
        durationHours: z.number().optional(), // null = permanent
      })
    )
    .mutation(async ({ input }) => {
      const { banUser } = await import('../../lib/services/securityMonitor')
      const durationMs = input.durationHours ? input.durationHours * 60 * 60 * 1000 : undefined
      banUser(input.userId, input.reason, durationMs)
      return { success: true, userId: input.userId, reason: input.reason }
    }),

  unbanUser: adminProcedureSecure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { unbanUser } = await import('../../lib/services/securityMonitor')
      const success = unbanUser(input.userId)
      return { success, userId: input.userId }
    }),

  getSecurityMetrics: adminProcedureSecure
    .query(async () => {
      const { securityMonitor } = await import('../../lib/services/securityMonitor')
      return {
        metrics: securityMonitor.getMetrics(),
        recentEvents: securityMonitor.getRecentEvents(50),
        timestamp: new Date().toISOString(),
      }
    }),

  getUserSecurityProfile: adminProcedureSecure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      const { securityMonitor, getUserRiskScore, isUserBanned } = await import('../../lib/services/securityMonitor')
      return {
        userId: input.userId,
        riskScore: getUserRiskScore(input.userId),
        banStatus: isUserBanned(input.userId),
        recentEvents: securityMonitor.getUserEvents(input.userId, 20),
        timestamp: new Date().toISOString(),
      }
    }),

  resetUserRiskScore: adminProcedureSecure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { resetUserRiskScore } = await import('../../lib/services/securityMonitor')
      resetUserRiskScore(input.userId)
      return { success: true, userId: input.userId }
    }),

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
