/**
 * Circuit Breaker Service - STUB FOR BETA
 * 
 * This is a no-op stub. The full circuit breaker implementation
 * was removed for beta to reduce complexity. All calls will succeed.
 */

export interface CircuitBreakerSnapshot {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastFailure: Date | null;
    successCount: number;
}

class CircuitBreaker {
    private name: string;

    constructor(name: string, _options?: any) {
        this.name = name;
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // No circuit breaker logic - just execute the function
        return fn();
    }

    async exec<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
        // No circuit breaker logic - just execute the function
        // If it fails, call the fallback (which may be sync or async)
        try {
            return await fn();
        } catch {
            return await fallback();
        }
    }

    getSnapshot(): CircuitBreakerSnapshot {
        return {
            state: 'closed',
            failures: 0,
            lastFailure: null,
            successCount: 0,
        };
    }

    reset(): void {
        // No-op
    }
}

const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: any): CircuitBreaker {
    if (!circuitBreakers.has(name)) {
        circuitBreakers.set(name, new CircuitBreaker(name, options));
    }
    return circuitBreakers.get(name)!;
}

export function getAllCircuitBreakerSnapshots(): Record<string, CircuitBreakerSnapshot> {
    const snapshots: Record<string, CircuitBreakerSnapshot> = {};
    circuitBreakers.forEach((cb, name) => {
        snapshots[name] = cb.getSnapshot();
    });
    return snapshots;
}

export { CircuitBreaker };
