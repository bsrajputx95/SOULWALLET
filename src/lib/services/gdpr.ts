// Stub file - GDPR service disabled for beta
export const gdprService = {
    processDataDeletion: async (_requestId?: string, _processedBy?: string) => ({ success: true }),
    requestDataExport: async (_userId?: string, _extra?: any) => ({ success: true }),
    getDataDeletionStatus: async (_userId?: string) => 'COMPLETED',
    cancelDeletionRequest: async (_requestId?: string) => ({ success: true }),
    requestDataDeletion: async (_userId?: string, _reason?: string, _extra1?: any, _extra2?: any) => ({
        success: true,
        requestId: 'beta-request-id',
        gracePeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }),
    exportUserData: async (_userId?: string, _extra1?: any, _extra2?: any, _extra3?: any) => ({ success: true, data: {} }),
};
