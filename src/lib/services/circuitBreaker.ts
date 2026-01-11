export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export type CircuitBreakerOptions = {
  timeoutMs: number
  failureThreshold: number
  halfOpenSuccessThreshold: number
  openDurationMs: number
}

export type CircuitBreakerSnapshot = {
  name: string
  state: CircuitBreakerState
  timeoutMs: number
  failureThreshold: number
  halfOpenSuccessThreshold: number
  openDurationMs: number
  consecutiveFailures: number
  halfOpenSuccesses: number
  openUntil: number | null
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
}

const breakerRegistry = new Map<string, CircuitBreaker>()

const defaultOptions: CircuitBreakerOptions = {
  timeoutMs: 8000,
  failureThreshold: 5,
  halfOpenSuccessThreshold: 2,
  openDurationMs: 30_000,
}

export class CircuitBreaker {
  private readonly name: string
  private readonly options: CircuitBreakerOptions

  private state: CircuitBreakerState = 'CLOSED'
  private openUntil: number | null = null
  private consecutiveFailures = 0
  private halfOpenSuccesses = 0

  private totalRequests = 0
  private totalFailures = 0
  private totalSuccesses = 0
  private lastFailureAt: number | null = null
  private lastSuccessAt: number | null = null

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name
    this.options = { ...defaultOptions, ...(options ?? {}) }
  }

  getSnapshot(): CircuitBreakerSnapshot {
    return {
      name: this.name,
      state: this.state,
      timeoutMs: this.options.timeoutMs,
      failureThreshold: this.options.failureThreshold,
      halfOpenSuccessThreshold: this.options.halfOpenSuccessThreshold,
      openDurationMs: this.options.openDurationMs,
      consecutiveFailures: this.consecutiveFailures,
      halfOpenSuccesses: this.halfOpenSuccesses,
      openUntil: this.openUntil,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
    }
  }

  private transitionToOpen(now: number) {
    this.state = 'OPEN'
    this.openUntil = now + this.options.openDurationMs
    this.consecutiveFailures = 0
    this.halfOpenSuccesses = 0
  }

  private transitionToHalfOpen() {
    this.state = 'HALF_OPEN'
    this.openUntil = null
    this.consecutiveFailures = 0
    this.halfOpenSuccesses = 0
  }

  private transitionToClosed() {
    this.state = 'CLOSED'
    this.openUntil = null
    this.consecutiveFailures = 0
    this.halfOpenSuccesses = 0
  }

  private async withTimeout<T>(action: () => Promise<T>): Promise<T> {
    const timeoutMs = this.options.timeoutMs
    let timeoutId: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${this.name} timeout`)), timeoutMs)
    })

    try {
      return await Promise.race([action(), timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  async exec<T>(action: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const now = Date.now()
    this.totalRequests++

    if (this.state === 'OPEN') {
      if (this.openUntil !== null && now >= this.openUntil) {
        this.transitionToHalfOpen()
      } else {
        if (fallback) return await Promise.resolve(fallback())
        throw new Error(`${this.name} circuit open`)
      }
    }

    try {
      const result = await this.withTimeout(action)
      this.totalSuccesses++
      this.lastSuccessAt = Date.now()

      if (this.state === 'HALF_OPEN') {
        this.halfOpenSuccesses++
        if (this.halfOpenSuccesses >= this.options.halfOpenSuccessThreshold) {
          this.transitionToClosed()
        }
      } else {
        this.consecutiveFailures = 0
      }

      return result
    } catch (error) {
      this.totalFailures++
      this.lastFailureAt = Date.now()

      if (this.state === 'HALF_OPEN') {
        this.transitionToOpen(Date.now())
      } else {
        this.consecutiveFailures++
        if (this.consecutiveFailures >= this.options.failureThreshold) {
          this.transitionToOpen(Date.now())
        }
      }

      if (fallback) return await Promise.resolve(fallback())
      throw error
    }
  }
}

export function getCircuitBreaker(name: string): CircuitBreaker {
  const existing = breakerRegistry.get(name)
  if (existing) return existing
  const created = new CircuitBreaker(name)
  breakerRegistry.set(name, created)
  return created
}

export function getAllCircuitBreakerSnapshots(): CircuitBreakerSnapshot[] {
  return Array.from(breakerRegistry.values()).map((b) => b.getSnapshot())
}

