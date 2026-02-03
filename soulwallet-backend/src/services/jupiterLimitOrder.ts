import axios from 'axios';

const JUPITER_LIMIT_API = process.env.JUPITER_LIMIT_API || 'https://jup.ag/api/limit/v1';
const JUPITER_SWAP_API = process.env.JUPITER_SWAP_API || 'https://api.jup.ag/swap/v1';
const JUPITER_TOKEN_API = 'https://api.jup.ag/tokens?tags=verified';

interface LimitOrderParams {
    owner: string;           // User's public key
    inToken: string;         // Token to sell (input)
    outToken: string;        // Token to buy (output)
    inAmount: number;        // Amount of input token (in smallest units)
    outAmount: number;       // Minimum amount of output token (in smallest units)
}

interface LimitOrderResponse {
    orderId: string;
    transaction: string;     // Base64 encoded transaction to sign
}

interface OrderStatus {
    id: string;
    status: 'open' | 'completed' | 'cancelled';
    inAmount: string;
    outAmount: string;
    createdAt: string;
}

/**
 * Create a limit order via Jupiter API
 * Returns unsigned transaction for client to sign
 */
export async function createLimitOrder(params: LimitOrderParams): Promise<LimitOrderResponse | null> {
    try {
        const response = await axios.post(`${JUPITER_LIMIT_API}/createOrder`, {
            owner: params.owner,
            inToken: params.inToken,
            outToken: params.outToken,
            inAmount: params.inAmount.toString(),
            outAmount: params.outAmount.toString(),
        }, {
            timeout: 10000
        });

        return {
            orderId: response.data.orderId,
            transaction: response.data.transaction
        };
    } catch (error) {
        console.error('Failed to create limit order:', error);
        return null;
    }
}

/**
 * Cancel an existing limit order
 * Returns unsigned transaction (base64) for client to sign and broadcast
 */
export async function cancelLimitOrder(orderId: string): Promise<string | null> {
    try {
        const response = await axios.post(`${JUPITER_LIMIT_API}/cancelOrder`, {
            orderId
        }, {
            timeout: 10000
        });

        // Returns base64 encoded transaction for client to sign
        return response.data.transaction;
    } catch (error) {
        console.error('Failed to cancel limit order:', error);
        return null;
    }
}

/**
 * Cancel multiple limit orders and return transactions for signing
 */
export async function cancelLimitOrders(orderIds: string[]): Promise<{ orderId: string; transaction: string | null }[]> {
    const results = [];
    for (const orderId of orderIds) {
        const transaction = await cancelLimitOrder(orderId);
        results.push({ orderId, transaction });
    }
    return results;
}

/**
 * Check status of a limit order
 */
export async function checkOrderStatus(orderId: string): Promise<OrderStatus | null> {
    try {
        const response = await axios.get(`${JUPITER_LIMIT_API}/order/${orderId}`, {
            timeout: 5000
        });

        return {
            id: response.data.id,
            status: response.data.status,
            inAmount: response.data.inAmount,
            outAmount: response.data.outAmount,
            createdAt: response.data.createdAt
        };
    } catch (error) {
        console.error('Failed to check order status:', error);
        return null;
    }
}

/**
 * Get all open orders for a wallet
 */
export async function getOpenOrders(walletAddress: string): Promise<OrderStatus[]> {
    try {
        const response = await axios.get(`${JUPITER_LIMIT_API}/orders`, {
            params: { owner: walletAddress },
            timeout: 5000
        });

        return response.data.orders || [];
    } catch (error) {
        console.error('Failed to get open orders:', error);
        return [];
    }
}

/**
 * Calculate SL/TP prices based on entry price
 */
export function calculateSLTPPrices(
    entryPrice: number,
    stopLossPercent: number,
    takeProfitPercent: number
): { slPrice: number; tpPrice: number } {
    // SL price = entry price * (1 - SL%)
    const slPrice = entryPrice * (1 - stopLossPercent / 100);
    
    // TP price = entry price * (1 + TP%)
    const tpPrice = entryPrice * (1 + takeProfitPercent / 100);

    return { slPrice, tpPrice };
}

