// Stub file - security monitor disabled for beta
export const securityMonitor = {
    trackSuspiciousActivity: async () => { },
    getSecurityEvents: async () => [],
    isBlocked: async () => false,
    blockUser: async () => { },
    unblockUser: async () => { },
    recordEvent: (_type: string, _userId?: string, _data?: Record<string, unknown>) => { },
};

export class SecurityMonitor {
    static trackSuspiciousActivity = async () => { };
    static getSecurityEvents = async () => [];
    static isBlocked = async () => false;
    static recordEvent = (_type: string, _userId?: string, _data?: Record<string, unknown>) => { };
}
