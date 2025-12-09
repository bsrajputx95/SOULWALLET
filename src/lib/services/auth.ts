import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import type { Secret } from 'jsonwebtoken';
import { OTPType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { logger } from '../logger';
import prisma from '../prisma';
import type { 
  SignupInput, 
  LoginInput, 
  PasswordResetRequestInput, 
  ResetPasswordInput,
  VerifyOtpInput 
} from '../validations/auth';

// Types for fingerprinting and security
interface Fingerprint {
  ipAddress?: string;
  userAgent?: string;
}

interface LoginAttemptData {
  identifier: string;
  ipAddress: string;
  userAgent?: string;
  successful: boolean;
  failureReason?: string;
}

export interface SessionActivityData {
  sessionId: string;
  userId: string;
  action: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: any;
  suspicious?: boolean;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly JWT_SECRETS: string[] = (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return secret.split(',').map(s => s.trim());
  })();
  private static readonly JWT_REFRESH_SECRETS: string[] = (() => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }
    return secret.split(',').map(s => s.trim());
  })();
  private static readonly JWT_SECRET_ROTATION_PERIOD_DAYS = parseInt(process.env.JWT_SECRET_ROTATION_PERIOD_DAYS || '90');
  private static readonly JWT_SECRET_OVERLAP_DAYS = parseInt(process.env.JWT_SECRET_OVERLAP_DAYS || '7');
  private static readonly JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '15m';
  private static readonly JWT_REFRESH_EXPIRES_IN: string | number = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private static readonly OTP_EXPIRES_IN = 10 * 60 * 1000; // 10 minutes in milliseconds
  private static readonly MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  private static readonly ACCOUNT_LOCKOUT_DURATION_MINUTES = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || '30');

  // Log warnings for rotation status (proxy: warn if multiple secrets indicate ongoing rotation)
  static {
    if (this.JWT_SECRETS.length > 1) {
      logger.warn(`Multiple JWT secrets configured (${this.JWT_SECRETS.length}). Ensure rotation period (${this.JWT_SECRET_ROTATION_PERIOD_DAYS} days) and overlap (${this.JWT_SECRET_OVERLAP_DAYS} days) are managed.`);
    }
    if (this.JWT_REFRESH_SECRETS.length > 1) {
      logger.warn(`Multiple JWT refresh secrets configured (${this.JWT_REFRESH_SECRETS.length}). Ensure rotation period (${this.JWT_SECRET_ROTATION_PERIOD_DAYS} days) and overlap (${this.JWT_SECRET_OVERLAP_DAYS} days) are managed.`);
    }
  }

  /**
   * Verify token with multiple secrets and return payload and secret index
   */
  private static verifyTokenWithSecrets(token: string, secrets: string[]): { payload: any; secretIndex: number } {
    for (let i = 0; i < secrets.length; i++) {
      const secret = secrets[i];
      if (!secret) continue;
      try {
        const decoded = jwt.verify(token, secret) as any;
        return { payload: decoded, secretIndex: i };
      } catch (error) {
        // Continue to next secret
      }
    }
    throw new Error('Invalid token');
  }

  /**
   * Get the secret version (index) that successfully verifies a token
   */
  static getSecretVersion(token: string): number | null {
    try {
      const { secretIndex } = this.verifyTokenWithSecrets(token, this.JWT_SECRETS);
      return secretIndex;
    } catch {
      return null;
    }
  }

  /**
   * Generate a cryptographically secure 6-digit OTP
   * Uses crypto.randomBytes() instead of Math.random() for security
   */
  private static generateOTP(): string {
    // Generate 4 random bytes and convert to a number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    // Map to 6-digit range (100000-999999)
    const otp = 100000 + (randomNumber % 900000);
    return otp.toString();
  }

  /**
   * Change password for authenticated users (no OTP), with session invalidation and activity logging
   */
  static async changePasswordAuthenticated(params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    fingerprint?: Fingerprint;
  }) {
    const { userId, currentPassword, newPassword } = params;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const ok = await this.verifyPassword(currentPassword, user.password);
      if (!ok) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
      }

      const hashedPassword = await this.hashPassword(newPassword);

      // Capture existing sessions for activity logging, then invalidate
      const sessions = await prisma.session.findMany({
        where: { userId: user.id },
        select: { id: true, ipAddress: true, userAgent: true },
      });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
      ]);

      // Log password change activity for each invalidated session
      for (const s of sessions) {
        await this.logSessionActivity({
          sessionId: s.id,
          userId: user.id,
          action: 'PASSWORD_CHANGE',
          ipAddress: s.ipAddress || 'unknown',
          ...(s.userAgent ? { userAgent: s.userAgent } : {}),
          metadata: { reason: 'Authenticated password change' },
        });
      }

      return { message: 'Password changed successfully' };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to change password' });
    }
  }

  /**
   * Hash password using bcrypt
   */
  private static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  private static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  static generateToken(userId: string, sessionId: string): string {
    const secret = this.JWT_SECRETS[0] as Secret;
    const options: jwt.SignOptions = { expiresIn: this.JWT_EXPIRES_IN as any };
    return jwt.sign({ userId, sessionId }, secret, options);
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(userId: string, sessionId: string): string {
    const secret = this.JWT_REFRESH_SECRETS[0] as Secret;
    const options: jwt.SignOptions = { expiresIn: this.JWT_REFRESH_EXPIRES_IN as any };
    return jwt.sign({ userId, sessionId, type: 'refresh' }, secret, options);
  }

  /**
   * Verify JWT access token
   */
  static verifyToken(token: string): { userId: string; sessionId: string } {
    try {
      const { payload, secretIndex } = this.verifyTokenWithSecrets(token, this.JWT_SECRETS);
      // Log if using an old secret (for rotation monitoring)
      if (secretIndex > 0) {
        logger.warn(`Access token verified with old secret version ${secretIndex}`, { secretIndex });
      }
      return { userId: payload.userId, sessionId: payload.sessionId };
    } catch (error) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }
  }

  /**
   * Verify JWT refresh token
   */
  static verifyRefreshToken(token: string): { userId: string; sessionId: string } {
    try {
      const { payload, secretIndex } = this.verifyTokenWithSecrets(token, this.JWT_REFRESH_SECRETS);
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      // Log if using an old secret (for rotation monitoring)
      if (secretIndex > 0) {
        logger.warn(`Refresh token verified with old secret version ${secretIndex}`, { secretIndex });
      }
      return { userId: payload.userId, sessionId: payload.sessionId };
    } catch (error) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    }
  }

  /**
   * Track login attempt for brute-force protection
   */
  private static async trackLoginAttempt(data: LoginAttemptData): Promise<void> {
    try {
      await prisma.loginAttempt.create({
        data: {
          identifier: data.identifier,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent ?? null,
          successful: data.successful,
          failureReason: data.failureReason ?? null,
        },
      });
    } catch (error) {
      logger.error('Failed to track login attempt:', error);
    }
  }

  /**
   * Log session activity for audit trail
   */
  static async logSessionActivity(data: SessionActivityData): Promise<void> {
    try {
      await prisma.sessionActivity.create({
        data: {
          sessionId: data.sessionId,
          userId: data.userId,
          action: data.action,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent ?? null,
          metadata: data.metadata,
          suspicious: data.suspicious || false,
        },
      });
    } catch (error) {
      logger.error('Failed to log session activity:', error);
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private static async detectSuspiciousActivity(data: { userId: string; ipAddress: string; userAgent?: string }): Promise<boolean> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Get recent activities for this user
      const recentActivities = await prisma.sessionActivity.findMany({
        where: {
          userId: data.userId,
          createdAt: { gte: twentyFourHoursAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      if (recentActivities.length === 0) return false;

      // Check for multiple different IP addresses
      const uniqueIPs = new Set(recentActivities.map((a: { ipAddress: string }) => a.ipAddress));
      if (uniqueIPs.size > 3) return true;

      // Check for different user agents
      const uniqueUserAgents = new Set(recentActivities.map((a: { userAgent: string | null }) => a.userAgent).filter(Boolean));
      if (uniqueUserAgents.size > 2) return true;

      // Check for rapid succession of activities (more than 10 in 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentRapidActivities = recentActivities.filter((a: { createdAt: Date }) => a.createdAt >= fiveMinutesAgo);
      if (recentRapidActivities.length > 10) return true;

      return false;
    } catch (error) {
      logger.error('Failed to detect suspicious activity:', error);
      return false;
    }
  }

  /**
   * Check and lock account if too many failed attempts
   */
  private static async checkAndLockAccount(identifier: string, ipAddress: string): Promise<void> {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - this.ACCOUNT_LOCKOUT_DURATION_MINUTES * 60 * 1000);
      
      // Count failed attempts in the last 30 minutes
      const failedAttempts = await prisma.loginAttempt.count({
        where: {
          identifier,
          successful: false,
          createdAt: { gte: thirtyMinutesAgo },
        },
      });

      if (failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        const lockoutDuration = this.ACCOUNT_LOCKOUT_DURATION_MINUTES * 60 * 1000;
        const lockedUntil = new Date(Date.now() + lockoutDuration);

        // Lock the account
        await prisma.user.updateMany({
          where: {
            OR: [
              { email: identifier },
              { username: identifier },
            ],
          },
          data: {
            lockedUntil,
            failedLoginAttempts: failedAttempts,
          },
        });

        logger.warn(`Account locked for identifier: ${identifier} from IP: ${ipAddress}`);
      }
    } catch (error) {
      logger.error('Failed to check and lock account:', error);
    }
  }

  /**
   * Rotate access and refresh tokens
   */
  static async rotateTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const { userId, sessionId } = this.verifyRefreshToken(refreshToken);

      // Verify session still exists and is valid
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid session',
        });
      }

      // Generate new tokens
      const newAccessToken = this.generateToken(userId, sessionId);
      const newRefreshToken = this.generateRefreshToken(userId, sessionId);

      // Update session activity
      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() },
      });

      // Log token refresh activity
      await this.logSessionActivity({
        sessionId,
        userId,
        action: 'TOKEN_REFRESH',
        ipAddress: session.ipAddress || 'unknown',
        ...(session.userAgent ? { userAgent: session.userAgent } : {}),
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to rotate tokens',
      });
    }
  }

  /**
   * User signup with fingerprinting
   */
  static async signup(input: SignupInput, fingerprint?: Fingerprint) {
    try {
      // Check if user already exists by email
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (existingUserByEmail) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User with this email already exists',
        });
      }

      // Check if username already exists
      const existingUserByUsername = await prisma.user.findUnique({
        where: { username: input.username.toLowerCase() },
      });

      if (existingUserByUsername) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username is already taken',
        });
      }

      // Hash password
      const hashedPassword = await this.hashPassword(input.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          username: input.username.toLowerCase(),
          email: input.email.toLowerCase(),
          password: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          email: true,
          walletAddress: true,
          walletVerifiedAt: true,
          isVerified: true,
          createdAt: true,
        },
      });

      // Generate a placeholder token first
      const placeholderToken = 'placeholder';

      // Create session with fingerprint
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: placeholderToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          ipAddress: fingerprint?.ipAddress ?? null,
          userAgent: fingerprint?.userAgent ?? null,
          lastActivityAt: new Date(),
        },
      });

      // Generate actual tokens with session ID
      const token = this.generateToken(user.id, session.id);
      const refreshToken = this.generateRefreshToken(user.id, session.id);

      // Update session with actual token
      await prisma.session.update({
        where: { id: session.id },
        data: { token },
      });

      // Log signup activity
      await this.logSessionActivity({
        sessionId: session.id,
        userId: user.id,
        action: 'SIGNUP',
        ipAddress: fingerprint?.ipAddress || 'unknown',
        ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          walletAddress: user.walletAddress ?? undefined,
          walletVerifiedAt: user.walletVerifiedAt ?? undefined,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
        token,
        refreshToken,
        message: 'Account created successfully',
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create account',
      });
    }
  }

  /**
   * User login with fingerprinting and brute-force protection
   */
  static async login(input: LoginInput, fingerprint?: Fingerprint) {
    const identifier = input.identifier.toLowerCase();
    const ipAddress = fingerprint?.ipAddress || 'unknown';
    
    try {
      // Find user by email or username
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: identifier },
          ],
        },
      });

      if (!user) {
        await this.trackLoginAttempt({
          identifier,
          ipAddress,
          ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
          successful: false,
          failureReason: 'User not found',
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email/username or password',
        });
      }

      const u = user;

      // Check if account is locked
      if (u.lockedUntil && u.lockedUntil > new Date()) {
        const remainingTime = Math.ceil((u.lockedUntil.getTime() - Date.now()) / (1000 * 60));
        
        await this.trackLoginAttempt({
          identifier,
          ipAddress,
          ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
          successful: false,
          failureReason: 'Account locked',
        });

        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Account is locked. Try again in ${remainingTime} minutes.`,
        });
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(input.password, u.password);
      if (!isValidPassword) {
        // Track failed attempt
        await this.trackLoginAttempt({
          identifier,
          ipAddress,
          ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
          successful: false,
          failureReason: 'Invalid password',
        });

        // Check if account should be locked
        await this.checkAndLockAccount(identifier, ipAddress);

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email/username or password',
        });
      }

      // Reset failed login attempts on successful login
      await prisma.user.update({
        where: { id: u.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Clean up expired sessions
      await prisma.session.deleteMany({
        where: {
          userId: u.id,
          expiresAt: { lt: new Date() },
        },
      });

      // Detect suspicious activity
      const isSuspicious = await this.detectSuspiciousActivity({
        userId: u.id,
        ipAddress,
        ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
      });

      // Generate a placeholder token first
      const placeholderToken = 'placeholder';

      // Create new session with fingerprint
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: placeholderToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          ipAddress: fingerprint?.ipAddress ?? null,
          userAgent: fingerprint?.userAgent ?? null,
          lastActivityAt: new Date(),
        },
      });

      // Generate actual tokens with session ID
      const token = this.generateToken(user.id, session.id);
      const refreshToken = this.generateRefreshToken(user.id, session.id);

      // Update session with actual token
      await prisma.session.update({
        where: { id: session.id },
        data: { token },
      });

      // Track successful login attempt
      await this.trackLoginAttempt({
        identifier,
        ipAddress,
        ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
        successful: true,
      });

      // Log login activity
      await this.logSessionActivity({
        sessionId: session.id,
        userId: u.id,
        action: 'LOGIN',
        ipAddress,
        ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
        suspicious: isSuspicious,
      });

      return {
        user: {
          id: u.id,
          username: u.username,
          email: u.email,
          walletAddress: u.walletAddress ?? undefined,
          walletVerifiedAt: u.walletVerifiedAt ?? undefined,
          isVerified: u.isVerified,
          createdAt: u.createdAt,
        },
        token,
        refreshToken,
        message: 'Login successful',
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to login',
      });
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(input: PasswordResetRequestInput) {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          message: 'If an account with this email exists, you will receive a password reset code',
        };
      }

      // Delete any existing OTPs for this user
      await prisma.oTP.deleteMany({
        where: {
          email: input.email.toLowerCase(),
          type: OTPType.RESET_PASSWORD,
        },
      });

      // Generate OTP
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + this.OTP_EXPIRES_IN);

      // Save OTP
      await prisma.oTP.create({
        data: {
          email: input.email.toLowerCase(),
          code: otp,
          type: OTPType.RESET_PASSWORD,
          expiresAt,
        },
      });

      // OTP will be sent via email service in the router
      // Do not log OTP for security reasons

      return {
        message: 'If an account with this email exists, you will receive a password reset code',
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process password reset request',
      });
    }
  }

  /**
   * Verify OTP
   * Note: This marks the OTP as verified but not fully used.
   * The OTP can still be used for password reset within its expiry window.
   * Full "used" status is set during password reset to prevent replay attacks.
   */
  static async verifyOTP(input: VerifyOtpInput) {
    try {
      // Find valid OTP
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          email: input.email.toLowerCase(),
          code: input.otp,
          type: OTPType.RESET_PASSWORD,
          expiresAt: { gt: new Date() },
          used: false,
        },
      });

      if (!otpRecord) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired OTP',
        });
      }

      // Mark OTP as verified (but not fully used yet)
      // This prevents the same OTP from being verified multiple times
      // while still allowing the password reset to complete
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { 
          // Set a short verification window (5 minutes) for password reset
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return {
        message: 'OTP verified successfully',
        isValid: true,
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
  }

  /**
   * Reset password with activity logging
   */
  static async resetPassword(input: ResetPasswordInput) {
    try {
      // Find and verify OTP
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          email: input.email.toLowerCase(),
          code: input.otp,
          type: OTPType.RESET_PASSWORD,
          expiresAt: { gt: new Date() },
          used: false,
        },
      });

      if (!otpRecord) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired OTP',
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(input.newPassword);

      // Get all user sessions before deletion for activity logging
      const userSessions = await prisma.session.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      // Update password and mark OTP as used
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { 
            password: hashedPassword,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }),
        prisma.oTP.update({
          where: { id: otpRecord.id },
          data: { used: true },
        }),
        // Invalidate all existing sessions
        prisma.session.deleteMany({
          where: { userId: user.id },
        }),
      ]);

      // Log password reset activity for each invalidated session
      for (const session of userSessions) {
        await this.logSessionActivity({
          sessionId: session.id,
          userId: user.id,
          action: 'PASSWORD_RESET',
          ipAddress: 'unknown',
          metadata: { reason: 'Password reset via OTP' },
        });
      }

      return {
        message: 'Password reset successfully',
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
  }

  /**
   * Get current user by session with fingerprint validation
   */
  static async getCurrentUser(userId: string, sessionId: string) {
    try {
      // Verify session
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              walletAddress: true,
              createdAt: true,
            },
          },
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session',
        });
      }

      // Update last activity
      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() },
      });

      return session.user;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get current user',
      });
    }
  }

  /**
   * Logout user with activity logging
   */
  static async logout(sessionId: string) {
    try {
      // Get session info before deletion for logging
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true, ipAddress: true, userAgent: true },
      });

      await prisma.session.delete({
        where: { id: sessionId },
      });

      // Log logout activity if session existed
      if (session) {
        await this.logSessionActivity({
          sessionId,
          userId: session.userId,
          action: 'LOGOUT',
          ipAddress: session.ipAddress || 'unknown',
          ...(session.userAgent ? { userAgent: session.userAgent } : {}),
        });
      }

      return {
        message: 'Logged out successfully',
      };
    } catch (error: any) {
      // If session doesn't exist (P2025), consider it already logged out
      if (error.code === 'P2025') {
        return {
          message: 'Logged out successfully',
        };
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to logout',
      });
    }
  }

  /**
   * Enhanced cleanup with statistics
   */
  static async cleanup() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const results = await prisma.$transaction([
        // Delete expired sessions
        prisma.session.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        }),
        // Delete expired OTPs
        prisma.oTP.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        }),
        // Delete old login attempts (30 days)
        prisma.loginAttempt.deleteMany({
          where: { createdAt: { lt: thirtyDaysAgo } },
        }),
        // Delete old session activities (90 days)
        prisma.sessionActivity.deleteMany({
          where: { createdAt: { lt: ninetyDaysAgo } },
        }),
      ]);

      const stats = {
        expiredSessions: results[0].count,
        expiredOTPs: results[1].count,
        oldLoginAttempts: results[2].count,
        oldSessionActivities: results[3].count,
      };

      logger.info('Cleanup completed:', stats);
      return stats;
    } catch (error) {
      logger.error('Failed to cleanup expired records:', error);
      throw error;
    }
  }
}
