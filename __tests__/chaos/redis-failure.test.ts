/**
 * Redis Failure Chaos Tests
 * Uses Toxiproxy to inject real faults against Redis connections
 */

import { CircuitBreaker } from '../../src/lib/services/circuitBreaker';

const TOXIPROXY_URL = process.env.TOXIPROXY_URL || 'http://localhost:8474';

/**
 * Toxiproxy client for fault injection
 */
class ToxiproxyClient {
  constructor(private baseUrl: string) { }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async createProxy(name: string, listen: string, upstream: string) {
    const response = await fetch(`${this.baseUrl}/proxies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, listen, upstream, enabled: true }),
    });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Failed to create proxy: ${response.statusText}`);
    }
    return response.json();
  }

  async deleteProxy(name: string) {
    await fetch(`${this.baseUrl}/proxies/${name}`, { method: 'DELETE' });
  }

  async addToxic(proxyName: string, type: string, stream: string, attributes: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}/proxies/${proxyName}/toxics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, stream, toxicity: 1.0, attributes }),
    });
    if (!response.ok) throw new Error(`Failed to add toxic: ${response.statusText}`);
    return response.json();
  }

  async removeToxic(proxyName: string, toxicName: string) {
    await fetch(`${this.baseUrl}/proxies/${proxyName}/toxics/${toxicName}`, {
      method: 'DELETE',
    });
  }
}

const toxiproxy = new ToxiproxyClient(TOXIPROXY_URL);

describe('Redis Failure Chaos Tests', () => {
  const PROXY_NAME = 'redis-proxy';
  let toxiproxyAvailable = false;

  beforeAll(async () => {
    toxiproxyAvailable = await toxiproxy.isAvailable();

    if (toxiproxyAvailable) {
      try {
        await toxiproxy.deleteProxy(PROXY_NAME);
      } catch {
        // Proxy may not exist
      }

      await toxiproxy.createProxy(PROXY_NAME, '0.0.0.0:6380', 'localhost:6379');
    }
  });

  afterAll(async () => {
    if (toxiproxyAvailable) {
      try {
        await toxiproxy.deleteProxy(PROXY_NAME);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Circuit Breaker (Unit)', () => {
    it('opens circuit after repeated Redis failures', async () => {
      const breaker = new CircuitBreaker('redis-test', {
        failureThreshold: 3,
        openDurationMs: 5_000,
        timeoutMs: 100,
        halfOpenSuccessThreshold: 2,
      });

      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.exec(async () => { throw new Error('redis connection failed'); })
        ).rejects.toThrow('redis connection failed');
      }

      const snap = breaker.getSnapshot();
      expect(snap.state).toBe('OPEN');
    });

    it('transitions to half-open after duration', async () => {
      const breaker = new CircuitBreaker('redis-halfopen', {
        failureThreshold: 1,
        openDurationMs: 100, // Very short for testing
        timeoutMs: 50,
        halfOpenSuccessThreshold: 1,
      });

      // Force circuit open
      await expect(
        breaker.exec(async () => { throw new Error('fail'); })
      ).rejects.toThrow();

      expect(breaker.getSnapshot().state).toBe('OPEN');

      // Wait for open duration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should be allowed (half-open)
      await expect(
        breaker.exec(async () => 'success')
      ).resolves.toBe('success');

      expect(breaker.getSnapshot().state).toBe('CLOSED');
    });
  });

  describe('Toxiproxy Fault Injection', () => {
    it('should inject latency into Redis connections', async () => {
      if (!toxiproxyAvailable) {
        console.log('Skipping: Toxiproxy not available');
        return;
      }

      const toxic = await toxiproxy.addToxic(PROXY_NAME, 'latency', 'downstream', {
        latency: 200,
        jitter: 50,
      });

      expect(toxic.type).toBe('latency');
      await toxiproxy.removeToxic(PROXY_NAME, toxic.name);
    });

    it('should simulate slow closing connections', async () => {
      if (!toxiproxyAvailable) {
        console.log('Skipping: Toxiproxy not available');
        return;
      }

      const toxic = await toxiproxy.addToxic(PROXY_NAME, 'slow_close', 'downstream', {
        delay: 1000,
      });

      expect(toxic.type).toBe('slow_close');
      await toxiproxy.removeToxic(PROXY_NAME, toxic.name);
    });

    it('should simulate bandwidth throttling', async () => {
      if (!toxiproxyAvailable) {
        console.log('Skipping: Toxiproxy not available');
        return;
      }

      const toxic = await toxiproxy.addToxic(PROXY_NAME, 'bandwidth', 'downstream', {
        rate: 10, // 10 KB/s
      });

      expect(toxic.type).toBe('bandwidth');
      await toxiproxy.removeToxic(PROXY_NAME, toxic.name);
    });
  });
});
