/**
 * Unit tests for Jito Service
 * 
 * Tests MEV protection, tip calculation, and bundle management
 */

describe('JitoService', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
        process.env.JITO_ENABLED = 'true'
        process.env.JITO_BLOCK_ENGINE_URL = 'https://test-jito.example.com'
        process.env.JITO_TIP_ACCOUNT = '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'
        process.env.JITO_TIP_LAMPORTS = '10000'
        process.env.JITO_BUNDLE_TIMEOUT = '30000'
    })

    afterEach(() => {
        process.env = originalEnv
        jest.clearAllMocks()
    })

    describe('isEnabled', () => {
        it('should return true when JITO_ENABLED is true', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')
            expect(jitoService.isEnabled()).toBe(true)
        })

        it('should return false when JITO_ENABLED is not set', async () => {
            process.env.JITO_ENABLED = ''
            jest.resetModules()

            const { jitoService } = await import('../../src/lib/services/jitoService')
            expect(jitoService.isEnabled()).toBe(false)
        })
    })

    describe('getTipAccount', () => {
        it('should return valid PublicKey', async () => {
            const { PublicKey } = await import('@solana/web3.js')
            const { jitoService } = await import('../../src/lib/services/jitoService')

            const tipAccount = jitoService.getTipAccount()
            expect(tipAccount).toBeInstanceOf(PublicKey)
            expect(tipAccount.toBase58()).toBe('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5')
        })
    })

    describe('calculateTip', () => {
        it('should return default tip for small trades', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            const tip = jitoService.calculateTip(50)
            expect(tip).toBe(10_000) // Default from env
        })

        it('should return higher tip for large trades', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            const smallTip = jitoService.calculateTip(50)
            const largeTip = jitoService.calculateTip(500)

            expect(largeTip).toBeGreaterThan(smallTip)
        })

        it('should return default tip when no value provided', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            const tip = jitoService.calculateTip()
            expect(tip).toBe(10_000)
        })
    })

    describe('createTipInstruction', () => {
        it('should create valid transfer instruction', async () => {
            const { PublicKey } = await import('@solana/web3.js')
            const { jitoService } = await import('../../src/lib/services/jitoService')

            const fromPubkey = new PublicKey('11111111111111111111111111111111')
            const instruction = jitoService.createTipInstruction(fromPubkey, 5000)

            expect(instruction.programId.toBase58()).toBe('11111111111111111111111111111111')
            expect(instruction.keys.length).toBeGreaterThan(0)
        })

        it('should use default tip when amount not provided', async () => {
            const { PublicKey } = await import('@solana/web3.js')
            const { jitoService } = await import('../../src/lib/services/jitoService')

            const fromPubkey = new PublicKey('11111111111111111111111111111111')
            const instruction = jitoService.createTipInstruction(fromPubkey)

            // Should not throw
            expect(instruction).toBeDefined()
        })
    })

    describe('getTipFloor', () => {
        it('should return default tip amount', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            const tipFloor = await jitoService.getTipFloor()
            expect(tipFloor).toBe(10_000)
        })
    })

    describe('sendTransaction', () => {
        it('should throw when RPC fails', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            // Mock fetch to fail
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ error: { message: 'Failed' } }),
            })

            const mockTransaction = {
                serialize: () => Buffer.from('test'),
            }

            await expect(jitoService.sendTransaction(mockTransaction as any))
                .rejects.toThrow('Jito sendTransaction failed')
        })
    })

    describe('sendBundle', () => {
        it('should throw when bundle fails', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ error: { message: 'Bundle failed' } }),
            })

            const mockTransactions = [
                { serialize: () => Buffer.from('tx1') },
                { serialize: () => Buffer.from('tx2') },
            ]

            await expect(jitoService.sendBundle(mockTransactions as any))
                .rejects.toThrow('Jito sendBundle failed')
        })
    })

    describe('waitForBundleConfirmation', () => {
        it('should return true when bundle lands', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    result: [{ bundle_id: 'test', status: 'Landed', landed_slot: 12345 }],
                }),
            })

            const result = await jitoService.waitForBundleConfirmation('test-bundle-id')
            expect(result).toBe(true)
        })

        it('should return false when bundle fails', async () => {
            const { jitoService } = await import('../../src/lib/services/jitoService')

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    result: [{ bundle_id: 'test', status: 'Failed' }],
                }),
            })

            const result = await jitoService.waitForBundleConfirmation('test-bundle-id')
            expect(result).toBe(false)
        })
    })
})
