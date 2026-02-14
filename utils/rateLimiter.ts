export class RateLimiter {
  private calls: Map<string, number[]> = new Map();

  canCall(key: string, maxCalls: number, windowMs: number): boolean {
    const now = Date.now();
    const calls = this.calls.get(key) || [];
    const recentCalls = calls.filter(t => now - t < windowMs);
    
    if (recentCalls.length >= maxCalls) {
      return false;
    }
    
    recentCalls.push(now);
    this.calls.set(key, recentCalls);
    return true;
  }
}

export const rateLimiter = new RateLimiter();
