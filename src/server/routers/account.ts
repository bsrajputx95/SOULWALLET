import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { redisCache } from '../../lib/redis'
// Comment 1: Import centralized validation limits for consistent username validation
import { VALIDATION_LIMITS, validateDateOfBirth, validatePhoneNumber } from '../../lib/validation';

export const accountRouter = router({
  /**
   * Get user profile
   */
  getUserProfile: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            profileImage: true,
            bio: true,
            walletAddress: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Get additional profile data from user settings
        const settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
          select: { preferences: true, security: true },
        });

        const preferences = settings?.preferences as any || {};
        const security = settings?.security as any || {};

        // Parse name into first/last if available
        const nameParts = user.name?.split(' ') || [];
        const firstName = nameParts[0] || undefined;
        const lastName = nameParts.slice(1).join(' ') || undefined;

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName,
          lastName,
          phone: preferences.phone,
          dateOfBirth: preferences.dateOfBirth,
          profileImage: user.profileImage,
          defaultCurrency: preferences.defaultCurrency || 'USD',
          language: preferences.language || 'en',
          twoFactorEnabled: security.twoFactorEnabled || false,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Get user profile error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get user profile',
        });
      }
    }),

  /**
   * Update user profile
   */
  updateUserProfile: protectedProcedure
    .input(z.object({
      // Comment 1: Use centralized VALIDATION_LIMITS for username (50 chars max)
      username: z.string()
        .min(VALIDATION_LIMITS.USERNAME_MIN)
        .max(VALIDATION_LIMITS.USERNAME_MAX)
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
        .optional(),
      firstName: z.string().max(50).optional(),
      lastName: z.string().max(50).optional(),
      phone: z.string().max(20).optional().refine((val) => {
        if (!val) return true;
        return validatePhoneNumber(val).isValid;
      }, { message: 'Invalid phone number format' }),
      dateOfBirth: z.string().optional().refine((val) => {
        return validateDateOfBirth(val).isValid;
      }, { message: 'Invalid date of birth (must be 13+ years old)' }),
      defaultCurrency: z.string().max(10).optional(),
      language: z.string().max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Check username uniqueness if being updated
        if (input.username) {
          const existing = await prisma.user.findFirst({
            where: {
              username: input.username,
              NOT: { id: ctx.user.id },
            },
          });
          if (existing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Username already taken',
            });
          }
        }

        // Build name from first/last
        const name = [input.firstName, input.lastName].filter(Boolean).join(' ') || undefined;

        // Update user table fields
        const userUpdate: any = {};
        if (input.username) userUpdate.username = input.username;
        if (name) userUpdate.name = name;

        const updated = await prisma.user.update({
          where: { id: ctx.user.id },
          data: userUpdate,
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            profileImage: true,
            walletAddress: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // Update preferences in user settings
        if (input.phone || input.dateOfBirth || input.defaultCurrency || input.language) {
          const existingSettings = await prisma.userSettings.findUnique({
            where: { userId: ctx.user.id },
          });

          const currentPrefs = (existingSettings?.preferences as any) || {};
          const newPrefs = {
            ...currentPrefs,
            ...(input.phone !== undefined && { phone: input.phone }),
            ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth }),
            ...(input.defaultCurrency !== undefined && { defaultCurrency: input.defaultCurrency }),
            ...(input.language !== undefined && { language: input.language }),
          };

          await prisma.userSettings.upsert({
            where: { userId: ctx.user.id },
            update: { preferences: newPrefs },
            create: { userId: ctx.user.id, preferences: newPrefs },
          });
        }

        // Parse name back to first/last
        const nameParts = updated.name?.split(' ') || [];

        return {
          success: true,
          profile: {
            id: updated.id,
            username: updated.username,
            email: updated.email,
            firstName: nameParts[0] || input.firstName,
            lastName: nameParts.slice(1).join(' ') || input.lastName,
            phone: input.phone,
            dateOfBirth: input.dateOfBirth,
            profileImage: updated.profileImage,
            defaultCurrency: input.defaultCurrency || 'USD',
            language: input.language || 'en',
            walletAddress: updated.walletAddress,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Update user profile error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile',
        });
      }
    }),

  /**
   * Get security settings
   */
  getSecuritySettings: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: {
            id: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            updatedAt: true,
          },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Get user settings for 2FA status
        const settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
          select: { security: true },
        });

        const securitySettings = settings?.security as any || {};

        return {
          userId: user.id,
          twoFactorEnabled: securitySettings.twoFactorEnabled || false,
          lastPasswordChange: securitySettings.passwordChangedAt || user.updatedAt,
          loginAttempts: user.failedLoginAttempts || 0,
          lockedUntil: user.lockedUntil,
          recoveryEmail: securitySettings.recoveryEmail,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Get security settings error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get security settings',
        });
      }
    }),

  /**
   * Update security settings
   */
  updateSecuritySettings: protectedProcedure
    .input(z.object({
      twoFactorEnabled: z.boolean().optional(),
      recoveryEmail: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Update or create user settings
        const existingSettings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
        });

        const currentSecurity = (existingSettings?.security as any) || {};
        const newSecurity = {
          ...currentSecurity,
          ...(input.twoFactorEnabled !== undefined && { twoFactorEnabled: input.twoFactorEnabled }),
          ...(input.recoveryEmail !== undefined && { recoveryEmail: input.recoveryEmail }),
        };

        await prisma.userSettings.upsert({
          where: { userId: ctx.user.id },
          update: { security: newSecurity },
          create: {
            userId: ctx.user.id,
            security: newSecurity,
          },
        });

        await redisCache.del(`user:${ctx.user.id}:profile`)

        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: {
            id: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            updatedAt: true,
          },
        });

        return {
          success: true,
          settings: {
            userId: ctx.user.id,
            twoFactorEnabled: newSecurity.twoFactorEnabled || false,
            lastPasswordChange: newSecurity.passwordChangedAt || user?.updatedAt || new Date(),
            loginAttempts: user?.failedLoginAttempts || 0,
            lockedUntil: user?.lockedUntil,
            recoveryEmail: newSecurity.recoveryEmail,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Update security settings error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update security settings',
        });
      }
    }),

  /**
   * Get wallet info
   */
  getWalletInfo: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: {
            walletAddress: true,
            walletVerifiedAt: true,
            createdAt: true,
          },
        });

        if (!user || !user.walletAddress) {
          return null;
        }

        // Get wallet backup status from user settings
        const settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
          select: { preferences: true },
        });

        const preferences = settings?.preferences as any || {};

        return {
          publicKey: user.walletAddress,
          walletType: 'solana' as const,
          isBackedUp: preferences.walletBackedUp || false,
          createdAt: user.walletVerifiedAt || user.createdAt,
        };
      } catch (error) {
        logger.error('Get wallet info error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get wallet info',
        });
      }
    }),

  /**
   * Reset password (authenticated)
   */
  resetPassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { password: true },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Verify current password
        const isValid = await bcrypt.compare(input.currentPassword, user.password);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Current password is incorrect',
          });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(input.newPassword, 12);

        // Update password
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            password: hashedPassword,
          },
        });

        // Store password change timestamp in user settings
        await prisma.userSettings.upsert({
          where: { userId: ctx.user.id },
          update: {
            security: {
              passwordChangedAt: new Date().toISOString(),
            },
          },
          create: {
            userId: ctx.user.id,
            security: {
              passwordChangedAt: new Date().toISOString(),
            },
          },
        });

        return {
          success: true,
          message: 'Password updated successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Reset password error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset password',
        });
      }
    }),

  /**
   * Get wallet private key (requires password verification)
   * NOTE: In production, private keys should NEVER leave the client device.
   * This endpoint is for backup purposes only and should be used with extreme caution.
   */
  getWalletPrivateKey: protectedProcedure
    .input(z.object({
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { password: true },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Verify password
        const isValid = await bcrypt.compare(input.password, user.password);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password',
          });
        }

        // In a real implementation, you would decrypt the private key here
        // For security, private keys should be stored client-side only
        // This is a placeholder that returns null to indicate client-side storage
        return {
          success: true,
          privateKey: null, // Private key is stored client-side only
          message: 'Private key is stored securely on your device',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Get private key error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve private key',
        });
      }
    }),

  /**
   * Get wallet recovery phrase (requires password verification)
   * NOTE: Recovery phrases should NEVER leave the client device.
   */
  getWalletRecoveryPhrase: protectedProcedure
    .input(z.object({
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { password: true },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Verify password
        const isValid = await bcrypt.compare(input.password, user.password);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password',
          });
        }

        // Recovery phrase is stored client-side only
        return {
          success: true,
          recoveryPhrase: null,
          message: 'Recovery phrase is stored securely on your device',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Get recovery phrase error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve recovery phrase',
        });
      }
    }),

  /**
   * Generate backup codes for 2FA
   */
  generateBackupCodes: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Generate 10 backup codes
        const codes: string[] = [];
        for (let i = 0; i < 10; i++) {
          const code = Math.random().toString(36).substring(2, 10).toUpperCase();
          codes.push(code);
        }

        // Hash and store backup codes in user settings
        const hashedCodes = await Promise.all(
          codes.map(code => bcrypt.hash(code, 10))
        );

        await prisma.userSettings.upsert({
          where: { userId: ctx.user.id },
          update: {
            security: {
              backupCodes: hashedCodes,
              backupCodesGeneratedAt: new Date().toISOString(),
            },
          },
          create: {
            userId: ctx.user.id,
            security: {
              backupCodes: hashedCodes,
              backupCodesGeneratedAt: new Date().toISOString(),
            },
          },
        });

        await redisCache.del(`user:${ctx.user.id}:profile`)

        return {
          success: true,
          codes, // Return plain codes to user (only time they'll see them)
          message: 'Save these codes securely. They can only be shown once.',
        };
      } catch (error) {
        logger.error('Generate backup codes error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate backup codes',
        });
      }
    }),

  /**
   * Upload profile image
   * Stores as data URL - for production, integrate with cloud storage (S3/Cloudinary)
   */
  uploadProfileImage: protectedProcedure
    .input(z.object({
      imageBase64: z.string().max(5 * 1024 * 1024), // Max 5MB base64 (roughly 3.75MB image)
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate base64 format
        const base64Regex = /^[A-Za-z0-9+/=]+$/;
        if (!base64Regex.test(input.imageBase64.replace(/\s/g, ''))) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid image data format',
          });
        }

        // Create full data URL for storage
        // In production, upload to cloud storage and store URL instead
        const imageUrl = `data:${input.mimeType};base64,${input.imageBase64}`;

        // Update user profile image
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            profileImage: imageUrl,
          },
        });

        logger.info(`Profile image updated for user ${ctx.user.id}`);

        return {
          success: true,
          imageUrl,
          message: 'Profile image updated successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Upload profile image error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload profile image',
        });
      }
    }),

  /**
   * Delete account
   */
  deleteAccount: protectedProcedure
    .input(z.object({
      password: z.string().min(1),
      confirmText: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify confirmation text
        if (input.confirmText !== 'DELETE MY ACCOUNT') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please type "DELETE MY ACCOUNT" to confirm',
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { password: true },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Verify password
        const isValid = await bcrypt.compare(input.password, user.password);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password',
          });
        }

        // Delete user and all related data (cascades configured in schema)
        await prisma.user.delete({
          where: { id: ctx.user.id },
        });

        return {
          success: true,
          message: 'Account deleted successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Delete account error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete account',
        });
      }
    }),



  // ============================================
  // Device Management Endpoints (Comment 2 fix)
  // ============================================

  /**
   * List all devices for the current user
   */
  listDevices: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const { DeviceService } = await import('../../lib/services/device');
        const devices = await DeviceService.listDevices(ctx.user!.id);
        return { devices };
      } catch (error) {
        logger.error('List devices error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list devices',
        });
      }
    }),

  /**
   * Trust a device
   */
  trustDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { DeviceService } = await import('../../lib/services/device');
        const success = await DeviceService.trustDevice(ctx.user!.id, input.deviceId);

        if (!success) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Device not found',
          });
        }

        return { success: true, message: 'Device trusted' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Trust device error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to trust device',
        });
      }
    }),

  /**
   * Revoke/remove a device
   */
  revokeDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { DeviceService } = await import('../../lib/services/device');
        const success = await DeviceService.revokeDevice(ctx.user!.id, input.deviceId);

        if (!success) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Device not found',
          });
        }

        return { success: true, message: 'Device revoked' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Revoke device error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to revoke device',
        });
      }
    }),

  /**
   * Rename a device
   */
  renameDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      name: z.string().min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { DeviceService } = await import('../../lib/services/device');
        const success = await DeviceService.renameDevice(ctx.user!.id, input.deviceId, input.name);

        if (!success) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Device not found',
          });
        }

        return { success: true, message: 'Device renamed' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Rename device error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to rename device',
        });
      }
    }),
});
