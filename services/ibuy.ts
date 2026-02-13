import { api } from './api';
import { executeSwap, getQuote, SwapQuote, getTokenDecimals } from './swap';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface IBuyPosition {
    id: string;
    userId: string;
    postId: string;
    creatorId: string;
    tokenAddress: string;
    tokenSymbol: string;
    entryPrice: number;
    solAmount: number;
    tokenAmount: number;
    creatorFee: number;
    remainingAmount: number;
    realizedPnl: number;
    creatorSharePaid: number;
    status: 'open' | 'closed';
    createdAt: string;
    closedAt?: string;
    // Computed fields from API
    currentPrice?: number;
    currentValue?: number;
    unrealizedPnl?: number;
    pnlPercent?: number;
}

export interface IBuySettings {
    ibuySlippage: number;
    ibuyDefaultSol: number;
    autoApprove: boolean;
}

// Verify token for post
export const verifyTokenForPost = async (address: string): Promise<{
    valid: boolean;
    symbol?: string;
    name?: string;
    price?: number;
    verified?: boolean;
    error?: string;
}> => {
    try {
        const response = await api.post<{ valid: boolean; symbol?: string; name?: string; price?: number; verified?: boolean; error?: string }>('/tokens/verify', { address });
        return response;
    } catch (error: any) {
        return { valid: false, error: error.message || 'Verification failed' };
    }
};

// Get IBUY settings
export const getIBuySettings = async (): Promise<IBuySettings> => {
    try {
        const response = await api.get<{ success: boolean; settings: IBuySettings }>('/ibuy/settings');
        return response.settings;
    } catch (error: any) {
        // Return defaults on error
        return { ibuySlippage: 50, ibuyDefaultSol: 0.1, autoApprove: false };
    }
};

// Update IBUY settings
export const updateIBuySettings = async (settings: Partial<IBuySettings>): Promise<{ success: boolean; error?: string }> => {
    try {
        await api.put('/ibuy/settings', settings);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

// Execute IBUY (buy token from post)
export const executeIBuy = async (
    postId: string,
    amount: number,
    pin: string
): Promise<{ success: boolean; position?: IBuyPosition; error?: string }> => {
    try {
        // Step 1: Get settings for slippage
        const settings = await getIBuySettings();

        // Step 2: Prepare IBUY (get quote from backend)
        const prepareRes = await api.post<{
            success: boolean;
            quote: SwapQuote;
            tokenAddress: string;
            tokenSymbol: string;
            amount: number;
            creatorFee: number;
            error?: string;
        }>('/ibuy/prepare', { postId, amount });

        if (!prepareRes.success) {
            return { success: false, error: prepareRes.error || 'Prepare failed' };
        }

        // Step 3: Execute swap using swap service
        const swapResult = await executeSwap(prepareRes.quote, pin);

        if (!swapResult.success || !swapResult.signature) {
            return { success: false, error: swapResult.error || 'Swap failed' };
        }

        // Get output token decimals from Jupiter
        const tokenDecimals = await getTokenDecimals(prepareRes.tokenAddress);

        // Calculate token amount received using correct decimals
        const tokenAmount = parseInt(prepareRes.quote.outAmount) / Math.pow(10, tokenDecimals);

        // Calculate price as SOL per token (SOL spent / tokens received)
        const solSpent = prepareRes.amount;
        const price = tokenAmount > 0 ? solSpent / tokenAmount : 0;

        const executeRes = await api.post<{
            success: boolean;
            position: IBuyPosition;
        }>('/ibuy/execute', {
            postId,
            signature: swapResult.signature,
            tokenAmount,
            solAmount: prepareRes.amount,
            price,
            creatorFee: prepareRes.creatorFee
        });

        return { success: true, position: executeRes.position };
    } catch (error: any) {
        return { success: false, error: error.message || 'IBUY failed' };
    }
};

// Get my IBUY positions
export const getMyIBuyBag = async (): Promise<{ success: boolean; positions?: IBuyPosition[]; error?: string }> => {
    try {
        const response = await api.get<{ success: boolean; positions: IBuyPosition[] }>('/ibuy/positions');
        return { success: true, positions: response.positions };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

// Sell IBUY position (2-step: prepare + execute)
export const sellIBuyPosition = async (
    positionId: string,
    percentage: number,
    pin: string
): Promise<{ success: boolean; solReceived?: number; profit?: number; creatorShare?: number; error?: string }> => {
    try {
        // Step 1: Prepare sell (get quote, no DB changes)
        const prepareRes = await api.post<{
            success: boolean;
            pendingId: string;
            quote: SwapQuote;
            error?: string;
        }>('/ibuy/sell/prepare', { positionId, percentage });

        if (!prepareRes.success) {
            return { success: false, error: prepareRes.error || 'Sell prepare failed' };
        }

        // Step 2: Execute swap
        const swapResult = await executeSwap(prepareRes.quote, pin);

        if (!swapResult.success || !swapResult.signature) {
            return { success: false, error: swapResult.error || 'Swap execution failed' };
        }

        // Step 3: Execute sell on backend (update DB with actual results)
        const executeRes = await api.post<{
            success: boolean;
            solReceived: number;
            profit: number;
            creatorShare: number;
            isFullyClosed: boolean;
            error?: string;
        }>('/ibuy/sell/execute', {
            pendingId: prepareRes.pendingId,
            signature: swapResult.signature,
            actualOutAmount: prepareRes.quote.outAmount
        });

        if (!executeRes.success) {
            return { success: false, error: executeRes.error || 'Sell execution failed' };
        }

        return {
            success: true,
            solReceived: executeRes.solReceived,
            profit: executeRes.profit,
            creatorShare: executeRes.creatorShare
        };
    } catch (error: any) {
        return { success: false, error: error.message || 'Sell failed' };
    }
};

// Get creator earnings
export const getCreatorEarnings = async (): Promise<{
    success: boolean;
    totalEarnings?: number;
    positionCount?: number;
    avgProfit?: number;
    breakdown?: Array<{ postId: string; tokenSymbol: string; earnings: number }>;
    error?: string;
}> => {
    try {
        const response = await api.get<{
            success: boolean;
            totalEarnings: number;
            positionCount: number;
            avgProfit: number;
            breakdown: Array<{ postId: string; tokenSymbol: string; earnings: number }>;
        }>('/ibuy/creator-earnings');
        return { success: true, ...response };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
