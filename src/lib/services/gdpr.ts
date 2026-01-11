import fs from 'fs/promises'
import path from 'path'
import prisma from '../prisma'
import { logger } from '../logger'

type ExportFormat = 'JSON' | 'CSV'

class GDPRService {
  async requestDataExport(userId: string, format: ExportFormat = 'JSON'): Promise<string> {
    const request = await prisma.dataExportRequest.create({
      data: {
        userId,
        format,
        status: 'PENDING',
      },
    })

    this.processDataExport(request.id).catch((error) => {
      logger.error('Data export failed', { requestId: request.id, error })
    })

    return request.id
  }

  private async processDataExport(requestId: string): Promise<void> {
    const request = await prisma.dataExportRequest.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true, format: true },
    })

    if (!request) return

    try {
      await prisma.dataExportRequest.update({
        where: { id: requestId },
        data: { status: 'PROCESSING' },
      })

      const userData = await this.collectUserData(request.userId)

      const exportDir = path.join(process.cwd(), 'exports')
      await fs.mkdir(exportDir, { recursive: true })

      const filename = `user_data_${request.userId}_${Date.now()}.${request.format.toLowerCase()}`
      const filepath = path.join(exportDir, filename)

      if (request.format === 'JSON') {
        await fs.writeFile(filepath, JSON.stringify(userData, null, 2), 'utf8')
      } else {
        await fs.writeFile(filepath, this.convertToCSV(userData), 'utf8')
      }

      const stats = await fs.stat(filepath)
      const expiryDays = Number.parseInt(process.env.DATA_EXPORT_EXPIRY_DAYS || '7', 10)
      const expiresAt = new Date(Date.now() + (Number.isFinite(expiryDays) ? expiryDays : 7) * 24 * 60 * 60 * 1000)

      await prisma.dataExportRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          fileUrl: `exports/${filename}`,
          fileSize: stats.size,
          expiresAt,
          processedAt: new Date(),
        },
      })

      logger.info('Data export completed', { requestId, userId: request.userId })
    } catch (error) {
      try {
        await prisma.dataExportRequest.update({
          where: { id: requestId },
          data: { status: 'FAILED' },
        })
      } catch {
        void 0
      }
      throw error
    }
  }

  private async collectUserData(userId: string) {
    const [user, sessions, transactions, contacts, notifications, portfolioSnapshots, sessionActivities, copyTrades, positions, posts, auditLogs, kycVerification] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.session.findMany({ where: { userId } }),
        prisma.transaction.findMany({ where: { userId } }),
        prisma.contact.findMany({ where: { userId } }),
        prisma.notification.findMany({ where: { userId } }),
        prisma.portfolioSnapshot.findMany({ where: { userId } }),
        prisma.sessionActivity.findMany({ where: { userId } }),
        prisma.copyTrading.findMany({ where: { userId }, include: { trader: true } }),
        prisma.position.findMany({ where: { copyTrading: { userId } } }),
        prisma.post.findMany({ where: { userId } }),
        prisma.financialAuditLog.findMany({ where: { userId } }),
        prisma.kYCVerification.findUnique({ where: { userId } }),
      ])

    const { password, ...safeUser } = (user as any) || {}

    return {
      user: safeUser,
      sessions,
      transactions,
      contacts,
      notifications,
      portfolioSnapshots,
      sessionActivities,
      copyTrades,
      positions,
      posts,
      auditLogs,
      kycVerification,
      exportedAt: new Date().toISOString(),
    }
  }

  private convertToCSV(data: unknown): string {
    return JSON.stringify(data)
  }

  async requestDataDeletion(
    userId: string,
    reason: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<string> {
    const request = await prisma.dataDeletionRequest.create({
      data: {
        userId,
        reason,
        status: 'PENDING',
        ipAddress,
        userAgent: userAgent ?? null,
      },
    })

    logger.info('Data deletion requested', { userId, requestId: request.id })
    return request.id
  }

  async processDataDeletion(requestId: string, adminUserId: string): Promise<void> {
    const request = await prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true, status: true },
    })

    if (!request) throw new Error('Deletion request not found')
    if (request.status !== 'PENDING') throw new Error('Request already processed')

    await prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING', processedBy: adminUserId },
    })

    try {
      const deletedData: Record<string, number> = {}

      // Fetch user email for OTP deletion (Comment 2 fix)
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { email: true },
      })

      deletedData.sessions = await prisma.session.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      // Comment 2 fix: Delete OTPs using user's actual email instead of empty array
      deletedData.otps = user?.email
        ? await prisma.oTP.deleteMany({ where: { email: user.email } }).then((r) => r.count).catch(() => 0)
        : 0
      deletedData.transactions = await prisma.transaction.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.contacts = await prisma.contact.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.notifications = await prisma.notification.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.portfolioSnapshots = await prisma.portfolioSnapshot.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.sessionActivities = await prisma.sessionActivity.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.posts = await prisma.post.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.copyTrades = await prisma.copyTrading.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.custodialWallets = await prisma.custodialWallet.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)
      deletedData.apiKeys = await prisma.apiKey.deleteMany({ where: { userId: request.userId } }).then((r) => r.count)

      await prisma.user.update({
        where: { id: request.userId },
        data: {
          email: `deleted_${request.userId}@deleted.local`,
          username: `deleted_${request.userId}`,
          password: 'DELETED',
          name: 'DELETED',
          walletAddress: null,
          bio: null,
          profileImage: null,
          coverImage: null,
          isVerified: false,
        },
      })

      await prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          deletedData,
        },
      })

      logger.info('Data deletion completed', { requestId, userId: request.userId })
    } catch (error) {
      await prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED' },
      })
      throw error
    }
  }

  async logConsent(
    userId: string,
    consentType: string,
    version: string,
    granted: boolean,
    ipAddress: string,
    userAgent?: string
  ): Promise<void> {
    await prisma.consentLog.create({
      data: {
        userId,
        consentType,
        version,
        granted,
        ipAddress,
        userAgent: userAgent ?? null,
      },
    })

    logger.info('Consent logged', { userId, consentType, granted })
  }

  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const latestConsent = await prisma.consentLog.findFirst({
      where: { userId, consentType },
      orderBy: { createdAt: 'desc' },
    })

    return latestConsent?.granted ?? false
  }
}

export const gdprService = new GDPRService()

