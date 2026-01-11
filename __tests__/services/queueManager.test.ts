/**
 * Queue Manager Service Tests
 * Tests for Plan5 Step 1: Request Queue Limits
 */

// Mock Redis
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        incr: jest.fn().mockResolvedValue(1),
        decr: jest.fn().mockResolvedValue(0),
        get: jest.fn().mockResolvedValue('1'),
        expire: jest.fn().mockResolvedValue(1),
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
    }));
});

// Reset modules to get fresh instance
beforeEach(() => {
    jest.resetModules();
});

describe('QueueManager', () => {
    describe('acquireSlot', () => {
        it('should acquire a slot successfully when queue is not full', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const slotId = await queueManager.acquireSlot('user123', '192.168.1.1');

            expect(slotId).not.toBeNull();
            expect(typeof slotId).toBe('string');
        });

        it('should generate unique slot IDs', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const slot1 = await queueManager.acquireSlot('user1', '192.168.1.1');
            const slot2 = await queueManager.acquireSlot('user2', '192.168.1.2');

            expect(slot1).not.toEqual(slot2);
        });

        it('should track active slots correctly', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const initialCount = queueManager.getActiveSlotCount();
            await queueManager.acquireSlot('user123', '192.168.1.1');

            expect(queueManager.getActiveSlotCount()).toBe(initialCount + 1);
        });
    });

    describe('releaseSlot', () => {
        it('should release a slot successfully', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const slotId = await queueManager.acquireSlot('user123', '192.168.1.1');
            const countBefore = queueManager.getActiveSlotCount();

            await queueManager.releaseSlot(slotId!);

            expect(queueManager.getActiveSlotCount()).toBe(countBefore - 1);
        });

        it('should handle releasing non-existent slot gracefully', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            // Should not throw
            await expect(queueManager.releaseSlot('non-existent-slot')).resolves.not.toThrow();
        });
    });

    describe('getQueueStatus', () => {
        it('should return queue metrics', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const status = await queueManager.getQueueStatus();

            expect(status).toHaveProperty('globalQueueDepth');
            expect(status).toHaveProperty('userCounts');
            expect(status).toHaveProperty('ipCounts');
            expect(status).toHaveProperty('queueFull');
            expect(status).toHaveProperty('utilizationPercent');
        });

        it('should return utilizationPercent as number', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const status = await queueManager.getQueueStatus();

            expect(typeof status.utilizationPercent).toBe('number');
            expect(status.utilizationPercent).toBeGreaterThanOrEqual(0);
            expect(status.utilizationPercent).toBeLessThanOrEqual(100);
        });
    });

    describe('getConfig', () => {
        it('should return configuration values', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const config = queueManager.getConfig();

            expect(config).toHaveProperty('maxConcurrentPerUser');
            expect(config).toHaveProperty('maxConcurrentPerIp');
            expect(config).toHaveProperty('maxQueueDepth');
            expect(config).toHaveProperty('queueTimeoutMs');
            expect(typeof config.maxQueueDepth).toBe('number');
        });
    });

    describe('isQueueFull', () => {
        it('should return false when queue is empty', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            const isFull = await queueManager.isQueueFull();

            expect(isFull).toBe(false);
        });
    });

    describe('cleanupStaleSlots', () => {
        it('should cleanup stale slots without errors', async () => {
            const { queueManager } = await import('../../src/lib/services/queueManager');

            // Should not throw
            expect(() => queueManager.cleanupStaleSlots()).not.toThrow();
        });
    });
});
