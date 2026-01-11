/**
 * Auth Router Integration Tests
 * 
 * Comprehensive tests for authentication flows including:
 * - Signup, Login, Logout
 * - Password reset and change
 * - Token refresh
 * - Session management
 * - Security features
 */

import {
  trpcRequest,
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  sleep,
  waitForServer,
  httpRequest,
  BASE_URL,
} from '../utils/test-helpers';
import { createMockUser, invalidData, testTimeouts } from '../utils/test-fixtures';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Auth Router Integration Tests', () => {
  let testUser: { email: string; password: string; token: string; refreshToken: string; userId: string };

  beforeAll(async () => {
    const serverReady = await waitForServer(testTimeouts.long);
    if (!serverReady) {
      throw new Error('Server is not running. Start with: npm run server:dev');
    }
  }, testTimeouts.long);

  afterAll(async () => {
    if (testUser?.email) {
      await cleanupTestUser(testUser.email);
    }
  });

  describe('Signup Flow', () => {
    it('should successfully create a new user account', async () => {
      const mockData = createMockUser();
      
      const result = await trpcRequest('auth.signup', {
        email: mockData.email,
        password: mockData.password,
        confirmPassword: mockData.password,
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
      
      // Store for cleanup
      testUser = {
        email: mockData.email,
        password: mockData.password,
        token: result.token,
        refreshToken: result.refreshToken,
        userId: result.user?.id,
      };
    });

    it('should reject duplicate email registration', async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }

      await expectTRPCError(
        trpcRequest('auth.signup', {
          email: testUser.email,
          password: 'AnotherPassword123!',
          confirmPassword: 'AnotherPassword123!',
        }),
        'CONFLICT'
      );
    });

    it('should reject weak passwords', async () => {
      const mockData = createMockUser();

      await expectTRPCError(
        trpcRequest('auth.signup', {
          email: mockData.email,
          password: invalidData.weakPassword,
          confirmPassword: invalidData.weakPassword,
        }),
        'BAD_REQUEST'
      );
    });

    it('should reject invalid email format', async () => {
      await expectTRPCError(
        trpcRequest('auth.signup', {
          email: invalidData.invalidEmail,
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
        }),
        'BAD_REQUEST'
      );
    });

    it('should reject mismatched passwords', async () => {
      const mockData = createMockUser();

      await expectTRPCError(
        trpcRequest('auth.signup', {
          email: mockData.email,
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!',
        }),
        'BAD_REQUEST'
      );
    });

    it('should reject empty fields', async () => {
      await expectTRPCError(
        trpcRequest('auth.signup', {
          email: '',
          password: '',
          confirmPassword: '',
        }),
        'BAD_REQUEST'
      );
    });

    it('should sanitize SQL injection attempts in email', async () => {
      await expectTRPCError(
        trpcRequest('auth.signup', {
          email: invalidData.sqlInjection,
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
        }),
        'BAD_REQUEST'
      );
    });
  });

  describe('Login Flow', () => {
    beforeAll(async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }
    });

    it('should successfully login with valid credentials', async () => {
      const result = await trpcRequest('auth.login', {
        email: testUser.email,
        password: testUser.password,
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
      
      // Update token
      testUser.token = result.token;
      testUser.refreshToken = result.refreshToken;
    });

    it('should reject login with wrong password', async () => {
      await expectTRPCError(
        trpcRequest('auth.login', {
          email: testUser.email,
          password: 'WrongPassword123!',
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject login for non-existent user', async () => {
      await expectTRPCError(
        trpcRequest('auth.login', {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject login with empty credentials', async () => {
      await expectTRPCError(
        trpcRequest('auth.login', {
          email: '',
          password: '',
        }),
        'BAD_REQUEST'
      );
    });
  });

  describe('Logout Flow', () => {
    let logoutTestUser: typeof testUser;

    beforeAll(async () => {
      logoutTestUser = await createTestUser();
    });

    afterAll(async () => {
      if (logoutTestUser?.email) {
        await cleanupTestUser(logoutTestUser.email);
      }
    });

    it('should successfully logout authenticated user', async () => {
      const result = await trpcRequest('auth.logout', {}, logoutTestUser.token);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Logged out');
    });

    it('should reject logout without token', async () => {
      await expectTRPCError(
        trpcRequest('auth.logout', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Password Reset Flow', () => {
    let resetTestUser: typeof testUser;
    const newPassword = 'ResetPassword789!';

    beforeAll(async () => {
      resetTestUser = await createTestUser();
    });

    afterAll(async () => {
      if (resetTestUser?.email) {
        await cleanupTestUser(resetTestUser.email);
      }
    });

    it('should accept password reset request for existing user', async () => {
      const result = await trpcRequest('auth.requestPasswordReset', {
        email: resetTestUser.email,
      });

      expect(result.success).toBe(true);
    });

    it('should not reveal if email exists (security)', async () => {
      // Should return success even for non-existent email
      const result = await trpcRequest('auth.requestPasswordReset', {
        email: 'nonexistent-user@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid OTP', async () => {
      await expectTRPCError(
        trpcRequest('auth.verifyOtp', {
          email: resetTestUser.email,
          otp: '000000',
        }),
        'BAD_REQUEST'
      );
    });

    it('should reject reset password with invalid OTP', async () => {
      await expectTRPCError(
        trpcRequest('auth.resetPassword', {
          email: resetTestUser.email,
          otp: '000000',
          newPassword: newPassword,
          confirmPassword: newPassword,
        }),
        'BAD_REQUEST'
      );
    });

    // Note: Full happy-path reset requires valid OTP from email/database
    // In test environment, this would need OTP bypass or direct DB access
  });

  describe('Change Password Flow', () => {
    let changePasswordUser: typeof testUser;
    const newPassword = 'ChangedPassword456!';

    beforeAll(async () => {
      changePasswordUser = await createTestUser();
    });

    afterAll(async () => {
      if (changePasswordUser?.email) {
        await cleanupTestUser(changePasswordUser.email);
      }
    });

    it('should reject change password with wrong current password', async () => {
      await expectTRPCError(
        trpcRequest('auth.changePassword', {
          currentPassword: 'WrongCurrentPassword123!',
          newPassword: newPassword,
          confirmPassword: newPassword,
        }, changePasswordUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject change password without authentication', async () => {
      await expectTRPCError(
        trpcRequest('auth.changePassword', {
          currentPassword: changePasswordUser.password,
          newPassword: newPassword,
          confirmPassword: newPassword,
        }),
        'UNAUTHORIZED'
      );
    });

    it('should successfully change password with valid credentials', async () => {
      const result = await trpcRequest('auth.changePassword', {
        currentPassword: changePasswordUser.password,
        newPassword: newPassword,
        confirmPassword: newPassword,
      }, changePasswordUser.token);

      expect(result.success).toBe(true);
    });

    it('should login with new password after change', async () => {
      const result = await trpcRequest('auth.login', {
        email: changePasswordUser.email,
        password: newPassword,
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      
      // Update token for subsequent tests
      changePasswordUser.token = result.token;
      changePasswordUser.password = newPassword;
    });

    it('should reject login with old password after change', async () => {
      await expectTRPCError(
        trpcRequest('auth.login', {
          email: changePasswordUser.email,
          password: 'TestPassword123!', // Original password
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Token Refresh Flow', () => {
    it('should successfully refresh tokens', async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }

      const result = await trpcRequest('auth.refreshToken', {
        refreshToken: testUser.refreshToken,
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      await expectTRPCError(
        trpcRequest('auth.refreshToken', {
          refreshToken: 'invalid-refresh-token',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Session Management', () => {
    it('should get user sessions', async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }

      const result = await trpcQuery('auth.getSessions', {}, testUser.token);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(result.sessions.length).toBeGreaterThan(0);
    });

    it('should reject getting sessions without auth', async () => {
      await expectTRPCError(
        trpcQuery('auth.getSessions', {}),
        'UNAUTHORIZED'
      );
    });

    it('should prevent revoking current session', async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }

      const sessions = await trpcQuery('auth.getSessions', {}, testUser.token);
      const currentSession = sessions.sessions.find((s: any) => s.current);

      if (currentSession) {
        await expectTRPCError(
          trpcRequest('auth.revokeSession', {
            sessionId: currentSession.id,
          }, testUser.token),
          'BAD_REQUEST'
        );
      }
    });
  });

  describe('Security Features', () => {
    it('should get login attempts for authenticated user', async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }

      const result = await trpcQuery('auth.getLoginAttempts', {
        page: 1,
        limit: 10,
      }, testUser.token);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.attempts)).toBe(true);
      expect(result.pagination).toBeDefined();
    });

    it('should get session activity', async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }

      const result = await trpcQuery('auth.getSessionActivity', {
        page: 1,
        limit: 10,
      }, testUser.token);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.activities)).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should return auth service health status', async () => {
      const result = await trpcQuery('auth.healthCheck', {});

      expect(result.success).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.services).toBeDefined();
    });
  });

  describe('Rate Limiting and Account Lockout', () => {
    let lockoutTestUser: typeof testUser;

    beforeAll(async () => {
      lockoutTestUser = await createTestUser();
    });

    afterAll(async () => {
      if (lockoutTestUser?.email) {
        await cleanupTestUser(lockoutTestUser.email);
      }
    });

    it('should track failed login attempts', async () => {
      // Make a few failed login attempts
      for (let i = 0; i < 3; i++) {
        try {
          await trpcRequest('auth.login', {
            email: lockoutTestUser.email,
            password: 'WrongPassword123!',
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Check login attempts are recorded
      const attempts = await trpcQuery('auth.getLoginAttempts', {
        page: 1,
        limit: 10,
      }, lockoutTestUser.token);

      expect(attempts.success).toBe(true);
      expect(attempts.attempts.length).toBeGreaterThan(0);
      
      // Verify some attempts are marked as unsuccessful
      const failedAttempts = attempts.attempts.filter((a: any) => !a.successful);
      expect(failedAttempts.length).toBeGreaterThan(0);
    });

    it('should still allow login with correct password after failed attempts', async () => {
      const result = await trpcRequest('auth.login', {
        email: lockoutTestUser.email,
        password: lockoutTestUser.password,
      });

      expect(result.success).toBe(true);
      lockoutTestUser.token = result.token;
    });

    it('should reject unlock for non-locked account', async () => {
      await expectTRPCError(
        trpcRequest('auth.unlockAccount', {
          email: lockoutTestUser.email,
        }),
        'BAD_REQUEST'
      );
    });

    // Note: Full lockout testing requires triggering 5+ failed attempts
    // which may hit rate limits. In production tests, use time mocking.
  });

  describe('Get Current User', () => {
    it('should return current user for authenticated request', async () => {
      if (!testUser) {
        testUser = await createTestUser();
      }

      const result = await trpcQuery('auth.getCurrentUser', {}, testUser.token);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('auth.getCurrentUser', {}),
        'UNAUTHORIZED'
      );
    });
  });
});
