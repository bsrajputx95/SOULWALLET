import 'reflect-metadata';
import type { Keypair } from '@solana/web3.js';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { injectable, inject } from 'tsyringe';
import { logger } from '../logger'
import { sanitizeBigInt, toSafeNumber } from '../utils/sanitize';
import type { RpcManager } from './rpcManager';
import type { FeeManager } from './feeManager';
import type { TransactionSimulator, SimulationResult } from './transactionSimulator';
import type { JitoService } from './jitoService';
import { getCircuitBreaker } from './circuitBreaker';
import { retryWithBackoff } from '../utils/retry';
import { FEES, TIMEOUTS } from '../../../constants';

interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
}

interface PlatformFee {
  amount: string;
  feeBps: number;
}

interface RoutePlanStep {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

interface SwapTransactionParams {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number | string;
  prioritizationFeeLamports?: number | string;
  asLegacyTransaction?: boolean;
  useSharedAccounts?: boolean;
  dynamicComputeUnitLimit?: boolean;
  skipUserAccountsRpcCalls?: boolean;
}

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: PlatformFee | null;
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
  contextSlot?: number;
  timeTaken?: number;
  // Additional fields for our use
  price?: string;
  outputSymbol?: string;
  outputName?: string;
  outputDecimals?: number;
}

interface SwapRequest {
  wallet: Keypair;
  quoteResponse: QuoteResponse;
  userPublicKey?: string;
  wrapAndUnwrapSol?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  useSharedAccounts?: boolean;
  dynamicComputeUnitLimit?: boolean;
  skipUserAccountsRpcCalls?: boolean;
  // Comment 1: Add MEV protection flag
  useMevProtection?: boolean;
  // Optional: trade value for tip calculation
  tradeValueUsd?: number;
}

interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/**
 * Jupiter Swap Service
 * Handles token swaps via Jupiter aggregator with MEV protection
 */
@injectable()
export class JupiterSwap {
  private baseUrl = 'https://quote-api.jup.ag/v6';
  private readonly priceBreaker = getCircuitBreaker('price:jupiter')
  // Comment 1: Circuit breakers for quote and swap
  private readonly quoteBreaker = getCircuitBreaker('jupiter:quote')
  private readonly swapBreaker = getCircuitBreaker('jupiter:swap')

  constructor(
    @inject('RpcManager') private readonly rpcManager: RpcManager,
    @inject('FeeManager') private readonly feeManager: FeeManager,
    @inject('TransactionSimulator') private readonly transactionSimulator: TransactionSimulator,
    @inject('JitoService') private readonly jitoService: JitoService,
  ) { }

