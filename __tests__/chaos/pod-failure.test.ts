import { CircuitBreaker } from '../../src/lib/services/circuitBreaker'

describe('pod-failure', () => {
  it('recovers from open to closed after successful half-open calls', async () => {
    jest.useFakeTimers()
    const start = Date.now()
    jest.setSystemTime(start)

    const breaker = new CircuitBreaker('pod-test', {
      failureThreshold: 2,
      openDurationMs: 100,
      timeoutMs: 50,
      halfOpenSuccessThreshold: 2,
    })

    await expect(breaker.exec(async () => { throw new Error('pod restart') })).rejects.toThrow('pod restart')
    await expect(breaker.exec(async () => { throw new Error('pod restart') })).rejects.toThrow('pod restart')
    expect(breaker.getSnapshot().state).toBe('OPEN')

    jest.setSystemTime(start + 101)
    await breaker.exec(async () => 'ok')
    expect(breaker.getSnapshot().state).toBe('HALF_OPEN')

    await breaker.exec(async () => 'ok')
    expect(breaker.getSnapshot().state).toBe('CLOSED')

    jest.useRealTimers()
  })
})

