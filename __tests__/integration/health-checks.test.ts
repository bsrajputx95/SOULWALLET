/**
 * Health Check Endpoint Integration Tests
 * 
 * Tests for all health check endpoints including:
 * - Main health endpoint
 * - Database health
 * - Redis health
 * - Solana health
 * - Readiness and liveness probes
 */

import {
  httpRequest,
  trpcQuery,
  waitForServer,
  createTestUser,
  cleanupTestUser,
} from '../utils/test-helpers';
import { testTimeouts } from '../utils/test-fixtures';

describe('Health Check Integration Tests', () => {
  beforeAll(async () => {
    const serverReady = await waitForServer(testTimeouts.long);
    if (!serverReady) {
      throw new Error('Server is not running. Start with: npm run server:dev');
    }
  }, testTimeouts.long);

  describe('Main Health Endpoint', () => {
    it('should return overall system health', async () => {
      const { status, data } = await httpRequest('/health');

      expect(status).toBe(200);
      expect(data.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
      expect(data.checks).toBeDefined();
    });

    it('should include all service checks', async () => {
      const { data } = await httpRequest('/health');

      expect(data.checks.database).toBeDefined();
      expect(data.checks.redis).toBeDefined();
      expect(data.checks.solana).toBeDefined();
      expect(data.checks.rateLimiter).toBeDefined();
    });

    it('should include request ID', async () => {
      const { data } = await httpRequest('/health');

      expect(data.requestId).toBeDefined();
    });
  });

  describe('Database Health Endpoint', () => {
    it('should return database health status', async () => {
      const { status, data } = await httpRequest('/health/db');

      expect([200, 503]).toContain(status);
      expect(data.database).toBeDefined();
      expect(data.database.healthy).toBeDefined();
      expect(data.requestId).toBeDefined();
    });

    it('should include latency when healthy', async () => {
      const { status, data } = await httpRequest('/health/db');

      if (status === 200 && data.database.healthy) {
        expect(data.database.latency).toBeDefined();
        expect(typeof data.database.latency).toBe('number');
      }
    });
  });

  describe('Redis Health Endpoint', () => {
    it('should return redis health status', async () => {
      const { status, data } = await httpRequest('/health/redis');

      expect([200, 503]).toContain(status);
      expect(data.redis).toBeDefined();
      expect(data.requestId).toBeDefined();
    });

    it('should handle redis not configured gracefully', async () => {
      const { status, data } = await httpRequest('/health/redis');

      // If Redis is not configured, should still return 200
      if (data.redis.required === false) {
        expect(status).toBe(200);
        expect(data.redis.message).toContain('not configured');
      }
    });
  });

  describe('Solana Health Endpoint', () => {
    it('should return solana RPC health status', async () => {
      const { status, data } = await httpRequest('/health/solana');

      expect([200, 503]).toContain(status);
      expect(data.solana).toBeDefined();
      expect(data.solana.healthy).toBeDefined();
      expect(data.requestId).toBeDefined();
    });

    it('should include latency when healthy', async () => {
      const { status, data } = await httpRequest('/health/solana');

      if (status === 200 && data.solana.healthy) {
        expect(data.solana.latency).toBeDefined();
        expect(typeof data.solana.latency).toBe('number');
      }
    });
  });

  describe('Readiness Probe', () => {
    it('should return readiness status', async () => {
      const { status, data } = await httpRequest('/health/ready');

      expect([200, 503]).toContain(status);
      expect(data.ready).toBeDefined();
      expect(typeof data.ready).toBe('boolean');
      expect(data.requestId).toBeDefined();
    });

    it('should include critical services status', async () => {
      const { data } = await httpRequest('/health/ready');

      expect(data.services).toBeDefined();
      expect(data.services.database).toBeDefined();
      expect(data.services.rateLimiter).toBeDefined();
    });

    it('should return 200 when ready', async () => {
      const { status, data } = await httpRequest('/health/ready');

      if (data.ready) {
        expect(status).toBe(200);
      }
    });

    it('should return 503 when not ready', async () => {
      const { status, data } = await httpRequest('/health/ready');

      if (!data.ready) {
        expect(status).toBe(503);
      }
    });
  });

  describe('Liveness Probe', () => {
    it('should return liveness status', async () => {
      const { status, data } = await httpRequest('/health/live');

      expect(status).toBe(200);
      expect(data.alive).toBe(true);
      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe('number');
      expect(data.requestId).toBeDefined();
    });

    it('should always return alive when server is running', async () => {
      const { data } = await httpRequest('/health/live');

      expect(data.alive).toBe(true);
    });

    it('should report positive uptime', async () => {
      const { data } = await httpRequest('/health/live');

      expect(data.uptime).toBeGreaterThan(0);
    });
  });

  describe('Auth Health Check (tRPC)', () => {
    it('should return auth service health', async () => {
      const result = await trpcQuery('auth.healthCheck', {});

      expect(result.success).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should include security metrics', async () => {
      const result = await trpcQuery('auth.healthCheck', {});

      if (result.security) {
        expect(result.security.activeSessions).toBeDefined();
        expect(result.security.recentLoginAttempts).toBeDefined();
      }
    });
  });

  describe('Health Endpoint Response Times', () => {
    it('should respond within acceptable time for /health', async () => {
      const start = Date.now();
      await httpRequest('/health');
      const duration = Date.now() - start;

      // Health check should respond within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should respond quickly for /health/live', async () => {
      const start = Date.now();
      await httpRequest('/health/live');
      const duration = Date.now() - start;

      // Liveness check should be very fast (no external calls)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Health Endpoint Caching', () => {
    it('should return consistent results on rapid requests', async () => {
      const results = await Promise.all([
        httpRequest('/health'),
        httpRequest('/health'),
        httpRequest('/health'),
      ]);

      // All should have same status
      const statuses = results.map(r => r.data.status);
      expect(new Set(statuses).size).toBe(1);
    });
  });
});
