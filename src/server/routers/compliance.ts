/**
 * Compliance Router
 * 
 * User-facing endpoints for GDPR, KYC, and audit log functionality.
 * Plan6 Step 7 implementation.
 */

import { z } from 'zod'
import prisma from '../../lib/prisma'
import { router, protectedProcedure, adminProcedureSecure } from '../trpc'
import { gdprService } from '../../lib/services/gdpr'
import { kycService, amlService } from '../../lib/services/kyc'
import { auditLogService } from '../../lib/services/auditLog'

export const complianceRouter = router({
    // ========================================
    // GDPR - Right to Access (Article 15)
    // ========================================

    requestDataExport: protectedProcedure
        .input(
            z.object({
                format: z.enum(['JSON', 'CSV']).default('JSON'),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const requestId = await gdprService.requestDataExport(ctx.user.id, input.format)
            return { success: true, requestId }
        }),

    getDataExportStatus: protectedProcedure
        .input(
            z.object({
                requestId: z.string().min(1),
            })
        )
        .query(async ({ ctx, input }) => {
            const request = await prisma.dataExportRequest.findFirst({
                where: {
                    id: input.requestId,
                    userId: ctx.user.id,
                },
                select: {
                    id: true,
                    status: true,
                    format: true,
                    fileUrl: true,
                    fileSize: true,
                    expiresAt: true,
                    processedAt: true,
                    createdAt: true,
                },
            })

            if (!request) {
                return { success: false, request: null }
            }

            return { success: true, request }
        }),

    listMyExportRequests: protectedProcedure
        .input(
            z.object({
                limit: z.number().int().min(1).max(50).default(10),
            })
        )
        .query(async ({ ctx, input }) => {
            const requests = await prisma.dataExportRequest.findMany({
                where: { userId: ctx.user.id },
                orderBy: { createdAt: 'desc' },
                take: input.limit,
                select: {
                    id: true,
                    status: true,
                    format: true,
                    fileUrl: true,
                    expiresAt: true,
                    createdAt: true,
                },
            })

            return { success: true, requests }
        }),

    // ========================================
    // GDPR - Right to Erasure (Article 17)
    // ========================================

    requestDataDeletion: protectedProcedure
        .input(
            z.object({
                reason: z.string().min(1, 'Please provide a reason for deletion'),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const requestId = await gdprService.requestDataDeletion(
                ctx.user.id,
                input.reason,
                ctx.rateLimitContext.ip,
                ctx.rateLimitContext.userAgent
            )
            return { success: true, requestId }
        }),

    getDataDeletionStatus: protectedProcedure
        .input(
            z.object({
                requestId: z.string().min(1),
            })
        )
        .query(async ({ ctx, input }) => {
            const request = await prisma.dataDeletionRequest.findFirst({
                where: {
                    id: input.requestId,
                    userId: ctx.user.id,
                },
                select: {
                    id: true,
                    status: true,
                    reason: true,
                    processedAt: true,
                    createdAt: true,
                },
            })

            if (!request) {
                return { success: false, request: null }
            }

            return { success: true, request }
        }),

    listMyDeletionRequests: protectedProcedure
        .input(
            z.object({
                limit: z.number().int().min(1).max(50).default(10),
            })
        )
        .query(async ({ ctx, input }) => {
            const requests = await prisma.dataDeletionRequest.findMany({
                where: { userId: ctx.user.id },
                orderBy: { createdAt: 'desc' },
                take: input.limit,
                select: {
                    id: true,
                    status: true,
                    reason: true,
                    processedAt: true,
                    createdAt: true,
                },
            })

            return { success: true, requests }
        }),

    // ========================================
    // GDPR - Consent Management (Article 7)
    // ========================================

    logConsent: protectedProcedure
        .input(
            z.object({
                consentType: z.enum([
                    'TERMS_OF_SERVICE',
                    'PRIVACY_POLICY',
                    'MARKETING',
                    'DATA_PROCESSING',
                    'COPY_TRADING_RISK',
                ]),
                version: z.string().min(1),
                granted: z.boolean(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            await gdprService.logConsent(
                ctx.user.id,
                input.consentType,
                input.version,
                input.granted,
                ctx.rateLimitContext.ip,
                ctx.rateLimitContext.userAgent
            )
            return { success: true }
        }),

    getMyConsents: protectedProcedure.query(async ({ ctx }) => {
        const consents = await prisma.consentLog.findMany({
            where: { userId: ctx.user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                consentType: true,
                version: true,
                granted: true,
                createdAt: true,
            },
        })

        // Group by consent type, take latest
        const latestConsents: Record<string, { granted: boolean; version: string; createdAt: Date }> = {}
        for (const consent of consents) {
            if (!latestConsents[consent.consentType]) {
                latestConsents[consent.consentType] = {
                    granted: consent.granted,
                    version: consent.version,
                    createdAt: consent.createdAt,
                }
            }
        }

        return { success: true, consents: latestConsents }
    }),

    hasConsent: protectedProcedure
        .input(
            z.object({
                consentType: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            const hasConsent = await gdprService.hasConsent(ctx.user.id, input.consentType)
            return { success: true, hasConsent }
        }),

    // ========================================
    // KYC - Identity Verification
    // ========================================

    submitKYC: protectedProcedure
        .input(
            z.object({
                fullName: z.string().min(2).max(100),
                dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
                nationality: z.string().length(2, 'Use ISO 3166-1 alpha-2 code'),
                address: z.object({
                    street: z.string().min(1),
                    city: z.string().min(1),
                    state: z.string().optional(),
                    postalCode: z.string().min(1),
                    country: z.string().length(2),
                }),
                documentType: z.enum(['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID']),
                documentNumber: z.string().min(1).max(50),
                documentExpiry: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
                documentImages: z.array(z.string().url()).min(1).max(5),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const verificationId = await kycService.submitKYCVerification(ctx.user.id, {
                ...input,
                dateOfBirth: new Date(input.dateOfBirth),
                documentExpiry: new Date(input.documentExpiry),
            })
            return { success: true, verificationId }
        }),

    getKYCStatus: protectedProcedure.query(async ({ ctx }) => {
        const status = await kycService.getKYCStatus(ctx.user.id)
        return { success: true, ...status }
    }),

    // ========================================
    // Audit Logs - User Access
    // ========================================

    getMyAuditLogs: protectedProcedure
        .input(
            z.object({
                limit: z.number().int().min(1).max(100).default(50),
                offset: z.number().int().min(0).default(0),
                operation: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const result = await auditLogService.getUserAuditLogs(ctx.user.id, {
                limit: input.limit,
                offset: input.offset,
                operation: input.operation,
            })
            return { success: true, ...result }
        }),

    verifyAuditLogIntegrity: protectedProcedure.query(async ({ ctx }) => {
        const result = await auditLogService.verifyAuditLogIntegrity(ctx.user.id)
        return {
            success: true,
            valid: result.valid,
            errors: result.errors,
            message: result.valid
                ? 'All audit logs are intact and untampered'
                : `Found ${result.errors.length} integrity issues`,
        }
    }),

    // ========================================
    // Admin Procedures (Comment 4)
    // KYC, AML, and Data Deletion Management
    // ========================================

    // KYC - List pending verifications (Admin)
    adminListKYCVerifications: adminProcedureSecure
        .input(
            z.object({
                status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
                page: z.number().int().min(1).default(1),
                limit: z.number().int().min(1).max(100).default(20),
            })
        )
        .query(async ({ input }) => {
            const skip = (input.page - 1) * input.limit
            const where = input.status ? { status: input.status } : {}

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
                pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) },
            }
        }),

    // KYC - Approve verification (Admin)
    adminApproveKYC: adminProcedureSecure
        .input(
            z.object({
                verificationId: z.string().min(1),
                tier: z.number().int().min(1).max(5).default(1),
                riskScore: z.number().min(0).max(100).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            await kycService.approveKYC(input.verificationId, ctx.user!.id, input.tier, input.riskScore)
            return { success: true, message: 'KYC verification approved' }
        }),

    // KYC - Reject verification (Admin)
    adminRejectKYC: adminProcedureSecure
        .input(
            z.object({
                verificationId: z.string().min(1),
                reason: z.string().min(1).max(500),
            })
        )
        .mutation(async ({ ctx, input }) => {
            await kycService.rejectKYC(input.verificationId, ctx.user!.id, input.reason)
            return { success: true, message: 'KYC verification rejected' }
        }),

    // AML - List open alerts (Admin)
    adminListAMLAlerts: adminProcedureSecure
        .input(
            z.object({
                status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED']).optional(),
                severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
                limit: z.number().int().min(1).max(100).default(50),
            })
        )
        .query(async ({ input }) => {
            const alerts = await amlService.getOpenAlerts({
                severity: input.severity,
                limit: input.limit,
            })
            return { success: true, alerts }
        }),

    // AML - Resolve alert (Admin)
    adminResolveAMLAlert: adminProcedureSecure
        .input(
            z.object({
                alertId: z.string().min(1),
                resolution: z.string().min(1).max(1000),
            })
        )
        .mutation(async ({ ctx, input }) => {
            await amlService.resolveAlert(input.alertId, ctx.user!.id, input.resolution)
            return { success: true, message: 'AML alert resolved' }
        }),

    // Data Deletion - List pending requests (Admin)
    adminListDataDeletionRequests: adminProcedureSecure
        .input(
            z.object({
                status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
                page: z.number().int().min(1).default(1),
                limit: z.number().int().min(1).max(100).default(20),
            })
        )
        .query(async ({ input }) => {
            const skip = (input.page - 1) * input.limit
            const where = input.status ? { status: input.status } : {}

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
                pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) },
            }
        }),

    // Data Deletion - Process request (Admin)
    adminProcessDataDeletion: adminProcedureSecure
        .input(
            z.object({
                requestId: z.string().min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            await gdprService.processDataDeletion(input.requestId, ctx.user!.id)
            return { success: true, message: 'Data deletion request processed' }
        }),
})
