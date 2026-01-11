/**
 * Webhook event types for external integrations
 * These events trigger webhook notifications to registered endpoints
 */
export const WEBHOOK_EVENTS = {
    TRADE: {
        EXECUTED: 'trade.executed',
        FAILED: 'trade.failed',
    },
    BALANCE: {
        CHANGED: 'balance.changed',
        LOW: 'balance.low',
    },
    POSITION: {
        OPENED: 'position.opened',
        CLOSED: 'position.closed',
        STOP_LOSS_TRIGGERED: 'position.stop_loss_triggered',
        TAKE_PROFIT_TRIGGERED: 'position.take_profit_triggered',
    },
    COPY_TRADING: {
        STARTED: 'copy_trading.started',
        STOPPED: 'copy_trading.stopped',
        TRADE_COPIED: 'copy_trading.trade_copied',
    },
} as const;

export type WebhookEventType =
    | typeof WEBHOOK_EVENTS.TRADE[keyof typeof WEBHOOK_EVENTS.TRADE]
    | typeof WEBHOOK_EVENTS.BALANCE[keyof typeof WEBHOOK_EVENTS.BALANCE]
    | typeof WEBHOOK_EVENTS.POSITION[keyof typeof WEBHOOK_EVENTS.POSITION]
    | typeof WEBHOOK_EVENTS.COPY_TRADING[keyof typeof WEBHOOK_EVENTS.COPY_TRADING];

export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
    ...Object.values(WEBHOOK_EVENTS.TRADE),
    ...Object.values(WEBHOOK_EVENTS.BALANCE),
    ...Object.values(WEBHOOK_EVENTS.POSITION),
    ...Object.values(WEBHOOK_EVENTS.COPY_TRADING),
];

/** Webhook delivery configuration */
export const WEBHOOK_CONFIG = {
    MAX_RETRIES: 3,
    TIMEOUT_MS: 5_000,
    BACKOFF_MULTIPLIER: 2,
    SECRET_MIN_LENGTH: 32,
} as const;
