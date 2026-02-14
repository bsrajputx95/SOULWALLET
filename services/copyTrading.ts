import { api } from './api';

export interface CopyTradingWallet {
    publicKey: string;
    balance: number;
    status: string;
}

export interface CopyTradingConfig {
    id: string;
    name?: string;
    traderAddress: string;
    totalInvestment: number;
    perTradeAmount: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    exitWithTrader: boolean;
    isActive: boolean;
    copyWallet?: {
        publicKey: string;
        status: string;
        availableAmount: number;
        lastBalanceCheckAt?: string | null;
    } | null;
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
    name?: string;
    traderAddress: string;
    totalInvestment: number;
    perTradeAmount: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    exitWithTrader: boolean;
}

interface CopyWalletApiResponse {
    success: boolean;
    wallet: CopyTradingWallet | null;
    error?: string;
}

interface StopCopyTradingResult {
    success: boolean;
    message?: string;
    cancelTransactions?: Array<{ positionId: string; orderId: string; transaction: string }>;
    pendingPositions?: Array<{ id: string; status: string }>;
    error?: string;
}

/**
 * Create or update copy trading configuration
 */
export async function createCopyConfig(
    config: CreateConfigParams,
    _authToken: string
): Promise<{ success: boolean; config?: CopyTradingConfig; error?: string }> {
    try {
        const data = await api.post<{ success: boolean; config: CopyTradingConfig; error?: string }>('/copy-trade/config', config);
        return { success: true, config: data.config };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to save copy trading config' };
    }
}

/**
 * Fetch user's copy trading config
 */
export async function fetchCopyConfig(
    _authToken: string
): Promise<{ success: boolean; config?: CopyTradingConfig; error?: string }> {
    try {
        const data = await api.get<{ success: boolean; config: CopyTradingConfig | null; error?: string }>('/copy-trade/config');
        return data.config
            ? { success: true, config: data.config }
            : { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to fetch copy trading config' };
    }
}

/**
 * Fetch user's open copy positions
 */
export async function fetchCopyPositions(
    _authToken: string
): Promise<{ success: boolean; positions?: CopyPosition[]; error?: string }> {
    try {
        const data = await api.get<{ success: boolean; positions: CopyPosition[]; error?: string }>('/copy-trade/positions');
        return { success: true, positions: data.positions || [] };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to fetch copy positions' };
    }
}

/**
 * Stop copy trading and remove active config
 */
export async function stopCopyTrading(
    _authToken: string
): Promise<StopCopyTradingResult> {
    try {
        const data = await api.delete<{
            success: boolean;
            message?: string;
            cancelTransactions?: Array<{ positionId: string; orderId: string; transaction: string }>;
            pendingPositions?: Array<{ id: string; status: string }>;
            error?: string;
        }>('/copy-trade/config');
        return {
            success: true,
            ...(data.message ? { message: data.message } : {}),
            ...(data.cancelTransactions ? { cancelTransactions: data.cancelTransactions } : {}),
            ...(data.pendingPositions ? { pendingPositions: data.pendingPositions } : {})
        };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to stop copy trading' };
    }
}

/**
 * Create (or return existing) custodial copy wallet
 */
export async function createCopyWallet(
    _authToken: string
): Promise<{ success: boolean; wallet?: CopyTradingWallet; error?: string }> {
    try {
        const data = await api.post<{ success: boolean; wallet: CopyTradingWallet; error?: string }>('/copy-trade/wallet/create', {});
        return { success: true, wallet: data.wallet };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to create copy wallet' };
    }
}

/**
 * Fetch custodial copy wallet details and balance
 */
export async function fetchCopyWallet(
    _authToken: string
): Promise<{ success: boolean; wallet?: CopyTradingWallet | null; error?: string }> {
    try {
        const data = await api.get<CopyWalletApiResponse>('/copy-trade/wallet');
        return { success: true, wallet: data.wallet };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to fetch copy wallet' };
    }
}

/**
 * Withdraw SOL from copy wallet to main wallet
 * If amount is omitted, backend withdraws max available amount.
 */
export async function withdrawCopyWallet(
    _authToken: string,
    amount?: number
): Promise<{ success: boolean; signature?: string; withdrawnAmount?: number; error?: string }> {
    try {
        const payload = typeof amount === 'number' && amount > 0 ? { amount } : {};
        const data = await api.post<{ success: boolean; signature: string; withdrawnAmount: number; error?: string }>('/copy-trade/wallet/withdraw', payload);
        return {
            success: true,
            signature: data.signature,
            withdrawnAmount: data.withdrawnAmount
        };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to withdraw from copy wallet' };
    }
}
