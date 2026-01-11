import crypto from 'crypto'
import prisma from '../prisma'
import { logger } from '../logger'

export interface FinancialAuditEntry {
  userId: string
  operation: string
  resourceType: string
  resourceId: string
  amount?: number
  currency?: string
  feeAmount?: number
  metadata: Record<string, unknown>
  ipAddress: string
  userAgent?: string
}

class AuditLogService {
  async logFinancialOperation(entry: FinancialAuditEntry) {
    const previousLog = await prisma.financialAuditLog.findFirst({
      where: { userId: entry.userId },
      orderBy: { createdAt: 'desc' },
      select: { currentHash: true },
    })

    const createdAt = new Date()
    const previousHash = previousLog?.currentHash ?? 'GENESIS'

    const dataToHash = JSON.stringify({
      userId: entry.userId,
      operation: entry.operation,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      amount: entry.amount ?? null,
      currency: entry.currency ?? null,
      feeAmount: entry.feeAmount ?? null,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent ?? null,
      previousHash,
      createdAt: createdAt.toISOString(),
    })

    const currentHash = crypto.createHash('sha256').update(dataToHash).digest('hex')

    const record = await prisma.financialAuditLog.create({
      data: {
        userId: entry.userId,
        operation: entry.operation,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        amount: entry.amount,
        currency: entry.currency,
        feeAmount: entry.feeAmount,
        metadata: entry.metadata,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent ?? null,
        previousHash: previousHash === 'GENESIS' ? null : previousHash,
        currentHash,
        createdAt,
      },
    })

    logger.info('Financial audit log created', {
      userId: entry.userId,
      operation: entry.operation,
      hash: currentHash,
    })

    return record
  }

  async verifyAuditLogIntegrity(userId: string): Promise<{ valid: boolean; errors: string[] }> {
    const logs = await prisma.financialAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    const errors: string[] = []
    let previousHash: string | null = null

    for (const log of logs) {
      if (log.previousHash !== previousHash) {
        errors.push(`Hash chain broken at log ${log.id}`)
      }

      const dataToHash = JSON.stringify({
        userId: log.userId,
        operation: log.operation,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        amount: log.amount ?? null,
        currency: log.currency ?? null,
        feeAmount: log.feeAmount ?? null,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent ?? null,
        previousHash: log.previousHash ?? 'GENESIS',
        createdAt: log.createdAt.toISOString(),
      })

      const expectedHash = crypto.createHash('sha256').update(dataToHash).digest('hex')
      if (log.currentHash !== expectedHash) {
        errors.push(`Hash mismatch at log ${log.id}`)
      }

      previousHash = log.currentHash
    }

    return { valid: errors.length === 0, errors }
  }

  async getUserAuditLogs(
    userId: string,
    options: { limit?: number; offset?: number; cursor?: string; operation?: string } = {}
  ) {
    const { limit = 50, offset = 0, cursor, operation } = options
    const where: any = { userId }
    if (operation) where.operation = operation

    const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }] as const

    let logs: Awaited<ReturnType<typeof prisma.financialAuditLog.findMany>> = []
    let nextCursor: string | undefined

    if (cursor) {
      logs = await prisma.financialAuditLog.findMany({
        where,
        orderBy,
        take: limit + 1,
        cursor: { id: cursor },
        skip: 1,
      })

      if (logs.length > limit) {
        const next = logs.pop()
        nextCursor = next?.id
      }
    } else {
      logs = await prisma.financialAuditLog.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      })
    }

    const total = await prisma.financialAuditLog.count({ where })

    return { logs, total, nextCursor }
  }
}

export const auditLogService = new AuditLogService()
