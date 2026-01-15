// Stub file - GDPR service disabled for beta
export const gdprService = {
    processDataDeletion: async (_requestId: string, _processedBy: string) => ({ success: true }),
    requestDataExport: async () => ({ success: true }),
    getDataDeletionStatus: async () => 'COMPLETED',
    cancelDeletionRequest: async () => ({ success: true }),
};
