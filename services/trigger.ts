import { api } from './api';
import { getLocalPublicKey } from './wallet';

export interface TriggerOrderParams {
    inputMint: string;
    outputMint: string;
    makingAmount: string;  // Amount of input token (in smallest units)
    takingAmount: string;  // Minimum amount of output token (in smallest units)
    slippageBps?: number;
}

export interface TriggerOrderResponse {
    orderId: string;
    transaction: string;  // Base64 encoded transaction to sign
}

export interface TriggerOrder {
    id: string;
    inputMint: string;
    outputMint: string;
    makingAmount: string;
    takingAmount: string;
    status: 'open' | 'completed' | 'cancelled';
    createdAt: string;
}

/**
 * Create a trigger (limit) order via Jupiter API
 * Returns unsigned transaction for client to sign
 */
export async function createTriggerOrder(params: TriggerOrderParams): Promise<TriggerOrderResponse | null> {
    try {
        const publicKey = await getLocalPublicKey();
        if (!publicKey) {
            throw new Error('No wallet connected');
        }

        const response = await api.post<TriggerOrderResponse>('/trigger/createOrder', {
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            maker: publicKey,
            payer: publicKey,
            makingAmount: params.makingAmount,
            takingAmount: params.takingAmount,
            slippageBps: params.slippageBps || 0,
        });

        return response;
    } catch (error) {
        console.error('[Trigger] Failed to create order:', error);
        throw error;
    }
}

/**
 * Execute a signed trigger order
 */
export async function executeTriggerOrder(
    signedTransaction: string,
    orderId: string
): Promise<{ status: string; signature: string } | null> {
    try {
        const response = await api.post<{ status: string; signature: string }>('/trigger/execute', {
            signedTransaction,
            orderId,
        });

        return response;
    } catch (error) {
        console.error('[Trigger] Failed to execute order:', error);
        throw error;
    }
}

/**
 * Cancel a trigger order
 */
export async function cancelTriggerOrder(orderId: string): Promise<string | null> {
    try {
        const response = await api.post<{ transaction: string }>('/trigger/cancelOrder', {
            orderId,
        });

        return response.transaction;
    } catch (error) {
        console.error('[Trigger] Failed to cancel order:', error);
        throw error;
    }
}

/**
 * Get user's trigger orders
 */
export async function getTriggerOrders(status?: 'open' | 'completed' | 'cancelled'): Promise<TriggerOrder[]> {
    try {
        const publicKey = await getLocalPublicKey();
        if (!publicKey) {
            return [];
        }

        const params = new URLSearchParams({ user: publicKey });
        if (status) {
            params.append('orderStatus', status);
        }

        const response = await api.get<{ orders: TriggerOrder[] }>(`/trigger/orders?${params}`);
        return response.orders || [];
    } catch (error) {
        console.error('[Trigger] Failed to get orders:', error);
        return [];
    }
}



/**
 * Calculate output amount for a limit order based on target price
 * @param inputAmount Amount of input token (in token units, not raw)
 * @param targetPrice Target price (output token per input token)
 * @param inputDecimals Decimals of input token
 * @param outputDecimals Decimals of output token
 */
export function calculateLimitOutput(
    inputAmount: number,
    targetPrice: number,
    inputDecimals: number = 6,
    outputDecimals: number = 6
): string {
    // Convert input to raw amount
    const inputRaw = inputAmount * Math.pow(10, inputDecimals);

    // Calculate expected output at target price
    // targetPrice = outputAmount / inputAmount
    // outputAmount = targetPrice * inputAmount
    const expectedOutputRaw = targetPrice * inputRaw;

    // Round down to ensure order can be filled
    return Math.floor(expectedOutputRaw).toString();
}

/**
 * Calculate input amount for a buy limit order based on target price
 * @param outputAmount Desired amount of output token (in token units)
 * @param targetPrice Target price (output token per input token)
 * @param inputDecimals Decimals of input token
 * @param outputDecimals Decimals of output token
 */
export function calculateLimitInput(
    outputAmount: number,
    targetPrice: number,
    inputDecimals: number = 6,
    outputDecimals: number = 6
): string {
    // Convert output to raw amount
    const outputRaw = outputAmount * Math.pow(10, outputDecimals);

    // Calculate required input at target price
    // targetPrice = outputAmount / inputAmount
    // inputAmount = outputAmount / targetPrice
    const requiredInputRaw = outputRaw / targetPrice;

    // Round up to ensure we have enough input
    return Math.ceil(requiredInputRaw).toString();
}
