import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import type { Secret } from 'jsonwebtoken';
import { OTPType, Role } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { logger } from '../logger';
import prisma from '../prisma';
import { getCacheTtls, redisCache, type CacheKey } from '../redis'
import { createEmailService } from './email'
import { jwtSecretCache } from './jwtRotation';
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

type CachedSession = {
  id: string
  userId: string
  expiresAt: string
  ipAddress: string | null
  userAgent: string | null
}

type CachedUserProfile = {
  id: string
  email: string
  role: Role
  emailVerifiedAt: string | null
  walletAddress: string | null
  walletVerifiedAt: string | null
  username: string
  createdAt: string
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static sessionKey(sessionId: string): `session:${string}` {
    return `session:${sessionId}`
  }

  private static sessionLastActivityKey(sessionId: string): `session:${string}:lastActivityAt` {
    return `session:${sessionId}:lastActivityAt`
  }

  private static userSessionsKey(userId: string): `user:${string}:sessions` {
    return `user:${userId}:sessions`
  }

  private static userProfileKey(userId: string): `user:${string}:profile` {
    return `user:${userId}:profile`
  }

  private static async invalidateUserProfileCache(userId: string): Promise<void> {
    await redisCache.del(this.userProfileKey(userId))
  }

  static async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidateUserProfileCache(userId)
  }

  private static async invalidateSessionCache(sessionId: string, userId?: string): Promise<void> {
    await Promise.all([
      redisCache.del([this.sessionKey(sessionId), this.sessionLastActivityKey(sessionId)]),
      userId ? redisCache.srem(this.userSessionsKey(userId), sessionId) : Promise.resolve(),
    ])
  }

  private static async invalidateSessionsCache(userId: string, sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return
    const keys: CacheKey[] = []
    for (const id of sessionIds) {
      keys.push(this.sessionKey(id), this.sessionLastActivityKey(id))
    }
    await Promise.all([
      redisCache.del(keys),
      redisCache.srem(this.userSessionsKey(userId), sessionIds),
    ])
  }

  private static toCachedSession(session: {
    id: string
    userId: string
    expiresAt: Date
    ipAddress: string | null
    userAgent: string | null
  }): CachedSession {
    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt.toISOString(),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    }
  }

  private static toCachedUserProfile(user: {
    id: string
    email: string
    role: Role
    emailVerifiedAt: Date | null
    walletAddress: string | null
    walletVerifiedAt: Date | null
    username: string
    createdAt: Date
  }): CachedUserProfile {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      walletAddress: user.walletAddress,
      walletVerifiedAt: user.walletVerifiedAt ? user.walletVerifiedAt.toISOString() : null,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
    }
  }

  private static fromCachedUserProfile(user: CachedUserProfile) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt ? new Date(user.emailVerifiedAt) : null,
      walletAddress: user.walletAddress,
      walletVerifiedAt: user.walletVerifiedAt ? new Date(user.walletVerifiedAt) : null,
      username: user.username,
      createdAt: new Date(user.createdAt),
    }
  }

  private static async cacheSessionAndProfile(params: {
    session: { id: string; userId: string; expiresAt: Date; ipAddress: string | null; userAgent: string | null }
    user?: { id: string; email: string; role: Role; emailVerifiedAt: Date | null; walletAddress: string | null; walletVerifiedAt: Date | null; username: string; createdAt: Date }
  }): Promise<void> {
    const { session, user } = params
    const ttls = getCacheTtls()
    const secondsUntilExpiry = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
    const sessionTtl = secondsUntilExpiry > 0 ? Math.min(ttls.session, secondsUntilExpiry) : ttls.session

    await Promise.all([
      redisCache.set(this.sessionKey(session.id), this.toCachedSession(session), sessionTtl),
      redisCache.set(this.sessionLastActivityKey(session.id), new Date().toISOString(), sessionTtl),
      redisCache.sadd(this.userSessionsKey(session.userId), session.id),
      user ? redisCache.set(this.userProfileKey(session.userId), this.toCachedUserProfile(user), sessionTtl) : Promise.resolve(),
    ])
  }

  // JWT secrets are now loaded from jwtSecretCache (Comment 1 fix)
  // Cache is initialized from environment variables on startup and updated on rotation
  private static getAccessSecrets(): string[] {
    return jwtSecretCache.getVerificationSecrets('access');
  }

  private static getRefreshSecrets(): string[] {
    return jwtSecretCache.getVerificationSecrets('refresh');
  }

  private static getSigningSecret(): string {
    return jwtSecretCache.getSigningSecret('access');
  }

  private static getRefreshSigningSecret(): string {
    return jwtSecretCache.getSigningSecret('refresh');
  }

  private static readonly JWT_SECRET_ROTATION_PERIOD_DAYS = parseInt(process.env.JWT_SECRET_ROTATION_PERIOD_DAYS || '90');
  private static readonly JWT_SECRET_OVERLAP_DAYS = parseInt(process.env.JWT_SECRET_OVERLAP_DAYS || '7');

  /**
   * Parse JWT expiration string to seconds (Audit Issue #20)
   * Supports formats: '1h', '30m', '7d', '3600', '3600s'
   * Defaults to 3600 seconds (1 hour) for invalid formats
   */
  static parseJwtExpiration(value: string | number): number {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 3600;

    const match = value.match(/^(\d+)(h|m|s|d)?$/i);
    if (!match) return 3600; // default 1 hour

    const num = parseInt(match[1] || '0', 10);
    const unit = (match[2] || 's').toLowerCase();

    switch (unit) {
      case 'd': return Number.isFinite(num) && num > 0 ? num * 86400 : 3600;
      case 'h': return Number.isFinite(num) && num > 0 ? num * 3600 : 3600;
      case 'm': return Number.isFinite(num) && num > 0 ? num * 60 : 3600;
      case 's':
      default: return Number.isFinite(num) && num > 0 ? num : 3600;
    }
  }

  private static readonly JWT_EXPIRES_IN: number = AuthService.parseJwtExpiration(process.env.JWT_EXPIRES_IN || '7d');
  private static readonly JWT_REFRESH_EXPIRES_IN: number = AuthService.parseJwtExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '365d');
  private static readonly OTP_EXPIRES_IN = 10 * 60 * 1000; // 10 minutes in milliseconds
  private static readonly MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  private static readonly ACCOUNT_LOCKOUT_DURATION_MINUTES = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || '30');
  private static readonly MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER || '2');
  private static readonly emailService = createEmailService()

  /**
   * Hash OTP using SHA-256 before storage (Audit Issue #2)
   * @param otp - Plain text OTP
   * @returns SHA-256 hash as hex string (64 characters)
   */
  static hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Verify OTP by comparing hashes (Audit Issue #2)
   * @param inputOtp - User-provided OTP
   * @param storedHash - Stored SHA-256 hash
   * @returns True if OTP matches
   */
  static verifyOTPHash(inputOtp: string, storedHash: string): boolean {
    const inputHash = this.hashOTP(inputOtp);
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  }

  // Log warnings for rotation status (proxy: warn if multiple secrets indicate ongoing rotation)
  static logRotationStatus(): void {
    const accessSecrets = this.getAccessSecrets();
    const refreshSecrets = this.getRefreshSecrets();
    if (accessSecrets.length > 1) {
      logger.warn(`Multiple JWT secrets configured (${accessSecrets.length}). Rotation in progress.`);
    }
    if (refreshSecrets.length > 1) {
      logger.warn(`Multiple JWT refresh secrets configured (${refreshSecrets.length}). Rotation in progress.`);
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
      const { secretIndex } = this.verifyTokenWithSecrets(token, this.getAccessSecrets());
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

      await Promise.all([
        this.invalidateUserProfileCache(user.id),
        this.invalidateSessionsCache(user.id, sessions.map((s) => s.id)),
      ])

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
    const secret = this.getSigningSecret() as Secret;
    const options: jwt.SignOptions = { expiresIn: this.JWT_EXPIRES_IN };
    return jwt.sign({ userId, sessionId }, secret, options);
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(userId: string, sessionId: string): string {
    const secret = this.getRefreshSigningSecret() as Secret;
    const options: jwt.SignOptions = { expiresIn: this.JWT_REFRESH_EXPIRES_IN };
    return jwt.sign({ userId, sessionId, type: 'refresh' }, secret, options);
  }

  /**
   * Verify JWT access token
   */
  static verifyToken(token: string): { userId: string; sessionId: string } {
    try {
      const { payload, secretIndex } = this.verifyTokenWithSecrets(token, this.getAccessSecrets());
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
      const { payload, secretIndex } = this.verifyTokenWithSecrets(token, this.getRefreshSecrets());
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

        if (process.env.ENABLE_ACCOUNT_LOCKOUT_NOTIFICATIONS === 'true') {
          const user = await prisma.user.findFirst({
            where: { OR: [{ email: identifier }, { username: identifier }] },
            select: { email: true },
          })
          if (user?.email) {
            this.emailService.sendAccountLockoutNotification(
              user.email,
              this.ACCOUNT_LOCKOUT_DURATION_MINUTES,
              failedAttempts,
              ipAddress
            ).catch((error) => {
              logger.error('Failed to send lockout notification:', error)
            })
          }
        }
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

      {
        const ttls = getCacheTtls()
        const secondsUntilExpiry = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
        const sessionTtl = secondsUntilExpiry > 0 ? Math.min(ttls.session, secondsUntilExpiry) : ttls.session
        await redisCache.set(this.sessionLastActivityKey(sessionId), new Date().toISOString(), sessionTtl)
      }

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
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year (persistent login)
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

      await this.cacheSessionAndProfile({
        session: {
          id: session.id,
          userId: user.id,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress ?? null,
          userAgent: session.userAgent ?? null,
        },
      })

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
      // Find user by email or username (Audit Issue #10: Select only needed fields)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: identifier },
          ],
        },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          lockedUntil: true,
          failedLoginAttempts: true,
          walletAddress: true,
          walletVerifiedAt: true,
          isVerified: true,
          createdAt: true,
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

      // Enforce max concurrent sessions cap (Comment 1 fix)
      const activeSessions = await prisma.session.findMany({
        where: { userId: u.id },
        orderBy: { lastActivityAt: 'asc' },
        select: { id: true, lastActivityAt: true, ipAddress: true },
      });

      const sessionsToRevoke = activeSessions.length >= this.MAX_SESSIONS_PER_USER
        ? activeSessions.slice(0, activeSessions.length - this.MAX_SESSIONS_PER_USER + 1)
        : [];

      if (sessionsToRevoke.length > 0) {
        // Delete oldest sessions to make room for new one
        await prisma.session.deleteMany({
          where: { id: { in: sessionsToRevoke.map(s => s.id) } },
        });

        await this.invalidateSessionsCache(u.id, sessionsToRevoke.map((s) => s.id))

        // Log auto-revocations in session activity
        for (const revokedSession of sessionsToRevoke) {
          await this.logSessionActivity({
            sessionId: revokedSession.id,
            userId: u.id,
            action: 'SESSION_AUTO_REVOKED',
            ipAddress: revokedSession.ipAddress || 'unknown',
            metadata: {
              reason: 'max_sessions_exceeded',
              newLoginIp: ipAddress,
              revokedAt: new Date().toISOString(),
            },
          });
        }

        logger.info('Auto-revoked oldest sessions due to max session limit', {
          userId: u.id,
          revokedCount: sessionsToRevoke.length,
          maxSessions: this.MAX_SESSIONS_PER_USER,
        });
      }

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
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year (persistent login)
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

      await this.cacheSessionAndProfile({
        session: {
          id: session.id,
          userId: u.id,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress ?? null,
          userAgent: session.userAgent ?? null,
        },
      })

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

      if (process.env.ENABLE_SUSPICIOUS_LOGIN_ALERTS === 'true' && isSuspicious) {
        this.emailService.sendSuspiciousLoginAlert(
          u.email,
          ipAddress,
          fingerprint?.userAgent || 'Unknown',
          undefined,
          new Date()
        ).catch((error) => {
          logger.error('Failed to send suspicious login alert:', error)
        })
      }

      if (process.env.ENABLE_LOGIN_NOTIFICATIONS === 'true') {
        this.emailService.sendLoginNotification(
          u.email,
          ipAddress,
          fingerprint?.userAgent || 'Unknown',
          new Date()
        ).catch((error) => {
          logger.error('Failed to send login notification:', error)
        })
      }


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

      // Hash OTP before storage (Audit Issue #2)
      const hashedOtp = this.hashOTP(otp);

      // Save hashed OTP
      await prisma.oTP.create({
        data: {
          email: input.email.toLowerCase(),
          code: hashedOtp, // Store hash, not plain text
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
   * Verify OTP (Audit Issue #2: Compare hashes)
   * Note: This marks the OTP as verified but not fully used.
   * The OTP can still be used for password reset within its expiry window.
   * Full "used" status is set during password reset to prevent replay attacks.
   */
  static async verifyOTP(input: VerifyOtpInput) {
    try {
      // Hash input OTP for comparison (Audit Issue #2)
      const hashedInput = this.hashOTP(input.otp);

      // Find valid OTP by hash
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          email: input.email.toLowerCase(),
          code: hashedInput, // Compare hashes
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
   * Reset password with activity logging (Audit Issue #2: Compare hashes)
   */
  static async resetPassword(input: ResetPasswordInput) {
    try {
      // Hash input OTP for comparison (Audit Issue #2)
      const hashedInput = this.hashOTP(input.otp);

      // Find and verify OTP by hash
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          email: input.email.toLowerCase(),
          code: hashedInput, // Compare hashes
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

      await Promise.all([
        this.invalidateUserProfileCache(user.id),
        this.invalidateSessionsCache(user.id, userSessions.map((s) => s.id)),
      ])

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
      const cachedSession = await redisCache.get<CachedSession>(this.sessionKey(sessionId))
      if (cachedSession && cachedSession.userId === userId) {
        const expiresAt = new Date(cachedSession.expiresAt)
        if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) {
          const cachedProfile = await redisCache.get<CachedUserProfile>(this.userProfileKey(userId))
          const ttls = getCacheTtls()
          const secondsUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
          const sessionTtl = secondsUntilExpiry > 0 ? Math.min(ttls.session, secondsUntilExpiry) : ttls.session
          await redisCache.set(this.sessionLastActivityKey(sessionId), new Date().toISOString(), sessionTtl)

          if (cachedProfile) {
            return this.fromCachedUserProfile(cachedProfile)
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              role: true,
              emailVerifiedAt: true,
              walletAddress: true,
              walletVerifiedAt: true,
              username: true,
              createdAt: true,
            },
          })

          if (!user) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired session',
            })
          }

          await this.cacheSessionAndProfile({
            session: {
              id: sessionId,
              userId,
              expiresAt,
              ipAddress: cachedSession.ipAddress,
              userAgent: cachedSession.userAgent,
            },
            user,
          })

          return user
        }
      }

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
              role: true,
              emailVerifiedAt: true,
              walletAddress: true,
              walletVerifiedAt: true,
              username: true,
              createdAt: true,
            },
          },
        },
      })

      if (!session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session',
        })
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() },
      })

      await this.cacheSessionAndProfile({
        session: {
          id: session.id,
          userId: session.userId,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress ?? null,
          userAgent: session.userAgent ?? null,
        },
        user: session.user,
      })

      return session.user
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

      await this.invalidateSessionCache(sessionId, session?.userId)

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
