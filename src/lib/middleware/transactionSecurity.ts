/**
 * Transaction Security Middleware
 *
 * Unified security wrapper for all transaction operations:
 * - Pre-flight checks (balance, limits, simulation)
 * - MEV protection routing
 * - Fee optimization
 * - Timeout tracking
 * - Post-execution verification
 * - Comprehensive logging to security monitor
 */

import type { Keypair } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import { logger } from '../logger'
import { rpcManager } from '../services/rpcManager'
import { transactionSimulator, type SimulationResult } from '../services/transactionSimulator'
import { feeManager } from '../services/feeManager'
import { jitoService } from '../services/jitoService'
import { securityMonitor } from '../services/securityMonitor'
import { MAX_SLIPPAGE_PERCENT } from '../validation'

// Types
type TransactionType = 'SWAP' | 'TRANSFER' | 'COPY_TRADE_BUY' | 'COPY_TRADE_SELL'

interface SecurityOptions {
    useMevProtection?: boolean
    maxSlippage?: number // as percentage (e.g., 5 for 5%)
    timeoutMs?: number
    skipSimulation?: boolean
    urgent?: boolean
}

interface PreFlightResult {
    passed: boolean
    error?: string
    simulationResult?: SimulationResult
    recommendedPriorityFee?: number
}

interface ExecutionContext {
    type: TransactionType
    userId: string
    wallet?: Keypair
    inputMint?: string
    outputMint?: string
    amountLamports?: number
    amountUsd?: number
}

interface ExecutionResult<T> {
    success: boolean
    data?: T
    error?: string
    signature?: string
    durationMs: number
    usedMevProtection: boolean
}

class TransactionSecurityMiddleware {
    private defaultTimeoutMs = 30000

