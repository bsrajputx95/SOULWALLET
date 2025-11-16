import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { sign } from 'tweetnacl';
import { logger } from '../../lib/logger';
// import { getFeatureFlags } from '../../lib/featureFlags'; // Removed - send endpoint commented out
import prisma from '../../lib/prisma';

interface ParsedTokenAccountInfo {
  mint: string;
  tokenAmount: {
    uiAmount: number | null;
    decimals: number;
  };
}

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

export const walletRouter = router({
  /**
   * @deprecated This endpoint creates simulated transactions only.
   * Frontend should use client-side wallet signing and call recordTransaction instead.
   * 
   * DEPRECATED - DO NOT USE
   * Use recordTransaction endpoint instead after client-side signing
   * 
   * Commented out to prevent accidental use. Uncomment for testing if needed.
   */
  /* 
  send: protectedProcedure
    .input(z.object({
      to: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address'),
      amount: z.number().positive('Amount must be positive'),
      token: z.string(), // 'SOL' or mint address
      memo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { sendEnabled, simulationMode } = getFeatureFlags();
        if (!sendEnabled) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Send feature is disabled' });
        }
        if (!simulationMode) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'On-chain send is not enabled in this environment' });
        }

        // Validate recipient address
        let recipientPubkey: PublicKey;
        try {
          recipientPubkey = new PublicKey(input.to);
        } catch {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid recipient address',
          });
        }

        // Get user's wallet keypair (this would need to be implemented based on your wallet storage)
        // For now, we'll assume the user has a wallet address stored
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User wallet not found',
          });
        }

        const senderPubkey = new PublicKey(user.walletAddress);

        let transaction: Transaction;
        let tokenSymbol: string;

        if (input.token === 'SOL') {
          // SOL transfer
          const lamports = input.amount * LAMPORTS_PER_SOL;
          transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );
          tokenSymbol = 'SOL';
        } else {
          // SPL token transfer
          const mintPubkey = new PublicKey(input.token);
          const senderTokenAccount = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
          const recipientTokenAccount = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

          transaction = new Transaction().add(
            createTransferInstruction(
              senderTokenAccount,
              recipientTokenAccount,
              senderPubkey,
              input.amount,
              [],
              TOKEN_PROGRAM_ID
            )
          );
          tokenSymbol = input.token; // Would need to fetch actual symbol
        }

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPubkey;

        // Calculate fee
        const fee = await connection.getFeeForMessage(transaction.compileMessage());
        const feeInSOL = (fee?.value || 5000) / LAMPORTS_PER_SOL;

        // Note: In a real implementation, you would sign and send the transaction here
        // For now, we'll simulate a successful transaction
        const signature = 'simulated_signature_' + Date.now();

        // Save transaction to database
        const dbTransaction = await prisma.transaction.create({
          data: {
            userId: ctx.user.id,
            signature,
            type: 'SEND',
            amount: input.amount,
            token: input.token,
            tokenSymbol,
            from: user.walletAddress,
            to: input.to,
            fee: feeInSOL,
            status: 'PENDING',
            notes: input.memo || null,
          },
        });

        return {
          success: true,
          signature,
          transaction: dbTransaction,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Send transaction error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send transaction',
        });
      }
    }),
  */

  /**
   * Estimate transaction fee
   */
  estimateFee: protectedProcedure
    .input(z.object({
      to: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
      amount: z.number().positive(),
      token: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User wallet not found',
          });
        }

        const senderPubkey = new PublicKey(user.walletAddress);
        const recipientPubkey = new PublicKey(input.to);

        let transaction: Transaction;

        if (input.token === 'SOL') {
          const lamports = input.amount * LAMPORTS_PER_SOL;
          transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );
        } else {
          const mintPubkey = new PublicKey(input.token);
          const senderTokenAccount = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
          const recipientTokenAccount = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

          transaction = new Transaction().add(
            createTransferInstruction(
              senderTokenAccount,
              recipientTokenAccount,
              senderPubkey,
              input.amount,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        }

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPubkey;

        const fee = await connection.getFeeForMessage(transaction.compileMessage());
        const feeInSOL = (fee?.value || 5000) / LAMPORTS_PER_SOL;

        return {
          fee: feeInSOL,
          feeInLamports: fee?.value || 5000,
        };
      } catch (error) {
        logger.error('Fee estimation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to estimate fee',
        });
      }
    }),

  /**
   * Get wallet balance
   */
  getBalance: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User wallet not found',
          });
        }

        const publicKey = new PublicKey(user.walletAddress);
        const balance = await connection.getBalance(publicKey);

        return {
          balance: balance / LAMPORTS_PER_SOL,
          balanceInLamports: balance,
        };
      } catch (error) {
        logger.error('Get balance error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get balance',
        });
      }
    }),

  /**
   * Get all token balances (SOL + SPL tokens)
   */
  getTokens: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User wallet not found',
          });
        }

        const publicKey = new PublicKey(user.walletAddress);
        
        // Get SOL balance
        const solBalance = await connection.getBalance(publicKey);

        // Get SPL token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        });

        const tokens = tokenAccounts.value.map((account) => {
          const info = (account.account.data as { parsed: { info: ParsedTokenAccountInfo } }).parsed.info;
          return {
            mint: info.mint,
            balance: Number(info.tokenAmount.uiAmount || 0),
            decimals: info.tokenAmount.decimals,
            tokenAccount: account.pubkey.toString(),
          };
        }).filter(t => t.balance > 0); // Only return tokens with non-zero balance

        return {
          sol: solBalance / LAMPORTS_PER_SOL,
          tokens,
        };
      } catch (error) {
        logger.error('Get tokens error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get token balances',
        });
      }
    }),

  /**
   * Link wallet to user account with signature verification
   */
  linkWallet: protectedProcedure
    .input(z.object({
      publicKey: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key'),
      signature: z.string().min(1, 'Signature is required'),
      message: z.string().min(1, 'Message is required'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify the signature
        const publicKeyBytes = new PublicKey(input.publicKey).toBytes();
        const messageBytes = new TextEncoder().encode(input.message);
        const signatureBytes = Buffer.from(input.signature, 'base64');

        const isValidSignature = sign.detached.verify(
          messageBytes,
          signatureBytes,
          publicKeyBytes
        );

        if (!isValidSignature) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid signature - wallet verification failed',
          });
        }

        // Check if wallet is already linked to another user
        const existingWallet = await prisma.user.findFirst({
          where: {
            walletAddress: input.publicKey,
            id: { not: ctx.user.id },
          },
        });

        if (existingWallet) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This wallet is already linked to another account',
          });
        }

        // Update user with wallet address
        const updatedUser = await prisma.user.update({
          where: { id: ctx.user.id },
          data: { 
            walletAddress: input.publicKey,
            walletVerifiedAt: new Date(),
          },
        });

        logger.info('Wallet linked successfully', {
          userId: ctx.user.id,
          walletAddress: input.publicKey,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          walletAddress: updatedUser.walletAddress,
          message: 'Wallet linked successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Wallet linking error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to link wallet',
        });
      }
    }),

  /**
   * Verify wallet ownership
   */
  verifyWallet: protectedProcedure
    .input(z.object({
      publicKey: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key'),
      signature: z.string().min(1, 'Signature is required'),
      message: z.string().min(1, 'Message is required'),
    }))
    .query(async ({ input }) => {
      try {
        const publicKeyBytes = new PublicKey(input.publicKey).toBytes();
        const messageBytes = new TextEncoder().encode(input.message);
        const signatureBytes = Buffer.from(input.signature, 'base64');

        const isValidSignature = sign.detached.verify(
          messageBytes,
          signatureBytes,
          publicKeyBytes
        );

        return {
          isValid: isValidSignature,
          publicKey: input.publicKey,
        };
      } catch (error) {
        logger.error('Wallet verification error:', error);
        return {
          isValid: false,
          publicKey: input.publicKey,
          error: 'Verification failed',
        };
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
          },
        });

        if (!user?.walletAddress) {
          return {
            isLinked: false,
            walletAddress: null,
            verifiedAt: null,
          };
        }

        // Get wallet balance
        const publicKey = new PublicKey(user.walletAddress);
        const balance = await connection.getBalance(publicKey);

        return {
          isLinked: true,
          walletAddress: user.walletAddress,
          verifiedAt: user.walletVerifiedAt,
          balance: balance / LAMPORTS_PER_SOL,
          balanceInLamports: balance,
        };
      } catch (error) {
        logger.error('Get wallet info error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get wallet information',
        });
      }
    }),

  /**
   * Get recent incoming transactions
   */
  getRecentIncoming: protectedProcedure
    .input(z.object({
      limit: z.number().default(5),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          return { transactions: [] };
        }

        const transactions = await prisma.transaction.findMany({
          where: {
            to: user.walletAddress,
            type: 'RECEIVE',
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
        });

        return { transactions };
      } catch (error) {
        logger.error('Get recent incoming error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get recent transactions',
        });
      }
    }),

  /**
   * Generate Solana Pay QR code URL for receiving payments
   */
  generateReceiveQR: protectedProcedure
    .input(z.object({
      amount: z.number().optional(),
      label: z.string().optional(),
      message: z.string().optional(),
      memo: z.string().optional(),
      spl: z.string().optional(), // SPL token mint address
    }))
    .query(async ({ input, ctx }) => {
      try {
        const user = await prisma.user.findUnique({ 
          where: { id: ctx.user.id } 
        });
        
        if (!user?.walletAddress) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'No wallet address found' 
          });
        }
        
        // Build Solana Pay URL parameters
        const params = new URLSearchParams();
        
        if (input.amount) {
          params.append('amount', input.amount.toString());
        }
        if (input.label) {
          params.append('label', input.label);
        }
        if (input.message) {
          params.append('message', input.message);
        }
        if (input.memo) {
          params.append('memo', input.memo);
        }
        if (input.spl) {
          params.append('spl-token', input.spl);
        }
        
        // Construct Solana Pay URL
        const queryString = params.toString();
        const solanaPayUrl = queryString 
          ? `solana:${user.walletAddress}?${queryString}`
          : `solana:${user.walletAddress}`;
        
        return {
          url: solanaPayUrl,
          walletAddress: user.walletAddress,
          amount: input.amount,
          label: input.label,
          message: input.message,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Generate receive QR error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate QR code URL',
        });
      }
    }),

  /**
   * Get token metadata for multiple mints
   */
  getTokenMetadata: protectedProcedure
    .input(z.object({
      mints: z.array(z.string()).min(1, 'At least one mint address is required').max(100, 'Too many mints requested'),
    }))
    .query(async ({ input }) => {
      try {
        // Token metadata cache - in production this should come from a database or external service
        const tokenMetadataCache: Record<string, { symbol: string; name: string; decimals: number; logoURI?: string }> = {
          'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png' },
          'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
          '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png' },
        };

        const metadata = await Promise.all(
          input.mints.map(async (mint) => {
            // Check cache first
            if (tokenMetadataCache[mint]) {
              return {
                mint,
                ...tokenMetadataCache[mint],
              };
            }

            // For unknown tokens, try to fetch from chain
            // In production, this would query a token registry service or Metaplex metadata
            try {
              const mintPubkey = new PublicKey(mint);
              const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
              
              if (mintInfo.value && 'parsed' in mintInfo.value.data) {
                const parsed = mintInfo.value.data.parsed;
                if (parsed.type === 'mint' && parsed.info) {
                  return {
                    mint,
                    symbol: mint.slice(0, 6).toUpperCase(), // Default symbol from mint
                    name: 'Unknown Token',
                    decimals: parsed.info.decimals || 0,
                  };
                }
              }
            } catch (error) {
              logger.debug('Failed to fetch metadata for mint:', { mint, error });
            }

            // Return default metadata for unknown tokens
            return {
              mint,
              symbol: 'UNKNOWN',
              name: 'Unknown Token',
              decimals: 0,
            };
          })
        );

        return { metadata };
      } catch (error) {
        logger.error('Get token metadata error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get token metadata',
        });
      }
    }),

  /**
   * Record a real blockchain transaction
   * Called by frontend after successfully sending/swapping
   */
  recordTransaction: protectedProcedure
    .input(z.object({
      signature: z.string(),
      type: z.enum(['SEND', 'RECEIVE', 'SWAP']),
      amount: z.number(),
      token: z.string(),
      tokenSymbol: z.string(),
      to: z.string(),
      from: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
        });

        if (!user?.walletAddress) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User wallet not found',
          });
        }

        // Verify transaction exists on blockchain
        let txStatus: 'CONFIRMED' | 'FAILED' | 'PENDING' = 'PENDING';
        let fee = 0.000005; // Default fee estimate

        try {
          const txInfo = await connection.getTransaction(input.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (txInfo) {
            txStatus = txInfo.meta?.err ? 'FAILED' : 'CONFIRMED';
            fee = (txInfo.meta?.fee || 5000) / LAMPORTS_PER_SOL;
          }
        } catch (error) {
          logger.warn('Could not verify transaction on-chain:', {
            signature: input.signature,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue anyway - transaction might not be confirmed yet
        }

        // Check if transaction already recorded
        const existing = await prisma.transaction.findUnique({
          where: { signature: input.signature },
        });

        if (existing) {
          logger.info('Transaction already recorded:', { signature: input.signature });
          return { transaction: existing, alreadyRecorded: true };
        }

        // Record in database with REAL signature
        const transaction = await prisma.transaction.create({
          data: {
            userId: ctx.user.id,
            signature: input.signature,
            type: input.type,
            amount: input.amount,
            token: input.token,
            tokenSymbol: input.tokenSymbol,
            from: input.from || user.walletAddress,
            to: input.to,
            fee,
            status: txStatus,
            notes: input.notes || null,
          },
        });

        logger.info('Transaction recorded successfully:', {
          id: transaction.id,
          signature: input.signature,
          type: input.type,
        });

        return { transaction, alreadyRecorded: false };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Record transaction error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record transaction',
        });
      }
    }),
});
