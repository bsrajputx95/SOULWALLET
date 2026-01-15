/**
 * Alert Manager Service
 * 
 * Real-time alerts for rate limit violations and attacks.
 * - Email alerts via existing email service
 * - Webhook support (Slack, Discord, custom)
 * - Alert throttling (max 1 per 5 minutes per type)
 * - Priority levels (INFO, WARNING, CRITICAL)
 */

import { logger } from '../logger'


type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

type AlertType =
    | 'RATE_LIMIT_VIOLATION'
    | 'ATTACK_DETECTED'
    | 'QUEUE_FULL'
    | 'REDIS_FAILURE'
    | 'SUSPICIOUS_PATTERN'
    | 'POOL_EXHAUSTION'
    | 'ADAPTIVE_RATE_LIMIT_ACTIVATED'
    | 'ADAPTIVE_RATE_LIMIT_RESTORED'
    | 'PROMETHEUS_ALERT'

// Prometheus AlertManager webhook payload interface
interface PrometheusAlertPayload {
    version: string
    groupKey: string
    status: 'firing' | 'resolved'
    receiver: string
    groupLabels: Record<string, string>
    commonLabels: Record<string, string>
    commonAnnotations: Record<string, string>
    externalURL: string
    alerts: Array<{
        status: 'firing' | 'resolved'
        labels: Record<string, string>
        annotations: Record<string, string>
        startsAt: string
        endsAt: string
        generatorURL: string
        fingerprint: string
    }>
}

interface Alert {
    id: string
    type: AlertType
    severity: AlertSeverity
    timestamp: number
    data: Record<string, unknown>
    message: string
    delivered: boolean
    channels: string[]
}

interface AlertChannel {
    name: string
    enabled: boolean
    send: (alert: Alert) => Promise<void>
}

interface WebhookConfig {
    url: string
    secret: string | undefined
    retryAttempts: number
}

class AlertManager {
    private alerts: Alert[] = []
    private maxAlerts = 1000
    private throttleMs: number
    private minSeverity: AlertSeverity
    private channels: Map<string, AlertChannel> = new Map()
    private throttleMap: Map<string, number> = new Map()
    private alertCounter = 0
    private webhookConfig: WebhookConfig | null = null
    private emailRecipients: string[] = []

    constructor() {
        this.throttleMs = parseInt(process.env.ALERT_THROTTLE_MINUTES || '5') * 60 * 1000
        this.minSeverity = (process.env.ALERT_MIN_SEVERITY as AlertSeverity) || 'WARNING'

        this.loadConfig()
        this.initChannels()
    }

    private loadConfig(): void {
        // Email recipients
        const emailConfig = process.env.ALERT_EMAIL_RECIPIENTS
        if (emailConfig) {
            this.emailRecipients = emailConfig.split(',').map((e) => e.trim()).filter(Boolean)
        }

        // Webhook config
        const webhookUrl = process.env.ALERT_WEBHOOK_URL
        if (webhookUrl) {
            this.webhookConfig = {
                url: webhookUrl,
                secret: process.env.ALERT_WEBHOOK_SECRET,
                retryAttempts: parseInt(process.env.ALERT_WEBHOOK_RETRY_ATTEMPTS || '3'),
            }
        }
    }

    private initChannels(): void {
        // Console/Log channel (always enabled)
        this.channels.set('log', {
            name: 'log',
            enabled: true,
            send: async (alert) => {
                const logMethod = alert.severity === 'CRITICAL' ? 'error' : alert.severity === 'WARNING' ? 'warn' : 'info'
                logger[logMethod](`[ALERT] ${alert.type}: ${alert.message}`, alert.data)
            },
        })


        // Email channel
        if (this.emailRecipients.length > 0 && process.env.ENABLE_RATE_LIMIT_ALERTS === 'true') {
            this.channels.set('email', {
                name: 'email',
                enabled: true,
                send: async (alert) => {
                    if (alert.severity !== 'CRITICAL') return // Only email critical alerts
                    await this.sendEmailAlert(alert)
                },
            })
        }

        // Webhook channel
        if (this.webhookConfig) {
            this.channels.set('webhook', {
                name: 'webhook',
                enabled: true,
                send: async (alert) => {
                    await this.sendWebhookAlert(alert)
                },
            })
        }

        // Sentry channel (for critical alerts)
        this.channels.set('sentry', {
            name: 'sentry',
            enabled: true,
            send: async (alert) => {
                if (alert.severity === 'CRITICAL') {
                    try {
                        const Sentry = await import('@sentry/node')
                        Sentry.captureMessage(`[SECURITY ALERT] ${alert.type}: ${alert.message}`, {
                            level: 'error',
                            extra: alert.data,
                            tags: { alertType: alert.type, severity: alert.severity },
                        })
                    } catch {
                        // Sentry not available
                    }
                }
            },
        })
    }

