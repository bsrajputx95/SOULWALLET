/**
 * Jupiter Swap Service
 * Integrates with Jupiter Protocol for token swaps on Solana
 * Comment 1: Updated to use correct Jupiter v6 API signatures
 */

import { logger } from '../src/lib/logger';

// Jupiter v6 Quote Response shape
export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee: { amount: string; feeBps: number } | null;
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface RoutePlanStep {
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

// Legacy SwapRoute type for backward compatibility
export interface SwapRoute extends QuoteResponse {
  // Deprecated: use routePlan instead
  marketInfos?: {
    id: string;
    label: string;
    inputMint: string;
    outputMint: string;
    notEnoughLiquidity: boolean;
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
  }[];
}

export interface SwapTransaction {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

export interface GetQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
}

export interface ExecuteSwapParams {
  wallet: any; // Wallet adapter
  quoteResponse: QuoteResponse;
  wrapAndUnwrapSol?: boolean;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
}

class JupiterSwapService {
  private readonly baseUrl = 'https://quote-api.jup.ag/v6';
  
  /**
   * Get swap quote from Jupiter v6 API
   * Comment 1: Updated signature to accept params object
   */
  async getQuote(params: GetQuoteParams): Promise<QuoteResponse> {
    const { inputMint, outputMint, amount, slippageBps = 50, onlyDirectRoutes = false, asLegacyTransaction = false } = params;
    
    try {
      const urlParams = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: onlyDirectRoutes.toString(),
        asLegacyTransaction: asLegacyTransaction.toString()
      });

      const response = await fetch(`${this.baseUrl}/quote?${urlParams}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as QuoteResponse;
      return data;
    } catch (error) {
      logger.error('Error getting Jupiter quote', error);
      throw error;
    }
  }

  /**
   * Execute swap using Jupiter v6 API
   * Comment 1: New method that handles full swap execution
   */
  async executeSwap(params: ExecuteSwapParams): Promise<string> {
    const { wallet, quoteResponse, wrapAndUnwrapSol = true, prioritizationFeeLamports = 10000000, asLegacyTransaction = false } = params;
    
    try {
      // Get swap transaction from Jupiter
      const swapTx = await this.getSwapTransaction(quoteResponse, wallet.publicKey?.toString() || '', wrapAndUnwrapSol, prioritizationFeeLamports, asLegacyTransaction);
      
      if (!swapTx?.swapTransaction) {
        throw new Error('Failed to get swap transaction from Jupiter');
      }

      // Execute swap with wallet
      let signature: string;
      if (typeof wallet.executeSwap === 'function') {
        signature = await wallet.executeSwap(swapTx.swapTransaction);
      } else if (typeof wallet.signAndSendTransaction === 'function') {
        // Decode and sign transaction
        const txBuffer = Buffer.from(swapTx.swapTransaction, 'base64');
        signature = await wallet.signAndSendTransaction(txBuffer);
      } else {
        throw new Error('Wallet does not support transaction signing');
      }

      if (!signature) {
        throw new Error('Swap execution returned no signature');
      }

      return signature;
    } catch (error) {
      logger.error('Error executing swap', error);
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter (internal)
   */
  private async getSwapTransaction(
    quoteResponse: QuoteResponse,
    userPublicKey: string,
    wrapAndUnwrapSol: boolean = true,
    prioritizationFeeLamports: number = 10000000,
    asLegacyTransaction: boolean = false
  ): Promise<SwapTransaction> {
    try {
      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol,
          dynamicComputeUnitLimit: true,
          asLegacyTransaction,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: prioritizationFeeLamports,
              priorityLevel: "veryHigh"
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter swap API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as SwapTransaction;
      return data;
    } catch (error) {
      logger.error('Error getting swap transaction', error);
      throw error;
    }
  }

  /**
   * @deprecated Use getQuote(params) instead
   * Legacy method for backward compatibility
   */
  async getQuoteLegacy(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 50
  ): Promise<SwapRoute> {
    const quote = await this.getQuote({
      inputMint,
      outputMint,
      amount: parseInt(amount, 10),
      slippageBps
    });
    
    // Convert routePlan to legacy marketInfos format
    const marketInfos = quote.routePlan?.map((step, index) => ({
      id: step.swapInfo.ammKey,
      label: step.swapInfo.label,
      inputMint: step.swapInfo.inputMint,
      outputMint: step.swapInfo.outputMint,
      notEnoughLiquidity: false,
      inAmount: step.swapInfo.inAmount,
      outAmount: step.swapInfo.outAmount,
      priceImpactPct: index === quote.routePlan.length - 1 ? quote.priceImpactPct : '0',
    })) || [];

    return {
      ...quote,
      marketInfos,
    };
  }

  /**
   * @deprecated Use executeSwap instead
   * Legacy method for backward compatibility
   */
  async getSwapTransactionLegacy(
    route: SwapRoute,
    userPublicKey: string,
    wrapAndUnwrapSol: boolean = true
  ): Promise<SwapTransaction> {
    return this.getSwapTransaction(route, userPublicKey, wrapAndUnwrapSol);
  }

  /**
   * Get list of supported tokens
   */
  async getTokenList(): Promise<{
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    logoURI?: string;
    tags?: string[];
  }[]> {
    try {
      const response = await fetch('https://token.jup.ag/all');
      
      if (!response.ok) {
        throw new Error(`Token list API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error getting token list', error);
      throw error;
    }
  }

  /**
   * Get price information for tokens
   */
  async getPrice(ids: string[]): Promise<Record<string, {
    id: string;
    mintSymbol: string;
    vsToken: string;
    vsTokenSymbol: string;
    price: number;
  }>> {
    try {
      const idsParam = ids.join(',');
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${idsParam}`);
      
      if (!response.ok) {
        throw new Error(`Price API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data || {};
    } catch (error) {
      logger.error('Error getting prices from Jupiter', error);
      throw error;
    }
  }

  /**
   * Check if a route exists between two tokens
   */
  async checkRouteExists(inputMint: string, outputMint: string): Promise<boolean> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, '1000000'); // 1 token in base units
      return quote.marketInfos && quote.marketInfos.length > 0;
    } catch (error) {
      logger.warn(`No route found between ${inputMint} and ${outputMint}`, error);
      return false;
    }
  }
}

export const jupiterSwap = new JupiterSwapService();