/**
 * Calculate output amount for limit order based on desired price
 * @param inputAmount Amount of input token
 * @param desiredPrice Desired price (output per input)
 * @param inputDecimals Decimals of input token
 * @param outputDecimals Decimals of output token
 */
export function calculateLimitOrderOutput(
    inputAmount: number,
    desiredPrice: number,
    inputDecimals: number = 6,
    outputDecimals: number = 6
): number {
    // Convert input to raw amount
    const inputRaw = inputAmount * Math.pow(10, inputDecimals);
    
    // Calculate output based on desired price
    // desiredPrice = outputAmount / inputAmount
    // outputAmount = desiredPrice * inputAmount
    const outputRaw = desiredPrice * inputRaw;
    
    return Math.floor(outputRaw);
}

interface SwapQuoteParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    userPublicKey: string;
}

interface SwapTransaction {
    swapTransaction: string;  // Base64 encoded transaction
    lastValidBlockHeight: number;
    prioritizationFeeLamports?: number;
}

/**
 * Get a swap transaction from Jupiter API
 * Returns unsigned transaction for client to sign
 */
export async function getSwapTransaction(params: SwapQuoteParams): Promise<SwapTransaction | null> {
    try {
        // First get a quote
        const quoteResponse = await axios.get(`${JUPITER_SWAP_API}/quote`, {
            params: {
                inputMint: params.inputMint,
                outputMint: params.outputMint,
                amount: params.amount.toString(),
                slippageBps: params.slippageBps || 50
            },
            timeout: 10000
        });

        const quote = quoteResponse.data;
        if (!quote || !quote.routePlan) {
            console.error('No swap route found');
            return null;
        }

        // Get swap transaction
        const swapResponse = await axios.post(`${JUPITER_SWAP_API}/swap`, {
            quoteResponse: quote,
            userPublicKey: params.userPublicKey,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto'
        }, {
            timeout: 10000
        });

        return {
            swapTransaction: swapResponse.data.swapTransaction,
            lastValidBlockHeight: swapResponse.data.lastValidBlockHeight,
            prioritizationFeeLamports: swapResponse.data.prioritizationFeeLamports
        };
    } catch (error) {
        console.error('Failed to get swap transaction:', error);
        return null;
    }
}

// Token decimals cache
let tokenDecimalsCache: Map<string, number> | null = null;
let tokenDecimalsCacheTime: number = 0;
const TOKEN_DECIMALS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get token decimals from Jupiter token list
 * Returns 6 as default if token not found
 */
export async function getTokenDecimals(mintAddress: string): Promise<number> {
    // Special case for SOL
    if (mintAddress === 'So11111111111111111111111111111111111111112') {
        return 9;
    }

    // Check cache
    const now = Date.now();
    if (tokenDecimalsCache && now - tokenDecimalsCacheTime < TOKEN_DECIMALS_CACHE_TTL) {
        const cached = tokenDecimalsCache.get(mintAddress);
        if (cached !== undefined) return cached;
    }

    try {
        const response = await axios.get(JUPITER_TOKEN_API, { timeout: 10000 });
        const tokens = response.data || [];
        
        // Build cache
        tokenDecimalsCache = new Map();
        for (const token of tokens) {
            if (token.address && typeof token.decimals === 'number') {
                tokenDecimalsCache.set(token.address, token.decimals);
            }
        }
        tokenDecimalsCacheTime = now;

        // Return cached value or default
        return tokenDecimalsCache.get(mintAddress) ?? 6;
    } catch (error) {
        console.warn('Failed to fetch token decimals, using defaults:', error);
        // Fallback defaults for common tokens
        const fallbackDecimals: Record<string, number> = {
            'So11111111111111111111111111111111111111112': 9, // SOL
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5, // BONK
        };
        return fallbackDecimals[mintAddress] ?? 6;
    }
}
