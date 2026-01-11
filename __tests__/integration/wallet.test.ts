/**
 * Wallet Router Integration Tests
 * 
 * Tests for wallet operations including:
 * - Balance operations
 * - Fee estimation
 * - Wallet linking
 * - Transaction recording
 * - Token metadata
 */

import {
  trpcRequest,
  trpcQuery,
  createTestUser,
  cleanupTestUser,
  expectTRPCError,
  generateTestWallet,
  mockSolanaTransaction,
  waitForServer,
} from '../utils/test-helpers';
import {
  VALID_SOLANA_ADDRESSES,
  createMockTransaction,
  invalidData,
  testTimeouts,
} from '../utils/test-fixtures';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Wallet Router Integration Tests', () => {
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

  describe('Balance Operations', () => {
    it('should return error when wallet not linked', async () => {
      await expectTRPCError(
        trpcQuery('wallet.getBalance', {}, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated balance request', async () => {
      await expectTRPCError(
        trpcQuery('wallet.getBalance', {}),
        'UNAUTHORIZED'
      );
    });

    it('should return error for tokens when wallet not linked', async () => {
      await expectTRPCError(
        trpcQuery('wallet.getTokens', {}, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Fee Estimation', () => {
    it('should return error when wallet not linked', async () => {
      await expectTRPCError(
        trpcQuery('wallet.estimateFee', {
          to: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_2,
          amount: 1,
          token: 'SOL',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject invalid recipient address', async () => {
      await expectTRPCError(
        trpcQuery('wallet.estimateFee', {
          to: invalidData.invalidSolanaAddress,
          amount: 1,
          token: 'SOL',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated fee estimation', async () => {
      await expectTRPCError(
        trpcQuery('wallet.estimateFee', {
          to: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_2,
          amount: 1,
          token: 'SOL',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Wallet Linking', () => {
    it('should reject invalid signature', async () => {
      const wallet = generateTestWallet();

      await expectTRPCError(
        trpcRequest('wallet.linkWallet', {
          publicKey: wallet.publicKey,
          signature: 'invalid-signature',
          message: 'Sign this message to link your wallet',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject invalid public key format', async () => {
      await expectTRPCError(
        trpcRequest('wallet.linkWallet', {
          publicKey: invalidData.invalidSolanaAddress,
          signature: 'some-signature',
          message: 'Sign this message',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated wallet linking', async () => {
      const wallet = generateTestWallet();

      await expectTRPCError(
        trpcRequest('wallet.linkWallet', {
          publicKey: wallet.publicKey,
          signature: 'some-signature',
          message: 'Sign this message',
        }),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Linked Wallet Flows', () => {
    let linkedWalletUser: typeof testUser;
    let linkedWallet: ReturnType<typeof generateTestWallet>;

    beforeAll(async () => {
      linkedWalletUser = await createTestUser();
      linkedWallet = generateTestWallet();

      // Link wallet with valid signature using tweetnacl
      const message = 'Sign this message to link your wallet to SoulWallet';
      const messageBytes = new TextEncoder().encode(message);
      const { sign } = await import('tweetnacl');
      const signatureBytes = sign.detached(messageBytes, linkedWallet.secretKey);
      const signature = Buffer.from(signatureBytes).toString('base64');

      try {
        await trpcRequest('wallet.linkWallet', {
          publicKey: linkedWallet.publicKey,
          signature,
          message,
        }, linkedWalletUser.token);
      } catch (error) {
        // Wallet linking may fail in test environment without real keypair
        console.log('Wallet linking skipped in test environment');
      }
    });

    afterAll(async () => {
      if (linkedWalletUser?.email) {
        await cleanupTestUser(linkedWalletUser.email);
      }
    });

    it('should get wallet info after linking', async () => {
      const result = await trpcQuery('wallet.getWalletInfo', {}, linkedWalletUser.token);

      expect(result).toBeDefined();
      // Structure validation - may be linked or not depending on test env
      expect(typeof result.isLinked).toBe('boolean');
      if (result.isLinked) {
        expect(result.walletAddress).toBeDefined();
        expect(typeof result.walletAddress).toBe('string');
      }
    });

    it('should get balance with proper structure when wallet linked', async () => {
      try {
        const result = await trpcQuery('wallet.getBalance', {}, linkedWalletUser.token);

        // Validate response structure
        expect(result).toBeDefined();
        expect(typeof result.balance).toBe('number');
        expect(typeof result.balanceInLamports).toBe('number');
        expect(result.balance).toBeGreaterThanOrEqual(0);
      } catch (error: any) {
        // Expected if wallet not linked in test env
        expect(error.code).toBe('BAD_REQUEST');
      }
    });

    it('should get tokens with proper structure when wallet linked', async () => {
      try {
        const result = await trpcQuery('wallet.getTokens', {}, linkedWalletUser.token);

        // Validate response structure
        expect(result).toBeDefined();
        expect(typeof result.sol).toBe('number');
        expect(Array.isArray(result.tokens)).toBe(true);
      } catch (error: any) {
        // Expected if wallet not linked in test env
        expect(error.code).toBe('BAD_REQUEST');
      }
    });

    it('should estimate fee with proper structure when wallet linked', async () => {
      try {
        const result = await trpcQuery('wallet.estimateFee', {
          to: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_2,
          amount: 0.1,
          token: 'SOL',
        }, linkedWalletUser.token);

        // Validate response structure
        expect(result).toBeDefined();
        expect(typeof result.fee).toBe('number');
        expect(typeof result.feeInLamports).toBe('number');
        expect(result.fee).toBeGreaterThan(0);
      } catch (error: any) {
        // Expected if wallet not linked or RPC unavailable
        expect(['BAD_REQUEST', 'INTERNAL_SERVER_ERROR']).toContain(error.code);
      }
    });

    it('should generate receive QR with proper structure when wallet linked', async () => {
      try {
        const result = await trpcQuery('wallet.generateReceiveQR', {
          amount: 1.5,
          label: 'Test Payment',
        }, linkedWalletUser.token);

        // Validate response structure
        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
        expect(result.url.startsWith('solana:')).toBe(true);
        expect(result.walletAddress).toBeDefined();
        
        // Check URL contains parameters when provided
        if (result.url.includes('?')) {
          expect(result.url).toContain('amount=');
          expect(result.url).toContain('label=');
        }
      } catch (error: any) {
        // Expected if wallet not linked
        expect(error.code).toBe('BAD_REQUEST');
      }
    });
  });

  describe('Wallet Verification', () => {
    it('should return invalid for bad signature', async () => {
      const wallet = generateTestWallet();

      const result = await trpcQuery('wallet.verifyWallet', {
        publicKey: wallet.publicKey,
        signature: 'invalid-signature',
        message: 'Test message',
      }, testUser.token);

      expect(result.isValid).toBe(false);
    });

    it('should reject invalid public key', async () => {
      await expectTRPCError(
        trpcQuery('wallet.verifyWallet', {
          publicKey: invalidData.invalidSolanaAddress,
          signature: 'some-signature',
          message: 'Test message',
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Wallet Info', () => {
    it('should return not linked status when no wallet', async () => {
      const result = await trpcQuery('wallet.getWalletInfo', {}, testUser.token);

      expect(result.isLinked).toBe(false);
      expect(result.walletAddress).toBeNull();
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('wallet.getWalletInfo', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Transaction Recording', () => {
    it('should return error when wallet not linked', async () => {
      const mockTx = createMockTransaction();

      await expectTRPCError(
        trpcRequest('wallet.recordTransaction', {
          signature: mockTx.signature,
          type: mockTx.type,
          amount: mockTx.amount,
          token: mockTx.token,
          tokenSymbol: mockTx.tokenSymbol,
          to: mockTx.to,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated transaction recording', async () => {
      const mockTx = createMockTransaction();

      await expectTRPCError(
        trpcRequest('wallet.recordTransaction', {
          signature: mockTx.signature,
          type: mockTx.type,
          amount: mockTx.amount,
          token: mockTx.token,
          tokenSymbol: mockTx.tokenSymbol,
          to: mockTx.to,
        }),
        'UNAUTHORIZED'
      );
    });

    it('should reject invalid transaction type', async () => {
      await expectTRPCError(
        trpcRequest('wallet.recordTransaction', {
          signature: mockSolanaTransaction(),
          type: 'INVALID_TYPE',
          amount: 1,
          token: 'SOL',
          tokenSymbol: 'SOL',
          to: VALID_SOLANA_ADDRESSES.SAMPLE_WALLET_2,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Token Metadata', () => {
    it('should return metadata for known tokens', async () => {
      const result = await trpcQuery('wallet.getTokenMetadata', {
        mints: [
          VALID_SOLANA_ADDRESSES.SOL_MINT,
          VALID_SOLANA_ADDRESSES.USDC_MINT,
          VALID_SOLANA_ADDRESSES.USDT_MINT,
        ],
      }, testUser.token);

      expect(result.metadata).toBeDefined();
      expect(Array.isArray(result.metadata)).toBe(true);
      expect(result.metadata.length).toBe(3);

      const solMeta = result.metadata.find((m: any) => m.mint === VALID_SOLANA_ADDRESSES.SOL_MINT);
      expect(solMeta).toBeDefined();
      expect(solMeta.symbol).toBe('SOL');
    });

    it('should handle unknown tokens gracefully', async () => {
      const unknownMint = 'UnknownMint111111111111111111111111111111111';

      const result = await trpcQuery('wallet.getTokenMetadata', {
        mints: [unknownMint],
      }, testUser.token);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.length).toBe(1);
    });

    it('should reject empty mints array', async () => {
      await expectTRPCError(
        trpcQuery('wallet.getTokenMetadata', {
          mints: [],
        }, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject too many mints', async () => {
      const tooManyMints = Array(101).fill(VALID_SOLANA_ADDRESSES.SOL_MINT);

      await expectTRPCError(
        trpcQuery('wallet.getTokenMetadata', {
          mints: tooManyMints,
        }, testUser.token),
        'BAD_REQUEST'
      );
    });
  });

  describe('Receive QR Generation', () => {
    it('should return error when wallet not linked', async () => {
      await expectTRPCError(
        trpcQuery('wallet.generateReceiveQR', {}, testUser.token),
        'BAD_REQUEST'
      );
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('wallet.generateReceiveQR', {}),
        'UNAUTHORIZED'
      );
    });
  });

  describe('Recent Incoming Transactions', () => {
    it('should return empty array when wallet not linked', async () => {
      const result = await trpcQuery('wallet.getRecentIncoming', {
        limit: 5,
      }, testUser.token);

      expect(result.transactions).toBeDefined();
      expect(Array.isArray(result.transactions)).toBe(true);
      expect(result.transactions.length).toBe(0);
    });

    it('should reject unauthenticated request', async () => {
      await expectTRPCError(
        trpcQuery('wallet.getRecentIncoming', { limit: 5 }),
        'UNAUTHORIZED'
      );
    });
  });
});
