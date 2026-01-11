/**
 * Account Router Integration Tests
 */

import {
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  trpcRequest,
  waitForServer,
} from '../utils/test-helpers';
import { testTimeouts } from '../utils/test-fixtures';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Account Router Integration Tests', () => {
  let testUser: { email: string; password: string; token: string; refreshToken: string; userId: string };

  beforeAll(async () => {
    const serverReady = await waitForServer(testTimeouts.long);
    if (!serverReady) {
      throw new Error('Server is not running. Start with: npm run server:dev');
    }
    testUser = await createTestUser();
  }, testTimeouts.long);

  afterAll(async () => {
    if (testUser?.email) {
      await cleanupTestUser(testUser.email);
    }
  });

  describe('Validation', () => {
    it('rejects invalid phone in account.updateUserProfile', async () => {
      await expectTRPCError(
        trpcRequest('account.updateUserProfile', { phone: '123' }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('rejects non-ISO dateOfBirth in account.updateUserProfile', async () => {
      await expectTRPCError(
        trpcRequest('account.updateUserProfile', { dateOfBirth: '01/01/2000' }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('rejects underage dateOfBirth in account.updateUserProfile', async () => {
      const dob = new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString();
      await expectTRPCError(
        trpcRequest('account.updateUserProfile', { dateOfBirth: dob }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('rejects invalid preferences phone in user.updateSettings', async () => {
      await expectTRPCError(
        trpcRequest('user.updateSettings', { preferences: { phone: '123' } }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('rejects invalid preferences dateOfBirth in user.updateSettings', async () => {
      await expectTRPCError(
        trpcRequest('user.updateSettings', { preferences: { dateOfBirth: '01/01/2000' } }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });
});
