/**
 * Trusted IPs Service Tests
 * Tests for Plan5 Step 3: Trusted IP Bypass
 */

// Mock Redis
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        sadd: jest.fn().mockResolvedValue(1),
        srem: jest.fn().mockResolvedValue(1),
        smembers: jest.fn().mockResolvedValue([]),
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
    }));
});

// Reset modules to get fresh instance
beforeEach(() => {
    jest.resetModules();
    // Reset environment
    delete process.env.ENABLE_TRUSTED_IP_BYPASS;
    delete process.env.TRUSTED_IPS;
});

describe('TrustedIpsService', () => {
    describe('isTrustedIp', () => {
        it('should return true for localhost IPv4', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '127.0.0.1,::1';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const result = await trustedIpsService.isTrustedIp('127.0.0.1');

            expect(result).toBe(true);
        });

        it('should return true for localhost IPv6', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '127.0.0.1,::1';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const result = await trustedIpsService.isTrustedIp('::1');

            expect(result).toBe(true);
        });

        it('should return false for non-trusted IP', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '127.0.0.1';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const result = await trustedIpsService.isTrustedIp('8.8.8.8');

            expect(result).toBe(false);
        });

        it('should return false when bypass is disabled', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'false';
            process.env.TRUSTED_IPS = '127.0.0.1,8.8.8.8';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const result = await trustedIpsService.isTrustedIp('127.0.0.1');

            expect(result).toBe(false);
        });
    });

    describe('CIDR matching', () => {
        it('should match IP in CIDR range', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '10.0.0.0/8';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const result = await trustedIpsService.isTrustedIp('10.1.2.3');

            expect(result).toBe(true);
        });

        it('should not match IP outside CIDR range', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '10.0.0.0/8';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const result = await trustedIpsService.isTrustedIp('192.168.1.1');

            expect(result).toBe(false);
        });

        it('should match IP in /24 subnet', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '192.168.1.0/24';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const result = await trustedIpsService.isTrustedIp('192.168.1.100');

            expect(result).toBe(true);
        });
    });

    describe('listTrustedIps', () => {
        it('should return list of trusted IPs', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '127.0.0.1,10.0.0.0/8';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const list = trustedIpsService.listTrustedIps();

            expect(Array.isArray(list)).toBe(true);
            expect(list.length).toBeGreaterThanOrEqual(2);
        });

        it('should include isCidr flag for CIDR entries', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '10.0.0.0/8';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const list = trustedIpsService.listTrustedIps();
            const cidrEntry = list.find(e => e.ip.includes('/'));

            expect(cidrEntry?.isCidr).toBe(true);
        });
    });

    describe('logBypass', () => {
        it('should log bypass events', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '127.0.0.1';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            trustedIpsService.logBypass('127.0.0.1', 'login', 'user123');

            const log = trustedIpsService.getBypassLog(10);

            expect(log.length).toBeGreaterThanOrEqual(1);
            expect(log[0].ip).toBe('127.0.0.1');
            expect(log[0].endpoint).toBe('login');
        });
    });

    describe('isEnabled', () => {
        it('should return true when enabled', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            expect(trustedIpsService.isEnabled()).toBe(true);
        });

        it('should return false when disabled', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'false';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            expect(trustedIpsService.isEnabled()).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return status object with required fields', async () => {
            process.env.ENABLE_TRUSTED_IP_BYPASS = 'true';
            process.env.TRUSTED_IPS = '127.0.0.1';

            const { trustedIpsService } = await import('../../src/lib/services/trustedIps');

            const status = trustedIpsService.getStatus();

            expect(status).toHaveProperty('enabled');
            expect(status).toHaveProperty('trustedIpCount');
            expect(status).toHaveProperty('bypassLogSize');
            expect(status).toHaveProperty('cacheSize');
        });
    });
});
