import type { Keypair} from '@solana/web3.js';
import { Connection, PublicKey, Transaction, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { logger } from '../logger';
import fetch from 'node-fetch';

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

interface QuoteResponse {
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
}

interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

class JupiterSwap {
  private connection: Connection;
  private baseUrl = 'https://quote-api.jup.ag/v6';

  constructor() {
    const rpcUrl = process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Get a swap quote from Jupiter
   */
  async getQuote(params: QuoteRequest): Promise<QuoteResponse | null> {
    try {
      const url = new URL(`${this.baseUrl}/quote`);
      url.searchParams.append('inputMint', params.inputMint);
      url.searchParams.append('outputMint', params.outputMint);
      url.searchParams.append('amount', params.amount.toString());
      url.searchParams.append('slippageBps', (params.slippageBps || 100).toString());
      
      if (params.onlyDirectRoutes) {
        url.searchParams.append('onlyDirectRoutes', 'true');
      }
      if (params.asLegacyTransaction) {
        url.searchParams.append('asLegacyTransaction', 'true');
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const error = await response.text();
        logger.error(`Failed to get quote: ${response.status} - ${error}`);
        return null;
      }

      const quote = await response.json() as QuoteResponse;
      
      // Calculate price (output/input)
      const inputAmount = parseFloat(quote.inAmount);
      const outputAmount = parseFloat(quote.outAmount);
      if (inputAmount > 0) {
        quote.price = (outputAmount / inputAmount).toString();
      }

      logger.info(`Quote received: ${params.inputMint} -> ${params.outputMint}, Price: ${quote.price}`);
      return quote;
    } catch (error) {
      logger.error('Error getting Jupiter quote:', error);
      return null;
    }
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(params: SwapRequest): Promise<string> {
    try {
      const { wallet, quoteResponse } = params;

      // Get swap transaction from Jupiter
      const swapResponse = await this.getSwapTransaction({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports || 'auto',
        prioritizationFeeLamports: params.prioritizationFeeLamports || 'auto',
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

      // Send and confirm transaction
      const signature = await this.sendTransaction(transaction, swapResponse.lastValidBlockHeight);
      
      logger.info(`Swap executed successfully: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('Error executing swap:', error);
      throw error;
    }
  }

  /**
   * Get the swap transaction from Jupiter API
   */
  private async getSwapTransaction(params: SwapTransactionParams): Promise<SwapResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(`Failed to get swap transaction: ${response.status} - ${error}`);
        return null;
      }

      const swapResponse = await response.json() as SwapResponse;
      return swapResponse;
    } catch (error) {
      logger.error('Error getting swap transaction:', error);
      return null;
    }
  }

  /**
   * Send and confirm a transaction
   */
  private async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    lastValidBlockHeight: number
  ): Promise<string> {
    try {
      // Get the latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash;
      }

      // Send the transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        }
      );

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    } catch (error) {
      logger.error('Error sending transaction:', error);
      throw error;
    }
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
    try {
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenMint}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data?.[tokenMint]?.price || null;
    } catch (error) {
      logger.error('Error getting token price:', error);
      return null;
    }
  }

  /**
   * Get multiple token prices
   */
  async getPrices(tokenMints: string[]): Promise<Record<string, number>> {
    try {
      if (tokenMints.length === 0) return {};

      const response = await fetch(
        `https://price.jup.ag/v4/price?ids=${tokenMints.join(',')}`
      );
      
      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      const prices: Record<string, number> = {};
      
      for (const mint of tokenMints) {
        prices[mint] = data.data?.[mint]?.price || 0;
      }
      
      return prices;
    } catch (error) {
      logger.error('Error getting token prices:', error);
      return {};
    }
  }

  /**
   * Simulate a swap to check if it would succeed
   */
  async simulateSwap(params: SwapRequest): Promise<boolean> {
    try {
      const { wallet, quoteResponse } = params;

      // Get swap transaction
      const swapResponse = await this.getSwapTransaction({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        asLegacyTransaction: false,
        useSharedAccounts: true,
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: false,
      });

      if (!swapResponse) {
        return false;
      }

      // Deserialize and simulate
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      // Sign for simulation
      transaction.sign([wallet]);

      // Simulate the transaction
      const simulation = await this.connection.simulateTransaction(transaction, {
        commitment: 'confirmed',
        replaceRecentBlockhash: true,
      });

      if (simulation.value.err) {
        logger.error('Swap simulation failed:', simulation.value.err);
        return false;
      }

      logger.info('Swap simulation successful');
      return true;
    } catch (error) {
      logger.error('Error simulating swap:', error);
      return false;
    }
  }
}

// Export singleton instance
export const jupiterSwap = new JupiterSwap();
