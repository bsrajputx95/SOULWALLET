import { api } from './api';
import { executeSwap, SwapQuote, getTokenDecimals } from './swap';

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

export interface IBuyQueueItem {
    id: string;
    postId: string;
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    position?: number;
    errorMessage?: string;
    createdAt: string;
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

// Execute IBUY via Queue (handles viral posts)
export const executeIBuy = async (
    postId: string,
    amount: number,
    pin: string
): Promise<{ success: boolean; position?: IBuyPosition; error?: string; queued?: boolean; queueId?: string }> => {
    try {
        // Step 1: Add to queue
        const queueRes = await api.post<{
            success: boolean;
            queued: boolean;
            queueId: string;
            position: number;
            tokenAddress: string;
            tokenSymbol: string;
            message: string;
        }>('/ibuy/prepare', { postId, amount });

        if (!queueRes.success) {
            return { success: false, error: 'Failed to queue iBuy' };
        }

        // Step 2: Wait for queue processing (poll for quote)
        let quote: SwapQuote | null = null;
        let retries = 0;
        const maxRetries = 30; // 30 seconds max wait

        while (!quote && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
            
            const statusRes = await api.get<{
                success: boolean;
                items: Array<{
                    id: string;
                    status: string;
                    quote?: string;
                    errorMessage?: string;
                }>;
            }>('/ibuy/queue');

            const item = statusRes.items.find(i => i.id === queueRes.queueId);
            if (item) {
                if (item.status === 'failed') {
                    return { success: false, error: item.errorMessage || 'Queue processing failed' };
                }
                if (item.quote) {
                    quote = JSON.parse(item.quote);
                }
            }
            retries++;
        }

        if (!quote) {
            return { success: false, error: 'Timeout waiting for quote' };
        }

        // Step 3: Execute swap
        const swapResult = await executeSwap(quote, pin);

        if (!swapResult.success || !swapResult.signature) {
            return { success: false, error: swapResult.error || 'Swap failed' };
        }

        // Step 4: Complete the queue item
        const completeRes = await api.post<{
            success: boolean;
            positionId: string;
        }>('/ibuy/execute', {
            queueId: queueRes.queueId,
            signature: swapResult.signature
        });

        if (!completeRes.success) {
            return { success: false, error: 'Failed to complete iBuy' };
        }

        // Get the created position
        const positionsRes = await getMyIBuyBag();
        const position = positionsRes.positions?.find(p => p.id === completeRes.positionId);

        return { success: true, position };
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

// Get queue status
export const getIBuyQueueStatus = async (): Promise<{
    success: boolean;
    pending: number;
    processing: number;
    items: IBuyQueueItem[];
}> => {
    try {
        const response = await api.get<{
            success: boolean;
            pending: number;
            processing: number;
            items: IBuyQueueItem[];
        }>('/ibuy/queue');
        return response;
    } catch {
        return { success: false, pending: 0, processing: 0, items: [] };
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
