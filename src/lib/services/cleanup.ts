import type { PrismaClient } from '@prisma/client';
import type { AuthService } from './auth';
import type { EmailService } from './email';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logger';

export interface CleanupStats {
  expiredSessions: number;
  expiredOtps: number;
  oldLoginAttempts: number;
  oldSessionActivities: number;
  lockedAccountsUnlocked: number;
  expiredDataExports: number;
}

export interface CleanupConfig {
  sessionExpiryDays: number;
  otpExpiryHours: number;
  loginAttemptRetentionDays: number;
  sessionActivityRetentionDays: number;
  autoUnlockExpiredAccounts: boolean;
  enableScheduledCleanup: boolean;
  cleanupIntervalMinutes: number;
}

export class CleanupService {
  private prisma: PrismaClient;
  private _authService: AuthService;
  private emailService: EmailService;
  private config: CleanupConfig;
  private cleanupInterval: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(
    prisma: PrismaClient,
    authService: AuthService,
    emailService: EmailService,
    config: Partial<CleanupConfig> = {}
  ) {
    this.prisma = prisma;
    this._authService = authService;
    this.emailService = emailService;
    // touch property to satisfy strict noUnusedLocals under some configs
    if (!this._authService) {
      // no-op
    }
    this.config = {
      sessionExpiryDays: config.sessionExpiryDays || 30,
      otpExpiryHours: config.otpExpiryHours || 24,
      loginAttemptRetentionDays: config.loginAttemptRetentionDays || 7,
      sessionActivityRetentionDays: config.sessionActivityRetentionDays || 90,
      autoUnlockExpiredAccounts: config.autoUnlockExpiredAccounts ?? true,
      enableScheduledCleanup: config.enableScheduledCleanup ?? true,
      cleanupIntervalMinutes: config.cleanupIntervalMinutes || 60,
    };
  }

