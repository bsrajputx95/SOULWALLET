import { TRPCError } from '@trpc/server';
import prisma from '../prisma';
import { logger } from '../logger';
import { paymentVerificationService } from './payment-verification';
import type { PostVisibility, Prisma } from '@prisma/client';
import DOMPurify from 'isomorphic-dompurify';

export interface CreatePostInput {
  content: string;
  visibility: PostVisibility;
  mentionedTokenName?: string;
  mentionedTokenSymbol?: string;
  mentionedTokenMint?: string;
  images?: string[];
}

export interface UpdatePostInput {
  postId: string;
  content?: string;
  visibility?: PostVisibility;
}

export interface CreateCommentInput {
  postId: string;
  content: string;
  parentId?: string;
}

export interface FeedOptions {
  userId: string;
  viewerId: string;
  feedType: 'all' | 'following' | 'vip' | 'user';
  targetUserId?: string;
  limit?: number;
  cursor?: string;
  tokenFilter?: string;
}

export class SocialService {
  /**
   * Sanitize user-generated content
   */
  private static sanitizeContent(content: string): string {
    // Remove any potential XSS
    return DOMPurify.sanitize(content, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true 
    });
  }

  /**
   * Validate Solana address format
   */
  private static isValidSolanaAddress(address: string): boolean {
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return solanaAddressRegex.test(address);
  }

  /**
   * Create a new post
   */
  static async createPost(userId: string, input: CreatePostInput) {
    try {
      // Validate content
      if (!input.content || input.content.trim().length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Post content cannot be empty',
        });
      }

      if (input.content.length > 2000) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Post content exceeds maximum length of 2000 characters',
        });
      }

      // Validate visibility
      if (input.visibility === 'VIP') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { vipPrice: true },
        });

        if (!user?.vipPrice) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'VIP posting requires VIP subscription to be enabled',
          });
        }
      }

      // Validate token mention
      if (input.mentionedTokenMint) {
        if (!input.mentionedTokenSymbol) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Token symbol is required when mint address is provided',
          });
        }

        if (!this.isValidSolanaAddress(input.mentionedTokenMint)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid Solana token address format',
          });
        }
      }

      // Sanitize content
      const sanitizedContent = this.sanitizeContent(input.content);

      // Create post
      const post = await prisma.post.create({
        data: {
          userId,
          content: sanitizedContent,
          visibility: input.visibility,
          mentionedTokenName: input.mentionedTokenName,
          mentionedTokenSymbol: input.mentionedTokenSymbol,
          mentionedTokenMint: input.mentionedTokenMint,
          images: input.images || [],
        },
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

      // Create notification for followers
      if (input.visibility === 'PUBLIC' || input.visibility === 'FOLLOWERS') {
        const followers = await prisma.follow.findMany({
          where: { followingId: userId },
          select: { followerId: true },
        });

        if (followers.length > 0) {
          await prisma.notification.createMany({
            data: followers.map(f => ({
              userId: f.followerId,
              title: 'New Post',
              message: `${post.user.username || post.user.name} posted something new`,
              type: 'SOCIAL',
              data: { postId: post.id },
            })),
          });
        }
      }

      return post;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Create post error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create post',
      });
    }
  }

  /**
   * Get feed posts based on feed type
   */
  static async getFeed(options: FeedOptions) {
    try {
      const { userId, viewerId, feedType, targetUserId, limit = 20, cursor, tokenFilter } = options;

      // Build where clause based on feed type
      let where: Prisma.PostWhereInput = {};

      switch (feedType) {
        case 'all':
          // Public posts only
          where.visibility = 'PUBLIC';
          break;

        case 'following':
          // Posts from users the viewer follows
          const following = await prisma.follow.findMany({
            where: { followerId: viewerId },
            select: { followingId: true },
          });
          
          where = {
            OR: [
              { userId: viewerId }, // Own posts
              {
                userId: { in: following.map(f => f.followingId) },
                OR: [
                  { visibility: 'PUBLIC' },
                  { visibility: 'FOLLOWERS' },
                ],
              },
            ],
          };
          break;

        case 'vip':
          // VIP posts from subscribed creators
          const vipSubs = await prisma.vIPSubscription.findMany({
            where: {
              subscriberId: viewerId,
              expiresAt: { gt: new Date() },
            },
            select: { creatorId: true },
          });

          where = {
            userId: { in: vipSubs.map(s => s.creatorId) },
            visibility: 'VIP',
          };
          break;

        case 'user':
          // Posts from a specific user
          if (!targetUserId) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Target user ID required for user feed',
            });
          }

          // Check visibility permissions
          const isOwner = targetUserId === viewerId;
          const isFollowing = await prisma.follow.findFirst({
            where: {
              followerId: viewerId,
              followingId: targetUserId,
            },
          });
          const hasVipSub = await prisma.vIPSubscription.findFirst({
            where: {
              subscriberId: viewerId,
              creatorId: targetUserId,
              expiresAt: { gt: new Date() },
            },
          });

          where = {
            userId: targetUserId,
            OR: [
              { visibility: 'PUBLIC' },
              ...(isOwner || isFollowing ? [{ visibility: 'FOLLOWERS' as PostVisibility }] : []),
              ...(isOwner || hasVipSub ? [{ visibility: 'VIP' as PostVisibility }] : []),
            ],
          };
          break;
      }

      // Add token filter if provided
      if (tokenFilter) {
        where.mentionedTokenSymbol = tokenFilter;
      }

      // Add cursor for pagination
      if (cursor) {
        where.createdAt = { lt: new Date(cursor) };
      }

      // Fetch posts
      const posts = await prisma.post.findMany({
        where,
        take: limit,
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
              followersCount: true,
            },
          },
          likes: {
            where: { userId: viewerId },
            select: { id: true },
          },
          reposts: {
            where: { userId: viewerId },
            select: { id: true },
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

      // Transform posts to include viewer interaction status
      const transformedPosts = posts.map(post => ({
        ...post,
        isLiked: post.likes.length > 0,
        isReposted: post.reposts.length > 0,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        repostsCount: post._count.reposts,
        likes: undefined,
        reposts: undefined,
        _count: undefined,
      }));

      return {
        posts: transformedPosts,
        nextCursor: posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Get feed error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get feed',
      });
    }
  }

  /**
   * Like or unlike a post
   */
  static async toggleLike(userId: string, postId: string) {
    try {
      // Check if post exists
      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      }

      // Check if already liked
      const existingLike = await prisma.postLike.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (existingLike) {
        // Unlike
        await prisma.$transaction([
          prisma.postLike.delete({
            where: { id: existingLike.id },
          }),
          prisma.post.update({
            where: { id: postId },
            data: { likesCount: { decrement: 1 } },
          }),
        ]);

        return { liked: false };
      } else {
        // Like
        await prisma.$transaction([
          prisma.postLike.create({
            data: { userId, postId },
          }),
          prisma.post.update({
            where: { id: postId },
            data: { likesCount: { increment: 1 } },
          }),
        ]);

        // Create notification for post owner
        if (post.userId !== userId) {
          await prisma.notification.create({
            data: {
              userId: post.userId,
              title: 'New Like',
              message: 'Someone liked your post',
              type: 'SOCIAL',
              data: { postId, likerId: userId },
            },
          });
        }

        return { liked: true };
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Toggle like error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to toggle like',
      });
    }
  }

  /**
   * Create a comment on a post
   */
  static async createComment(userId: string, input: CreateCommentInput) {
    try {
      // Validate content
      if (!input.content || input.content.trim().length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Comment content cannot be empty',
        });
      }

      if (input.content.length > 500) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Comment exceeds maximum length of 500 characters',
        });
      }

      // Check if post exists
      const post = await prisma.post.findUnique({
        where: { id: input.postId },
      });

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      }

      // Check if parent comment exists (for replies)
      if (input.parentId) {
        const parentComment = await prisma.postComment.findUnique({
          where: { id: input.parentId },
        });

        if (!parentComment || parentComment.postId !== input.postId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid parent comment',
          });
        }
      }

      // Sanitize content
      const sanitizedContent = this.sanitizeContent(input.content);

      // Create comment
      const comment = await prisma.$transaction(async (tx) => {
        const newComment = await tx.postComment.create({
          data: {
            postId: input.postId,
            userId,
            content: sanitizedContent,
            parentId: input.parentId,
          },
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

        // Update comment count
        await tx.post.update({
          where: { id: input.postId },
          data: { commentsCount: { increment: 1 } },
        });

        return newComment;
      });

      // Create notification for post owner
      if (post.userId !== userId) {
        await prisma.notification.create({
          data: {
            userId: post.userId,
            title: 'New Comment',
            message: 'Someone commented on your post',
            type: 'SOCIAL',
            data: { postId: input.postId, commentId: comment.id, commenterId: userId },
          },
        });
      }

      return comment;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Create comment error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create comment',
      });
    }
  }

  /**
   * Repost a post
   */
  static async createRepost(userId: string, postId: string, comment?: string) {
    try {
      // Check if post exists
      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      }

      // Check if already reposted
      const existingRepost = await prisma.repost.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (existingRepost) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Already reposted this post',
        });
      }

      // Sanitize comment if provided
      const sanitizedComment = comment ? this.sanitizeContent(comment) : null;

      // Create repost
      const repost = await prisma.$transaction(async (tx) => {
        const newRepost = await tx.repost.create({
          data: {
            userId,
            postId,
            comment: sanitizedComment,
          },
        });

        // Update repost count
        await tx.post.update({
          where: { id: postId },
          data: { repostsCount: { increment: 1 } },
        });

        return newRepost;
      });

      // Create notification for post owner
      if (post.userId !== userId) {
        await prisma.notification.create({
          data: {
            userId: post.userId,
            title: 'New Repost',
            message: 'Someone reposted your post',
            type: 'SOCIAL',
            data: { postId, reposterId: userId },
          },
        });
      }

      return repost;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Create repost error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create repost',
      });
    }
  }

  /**
   * Follow or unfollow a user
   */
  static async toggleFollow(followerId: string, followingId: string) {
    try {
      if (followerId === followingId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot follow yourself',
        });
      }

      // Check if user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: followingId },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if already following
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existingFollow) {
        // Unfollow
        await prisma.$transaction([
          prisma.follow.delete({
            where: { id: existingFollow.id },
          }),
          prisma.user.update({
            where: { id: followerId },
            data: { followingCount: { decrement: 1 } },
          }),
          prisma.user.update({
            where: { id: followingId },
            data: { followersCount: { decrement: 1 } },
          }),
        ]);

        return { following: false };
      } else {
        // Follow
        await prisma.$transaction([
          prisma.follow.create({
            data: { followerId, followingId },
          }),
          prisma.user.update({
            where: { id: followerId },
            data: { followingCount: { increment: 1 } },
          }),
          prisma.user.update({
            where: { id: followingId },
            data: { followersCount: { increment: 1 } },
          }),
        ]);

        // Create notification
        await prisma.notification.create({
          data: {
            userId: followingId,
            title: 'New Follower',
            message: 'Someone started following you',
            type: 'SOCIAL',
            data: { followerId },
          },
        });

        return { following: true };
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Toggle follow error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to toggle follow',
      });
    }
  }

  /**
   * Subscribe to VIP content (WITH PAYMENT VERIFICATION)
   */
  static async subscribeToVIP(subscriberId: string, creatorId: string, transactionSignature?: string) {
    try {
      if (subscriberId === creatorId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot subscribe to yourself',
        });
      }

      // Check if creator has VIP enabled
      const creator = await prisma.user.findUnique({
        where: { id: creatorId },
        select: { vipPrice: true, walletAddress: true },
      });

      if (!creator?.vipPrice) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Creator does not have VIP subscription enabled',
        });
      }

      if (!creator.walletAddress) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Creator has not set up wallet for payments',
        });
      }

      // ✅ REQUIRE transaction signature in production
      if (process.env.NODE_ENV === 'production' && !transactionSignature) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment transaction signature required',
        });
      }

      // ✅ VERIFY PAYMENT ON-CHAIN
      if (transactionSignature) {
        // Check if transaction already used
        const used = await paymentVerificationService.isTransactionUsed(transactionSignature);
        if (used) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Transaction signature already used',
          });
        }

        // Verify payment on-chain
        await paymentVerificationService.verifyVIPPayment(
          transactionSignature,
          creator.vipPrice,
          creator.walletAddress
        );
      }

      // Check existing subscription
      const existing = await prisma.vIPSubscription.findUnique({
        where: {
          subscriberId_creatorId: {
            subscriberId,
            creatorId,
          },
        },
      });

      if (existing && existing.expiresAt > new Date()) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Already have an active VIP subscription',
        });
      }

      // Create or update subscription
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const subscription = await prisma.$transaction(async (tx) => {
        const sub = await tx.vIPSubscription.upsert({
          where: {
            subscriberId_creatorId: {
              subscriberId,
              creatorId,
            },
          },
          create: {
            subscriberId,
            creatorId,
            priceInSol: creator.vipPrice,
            expiresAt,
            transactionSignature,
          },
          update: {
            priceInSol: creator.vipPrice,
            expiresAt,
            transactionSignature,
          },
        });

        // Update VIP followers count
        if (!existing || existing.expiresAt < new Date()) {
          await tx.user.update({
            where: { id: creatorId },
            data: { vipFollowersCount: { increment: 1 } },
          });
        }

        return sub;
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: creatorId,
          title: 'New VIP Subscriber',
          message: 'Someone subscribed to your VIP content',
          type: 'SOCIAL',
          data: { subscriberId },
        },
      });

      return subscription;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Subscribe to VIP error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to subscribe to VIP',
      });
    }
  }

  /**
   * Get user profile with social stats
   */
  static async getUserProfile(userId: string, viewerId?: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          profileImage: true,
          coverImage: true,
          isVerified: true,
          badge: true,
          walletAddress: true,
          vipPrice: true,
          vipDescription: true,
          followersCount: true,
          followingCount: true,
          vipFollowersCount: true,
          copyTradersCount: true,
          roi30d: true,
          pnl24h: true,
          pnl1w: true,
          pnl1m: true,
          pnl90d: true,
          maxDrawdown: true,
          winRate: true,
          totalTrades: true,
          createdAt: true,
          _count: {
            select: {
              posts: true,
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check relationship with viewer
      let isFollowing = false;
      let isFollower = false;
      let hasVipSubscription = false;

      if (viewerId && viewerId !== userId) {
        const [follow, reverseFollow, vipSub] = await Promise.all([
          prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewerId,
                followingId: userId,
              },
            },
          }),
          prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: userId,
                followingId: viewerId,
              },
            },
          }),
          prisma.vIPSubscription.findFirst({
            where: {
              subscriberId: viewerId,
              creatorId: userId,
              expiresAt: { gt: new Date() },
            },
          }),
        ]);

        isFollowing = !!follow;
        isFollower = !!reverseFollow;
        hasVipSubscription = !!vipSub;
      }

      return {
        ...user,
        postsCount: user._count.posts,
        isFollowing,
        isFollower,
        hasVipSubscription,
        _count: undefined,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Get user profile error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user profile',
      });
    }
  }

  /**
   * Update trading stats (called by background job)
   */
  static async updateTradingStats(userId: string) {
    try {
      // Calculate trading stats from transactions
      const now = new Date();
      const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const week1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const month1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const days90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get transactions for different periods
      const [txn24h, txn1w, txn1m, txn90d, txn30d] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId, createdAt: { gte: day24h } },
        }),
        prisma.transaction.findMany({
          where: { userId, createdAt: { gte: week1 } },
        }),
        prisma.transaction.findMany({
          where: { userId, createdAt: { gte: month1 } },
        }),
        prisma.transaction.findMany({
          where: { userId, createdAt: { gte: days90 } },
        }),
        prisma.transaction.findMany({
          where: { userId, createdAt: { gte: days30 } },
        }),
      ]);

      // Calculate P&L for each period
      const calculatePnL = (transactions: any[]) => {
        let pnl = 0;
        transactions.forEach(tx => {
          if (tx.type === 'RECEIVE') pnl += tx.amount;
          if (tx.type === 'SEND') pnl -= tx.amount;
        });
        return pnl;
      };

      const pnl24h = calculatePnL(txn24h);
      const pnl1w = calculatePnL(txn1w);
      const pnl1m = calculatePnL(txn1m);
      const pnl90d = calculatePnL(txn90d);

      // Calculate ROI for 30 days
      const initialValue = 1000; // Assume initial value
      const currentValue = initialValue + calculatePnL(txn30d);
      const roi30d = ((currentValue - initialValue) / initialValue) * 100;

      // Calculate win rate
      const totalTrades = txn30d.filter(tx => tx.type === 'SWAP').length;
      const winningTrades = txn30d.filter(tx => tx.type === 'SWAP' && tx.amount > 0).length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      // Update user stats
      await prisma.user.update({
        where: { id: userId },
        data: {
          pnl24h,
          pnl1w,
          pnl1m,
          pnl90d,
          roi30d,
          winRate,
          totalTrades,
          statsUpdatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Update trading stats error:', error);
    }
  }
}
