import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'
import prisma from '../prisma'
import { logger } from '../logger'
import { getKeyManagementService } from './keyManagement'

class KYCService {
  private kms = getKeyManagementService()

  private wipe(buf: Buffer | null | undefined) {
    if (!buf) return
    try {
      buf.fill(0)
    } catch {
      void 0
    }
  }

  private deriveKey(dataKey: Buffer, salt: Buffer): Buffer {
    return pbkdf2Sync(dataKey, salt, 100000, 32, 'sha256')
  }

  private async encryptKYCData(
    data: Record<string, unknown>
  ): Promise<{
    encryptedData: string
    dataKeyCiphertext: string
    dataKeyKeyId: string
    keyIv: string
    keyTag: string
    keySalt: string
    keyVersion: number
  }> {
    const salt = randomBytes(32)
    const iv = randomBytes(16)
    const { plaintext: dataKey, ciphertext: dataKeyCiphertext, keyId: dataKeyKeyId } = await this.kms.generateDataKey()
    const derivedKey = this.deriveKey(dataKey, salt)

    try {
      const cipher = createCipheriv('aes-256-gcm', derivedKey, iv)
      const payload = Buffer.from(JSON.stringify(data), 'utf8')
      const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
      const tag = cipher.getAuthTag()
      const keyVersion = await this.kms.getCurrentKeyVersion()
      return {
        encryptedData: encrypted.toString('base64'),
        dataKeyCiphertext,
        dataKeyKeyId,
        keyIv: iv.toString('base64'),
        keyTag: tag.toString('base64'),
        keySalt: salt.toString('base64'),
        keyVersion,
      }
    } finally {
      this.wipe(derivedKey)
      this.wipe(dataKey)
      this.wipe(salt)
      this.wipe(iv)
    }
  }

  async submitKYCVerification(userId: string, data: Record<string, unknown>): Promise<string> {
    const encrypted = await this.encryptKYCData(data)

    const verification = await prisma.kYCVerification.upsert({
      where: { userId },
      update: {
        status: 'PENDING',
        encryptedData: encrypted.encryptedData,
        dataKeyCiphertext: encrypted.dataKeyCiphertext,
        dataKeyKeyId: encrypted.dataKeyKeyId,
        keyIv: encrypted.keyIv,
        keyTag: encrypted.keyTag,
        keySalt: encrypted.keySalt,
        keyVersion: encrypted.keyVersion,
      },
      create: {
        userId,
        status: 'PENDING',
        tier: 1,
        encryptedData: encrypted.encryptedData,
        dataKeyCiphertext: encrypted.dataKeyCiphertext,
        dataKeyKeyId: encrypted.dataKeyKeyId,
        keyIv: encrypted.keyIv,
        keyTag: encrypted.keyTag,
        keySalt: encrypted.keySalt,
        keyVersion: encrypted.keyVersion,
      },
    })

    logger.info('KYC verification submitted', { userId, verificationId: verification.id })
    return verification.id
  }

