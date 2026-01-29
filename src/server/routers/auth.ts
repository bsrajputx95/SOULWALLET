// z import removed - not used directly in this file
// OTPType import removed - no longer using OTP
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import { AuthService } from '../../lib/services/auth';
import { createEmailService } from '../../lib/services/email';
import prisma, { checkDatabaseHealth } from '../../lib/prisma';
import { recordAuthAttempt } from '../../lib/metrics';
// activeSessionsGauge import removed - not used

import { applyRateLimit } from '../../lib/middleware/rateLimit';
import {
  signupSchema,
  loginSchema,
  passwordResetRequestSchema,
  resetPasswordSchema,
  // verifyOtpSchema removed - no longer using OTP
  changePasswordSchema,
  refreshTokenSchema,
  unlockAccountSchema,
} from '../../lib/validations/auth';

// Initialize email service
const emailService = createEmailService();

export const authRouter = router({
  /**
   * User signup with fingerprinting
   */
  signup: publicProcedure
    .input(signupSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        // Apply rate limiting
        await applyRateLimit('signup', ctx.rateLimitContext);

        // Create user account with fingerprint
        const result = await AuthService.signup(input, ctx.fingerprint);

        // Record successful signup metric
        recordAuthAttempt('register', true, Date.now() - startTime);

        // Send welcome email (non-blocking)
        emailService.sendWelcomeEmail(input.email).catch((error) => {
          logger.error('Failed to send welcome email:', error);
        });

        return {
          success: true,
          message: result.message,
          user: result.user,
          token: result.token,
          refreshToken: result.refreshToken,
        };
      } catch (error) {
        // Record failed signup metric
        const reason = error instanceof TRPCError ? error.code : 'internal_error';
        recordAuthAttempt('register', false, Date.now() - startTime, reason);

        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Signup error details:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create account',
        });
      }
    }),

  /**
   * User login with fingerprinting and security features
   */
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        // Apply rate limiting
        await applyRateLimit('login', ctx.rateLimitContext);

        // Authenticate user with fingerprint
        const result = await AuthService.login(input, ctx.fingerprint);

        // Record successful login metric
        recordAuthAttempt('login', true, Date.now() - startTime);

        return {
          success: true,
          message: result.message,
          user: result.user,
          token: result.token,
          refreshToken: result.refreshToken,
        };
      } catch (error) {
        // Record failed login metric
        const reason = error instanceof TRPCError ? error.code : 'internal_error';
        recordAuthAttempt('login', false, Date.now() - startTime, reason);

        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Login error details:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to login',
        });
      }
    }),

  /**
   * User logout with activity logging
   */
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        await AuthService.logout(ctx.session!.id);

        return {
          success: true,
          message: 'Logged out successfully',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to logout',
        });
      }
    }),

  /**
   * Get current user
   */
  getCurrentUser: protectedProcedure
    .query(async ({ ctx }) => {
      return {
        success: true,
        user: ctx.user,
      };
    }),

  /**
   * Request password reset with email delivery
   */
  requestPasswordReset: publicProcedure
    .input(passwordResetRequestSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Apply rate limiting
        await applyRateLimit('passwordReset', ctx.rateLimitContext);

        // Request password reset (generates token stored in Redis)
        const result = await AuthService.requestPasswordReset(input);

        // Token-based password reset - email sending would be handled here
        // The AuthService.requestPasswordReset now returns _devToken in development
        // In production, email would be sent with a reset link containing the token

        return {
          success: true,
          message: result.message,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process password reset request',
        });
      }
    }),

  // verifyOtp endpoint removed - using token-based password reset



  /**
   * Reset password with session invalidation
   */
  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Apply rate limiting
        await applyRateLimit('resetPassword', ctx.rateLimitContext);

        // Reset password
        const result = await AuthService.resetPassword(input);

        return {
          success: true,
          message: result.message,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset password',
        });
      }
    }),

  /**
   * Change password (for authenticated users) with session management
   */
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Apply rate limiting for change password
        await applyRateLimit('changePassword', ctx.rateLimitContext);

        await AuthService.changePasswordAuthenticated({
          userId: ctx.user!.id,
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          ...(ctx.fingerprint ? { fingerprint: ctx.fingerprint } : {}),
        });

        return {
          success: true,
          message: 'Password changed successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Change password error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to change password',
        });
      }
    }),

  /**
   * Refresh tokens with rotation
   */
  refreshToken: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Apply rate limiting
        await applyRateLimit('login', ctx.rateLimitContext);

        // Rotate tokens
        const result = await AuthService.rotateTokens(input.refreshToken);

        return {
          success: true,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          message: 'Tokens refreshed successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Failed to refresh token',
        });
      }
    }),

  /**
   * Unlock account (admin or self-service after lockout period)
   */
  unlockAccount: publicProcedure
    .input(unlockAccountSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Apply rate limiting
        await applyRateLimit('unlockAccount', ctx.rateLimitContext);

        const user = await prisma.user.findUnique({
          where: { email: input.email },
          select: { id: true, lockedUntil: true, failedLoginAttempts: true },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        if (!user.lockedUntil || user.lockedUntil <= new Date()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Account is not locked',
          });
        }

        // Reset lockout fields
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: null,
            failedLoginAttempts: 0,
          },
        });

        // Send account unlocked notification
        await emailService.sendAccountUnlockedNotification(input.email);

        return {
          success: true,
          message: 'Account unlocked successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to unlock account',
        });
      }
    }),

  /**
   * Health check for auth service with security metrics
   */
  healthCheck: publicProcedure
    .query(async () => {
      try {
        // Perform basic health checks
        const emailConfigValid = await emailService.verifyConfiguration();
        const dbHealth = await checkDatabaseHealth();

        // Get security metrics
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [
          activeSessions,
          recentLoginAttempts,
          suspiciousActivities,
          lockedAccounts,
        ] = await Promise.all([
          prisma.session.count(),
          prisma.loginAttempt.count({
            where: { createdAt: { gte: oneDayAgo } },
          }),
          prisma.sessionActivity.count({
            where: {
              suspicious: true,
              createdAt: { gte: oneDayAgo },
            },
          }),
          prisma.user.count({
            where: {
              lockedUntil: { gt: now },
            },
          }),
        ]);

        return {
          success: true,
          status: dbHealth.healthy ? 'healthy' : 'unhealthy',
          services: {
            database: dbHealth,
            email: emailConfigValid,
            rateLimit: true,
          },
          security: {
            activeSessions,
            recentLoginAttempts,
            suspiciousActivities,
            lockedAccounts,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      }
    }),
});
