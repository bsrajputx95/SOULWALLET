import 'reflect-metadata';
import {
  Transaction,
  VersionedTransaction,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import type { Keypair } from '@solana/web3.js'
import { injectable } from 'tsyringe';
import { logger } from '../logger'

type JsonRpcResult<T> = {
  jsonrpc: '2.0'
  id: string | number
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

type BundleStatus = 'Invalid' | 'Pending' | 'Failed' | 'Landed'

interface BundleStatusResponse {
  bundle_id: string
  status: BundleStatus
  landed_slot?: number
}

function getEnvString(name: string, fallback: string): string {
  const v = process.env[name]
  return v && v.trim() ? v : fallback
}

function getEnvInt(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) ? v : fallback
}

/**
 * Jito Service
 * Provides MEV protection via Jito block engine
 */
@injectable()
export class JitoService {
  private enabled = process.env.JITO_ENABLED === 'true'
  private blockEngineUrl = getEnvString('JITO_BLOCK_ENGINE_URL', 'https://mainnet.block-engine.jito.wtf/api/v1/bundles')
  private tipAccount = getEnvString('JITO_TIP_ACCOUNT', '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5')
  private defaultTipLamports = getEnvInt('JITO_TIP_LAMPORTS', 10_000)
  private bundleTimeoutMs = getEnvInt('JITO_BUNDLE_TIMEOUT', 30_000)
  private pollIntervalMs = 500

  isEnabled(): boolean {
    return this.enabled
  }

  getTipAccount(): PublicKey {
    return new PublicKey(this.tipAccount)
  }

  /**
   * Calculate tip amount based on transaction value
   * - Small trades (<$100): 0.0001 SOL (10,000 lamports)
   * - Large trades (>$100): 0.001 SOL (1,000,000 lamports)
   */
  calculateTip(valueUsd?: number): number {
    if (valueUsd && valueUsd > 100) {
      return Math.min(1_000_000, this.defaultTipLamports * 10)
    }
    return this.defaultTipLamports
  }

  /**
   * Create a tip instruction to send to Jito validators
   */
  createTipInstruction(from: PublicKey, tipLamports?: number): TransactionInstruction {
    const amount = tipLamports ?? this.defaultTipLamports
    return SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: this.getTipAccount(),
      lamports: amount,
    })
  }

  /**
   * Send a transaction through Jito's private mempool
   */
  async sendTransaction(transaction: Transaction | VersionedTransaction): Promise<string> {
    const raw = transaction.serialize()
    const b64 = Buffer.from(raw).toString('base64')
    const res = await this.jsonRpc<string>('sendTransaction', [b64, { encoding: 'base64' }])
    if (!res) throw new Error('Jito sendTransaction failed')
    logger.info('[Jito] Transaction sent', { signature: res.substring(0, 16) + '...' })
    return res
  }

  /**
   * Send a transaction with an attached tip to validators
   * Use this for higher priority and faster inclusion
   */
  async sendWithTip(
    wallet: Keypair,
    transaction: Transaction | VersionedTransaction,
    tipLamports?: number,
    recentBlockhash?: string
  ): Promise<string> {
    const tip = tipLamports ?? this.defaultTipLamports
    const tipInstruction = this.createTipInstruction(wallet.publicKey, tip)

    // For VersionedTransaction, we need to create a new one with the tip
    if (transaction instanceof VersionedTransaction) {
      // Create a legacy transaction with just the tip
      const tipTx = new Transaction().add(tipInstruction)
      if (recentBlockhash) {
        tipTx.recentBlockhash = recentBlockhash
        tipTx.feePayer = wallet.publicKey
      }
      tipTx.sign(wallet)

      // Send both as a bundle
      return this.sendBundle([transaction, tipTx])
    }

    // For legacy Transaction, add tip instruction
    transaction.add(tipInstruction)
    if (recentBlockhash) {
      transaction.recentBlockhash = recentBlockhash
      transaction.feePayer = wallet.publicKey
    }
    transaction.sign(wallet)

    return this.sendTransaction(transaction)
  }

  /**
   * Send multiple transactions as an atomic bundle
   * Either all execute or none do
   */
  async sendBundle(transactions: Array<Transaction | VersionedTransaction>): Promise<string> {
    const txs = transactions.map((t) => Buffer.from(t.serialize()).toString('base64'))
    const res = await this.jsonRpc<string>('sendBundle', [txs])
    if (!res) throw new Error('Jito sendBundle failed')
    logger.info('[Jito] Bundle sent', { bundleId: res.substring(0, 16) + '...' })
    return res
  }

  /**
   * Wait for a bundle to be confirmed on-chain
   * Returns true if landed successfully, false if failed or timed out
   */
  async waitForBundleConfirmation(bundleId: string): Promise<boolean> {
    const timeoutAt = Date.now() + this.bundleTimeoutMs
    let lastStatus: BundleStatus = 'Pending'

    while (Date.now() < timeoutAt) {
      try {
        const statusResponse = await this.getBundleStatus(bundleId)

        if (statusResponse) {
          lastStatus = statusResponse.status

          if (statusResponse.status === 'Landed') {
            logger.info('[Jito] Bundle landed', { bundleId, slot: statusResponse.landed_slot })
            return true
          }

          if (statusResponse.status === 'Failed' || statusResponse.status === 'Invalid') {
            logger.warn('[Jito] Bundle failed', { bundleId, status: statusResponse.status })
            return false
          }
        }
      } catch (err) {
        logger.warn('[Jito] Error checking bundle status', { error: err, bundleId })
      }

      await new Promise((r) => setTimeout(r, this.pollIntervalMs))
    }

    logger.warn('[Jito] Bundle confirmation timeout', { bundleId, lastStatus })
    return lastStatus === 'Pending' // Might still land, but we timed out
  }

  /**
   * Get the status of a bundle
   */
  async getBundleStatus(bundleId: string): Promise<BundleStatusResponse | null> {
    const res = await this.jsonRpc<BundleStatusResponse[]>('getBundleStatuses', [[bundleId]])
    if (!res || !res.length) return null
    return res[0] ?? null
  }

  /**
   * Get the current tip floor (minimum tip to be included)
   */
  async getTipFloor(): Promise<number | null> {
    try {
      // Jito doesn't have a direct API for this, return our default
      return this.defaultTipLamports
    } catch {
      return null
    }
  }

  private async jsonRpc<T>(method: string, params: unknown[]): Promise<T | null> {
    const payload = { jsonrpc: '2.0', id: Date.now(), method, params }
    try {
      const resp = await fetch(this.blockEngineUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await resp.json()) as JsonRpcResult<T>
      if (!resp.ok || body.error) {
        logger.warn('[Jito] RPC error', { method, error: body.error })
        return null
      }
      return body.result ?? null
    } catch (err) {
      logger.error('[Jito] RPC request failed', { method, error: err })
      return null
    }
  }
}

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<JitoService>('JitoService') 
 * 
 * Note: Lazy initialization to prevent container.resolve failures
 * when module is imported before container setup
 */
let _jitoServiceInstance: JitoService | null = null;

export const jitoService: JitoService = new Proxy({} as JitoService, {
  get(_target, prop) {
    if (!_jitoServiceInstance) {
      try {
        _jitoServiceInstance = container.resolve<JitoService>('JitoService');
      } catch {
        // Fallback: create instance directly if container not set up
        _jitoServiceInstance = new JitoService();
      }
    }
    return (_jitoServiceInstance as any)[prop];
  }
});
