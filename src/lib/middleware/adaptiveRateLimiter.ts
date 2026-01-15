// Stub file - adaptive rate limiting disabled for beta
export const adaptiveRateLimiter = {
    isActive: () => false,
    getStatus: () => ({ active: false }),
    checkLimit: async () => ({ allowed: true }),
    getMetrics: () => ({
        currentMultiplier: 1,
        baseLimit: 100,
        effectiveLimit: 100,
        activeSince: null,
    }),
    getAllStates: () => ({}),
};

export class AdaptiveRateLimiter {
    static isActive = () => false;
    static getStatus = () => ({ active: false });
    static checkLimit = async () => ({ allowed: true });
    static getMetrics = () => ({
        currentMultiplier: 1,
        baseLimit: 100,
        effectiveLimit: 100,
        activeSince: null,
    });
    static getAllStates = () => ({});
}
