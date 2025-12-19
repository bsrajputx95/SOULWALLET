import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import * as bcrypt from 'bcryptjs';
import { PublicKey } from '@solana/web3.js';

export const userRouter = router({
  /**
   * Get current user profile
   */
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          include: {
            _count: {
              select: {
                followers: true,
                following: true,
                posts: true,
                vipSubscribers: {
                  where: { expiresAt: { gt: new Date() } },
                } as any,
              },
            },
          },
        })

        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
        }

        let copyTradersCount = 0
        if (user.walletAddress) {
          const traderProfile = await prisma.traderProfile.findUnique({
            where: { walletAddress: user.walletAddress },
            include: {
              _count: {
                select: {
                  copiers: { where: { isActive: true } },
                },
              },
            },
          })
          copyTradersCount = (traderProfile as any)?._count?.copiers || 0
        }

        const positions = await prisma.position.findMany({
          where: { copyTrading: { userId: ctx.user.id }, status: 'CLOSED', exitValue: { not: null } },
        })
        const totalInvested = positions.reduce((s, p: any) => s + (p.entryValue || 0), 0)
        const totalReturned = positions.reduce((s, p: any) => s + (p.exitValue || 0), 0)
        const roi = totalInvested > 0 ? Math.round((((totalReturned - totalInvested) / totalInvested) * 100) * 100) / 100 : 0

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          name: (user as any).name,
          walletAddress: user.walletAddress,
          walletVerifiedAt: (user as any).walletVerifiedAt,
          role: (user as any).role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          stats: {
            followersCount: (user as any)._count?.followers || 0,
            followingCount: (user as any)._count?.following || 0,
            vipFollowersCount: (user as any)._count?.vipSubscribers || 0,
            postsCount: (user as any)._count?.posts || 0,
            copyTradersCount,
            roi,
          },
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        logger.error('Get profile error:', error)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get profile' })
      }
    }),

  /**
   * Get user profile by username (public profile)
   */
  getProfileByUsername: protectedProcedure
    .input(z.object({
      username: z.string().min(1),
    }))
    .query(async ({ input }) => {
      try {
        const user = await prisma.user.findFirst({
          where: { username: input.username },
          include: {
            _count: {
              select: {
                followers: true,
                following: true,
                posts: true,
              },
            },
          },
        });

        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        return {
          id: user.id,
          username: user.username,
          name: (user as any).name,
          bio: (user as any).bio,
          profileImage: (user as any).profileImage,
          coverImage: (user as any).coverImage,
          walletAddress: user.walletAddress,
          isVerified: (user as any).isVerified || false,
          badge: (user as any).badge,
          followersCount: (user as any)._count?.followers || 0,
          followingCount: (user as any)._count?.following || 0,
          postsCount: (user as any)._count?.posts || 0,
          roi30d: (user as any).roi30d || 0,
          winRate: (user as any).winRate || 0,
          totalTrades: (user as any).totalTrades || 0,
          vipPrice: (user as any).vipPrice,
          createdAt: user.createdAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Get profile by username error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get profile' });
      }
    }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if username is already taken
        if (input.username) {
          const existingUser = await prisma.user.findFirst({
            where: {
              username: input.username,
              id: { not: ctx.user.id },
            },
          });

          if (existingUser) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Username already taken',
            });
          }
        }

        // Check if email is already taken
        if (input.email) {
          const existingUser = await prisma.user.findFirst({
            where: {
              email: input.email,
              id: { not: ctx.user.id },
            },
          });

          if (existingUser) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Email already in use',
            });
          }
        }

        const updatedUser = await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            ...(input.name && { name: input.name }),
            ...(input.username && { username: input.username }),
            ...(input.email && { email: input.email }),
          },
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            walletAddress: true,
            role: true,
            updatedAt: true,
          },
        });

        return updatedUser;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Update profile error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile',
        });
      }
    }),

  /**
   * Change password
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(8),
      newPassword: z.string().min(8).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get user with password
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(input.currentPassword, user.password);
        if (!isValidPassword) {
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
          data: { password: hashedPassword },
        });

        // Invalidate all sessions except current
        await prisma.session.deleteMany({
          where: {
            userId: ctx.user.id,
            id: { not: ctx.session?.id },
          },
        });

        return { success: true, message: 'Password changed successfully' };
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
   * Get user settings/preferences
   */
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Get or create user settings
        let settings = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
        });

        if (!settings) {
          // Create default settings
          settings = await prisma.userSettings.create({
            data: {
              userId: ctx.user.id,
              notifications: {
                push: true,
                email: true,
                transactions: true,
                marketing: false,
              },
              privacy: {
                showBalance: true,
                showTransactions: false,
                showPortfolio: false,
              },
              security: {
                twoFactorEnabled: false,
                biometricEnabled: false,
              },
              preferences: {
                currency: 'USD',
                language: 'en',
                theme: 'light',
              },
            },
          });
        }

        return settings;
      } catch (error) {
        logger.error('Get settings error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get settings',
        });
      }
    }),

  /**
   * Update user settings
   */
  updateSettings: protectedProcedure
    .input(z.object({
      notifications: z.object({
        push: z.boolean().optional(),
        email: z.boolean().optional(),
        transactions: z.boolean().optional(),
        marketing: z.boolean().optional(),
      }).optional(),
      privacy: z.object({
        showBalance: z.boolean().optional(),
        showTransactions: z.boolean().optional(),
        showPortfolio: z.boolean().optional(),
      }).optional(),
      security: z.object({
        twoFactorEnabled: z.boolean().optional(),
        biometricEnabled: z.boolean().optional(),
      }).optional(),
      preferences: z.object({
        currency: z.string().optional(),
        language: z.string().optional(),
        theme: z.enum(['light', 'dark', 'auto']).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get existing settings
        const existing = await prisma.userSettings.findUnique({
          where: { userId: ctx.user.id },
        });

        if (!existing) {
          // Create new settings with input
          const settings = await prisma.userSettings.create({
            data: {
              userId: ctx.user.id,
              notifications: input.notifications || {
                push: true,
                email: true,
                transactions: true,
                marketing: false,
              },
              privacy: input.privacy || {
                showBalance: true,
                showTransactions: false,
                showPortfolio: false,
              },
              security: input.security || {
                twoFactorEnabled: false,
                biometricEnabled: false,
              },
              preferences: input.preferences || {
                currency: 'USD',
                language: 'en',
                theme: 'light',
              },
            },
          });
          return settings;
        }

        // Merge with existing settings
        const updatedSettings = await prisma.userSettings.update({
          where: { userId: ctx.user.id },
          data: {
            notifications: {
              ...(existing.notifications as any),
              ...input.notifications,
            },
            privacy: {
              ...(existing.privacy as any),
              ...input.privacy,
            },
            security: {
              ...(existing.security as any),
              ...input.security,
            },
            preferences: {
              ...(existing.preferences as any),
              ...input.preferences,
            },
          },
        });

        return updatedSettings;
      } catch (error) {
        logger.error('Update settings error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update settings',
        });
      }
    }),

  /**
   * Register push notification token
   */
  registerPushToken: protectedProcedure
    .input(z.object({
      token: z.string(),
      platform: z.enum(['ios', 'android', 'web']),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Store or update push token
        await prisma.pushToken.upsert({
          where: {
            userId_platform: {
              userId: ctx.user.id,
              platform: input.platform,
            },
          },
          update: {
            token: input.token,
            active: true,
            updatedAt: new Date(),
          },
          create: {
            userId: ctx.user.id,
            token: input.token,
            platform: input.platform,
            active: true,
          },
        });

        return { success: true };
      } catch (error) {
        logger.error('Register push token error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to register push token',
        });
      }
    }),

  /**
   * Delete user account
   */
  deleteAccount: protectedProcedure
    .input(z.object({
      password: z.string(),
      confirmation: z.literal('DELETE'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get user with password
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(input.password, user.password);
        if (!isValidPassword) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid password',
          });
        }

        // Delete user and all related data (cascade)
        await prisma.user.delete({
          where: { id: ctx.user.id },
        });

        return { success: true, message: 'Account deleted successfully' };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Delete account error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete account',
        });
      }
    }),

  /**
   * Get user activity/audit log
   */
  getActivityLog: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const activities = await prisma.sessionActivity.findMany({
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
          select: {
            id: true,
            action: true,
            ipAddress: true,
            userAgent: true,
            metadata: true,
            suspicious: true,
            createdAt: true,
          },
        });

        const total = await prisma.sessionActivity.count({
          where: { userId: ctx.user.id },
        });

        return {
          activities,
          total,
          hasMore: (input.offset + input.limit) < total,
        };
      } catch (error) {
        logger.error('Get activity log error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get activity log',
        });
      }
    }),

  /**
   * Export user data (GDPR compliance)
   */
  exportData: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const userData = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          include: {
            sessions: true,
            transactions: true,
            contacts: true,
            notifications: true,
            portfolioSnapshots: true,
            sessionActivities: {
              take: 100,
              orderBy: { createdAt: 'desc' },
            },
            copyTrades: {
              include: {
                positions: true,
              },
            },
          },
        });

        if (!userData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Remove sensitive data
        const { password, ...safeUserData } = userData;

        return {
          exportDate: new Date().toISOString(),
          userData: safeUserData,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Export data error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to export user data',
        });
      }
    }),

  /**
   * Update user's wallet address (sync from client-side wallet)
   */
  updateWalletAddress: protectedProcedure
    .input(z.object({
      walletAddress: z.string().min(32).max(44).regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Solana address'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate Solana address format
        try {
          new PublicKey(input.walletAddress);
        } catch {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid Solana wallet address format',
          });
        }

        // Check if another user already has this wallet address
        const existingWallet = await prisma.user.findFirst({
          where: {
            walletAddress: input.walletAddress,
            id: { not: ctx.user.id },
          },
        });

        if (existingWallet) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This wallet address is already registered to another account',
          });
        }

        // Update user's wallet address
        const updatedUser = await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            walletAddress: input.walletAddress,
            // Don't set walletVerifiedAt yet - that requires signature verification
          },
          select: {
            id: true,
            username: true,
            email: true,
            walletAddress: true,
            walletVerifiedAt: true,
            isVerified: true,
          },
        });

        logger.info(`Wallet address updated for user ${ctx.user.id}: ${input.walletAddress}`);

        return {
          success: true,
          message: 'Wallet address updated successfully',
          user: updatedUser,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Update wallet address error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update wallet address',
        });
      }
    }),

  /**
   * Search for users by username
   */
  searchUsers: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(50),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      try {
        logger.info(`[searchUsers] Query: "${input.query}", Limit: ${input.limit}`);

        const users = await prisma.user.findMany({
          where: {
            OR: [
              { username: { contains: input.query, mode: 'insensitive' } },
              { name: { contains: input.query, mode: 'insensitive' } },
            ],
            // Include all users including current user
          },
          take: input.limit,
          select: {
            id: true,
            username: true,
            name: true,
            walletAddress: true,
            isVerified: true,
            createdAt: true,
            _count: {
              select: {
                followers: true,
                following: true,
              },
            },
          },
          orderBy: [
            { isVerified: 'desc' }, // Verified users first
            { username: 'asc' },
          ],
        });

        logger.info(`[searchUsers] Found ${users.length} users for query "${input.query}"`);

        return users.map(user => ({
          id: user.id,
          username: user.username,
          name: user.name,
          walletAddress: user.walletAddress,
          isVerified: user.isVerified,
          followersCount: (user as any)._count?.followers || 0,
          followingCount: (user as any)._count?.following || 0,
        }));
      } catch (error) {
        logger.error('Search users error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search users',
        });
      }
    }),
});
