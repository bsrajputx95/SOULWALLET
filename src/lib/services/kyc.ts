// Stub file - KYC/AML disabled for beta
export const kycService = {
    getVerification: async () => null,
    submitVerification: async () => ({ success: true }),
    getStatus: async () => 'NOT_REQUIRED',
    submitKYCVerification: async () => ({ success: true, status: 'NOT_REQUIRED' }),
};

export const amlService = {
    monitorTransaction: async () => ({ flagged: false }),
    checkAddress: async () => ({ clean: true }),
    getAlerts: async () => [],
};