  /**
   * Start the scheduled cleanup service
   */
  start(): void {
    if (this.isRunning) {
      logger.info('Cleanup service is already running');
      return;
    }

    if (!this.config.enableScheduledCleanup) {
      logger.info('Scheduled cleanup is disabled');
      return;
    }

    logger.info(`Starting cleanup service with ${this.config.cleanupIntervalMinutes} minute intervals`);
    
    // Run initial cleanup
    this.runCleanup().catch(error => {
      logger.error('Initial cleanup failed:', error);
    });

    // Schedule recurring cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        logger.error('Scheduled cleanup failed:', error);
      });
    }, this.config.cleanupIntervalMinutes * 60 * 1000);

    this.isRunning = true;
  }

  /**
   * Stop the scheduled cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.isRunning = false;
    logger.info('Cleanup service stopped');
  }

  /**
   * Check if the cleanup service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Run a complete cleanup cycle
   */
  async runCleanup(): Promise<CleanupStats> {
    logger.info('Starting cleanup cycle...');
    const startTime = Date.now();

    try {
      const stats: CleanupStats = {
        expiredSessions: 0,
        expiredOtps: 0,
        oldLoginAttempts: 0,
        oldSessionActivities: 0,
        lockedAccountsUnlocked: 0,
        expiredDataExports: 0,
      };

      // Run all cleanup operations
      await Promise.all([
        this.cleanupExpiredSessionsInternal(stats),
        this.cleanupExpiredOtps(stats),
        this.cleanupOldLoginAttemptsInternal(stats),
        this.cleanupOldSessionActivitiesInternal(stats),
        this.unlockExpiredAccountsInternal(stats),
        this.cleanupExpiredDataExportsInternal(stats),
      ]);

      const duration = Date.now() - startTime;
      logger.info(`Cleanup completed in ${duration}ms:`, stats);

      return stats;
    } catch (error) {
      logger.error('Cleanup cycle failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const stats = { expiredSessions: 0 } as CleanupStats;
    await this.cleanupExpiredSessionsInternal(stats);
    return stats.expiredSessions;
  }

  /**
   * Internal method for cleaning up expired sessions
   */
  private async cleanupExpiredSessionsInternal(stats: CleanupStats): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.sessionExpiryDays);

    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { lastActivityAt: { lt: cutoffDate } },
        ],
      },
    });

    stats.expiredSessions = result.count;
  }

  /**
   * Clean up expired OTPs
   */
  async cleanupExpiredOTPs(): Promise<number> {
    const stats = { expiredOtps: 0 } as CleanupStats;
    await this.cleanupExpiredOtps(stats);
    return stats.expiredOtps;
  }

  /**
   * Clean up old login attempts
   */
  async cleanupOldLoginAttempts(): Promise<number> {
    const stats = { oldLoginAttempts: 0 } as CleanupStats;
    await this.cleanupOldLoginAttemptsInternal(stats);
    return stats.oldLoginAttempts;
  }

  /**
   * Clean up old session activities
   */
  async cleanupOldSessionActivities(): Promise<number> {
    const stats = { oldSessionActivities: 0 } as CleanupStats;
    await this.cleanupOldSessionActivitiesInternal(stats);
    return stats.oldSessionActivities;
  }

  /**
   * Clean up expired OTPs
   */
  private async cleanupExpiredOtps(stats: CleanupStats): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - this.config.otpExpiryHours);

    const result = await this.prisma.oTP.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { createdAt: { lt: cutoffDate } },
        ],
      },
    });

    stats.expiredOtps = result.count;
  }

  /**
   * Clean up old login attempts
   */
  private async cleanupOldLoginAttemptsInternal(stats: CleanupStats): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.loginAttemptRetentionDays);

    const result = await this.prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    stats.oldLoginAttempts = result.count;
  }

  /**
   * Clean up old session activities
   */
  private async cleanupOldSessionActivitiesInternal(stats: CleanupStats): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.sessionActivityRetentionDays);

    const result = await this.prisma.sessionActivity.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    stats.oldSessionActivities = result.count;
  }

  /**
   * Unlock accounts with expired lockouts
   */
  async unlockExpiredAccounts(): Promise<number> {
    const stats = { lockedAccountsUnlocked: 0 } as CleanupStats;
    await this.unlockExpiredAccountsInternal(stats);
    return stats.lockedAccountsUnlocked;
  }

  /**
   * Internal method for unlocking accounts with expired lockouts
   */
  private async unlockExpiredAccountsInternal(stats: CleanupStats): Promise<void> {
    if (!this.config.autoUnlockExpiredAccounts) {
      return;
    }

    const now = new Date();
    const lockedUsers = await this.prisma.user.findMany({
      where: {
        lockedUntil: { 
          not: null,
          lt: now 
        },
      },
      select: { id: true, email: true },
    });

    if (lockedUsers.length === 0) {
      return;
    }

    // Unlock the accounts
    await this.prisma.user.updateMany({
      where: {
        id: { in: lockedUsers.map(u => u.id) },
      },
      data: {
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
    });

    stats.lockedAccountsUnlocked = lockedUsers.length;

    // Send unlock notifications
    for (const user of lockedUsers) {
      try {
        await this.emailService.sendAccountUnlockedNotification(user.email, 'auto');
      } catch (error) {
        logger.error(`Failed to send unlock notification to ${user.email}:`, error);
      }
    }
  }

  private async cleanupExpiredDataExportsInternal(stats: CleanupStats): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.dataExportRequest.findMany({
      where: { status: 'COMPLETED', expiresAt: { lt: now } },
      select: { id: true, fileUrl: true },
      take: 500,
    });

    if (!expired.length) {
      stats.expiredDataExports = 0;
      return;
    }

    await Promise.all(
      expired.map(async (r) => {
        const fileUrl = r.fileUrl;
        if (!fileUrl) return;
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return;
        const filePath = path.isAbsolute(fileUrl) ? fileUrl : path.join(process.cwd(), fileUrl);
        await fs.rm(filePath, { force: true }).catch(() => void 0);
      })
    );

    const res = await this.prisma.dataExportRequest.deleteMany({
      where: { id: { in: expired.map((e) => e.id) } },
    });

    stats.expiredDataExports = res.count;
  }

  /**
   * Get cleanup statistics without running cleanup
   */
  async getCleanupStats(): Promise<{
    expiredSessions: number;
    expiredOtps: number;
    oldLoginAttempts: number;
    oldSessionActivities: number;
    lockedAccountsToUnlock: number;
  }> {
    const sessionCutoff = new Date();
    sessionCutoff.setDate(sessionCutoff.getDate() - this.config.sessionExpiryDays);

    const otpCutoff = new Date();
    otpCutoff.setHours(otpCutoff.getHours() - this.config.otpExpiryHours);

    const loginAttemptCutoff = new Date();
    loginAttemptCutoff.setDate(loginAttemptCutoff.getDate() - this.config.loginAttemptRetentionDays);

    const sessionActivityCutoff = new Date();
    sessionActivityCutoff.setDate(sessionActivityCutoff.getDate() - this.config.sessionActivityRetentionDays);

    const [
      expiredSessions,
      expiredOtps,
      oldLoginAttempts,
      oldSessionActivities,
      lockedAccountsToUnlock,
    ] = await Promise.all([
      this.prisma.session.count({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { lastActivityAt: { lt: sessionCutoff } },
          ],
        },
      }),
      this.prisma.oTP.count({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { createdAt: { lt: otpCutoff } },
          ],
        },
      }),
      this.prisma.loginAttempt.count({
        where: {
          createdAt: { lt: loginAttemptCutoff },
        },
      }),
      this.prisma.sessionActivity.count({
        where: {
          createdAt: { lt: sessionActivityCutoff },
        },
      }),
      this.prisma.user.count({
        where: {
          lockedUntil: { 
            not: null,
            lt: new Date() 
          },
        },
      }),
    ]);

    return {
      expiredSessions,
      expiredOtps,
      oldLoginAttempts,
      oldSessionActivities,
      lockedAccountsToUnlock,
    };
  }

  /**
   * Force cleanup of specific data types
   */
  async forceCleanup(types: ('sessions' | 'otps' | 'loginAttempts' | 'sessionActivities' | 'lockedAccounts')[]): Promise<CleanupStats> {
    const stats: CleanupStats = {
      expiredSessions: 0,
      expiredOtps: 0,
      oldLoginAttempts: 0,
      oldSessionActivities: 0,
      lockedAccountsUnlocked: 0,
      expiredDataExports: 0,
    };

    const cleanupPromises: Promise<void>[] = [];

    if (types.includes('sessions')) {
      cleanupPromises.push(this.cleanupExpiredSessionsInternal(stats));
    }
    if (types.includes('otps')) {
      cleanupPromises.push(this.cleanupExpiredOtps(stats));
    }
    if (types.includes('loginAttempts')) {
      cleanupPromises.push(this.cleanupOldLoginAttemptsInternal(stats));
    }
    if (types.includes('sessionActivities')) {
      cleanupPromises.push(this.cleanupOldSessionActivitiesInternal(stats));
    }
    if (types.includes('lockedAccounts')) {
      cleanupPromises.push(this.unlockExpiredAccountsInternal(stats));
    }

    await Promise.all(cleanupPromises);
    return stats;
  }

  /**
   * Update cleanup configuration
   */
  updateConfig(newConfig: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart service if interval changed and service is running
    if (this.isRunning && newConfig.cleanupIntervalMinutes) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CleanupConfig {
    return { ...this.config };
  }
}

