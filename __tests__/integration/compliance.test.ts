/**
 * Compliance Integration Tests
 * 
 * Tests for audit logging, GDPR, and KYC functionality.
 * Plan6 Step 12 implementation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import prisma from '../../src/lib/prisma'
import { auditLogService } from '../../src/lib/services/auditLog'
import { gdprService } from '../../src/lib/services/gdpr'
import { logRetentionService } from '../../src/lib/services/logRetention'

// Test user ID for isolation
const TEST_USER_ID = 'test-compliance-user-' + Date.now()
const TEST_IP = '127.0.0.1'

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip

describeIntegration('Compliance Integration Tests', () => {
    beforeAll(async () => {
        // Create test user
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                email: `${TEST_USER_ID}@test.local`,
                username: TEST_USER_ID,
                password: 'hashed-password',
            },
        })
    })

    afterAll(async () => {
        // Cleanup test data
        await prisma.financialAuditLog.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.consentLog.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.dataExportRequest.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.dataDeletionRequest.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => { })
    })

    describe('Audit Logging (Plan6 Step 2)', () => {
        it('should create tamper-proof audit log with hash chain', async () => {
            // Create first log entry
            const entry1 = await auditLogService.logFinancialOperation({
                userId: TEST_USER_ID,
                operation: 'SWAP',
                resourceType: 'Transaction',
                resourceId: 'tx-test-1',
                amount: 100,
                currency: 'USDC',
                metadata: { inputMint: 'SOL', outputMint: 'USDC' },
                ipAddress: TEST_IP,
            })

            expect(entry1).toBeDefined()
            expect(entry1.currentHash).toBeDefined()
            expect(entry1.currentHash.length).toBe(64) // SHA-256 hex

            // Create second log entry - should chain from first
            const entry2 = await auditLogService.logFinancialOperation({
                userId: TEST_USER_ID,
                operation: 'SEND',
                resourceType: 'Transaction',
                resourceId: 'tx-test-2',
                amount: 50,
                currency: 'SOL',
                metadata: { to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' },
                ipAddress: TEST_IP,
            })

            expect(entry2.previousHash).toBe(entry1.currentHash)
            expect(entry2.currentHash).not.toBe(entry1.currentHash)
        })

        it('should verify audit log integrity', async () => {
            const result = await auditLogService.verifyAuditLogIntegrity(TEST_USER_ID)

            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should retrieve user audit logs with pagination', async () => {
            const { logs, total } = await auditLogService.getUserAuditLogs(TEST_USER_ID, {
                limit: 10,
                offset: 0,
            })

            expect(logs.length).toBeGreaterThanOrEqual(2)
            expect(total).toBeGreaterThanOrEqual(2)
            expect(logs[0].operation).toBeDefined()
        })

        it('should filter audit logs by operation', async () => {
            const { logs } = await auditLogService.getUserAuditLogs(TEST_USER_ID, {
                operation: 'SWAP',
            })

            expect(logs.every((log) => log.operation === 'SWAP')).toBe(true)
        })
    })

    describe('GDPR Consent Management (Plan6 Step 4)', () => {
        it('should log user consent', async () => {
            await gdprService.logConsent(
                TEST_USER_ID,
                'TERMS_OF_SERVICE',
                '1.0.0',
                true,
                TEST_IP,
                'Jest Test Agent'
            )

            const hasConsent = await gdprService.hasConsent(TEST_USER_ID, 'TERMS_OF_SERVICE')
            expect(hasConsent).toBe(true)
        })

        it('should track consent withdrawal', async () => {
            await gdprService.logConsent(TEST_USER_ID, 'MARKETING', '1.0.0', true, TEST_IP)
            let hasConsent = await gdprService.hasConsent(TEST_USER_ID, 'MARKETING')
            expect(hasConsent).toBe(true)

            // Withdraw consent
            await gdprService.logConsent(TEST_USER_ID, 'MARKETING', '1.0.0', false, TEST_IP)
            hasConsent = await gdprService.hasConsent(TEST_USER_ID, 'MARKETING')
            expect(hasConsent).toBe(false)
        })

        it('should return false for unconsented types', async () => {
            const hasConsent = await gdprService.hasConsent(TEST_USER_ID, 'NON_EXISTENT_TYPE')
            expect(hasConsent).toBe(false)
        })
    })

    describe('GDPR Data Export (Plan6 Step 4)', () => {
        it('should create data export request', async () => {
            const requestId = await gdprService.requestDataExport(TEST_USER_ID, 'JSON')

            expect(requestId).toBeDefined()

            const request = await prisma.dataExportRequest.findUnique({
                where: { id: requestId },
            })

            expect(request).not.toBeNull()
            expect(request?.status).toBe('PENDING')
            expect(request?.format).toBe('JSON')
        })
    })

    describe('GDPR Data Deletion (Plan6 Step 4)', () => {
        it('should create data deletion request', async () => {
            const requestId = await gdprService.requestDataDeletion(
                TEST_USER_ID,
                'User requested account deletion',
                TEST_IP,
                'Jest Test Agent'
            )

            expect(requestId).toBeDefined()

            const request = await prisma.dataDeletionRequest.findUnique({
                where: { id: requestId },
            })

            expect(request).not.toBeNull()
            expect(request?.status).toBe('PENDING')
            expect(request?.reason).toBe('User requested account deletion')
        })
    })

    describe('Log Retention Service (Plan6 Step 8)', () => {
        it('should return retention configuration', () => {
            const config = logRetentionService.getRetentionConfig()

            expect(config.sessionActivityDays).toBe(90)
            expect(config.loginAttemptDays).toBe(30)
            expect(config.exportFileDays).toBe(7)
            expect(config.financialLogRetentionYears).toBe(7)
        })

        it('should get log statistics', async () => {
            const stats = await logRetentionService.getLogStats()

            expect(stats.sessionActivities).toBeDefined()
            expect(stats.loginAttempts).toBeDefined()
            expect(stats.auditLogs).toBeDefined()
            expect(stats.dataExports).toBeDefined()

            expect(typeof stats.sessionActivities.total).toBe('number')
            expect(typeof stats.auditLogs.total).toBe('number')
        })

        it('should run cleanup without errors', async () => {
            const result = await logRetentionService.cleanupExpiredLogs()

            expect(result).toBeDefined()
            expect(typeof result.sessionActivities).toBe('number')
            expect(typeof result.loginAttempts).toBe('number')
            expect(typeof result.expiredExports).toBe('number')
        })
    })
})
