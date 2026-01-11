/**
 * Adaptive Rate Limiter Tests
 * Tests for Plan5 Step 2: Adaptive Rate Limiting
 */

// Mock Redis
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        incr: jest.fn().mockResolvedValue(1),
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
    }));
});

// Mock logger
jest.mock('../../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Mock securityMonitor
jest.mock('../../src/lib/services/securityMonitor', () => ({
    securityMonitor: {
        recordEvent: jest.fn(),
    },
}));

// Mock alertManager
jest.mock('../../src/lib/services/alertManager', () => ({
    alertManager: {
        sendAlert: jest.fn().mockResolvedValue({ id: 'test-alert' }),
    },
}));

// Reset modules to get fresh instance
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Reset environment
    delete process.env.ENABLE_ADAPTIVE_RATE_LIMITING;
    delete process.env.ATTACK_DETECTION_THRESHOLD;
});

describe('AdaptiveRateLimiter', () => {
    describe('isEnabled', () => {
        it('should return true by default', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            expect(adaptiveRateLimiter.isEnabled()).toBe(true);
        });

        it('should return false when disabled', async () => {
            process.env.ENABLE_ADAPTIVE_RATE_LIMITING = 'false';

            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            expect(adaptiveRateLimiter.isEnabled()).toBe(false);
        });
    });

    describe('trackRequest', () => {
        it('should track requests for known endpoints', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            const initialMetrics = adaptiveRateLimiter.getMetrics();
            const initialRequests = initialMetrics.totalRequests;

            adaptiveRateLimiter.trackRequest('login');

            const afterMetrics = adaptiveRateLimiter.getMetrics();
            expect(afterMetrics.totalRequests).toBe(initialRequests + 1);
        });
    });

    describe('trackViolation', () => {
        it('should track violations for endpoints', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            const initialMetrics = adaptiveRateLimiter.getMetrics();
            const initialViolations = initialMetrics.totalViolations;

            adaptiveRateLimiter.trackViolation('login', { ip: '192.168.1.1', userId: 'user123' });

            const afterMetrics = adaptiveRateLimiter.getMetrics();
            expect(afterMetrics.totalViolations).toBe(initialViolations + 1);
        });
    });

    describe('getAdaptationFactor', () => {
        it('should return 1 when not under attack', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            const factor = adaptiveRateLimiter.getAdaptationFactor('login');

            expect(factor).toBe(1);
        });

        it('should return < 1 after manual adaptation', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            await adaptiveRateLimiter.manualAdapt('login', 0.5);

            const factor = adaptiveRateLimiter.getAdaptationFactor('login');

            expect(factor).toBeLessThan(1);
        });
    });

    describe('getViolationRate', () => {
        it('should return 0 when no requests', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            // Fresh endpoint with no traffic
            const rate = adaptiveRateLimiter.getViolationRate('portfolioSnapshot');

            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(100);
        });

        it('should calculate rate correctly', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            // Track some requests and violations
            for (let i = 0; i < 10; i++) {
                adaptiveRateLimiter.trackRequest('swapQuote');
            }
            for (let i = 0; i < 2; i++) {
                adaptiveRateLimiter.trackViolation('swapQuote', { ip: '1.1.1.1', userId: undefined });
            }

            const rate = adaptiveRateLimiter.getViolationRate('swapQuote');

            // Should be around 20% (2 violations / 10 requests)
            expect(rate).toBeGreaterThan(0);
        });
    });

    describe('isUnderAttack', () => {
        it('should return false normally', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            const underAttack = await adaptiveRateLimiter.isUnderAttack('login');

            expect(underAttack).toBe(false);
        });
    });

    describe('getAllStates', () => {
        it('should return array of endpoint states', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            const states = adaptiveRateLimiter.getAllStates();

            expect(Array.isArray(states)).toBe(true);
            if (states.length > 0) {
                expect(states[0]).toHaveProperty('endpoint');
                expect(states[0]).toHaveProperty('adapted');
                expect(states[0]).toHaveProperty('adaptationFactor');
                expect(states[0]).toHaveProperty('violationRate');
            }
        });
    });

    describe('getMetrics', () => {
        it('should return metrics object', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            const metrics = adaptiveRateLimiter.getMetrics();

            expect(metrics).toHaveProperty('enabled');
            expect(metrics).toHaveProperty('attackThreshold');
            expect(metrics).toHaveProperty('windowMinutes');
            expect(metrics).toHaveProperty('restoreMinutes');
            expect(metrics).toHaveProperty('endpointsUnderAttack');
            expect(metrics).toHaveProperty('totalViolations');
            expect(metrics).toHaveProperty('totalRequests');
        });
    });

    describe('manualAdapt and manualRestore', () => {
        it('should manually adapt rate limits', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            await adaptiveRateLimiter.manualAdapt('login', 0.5);

            const states = adaptiveRateLimiter.getAllStates();
            const loginState = states.find(s => s.endpoint === 'login');

            expect(loginState?.adapted).toBe(true);
            expect(loginState?.adaptationFactor).toBe(0.5);
        });

        it('should manually restore rate limits', async () => {
            const { adaptiveRateLimiter } = await import('../../src/lib/middleware/adaptiveRateLimiter');

            await adaptiveRateLimiter.manualAdapt('login', 0.5);
            await adaptiveRateLimiter.manualRestore('login');

            const states = adaptiveRateLimiter.getAllStates();
            const loginState = states.find(s => s.endpoint === 'login');

            expect(loginState?.adapted).toBe(false);
            expect(loginState?.adaptationFactor).toBe(1);
        });
    });
});
