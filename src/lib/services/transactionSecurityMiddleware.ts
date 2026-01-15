// Stub file - transaction security middleware disabled for beta
export const transactionSecurityMiddleware = {
    preFlightCheck: async (
        _params: {
            type: string;
            userId: string;
            wallet: any;
            inputMint?: string;
            amountUsd?: number;
        },
        _options?: {
            maxSlippage?: number;
            useMevProtection?: boolean;
        }
    ) => ({
        passed: true,
        error: null as string | null,
        reason: 'Beta mode - all transactions approved',
    }),
    validateTransaction: async () => ({ valid: true }),
    reportSuspiciousActivity: async () => { },
};
