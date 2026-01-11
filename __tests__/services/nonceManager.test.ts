/**
 * Unit tests for Nonce Manager
 * 
 * Tests nonce generation, validation, and replay protection
 */

describe('NonceManager', () => {
    beforeEach(() => {
        jest.resetModules()
        // Clear Redis URL to use memory fallback for tests
        process.env.REDIS_URL = ''
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('nonce generation', () => {
        it('should generate unique nonces', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const nonce1 = await nonceManager.generateNonce('user1', 'pubkey1')
            const nonce2 = await nonceManager.generateNonce('user1', 'pubkey1')

            expect(nonce1).not.toBe(nonce2)
            expect(nonce1.length).toBeGreaterThan(10)
            expect(nonce2.length).toBeGreaterThan(10)
        })

        it('should generate URL-safe nonces', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const nonce = await nonceManager.generateNonce('user1', 'pubkey1')

            // Should not contain + / or = (base64 special chars)
            expect(nonce).not.toMatch(/[+/=]/)
        })
    })

    describe('nonce validation', () => {
        it('should validate correct nonce', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const nonce = await nonceManager.generateNonce('user1', 'pubkey1')
            const isValid = await nonceManager.validateNonce(nonce, 'user1', 'pubkey1')

            expect(isValid).toBe(true)
        })

        it('should reject incorrect user', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const nonce = await nonceManager.generateNonce('user1', 'pubkey1')
            const isValid = await nonceManager.validateNonce(nonce, 'user2', 'pubkey1')

            expect(isValid).toBe(false)
        })

        it('should reject incorrect public key', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const nonce = await nonceManager.generateNonce('user1', 'pubkey1')
            const isValid = await nonceManager.validateNonce(nonce, 'user1', 'pubkey2')

            expect(isValid).toBe(false)
        })

        it('should reject unknown nonce', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const isValid = await nonceManager.validateNonce('unknown-nonce', 'user1', 'pubkey1')

            expect(isValid).toBe(false)
        })
    })

    describe('nonce consumption', () => {
        it('should consume nonce on validation', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const nonce = await nonceManager.generateNonce('user1', 'pubkey1')

            // First validation should succeed and consume
            const firstValidation = await nonceManager.validateAndConsumeNonce(nonce, 'user1', 'pubkey1')
            expect(firstValidation).toBe(true)

            // Second validation should fail (nonce consumed)
            const secondValidation = await nonceManager.validateAndConsumeNonce(nonce, 'user1', 'pubkey1')
            expect(secondValidation).toBe(false)
        })

        it('should prevent replay attacks', async () => {
            const { nonceManager } = await import('../../src/lib/services/nonceManager')

            const nonce = await nonceManager.generateNonce('user1', 'pubkey1')

            // Simulate first use
            await nonceManager.validateAndConsumeNonce(nonce, 'user1', 'pubkey1')

            // Attempt replay
            const replayAttempt = await nonceManager.validateAndConsumeNonce(nonce, 'user1', 'pubkey1')
            expect(replayAttempt).toBe(false)
        })
    })

    describe('nonce expiration', () => {
        it('should reject expired nonces', async () => {
            const { NonceManager } = await import('../../src/lib/services/nonceManager')

            // Create manager with very short TTL for testing
            const testManager = new (NonceManager as any)()
            testManager.ttlMs = 1 // 1ms TTL

            const nonce = await testManager.generateNonce('user1', 'pubkey1')

            // Wait for expiration
            await new Promise(r => setTimeout(r, 10))

            const isValid = await testManager.validateNonce(nonce, 'user1', 'pubkey1')
            expect(isValid).toBe(false)
        })
    })
})
