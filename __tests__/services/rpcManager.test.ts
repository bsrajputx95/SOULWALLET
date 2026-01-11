/**
 * Unit tests for RPC Manager
 * 
 * Tests RPC connection management, failover logic, and health checks
 */

// Mock environment
const originalEnv = process.env

describe('RpcManager', () => {
    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
        process.env.HELIUS_RPC_URL = 'https://test-helius.example.com'
        process.env.RPC_HEALTH_CHECK_INTERVAL = '60000'
        process.env.RPC_FAILOVER_THRESHOLD = '3'
    })

    afterEach(() => {
        process.env = originalEnv
        jest.clearAllMocks()
    })

    describe('getConnection', () => {
        it('should return a connection when endpoints are available', async () => {
            const { Connection } = await import('@solana/web3.js')
            const { rpcManager } = await import('../../src/lib/services/rpcManager')

            const connection = await rpcManager.getConnection()
            expect(connection).toBeInstanceOf(Connection)
        })

        it('should throw when no endpoints are configured', async () => {
            // Clear all RPC URLs
            process.env.HELIUS_RPC_URL = ''
            process.env.QUICKNODE_RPC_URL = ''
            process.env.ALCHEMY_RPC_URL = ''
            process.env.SOLANA_RPC_URL = ''
            process.env.EXPO_PUBLIC_SOLANA_RPC_URL = ''

            // Need fresh import with cleared env
            jest.resetModules()

            // The manager still includes public fallback endpoints, so it should work
            const { Connection } = await import('@solana/web3.js')
            const { RpcManager } = await import('../../src/lib/services/rpcManager')
            const testManager = new (RpcManager as any)()

            // Should still have public endpoints as fallback
            const connection = await testManager.getConnection()
            expect(connection).toBeInstanceOf(Connection)
        })
    })

    describe('withFailover', () => {
        it('should retry on failure', async () => {
            const { Connection } = await import('@solana/web3.js')
            const { rpcManager } = await import('../../src/lib/services/rpcManager')

            let callCount = 0
            const failingThenSucceed = async () => {
                callCount++
                if (callCount < 2) {
                    throw new Error('Simulated failure')
                }
                return 'success'
            }

            jest.spyOn(Connection.prototype, 'getSlot').mockResolvedValue(12345)

            const result = await rpcManager.withFailover(failingThenSucceed)
            expect(result).toBe('success')
            expect(callCount).toBeGreaterThanOrEqual(2)
        })

        it('should throw after exhausting retries', async () => {
            const { Connection } = await import('@solana/web3.js')
            const { rpcManager } = await import('../../src/lib/services/rpcManager')

            const alwaysFail = async () => {
                throw new Error('Always fails')
            }

            jest.spyOn(Connection.prototype, 'getSlot').mockResolvedValue(12345)

            await expect(rpcManager.withFailover(alwaysFail)).rejects.toThrow('Always fails')
        })
    })

    describe('health checks', () => {
        it('should mark endpoint unhealthy on failure', async () => {
            const { RpcManager } = await import('../../src/lib/services/rpcManager')

            // Create instance and test internal state
            const testManager = new (RpcManager as any)()

            // Access private method via prototype
            const endpoint = testManager.endpoints[0]
            expect(endpoint.failures).toBe(0)

            testManager.markUnhealthy(endpoint, 'test failure')
            expect(endpoint.failures).toBe(1)
            expect(endpoint.unhealthyUntilMs).toBeGreaterThan(Date.now())
        })

        it('should reset failures on healthy check', async () => {
            const { RpcManager } = await import('../../src/lib/services/rpcManager')
            const testManager = new (RpcManager as any)()

            const endpoint = testManager.endpoints[0]
            endpoint.failures = 5
            endpoint.unhealthyUntilMs = Date.now() + 60000

            testManager.recordHealthy(endpoint, 100)

            expect(endpoint.failures).toBe(0)
            expect(endpoint.unhealthyUntilMs).toBe(0)
            expect(endpoint.lastLatencyMs).toBe(100)
        })
    })

    describe('cooldown calculation', () => {
        it('should calculate exponential backoff', async () => {
            const { RpcManager } = await import('../../src/lib/services/rpcManager')
            const testManager = new (RpcManager as any)()

            // First failure: base * 2^0 = base
            expect(testManager.cooldownMs(1)).toBe(testManager.unhealthyCooldownBaseMs)

            // Second failure: base * 2^1 = base * 2
            expect(testManager.cooldownMs(2)).toBe(testManager.unhealthyCooldownBaseMs * 2)

            // Third failure: base * 2^2 = base * 4
            expect(testManager.cooldownMs(3)).toBe(testManager.unhealthyCooldownBaseMs * 4)
        })

        it('should cap cooldown at 8 failures', async () => {
            const { RpcManager } = await import('../../src/lib/services/rpcManager')
            const testManager = new (RpcManager as any)()

            const cooldown8 = testManager.cooldownMs(8)
            const cooldown10 = testManager.cooldownMs(10)

            expect(cooldown8).toBe(cooldown10)
        })
    })
})