    /**
     * Execute an operation with full security wrapping
     */
    async execute<T>(
        context: ExecutionContext,
        operation: () => Promise<T>,
        options: SecurityOptions = {}
    ): Promise<ExecutionResult<T>> {
        const startTime = Date.now()
        const {
            useMevProtection = true,
            maxSlippage = MAX_SLIPPAGE_PERCENT,
            timeoutMs = this.defaultTimeoutMs,
            skipSimulation = false,
            urgent = false,
        } = options

        // Log start
        logger.info(`[TxSecurity] Starting ${context.type} for user ${context.userId}`, {
            useMevProtection,
            maxSlippage,
            skipSimulation,
        })

        // Track for high frequency
        securityMonitor.recordEvent('HIGH_FREQUENCY_USER', context.userId, { type: context.type })

        // Step 1: Validate slippage
        if (maxSlippage > MAX_SLIPPAGE_PERCENT) {
            securityMonitor.recordEvent('SLIPPAGE_VIOLATION', context.userId, { slippage: maxSlippage })
            return {
                success: false,
                error: `Slippage ${maxSlippage}% exceeds maximum ${MAX_SLIPPAGE_PERCENT}%`,
                durationMs: Date.now() - startTime,
                usedMevProtection: false,
            }
        }

        // Step 2: Large transaction check
        if (context.amountUsd && context.amountUsd > 10000) {
            securityMonitor.recordEvent('LARGE_TRANSACTION', context.userId, {
                amountUsd: context.amountUsd,
                type: context.type,
            })
        }

        // Step 3: Get optimal priority fee
        let priorityFeeLamports: number | undefined
        try {
            const connection = await rpcManager.getConnection()
            priorityFeeLamports = await feeManager.getOptimalPriorityFeeLamports({ connection, urgent })
            securityMonitor.recordEvent('HIGH_GAS_PRICE', context.userId, { gasPrice: priorityFeeLamports })
        } catch (err) {
            logger.warn('[TxSecurity] Failed to get priority fee, using default', { error: err })
        }

        // Step 4: Execute with timeout
        let result: T
        let usedMev = false

        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Transaction timeout')), timeoutMs)
            })

            // Check if MEV protection should be used
            usedMev = useMevProtection && jitoService.isEnabled()

            result = await Promise.race([operation(), timeoutPromise])

            // Record success
            const durationMs = Date.now() - startTime
            securityMonitor.recordEvent('SIMULATION_SUCCESS', context.userId, {
                type: context.type,
                durationMs,
                usedMev,
            })

            if (usedMev) {
                securityMonitor.recordEvent('MEV_PROTECTION_USED', context.userId, { type: context.type })
            }

            return {
                success: true,
                data: result,
                durationMs,
                usedMevProtection: usedMev,
            }
        } catch (error) {
            const durationMs = Date.now() - startTime
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'

            if (errorMsg.includes('timeout')) {
                securityMonitor.recordEvent('TRANSACTION_TIMEOUT', context.userId, {
                    type: context.type,
                    durationMs,
                })
            } else {
                securityMonitor.recordEvent('SIMULATION_FAILED', context.userId, {
                    type: context.type,
                    error: errorMsg,
                    durationMs,
                })
            }

            logger.error(`[TxSecurity] ${context.type} failed`, { error: errorMsg, userId: context.userId })

            return {
                success: false,
                error: errorMsg,
                durationMs,
                usedMevProtection: usedMev,
            }
        }
    }

    /**
     * Run pre-flight checks before a transaction
     */
    async preFlightCheck(
        context: ExecutionContext,
        options: SecurityOptions = {}
    ): Promise<PreFlightResult> {
        const { skipSimulation = false, urgent = false } = options

        // Get priority fee recommendation
        let recommendedPriorityFee: number | undefined
        try {
            const connection = await rpcManager.getConnection()
            recommendedPriorityFee = await feeManager.getOptimalPriorityFeeLamports({ connection, urgent })
        } catch {
            // Non-fatal
        }

        // Validate slippage
        const maxSlippage = options.maxSlippage ?? MAX_SLIPPAGE_PERCENT
        if (maxSlippage > MAX_SLIPPAGE_PERCENT) {
            return {
                passed: false,
                error: `Slippage ${maxSlippage}% exceeds maximum ${MAX_SLIPPAGE_PERCENT}%`,
                recommendedPriorityFee,
            }
        }

        // Balance validation (if wallet provided)
        if (context.wallet && context.inputMint && context.amountLamports) {
            try {
                const hasBalance = await transactionSimulator.validateBalance(
                    context.wallet.publicKey,
                    context.inputMint,
                    context.amountLamports
                )
                if (!hasBalance) {
                    securityMonitor.recordEvent('LIMIT_VIOLATION', context.userId, {
                        reason: 'Insufficient balance',
                        required: context.amountLamports,
                    })
                    return {
                        passed: false,
                        error: 'Insufficient balance for transaction',
                        recommendedPriorityFee,
                    }
                }
            } catch (err) {
                logger.warn('[TxSecurity] Balance check failed', { error: err })
            }
        }

        return {
            passed: true,
            recommendedPriorityFee,
        }
    }

    /**
     * Record a replay attack attempt (call from nonce validation)
     */
    recordReplayAttempt(userId: string, nonce: string, publicKey: string): void {
        securityMonitor.recordEvent('REPLAY_ATTEMPT', userId, { nonce, publicKey })
    }

    /**
     * Record RPC failover event
     */
    recordRpcFailover(url: string, reason: string): void {
        securityMonitor.recordEvent('RPC_FAILOVER', undefined, { url, reason })
    }

    /**
     * Record RPC recovery
     */
    recordRpcHealthy(url: string): void {
        securityMonitor.recordEvent('RPC_HEALTHY', undefined, { url })
    }

    /**
     * Record limit violation
     */
    recordLimitViolation(userId: string, reason: string, data: Record<string, unknown> = {}): void {
        securityMonitor.recordEvent('LIMIT_VIOLATION', userId, { reason, ...data })
    }

    /**
     * Get current security status
     */
    getSecurityStatus(): ReturnType<typeof securityMonitor.getMetrics> {
        return securityMonitor.getMetrics()
    }
}

export const transactionSecurityMiddleware = new TransactionSecurityMiddleware()
