import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { sign } from 'tweetnacl';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { rpcManager } from '../../lib/services/rpcManager';
import { nonceManager } from '../../lib/services/nonceManager'
import { custodialWalletService } from '../../lib/services/custodialWallet'
import { auditLogService } from '../../lib/services/auditLog'
import { amlService } from '../../lib/services/kyc'
import { getCacheTtls, redisCache } from '../../lib/redis'
import { recordWalletOperation, recordTransaction as recordTxMetric, linkedWalletsTotal } from '../../lib/metrics'

interface ParsedTokenAccountInfo {
  mint: string;
  tokenAmount: {
    uiAmount: number | null;
    decimals: number;
  };
}

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

type MetaplexMetadata = {
  symbol: string
  name: string
  uri?: string
  image?: string
}

type MetaplexModule = {
  Metaplex: {
    make: (connection: unknown) => {
      nfts: () => {
        findByMint: (args: { mintAddress: PublicKey }) => unknown
      }
    }
  }
}

let metaplexImportPromise: Promise<MetaplexModule> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    isRecord(value) &&
    typeof (value as Record<string, unknown>).then === 'function' &&
    typeof (value as Record<string, unknown>).catch === 'function'
  )
}

function hasRun(value: unknown): value is { run: () => Promise<unknown> } {
  return isRecord(value) && typeof value.run === 'function'
}

function normalizeExternalUri(input?: string): string | undefined {
  if (!input) return undefined
  const raw = input.trim()
  if (!raw) return undefined

  if (raw.startsWith('ipfs://')) {
    const cid = raw.slice('ipfs://'.length)
    return `https://ipfs.io/ipfs/${cid}`
  }

  if (raw.startsWith('ar://')) {
    const id = raw.slice('ar://'.length)
    return `https://arweave.net/${id}`
  }

  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
    return u.toString()
  } catch {
    return undefined
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchMetaplexMetadata(mint: string): Promise<MetaplexMetadata | null> {
  try {
    metaplexImportPromise ||= import('@metaplex-foundation/js') as unknown as Promise<MetaplexModule>
    const { Metaplex } = await metaplexImportPromise

    return await rpcManager.withFailover(async (connection) => {
      const metaplex = Metaplex.make(connection)
      const mintAddress = new PublicKey(mint)

      const operation = metaplex.nfts().findByMint({ mintAddress }) as unknown
      const nftUnknown = hasRun(operation)
        ? await operation.run()
        : isPromise(operation)
          ? await operation
          : operation

      if (!isRecord(nftUnknown)) return null

      const name = typeof nftUnknown.name === 'string' ? nftUnknown.name : ''
      const symbol = typeof nftUnknown.symbol === 'string' ? nftUnknown.symbol : ''
      const uriRaw =
        (typeof nftUnknown.uri === 'string' && nftUnknown.uri) ||
        (isRecord(nftUnknown.metadata) && typeof nftUnknown.metadata.uri === 'string' && nftUnknown.metadata.uri) ||
        undefined
      const uri = normalizeExternalUri(uriRaw)

      let image: string | undefined
      const jsonImage =
        isRecord(nftUnknown.json) && typeof nftUnknown.json.image === 'string'
          ? nftUnknown.json.image
          : undefined
      image = normalizeExternalUri(jsonImage)

      if (!image && uri) {
        const json = await fetchJsonWithTimeout(uri, 5_000)
        if (isRecord(json)) {
          const candidate =
            (typeof json.image === 'string' && json.image) ||
            (typeof json.logoURI === 'string' && json.logoURI) ||
            (typeof json.icon === 'string' && json.icon) ||
            undefined
          image = normalizeExternalUri(candidate)
        }
      }

      const result: MetaplexMetadata = {
        symbol: symbol.trim(),
        name: name.trim(),
        ...(uri ? { uri } : {}),
        ...(image ? { image } : {}),
      }

      if (!result.symbol && !result.name && !result.image) return null
      return result
    })
  } catch {
    return null
  }
}

// Known tokens static cache for immediate return (Audit Issue #8)
const KNOWN_TOKENS: Record<string, TokenMetadata> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png' },
};

