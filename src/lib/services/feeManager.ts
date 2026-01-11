import 'reflect-metadata';
import type { Connection, Transaction, VersionedTransaction } from '@solana/web3.js'
import { injectable } from 'tsyringe';
import { FEES } from '../../../constants';

type Percentile = 0 | 10 | 25 | 50 | 75 | 90 | 95 | 99 | 100

function percentile(values: number[], p: Percentile): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx] ?? 0
}

/**
 * Fee Manager Service
 * Handles priority fee calculation for Solana transactions
 */
@injectable()
export class FeeManager {
  private maxPriorityFeeLamports = FEES.PRIORITY.MAX_LAMPORTS
  private minPriorityFeeLamports = FEES.PRIORITY.MIN_LAMPORTS
  private priorityFeePercentile = FEES.PRIORITY.PERCENTILE as Percentile
  private urgentMultiplier = FEES.PRIORITY.URGENT_MULTIPLIER

  /**
   * Cap priority fee within configured limits
   * @param feeLamports - Raw fee in lamports
   * @returns Capped fee in lamports
   */
  capPriorityFee(feeLamports: number): number {
    const capped = Math.min(Math.max(feeLamports, this.minPriorityFeeLamports), this.maxPriorityFeeLamports)
    return Math.floor(capped)
  }

  /**
   * Get optimal priority fee based on recent network conditions
   * @param params - Parameters
   * @param params.connection - Solana connection
   * @param params.urgent - Whether to apply urgent multiplier
   * @returns Optimal priority fee in lamports
   */
  async getOptimalPriorityFeeLamports(params: { connection: Connection; urgent?: boolean }): Promise<number> {
    const { connection, urgent } = params
    try {
      const fees = await (connection as any).getRecentPrioritizationFees?.()
      const lamports = Array.isArray(fees)
        ? fees
          .map((f: any) => Number(f?.prioritizationFee ?? f?.prioritizationFeeLamports ?? f?.fee ?? 0))
          .filter((n: number) => Number.isFinite(n) && n > 0)
        : []

      const base = percentile(lamports, this.priorityFeePercentile) || this.minPriorityFeeLamports
      const adjusted = urgent ? Math.ceil(base * this.urgentMultiplier) : base
      return this.capPriorityFee(adjusted)
    } catch {
      return this.capPriorityFee(this.minPriorityFeeLamports)
    }
  }

  /**
   * Estimate total transaction fee
   * @param _transaction - Transaction to estimate
   * @returns Estimated fee or null
   */
  estimateTotalFeeLamports(_transaction: Transaction | VersionedTransaction): number | null {
    return null
  }
}

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<FeeManager>('FeeManager') 
 * 
 * Note: Lazy initialization to prevent container.resolve failures
 */
let _feeManagerInstance: FeeManager | null = null;

export const feeManager: FeeManager = new Proxy({} as FeeManager, {
  get(_target, prop) {
    if (!_feeManagerInstance) {
      try {
        _feeManagerInstance = container.resolve<FeeManager>('FeeManager');
      } catch {
        _feeManagerInstance = new FeeManager();
      }
    }
    return (_feeManagerInstance as any)[prop];
  }
});
