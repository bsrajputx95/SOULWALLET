import { z } from 'zod';
import { router, protectedProcedure, publicProcedure, createOwnershipProcedure } from '../trpc';
import { TRPCError } from '@trpc/server'
import { SocialService, CreatePostInput, FeedOptions } from '../../lib/services/social';
import { logger } from '../../lib/logger';
import { PostVisibility } from '@prisma/client';
import prisma from '../../lib/prisma'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { jupiterSwap } from '../../lib/services/jupiterSwap'
import { profitSharing } from '../../lib/services/profitSharing'
import { applyRateLimit } from '../../lib/middleware/rateLimit';
import { MAX_SLIPPAGE_BPS, VALIDATION_LIMITS } from '../../lib/validation';

export const socialRouter = router({
  /**
   * Create a new post
   */
  createPost: protectedProcedure
    .input(z.object({
      content: z.string().min(1).max(VALIDATION_LIMITS.POST_CONTENT_MAX),
      visibility: z.nativeEnum(PostVisibility),
      mentionedTokenName: z.string().optional(),
      mentionedTokenSymbol: z.string().optional(),
      mentionedTokenMint: z.string().optional(),
      // Plan2 Step 5: Validate images array (max 4 URLs)
      images: z.array(z.string().url()).max(VALIDATION_LIMITS.IMAGES_PER_POST_MAX).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let tokenInfo: { symbol?: string; name?: string } | null = null
      if (input.mentionedTokenMint) {
        try {
          // Just validate address format
          new PublicKey(input.mentionedTokenMint)
          // Try to get token info from Jupiter, but don't fail if not found
          try {
            const info = await jupiterSwap.getTokenInfo(input.mentionedTokenMint)
            if (info) {
              tokenInfo = { symbol: info.symbol, name: info.name }
            }
          } catch {
            // Token not in Jupiter - that's OK, use user-provided name
            logger.debug(`Token ${input.mentionedTokenMint} not found in Jupiter, using user-provided name`)
          }
        } catch {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid token address format' })
        }
      }

      const postInput: CreatePostInput = {
        content: input.content,
        visibility: input.visibility,
        mentionedTokenName: input.mentionedTokenName || tokenInfo?.name,
        mentionedTokenSymbol: input.mentionedTokenSymbol || tokenInfo?.symbol,
        mentionedTokenMint: input.mentionedTokenMint,
        images: input.images,
      };

      return await SocialService.createPost(ctx.user.id, postInput);
    }),

  /**
   * Delete a post (owner only)
   */
  deletePost: createOwnershipProcedure('Post', 'postId')
    .input(z.object({
      postId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await prisma.post.delete({
        where: { id: input.postId },
      });

      return { success: true };
    }),

  /**
   * Get feed posts
   */
  getFeed: protectedProcedure
    .input(z.object({
      feedType: z.enum(['all', 'following', 'vip', 'user', 'forYou']),
      targetUserId: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      tokenFilter: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const feedOptions: FeedOptions = {
        userId: ctx.user.id,
        viewerId: ctx.user.id,
        feedType: input.feedType,
        targetUserId: input.targetUserId,
        limit: input.limit,
        cursor: input.cursor,
        tokenFilter: input.tokenFilter,
      };

      return await SocialService.getFeed(feedOptions);
    }),

  /**
   * Get a single post
   */
  getPost: publicProcedure
    .input(z.object({
      postId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const post = await prisma.post.findUnique({
        where: { id: input.postId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profileImage: true,
              isVerified: true,
              badge: true,
              followersCount: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
      });

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      }

      // Check if viewer has liked/reposted/voted (if authenticated)
      let isLiked = false;
      let isReposted = false;
      let userVote: boolean | null = null; // true=agree, false=disagree, null=not voted

      if (ctx.user) {
        const [like, repost, vote] = await Promise.all([
          prisma.postLike.findUnique({
            where: {
              userId_postId: {
                userId: ctx.user.id,
                postId: input.postId,
              },
            },
          }),
          prisma.repost.findUnique({
            where: {
              userId_postId: {
                userId: ctx.user.id,
                postId: input.postId,
              },
            },
          }),
          prisma.postVote.findUnique({
            where: {
              userId_postId: {
                userId: ctx.user.id,
                postId: input.postId,
              },
            },
          }),
        ]);

        isLiked = !!like;
        isReposted = !!repost;
        userVote = vote ? vote.vote : null;
      }

      // Calculate vote percentage
      const totalVotes = post.agreeCount + post.disagreeCount;
      const agreePercentage = totalVotes > 0
        ? Math.round((post.agreeCount / totalVotes) * 100)
        : 0;

      return {
        ...post,
        isLiked,
        isReposted,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        repostsCount: post._count.reposts,
        agreeCount: post.agreeCount,
        disagreeCount: post.disagreeCount,
        agreePercentage,
        userVote, // null if not voted, true if agree, false if disagree
        _count: undefined,
      };
    }),

  /**
   * Like or unlike a post
   */
  toggleLike: protectedProcedure
    .input(z.object({
      postId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await SocialService.toggleLike(ctx.user.id, input.postId);
    }),

  /**
   * Create a comment
   */
  createComment: protectedProcedure
    .input(z.object({
      postId: z.string(),
      content: z.string().min(1).max(500),
      parentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await SocialService.createComment(ctx.user.id, input);
    }),

  /**
   * Get comments for a post
   */
  getComments: publicProcedure
    .input(z.object({
      postId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const where: any = {
        postId: input.postId,
        parentId: null, // Only top-level comments
      };

      if (input.cursor) {
        where.createdAt = { lt: new Date(input.cursor) };
      }

      const comments = await prisma.postComment.findMany({
        where,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profileImage: true,
              isVerified: true,
              badge: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      });

      return {
        comments,
        nextCursor: comments.length === input.limit
          ? comments[comments.length - 1]?.createdAt?.toISOString() || null
          : null,
      }
    }),

  /**
   * Get replies to a comment
   */
  getCommentReplies: publicProcedure
    .input(z.object({
      commentId: z.string(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const replies = await prisma.postComment.findMany({
        where: { parentId: input.commentId },
        take: input.limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profileImage: true,
              isVerified: true,
              badge: true,
            },
          },
        },
      });

      return replies;
    }),

  /**
   * Repost a post
   */
  createRepost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      comment: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await SocialService.createRepost(
        ctx.user.id,
        input.postId,
        input.comment
      );
    }),

  /**
   * Delete a repost
   */
  deleteRepost: protectedProcedure
    .input(z.object({
      postId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const repost = await prisma.repost.findUnique({
        where: {
          userId_postId: {
            userId: ctx.user.id,
            postId: input.postId,
          },
        },
      });

      if (!repost) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Repost not found',
        });
      }

      await prisma.$transaction([
        prisma.repost.delete({
          where: { id: repost.id },
        }),
        prisma.post.update({
          where: { id: input.postId },
          data: { repostsCount: { decrement: 1 } },
        }),
      ]);

      return { success: true };
    }),

  /**
   * Follow or unfollow a user by userId
   */
  toggleFollow: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await SocialService.toggleFollow(ctx.user.id, input.userId);
    }),

  /**
   * Follow or unfollow a user by username (useful when profile not loaded)
   */
  toggleFollowByUsername: protectedProcedure
    .input(z.object({
      username: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find user by username first
      const userToFollow = await prisma.user.findFirst({
        where: { username: input.username },
        select: { id: true },
      });

      if (!userToFollow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return await SocialService.toggleFollow(ctx.user.id, userToFollow.id);
    }),

  /**
   * Get followers list
   */
  getFollowers: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const where: any = { followingId: input.userId };

      if (input.cursor) {
        where.createdAt = { lt: new Date(input.cursor) };
      }

      const followers = await prisma.follow.findMany({
        where,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              name: true,
              profileImage: true,
              isVerified: true,
              badge: true,
              followersCount: true,
            },
          },
        },
      });

      return {
        followers: followers.map(f => f.follower),
        nextCursor: followers.length === input.limit
          ? followers[followers.length - 1]?.createdAt?.toISOString() || null
          : null,
      }
    }),

  /**
   * Get following list
   */
  getFollowing: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const where: any = { followerId: input.userId };

      if (input.cursor) {
        where.createdAt = { lt: new Date(input.cursor) };
      }

      const following = await prisma.follow.findMany({
        where,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              name: true,
              profileImage: true,
              isVerified: true,
              badge: true,
              followersCount: true,
            },
          },
        },
      });

      return {
        following: following.map(f => f.following),
        nextCursor: following.length === input.limit
          ? following[following.length - 1]?.createdAt?.toISOString() || null
          : null,
      }
    }),

  /**
   * Subscribe to VIP content
   */
  subscribeToVIP: protectedProcedure
    .input(z.object({
      creatorId: z.string(),
      transactionSignature: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await SocialService.subscribeToVIP(
        ctx.user.id,
        input.creatorId,
        input.transactionSignature
      );
    }),

  /**
   * Get VIP subscription status
   */
  getVIPStatus: protectedProcedure
    .input(z.object({
      creatorId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const subscription = await prisma.vIPSubscription.findUnique({
        where: {
          subscriberId_creatorId: {
            subscriberId: ctx.user.id,
            creatorId: input.creatorId,
          },
        },
      });

      return {
        isSubscribed: subscription && subscription.expiresAt > new Date(),
        subscription,
      };
    }),

  /**
   * Get user profile
   */
  getUserProfile: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return await SocialService.getUserProfile(
        input.userId,
        ctx.user?.id
      );
    }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(z.object({
      bio: z.string().max(500).optional(),
      profileImage: z.string().url().optional(),
      coverImage: z.string().url().optional(),
      vipPrice: z.number().min(0).optional(),
      vipDescription: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.user.update({
        where: { id: ctx.user!.id },
        data: input as any,
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          profileImage: true,
          coverImage: true,
          vipPrice: true,
          vipDescription: true,
        },
      });

      return updated;
    }),

  /**
   * Search users
   */
  searchUsers: publicProcedure
    .input(z.object({
      query: z.string().min(1).max(50), // Add max length
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      // Sanitize input
      const sanitizedQuery = input.query
        .replace(/[%_]/g, '\\$&') // Escape SQL wildcards
        .trim();

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: sanitizedQuery } }, // Remove mode: 'insensitive' for SQLite
            { name: { contains: sanitizedQuery } },
          ],
        },
        take: Math.min(input.limit, 20), // Cap at 20
        select: {
          id: true,
          username: true,
          name: true,
          profileImage: true,
          isVerified: true,
          badge: true,
          followersCount: true,
        },
      });

      return users;
    }),

  /**
   * Get trending posts
   */
  getTrending: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      period: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
    }))
    .query(async ({ input }) => {
      // Calculate time threshold
      const now = new Date();
      const threshold = new Date();

      switch (input.period) {
        case '1h':
          threshold.setHours(now.getHours() - 1);
          break;
        case '24h':
          threshold.setDate(now.getDate() - 1);
          break;
        case '7d':
          threshold.setDate(now.getDate() - 7);
          break;
        case '30d':
          threshold.setDate(now.getDate() - 30);
          break;
      }

      const posts = await prisma.post.findMany({
        where: {
          visibility: 'PUBLIC',
          createdAt: { gte: threshold },
        },
        orderBy: [
          { likesCount: 'desc' },
          { commentsCount: 'desc' },
          { repostsCount: 'desc' },
        ],
        take: input.limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profileImage: true,
              isVerified: true,
              badge: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
      });

      return posts.map((post: any) => ({
        ...post,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        repostsCount: post._count.reposts,
        _count: undefined,
      }));
    }),

  /**
   * Get suggested users to follow
   */
  getSuggestedUsers: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(10).default(5),
    }))
    .query(async ({ ctx, input }) => {
      // Get users the current user is not following
      const following = await prisma.follow.findMany({
        where: { followerId: ctx.user!.id },
        select: { followingId: true },
      });

      const followingIds = following.map((f: any) => f.followingId);
      followingIds.push(ctx.user!.id); // Exclude self

      const suggestedUsers = await prisma.user.findMany({
        where: {
          id: { notIn: followingIds },
          isVerified: true, // Prioritize verified users
        },
        orderBy: [
          { followersCount: 'desc' },
          { roi30d: 'desc' },
        ],
        take: input.limit,
        select: {
          id: true,
          username: true,
          name: true,
          profileImage: true,
          isVerified: true,
          badge: true,
          followersCount: true,
          roi30d: true,
        },
      });

      return suggestedUsers;
    }),

  /**
   * Get notifications
   */
  getNotifications: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      type: z.enum(['all', 'social', 'trading']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { userId: ctx.user!.id };

      if (input.type === 'social') {
        where.type = 'SOCIAL';
      } else if (input.type === 'trading') {
        where.type = { in: ['TRANSACTION', 'COPY_TRADE'] };
      }

      if (input.cursor) {
        where.createdAt = { lt: new Date(input.cursor) };
      }

      const notifications = await prisma.notification.findMany({
        where,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      });

      return {
        notifications,
        nextCursor: notifications.length === input.limit
          ? notifications[notifications.length - 1]?.createdAt?.toISOString() || null
          : null,
      }
    }),


  /**
   * Report a post
   */
  reportPost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      reason: z.enum(['spam', 'abuse', 'inappropriate', 'other']),
      details: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // In production, this would create a report for moderation
      logger.info('Post reported', {
        postId: input.postId,
        reporterId: ctx.user.id,
        reason: input.reason,
        details: input.details,
      });

      return { success: true, message: 'Post reported successfully' };
    }),

  // Note: getDrafts placeholder removed - feature not implemented (Audit Issue #16)

  /**
   * Update trading stats (admin/system only)
   */
  updateTradingStats: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      await SocialService.updateTradingStats(input.userId);
      return { success: true };
    }),

  /**
   * iBuy Token - Queue swap for execution with priority processing
   * Uses custodial wallet with Jito MEV protection for trades >= $50
   * Returns jobId for status polling
   */
  ibuyToken: protectedProcedure
    .input(z.object({
      postId: z.string(),
      tokenMint: z.string(),
      inputMint: z.string().optional(), // SOL or USDC - default from settings
    }))
    .mutation(async ({ ctx, input }) => {
      // Apply rate limiting to swap operations
      await applyRateLimit('swapExecute', ctx.rateLimitContext);

      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

      // Get user's custodial wallet for execution
      const { custodialWalletService } = await import('../../lib/services/custodialWallet');
      const userWallet = await custodialWalletService.getKeypair(ctx.user.id);
      if (!userWallet) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No custodial wallet found' });
      }

      // Get post and validate token
      const post = await prisma.post.findUnique({
        where: { id: input.postId },
        include: { user: { select: { id: true, username: true, walletAddress: true } } },
      });
      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }
      if (post.mentionedTokenMint !== input.tokenMint) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token mismatch' });
      }

      // Get user iBuy settings (includes inputCurrency)
      const ibuySettings = await prisma.iBuySettings.findUnique({ where: { userId: ctx.user.id } });
      const amountUsd = ibuySettings?.buyAmount || 10;
      const slippage = ibuySettings?.slippage || 1;
      const settingsInputCurrency = ibuySettings?.inputCurrency || 'SOL';

      // Use input.inputMint if provided, otherwise use settings
      const inputMint = input.inputMint || (settingsInputCurrency === 'USDC' ? USDC_MINT : SOL_MINT);
      const isSolInput = inputMint === SOL_MINT;

      // Validate amount
      const validation = custodialWalletService.validateCopyTradeBudget(amountUsd, amountUsd);
      if (!validation.valid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: validation.error || 'Invalid swap amount' });
      }

      // Check balance before queueing (fail fast)
      if (isSolInput) {
        const balance = await custodialWalletService.getBalance(ctx.user.id);
        const requiredSol = amountUsd / 100; // Rough USD to SOL estimate
        if (balance < requiredSol) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Insufficient SOL balance. Have: ${balance.toFixed(4)} SOL, Need: ~${requiredSol.toFixed(4)} SOL`
          });
        }
      } else {
        // USDC balance check
        const usdcBalance = await custodialWalletService.getTokenBalance(ctx.user.id, USDC_MINT);
        if (usdcBalance < amountUsd) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Insufficient USDC balance. Have: ${usdcBalance.toFixed(2)} USDC, Need: ${amountUsd.toFixed(2)} USDC`
          });
        }
      }

      // Queue the order for execution with high priority
      const { executionQueue } = await import('../../lib/services/executionQueue');
      const jobId = await executionQueue.addIBuyOrder({
        userId: ctx.user.id,
        postId: input.postId,
        tokenMint: input.tokenMint,
        inputMint,
        amountUsd,
        slippageBps: Math.min(Math.round(slippage * 100), MAX_SLIPPAGE_BPS),
      }, { priority: 3 }); // High priority for iBuy

      logger.info(`[iBuy] Order queued: jobId=${jobId}, user=${ctx.user.id}, token=${input.tokenMint.slice(0, 8)}...`);

      return {
        success: true,
        jobId,
        amountUsd,
      };
    }),

  /**
   * Get iBuy job status for polling
   */
  getIBuyJobStatus: protectedProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { executionQueue } = await import('../../lib/services/executionQueue');
      const status = await executionQueue.getIBuyJobStatus(input.jobId);
      return status;
    }),

  /**
   * Vote on a post (agree/disagree) - one vote per user per post
   */
  voteOnPost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      vote: z.boolean(), // true = agree, false = disagree
    }))
    .mutation(async ({ ctx, input }) => {
      // Audit Issue #5: Apply rate limiting to voting
      await applyRateLimit('general', ctx.rateLimitContext);

      try {
        // Check if user already voted
        const existingVote = await prisma.postVote.findUnique({
          where: {
            userId_postId: {
              userId: ctx.user.id,
              postId: input.postId,
            },
          },
        });

        if (existingVote) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'You have already voted on this post',
          });
        }

        // Create vote and update counts atomically
        await prisma.$transaction([
          prisma.postVote.create({
            data: {
              userId: ctx.user.id,
              postId: input.postId,
              vote: input.vote,
            },
          }),
          prisma.post.update({
            where: { id: input.postId },
            data: input.vote
              ? { agreeCount: { increment: 1 } }
              : { disagreeCount: { increment: 1 } },
          }),
        ]);

        // Get updated counts
        const post = await prisma.post.findUnique({
          where: { id: input.postId },
          select: { agreeCount: true, disagreeCount: true },
        });

        const total = (post?.agreeCount || 0) + (post?.disagreeCount || 0);
        const agreePercentage = total > 0
          ? Math.round(((post?.agreeCount || 0) / total) * 100)
          : 0;

        return {
          success: true,
          agreeCount: post?.agreeCount || 0,
          disagreeCount: post?.disagreeCount || 0,
          agreePercentage,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Vote on post error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to vote on post',
        });
      }
    }),

  /**
   * Get user's iBuy purchases
   */
  getIBuyPurchases: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const purchases = await prisma.iBuyPurchase.findMany({
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
          include: {
            post: {
              select: {
                id: true,
                content: true,
                mentionedTokenSymbol: true,
              },
            },
          },
        });

        return purchases.map(p => ({
          id: p.id,
          tokenMint: p.tokenMint,
          tokenSymbol: p.tokenSymbol,
          tokenName: p.tokenName,
          amountBought: p.amountBought,
          amountRemaining: p.amountRemaining,
          priceInUsdc: p.priceInUsdc,
          buyTxSig: p.buyTxSig,
          status: p.status,
          createdAt: p.createdAt,
          postId: p.postId,
        }));
      } catch (error) {
        logger.error('Get iBuy purchases error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get iBuy purchases',
        });
      }
    }),

  /**
   * Record a completed iBuy purchase (called after successful swap)
   */
  recordIBuyPurchase: protectedProcedure
    .input(z.object({
      postId: z.string(),
      tokenMint: z.string(),
      tokenSymbol: z.string().optional(),
      tokenName: z.string().optional(),
      amountBought: z.number(),
      priceInUsdc: z.number(),
      transactionSig: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const purchase = await prisma.iBuyPurchase.create({
          data: {
            userId: ctx.user.id,
            postId: input.postId,
            tokenMint: input.tokenMint,
            tokenSymbol: input.tokenSymbol,
            tokenName: input.tokenName,
            amountBought: input.amountBought,
            amountRemaining: input.amountBought,
            priceInUsdc: input.priceInUsdc,
            buyTxSig: input.transactionSig,
          },
        });

        return { success: true, purchaseId: purchase.id };
      } catch (error) {
        logger.error('Record iBuy purchase error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record iBuy purchase',
        });
      }
    }),

  /**
   * Sell an iBuy token and process 5% creator profit share
   * Simple flow: user sells token, if profit > 0, 5% goes to post creator
   */
  sellIBuyToken: createOwnershipProcedure('IBuyPurchase', 'purchaseId')
    .input(z.object({
      purchaseId: z.string(),       // The iBuy purchase record to sell
      sellAmountUsdc: z.number(),   // USDC amount received from sell
      sellTxSig: z.string(),        // Sell transaction signature
      amountSoldTokens: z.number(), // Token amount sold from this lot
    }))
    .mutation(async ({ ctx, input }) => {
      // Audit Issue #5: Apply rate limiting to swap operations
      await applyRateLimit('swapExecute', ctx.rateLimitContext);

      try {
        // 1. Get purchase with post creator info
        const purchase = await prisma.iBuyPurchase.findUnique({
          where: { id: input.purchaseId },
          include: {
            post: {
              include: {
                user: { select: { id: true, username: true, walletAddress: true } }
              }
            }
          },
        });

        if (!purchase) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
        }

        if (purchase.status !== 'OPEN') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already sold' });
        }

        const remaining = purchase.amountRemaining > 0 ? purchase.amountRemaining : purchase.amountBought
        if (remaining <= 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No remaining tokens to sell' });
        }

        const amountSoldTokens = Math.min(input.amountSoldTokens, remaining)
        if (amountSoldTokens <= 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sell amount too small' });
        }

        const soldRatio = purchase.amountBought > 0 ? amountSoldTokens / purchase.amountBought : 0
        const costBasisSold = purchase.priceInUsdc * soldRatio
        const profit = input.sellAmountUsdc - costBasisSold;

        // 3. Calculate 5% creator fee (only if profit > 0)
        let creatorFee = 0;
        let creatorFeeTxSig: string | null = null;

        if (profit > 0) {
          creatorFee = profit * 0.05; // 5% of profit

          // Only process fee if creator has wallet and fee is meaningful (> $0.01)
          const creatorWallet = purchase.post.user.walletAddress;
          if (creatorWallet && creatorFee >= 0.01) {
            // Send real fee to creator wallet
            creatorFeeTxSig = await profitSharing.sendIBuyCreatorFee({
              fromUserId: ctx.user.id,
              creatorWallet,
              feeAmountUsdc: creatorFee,
              purchaseId: input.purchaseId,
              creatorUsername: purchase.post.user.username,
            });
          }
        }

        const nextRemainingRaw = remaining - amountSoldTokens
        const nextRemaining = nextRemainingRaw < 1e-9 ? 0 : nextRemainingRaw
        const shouldClose = nextRemaining === 0

        const nextSellAmountUsdc = (purchase.sellAmountUsdc ?? 0) + input.sellAmountUsdc
        const nextProfitLoss = (purchase.profitLoss ?? 0) + profit
        const nextCreatorFeeTotal = (purchase.creatorFee ?? 0) + (creatorFee > 0 ? creatorFee : 0)

        // 4. Update purchase record
        const updatedPurchase = await prisma.iBuyPurchase.update({
          where: { id: input.purchaseId },
          data: {
            amountRemaining: nextRemaining,
            sellAmountUsdc: nextSellAmountUsdc,
            sellTxSig: input.sellTxSig,
            ...(shouldClose && { soldAt: new Date() }),
            profitLoss: nextProfitLoss,
            creatorFee: nextCreatorFeeTotal > 0 ? nextCreatorFeeTotal : null,
            creatorFeeTxSig: creatorFeeTxSig ?? purchase.creatorFeeTxSig,
            status: shouldClose ? (creatorFeeTxSig ? 'FEE_PENDING' : 'SOLD') : 'OPEN',
          },
        });

        logger.info(`iBuy sell recorded: ${input.purchaseId}, profit: $${profit.toFixed(2)}`);

        return {
          success: true,
          profit,
          creatorFee: creatorFee > 0 ? creatorFee : 0,
          creatorUsername: purchase.post.user.username,
          status: updatedPurchase.status,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error('Sell iBuy token error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process sell',
        });
      }
    }),
});
