/**
 * Log Retention Service
 * 
 * Implements data retention policies as specified in Plan6 Step 8.
 * - Financial Audit Logs: 7 years (regulatory requirement)
 * - Session Activities: 90 days
 * - Login Attempts: 30 days
 * - Data Exports: 7 days (file cleanup)
 */

import { rm } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import prisma from '../prisma'
import { logger } from '../logger'

// Retention periods in milliseconds
const RETENTION_PERIODS = {
    SESSION_ACTIVITY_DAYS: Number.parseInt(process.env.SESSION_ACTIVITY_RETENTION_DAYS || '90', 10),
    LOGIN_ATTEMPT_DAYS: Number.parseInt(process.env.LOGIN_ATTEMPT_RETENTION_DAYS || '30', 10),
    EXPORT_FILE_DAYS: Number.parseInt(process.env.DATA_EXPORT_EXPIRY_DAYS || '7', 10),
    AUDIT_LOG_ARCHIVE_DAYS: 365, // Archive financial logs after 1 year
}

interface CleanupResult {
    sessionActivities: number
    loginAttempts: number
    expiredExports: number
    archivedAuditLogs: number
}

class LogRetentionService {
    /**
     * Clean up expired logs based on retention policies
     * Should be run daily via cron job
     */
    async cleanupExpiredLogs(): Promise<CleanupResult> {
        const now = new Date()
        const result: CleanupResult = {
            sessionActivities: 0,
            loginAttempts: 0,
            expiredExports: 0,
            archivedAuditLogs: 0,
        }

        try {
            // Delete old session activities (90 days by default)
            const sessionActivityCutoff = new Date(
                now.getTime() - RETENTION_PERIODS.SESSION_ACTIVITY_DAYS * 24 * 60 * 60 * 1000
            )
            const deletedSessionActivities = await prisma.sessionActivity.deleteMany({
                where: { createdAt: { lt: sessionActivityCutoff } },
            })
            result.sessionActivities = deletedSessionActivities.count

            // Delete old login attempts (30 days by default)
            const loginAttemptCutoff = new Date(
                now.getTime() - RETENTION_PERIODS.LOGIN_ATTEMPT_DAYS * 24 * 60 * 60 * 1000
            )
            const deletedLoginAttempts = await prisma.loginAttempt.deleteMany({
                where: { createdAt: { lt: loginAttemptCutoff } },
            })
            result.loginAttempts = deletedLoginAttempts.count

            // Clean up expired data export files
            result.expiredExports = await this.cleanupExpiredExports(now)

            logger.info('Log retention cleanup completed', {
                sessionActivitiesDeleted: result.sessionActivities,
                loginAttemptsDeleted: result.loginAttempts,
                expiredExportsDeleted: result.expiredExports,
                retentionDays: {
                    sessionActivities: RETENTION_PERIODS.SESSION_ACTIVITY_DAYS,
                    loginAttempts: RETENTION_PERIODS.LOGIN_ATTEMPT_DAYS,
                    exports: RETENTION_PERIODS.EXPORT_FILE_DAYS,
                },
            })

            return result
        } catch (error) {
            logger.error('Log retention cleanup failed', { error })
            throw error
        }
    }

    /**
     * Clean up expired data export files and database records
     */
    private async cleanupExpiredExports(now: Date): Promise<number> {
        let deletedCount = 0

        try {
            // Find expired export requests
            const expiredExports = await prisma.dataExportRequest.findMany({
                where: {
                    expiresAt: { lt: now },
                    status: 'COMPLETED',
                },
            })

            for (const exportReq of expiredExports) {
                // Delete the file if it exists
                if (exportReq.fileUrl) {
                    try {
                        const filePath = exportReq.fileUrl.startsWith('/')
                            ? exportReq.fileUrl
                            : path.join(process.cwd(), exportReq.fileUrl)

                        await rm(filePath, { force: true })
                        logger.debug('Deleted expired export file', { path: filePath })
                    } catch (fileError) {
                        // File might already be deleted, continue
                        logger.debug('Could not delete export file', {
                            path: exportReq.fileUrl,
                            error: fileError,
                        })
                    }
                }

                // Delete the database record
                await prisma.dataExportRequest.delete({
                    where: { id: exportReq.id },
                })
                deletedCount++
            }

            return deletedCount
        } catch (error) {
            logger.error('Failed to cleanup expired exports', { error })
            return deletedCount
        }
    }