  async getDecryptedKYCData(userId: string): Promise<Record<string, unknown> | null> {
    const row = await prisma.kYCVerification.findUnique({
      where: { userId },
      select: {
        encryptedData: true,
        dataKeyCiphertext: true,
        dataKeyKeyId: true,
        keyIv: true,
        keyTag: true,
        keySalt: true,
      },
    })

    if (!row?.encryptedData || !row.dataKeyCiphertext || !row.dataKeyKeyId || !row.keyIv || !row.keyTag || !row.keySalt) {
      return null
    }

    const iv = Buffer.from(row.keyIv, 'base64')
    const tag = Buffer.from(row.keyTag, 'base64')
    const salt = Buffer.from(row.keySalt, 'base64')
    const dataKey = await this.kms.decryptDataKey(row.dataKeyCiphertext, row.dataKeyKeyId)
    const derivedKey = this.deriveKey(dataKey, salt)

    try {
      const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv)
      decipher.setAuthTag(tag)
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(row.encryptedData, 'base64')),
        decipher.final(),
      ])
      return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>
    } finally {
      this.wipe(derivedKey)
      this.wipe(dataKey)
      this.wipe(salt)
      this.wipe(iv)
    }
  }

  async approveKYC(verificationId: string, adminUserId: string, tier: number, riskScore?: number): Promise<void> {
    await prisma.kYCVerification.update({
      where: { id: verificationId },
      data: {
        status: 'APPROVED',
        tier,
        verifiedAt: new Date(),
        verifiedBy: adminUserId,
        riskScore,
        riskLevel: riskScore === undefined ? null : this.calculateRiskLevel(riskScore),
      },
    })

    logger.info('KYC approved', { verificationId, tier })
  }

  async rejectKYC(verificationId: string, adminUserId: string, reason: string): Promise<void> {
    await prisma.kYCVerification.update({
      where: { id: verificationId },
      data: {
        status: 'REJECTED',
        verifiedBy: adminUserId,
        rejectionReason: reason,
      },
    })

    logger.info('KYC rejected', { verificationId, reason })
  }

  async getKYCStatus(userId: string): Promise<{ verified: boolean; tier: number; status: string }> {
    const kyc = await prisma.kYCVerification.findUnique({
      where: { userId },
      select: { status: true, tier: true },
    })

    return {
      verified: kyc?.status === 'APPROVED',
      tier: kyc?.tier ?? 0,
      status: kyc?.status ?? 'NOT_SUBMITTED',
    }
  }

  private calculateRiskLevel(score: number): string {
    if (score < 30) return 'LOW'
    if (score < 70) return 'MEDIUM'
    return 'HIGH'
  }
}

class AMLService {
  private largeThreshold = Number.parseFloat(process.env.AML_LARGE_TRANSACTION_THRESHOLD || '10000')
  private highFrequencyThreshold = Number.parseInt(process.env.AML_HIGH_FREQUENCY_THRESHOLD || '20', 10)

  async monitorTransaction(
    userId: string,
    transactionId: string,
    transactionHash: string,
    amount: number,
    currency: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const alerts: Array<{ type: string; severity: string; description: string }> = []

    if (Number.isFinite(this.largeThreshold) && amount > this.largeThreshold) {
      alerts.push({
        type: 'LARGE_TRANSACTION',
        severity: 'MEDIUM',
        description: `Large transaction detected: ${amount} ${currency}`,
      })
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [recentTxCount, recentPositionCount] = await Promise.all([
      prisma.transaction.count({
        where: {
          userId,
          createdAt: { gte: oneHourAgo },
        },
      }),
      prisma.position.count({
        where: {
          copyTrading: { userId },
          createdAt: { gte: oneHourAgo },
        },
      }),
    ])

    const recentCount = recentTxCount + recentPositionCount
    if (Number.isFinite(this.highFrequencyThreshold) && recentCount > this.highFrequencyThreshold) {
      alerts.push({
        type: 'HIGH_FREQUENCY',
        severity: 'HIGH',
        description: `High frequency activity detected: ${recentCount} operations in 1 hour`,
      })
    }

    for (const alert of alerts) {
      await prisma.aMLAlert.create({
        data: {
          userId,
          alertType: alert.type,
          severity: alert.severity,
          description: alert.description,
          transactionId,
          transactionHash,
          amount,
          currency,
          status: 'OPEN',
          ...(metadata ? { metadata } : {}),
        },
      })

      logger.warn('AML alert created', { userId, alertType: alert.type })
    }
  }

  async getOpenAlerts(options: { severity?: string; limit?: number } = {}) {
    const { severity, limit = 50 } = options
    const where: any = { status: 'OPEN' }
    if (severity) where.severity = severity

    return prisma.aMLAlert.findMany({
      where,
      include: { user: { select: { id: true, email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async resolveAlert(alertId: string, adminUserId: string, resolution: string): Promise<void> {
    await prisma.aMLAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        assignedTo: adminUserId,
        resolution,
        resolvedAt: new Date(),
      },
    })

    logger.info('AML alert resolved', { alertId })
  }
}

export const kycService = new KYCService()
export const amlService = new AMLService()

