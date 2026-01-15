// Stub file - transaction security middleware disabled for beta
export const transactionSecurityMiddleware = {
    preFlightCheck: async (
        _params?: any,
        _options?: any
    ) => ({
        passed: true,
        approved: true,
        error: null as string | null,
        reason: 'Beta mode - all transactions approved',
    }),
    validateTransaction: async (_a?: any, _b?: any, _c?: any, _d?: any, _e?: any, _f?: any) => ({
        valid: true,
        passed: true,
        error: null as string | null,
    }),
    reportSuspiciousActivity: async () => { },
};
