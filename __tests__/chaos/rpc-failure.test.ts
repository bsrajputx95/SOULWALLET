/**
 * RPC Failure Chaos Tests
 * Tests circuit breaker behavior with RPC timeouts and failures
 * Note: RPC faults are simulated via circuit breaker since Solana RPC is external
 */

import { CircuitBreaker } from '../../src/lib/services/circuitBreaker';

describe('RPC Failure Chaos Tests', () => {
  describe('Timeout Handling', () => {
    it('counts timeouts as failures and opens circuit', async () => {
      const breaker = new CircuitBreaker('rpc-test', {
        failureThreshold: 3,
        openDurationMs: 10_000,
        timeoutMs: 5,
        halfOpenSuccessThreshold: 1,
      });

      const never = async () => new Promise<void>((_resolve) => { /* never resolves */ });

      for (let i = 0; i < 3; i++) {
        await expect(breaker.exec(never)).rejects.toThrow('rpc-test timeout');
      }

      expect(breaker.getSnapshot().state).toBe('OPEN');
    });

    it('rejects immediately when circuit is open', async () => {
      const breaker = new CircuitBreaker('rpc-open', {
        failureThreshold: 1,
        openDurationMs: 60_000,
        timeoutMs: 10,
        halfOpenSuccessThreshold: 1,
      });

      // Force circuit open
      await expect(
        breaker.exec(async () => { throw new Error('rpc error'); })
      ).rejects.toThrow('rpc error');

      expect(breaker.getSnapshot().state).toBe('OPEN');

      // Should reject with circuit open error (format: "${name} circuit open")
      await expect(
        breaker.exec(async () => 'should not run')
      ).rejects.toThrow('circuit open');
    });
  });

  describe('RPC Failover Behavior', () => {
    it('should track failure count accurately', async () => {
      const breaker = new CircuitBreaker('rpc-failover', {
        failureThreshold: 5,
        openDurationMs: 10_000,
        timeoutMs: 100,
        halfOpenSuccessThreshold: 2,
      });

      // 3 failures - should still be closed
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.exec(async () => { throw new Error(`failure ${i}`); })
        ).rejects.toThrow();
      }

      let snap = breaker.getSnapshot();
      expect(snap.state).toBe('CLOSED');

      // 2 more failures - should open
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.exec(async () => { throw new Error(`failure ${i + 3}`); })
        ).rejects.toThrow();
      }

      snap = breaker.getSnapshot();
      expect(snap.state).toBe('OPEN');
    });
  });
});
