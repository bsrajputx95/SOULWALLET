import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server'
import { SocialService } from '../../lib/services/social';
import { logger } from '../../lib/logger';
import { PostVisibility } from '@prisma/client';
import prisma from '../../lib/prisma'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { jupiterSwap } from '../../lib/services/jupiterSwap'

export const socialRouter = router({
  /**
   * Create a new post
   */
  createPost: protectedProcedure
    .input(z.object({
      content: z.string().min(1).max(2000),
      visibility: z.nativeEnum(PostVisibility),
      mentionedTokenName: z.string().optional(),
      mentionedTokenSymbol: z.string().optional(),
      mentionedTokenMint: z.string().optional(),
      images: z.array(z.string()).optional(),
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
            console.log(`Token ${input.mentionedTokenMint} not found in Jupiter, using user-provided name`)
          }
        } catch {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid token address format' })
        }
      }
      return await (SocialService as any).createPost(ctx.user.id, {
        content: input.content,
        visibility: input.visibility,
        mentionedTokenName: (input.mentionedTokenName || tokenInfo?.name) as any,
        mentionedTokenSymbol: (input.mentionedTokenSymbol || tokenInfo?.symbol) as any,
        mentionedTokenMint: input.mentionedTokenMint as any,
        images: input.images as any,
      })
    }),

  /**
   * Delete a post (owner only)
   */
  deletePost: protectedProcedure
    .input(z.object({
      postId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if post exists and belongs to user
      const post = await prisma.post.findUnique({
        where: { id: input.postId },
        select: { userId: true },
      });

      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }

      if (post.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own posts' });
      }

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
      feedType: z.enum(['all', 'following', 'vip', 'user']),
      targetUserId: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      tokenFilter: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await (SocialService as any).getFeed({
        userId: ctx.user.id,
        viewerId: ctx.user.id,
        feedType: input.feedType,
        targetUserId: (input.targetUserId || '') as any,
        limit: input.limit,
        cursor: (input.cursor || undefined) as any,
        tokenFilter: (input.tokenFilter || undefined) as any,
      });
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
        where: { id: ctx.user.id },
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

      return posts.map(post => ({
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
        where: { followerId: ctx.user.id },
        select: { followingId: true },
      });

      const followingIds = following.map(f => f.followingId);
      followingIds.push(ctx.user.id); // Exclude self

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
      const where: any = { userId: ctx.user.id };

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

  /**
   * Get user's draft posts (future feature)
   */
  getDrafts: protectedProcedure
    .query(async ({ ctx }) => {
      // Placeholder for draft posts feature
      return { drafts: [] };
    }),

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

  ibuyToken: protectedProcedure
    .input(z.object({
      postId: z.string(),
      tokenMint: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const post = await prisma.post.findUnique({
        where: { id: input.postId },
        include: { user: { select: { id: true, username: true, walletAddress: true } } },
      })
      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' })
      }
      if (post.mentionedTokenMint !== input.tokenMint) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token mismatch' })
      }
      const settings = await prisma.userSettings.findUnique({ where: { userId: ctx.user.id } })
      const amountUsd = (settings as any)?.preferences?.ibuyAmount || 10
      const slippage = (settings as any)?.preferences?.ibuySlippage || 1
      const me = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { walletAddress: true } })
      if (!me?.walletAddress) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No wallet connected' })
      }
      const quote = await jupiterSwap.getQuote({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: input.tokenMint,
        amount: Math.round(amountUsd * LAMPORTS_PER_SOL),
        slippageBps: Math.round(slippage * 100),
        asLegacyTransaction: false,
      })
      if (!quote) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get quote' })
      }
      const resp = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: me.walletAddress,
          wrapAndUnwrapSol: true,
          asLegacyTransaction: false,
          useSharedAccounts: true,
          dynamicComputeUnitLimit: true,
          skipUserAccountsRpcCalls: false,
        }),
      })
      if (!resp.ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get swap transaction' })
      }
      const swapData = (await resp.json()) as { swapTransaction?: string }
      if (!swapData?.swapTransaction) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get swap transaction' })
      }
      return { success: true, swapTransaction: swapData.swapTransaction }
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
  sellIBuyToken: protectedProcedure
    .input(z.object({
      purchaseId: z.string(),       // The iBuy purchase record to sell
      sellAmountUsdc: z.number(),   // USDC amount received from sell
      sellTxSig: z.string(),        // Sell transaction signature
    }))
    .mutation(async ({ ctx, input }) => {
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

        if (purchase.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your purchase' });
        }

        if (purchase.status !== 'OPEN') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already sold' });
        }

        // 2. Calculate profit
        const profit = input.sellAmountUsdc - purchase.priceInUsdc;

        // 3. Calculate 5% creator fee (only if profit > 0)
        let creatorFee = 0;
        let creatorFeeTxSig: string | null = null;

        if (profit > 0) {
          creatorFee = profit * 0.05; // 5% of profit

          // Only process fee if creator has wallet and fee is meaningful (> $0.01)
          const creatorWallet = purchase.post.user.walletAddress;
          if (creatorWallet && creatorFee >= 0.01) {
            // Log the fee - actual transfer would happen here via profitSharing service
            logger.info(
              `iBuy Creator Fee: $${creatorFee.toFixed(2)} (5% of $${profit.toFixed(2)} profit)\n` +
              `  From: ${ctx.user.id}\n` +
              `  To: @${purchase.post.user.username} (${creatorWallet})\n` +
              `  Token: ${purchase.tokenSymbol || purchase.tokenMint}`
            );

            // For now, mark as pending - actual SOL transfer can be added
            // creatorFeeTxSig = await profitSharing.sendFeeToCreator(...);
            creatorFeeTxSig = `pending_${Date.now()}`; // Placeholder for real tx
          }
        }

        // 4. Update purchase record
        const updatedPurchase = await prisma.iBuyPurchase.update({
          where: { id: input.purchaseId },
          data: {
            sellAmountUsdc: input.sellAmountUsdc,
            sellTxSig: input.sellTxSig,
            soldAt: new Date(),
            profitLoss: profit,
            creatorFee: creatorFee > 0 ? creatorFee : null,
            creatorFeeTxSig,
            status: creatorFeeTxSig ? 'FEE_PENDING' : 'SOLD',
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
