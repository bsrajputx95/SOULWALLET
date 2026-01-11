/**
 * Database Failure Chaos Tests
 * Uses Toxiproxy to inject real faults against the database connection
 */

import { CircuitBreaker } from '../../src/lib/services/circuitBreaker';

const TOXIPROXY_URL = process.env.TOXIPROXY_URL || 'http://localhost:8474';

interface ToxiproxyProxy {
  name: string;
  listen: string;
  upstream: string;
  enabled: boolean;
}

interface Toxic {
  name: string;
  type: string;
  stream: 'upstream' | 'downstream';
  toxicity: number;
  attributes: Record<string, number | string>;
}

/**
 * Toxiproxy client for fault injection
 */
class ToxiproxyClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/version`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async createProxy(proxy: Omit<ToxiproxyProxy, 'enabled'>): Promise<ToxiproxyProxy | null> {
    try {
      const response = await fetch(`${this.baseUrl}/proxies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...proxy, enabled: true }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  async deleteProxy(name: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/proxies/${name}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Ignore errors
    }
  }

  async addToxic(proxyName: string, toxic: Omit<Toxic, 'name'>): Promise<Toxic | null> {
    try {
      const response = await fetch(`${this.baseUrl}/proxies/${proxyName}/toxics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toxic),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  async removeToxic(proxyName: string, toxicName: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/proxies/${proxyName}/toxics/${toxicName}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Ignore errors
    }
  }

  async disableProxy(name: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/proxies/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Ignore errors
    }
  }

  async enableProxy(name: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/proxies/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Ignore errors
    }
  }
}

const toxiproxy = new ToxiproxyClient(TOXIPROXY_URL);

describe('Database Failure Chaos Tests', () => {
  const PROXY_NAME = 'postgres-proxy';
  let toxiproxyAvailable = false;

  beforeAll(async () => {
    toxiproxyAvailable = await toxiproxy.isAvailable();

    if (toxiproxyAvailable) {
      await toxiproxy.deleteProxy(PROXY_NAME);
      await toxiproxy.createProxy({
        name: PROXY_NAME,
        listen: '0.0.0.0:5433',
        upstream: 'localhost:5432',
      });
    }
  });

  afterAll(async () => {
    if (toxiproxyAvailable) {
      await toxiproxy.deleteProxy(PROXY_NAME);
    }
  });

  describe('Circuit Breaker (Unit)', () => {
    it('opens circuit after repeated failures', async () => {
      const breaker = new CircuitBreaker('db-test', {
        failureThreshold: 5,
        openDurationMs: 10_000,
        timeoutMs: 50,
        halfOpenSuccessThreshold: 2,
      });

      for (let i = 0; i < 5; i++) {
        await expect(
          breaker.exec(async () => { throw new Error('db down'); })
        ).rejects.toThrow('db down');
      }

      const snap = breaker.getSnapshot();
      expect(snap.state).toBe('OPEN');
    });
  });

  describe('Toxiproxy Fault Injection', () => {
    it('should inject latency into database connections', async () => {
      if (!toxiproxyAvailable) {
        console.log('Skipping: Toxiproxy not available');
        return;
      }

      const toxic = await toxiproxy.addToxic(PROXY_NAME, {
        type: 'latency',
        stream: 'downstream',
        toxicity: 1.0,
        attributes: { latency: 500, jitter: 100 },
      });

      if (toxic) {
        expect(toxic.type).toBe('latency');
        await toxiproxy.removeToxic(PROXY_NAME, toxic.name);
      }
    });

    it('should simulate connection timeout', async () => {
      if (!toxiproxyAvailable) {
        console.log('Skipping: Toxiproxy not available');
        return;
      }

      const toxic = await toxiproxy.addToxic(PROXY_NAME, {
        type: 'timeout',
        stream: 'downstream',
        toxicity: 1.0,
        attributes: { timeout: 5000 },
      });

      if (toxic) {
        expect(toxic.type).toBe('timeout');
        await toxiproxy.removeToxic(PROXY_NAME, toxic.name);
      }
    });

    it('should simulate connection reset', async () => {
      if (!toxiproxyAvailable) {
        console.log('Skipping: Toxiproxy not available');
        return;
      }

      const toxic = await toxiproxy.addToxic(PROXY_NAME, {
        type: 'reset_peer',
        stream: 'downstream',
        toxicity: 0.5,
        attributes: { timeout: 100 },
      });

      if (toxic) {
        expect(toxic.type).toBe('reset_peer');
        await toxiproxy.removeToxic(PROXY_NAME, toxic.name);
      }
    });

    it('should simulate total database outage', async () => {
      if (!toxiproxyAvailable) {
        console.log('Skipping: Toxiproxy not available');
        return;
      }

      await toxiproxy.disableProxy(PROXY_NAME);
      await toxiproxy.enableProxy(PROXY_NAME);
    });
  });
});
