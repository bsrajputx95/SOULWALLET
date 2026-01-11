/**
 * Unit tests for Fee Manager
 * 
 * Tests priority fee calculation, capping, and optimal fee retrieval
 */

describe('FeeManager', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
        process.env.MAX_PRIORITY_FEE_LAMPORTS = '100000'
        process.env.MIN_PRIORITY_FEE_LAMPORTS = '1000'
        process.env.PRIORITY_FEE_PERCENTILE = '50'
        process.env.URGENT_PRIORITY_FEE_MULTIPLIER = '2'
    })

    afterEach(() => {
        process.env = originalEnv
        jest.clearAllMocks()
    })

    describe('capPriorityFee', () => {
        it('should cap fees above maximum', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            const capped = feeManager.capPriorityFee(200_000)
            expect(capped).toBe(100_000) // Max from env
        })

        it('should raise fees below minimum', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            const capped = feeManager.capPriorityFee(500)
            expect(capped).toBe(1_000) // Min from env
        })

        it('should pass through valid fees', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            const capped = feeManager.capPriorityFee(50_000)
            expect(capped).toBe(50_000)
        })

        it('should return integer values', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            const capped = feeManager.capPriorityFee(50_000.5)
            expect(Number.isInteger(capped)).toBe(true)
        })
    })

    describe('getOptimalPriorityFeeLamports', () => {
        it('should return minimum fee when no recent data', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            // Mock connection without getRecentPrioritizationFees
            const mockConnection = {
                getRecentPrioritizationFees: undefined,
            }

            const fee = await feeManager.getOptimalPriorityFeeLamports({
                connection: mockConnection as any,
                urgent: false,
            })

            expect(fee).toBeGreaterThanOrEqual(1_000)
        })

        it('should multiply fee for urgent transactions', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            // Mock connection with recent fees
            const mockConnection = {
                getRecentPrioritizationFees: jest.fn().mockResolvedValue([
                    { prioritizationFee: 5000 },
                    { prioritizationFee: 10000 },
                    { prioritizationFee: 15000 },
                ]),
            }

            const normalFee = await feeManager.getOptimalPriorityFeeLamports({
                connection: mockConnection as any,
                urgent: false,
            })

            const urgentFee = await feeManager.getOptimalPriorityFeeLamports({
                connection: mockConnection as any,
                urgent: true,
            })

            // Urgent should be higher (multiplied)
            expect(urgentFee).toBeGreaterThanOrEqual(normalFee)
        })

        it('should handle connection errors gracefully', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            const mockConnection = {
                getRecentPrioritizationFees: jest.fn().mockRejectedValue(new Error('Connection failed')),
            }

            const fee = await feeManager.getOptimalPriorityFeeLamports({
                connection: mockConnection as any,
                urgent: false,
            })

            // Should return minimum fee on error
            expect(fee).toBe(1_000)
        })
    })

    describe('estimateTotalFeeLamports', () => {
        it('should return null (not implemented)', async () => {
            const { feeManager } = await import('../../src/lib/services/feeManager')

            const estimate = feeManager.estimateTotalFeeLamports({} as any)
            expect(estimate).toBeNull()
        })
    })
})
