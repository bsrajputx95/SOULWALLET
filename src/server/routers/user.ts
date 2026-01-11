import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import * as bcrypt from 'bcryptjs';
import { PublicKey } from '@solana/web3.js';
// Comment 4: Import JSON schemas for validation
import { notificationsSchema, privacySchema, securitySchema, preferencesSchema } from '../../lib/schemas/user-settings';
// Comment 1: Import centralized validation limits for consistent username validation
import { VALIDATION_LIMITS } from '../../lib/validation';
import { gdprService } from '../../lib/services/gdpr'
import { kycService } from '../../lib/services/kyc'
import { auditLogService } from '../../lib/services/auditLog'

export const userRouter = router({
  /**
   * Get current user profile
   */
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user!.id },
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
          where: { copyTrading: { userId: ctx.user!.id }, status: 'CLOSED', exitValue: { not: null } },
        })
        const totalInvested = positions.reduce((sum: number, p: any) => sum + (p.entryValue || 0), 0)
        const totalReturned = positions.reduce((sum: number, p: any) => sum + (p.exitValue || 0), 0)
        const roi = totalInvested > 0 ? Math.round((((totalReturned - totalInvested) / totalInvested) * 100) * 100) / 100 : 0

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          name: (user as any).name,
          profileImage: user.profileImage,
          bio: user.bio,
          isVerified: user.isVerified,
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
    .query(async ({ ctx, input }) => {
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

        // Check if current user is following this user
        const isFollowing = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: ctx.user!.id,
              followingId: user.id,
            },
          },
        });

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
          isFollowing: !!isFollowing,
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
      // Comment 1: Use centralized VALIDATION_LIMITS for username (50 chars max)
      username: z.string()
        .min(VALIDATION_LIMITS.USERNAME_MIN)
        .max(VALIDATION_LIMITS.USERNAME_MAX)
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
        .optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if username is already taken
        if (input.username) {
          const existingUser = await prisma.user.findFirst({
            where: {
              username: input.username,
              id: { not: ctx.user!.id },
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
              id: { not: ctx.user!.id },
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
          where: { id: ctx.user!.id },
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
          where: { id: ctx.user!.id },
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
          where: { id: ctx.user!.id },
          data: { password: hashedPassword },
        });

        // Invalidate all sessions except current
        await prisma.session.deleteMany({
          where: {
            userId: ctx.user!.id,
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
          where: { userId: ctx.user!.id },
        });

        if (!settings) {
          // Create default settings
          settings = await prisma.userSettings.create({
            data: {
              userId: ctx.user!.id,
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
      preferences: preferencesSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Comment 4: Validate input against JSON schemas before persisting
        if (input.notifications) {
          const result = notificationsSchema.safeParse(input.notifications);
          if (!result.success) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Invalid notifications format: ${result.error.message}`,
            });
          }
        }
        if (input.privacy) {
          const result = privacySchema.safeParse(input.privacy);
          if (!result.success) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Invalid privacy format: ${result.error.message}`,
            });
          }
        }
        if (input.security) {
          const result = securitySchema.safeParse(input.security);
          if (!result.success) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Invalid security format: ${result.error.message}`,
            });
          }
        }
        if (input.preferences) {
          const result = preferencesSchema.safeParse(input.preferences);
          if (!result.success) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Invalid preferences format: ${result.error.message}`,
            });
          }
        }

        // Get existing settings
        const existing = await prisma.userSettings.findUnique({
          where: { userId: ctx.user!.id },
        });

        if (!existing) {
          // Create new settings with input
          const settings = await prisma.userSettings.create({
            data: {
              userId: ctx.user!.id,
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
          where: { userId: ctx.user!.id },
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
              userId: ctx.user!.id,
              platform: input.platform,
            },
          },
          update: {
            token: input.token,
            active: true,
            updatedAt: new Date(),
          },
          create: {
            userId: ctx.user!.id,
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
          where: { id: ctx.user!.id },
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
          where: { id: ctx.user!.id },
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
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const where = { userId: ctx.user!.id } as const
        const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }] as const

        let activities: Awaited<ReturnType<typeof prisma.sessionActivity.findMany>> = []
        let nextCursor: string | undefined

        if (input.cursor) {
          activities = await prisma.sessionActivity.findMany({
            where,
            orderBy,
            take: input.limit + 1,
            cursor: { id: input.cursor },
            skip: 1,
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

          if (activities.length > input.limit) {
            const next = activities.pop()
            nextCursor = next?.id
          }
        } else {
          activities = await prisma.sessionActivity.findMany({
            where,
            orderBy,
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
        }

        const total = await prisma.sessionActivity.count({
          where,
        });

        return {
          activities,
          total,
          hasMore: input.cursor ? Boolean(nextCursor) : (input.offset + input.limit) < total,
          nextCursor,
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
          where: { id: ctx.user!.id },
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

  requestDataExport: protectedProcedure
    .input(
      z.object({
        format: z.enum(['JSON', 'CSV']).default('JSON'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const requestId = await gdprService.requestDataExport(ctx.user!.id, input.format)
      return { success: true, requestId }
    }),

  listDataExportRequests: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = { userId: ctx.user!.id } as const
      const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }] as const

      let requests: Awaited<ReturnType<typeof prisma.dataExportRequest.findMany>> = []
      let nextCursor: string | undefined

      if (input.cursor) {
        requests = await prisma.dataExportRequest.findMany({
          where,
          orderBy,
          take: input.limit + 1,
          cursor: { id: input.cursor },
          skip: 1,
        })

        if (requests.length > input.limit) {
          const next = requests.pop()
          nextCursor = next?.id
        }
      } else {
        requests = await prisma.dataExportRequest.findMany({
          where,
          orderBy,
          take: input.limit,
          skip: input.offset,
        })
      }

      const total = await prisma.dataExportRequest.count({ where })
      return {
        requests,
        total,
        hasMore: input.cursor ? Boolean(nextCursor) : input.offset + input.limit < total,
        nextCursor,
      }
    }),

  requestDataDeletion: protectedProcedure
    .input(z.object({ reason: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const ipAddress = ctx.rateLimitContext.ip
      const requestId = await gdprService.requestDataDeletion(
        ctx.user!.id,
        input.reason,
        ipAddress,
        ctx.fingerprint?.userAgent
      )
      return { success: true, requestId }
    }),

  getFinancialAuditLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        cursor: z.string().optional(),
        operation: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { logs, total, nextCursor } = await auditLogService.getUserAuditLogs(ctx.user!.id, {
        limit: input.limit,
        offset: input.offset,
        cursor: input.cursor,
        ...(input.operation ? { operation: input.operation } : {}),
      })

      return {
        success: true,
        logs,
        total,
        hasMore: input.cursor ? Boolean(nextCursor) : input.offset + input.limit < total,
        nextCursor,
      }
    }),

  verifyFinancialAuditLogIntegrity: protectedProcedure.query(async ({ ctx }) => {
    const result = await auditLogService.verifyAuditLogIntegrity(ctx.user!.id)
    return { success: true, ...result }
  }),

  submitKYC: protectedProcedure
    .input(z.object({ data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const verificationId = await kycService.submitKYCVerification(ctx.user!.id, input.data)
      return { success: true, verificationId }
    }),

  getKYCStatus: protectedProcedure.query(async ({ ctx }) => {
    const status = await kycService.getKYCStatus(ctx.user!.id)
    return { success: true, status }
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
        const existingUser = await prisma.user.findUnique({
          where: { id: ctx.user!.id },
          select: { walletAddress: true },
        })

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
            id: { not: ctx.user!.id },
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
          where: { id: ctx.user!.id },
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

        logger.info(`Wallet address updated for user ${ctx.user!.id}: ${input.walletAddress}`);

        const { AuthService } = await import('../../lib/services/auth')
        await AuthService.invalidateUserCache(ctx.user!.id)

        const { birdeyeData } = await import('../../lib/services/birdeyeData')
        if (existingUser?.walletAddress) {
          birdeyeData.clearCache(existingUser.walletAddress)
        }
        birdeyeData.clearCache(input.walletAddress)

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

        return users.map((user: any) => ({
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

  /**
   * Get user's iBuy settings (buy amount, slippage, inputCurrency)
   */
  getIBuySettings: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const settings = await prisma.iBuySettings.findUnique({
          where: { userId: ctx.user!.id },
        });

        // Return defaults if no settings exist
        return {
          buyAmount: settings?.buyAmount ?? 10,
          slippage: settings?.slippage ?? 0.5,
          inputCurrency: (settings?.inputCurrency as 'SOL' | 'USDC') ?? 'SOL',
        };
      } catch (error) {
        logger.error('Get iBuy settings error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get iBuy settings',
        });
      }
    }),

  /**
   * Update user's iBuy settings
   */
  updateIBuySettings: protectedProcedure
    .input(z.object({
      buyAmount: z.number().positive().max(10000).optional(),
      slippage: z.number().min(0.1).max(5).optional(),
      inputCurrency: z.enum(['SOL', 'USDC']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const settings = await prisma.iBuySettings.upsert({
          where: { userId: ctx.user!.id },
          create: {
            userId: ctx.user!.id,
            buyAmount: input.buyAmount ?? 10,
            slippage: Math.min(input.slippage ?? 0.5, 5),
            inputCurrency: input.inputCurrency ?? 'SOL',
          },
          update: {
            ...(input.buyAmount !== undefined && { buyAmount: input.buyAmount }),
            ...(input.slippage !== undefined && { slippage: Math.min(input.slippage, 5) }),
            ...(input.inputCurrency !== undefined && { inputCurrency: input.inputCurrency }),
          },
        });

        return {
          buyAmount: settings.buyAmount,
          slippage: settings.slippage,
          inputCurrency: settings.inputCurrency as 'SOL' | 'USDC',
        };
      } catch (error) {
        logger.error('Update iBuy settings error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update iBuy settings',
        });
      }
    }),
});