    /**
     * Archive old financial audit logs (move to cold storage)
     * Financial logs must be kept for 7 years but can be archived after 1 year.
     * This method prepares logs for archival but doesn't delete them.
     */
    async archiveOldAuditLogs(): Promise<{ count: number; archiveHash: string | null }> {
        const archiveCutoff = new Date(
            Date.now() - RETENTION_PERIODS.AUDIT_LOG_ARCHIVE_DAYS * 24 * 60 * 60 * 1000
        )

        try {
            // Find old audit logs that haven't been archived (process in batches)
            const oldLogs = await prisma.financialAuditLog.findMany({
                where: { createdAt: { lt: archiveCutoff } },
                take: 1000, // Process in batches of 1000
                orderBy: { createdAt: 'asc' },
            })

            if (oldLogs.length === 0) {
                return { count: 0, archiveHash: null }
            }

            // Create archive payload with hash for integrity verification
            const archivePayload = JSON.stringify(oldLogs)
            const archiveHash = crypto.createHash('sha256').update(archivePayload).digest('hex')

            // In production, this would upload to S3/cold storage
            // For now, we just log that archival would happen
            logger.info('Audit logs ready for archival', {
                count: oldLogs.length,
                archiveHash,
                dateRange: {
                    from: oldLogs[0].createdAt,
                    to: oldLogs[oldLogs.length - 1].createdAt,
                },
            })

            // Note: We don't delete the logs - they must be kept for 7 years
            // The archive is for moving to cheaper storage while keeping originals

            return { count: oldLogs.length, archiveHash }
        } catch (error) {
            logger.error('Failed to archive old audit logs', { error })
            throw error
        }
    }

    /**
     * Get retention policy configuration
     */
    getRetentionConfig() {
        return {
            sessionActivityDays: RETENTION_PERIODS.SESSION_ACTIVITY_DAYS,
            loginAttemptDays: RETENTION_PERIODS.LOGIN_ATTEMPT_DAYS,
            exportFileDays: RETENTION_PERIODS.EXPORT_FILE_DAYS,
            auditLogArchiveDays: RETENTION_PERIODS.AUDIT_LOG_ARCHIVE_DAYS,
            financialLogRetentionYears: 7, // Regulatory requirement
        }
    }

    /**
     * Get statistics about current log volumes
     */
    async getLogStats() {
        const now = new Date()

        const [
            totalSessionActivities,
            expiredSessionActivities,
            totalLoginAttempts,
            expiredLoginAttempts,
            totalAuditLogs,
            archivableAuditLogs,
            totalExports,
            expiredExports,
        ] = await Promise.all([
            prisma.sessionActivity.count(),
            prisma.sessionActivity.count({
                where: {
                    createdAt: {
                        lt: new Date(now.getTime() - RETENTION_PERIODS.SESSION_ACTIVITY_DAYS * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.loginAttempt.count(),
            prisma.loginAttempt.count({
                where: {
                    createdAt: {
                        lt: new Date(now.getTime() - RETENTION_PERIODS.LOGIN_ATTEMPT_DAYS * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.financialAuditLog.count(),
            prisma.financialAuditLog.count({
                where: {
                    createdAt: {
                        lt: new Date(now.getTime() - RETENTION_PERIODS.AUDIT_LOG_ARCHIVE_DAYS * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.dataExportRequest.count({ where: { status: 'COMPLETED' } }),
            prisma.dataExportRequest.count({
                where: { expiresAt: { lt: now }, status: 'COMPLETED' },
            }),
        ])

        return {
            sessionActivities: {
                total: totalSessionActivities,
                expired: expiredSessionActivities,
                retentionDays: RETENTION_PERIODS.SESSION_ACTIVITY_DAYS,
            },
            loginAttempts: {
                total: totalLoginAttempts,
                expired: expiredLoginAttempts,
                retentionDays: RETENTION_PERIODS.LOGIN_ATTEMPT_DAYS,
            },
            auditLogs: {
                total: totalAuditLogs,
                archivable: archivableAuditLogs,
                archiveAfterDays: RETENTION_PERIODS.AUDIT_LOG_ARCHIVE_DAYS,
            },
            dataExports: {
                total: totalExports,
                expired: expiredExports,
                retentionDays: RETENTION_PERIODS.EXPORT_FILE_DAYS,
            },
        }
    }
}

export const logRetentionService = new LogRetentionService()
