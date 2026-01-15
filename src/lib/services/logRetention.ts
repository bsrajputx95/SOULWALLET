// Stub file - log retention disabled for beta
export const logRetentionService = {
    cleanupExpiredLogs: async () => ({
        sessionActivities: 0,
        loginAttempts: 0,
        expiredExports: 0,
    }),
    archiveOldAuditLogs: async () => ({ count: 0 }),
};