  /**
   * Get a swap quote from Jupiter
   * Comment 1+2+5: Wrapped with circuit breaker, retry, and 5s timeout
   */
  async getQuote(params: QuoteRequest): Promise<QuoteResponse | null> {
    return this.quoteBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          const url = new URL(`${this.baseUrl}/quote`);
          url.searchParams.append('inputMint', params.inputMint);
          url.searchParams.append('outputMint', params.outputMint);
          url.searchParams.append('amount', params.amount.toString());
          url.searchParams.append('slippageBps', (params.slippageBps || FEES.SWAP.SLIPPAGE_BPS.DEFAULT).toString());

          if (params.onlyDirectRoutes) {
            url.searchParams.append('onlyDirectRoutes', 'true');
          }
          if (params.asLegacyTransaction) {
            url.searchParams.append('asLegacyTransaction', 'true');
          }

          // Comment 5: Apply 5s timeout
          const response = await this.fetchWithTimeout(url.toString(), TIMEOUTS.EXTERNAL_API);

          if (!response || !response.ok) {
            const error = response ? await response.text() : 'Timeout';
            logger.error(`Failed to get quote: ${response?.status || 'N/A'} - ${error}`);
            throw new Error(`Quote fetch failed: ${error}`);
          }

          const rawQuote = await response.json();
          const quote = sanitizeBigInt(rawQuote) as QuoteResponse;

          // Calculate price (output/input)
          const inputAmount = parseFloat(quote.inAmount);
          const outputAmount = parseFloat(quote.outAmount);
          if (inputAmount > 0) {
            quote.price = (outputAmount / inputAmount).toString();
          }

          logger.info(`Quote received: ${params.inputMint} -> ${params.outputMint}, Price: ${quote.price}`);
          return quote;
        }, { maxRetries: TIMEOUTS.RETRY.MAX_ATTEMPTS, initialDelayMs: TIMEOUTS.RETRY.INITIAL_DELAY_MS });
      },
      // Circuit breaker fallback
      () => {
        logger.warn('Jupiter quote circuit breaker open, returning null');
        return null;
      }
    );
  }

  /**
   * Execute a swap transaction
   * Comment 1: Added useMevProtection flag for bundle/tip support
   */
  async executeSwap(params: SwapRequest): Promise<string> {
    try {
      const { wallet, quoteResponse, useMevProtection = true, tradeValueUsd } = params;

      const connection = await this.rpcManager.getConnection();
      const calculatedPriorityFeeLamports = await this.feeManager.getOptimalPriorityFeeLamports({ connection, urgent: true });

      // Get swap transaction from Jupiter
      const swapResponse = await this.getSwapTransaction({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        ...(params.computeUnitPriceMicroLamports !== undefined
          ? { computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports }
          : {}),
        prioritizationFeeLamports: params.prioritizationFeeLamports ?? calculatedPriorityFeeLamports,
        asLegacyTransaction: params.asLegacyTransaction || false,
        useSharedAccounts: true,
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: false,
      });

      if (!swapResponse) {
        throw new Error('Failed to get swap transaction');
      }

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = params.asLegacyTransaction
        ? Transaction.from(swapTransactionBuf)
        : VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign the transaction
      if (transaction instanceof Transaction) {
        transaction.sign(wallet);
      } else {
        transaction.sign([wallet]);
      }

      if (process.env.SIMULATION_REQUIRED !== 'false') {
        const simulation = await this.transactionSimulator.simulateTransaction(transaction, { replaceRecentBlockhash: true });
        if (!simulation.ok) {
          throw new Error(simulation.error ? `Swap simulation failed: ${simulation.error}` : 'Swap simulation failed');
        }
      }

      // Comment 1: Send with MEV protection (bundle + tip) if enabled
      const signature = await this.sendTransactionWithMevProtection(
        wallet,
        transaction,
        swapResponse.lastValidBlockHeight,
        useMevProtection,
        tradeValueUsd
      );

      logger.info(`Swap executed successfully: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('Error executing swap:', error);
      throw error;
    }
  }

  /**
   * Get the swap transaction from Jupiter API
   * Comment 1+2+5: Wrapped with circuit breaker, retry, and 5s timeout
   */
  async getSwapTransaction(params: SwapTransactionParams): Promise<SwapResponse | null> {
    return this.swapBreaker.exec(
      async () => {
        return retryWithBackoff(async () => {
          // Comment 5: Apply 5s timeout with AbortController
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TIMEOUTS.EXTERNAL_API);

          try {
            const response = await fetch(`${this.baseUrl}/swap`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(params),
              signal: controller.signal,
            });

            if (!response.ok) {
              const error = await response.text();
              logger.error(`Failed to get swap transaction: ${response.status} - ${error}`);
              throw new Error(`Swap transaction fetch failed: ${error}`);
            }

            const rawResponse = await response.json();
            const sanitizedResponse = sanitizeBigInt(rawResponse);

            const swapResponse: SwapResponse = {
              swapTransaction: sanitizedResponse.swapTransaction,
              lastValidBlockHeight: toSafeNumber(sanitizedResponse.lastValidBlockHeight),
              prioritizationFeeLamports: sanitizedResponse.prioritizationFeeLamports !== undefined ? toSafeNumber(sanitizedResponse.prioritizationFeeLamports) : undefined,
            };
            return swapResponse;
          } finally {
            clearTimeout(timeout);
          }
        }, { maxRetries: TIMEOUTS.RETRY.MAX_ATTEMPTS, initialDelayMs: TIMEOUTS.RETRY.INITIAL_DELAY_MS });
      },
      // Circuit breaker fallback
      () => {
        logger.warn('Jupiter swap circuit breaker open, returning null');
        return null;
      }
    );
  }

  /**
   * Comment 1: Send transaction with MEV protection (bundle + tip)
   * When enabled and Jito is available, send via Jito with tip
   * Falls back to regular RPC on failure
   */
  private async sendTransactionWithMevProtection(
    wallet: Keypair,
    transaction: Transaction | VersionedTransaction,
    lastValidBlockHeight: number,
    useMevProtection: boolean,
    tradeValueUsd?: number
  ): Promise<string> {
    const blockhash = transaction instanceof Transaction
      ? transaction.recentBlockhash
      : transaction.message.recentBlockhash;

    if (!blockhash) {
      throw new Error('Transaction missing recent blockhash');
    }

    // Comment 1: Use MEV protection with bundle + tip if enabled
    if (useMevProtection && this.jitoService.isEnabled()) {
      try {
        // Calculate tip based on trade value
        const tipLamports = this.jitoService.calculateTip(tradeValueUsd);

        // Create tip transaction
        const tipInstruction = this.jitoService.createTipInstruction(wallet.publicKey, tipLamports);
        const tipTx = new Transaction().add(tipInstruction);
        tipTx.recentBlockhash = blockhash;
        tipTx.feePayer = wallet.publicKey;
        tipTx.sign(wallet);

        // Send bundle with swap + tip
        const bundleId = await this.jitoService.sendBundle([transaction, tipTx]);
        logger.info(`[MEV] Sent bundle with tip: ${tipLamports} lamports, bundleId: ${bundleId.substring(0, 16)}...`);

        // Wait for bundle confirmation
        const confirmed = await this.jitoService.waitForBundleConfirmation(bundleId);
        if (confirmed) {
          // Get the signature from the original transaction
          const signature = transaction instanceof Transaction
            ? transaction.signature?.toString('base64') || bundleId
            : bundleId;
          return signature;
        }

        // Bundle didn't confirm, fall through to fallback
        logger.warn('[MEV] Bundle confirmation failed, falling back to regular RPC');
      } catch (error) {
        logger.warn('[MEV] Jito bundle failed, falling back to regular RPC', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to regular RPC
      }
    }

    // Comment 3: Send with RPC failover
    return this.sendWithRpcFailover(transaction, blockhash, lastValidBlockHeight);
  }

  /**
   * Comment 3: Send and confirm a transaction with RPC failover
   * Wraps send/confirm in rpcManager.withFailover
   */
  private async sendWithRpcFailover(
    transaction: Transaction | VersionedTransaction,
    blockhash: string,
    lastValidBlockHeight: number
  ): Promise<string> {
    const timeoutMs = Math.max(1, parseInt(process.env.TRANSACTION_TIMEOUT_SECONDS || '30')) * 1000;
    const serializedTx = transaction.serialize();

    // Comment 3: Use withFailover for send + confirm with endpoint failover
    return this.rpcManager.withFailover(async (connection) => {
      // Send transaction
      const signature = await connection.sendRawTransaction(serializedTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      // Confirm with timeout
      const confirmation = await Promise.race([
        connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed'
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeoutMs)
        ),
      ]);

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    });
  }

  /**
   * Get token information
   */
  async getTokenInfo(mint: string): Promise<{ symbol: string; name: string; logoURI?: string } | null> {
    try {
      const response = await fetch(`https://token.jup.ag/strict/${mint}`);

      if (!response.ok) {
        return null;
      }

      const tokenInfo = await response.json() as any;

      // Extract and shape the required fields
      if (!tokenInfo || typeof tokenInfo !== 'object') {
        return null;
      }

      return {
        symbol: tokenInfo.symbol || 'UNKNOWN',
        name: tokenInfo.name || 'Unknown Token',
        logoURI: tokenInfo.logoURI || undefined,
      };
    } catch (error) {
      logger.error('Error getting token info:', error);
      return null;
    }
  }

  /**
   * Get current token price
   */
  async getPrice(tokenMint: string): Promise<number | null> {
    return this.priceBreaker.exec(
      async () => {
        const response = await this.fetchWithTimeout(
          `https://price.jup.ag/v4/price?ids=${tokenMint}`,
          TIMEOUTS.EXTERNAL_API
        )

        if (!response || !response.ok) {
          return null
        }

        const data = await response.json()
        const price = data?.data?.[tokenMint]?.price
        return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null
      },
      () => null
    )
  }

  /**
   * Get multiple token prices
   */
  async getPrices(tokenMints: string[]): Promise<Record<string, number>> {
    return this.priceBreaker.exec(
      async () => {
        if (tokenMints.length === 0) return {}

        const response = await this.fetchWithTimeout(
          `https://price.jup.ag/v4/price?ids=${tokenMints.join(',')}`,
          TIMEOUTS.EXTERNAL_API
        )

        if (!response || !response.ok) {
          return {}
        }

        const data = await response.json()
        const prices: Record<string, number> = {}

        for (const mint of tokenMints) {
          const price = data?.data?.[mint]?.price
          prices[mint] = typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : 0
        }

        return prices
      },
      () => ({})
    )
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } catch (_error) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Simulate a swap to check if it would succeed
   */
  async simulateSwap(params: SwapRequest): Promise<SimulationResult> {
    try {
      const { wallet, quoteResponse } = params;
      const connection = await this.rpcManager.getConnection();
      const calculatedPriorityFeeLamports = await this.feeManager.getOptimalPriorityFeeLamports({ connection, urgent: false });

      const result = await this.transactionSimulator.simulateSwap({
        wallet,
        quoteResponse,
        swapTransactionParams: {
          prioritizationFeeLamports: params.prioritizationFeeLamports ?? calculatedPriorityFeeLamports,
          ...(params.computeUnitPriceMicroLamports !== undefined
            ? { computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports }
            : {}),
        },
      });

      return result;
    } catch (error) {
      logger.error('Error simulating swap:', error);
      return { ok: false, error: error instanceof Error ? error.message : 'Simulation failed' };
    }
  }
}

// Re-export SimulationResult type
export type { SimulationResult };

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<JupiterSwap>('JupiterSwap') 
 */
let _jupiterSwapInstance: JupiterSwap | null = null;

function getJupiterSwapInstance(): JupiterSwap {
  if (!_jupiterSwapInstance) {
    try {
      _jupiterSwapInstance = container.resolve<JupiterSwap>('JupiterSwap');
    } catch {
      throw new Error(
        'JupiterSwap requires DI container. Call setupContainer() first or use container.resolve().'
      );
    }
  }
  return _jupiterSwapInstance;
}

export const jupiterSwap: JupiterSwap = new Proxy({} as JupiterSwap, {
  get(_target, prop) {
    const value = (getJupiterSwapInstance() as any)[prop];
    if (typeof value === 'function') return value.bind(getJupiterSwapInstance());
    return value;
  }
});

