// Stub file - KYC/AML disabled for beta
export const kycService = {
    getVerification: async (_userId?: string) => null,
    submitVerification: async (_userId?: string, _data?: any) => ({ success: true }),
    getStatus: async (_userId?: string) => 'NOT_REQUIRED',
    submitKYCVerification: async (_userId?: string, _data?: any, _extra?: any) => ({ success: true, status: 'NOT_REQUIRED' }),
    getKYCStatus: async (_userId?: string) => ({ status: 'NOT_REQUIRED', verified: true }),
    updateKYCStatus: async (_userId?: string, _status?: any, _extra?: any) => ({ success: true }),
};

export const amlService = {
    monitorTransaction: async () => ({ flagged: false }),
    checkAddress: async () => ({ clean: true }),
    getAlerts: async () => [],
};
