import * as amqp from 'amqplib'
import type { Channel, ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib'
import { logger } from '../logger'
import { executionQueue } from './executionQueue'

type CopyTradeBuyPayload = {
  executionQueueId: string
  userId: string
  copyTradingId: string
  tokenMint: string
  amount: number
  detectedTxId: string
  priority?: number
}

type QueueMessage =
  | {
      kind: 'COPY_TRADE_BUY'
      payload: CopyTradeBuyPayload
      meta?: { attempt?: number }
    }

const QUEUES = {
  copyTrades: 'copy-trades',
  copyTradesDlq: 'copy-trades.dlq',
} as const

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function delayForAttempt(baseDelayMs: number, attempt: number): number {
  const cappedAttempt = Math.max(1, Math.min(attempt, 6))
  return baseDelayMs * Math.pow(2, cappedAttempt - 1)
}

class MessageQueueService {
  private connection: ChannelModel | null = null
  private publisher: ConfirmChannel | null = null
  private consumer: Channel | null = null
  private connecting: Promise<void> | null = null
  private consuming = false

  isEnabled(): boolean {
    return !!process.env.RABBITMQ_URL
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled()) return
    if (this.connection && this.publisher && this.consumer) return
    if (this.connecting) return this.connecting

    this.connecting = (async () => {
      const url = process.env.RABBITMQ_URL!
      const retryAttempts = readIntEnv('RABBITMQ_RETRY_ATTEMPTS', 3)
      const retryDelayMs = readIntEnv('RABBITMQ_RETRY_DELAY_MS', 5000)

      let lastError: unknown = null
      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        try {
          this.connection = await amqp.connect(url)
          this.connection.on('error', (err) => logger.error('[RabbitMQ] Connection error', { error: err }))
          this.connection.on('close', () => logger.warn('[RabbitMQ] Connection closed'))

          this.publisher = await this.connection.createConfirmChannel()
          this.consumer = await this.connection.createChannel()

          const prefetch = readIntEnv('RABBITMQ_PREFETCH', 10)
          await this.consumer.prefetch(prefetch)

          await this.ensureTopology()

          logger.info('[RabbitMQ] Connected')
          return
        } catch (err) {
          lastError = err
          logger.warn('[RabbitMQ] Connect attempt failed', {
            attempt,
            retryAttempts,
            error: err instanceof Error ? err.message : String(err),
          })
          await new Promise((r) => setTimeout(r, retryDelayMs))
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Failed to connect to RabbitMQ')
    })()

    try {
      await this.connecting
    } finally {
      this.connecting = null
    }
  }

  private async ensureTopology(): Promise<void> {
    if (!this.publisher || !this.consumer) return

    await this.publisher.assertQueue(QUEUES.copyTrades, { durable: true })
    await this.publisher.assertQueue(QUEUES.copyTradesDlq, { durable: true })
  }

  private async publishRaw(queue: string, message: QueueMessage): Promise<void> {
    await this.initialize()
    if (!this.publisher) throw new Error('RabbitMQ publisher not initialized')

    const payload = Buffer.from(JSON.stringify(message), 'utf8')

    this.publisher.sendToQueue(queue, payload, {
      persistent: true,
      contentType: 'application/json',
    })

    await new Promise<void>((resolve, reject) => {
      this.publisher!.waitForConfirms().then(resolve).catch(reject)
    })
  }

  async publishCopyTradeBuy(payload: CopyTradeBuyPayload): Promise<void> {
    await this.publishRaw(QUEUES.copyTrades, { kind: 'COPY_TRADE_BUY', payload, meta: { attempt: 0 } })
  }

  async startConsumers(): Promise<void> {
    if (!this.isEnabled()) return
    await this.initialize()
    if (!this.consumer) throw new Error('RabbitMQ consumer not initialized')
    if (this.consuming) return
    this.consuming = true

    const baseDelayMs = readIntEnv('RABBITMQ_RETRY_DELAY_MS', 5000)
    const maxAttempts = readIntEnv('RABBITMQ_RETRY_ATTEMPTS', 3)

    await this.consumer.consume(
      QUEUES.copyTrades,
      async (msg) => {
        if (!msg) return
        await this.handleCopyTradesMessage(msg, { baseDelayMs, maxAttempts })
      },
      { noAck: false }
    )
  }

  private async handleCopyTradesMessage(
    msg: ConsumeMessage,
    cfg: { baseDelayMs: number; maxAttempts: number }
  ): Promise<void> {
    if (!this.consumer) return

    let parsed: QueueMessage | null = null
    try {
      parsed = JSON.parse(msg.content.toString('utf8')) as QueueMessage
    } catch {
      await this.publishToDlq(msg, 'Invalid JSON')
      this.consumer.ack(msg)
      return
    }

    if (!parsed || parsed.kind !== 'COPY_TRADE_BUY') {
      await this.publishToDlq(msg, 'Unsupported message kind')
      this.consumer.ack(msg)
      return
    }

    const attempt = Math.max(0, parsed.meta?.attempt ?? 0)

    try {
      await executionQueue.enqueueBuyOrderJobOnly({
        userId: parsed.payload.userId,
        copyTradingId: parsed.payload.copyTradingId,
        tokenMint: parsed.payload.tokenMint,
        amount: parsed.payload.amount,
        detectedTxId: parsed.payload.detectedTxId,
        priority: parsed.payload.priority,
      })
      this.consumer.ack(msg)
    } catch (err) {
      const nextAttempt = attempt + 1
      const errorMessage = err instanceof Error ? err.message : String(err)

      if (nextAttempt >= cfg.maxAttempts) {
        await this.publishToDlq(msg, errorMessage)
        this.consumer.ack(msg)
        return
      }

      const delayMs = delayForAttempt(cfg.baseDelayMs, nextAttempt)
      logger.warn('[RabbitMQ] Message processing failed, scheduling retry', {
        queue: QUEUES.copyTrades,
        executionQueueId: parsed.payload.executionQueueId,
        attempt: nextAttempt,
        delayMs,
        error: errorMessage,
      })

      setTimeout(() => {
        this.publishRaw(QUEUES.copyTrades, {
          kind: 'COPY_TRADE_BUY',
          payload: parsed!.payload,
          meta: { attempt: nextAttempt },
        }).catch((publishErr) => {
          logger.error('[RabbitMQ] Failed to republish retry message', {
            error: publishErr instanceof Error ? publishErr.message : String(publishErr),
          })
        })
      }, delayMs).unref?.()

      this.consumer.ack(msg)
    }
  }

  private async publishToDlq(msg: ConsumeMessage, error: string): Promise<void> {
    try {
      const envelope = {
        error,
        receivedAt: new Date().toISOString(),
        headers: msg.properties.headers ?? {},
        content: msg.content.toString('utf8'),
      }
      await this.publishRaw(QUEUES.copyTradesDlq, {
        kind: 'COPY_TRADE_BUY',
        payload: envelope as any,
        meta: { attempt: -1 },
      })
    } catch (err) {
      logger.error('[RabbitMQ] Failed to publish to DLQ', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  async shutdown(): Promise<void> {
    this.consuming = false

    const consumer = this.consumer
    const publisher = this.publisher
    const connection = this.connection

    this.consumer = null
    this.publisher = null
    this.connection = null

    try {
      if (consumer) await consumer.close()
    } catch (err) {
      logger.warn('[RabbitMQ] Failed to close consumer channel', { error: err instanceof Error ? err.message : String(err) })
    }

    try {
      if (publisher) await publisher.close()
    } catch (err) {
      logger.warn('[RabbitMQ] Failed to close publisher channel', { error: err instanceof Error ? err.message : String(err) })
    }

    try {
      if (connection) await connection.close()
    } catch (err) {
      logger.warn('[RabbitMQ] Failed to close connection', { error: err instanceof Error ? err.message : String(err) })
    }
  }
}

export const messageQueue = new MessageQueueService()