    private generateAlertId(): string {
        return `alert_${Date.now()}_${++this.alertCounter}`
    }

    private shouldThrottle(type: AlertType): boolean {
        const lastSent = this.throttleMap.get(type)
        if (!lastSent) return false
        return Date.now() - lastSent < this.throttleMs
    }

    private severityValue(severity: AlertSeverity): number {
        switch (severity) {
            case 'INFO': return 1
            case 'WARNING': return 2
            case 'CRITICAL': return 3
        }
    }

    private shouldSend(severity: AlertSeverity): boolean {
        return this.severityValue(severity) >= this.severityValue(this.minSeverity)
    }

    /**
     * Send an alert
     */
    async sendAlert(
        type: AlertType,
        severity: AlertSeverity,
        message: string,
        data: Record<string, unknown> = {}
    ): Promise<Alert | null> {
        // Check severity threshold
        if (!this.shouldSend(severity)) {
            return null
        }

        // Check throttling
        if (this.shouldThrottle(type)) {
            logger.debug('[AlertManager] Alert throttled', { type })
            return null
        }

        const alert: Alert = {
            id: this.generateAlertId(),
            type,
            severity,
            timestamp: Date.now(),
            data,
            message,
            delivered: false,
            channels: [],
        }

        // Store alert
        this.alerts.push(alert)
        if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(-this.maxAlerts / 2)
        }

        // Update throttle
        this.throttleMap.set(type, Date.now())

        // Send to all enabled channels
        const sendPromises: Promise<void>[] = []
        for (const [name, channel] of this.channels) {
            if (channel.enabled) {
                sendPromises.push(
                    channel.send(alert).then(() => {
                        alert.channels.push(name)
                    }).catch((error) => {
                        logger.error(`[AlertManager] Failed to send to ${name}`, { error })
                    })
                )
            }
        }

        await Promise.allSettled(sendPromises)
        alert.delivered = alert.channels.length > 0

