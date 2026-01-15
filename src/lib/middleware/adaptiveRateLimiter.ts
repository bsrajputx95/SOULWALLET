// Stub file - adaptive rate limiting disabled for beta
export const adaptiveRateLimiter = {
    isActive: () => false,
    getStatus: () => ({ active: false }),
    checkLimit: async () => ({ allowed: true }),
};

export class AdaptiveRateLimiter {
    static isActive = () => false;
    static getStatus = () => ({ active: false });
    static checkLimit = async () => ({ allowed: true });
}
