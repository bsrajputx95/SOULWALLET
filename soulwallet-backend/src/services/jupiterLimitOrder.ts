import axios from 'axios';

const JUPITER_LIMIT_API = process.env.JUPITER_LIMIT_API || 'https://jup.ag/api/limit/v1';

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
 * Returns unsigned transaction for client to sign
 */
export async function cancelLimitOrder(orderId: string): Promise<string | null> {
    try {
        const response = await axios.post(`${JUPITER_LIMIT_API}/cancelOrder`, {
            orderId
        }, {
            timeout: 10000
        });

        return response.data.transaction;
    } catch (error) {
        console.error('Failed to cancel limit order:', error);
        return null;
    }
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
