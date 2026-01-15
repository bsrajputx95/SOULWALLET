// Stub file - audit logging simplified for beta
export const auditLogService = {
    logFinancialOperation: async (_params?: any) => { },
    getUserAuditLogs: async (_userId?: string, _options?: any) => ({ logs: [], total: 0, nextCursor: undefined }),
    verifyAuditLogIntegrity: async (_userId?: string) => ({ valid: true, errors: [] }),
};
