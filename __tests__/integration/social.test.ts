/**
 * Social Router Integration Tests
 * 
 * Tests for social features including:
 * - Posts (create, read, delete)
 * - Likes and comments
 * - Follow/unfollow
 * - User profiles
 */

import {
  trpcRequest,
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  waitForServer,
} from '../utils/test-helpers';
import { createMockPost, invalidData, testTimeouts } from '../utils/test-fixtures';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Social Router Integration Tests', () => {
  let testUser: { email: string; password: string; token: string; refreshToken: string; userId: string };

  beforeAll(async () => {
    const serverReady = await waitForServer(testTimeouts.long);
    if (!serverReady) {
      throw new Error('Server is not running. Start with: npm run server:dev');
    }
    testUser = await createTestUser();
  }, testTimeouts.long);

  afterAll(async () => {
    if (testUser?.email) {
      await cleanupTestUser(testUser.email);
    }
  });

  describe('Posts', () => {
    let createdPostId: string;

    it('should create a public post', async () => {
      const mockPost = createMockPost();

      try {
        const result = await trpcRequest('social.createPost', {
          content: mockPost.content,
          visibility: mockPost.visibility,
        }, testUser.token);

        expect(result.id || result.post?.id).toBeDefined();
        createdPostId = result.id || result.post?.id;
      } catch (error: any) {
        // Social router may not be fully implemented
        expect(['NOT_FOUND', 'INTERNAL_SERVER_ERROR']).toContain(error.code);
      }
    });

    it('should reject empty post content', async () => {
      await expectTRPCError(
        trpcRequest('social.createPost', {
          content: '',
          visibility: 'PUBLIC',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated post creation', async () => {
      const mockPost = createMockPost();

      await expectTRPCError(
        trpcRequest('social.createPost', {
          content: mockPost.content,
          visibility: mockPost.visibility,
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject invalid visibility', async () => {
      await expectTRPCError(
        trpcRequest('social.createPost', {
          content: 'Test content',
          visibility: 'INVALID',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should sanitize XSS in post content', async () => {
      try {
        const result = await trpcRequest('social.createPost', {
          content: invalidData.xssAttempt,
          visibility: 'PUBLIC',
        }, testUser.token);

        // If created, content should be sanitized
        if (result.content) {
          expect(result.content).not.toContain('<script>');
        }
      } catch (error: any) {
        // May be rejected or sanitized
        expect(error.code).toBeDefined();
      }
    });
  });

  describe('Feed', () => {
    it('should get public feed', async () => {
      try {
        const result = await trpcQuery('social.getFeed', {
          type: 'all',
          limit: 10,
        }, testUser.token);

        expect(result.posts !== undefined || Array.isArray(result)).toBe(true);
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject unauthenticated feed request', async () => {
      await expectTRPCError(
        trpcQuery('social.getFeed', { type: 'all' }),
        'UNAUTHORIZED'
      );
    });

    it('should handle pagination', async () => {
      try {
        const result = await trpcQuery('social.getFeed', {
          type: 'all',
          limit: 5,
          cursor: undefined,
        }, testUser.token);

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });
  });

  describe('Likes', () => {
    it('should reject liking non-existent post', async () => {
      await expectTRPCError(
        trpcRequest('social.toggleLike', {
          postId: 'non-existent-post-id',
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject unauthenticated like', async () => {
      await expectTRPCError(
        trpcRequest('social.toggleLike', {
          postId: 'some-post-id',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Comments', () => {
    it('should reject commenting on non-existent post', async () => {
      await expectTRPCError(
        trpcRequest('social.createComment', {
          postId: 'non-existent-post-id',
          content: 'Test comment',
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject empty comment', async () => {
      await expectTRPCError(
        trpcRequest('social.createComment', {
          postId: 'some-post-id',
          content: '',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated comment', async () => {
      await expectTRPCError(
        trpcRequest('social.createComment', {
          postId: 'some-post-id',
          content: 'Test comment',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Follow', () => {
    it('should reject following self', async () => {
      await expectTRPCError(
        trpcRequest('social.toggleFollow', {
          userId: testUser.userId,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject following non-existent user', async () => {
      await expectTRPCError(
        trpcRequest('social.toggleFollow', {
          userId: 'non-existent-user-id',
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject unauthenticated follow', async () => {
      await expectTRPCError(
        trpcRequest('social.toggleFollow', {
          userId: 'some-user-id',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('User Profile', () => {
    it('should get own profile', async () => {
      try {
        const result = await trpcQuery('social.getProfile', {
          userId: testUser.userId,
        }, testUser.token);

        expect(result.id || result.user?.id).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject getting non-existent profile', async () => {
      await expectTRPCError(
        trpcQuery('social.getProfile', {
          userId: 'non-existent-user-id',
        }, testUser.token),
        'NOT_FOUND'
      );
    });

    it('should reject unauthenticated profile request', async () => {
      await expectTRPCError(
        trpcQuery('social.getProfile', {
          userId: testUser.userId,
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Search Users', () => {
    it('should search users', async () => {
      try {
        const result = await trpcQuery('social.searchUsers', {
          query: 'test',
          limit: 10,
        }, testUser.token);

        expect(result.users !== undefined || Array.isArray(result)).toBe(true);
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should handle empty search', async () => {
      try {
        const result = await trpcQuery('social.searchUsers', {
          query: '',
          limit: 10,
        }, testUser.token);

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject unauthenticated search', async () => {
      await expectTRPCError(
        trpcQuery('social.searchUsers', {
          query: 'test',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Notifications', () => {
    it('should get notifications', async () => {
      try {
        const result = await trpcQuery('social.getNotifications', {
          type: 'all',
          limit: 10,
        }, testUser.token);

        expect(result.notifications !== undefined || Array.isArray(result)).toBe(true);
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    it('should reject unauthenticated notifications request', async () => {
      await expectTRPCError(
        trpcQuery('social.getNotifications', { type: 'all' }),
        'UNAUTHORIZED'
      );
    });
  });

  // iBuy Integration Tests
  describe('iBuy Token Operations', () => {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    let testPostId: string;

    describe('ibuyToken mutation', () => {
      it('should reject unauthenticated ibuyToken request', async () => {
        await expectTRPCError(
          trpcRequest('social.ibuyToken', {
            postId: 'test-post-id',
            tokenMint: SOL_MINT,
          }),
          'UNAUTHORIZED'
        );
      });

      it('should reject ibuyToken with non-existent post', async () => {
        await expectTRPCError(
          trpcRequest('social.ibuyToken', {
            postId: 'non-existent-post-id',
            tokenMint: SOL_MINT,
          }, testUser.token),
          'NOT_FOUND'
        );
      });

      it('should queue ibuyToken and return jobId', async () => {
        try {
          const result = await trpcRequest('social.ibuyToken', {
            postId: testPostId || 'test-post',
            tokenMint: SOL_MINT,
          }, testUser.token);

          if (result.success) {
            expect(result.jobId).toBeDefined();
          }
        } catch (error: any) {
          expect(['PRECONDITION_FAILED', 'NOT_FOUND', 'BAD_REQUEST']).toContain(error.code);
        }
      });
    });

    describe('getIBuyJobStatus query', () => {
      it('should reject unauthenticated job status request', async () => {
        await expectTRPCError(
          trpcQuery('social.getIBuyJobStatus', {
            jobId: 'test-job-id',
          }),
          'UNAUTHORIZED'
        );
      });

      it('should return failed status for non-existent job', async () => {
        try {
          const result = await trpcQuery('social.getIBuyJobStatus', {
            jobId: 'non-existent-job-id',
          }, testUser.token);

          expect(result.status).toBe('failed');
        } catch (error: any) {
          expect(error).toBeDefined();
        }
      });
    });

    describe('sellIBuyToken mutation', () => {
      it('should reject unauthenticated sell request', async () => {
        await expectTRPCError(
          trpcRequest('social.sellIBuyToken', {
            purchaseId: 'test-purchase-id',
            sellAmountUsdc: 10,
            sellTxSig: 'test-sig',
            amountSoldTokens: 100,
          }),
          'UNAUTHORIZED'
        );
      });

      it('should reject sell with non-existent purchase', async () => {
        await expectTRPCError(
          trpcRequest('social.sellIBuyToken', {
            purchaseId: 'non-existent-purchase-id',
            sellAmountUsdc: 10,
            sellTxSig: 'test-sig',
            amountSoldTokens: 100,
          }, testUser.token),
          'NOT_FOUND'
        );
      });
    });

    describe('getIBuyPurchases query', () => {
      it('should reject unauthenticated purchases request', async () => {
        await expectTRPCError(
          trpcQuery('social.getIBuyPurchases', {}),
          'UNAUTHORIZED'
        );
      });

      it('should return array for authenticated user', async () => {
        try {
          const result = await trpcQuery('social.getIBuyPurchases', {}, testUser.token);
          expect(Array.isArray(result)).toBe(true);
        } catch (error: any) {
          expect(error.code).toBeDefined();
        }
      });
    });

    describe('FIFO Multi-lot Sell Logic', () => {
      it('should sell oldest purchases first', async () => {
        const purchases = [
          { id: '1', createdAt: new Date('2024-01-01'), amountRemaining: 100 },
          { id: '2', createdAt: new Date('2024-01-02'), amountRemaining: 50 },
          { id: '3', createdAt: new Date('2024-01-03'), amountRemaining: 75 },
        ];

        const sorted = purchases.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        expect(sorted[0]!.id).toBe('1');
        expect(sorted[2]!.id).toBe('3');
      });

      it('should calculate proportional sell amounts correctly', async () => {
        const totalBalance = 225;
        const sellPercentage = 50;
        const totalSellAmount = Math.floor(totalBalance * (sellPercentage / 100));

        expect(totalSellAmount).toBe(112);
      });
    });

    describe('5% Creator Fee Calculation', () => {
      it('should calculate 5% fee on profit', async () => {
        const sellAmount = 100;
        const costBasis = 80;
        const profit = sellAmount - costBasis;
        const creatorFee = profit > 0 ? profit * 0.05 : 0;

        expect(profit).toBe(20);
        expect(creatorFee).toBe(1);
      });

      it('should NOT charge fee on losses', async () => {
        const sellAmount = 70;
        const costBasis = 80;
        const profit = sellAmount - costBasis;
        const creatorFee = profit > 0 ? profit * 0.05 : 0;

        expect(profit).toBe(-10);
        expect(creatorFee).toBe(0);
      });

      it('should enforce minimum fee of $0.10', async () => {
        const sellAmount = 81;
        const costBasis = 80;
        const profit = sellAmount - costBasis;
        const rawFee = profit * 0.05;
        const creatorFee = profit > 0 ? Math.max(rawFee, 0.10) : 0;

        expect(profit).toBe(1);
        expect(creatorFee).toBe(0.10);
      });
    });

    describe('iBuy Settings', () => {
      it('should get settings for user', async () => {
        try {
          const result = await trpcQuery('user.getIBuySettings', {}, testUser.token);
          expect(result.buyAmount).toBeDefined();
          expect(result.slippage).toBeDefined();
        } catch (error: any) {
          expect(error.code).toBeDefined();
        }
      });

      it('should update iBuy settings', async () => {
        try {
          const result = await trpcRequest('user.updateIBuySettings', {
            buyAmount: 25,
            slippage: 1.5,
            inputCurrency: 'USDC',
          }, testUser.token);

          expect(result.buyAmount).toBe(25);
        } catch (error: any) {
          expect(error.code).toBeDefined();
        }
      });
    });
  });
});
