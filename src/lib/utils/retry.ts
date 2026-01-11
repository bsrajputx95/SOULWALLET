/**
 * Retry Utility
 * 
 * Provides exponential backoff retry logic for transient failures.
 * Plan7 Step 6 implementation.
 */

import { logger } from '../logger'
import { TIMEOUTS } from '@/constants'

export interface RetryConfig {
    maxRetries: number
    initialDelayMs: number
    maxDelayMs: number
    backoffMultiplier: number
    retryableErrors?: string[]
    onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

const DEFAULT_CONFIG: RetryConfig = {
    maxRetries: TIMEOUTS.RETRY.MAX_ATTEMPTS,
    initialDelayMs: TIMEOUTS.RETRY.INITIAL_DELAY_MS,
    maxDelayMs: TIMEOUTS.RETRY.MAX_DELAY_MS,
    backoffMultiplier: TIMEOUTS.RETRY.BACKOFF_MULTIPLIER,
    retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'NETWORK_ERROR',
        'SOCKET_HANG_UP',
        'EAI_AGAIN',
        'RATE_LIMIT',
        '429',
        '502',
        '503',
        '504',
    ],
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error, retryablePatterns: string[]): boolean {
    const errorString = `${error.name} ${error.message}`.toUpperCase()

    return retryablePatterns.some((pattern) => errorString.includes(pattern.toUpperCase()))
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)

    // Add jitter (±20%) to prevent thundering herd
    const jitter = cappedDelay * (0.8 + Math.random() * 0.4)

    return Math.floor(jitter)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with exponential backoff retry
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config }
    let lastError: Error = new Error('No attempts made')

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            // Check if we should retry
            if (attempt >= finalConfig.maxRetries) {
                break
            }

            // Check if error is retryable
            if (
                finalConfig.retryableErrors &&
                !isRetryableError(lastError, finalConfig.retryableErrors)
            ) {
                break
            }

            // Calculate delay and wait
            const delay = calculateDelay(attempt, finalConfig)

            // Call retry callback if provided
            if (finalConfig.onRetry) {
                finalConfig.onRetry(attempt + 1, lastError, delay)
            }

            logger.debug('Retrying operation', {
                attempt: attempt + 1,
                maxRetries: finalConfig.maxRetries,
                delayMs: delay,
                error: lastError.message,
            })

            await sleep(delay)
        }
    }

    throw lastError
}

/**
 * Wrap a fetch call with retry logic
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
    return retryWithBackoff(async () => {
        const response = await fetch(url, options)

        // Treat certain HTTP status codes as retryable
        if (response.status === 429 || response.status >= 500) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
            error.name = String(response.status)
            throw error
        }

        return response
    }, retryConfig)
}

/**
 * Create a retry-wrapped version of any async function
 */
export function withRetry<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => retryWithBackoff(() => fn(...args), config)
}

/**
 * Get default retry configuration
 */
export function getDefaultRetryConfig(): RetryConfig {
    return { ...DEFAULT_CONFIG }
}

/**
 * Create custom retry configuration from environment
 */
export function createRetryConfigFromEnv(): RetryConfig {
    return {
        maxRetries: Number.parseInt(process.env.RETRY_MAX_ATTEMPTS || String(TIMEOUTS.RETRY.MAX_ATTEMPTS), 10),
        initialDelayMs: Number.parseInt(process.env.RETRY_INITIAL_DELAY || String(TIMEOUTS.RETRY.INITIAL_DELAY_MS), 10),
        maxDelayMs: Number.parseInt(process.env.RETRY_MAX_DELAY || String(TIMEOUTS.RETRY.MAX_DELAY_MS), 10),
        backoffMultiplier: Number.parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || String(TIMEOUTS.RETRY.BACKOFF_MULTIPLIER)),
        retryableErrors: DEFAULT_CONFIG.retryableErrors ?? [],
    }
}