        return alert
    }

    private async sendEmailAlert(alert: Alert): Promise<void> {
        // Note: EmailService.sendEmail is private. For production alerts,
        // add a public sendAlertEmail method to EmailService.
        // For now, we log the alert and rely on other channels (webhook, Sentry).
        logger.warn('[AlertManager] Email alert (recipients configured but method unavailable)', {
            recipients: this.emailRecipients,
            alert: {
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
            },
        })
        // TODO: Add EmailService.sendAlertEmail(recipients, subject, content) method
    }

    private async sendWebhookAlert(alert: Alert): Promise<void> {
        if (!this.webhookConfig) return

        const payload = {
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            timestamp: alert.timestamp,
            message: alert.message,
            data: alert.data,
        }

        let lastError: Error | null = null
        for (let attempt = 0; attempt < this.webhookConfig.retryAttempts; attempt++) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                }

                // Add HMAC signature if secret is configured
                if (this.webhookConfig.secret) {
                    const crypto = await import('crypto')
                    const signature = crypto
                        .createHmac('sha256', this.webhookConfig.secret)
                        .update(JSON.stringify(payload))
                        .digest('hex')
                    headers['X-Signature'] = signature
                }

                const response = await fetch(this.webhookConfig.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                })

                if (response.ok) {
                    logger.info('[AlertManager] Webhook delivered', { alertId: alert.id })
                    return
                }

                lastError = new Error(`Webhook failed: ${response.status}`)
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))
            }

            // Exponential backoff
            if (attempt < this.webhookConfig.retryAttempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
            }
        }

        logger.error('[AlertManager] Webhook delivery failed after retries', { error: lastError })
    }

    /**
     * Get alert history
     */
    getAlertHistory(hours = 24): Alert[] {
        const since = Date.now() - hours * 60 * 60 * 1000
        return this.alerts.filter((a) => a.timestamp >= since)
    }

    /**
     * Get recent alerts by type
     */
    getAlertsByType(type: AlertType, count = 10): Alert[] {
        return this.alerts.filter((a) => a.type === type).slice(-count)
    }

    /**
     * Get alert statistics
     */
    getStats(): {
        totalAlerts: number
        alertsBySeverity: Record<AlertSeverity, number>
        alertsByType: Record<string, number>
        throttledCount: number
    } {
        const alertsBySeverity: Record<AlertSeverity, number> = {
            INFO: 0,
            WARNING: 0,
            CRITICAL: 0,
        }
        const alertsByType: Record<string, number> = {}

        for (const alert of this.alerts) {
            alertsBySeverity[alert.severity]++
            alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1
        }

        return {
            totalAlerts: this.alerts.length,
            alertsBySeverity,
            alertsByType,
            throttledCount: this.throttleMap.size,
        }
    }

    /**
     * Configure alert channel
     */
    configureAlertChannel(name: string, enabled: boolean): void {
        const channel = this.channels.get(name)
        if (channel) {
            channel.enabled = enabled
            logger.info('[AlertManager] Channel configured', { name, enabled })
        }
    }

    /**
     * Clear throttle for a specific type (for testing)
     */
    clearThrottle(type?: AlertType): void {
        if (type) {
            this.throttleMap.delete(type)
        } else {
            this.throttleMap.clear()
        }
    }

    /**
     * Handle Prometheus AlertManager webhook payload
     * Converts Prometheus alerts to internal alert format and processes them
     */
    async handlePrometheusWebhook(payload: PrometheusAlertPayload): Promise<Alert[]> {
        const processedAlerts: Alert[] = []

        for (const promAlert of payload.alerts) {
            // Map Prometheus severity labels to internal severity
            const promSeverity = promAlert.labels.severity?.toLowerCase() || 'warning'
            let severity: AlertSeverity
            switch (promSeverity) {
                case 'critical':
                    severity = 'CRITICAL'
                    break
                case 'warning':
                    severity = 'WARNING'
                    break
                default:
                    severity = 'INFO'
            }

            // Build message from annotations
            const message = promAlert.annotations.summary ||
                promAlert.annotations.description ||
                `Prometheus alert: ${promAlert.labels.alertname}`

            // Skip resolved alerts or process them differently
            if (promAlert.status === 'resolved') {
                logger.info('[AlertManager] Prometheus alert resolved', {
                    alertname: promAlert.labels.alertname,
                    fingerprint: promAlert.fingerprint
                })
                continue
            }

            // Create internal alert
            const alert = await this.sendAlert(
                'PROMETHEUS_ALERT',
                severity,
                message,
                {
                    alertname: promAlert.labels.alertname,
                    status: promAlert.status,
                    labels: promAlert.labels,
                    annotations: promAlert.annotations,
                    startsAt: promAlert.startsAt,
                    generatorURL: promAlert.generatorURL,
                    fingerprint: promAlert.fingerprint,
                    externalURL: payload.externalURL,
                    receiver: payload.receiver
                }
            )

            if (alert) {
                processedAlerts.push(alert)
            }
        }

        logger.info('[AlertManager] Processed Prometheus webhook', {
            totalAlerts: payload.alerts.length,
            firingAlerts: payload.alerts.filter(a => a.status === 'firing').length,
            resolvedAlerts: payload.alerts.filter(a => a.status === 'resolved').length,
            processedAlerts: processedAlerts.length
        })

        return processedAlerts
    }
}

// Singleton instance
export const alertManager = new AlertManager()

// Export types
export type { Alert, AlertType, AlertSeverity }
