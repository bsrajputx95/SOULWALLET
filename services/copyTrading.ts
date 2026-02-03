import * as SecureStore from 'expo-secure-store';
import { executeSwap, getQuote } from './swap';
import { getKeypairForSigning } from './wallet';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Types
export interface CopyTradingConfig {
    id: string;
    traderAddress: string;
    totalInvestment: number;
    perTradeAmount: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    exitWithTrader: boolean;
    isActive: boolean;
}

export interface CopyTradeQueueItem {
    id: string;
    configId: string;
    traderTxSignature: string;
    traderAddress: string;
    inputMint: string;
    inputSymbol: string;
    outputMint: string;
    outputSymbol: string;
    inputAmount: number;
    entryPrice: number;
    slPrice?: number;
    tpPrice?: number;
    status: string;
    expiresAt: string;
    createdAt: string;
}

export interface CopyPosition {
    id: string;
    configId: string;
    traderTxSignature: string;
    inputMint: string;
    inputSymbol: string;
    outputMint: string;
    outputSymbol: string;
    entryAmount: number;
    entryPrice: number;
    tokenAmount: number;
    slPrice?: number;
    tpPrice?: number;
    slOrderId?: string;
    tpOrderId?: string;
    status: string;
    closedAt?: string;
    createdAt: string;
}

interface CreateConfigParams {
    traderAddress: string;
    totalInvestment: number;
    perTradeAmount: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    exitWithTrader: boolean;
}

/**
 * Create or update copy trading configuration
 */
export async function createCopyConfig(
    config: CreateConfigParams,
    authToken: string
): Promise<{ success: boolean; config?: CopyTradingConfig; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to create config' };
        }

        return { success: true, config: data.config };
    } catch (error: any) {
        return { success: false, error: error.message || 'Network error' };
    }
}

/**
 * Fetch user's copy trading config
 */
export async function fetchCopyConfig(
    authToken: string
): Promise<{ success: boolean; config?: CopyTradingConfig; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/config`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true, config: data.config };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Check for pending copy trade queue items
 */
export async function checkCopyTradeQueue(
    authToken: string
): Promise<{ success: boolean; queue?: CopyTradeQueueItem[]; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/queue`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true, queue: data.queue };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Execute a copy trade from queue
 * Step 1: Execute main swap
 * Step 2: Create SL limit order
 * Step 3: Create TP limit order
 * Step 4: Mark as executed
 */
export async function executeCopyTrade(
    queueItem: CopyTradeQueueItem,
    pin: string,
    authToken: string
): Promise<{ 
    success: boolean; 
    signature?: string; 
    slOrderId?: string; 
    tpOrderId?: string;
    error?: string;
}> {
    try {
        // Step 1: Execute main swap (buy the token)
        // Get quote for buying inputToken with outputToken
        const amountInSmallestUnits = Math.floor(
            queueItem.inputAmount * Math.pow(10, 6) // Assuming 6 decimals for output token (USDC)
        );

        const quote = await getQuote(
            queueItem.outputMint,  // From token (what we spend, e.g., USDC)
            queueItem.inputMint,   // To token (what we buy, e.g., trader's token)
            amountInSmallestUnits,
            50 // 0.5% slippage
        );

        if (!quote) {
            return { success: false, error: 'Failed to get swap quote' };
        }

        // Execute the swap
        const swapResult = await executeSwap(quote, pin);

        if (!swapResult.success) {
            return { success: false, error: swapResult.error || 'Swap failed' };
        }

        // Get keypair for signing limit orders
        const keypair = await getKeypairForSigning(pin);
        if (!keypair) {
            return { success: false, error: 'Invalid PIN' };
        }

        let slOrderId: string | undefined;
        let tpOrderId: string | undefined;

        // Step 2 & 3: Create SL/TP limit orders
        // Note: Jupiter Limit Orders require additional integration
        // For beta, we store the prices and let backend handle order creation
        // In production, you'd create actual Jupiter limit orders here

        // Clear keypair from memory
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        // @ts-ignore
        keypair = null;

        // Step 4: Mark as executed
        const executeResponse = await fetch(
            `${API_URL}/copy-trade/execute/${queueItem.id}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({ slOrderId, tpOrderId })
            }
        );

        const executeData = await executeResponse.json();

        if (!executeResponse.ok) {
            return { success: false, error: executeData.error };
        }

        return {
            success: true,
            signature: swapResult.signature,
            slOrderId,
            tpOrderId
        };

    } catch (error: any) {
        return { success: false, error: error.message || 'Execution failed' };
    }
}

/**
 * Fetch user's open copy positions
 */
export async function fetchCopyPositions(
    authToken: string
): Promise<{ success: boolean; positions?: CopyPosition[]; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/positions`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true, positions: data.positions };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Close a copy position manually
 */
export async function closeCopyPosition(
    positionId: string,
    pin: string,
    authToken: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${API_URL}/copy-trade/close/${positionId}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Stop copy trading (delete config)
 */
export async function stopCopyTrading(
    authToken: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/config`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
