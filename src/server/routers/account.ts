import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { TwoFactorService } from '../../lib/services/twoFactor';

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
      username: z.string().min(3).max(30).optional(),
      firstName: z.string().max(50).optional(),
      lastName: z.string().max(50).optional(),
      phone: z.string().max(20).optional(),
      dateOfBirth: z.string().optional(),
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

  /**
   * Setup TOTP 2FA - generates secret and QR code
   * Requires password verification before setup
   */
  setupTOTP: protectedProcedure
    .input(z.object({
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify password
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { password: true, email: true },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        const isValid = await bcrypt.compare(input.password, user.password);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password',
          });
        }

        // Generate TOTP setup data
        const setupData = await TwoFactorService.setupTOTP(user.email);

        // Store encrypted secret temporarily (not enabled yet)
        const existingSettings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
        });

        const currentSecurity = (existingSettings?.security as any) || {};
        const newSecurity = {
          ...currentSecurity,
          pendingTotpSecret: setupData.encryptedSecret,
          pendingBackupCodes: setupData.hashedBackupCodes,
        };

        await prisma.userSettings.upsert({
          where: { userId: ctx.user.id },
          update: { security: newSecurity },
          create: { userId: ctx.user.id, security: newSecurity },
        });

        return {
          success: true,
          qrCodeUrl: setupData.qrCodeUrl,
          backupCodes: setupData.backupCodes,
          message: 'Scan the QR code with your authenticator app',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Setup TOTP error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to setup 2FA',
        });
      }
    }),

  /**
   * Enable TOTP 2FA - verifies code and enables 2FA
   */
  enableTOTP: protectedProcedure
    .input(z.object({
      code: z.string().length(6),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get pending TOTP secret
        const settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
          select: { security: true },
        });

        const security = settings?.security as any;
        if (!security?.pendingTotpSecret) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No pending 2FA setup found. Please start setup again.',
          });
        }

        // Decrypt and verify the code
        const secret = TwoFactorService.decryptSecret(security.pendingTotpSecret);
        const isValid = TwoFactorService.verifyToken(secret, input.code);

        if (!isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid verification code. Please try again.',
          });
        }

        // Enable 2FA
        const newSecurity = {
          ...security,
          totpSecret: security.pendingTotpSecret,
          totpEnabled: true,
          totpEnabledAt: new Date().toISOString(),
          backupCodes: security.pendingBackupCodes,
          pendingTotpSecret: undefined,
          pendingBackupCodes: undefined,
          twoFactorEnabled: true,
        };

        await prisma.userSettings.update({
          where: { userId: ctx.user.id },
          data: { security: newSecurity },
        });

        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Enable TOTP error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to enable 2FA',
        });
      }
    }),

  /**
   * Disable TOTP 2FA - requires password and TOTP code
   */
  disableTOTP: protectedProcedure
    .input(z.object({
      password: z.string().min(1),
      code: z.string().length(6),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify password
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

        const isPasswordValid = await bcrypt.compare(input.password, user.password);
        if (!isPasswordValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password',
          });
        }

        // Get TOTP secret and verify code
        const settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
          select: { security: true },
        });

        const security = settings?.security as any;
        if (!security?.totpSecret || !security?.totpEnabled) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '2FA is not enabled',
          });
        }

        const secret = TwoFactorService.decryptSecret(security.totpSecret);
        const isCodeValid = TwoFactorService.verifyToken(secret, input.code);

        if (!isCodeValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid verification code',
          });
        }

        // Disable 2FA
        const newSecurity = {
          ...security,
          totpSecret: undefined,
          totpEnabled: false,
          totpEnabledAt: undefined,
          backupCodes: undefined,
          twoFactorEnabled: false,
        };

        await prisma.userSettings.update({
          where: { userId: ctx.user.id },
          data: { security: newSecurity },
        });

        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Disable TOTP error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to disable 2FA',
        });
      }
    }),

  /**
   * Verify TOTP code (for login or sensitive operations)
   */
  verifyTOTP: protectedProcedure
    .input(z.object({
      code: z.string().min(6).max(8), // 6 for TOTP, 8 for backup code
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
          select: { security: true },
        });

        const security = settings?.security as any;
        if (!security?.totpEnabled || !security?.totpSecret) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '2FA is not enabled',
          });
        }

        // Try TOTP code first
        if (input.code.length === 6) {
          const secret = TwoFactorService.decryptSecret(security.totpSecret);
          const isValid = TwoFactorService.verifyToken(secret, input.code);

          if (isValid) {
            return { success: true, method: 'totp' };
          }
        }

        // Try backup code
        if (security.backupCodes && security.backupCodes.length > 0) {
          const result = await TwoFactorService.verifyBackupCode(input.code, security.backupCodes);

          if (result.valid) {
            // Remove used backup code
            const newBackupCodes = [...security.backupCodes];
            newBackupCodes.splice(result.index, 1);

            await prisma.userSettings.update({
              where: { userId: ctx.user.id },
              data: {
                security: {
                  ...security,
                  backupCodes: newBackupCodes,
                },
              },
            });

            return {
              success: true,
              method: 'backup',
              remainingBackupCodes: newBackupCodes.length,
            };
          }
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid verification code',
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Verify TOTP error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify code',
        });
      }
    }),

  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes: protectedProcedure
    .input(z.object({
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify password
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

        const isValid = await bcrypt.compare(input.password, user.password);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password',
          });
        }

        // Check if 2FA is enabled
        const settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
          select: { security: true },
        });

        const security = settings?.security as any;
        if (!security?.totpEnabled) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '2FA must be enabled to regenerate backup codes',
          });
        }

        // Generate new backup codes
        const backupCodes = TwoFactorService.generateBackupCodes();
        const hashedBackupCodes = await Promise.all(
          backupCodes.map(code => TwoFactorService.hashBackupCode(code))
        );

        // Update backup codes
        await prisma.userSettings.update({
          where: { userId: ctx.user.id },
          data: {
            security: {
              ...security,
              backupCodes: hashedBackupCodes,
              backupCodesGeneratedAt: new Date().toISOString(),
            },
          },
        });

        return {
          success: true,
          codes: backupCodes,
          message: 'Save these codes securely. They can only be shown once.',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Regenerate backup codes error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to regenerate backup codes',
        });
      }
    }),
});
