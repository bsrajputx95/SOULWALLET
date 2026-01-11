import 'reflect-metadata';
import type { Keypair } from '@solana/web3.js'
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import { injectable, inject } from 'tsyringe';
import { logger } from '../logger'
import type { RpcManager } from './rpcManager'
import type { QuoteResponse } from './jupiterSwap'

export type SimulationResult = {
  ok: boolean
  error?: string
  logs?: string[]
  unitsConsumed?: number
}

type SimulateSwapParams = {
  wallet: Keypair
  quoteResponse: QuoteResponse
  swapTransactionParams?: {
    wrapAndUnwrapSol?: boolean
    asLegacyTransaction?: boolean
    useSharedAccounts?: boolean
    dynamicComputeUnitLimit?: boolean
    skipUserAccountsRpcCalls?: boolean
    prioritizationFeeLamports?: number | string
    computeUnitPriceMicroLamports?: number | string
  }
}

type SwapResponse = {
  swapTransaction: string
  lastValidBlockHeight: number
  prioritizationFeeLamports?: number
}

/**
 * Transaction Simulator Service
 * Simulates Solana transactions before execution
 */
@injectable()
export class TransactionSimulator {
  private baseUrl = 'https://quote-api.jup.ag/v6'

  constructor(
    @inject('RpcManager') private readonly rpcManager: RpcManager,
  ) { }

  async simulateSwap(params: SimulateSwapParams): Promise<SimulationResult> {
    try {
      const swapParams: Record<string, unknown> = {
        quoteResponse: params.quoteResponse,
        userPublicKey: params.wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        asLegacyTransaction: false,
        useSharedAccounts: true,
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: false,
      }

      const extra = params.swapTransactionParams
      if (extra) {
        if (extra.wrapAndUnwrapSol !== undefined) swapParams.wrapAndUnwrapSol = extra.wrapAndUnwrapSol
        if (extra.asLegacyTransaction !== undefined) swapParams.asLegacyTransaction = extra.asLegacyTransaction
        if (extra.useSharedAccounts !== undefined) swapParams.useSharedAccounts = extra.useSharedAccounts
        if (extra.dynamicComputeUnitLimit !== undefined) swapParams.dynamicComputeUnitLimit = extra.dynamicComputeUnitLimit
        if (extra.skipUserAccountsRpcCalls !== undefined) swapParams.skipUserAccountsRpcCalls = extra.skipUserAccountsRpcCalls
        if (extra.prioritizationFeeLamports !== undefined) swapParams.prioritizationFeeLamports = extra.prioritizationFeeLamports
        if (extra.computeUnitPriceMicroLamports !== undefined) swapParams.computeUnitPriceMicroLamports = extra.computeUnitPriceMicroLamports
      }

      const swapResponse = await this.getSwapTransaction(swapParams)

      if (!swapResponse) return { ok: false, error: 'Failed to get swap transaction' }

      const txBuf = Buffer.from(swapResponse.swapTransaction, 'base64')
      const transaction = VersionedTransaction.deserialize(txBuf)
      transaction.sign([params.wallet])

      return await this.simulateTransaction(transaction, { replaceRecentBlockhash: true })
    } catch (error) {
      logger.error('Error simulating swap:', error)
      return { ok: false, error: error instanceof Error ? error.message : 'Simulation failed' }
    }
  }

  async validateBalance(wallet: PublicKey, mint: string, amount: number): Promise<boolean> {
    try {
      const connection = await this.rpcManager.getConnection()
      if (mint === 'So11111111111111111111111111111111111111112') {
        const bal = await connection.getBalance(wallet)
        return bal >= amount
      }

      const mintPubkey = new PublicKey(mint)
      const ata = await getAssociatedTokenAddress(mintPubkey, wallet)
      const account = await getAccount(connection, ata)
      return Number(account.amount) >= amount
    } catch {
      return false
    }
  }

  async estimateComputeUnits(transaction: Transaction | VersionedTransaction): Promise<number> {
    const result = await this.simulateTransaction(transaction, { replaceRecentBlockhash: true })
    return result.unitsConsumed || 0
  }

  async simulateTransaction(
    transaction: Transaction | VersionedTransaction,
    opts: { replaceRecentBlockhash?: boolean } = {}
  ): Promise<SimulationResult> {
    try {
      const connection = await this.rpcManager.getConnection()
      const simulation = await connection.simulateTransaction(transaction as any, {
        commitment: 'confirmed',
        replaceRecentBlockhash: opts.replaceRecentBlockhash ?? true,
      } as any)

      if (simulation.value.err) {
        const errorText = typeof simulation.value.err === 'string'
          ? simulation.value.err
          : JSON.stringify(simulation.value.err)
        return { ok: false, error: errorText, logs: simulation.value.logs || undefined, unitsConsumed: simulation.value.unitsConsumed }
      }

      return { ok: true, logs: simulation.value.logs || undefined, unitsConsumed: simulation.value.unitsConsumed }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Simulation failed' }
    }
  }

  private async getSwapTransaction(params: Record<string, unknown>): Promise<SwapResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        return null
      }

      return (await response.json()) as SwapResponse
    } catch {
      return null
    }
  }
}

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<TransactionSimulator>('TransactionSimulator') 
 */
let _transactionSimulatorInstance: TransactionSimulator | null = null;

function getTransactionSimulatorInstance(): TransactionSimulator {
  if (!_transactionSimulatorInstance) {
    try {
      _transactionSimulatorInstance = container.resolve<TransactionSimulator>('TransactionSimulator');
    } catch {
      throw new Error(
        'TransactionSimulator requires DI container. Call setupContainer() first or use container.resolve().'
      );
    }
  }
  return _transactionSimulatorInstance;
}

export const transactionSimulator: TransactionSimulator = new Proxy({} as TransactionSimulator, {
  get(_target, prop) {
    const value = (getTransactionSimulatorInstance() as any)[prop];
    if (typeof value === 'function') return value.bind(getTransactionSimulatorInstance());
    return value;
  }
});
