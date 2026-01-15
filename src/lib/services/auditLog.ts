/**
 * Audit Log Service - INTENTIONALLY DISABLED FOR BETA
 * 
 * This service is a no-op stub to reduce infrastructure complexity for beta.
 * Full audit logging with tamper-proof logs will be implemented post-beta.
 * 
 * Currently imported in 7 routers but performs no actual logging.
 */
export const auditLogService = {
    logFinancialOperation: async (_params?: any) => { },
    getUserAuditLogs: async (_userId?: string, _options?: any) => ({ logs: [], total: 0, nextCursor: undefined }),
    verifyAuditLogIntegrity: async (_userId?: string) => ({ valid: true, errors: [] }),
};
