// Stub file - audit logging disabled for beta
export const auditLogService = {
    logFinancialOperation: async () => { },
    getUserAuditLogs: async () => ({ logs: [], total: 0, nextCursor: undefined }),
    verifyAuditLogIntegrity: async () => ({ valid: true, errors: [] }),
};
