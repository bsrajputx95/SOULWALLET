/**
 * Unit tests for Security Monitor
 * 
 * Tests security event tracking, metrics calculation, and alerting
 */

describe('SecurityMonitor', () => {
    beforeEach(() => {
        jest.resetModules()
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
        jest.clearAllMocks()
    })

    describe('event recording', () => {
        it('should record simulation success events', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            securityMonitor.recordEvent('SIMULATION_SUCCESS', 'user123', { durationMs: 150 })

            const events = securityMonitor.getRecentEvents(10)
            expect(events.length).toBeGreaterThan(0)
            expect(events[events.length - 1].type).toBe('SIMULATION_SUCCESS')
        })

        it('should record simulation failure events', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            securityMonitor.recordEvent('SIMULATION_FAILED', 'user123', { error: 'Insufficient funds' })

            const events = securityMonitor.getRecentEvents(10, 'SIMULATION_FAILED')
            expect(events.length).toBeGreaterThan(0)
        })

        it('should record replay attack attempts', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            const alertHandler = jest.fn()
            securityMonitor.onAlert(alertHandler)

            securityMonitor.recordEvent('REPLAY_ATTEMPT', 'user456', { nonce: 'abc123' })

            expect(alertHandler).toHaveBeenCalled()
            const [event, message] = alertHandler.mock.calls[0]
            expect(message).toContain('Replay attack')
        })
    })

    describe('metrics', () => {
        it('should calculate simulation success rate', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            // Record 8 successes and 2 failures (80% success rate)
            for (let i = 0; i < 8; i++) {
                securityMonitor.recordEvent('SIMULATION_SUCCESS', 'user1')
            }
            for (let i = 0; i < 2; i++) {
                securityMonitor.recordEvent('SIMULATION_FAILED', 'user1')
            }

            // Need to ensure we have enough data (>20 samples for alert check)
            for (let i = 0; i < 20; i++) {
                securityMonitor.recordEvent('SIMULATION_SUCCESS', 'user1')
            }

            const metrics = securityMonitor.getMetrics()
            expect(metrics.simulationSuccessRate).toBeGreaterThan(0.7)
        })

        it('should track RPC health status', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            // Initial state should be healthy
            let metrics = securityMonitor.getMetrics()
            expect(metrics.rpcHealthy).toBe(true)

            // Record failover event
            securityMonitor.recordEvent('RPC_FAILOVER', undefined, { url: 'https://test.com' })

            metrics = securityMonitor.getMetrics()
            expect(metrics.rpcHealthy).toBe(false)

            // Record recovery
            securityMonitor.recordEvent('RPC_HEALTHY', undefined, { url: 'https://test.com' })

            metrics = securityMonitor.getMetrics()
            expect(metrics.rpcHealthy).toBe(true)
        })

        it('should count replay attempts blocked', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            securityMonitor.recordEvent('REPLAY_ATTEMPT', 'user1', {})
            securityMonitor.recordEvent('REPLAY_ATTEMPT', 'user2', {})

            const metrics = securityMonitor.getMetrics()
            expect(metrics.replayAttemptsBlocked).toBeGreaterThanOrEqual(2)
        })

        it('should track slippage violations', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            securityMonitor.recordEvent('SLIPPAGE_VIOLATION', 'user1', { slippage: 10 })

            const metrics = securityMonitor.getMetrics()
            expect(metrics.slippageViolations).toBeGreaterThanOrEqual(1)
        })
    })

    describe('alerting', () => {
        it('should trigger alert on large transactions', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            const alertHandler = jest.fn()
            securityMonitor.onAlert(alertHandler)

            securityMonitor.recordEvent('LARGE_TRANSACTION', 'user1', { amountUsd: 50000 })

            expect(alertHandler).toHaveBeenCalled()
            const [_, message] = alertHandler.mock.calls[0]
            expect(message).toContain('Large transaction')
        })

        it('should trigger alert on slippage violation', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            const alertHandler = jest.fn()
            securityMonitor.onAlert(alertHandler)

            securityMonitor.recordEvent('SLIPPAGE_VIOLATION', 'user1', { slippage: 7 })

            expect(alertHandler).toHaveBeenCalled()
        })

        it('should trigger alert on limit violation', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            const alertHandler = jest.fn()
            securityMonitor.onAlert(alertHandler)

            securityMonitor.recordEvent('LIMIT_VIOLATION', 'user1', { reason: 'Daily limit exceeded' })

            expect(alertHandler).toHaveBeenCalled()
        })
    })

    describe('user events', () => {
        it('should filter events by user', async () => {
            const { securityMonitor } = await import('../../src/lib/services/securityMonitor')

            securityMonitor.recordEvent('SIMULATION_SUCCESS', 'user1', {})
            securityMonitor.recordEvent('SIMULATION_SUCCESS', 'user2', {})
            securityMonitor.recordEvent('SIMULATION_FAILED', 'user1', {})

            const user1Events = securityMonitor.getUserEvents('user1', 10)
            expect(user1Events.every(e => e.userId === 'user1')).toBe(true)
        })
    })
})
