import { z } from 'zod';
import { OTPType } from '@prisma/client';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import { AuthService } from '../../lib/services/auth';
import { createEmailService } from '../../lib/services/email';
import prisma, { checkDatabaseHealth } from '../../lib/prisma';

import { applyRateLimit } from '../../lib/middleware/rateLimit';
import {
  signupSchema,
  loginSchema,
  passwordResetRequestSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  refreshTokenSchema,
  unlockAccountSchema,
  paginationSchema,
  sessionActivityFilterSchema,
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
      try {
        // Apply rate limiting
        await applyRateLimit('signup', ctx.rateLimitContext);

        // Create user account with fingerprint
        const result = await AuthService.signup(input, ctx.fingerprint);

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
      try {
        // Apply rate limiting
        await applyRateLimit('login', ctx.rateLimitContext);

        // Authenticate user with fingerprint
        const result = await AuthService.login(input, ctx.fingerprint);

        return {
          success: true,
          message: result.message,
          user: result.user,
          token: result.token,
          refreshToken: result.refreshToken,
        };
      } catch (error) {
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
        await AuthService.logout(ctx.session.id);

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

        // Request password reset
        const result = await AuthService.requestPasswordReset(input);

        // Send password reset email with OTP (fetched from DB)
        try {
          const otpRecord = await prisma.oTP.findFirst({
            where: {
              email: input.email.toLowerCase(),
              type: OTPType.RESET_PASSWORD,
              used: false,
            },
            orderBy: { createdAt: 'desc' },
          });
          if (otpRecord?.code) {
            await emailService.sendPasswordResetEmail(input.email, otpRecord.code);
          }
        } catch (e) {
          // Intentionally do not leak errors; email sending failures are handled separately
        }

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

  /**
   * Verify OTP
   */
  verifyOtp: publicProcedure
    .input(verifyOtpSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Apply rate limiting
        await applyRateLimit('verifyOtp', ctx.rateLimitContext);

        // Verify OTP
        const result = await AuthService.verifyOTP(input);

        return {
          success: true,
          message: result.message,
          isValid: result.isValid,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify OTP',
        });
      }
    }),

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
          userId: ctx.user.id,
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
   * Get user sessions with enhanced details
   */
  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const sessions = await prisma.session.findMany({
          where: { userId: ctx.user.id },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            lastActivityAt: true,
          },
          orderBy: { lastActivityAt: 'desc' },
        });

        return {
          success: true,
          sessions: sessions.map(session => ({
            ...session,
            current: session.id === ctx.session.id,
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get sessions',
        });
      }
    }),

  /**
   * Revoke session with activity logging
   */
  revokeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Prevent users from revoking their current session via this endpoint
        if (input.sessionId === ctx.session.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot revoke current session. Use logout instead.',
          });
        }

        // Verify the session belongs to the user
        const session = await prisma.session.findFirst({
          where: {
            id: input.sessionId,
            userId: ctx.user.id,
          },
        });

        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found',
          });
        }

        await AuthService.logout(input.sessionId);

        return {
          success: true,
          message: 'Session revoked successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to revoke session',
        });
      }
    }),

  /**
   * Get session activity logs
   */
  getSessionActivity: protectedProcedure
    .input(paginationSchema.merge(sessionActivityFilterSchema))
    .query(async ({ input, ctx }) => {
      try {
        const { page = 1, limit = 20, action, suspiciousOnly } = input;
        const offset = (page - 1) * limit;

        const where: any = { userId: ctx.user.id };
        if (action) where.action = action;
        if (suspiciousOnly !== undefined) where.suspicious = suspiciousOnly;

        const [activities, total] = await Promise.all([
          prisma.sessionActivity.findMany({
            where,
            select: {
              id: true,
              sessionId: true,
              action: true,
              ipAddress: true,
              userAgent: true,
              metadata: true,
              suspicious: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
          }),
          prisma.sessionActivity.count({ where }),
        ]);

        return {
          success: true,
          activities,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get session activity',
        });
      }
    }),

  /**
   * Get login attempts (for security monitoring)
   */
  getLoginAttempts: protectedProcedure
    .input(paginationSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { page = 1, limit = 20 } = input;
        const offset = (page - 1) * limit;

        const [attempts, total] = await Promise.all([
          prisma.loginAttempt.findMany({
            where: { identifier: ctx.user.email },
            select: {
              id: true,
              identifier: true,
              ipAddress: true,
              userAgent: true,
              successful: true,
              failureReason: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
          }),
          prisma.loginAttempt.count({ where: { identifier: ctx.user.email } }),
        ]);

        return {
          success: true,
          attempts,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get login attempts',
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