export const walletRouter = router({
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
        const isSol =
          input.token === 'SOL' || input.token === 'So11111111111111111111111111111111111111112'

        // Comment 4: Validate SOL transaction amounts against limits
        if (isSol) {
          const amountValidation = await custodialWalletService.validateTransactionAmount(input.amount, ctx.user.id)
          if (!amountValidation.valid) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: amountValidation.error || 'Invalid amount' })
          }
        } else {
          // Comment 4: Validate SPL token transfers against per-trade limit
          // Estimate USD value using known tokens or by assuming 1:1 for stables
          const isStable = (
            input.token === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
            input.token === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'    // USDT
          )

          // For stablecoins, amount IS the USD value
          // For other tokens, we need to estimate - use a generous limit check
          const estimatedUsd = isStable ? input.amount : input.amount * 100 // Conservative estimate for non-stables

          const { TRANSACTION_LIMITS } = await import('../../lib/services/custodialWallet')
          if (estimatedUsd > TRANSACTION_LIMITS.maxPerTrade) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Token transfer value exceeds maximum of ${TRANSACTION_LIMITS.maxPerTrade} USDC per transaction`
            })
          }
        }

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

        if (isSol) {
          const lamports = Math.floor(input.amount * LAMPORTS_PER_SOL);
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

        const { blockhash } = await rpcManager.withFailover((connection) => connection.getLatestBlockhash());
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPubkey;

        const fee = await rpcManager.withFailover((connection) => connection.getFeeForMessage(transaction.compileMessage()));
        const feeInSOL = (fee?.value || 5000) / LAMPORTS_PER_SOL;

        return {
          fee: feeInSOL,
          feeInLamports: fee?.value || 5000,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
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
        const balance = await rpcManager.withFailover((connection) => connection.getBalance(publicKey));

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

        // Use batchCall to fetch SOL balance and SPL token accounts in parallel
        const [solBalance, tokenAccounts] = await rpcManager.batchCallHeterogeneous<[number, Awaited<ReturnType<typeof rpcManager.getConnection>>['getParsedTokenAccountsByOwner'] extends (...args: any[]) => Promise<infer R> ? R : never]>(
          (connection) => connection.getBalance(publicKey),
          (connection) => connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
        );

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

  generateSignatureNonce: protectedProcedure
    .input(z.object({
      publicKey: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key'),
    }))
    .mutation(async ({ ctx, input }) => {
      const nonce = await nonceManager.generateNonce(ctx.user.id, input.publicKey)
      const timestamp = new Date().toISOString()
      const message = `Sign this message to verify wallet ownership:\nNonce: ${nonce}\nTimestamp: ${timestamp}\nWallet: ${input.publicKey}`
      return { nonce, timestamp, message }
    }),

  /**
   * Link wallet to user account with signature verification
   */
  linkWallet: protectedProcedure
    .input(z.object({
      publicKey: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key'),
      signature: z.string().min(1, 'Signature is required'),
      message: z.string().min(1, 'Message is required'),
      nonce: z.string().min(1, 'Nonce is required'),
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        const existingUser = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { walletAddress: true },
        })

        if (!input.message.includes(`Nonce: ${input.nonce}`)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Message must include nonce' })
        }

        const nonceOk = await nonceManager.validateAndConsumeNonce(input.nonce, ctx.user.id, input.publicKey)
        if (!nonceOk) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired nonce' })
        }

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

        const { AuthService } = await import('../../lib/services/auth')
        await AuthService.invalidateUserCache(ctx.user.id)

        const { birdeyeData } = await import('../../lib/services/birdeyeData')
        if (existingUser?.walletAddress) {
          birdeyeData.clearCache(existingUser.walletAddress)
        }
        birdeyeData.clearCache(input.publicKey)

        // Record successful wallet link metric
        recordWalletOperation('link', true, Date.now() - startTime);
        linkedWalletsTotal.inc();

        return {
          success: true,
          walletAddress: updatedUser.walletAddress,
          message: 'Wallet linked successfully',
        };
      } catch (error) {
        // Record failed wallet link metric
        recordWalletOperation('link', false, Date.now() - startTime);

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
      nonce: z.string().min(1, 'Nonce is required'),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (!input.message.includes(`Nonce: ${input.nonce}`)) {
          return { isValid: false, publicKey: input.publicKey, error: 'Message must include nonce' }
        }

        const nonceOk = await nonceManager.validateNonce(input.nonce, ctx.user.id, input.publicKey)
        if (!nonceOk) {
          return { isValid: false, publicKey: input.publicKey, error: 'Invalid or expired nonce' }
        }

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
        const balance = await rpcManager.withFailover((connection) => connection.getBalance(publicKey));

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
   * Get token metadata for multiple mints (with caching - Audit Issue #8)
   */
  getTokenMetadata: protectedProcedure
    .input(z.object({
      mints: z.array(z.string()).min(1, 'At least one mint address is required').max(100, 'Too many mints requested'),
    }))
    .query(async ({ input }) => {
      try {
        const ttls = getCacheTtls()
        const metadata = await Promise.all(
          input.mints.map(async (mint) => {
            // Check known tokens first (immediate return)
            if (KNOWN_TOKENS[mint]) {
              return {
                mint,
                ...KNOWN_TOKENS[mint],
              };
            }

            const cacheKey: `tokenMetadata:${string}` = `tokenMetadata:${mint}`
            const cached = await redisCache.get<TokenMetadata>(cacheKey)
            if (cached) {
              return {
                mint,
                ...cached,
              };
            }

            let decimals: number | null = null

            // For unknown tokens, try to fetch decimals from chain
            try {
              const mintPubkey = new PublicKey(mint);
              const mintInfo = await rpcManager.withFailover((connection) => connection.getParsedAccountInfo(mintPubkey));

              if (mintInfo.value && 'parsed' in mintInfo.value.data) {
                const parsed = mintInfo.value.data.parsed;
                if (parsed.type === 'mint' && parsed.info) {
                  decimals = parsed.info.decimals || 0
                }
              }
            } catch (error) {
              logger.debug('Failed to fetch metadata for mint:', { mint, error });
            }

            const metaplex = await fetchMetaplexMetadata(mint)
            const data: TokenMetadata = {
              symbol: (metaplex?.symbol && metaplex.symbol.length > 0) ? metaplex.symbol : (decimals !== null ? mint.slice(0, 6).toUpperCase() : 'UNKNOWN'),
              name: (metaplex?.name && metaplex.name.length > 0) ? metaplex.name : (decimals !== null ? 'Unknown Token' : 'Unknown Token'),
              decimals: decimals ?? 0,
              ...(metaplex?.image ? { logoURI: metaplex.image } : {}),
            }

            const ttlSeconds = metaplex ? 86_400 : ttls.tokenMetadata
            await redisCache.set(cacheKey, data, ttlSeconds)
            return { mint, ...data }
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
          const txInfo = await rpcManager.withFailover((connection) =>
            connection.getTransaction(input.signature, { maxSupportedTransactionVersion: 0 })
          );

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

        const ipAddress = ctx.rateLimitContext?.ip || ctx.req?.ip || ctx.fingerprint?.ipAddress || 'unknown'
        const uaHeader = ctx.req?.headers?.['user-agent']
        const userAgent = Array.isArray(uaHeader) ? uaHeader[0] : (typeof uaHeader === 'string' ? uaHeader : ctx.fingerprint?.userAgent)

        await auditLogService.logFinancialOperation({
          userId: ctx.user.id,
          operation: input.type,
          resourceType: 'Transaction',
          resourceId: transaction.id,
          amount: input.amount,
          currency: input.tokenSymbol,
          feeAmount: fee,
          metadata: {
            signature: input.signature,
            token: input.token,
            from: input.from || user.walletAddress,
            to: input.to,
            status: txStatus,
            notes: input.notes ?? null,
          },
          ipAddress,
          userAgent,
        })

        try {
          await amlService.monitorTransaction(
            ctx.user.id,
            transaction.id,
            input.signature,
            input.amount,
            input.tokenSymbol,
            { type: input.type, token: input.token, status: txStatus }
          )
        } catch (error) {
          logger.warn('AML monitoring failed for recorded transaction', { userId: ctx.user.id, transactionId: transaction.id, error })
        }

        logger.info('Transaction recorded successfully:', {
          id: transaction.id,
          signature: input.signature,
          type: input.type,
        });

        // Record transaction metric
        const txType = input.type === 'SEND' ? 'transfer' : input.type === 'RECEIVE' ? 'transfer' : 'swap';
        recordTxMetric(txType, txStatus !== 'FAILED', 0); // Duration not applicable for recorded txs

        return { transaction, alreadyRecorded: false };
      } catch (error) {
        // Record failed transaction metric
        recordTxMetric('transfer', false, 0);

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