// Factory function to create cleanup service
export const createCleanupService = (
  prisma: PrismaClient,
  authService: AuthService,
  emailService: EmailService,
  config?: Partial<CleanupConfig>
): CleanupService => {
  const cleanupConfig: Partial<CleanupConfig> = {
    sessionExpiryDays: process.env.SESSION_EXPIRY_DAYS ? parseInt(process.env.SESSION_EXPIRY_DAYS) : 30,
    otpExpiryHours: process.env.OTP_EXPIRY_HOURS ? parseInt(process.env.OTP_EXPIRY_HOURS) : 24,
    loginAttemptRetentionDays: process.env.LOGIN_ATTEMPT_RETENTION_DAYS ? parseInt(process.env.LOGIN_ATTEMPT_RETENTION_DAYS) : 7,
    sessionActivityRetentionDays: process.env.SESSION_ACTIVITY_RETENTION_DAYS ? parseInt(process.env.SESSION_ACTIVITY_RETENTION_DAYS) : 90,
    autoUnlockExpiredAccounts: process.env.AUTO_UNLOCK_EXPIRED_ACCOUNTS !== 'false',
    enableScheduledCleanup: process.env.ENABLE_SCHEDULED_CLEANUP !== 'false',
    cleanupIntervalMinutes: process.env.CLEANUP_INTERVAL_MINUTES ? parseInt(process.env.CLEANUP_INTERVAL_MINUTES) : 60,
    ...config,
  };

  return new CleanupService(prisma, authService, emailService, cleanupConfig);
};
