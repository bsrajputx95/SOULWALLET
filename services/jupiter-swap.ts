/**
 * Jupiter Swap Service
 * Integrates with Jupiter Protocol for token swaps on Solana
 */

export interface SwapRoute {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  priceImpactPct: string;
  marketInfos: Array<{
    id: string;
    label: string;
    inputMint: string;
    outputMint: string;
    notEnoughLiquidity: boolean;
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
  }>;
}

export interface SwapTransaction {
  setupTransaction?: string;
  swapTransaction: string;
  cleanupTransaction?: string;
}

class JupiterSwapService {
  private readonly baseUrl = 'https://quote-api.jup.ag/v6';
  
  /**
   * Get swap quote from Jupiter
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 50 // 0.5% default slippage
  ): Promise<SwapRoute> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false'
      });

      const response = await fetch(`${this.baseUrl}/quote?${params}`);
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter
   */
  async getSwapTransaction(
    route: SwapRoute,
    userPublicKey: string,
    wrapAndUnwrapSol: boolean = true
  ): Promise<SwapTransaction> {
    try {
      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse: route,
          userPublicKey,
          wrapAndUnwrapSol,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 10000000,
              priorityLevel: "veryHigh"
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Jupiter swap API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      throw error;
    }
  }

  /**
   * Get list of supported tokens
   */
  async getTokenList(): Promise<Array<{
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    logoURI?: string;
    tags?: string[];
  }>> {
    try {
      const response = await fetch('https://token.jup.ag/all');
      
      if (!response.ok) {
        throw new Error(`Token list API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting token list:', error);
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
      console.error('Error getting prices:', error);
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
      console.warn(`No route found between ${inputMint} and ${outputMint}:`, error);
      return false;
    }
  }
}

export const jupiterSwap = new JupiterSwapService();