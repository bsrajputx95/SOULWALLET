import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import fetch from 'cross-fetch';
import bs58 from 'bs58';
import prisma from './db';
import { getConnection, executeRpcCall, getRpcStatus } from './services/rpcManager';
import NodeCache from 'node-cache';
import { getFeed } from './services/feedService';
import { verifyToken } from './services/tokenVerifier';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

// Token cache for market data (1 hour TTL)
const tokenCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast if JWT_SECRET is missing
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined');
    process.exit(1);
}

/**
 * Categorize RPC errors for specific error responses
 * Returns { statusCode, message } for client display
 */
const handleRpcError = (error: any): { statusCode: number; message: string } => {
    const errorMsg = error?.message || String(error);

    // Rate limit / throttling
    if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('too many')) {
        return { statusCode: 429, message: 'RPC rate limited, please try again later' };
    }

    // Connection/network errors
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT') ||
        errorMsg.includes('network') || errorMsg.includes('ENOTFOUND')) {
        return { statusCode: 502, message: 'Solana RPC unavailable, try again shortly' };
    }

    // Timeout
    if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        return { statusCode: 504, message: 'RPC request timed out, please retry' };
    }

    // 503 Service unavailable
    if (errorMsg.includes('503') || errorMsg.includes('unavailable')) {
        return { statusCode: 503, message: 'Solana network temporarily unavailable' };
    }

    // Blockhash expired
    if (errorMsg.includes('blockhash')) {
        return { statusCode: 400, message: 'Transaction expired, please try again' };
    }

    // Insufficient balance
    if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
        return { statusCode: 400, message: 'Insufficient balance for transaction and fees' };
    }

    // Default server error
    return { statusCode: 500, message: 'Transaction failed: ' + errorMsg.substring(0, 100) };
};

// Jupiter Price API (FREE - no API key needed)
const JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v3';

// Jupiter Ultra Swap API (FREE - for swap quotes)
const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1';

// DexScreener API for price fallback
const DEXSCREENER_TOKEN_API = 'https://api.dexscreener.com/tokens/v1/solana';

// ====== Middleware Stack ======

// CORS configuration (allow all origins for development)
app.use(cors());

// JSON body parser
app.use(express.json({ limit: '1mb' }));

// Rate limiter (200 requests per 15 minutes per IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Register limiter (stricter)
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: { error: 'Too many registration attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Login limiter: allow reasonable retries but protect from brute force,
// and don't penalize successful logins.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skipSuccessfulRequests: true,
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/register', registerLimiter);
app.use('/login', loginLimiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ====== Type Definitions ======

interface AuthRequest extends Request {
    userId?: string;
}

// ====== Validation Schemas (Zod) ======

const registerSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

const loginSchema = z.object({
    emailOrUsername: z.string().min(1, 'Email or username is required'),
    password: z.string().min(1, 'Password is required'),
});

const profileSchema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
    profileImage: z.string().optional(), // Accepts data URLs (base64) or regular URLs
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const deleteAccountSchema = z.object({
    password: z.string().min(1, 'Password is required'),
});

const linkWalletSchema = z.object({
    publicKey: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address format'),
});

const prepareSendSchema = z.object({
    toAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address'),
    amount: z.number().positive('Amount must be greater than 0'),
    token: z.enum(['SOL', 'USDC']).default('SOL')
});

const broadcastSchema = z.object({
    signedTransaction: z.string().min(10, 'Invalid transaction'),
    txData: z.object({
        toAddress: z.string(),
        amount: z.number(),
        token: z.string()
    })
});

// ====== Authentication Middleware ======

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        req.userId = decoded.userId;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// ====== Endpoints ======

// GET /health - Healthcheck for Railway
app.get('/health', (_req: Request, res: Response) => {
    const rpcStatus = getRpcStatus();
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        rpc: rpcStatus
    });
});

// POST /register
app.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate request body
        const validatedData = registerSchema.parse(req.body);

        // Hash password with bcrypt (10 salt rounds)
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);

        // Normalize username and email to lowercase
        const normalizedUsername = validatedData.username.toLowerCase();
        const normalizedEmail = validatedData.email.toLowerCase();

        // Create user in database
        const user = await prisma.user.create({
            data: {
                username: normalizedUsername,
                email: normalizedEmail,
                password: hashedPassword,
            },
            select: {
                id: true,
                username: true,
                email: true,
                createdAt: true,
            },
        });

        // Generate JWT token with 30-day expiration
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            success: true,
            user,
            token,
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        // Handle Prisma unique constraint violation (P2002)
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            const target = (error as { meta?: { target?: string[] } }).meta?.target;
            if (target?.includes('username')) {
                res.status(409).json({ error: 'Username already exists' });
            } else if (target?.includes('email')) {
                res.status(409).json({ error: 'Email already exists' });
            } else {
                res.status(409).json({ error: 'User already exists' });
            }
            return;
        }

        // Generic error handling
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /login
app.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate request body
        const validatedData = loginSchema.parse(req.body);

        // Normalize input for case-insensitive matching
        const normalizedInput = validatedData.emailOrUsername.toLowerCase();

        // Query user by email OR username
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalizedInput },
                    { username: normalizedInput },
                ],
            },
        });

        // Return 401 for invalid credentials (timing-safe)
        if (!user) {
            // Perform a dummy hash comparison to prevent timing attacks
            // Using a valid precomputed bcrypt hash of "dummy_password"
            await bcrypt.compare(validatedData.password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Compare password hash
        const isValidPassword = await bcrypt.compare(validatedData.password, user.password);

        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Generate JWT token with 30-day expiration
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
            },
            token,
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        // Generic error handling
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /me (Protected)
app.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                dateOfBirth: true,
                profileImage: true,
                currency: true,
                language: true,
                createdAt: true,
            },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            success: true,
            user,
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /profile (Protected)
app.put('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = profileSchema.parse(req.body);

        const user = await prisma.user.update({
            where: { id: req.userId },
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                dateOfBirth: data.dateOfBirth,
                profileImage: data.profileImage,
            },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                dateOfBirth: true,
                profileImage: true,
                currency: true,
                language: true,
            },
        });

        res.json({
            success: true,
            user,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/reset-password (Protected)
app.post('/auth/reset-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);

        if (!isValidPassword) {
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: req.userId },
            data: { password: hashedPassword },
        });

        res.json({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        console.error('Password change error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /account/delete (Protected)
app.post('/account/delete', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { password } = deleteAccountSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            res.status(401).json({ error: 'Password is incorrect' });
            return;
        }

        await prisma.user.delete({
            where: { id: req.userId },
        });

        res.json({
            success: true,
            message: 'Account deleted permanently',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ====== Wallet Endpoints ======

// POST /wallet/link - Link a wallet public key to the authenticated user
app.post('/wallet/link', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { publicKey } = linkWalletSchema.parse(req.body);

        // Verify it's a valid Solana address
        try {
            new PublicKey(publicKey);
        } catch {
            res.status(400).json({ error: 'Invalid Solana address' });
            return;
        }

        // Check if this address is already linked to ANY user
        const existing = await prisma.wallet.findFirst({ where: { publicKey } });
        if (existing) {
            if (existing.userId !== req.userId) {
                // Address belongs to another user - reject
                res.status(409).json({ error: 'Address already linked to another account' });
                return;
            }
            // Address already linked to this user - just return success
            res.json({ success: true, wallet: existing });
            return;
        }

        // Check if this user already has a different wallet linked
        const userExistingWallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
        if (userExistingWallet) {
            // Update to new wallet
            console.log(`[Wallet] Updating wallet for user ${req.userId}: ${userExistingWallet.publicKey} -> ${publicKey}`);
            const updated = await prisma.wallet.update({
                where: { userId: req.userId! },
                data: { publicKey, network: 'mainnet-beta' }
            });
            res.json({ success: true, wallet: updated });
            return;
        }

        // Create new wallet link
        console.log(`[Wallet] Linking new wallet for user ${req.userId}: ${publicKey}`);
        const wallet = await prisma.wallet.create({
            data: { userId: req.userId!, publicKey, network: 'mainnet-beta' }
        });

        res.json({ success: true, wallet });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues[0]?.message || 'Validation failed' });
            return;
        }
        console.error('Wallet link error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Token metadata for common Solana ecosystem tokens
const TOKEN_METADATA: Record<string, { symbol: string; name: string; logo: string }> = {
    'So11111111111111111111111111111111111111112': {
        symbol: 'SOL',
        name: 'Solana',
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
    },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
        symbol: 'USDC',
        name: 'USD Coin',
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
        symbol: 'USDT',
        name: 'Tether USD',
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
        symbol: 'BONK',
        name: 'Bonk',
        logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I'
    },
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
        symbol: 'JUP',
        name: 'Jupiter',
        logo: 'https://static.jup.ag/jup/icon.png'
    },
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': {
        symbol: 'WIF',
        name: 'dogwifhat',
        logo: 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link'
    },
    '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': {
        symbol: 'POPCAT',
        name: 'Popcat',
        logo: 'https://bafkreidvnhdzuq3pvhnzq26hjydmhrr2xw2flkxkflg7swmrxnx7c7xvey.ipfs.nftstorage.link'
    },
    '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN': {
        symbol: 'TRUMP',
        name: 'Official Trump',
        logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN.png'
    },
    'J3NKxxXZcnNiMjKw9hYb2K4LUxmgB8mGaSWt8BYTtC9d': {
        symbol: 'ZEREBRO',
        name: 'Zerebro',
        logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/J3NKxxXZcnNiMjKw9hYb2K4LUxmgB8mGaSWt8BYTtC9d.png'
    },
    'GJtJuWD9qYXG9QDwVcYiXR4eBrwyUPleTwJm9fF21M1u': {
        symbol: 'FWOG',
        name: 'Fwog',
        logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/GJtJuWD9qYXG9QDwVcYiXR4eBrwyUPleTwJm9fF21M1u.png'
    },
    '3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o': {
        symbol: 'MOODENG',
        name: 'Moo Deng',
        logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o.png'
    },
    'orcar6uhH2a9vqgN5NwsA1kpxDi6XN9g9N4GHEFJdZo': {
        symbol: 'ORCA',
        name: 'Orca',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png'
    },
    'RAYdMVKGEAB6seK3RbsKmVweLM9V8rWAz2dEL4M8eMQ': {
        symbol: 'RAY',
        name: 'Raydium',
        logo: 'https://raw.githubusercontent.com/raydium-io/media-assets/master/logo/logo_200x200.png'
    },
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU': {
        symbol: 'SAMO',
        name: 'Samoyedcoin',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/logo.png'
    },
    'AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB': {
        symbol: 'GST',
        name: 'Green Satoshi Token',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB/logo.png'
    },
    'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx': {
        symbol: 'ATLAS',
        name: 'Star Atlas',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx/logo.png'
    },
    'POLISXb3iTD4bWTMJZS2kfF5eSxiiUbv5VQrDzA17Xa': {
        symbol: 'POLIS',
        name: 'Star Atlas DAO',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/POLISXb3iTD4bWTMJZS2kfF5eSxiiUbv5VQrDzA17Xa/logo.png'
    },
    'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTQoSYbFSz7zz': {
        symbol: 'MNDE',
        name: 'Marinade',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTQoSYbFSz7zz/logo.png'
    },
    'SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xUKu8ks': {
        symbol: 'SLND',
        name: 'Solend',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xUKu8ks/logo.png'
    },
    'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {
        symbol: 'PYTH',
        name: 'Pyth Network',
        logo: 'https://pyth.network/token.svg'
    },
    'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': {
        symbol: 'JTO',
        name: 'Jito',
        logo: 'https://metadata.jito.network/token/jto/icon.png'
    },
    'bSo13r4TkiE4xumJKi5GV6UgmsRz8UrMxSMdqywknGn': {
        symbol: 'bSOL',
        name: 'Blaze Staked SOL',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4xumJKi5GV6UgmsRz8UrMxSMdqywknGn/logo.png'
    },
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
        symbol: 'mSOL',
        name: 'Marinade staked SOL',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png'
    },
    'jucy5XJ76pHVvtPZb5TKRcGQExMkVFgTXy8mWbQkWfP': {
        symbol: 'JUICE',
        name: 'JUICE',
        logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/jucy5XJ76pHVvtPZb5TKRcGQExMkVFgTXy8mWbQkWfP.png'
    }
};

// GET /wallet/balances - Get SOL + Token balances with USD prices and 24h changes
app.get('/wallet/balances', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        console.log(`[Balances] Fetching for user: ${req.userId}`);

        // Get user's wallet
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
        if (!wallet) {
            console.log(`[Balances] No wallet linked for user: ${req.userId}`);
            res.status(404).json({ error: 'No wallet linked' });
            return;
        }

        console.log(`[Balances] Found wallet: ${wallet.publicKey}`);

        const pubKey = new PublicKey(wallet.publicKey);
        console.log(`[Balances] Fetching balance for pubkey: ${pubKey.toBase58()}`);

        // 1. Get SOL Balance (with RPC fallback)
        let solBalance: number;
        try {
            solBalance = await executeRpcCall(
                conn => conn.getBalance(pubKey),
                'getBalance'
            );
            console.log(`[Balances] Raw SOL balance (lamports): ${solBalance}`);
        } catch (rpcErr) {
            console.error(`[Balances] RPC Error getting balance:`, rpcErr);
            const { statusCode, message } = handleRpcError(rpcErr);
            res.status(statusCode).json({ error: message });
            return;
        }
        const solAmount = solBalance / LAMPORTS_PER_SOL;
        console.log(`[Balances] SOL amount: ${solAmount}`);

        // 2. Get Token Accounts (SPL tokens like USDC) (with RPC fallback)
        let tokenAccounts: any;
        try {
            tokenAccounts = await executeRpcCall(
                conn => conn.getParsedTokenAccountsByOwner(
                    pubKey,
                    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
                ),
                'getParsedTokenAccountsByOwner'
            );
        } catch (rpcErr) {
            const { statusCode, message } = handleRpcError(rpcErr);
            res.status(statusCode).json({ error: message });
            return;
        }

        // Prepare addresses for price fetch
        const tokenAddresses = [
            'So11111111111111111111111111111111111111112', // SOL wrapped address
            ...tokenAccounts.value.map(t => t.account.data.parsed.info.mint)
        ];

        // 3. Fetch Prices from Jupiter Price V3 API (FREE)
        let prices: Record<string, number> = {};
        try {
            console.log(`[Balances] Fetching prices from Jupiter V3 for ${tokenAddresses.length} tokens...`);
            // Jupiter V3 API: https://lite-api.jup.ag/price/v3?ids=mint1,mint2,...
            const priceResponse = await axios.get(JUPITER_PRICE_API, {
                params: { ids: tokenAddresses.join(',') },
                timeout: 10000
            });
            // Jupiter V3 returns { mint: { usdPrice, decimals, ... }, ... }
            const jupData = priceResponse.data || {};
            console.log(`[Balances] Jupiter V3 response:`, JSON.stringify(jupData).substring(0, 500));
            for (const [mint, info] of Object.entries(jupData)) {
                const price = (info as any)?.usdPrice || 0;
                if (price > 0) {
                    prices[mint] = price;
                    console.log(`[Balances] Jupiter V3 price for ${mint}: $${price}`);
                }
            }
        } catch (priceErr: any) {
            console.warn('[Balances] Jupiter price fetch failed:', priceErr.message || priceErr);
            // Don't fail - we'll use DexScreener fallback
        }

        // 4. Fallback: Fetch prices from DexScreener if Jupiter failed or returned 0
        // Check if any prices are missing or 0
        const needsPriceFallback = tokenAddresses.some(addr => !prices[addr] || prices[addr] === 0);
        if (needsPriceFallback) {
            console.log('[Balances] Fetching fallback prices from DexScreener...');
            try {
                const dsPriceResponse = await axios.get(`${DEXSCREENER_TOKEN_API}/${tokenAddresses.join(',')}`, {
                    timeout: 10000
                });
                const pairs = Array.isArray(dsPriceResponse.data) ? dsPriceResponse.data : [];

                // Build token -> best price map (highest liquidity pair)
                const tokenPriceMap = new Map();
                for (const pair of pairs) {
                    const addr = pair.baseToken?.address;
                    if (addr && (!tokenPriceMap.has(addr) || (pair.liquidity?.usd || 0) > (tokenPriceMap.get(addr).liquidity?.usd || 0))) {
                        tokenPriceMap.set(addr, pair);
                    }
                }

                // Use DexScreener prices for tokens that have 0 or missing price from Jupiter
                for (const [addr, pair] of tokenPriceMap.entries()) {
                    const dsPrice = parseFloat(pair.priceUsd) || 0;
                    if (dsPrice > 0 && (!prices[addr] || prices[addr] === 0)) {
                        prices[addr] = dsPrice;
                        console.log(`[Balances] DexScreener fallback price for ${addr}: $${dsPrice}`);
                    }
                }
            } catch (dsErr: any) {
                console.warn('[Balances] DexScreener price fallback failed:', dsErr.message || dsErr);
            }
        }

        // 5. Fetch 24h Price Changes from DexScreener
        let priceChanges: Record<string, number> = {};
        try {
            // Fetch all tokens in batches of 30 (DexScreener limit)
            const batchSize = 30;
            for (let i = 0; i < tokenAddresses.length; i += batchSize) {
                const batch = tokenAddresses.slice(i, i + batchSize);
                const addresses = batch.join(',');

                try {
                    const dsResponse = await axios.get(`https://api.dexscreener.com/tokens/v1/solana/${addresses}`, {
                        timeout: 10000
                    });

                    // API returns array of pairs
                    const pairs = Array.isArray(dsResponse.data) ? dsResponse.data : [];

                    // Build token -> best pair map (highest liquidity)
                    const tokenPairMap = new Map();
                    for (const pair of pairs) {
                        const addr = pair.baseToken?.address;
                        if (addr && (!tokenPairMap.has(addr) || (pair.liquidity?.usd || 0) > (tokenPairMap.get(addr).liquidity?.usd || 0))) {
                            tokenPairMap.set(addr, pair);
                        }
                    }

                    // Extract 24h change for each token
                    for (const [addr, pair] of tokenPairMap.entries()) {
                        priceChanges[addr] = parseFloat(pair.priceChange?.h24) || 0;
                    }
                } catch (err) {
                    console.warn(`DexScreener batch fetch failed for addresses: ${addresses.substring(0, 50)}...`, err);
                }
            }
        } catch (dsErr) {
            console.warn('DexScreener price change fetch failed:', dsErr);
        }

        // Hardcoded fallback prices for major tokens (last resort)
        const FALLBACK_PRICES: Record<string, number> = {
            'So11111111111111111111111111111111111111112': 85, // SOL ~$85
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC = $1
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT = $1
        };

        // Apply fallback prices if still 0
        for (const [mint, fallbackPrice] of Object.entries(FALLBACK_PRICES)) {
            if (!prices[mint] || prices[mint] === 0) {
                prices[mint] = fallbackPrice;
                console.log(`[Balances] Using fallback price for ${mint}: $${fallbackPrice}`);
            }
        }

        // 6. Format Response
        const holdings = [];
        let totalUsd = 0;

        // Add SOL
        const solPrice = prices['So11111111111111111111111111111111111111112'] || 0;
        const solUsd = solAmount * solPrice;
        totalUsd += solUsd;
        const solMetadata = TOKEN_METADATA['So11111111111111111111111111111111111111112'];

        holdings.push({
            symbol: solMetadata?.symbol || 'SOL',
            name: solMetadata?.name || 'Solana',
            mint: 'So11111111111111111111111111111111111111112',
            balance: solAmount,
            price: solPrice,
            usdValue: solUsd,
            decimals: 9,
            change24h: priceChanges['So11111111111111111111111111111111111111112'] || 0,
            logo: solMetadata?.logo || ''
        });

        // Log token accounts for debugging
        console.log(`[Balances] Found ${tokenAccounts.value.length} token accounts for ${wallet.publicKey}`);

        // Add SPL Tokens
        for (const token of tokenAccounts.value) {
            const info = token.account.data.parsed.info;
            const mint = info.mint;
            const amount = Number(info.tokenAmount.amount) / Math.pow(10, info.tokenAmount.decimals);

            console.log(`[Balances] Token ${mint}: amount=${amount}`);

            if (amount <= 0) continue;

            const price = prices[mint] || 0;
            const usdValue = amount * price;
            totalUsd += usdValue;

            // Get token metadata from our map or use defaults
            const metadata = TOKEN_METADATA[mint];
            let symbol = metadata?.symbol;
            let name = metadata?.name;
            let logo = metadata?.logo;

            // Fallback for unknown tokens — fetch metadata from Jupiter
            if (!symbol) {
                try {
                    const jupTokenRes = await axios.get(`https://tokens.jup.ag/token/${mint}`, { timeout: 3000 });
                    if (jupTokenRes.data && jupTokenRes.data.symbol) {
                        symbol = jupTokenRes.data.symbol;
                        name = jupTokenRes.data.name || jupTokenRes.data.symbol;
                        logo = jupTokenRes.data.logoURI || '';
                    }
                } catch {
                    // Ignore — will use truncated address
                }
            }

            if (!symbol) {
                symbol = mint.slice(0, 6) + '...';
                name = 'Unknown Token';
            }

            // Ensure we always have a logo URL (even if it might not load)
            if (!logo) {
                // Try multiple logo sources
                logo = `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;
            }

            holdings.push({
                symbol,
                name,
                mint,
                balance: amount,
                price,
                usdValue,
                decimals: info.tokenAmount.decimals,
                change24h: priceChanges[mint] || 0,
                logo
            });
        }

        console.log(`[Balances] Returning ${holdings.length} holdings for ${wallet.publicKey}:`, holdings.map(h => h.symbol));

        res.json({
            success: true,
            publicKey: wallet.publicKey,
            totalUsdValue: totalUsd,
            holdings: holdings.sort((a, b) => b.usdValue - a.usdValue)
        });
    } catch (error) {
        console.error('Balance fetch error:', error);
        // Use centralized RPC error handler for specific error responses
        const { statusCode, message } = handleRpcError(error);
        res.status(statusCode).json({ error: message });
    }
});

// Jupiter Tokens API V2 base URL
const JUPITER_TOKENS_API = 'https://lite-api.jup.ag/tokens/v2';

// GET /tokens/search - Search tokens using Jupiter API
app.get('/tokens/search', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string') {
            res.status(400).json({ error: 'Query parameter required' });
            return;
        }

        console.log(`[Tokens] Searching for: ${query}`);

        // Check if it's a mint address (32-44 base58 chars) or a symbol search
        const isMintAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query);

        let tokens = [];

        try {
            // Use Jupiter Tokens V2 API
            const url = `${JUPITER_TOKENS_API}/search?query=${encodeURIComponent(query)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (response.ok) {
                const data = await response.json();
                // Map Jupiter fields to our format
                tokens = (data || []).map((t: any) => ({
                    address: t.id || t.address,
                    symbol: t.symbol,
                    name: t.name,
                    decimals: t.decimals,
                    logoURI: t.icon,
                    verified: t.verified,
                    // Include all original data for TokenDetails
                    ...t
                }));
                console.log(`[Tokens] Found ${tokens.length} tokens from Jupiter`);
            }
        } catch (apiErr: any) {
            console.warn('[Tokens] Jupiter API failed:', apiErr.message);
        }

        // Fallback to hardcoded list if Jupiter fails and it's a known token
        if (tokens.length === 0 && isMintAddress) {
            const knownTokens: Record<string, any> = {
                'So11111111111111111111111111111111111111112': {
                    address: 'So11111111111111111111111111111111111111112',
                    symbol: 'SOL',
                    name: 'Solana',
                    decimals: 9,
                    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
                    verified: true,
                },
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
                    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                    symbol: 'USDC',
                    name: 'USD Coin',
                    decimals: 6,
                    logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
                    verified: true,
                },
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
                    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                    symbol: 'USDT',
                    name: 'Tether',
                    decimals: 6,
                    logoURI: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
                    verified: true,
                },
            };

            if (knownTokens[query]) {
                tokens = [knownTokens[query]];
            }
        }

        res.json({ success: true, tokens });
    } catch (error: any) {
        console.error('[Tokens] Search error:', error.message);
        res.status(500).json({ error: 'Token search failed' });
    }
});

// GET /swap/quote - Proxy swap quote requests to Jupiter Ultra API
app.get('/swap/quote', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { inputMint, outputMint, amount, slippageBps } = req.query;

        if (!inputMint || !outputMint || !amount) {
            res.status(400).json({ error: 'Missing required parameters: inputMint, outputMint, amount' });
            return;
        }

        console.log(`[SwapQuote] Proxying quote: ${inputMint} -> ${outputMint}, amount: ${amount}`);

        // Use Jupiter Ultra API (lite-api.jup.ag)
        const params = new URLSearchParams({
            inputMint: inputMint as string,
            outputMint: outputMint as string,
            amount: amount as string,
        });

        // Add slippage if provided (Ultra API uses slippageBps)
        if (slippageBps) {
            params.append('slippageBps', slippageBps as string);
        }

        const url = `${JUPITER_ULTRA_API}/order?${params}`;
        console.log(`[SwapQuote] Fetching from: ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SwapQuote] Jupiter returned ${response.status}:`, errorText.substring(0, 500));
            res.status(response.status).json({
                error: 'Jupiter API error',
                details: errorText
            });
            return;
        }

        const data = await response.json();

        // Check for Ultra API error response
        if (data.errorCode) {
            console.error(`[SwapQuote] Jupiter error: ${data.errorCode} - ${data.errorMessage}`);
            res.status(400).json({
                error: data.errorMessage || data.errorCode
            });
            return;
        }

        console.log(`[SwapQuote] Success: ${data.outAmount} out`);

        // Transform Ultra API response to match v6 format expected by frontend
        const transformedData = {
            inputMint: data.inputMint,
            outputMint: data.outputMint,
            inAmount: data.inAmount,
            outAmount: data.outAmount,
            otherAmountThreshold: data.otherAmountThreshold,
            swapMode: data.swapMode,
            slippageBps: data.slippageBps,
            priceImpactPct: data.priceImpactPct,
            routePlan: data.routePlan,
            // Ultra API specific fields
            platformFee: data.platformFee,
            feeMint: data.feeMint,
            feeBps: data.feeBps,
            requestId: data.requestId,
            swapType: data.swapType,
            router: data.router,
            priceImpact: data.priceImpact,
            inUsdValue: data.inUsdValue,
            outUsdValue: data.outUsdValue,
            swapUsdValue: data.swapUsdValue,
        };

        res.json(transformedData);

    } catch (error: any) {
        console.error('[SwapQuote] Error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch swap quote',
            details: error.message
        });
    }
});

// POST /swap/transaction - Get swap transaction from Jupiter Ultra API
app.post('/swap/transaction', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { inputMint, outputMint, amount, userPublicKey, slippageBps } = req.body;

        if (!inputMint || !outputMint || !amount || !userPublicKey) {
            res.status(400).json({ error: 'Missing required parameters: inputMint, outputMint, amount, userPublicKey' });
            return;
        }

        console.log(`[SwapTx] Getting swap transaction for: ${userPublicKey}`);

        // Use Jupiter Ultra API - add taker to get transaction
        const params = new URLSearchParams({
            inputMint,
            outputMint,
            amount: amount.toString(),
            taker: userPublicKey,
        });

        if (slippageBps) {
            params.append('slippageBps', slippageBps.toString());
        }

        const url = `${JUPITER_ULTRA_API}/order?${params}`;
        console.log(`[SwapTx] Fetching from: ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SwapTx] Jupiter returned ${response.status}:`, errorText.substring(0, 500));
            res.status(response.status).json({
                error: 'Jupiter API error',
                details: errorText
            });
            return;
        }

        const data = await response.json();

        // Check for Ultra API error response
        if (data.errorCode) {
            console.error(`[SwapTx] Jupiter error: ${data.errorCode} - ${data.errorMessage}`);
            res.status(400).json({
                error: data.errorMessage || data.errorCode
            });
            return;
        }

        console.log(`[SwapTx] Success, transaction returned`);

        // Return in format expected by frontend
        res.json({
            swapTransaction: data.transaction,
            requestId: data.requestId,
            order: data,
        });

    } catch (error: any) {
        console.error('[SwapTx] Error:', error.message);
        res.status(500).json({
            error: 'Failed to build swap transaction',
            details: error.message
        });
    }
});

// POST /swap/execute - Execute a signed swap transaction
app.post('/swap/execute', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { signedTransaction, requestId } = req.body;

        if (!signedTransaction || !requestId) {
            res.status(400).json({ error: 'Missing required parameters: signedTransaction, requestId' });
            return;
        }

        console.log(`[SwapExecute] Executing swap for request: ${requestId}`);

        const url = `${JUPITER_ULTRA_API}/execute`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedTransaction, requestId }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SwapExecute] Jupiter returned ${response.status}:`, errorText.substring(0, 500));
            res.status(response.status).json({
                error: 'Jupiter execute error',
                details: errorText
            });
            return;
        }

        const data = await response.json();
        console.log(`[SwapExecute] Success: ${data.status}`);

        res.json(data);

    } catch (error: any) {
        console.error('[SwapExecute] Error:', error.message);
        res.status(500).json({
            error: 'Failed to execute swap',
            details: error.message
        });
    }
});

// ====== Transaction Endpoints ======

// POST /transactions/prepare-send - Create unsigned transaction for client signing
app.post('/transactions/prepare-send', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const validatedData = prepareSendSchema.parse(req.body);
        const userId = req.userId;

        // Get user's wallet
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            res.status(400).json({ error: 'No wallet linked to account' });
            return;
        }

        const fromPubkey = new PublicKey(wallet.publicKey);
        const toPubkey = new PublicKey(validatedData.toAddress);

        // Only SOL transfers for now
        if (validatedData.token !== 'SOL') {
            res.status(400).json({ error: 'Only SOL transfers supported in Phase 2.2. SPL tokens coming in Phase 2.3' });
            return;
        }

        // Check balance (with RPC fallback)
        let balance: number;
        try {
            balance = await executeRpcCall(
                conn => conn.getBalance(fromPubkey),
                'getBalance'
            );
        } catch (rpcErr) {
            const { statusCode, message } = handleRpcError(rpcErr);
            res.status(statusCode).json({ error: message });
            return;
        }

        const amountLamports = Math.floor(validatedData.amount * LAMPORTS_PER_SOL);
        const feeBuffer = 5000; // 0.000005 SOL for fees

        if (balance < amountLamports + feeBuffer) {
            res.status(400).json({
                error: 'Insufficient balance',
                available: balance / LAMPORTS_PER_SOL,
                required: validatedData.amount + (feeBuffer / LAMPORTS_PER_SOL)
            });
            return;
        }

        // Create unsigned transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: amountLamports,
            })
        );

        // Get latest blockhash (with RPC fallback)
        let blockhash: string;
        let lastValidBlockHeight: number;
        try {
            const blockInfo = await executeRpcCall(
                conn => conn.getLatestBlockhash(),
                'getLatestBlockhash'
            );
            blockhash = blockInfo.blockhash;
            lastValidBlockHeight = blockInfo.lastValidBlockHeight;
        } catch (rpcErr) {
            const { statusCode, message } = handleRpcError(rpcErr);
            res.status(statusCode).json({ error: message });
            return;
        }
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Serialize unsigned transaction
        const serializedTransaction = bs58.encode(
            transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
        );

        res.json({
            success: true,
            transaction: serializedTransaction,
            blockhash,
            lastValidBlockHeight,
            estimatedFee: 0.000005
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues[0]?.message || 'Validation failed' });
            return;
        }
        console.error('Prepare send error:', error);
        // Use centralized RPC error handler for specific error responses
        const { statusCode, message } = handleRpcError(error);
        res.status(statusCode).json({ error: message });
    }
});

// POST /transactions/broadcast - Broadcast signed transaction to Solana
app.post('/transactions/broadcast', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const validatedData = broadcastSchema.parse(req.body);
        const userId = req.userId;

        // Get user's wallet for fromAddress
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            res.status(400).json({ error: 'No wallet linked to account' });
            return;
        }

        // Decode and send the signed transaction (with RPC fallback)
        const signedTxBuffer = bs58.decode(validatedData.signedTransaction);

        const signature = await executeRpcCall(
            conn => conn.sendRawTransaction(signedTxBuffer, {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            }),
            'sendRawTransaction'
        );

        // Wait for confirmation
        const latestBlockhash = await executeRpcCall(
            conn => conn.getLatestBlockhash(),
            'getLatestBlockhash'
        );
        await executeRpcCall(
            conn => conn.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            }, 'confirmed'),
            'confirmTransaction'
        );

        // Save transaction to database
        await prisma.transaction.create({
            data: {
                userId: userId!,
                signature,
                type: 'send',
                amount: validatedData.txData.amount,
                token: validatedData.txData.token,
                fromAddress: wallet.publicKey,
                toAddress: validatedData.txData.toAddress,
                fee: 0.000005,
                status: 'confirmed'
            }
        });

        res.json({
            success: true,
            signature,
            explorerUrl: `https://solscan.io/tx/${signature}`
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues[0]?.message || 'Validation failed' });
            return;
        }

        // Try to save failed transaction
        const userId = (req as AuthRequest).userId;
        if (userId) {
            try {
                const wallet = await prisma.wallet.findUnique({ where: { userId } });
                if (wallet && req.body.txData) {
                    await prisma.transaction.create({
                        data: {
                            userId,
                            signature: `failed_${Date.now()}`,
                            type: 'send',
                            amount: req.body.txData.amount || 0,
                            token: req.body.txData.token || 'SOL',
                            fromAddress: wallet.publicKey,
                            toAddress: req.body.txData.toAddress || 'unknown',
                            fee: 0,
                            status: 'failed'
                        }
                    });
                }
            } catch {
                // Ignore save errors
            }
        }

        // Use centralized RPC error handler for specific error responses
        const { statusCode, message } = handleRpcError(error);
        res.status(statusCode).json({ error: message });
    }
});

// GET /transactions/history - Get user's transaction history
app.get('/transactions/history', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;

        const transactions = await prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        console.error('Transaction history error:', error);
        res.status(500).json({ error: 'Failed to fetch transaction history' });
    }
});

// ====== Copy Trading Endpoints ======

import { queueCopyTrade, markTradeExecuted, getPendingQueueItems, checkBudget } from './services/copyEngine';
import { cancelLimitOrder, checkOrderStatus, getSwapTransaction, getTokenDecimals, calculateSLTPPrices } from './services/jupiterLimitOrder';
import { ensureTraderWebhook, deleteTraderWebhook } from './services/heliusWebhook';
import { ensureCopyWallet, getCopyWallet, getCopyWalletKeypair, getCopyWalletSolBalance, setCopyWalletAllocation } from './services/copyWallet';

const COPY_SOL_MINT = 'So11111111111111111111111111111111111111112';
const COPY_WALLET_TX_FEE_BUFFER_SOL = 0.003;

interface CustodialCopyExecutionParams {
    config: {
        id: string;
        userId: string;
        perTradeAmount: number;
        totalInvestment: number;
        stopLossPercent: number;
        takeProfitPercent: number;
    };
    traderTxSignature: string;
    inputMint: string;
    inputSymbol: string;
    outputMint: string;
    outputSymbol: string;
    inputAmount: number;
    outputAmount: number;
}

async function executeCopyTradeWithCustodialWallet(params: CustodialCopyExecutionParams): Promise<{ success: boolean; signature?: string; error?: string }> {
    let copyKeypair: Keypair | null = null;
    try {
        const positionTradeKey = `${params.traderTxSignature}:${params.config.userId}`;
        const existingPosition = await prisma.copyPosition.findFirst({
            where: {
                configId: params.config.id,
                traderTxSignature: positionTradeKey
            }
        });
        if (existingPosition) {
            return { success: true };
        }

        const openPositionsCount = await prisma.copyPosition.count({
            where: {
                configId: params.config.id,
                status: 'open'
            }
        });
        const projectedUsedBudget = (openPositionsCount + 1) * params.config.perTradeAmount;
        if (projectedUsedBudget > params.config.totalInvestment) {
            return { success: false, error: 'Copy budget exceeded' };
        }

        const copyWallet = await ensureCopyWallet(params.config.userId);
        copyKeypair = await getCopyWalletKeypair(params.config.userId);
        if (!copyKeypair) {
            return { success: false, error: 'Copy wallet keypair unavailable' };
        }

        const spendAmount = Math.min(params.outputAmount, params.config.perTradeAmount);
        if (!Number.isFinite(spendAmount) || spendAmount <= 0) {
            return { success: false, error: 'Invalid spend amount' };
        }

        if (params.outputMint === COPY_SOL_MINT) {
            const currentSolBalance = await getCopyWalletSolBalance(copyWallet.publicKey);
            if (currentSolBalance < spendAmount + COPY_WALLET_TX_FEE_BUFFER_SOL) {
                return { success: false, error: 'Insufficient copy wallet SOL balance' };
            }
        }

        const outputDecimals = await getTokenDecimals(params.outputMint);
        const spendAmountRaw = Math.max(1, Math.floor(spendAmount * Math.pow(10, outputDecimals)));

        const swapTransaction = await getSwapTransaction({
            inputMint: params.outputMint,
            outputMint: params.inputMint,
            amount: spendAmountRaw,
            slippageBps: 50,
            userPublicKey: copyWallet.publicKey
        });

        if (!swapTransaction?.swapTransaction) {
            return { success: false, error: 'Failed to create swap transaction' };
        }

        const txBuffer = Buffer.from(swapTransaction.swapTransaction, 'base64');
        const versionedTx = VersionedTransaction.deserialize(txBuffer);
        versionedTx.sign([copyKeypair]);

        const signature = await executeRpcCall(
            conn => conn.sendRawTransaction(versionedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            }),
            'sendRawTransaction'
        );

        const latestBlockhash = await executeRpcCall(
            conn => conn.getLatestBlockhash(),
            'getLatestBlockhash'
        );
        await executeRpcCall(
            conn => conn.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            }, 'confirmed'),
            'confirmTransaction'
        );

        const effectiveInputAmount = Number.isFinite(params.inputAmount) && params.inputAmount > 0 ? params.inputAmount : 0;
        const entryPrice = effectiveInputAmount > 0 ? spendAmount / effectiveInputAmount : 0;
        const { slPrice, tpPrice } = calculateSLTPPrices(
            entryPrice,
            params.config.stopLossPercent,
            params.config.takeProfitPercent
        );

        await prisma.copyPosition.create({
            data: {
                configId: params.config.id,
                userId: params.config.userId,
                traderTxSignature: positionTradeKey,
                inputMint: params.inputMint,
                inputSymbol: params.inputSymbol,
                outputMint: params.outputMint,
                outputSymbol: params.outputSymbol,
                entryAmount: spendAmount,
                tokenAmount: effectiveInputAmount,
                entryPrice,
                slPrice,
                tpPrice,
                status: 'open'
            }
        });

        const latestBalance = await getCopyWalletSolBalance(copyWallet.publicKey);
        await prisma.copyWallet.update({
            where: { userId: params.config.userId },
            data: {
                availableAmount: latestBalance,
                lastBalanceCheckAt: new Date()
            }
        }).catch(() => { });

        return { success: true, signature };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Custodial execution failed' };
    } finally {
        if (copyKeypair) {
            const secretKeyRef = copyKeypair.secretKey;
            for (let i = 0; i < secretKeyRef.length; i++) {
                secretKeyRef[i] = 0;
            }
            copyKeypair = null;
        }
    }
}

// Validation schemas for copy trading
const copyConfigSchema = z.object({
    name: z.string().max(50).optional(),
    traderAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address'),
    totalInvestment: z.number().positive().max(10000, 'Max $10,000 allowed'),
    perTradeAmount: z.number().positive(),
    stopLossPercent: z.number().min(0).max(50).default(10),  // Allow 0 when exitWithTrader is true
    takeProfitPercent: z.number().min(0).max(1000).default(30), // Allow 0 when exitWithTrader is true
    exitWithTrader: z.boolean().default(true)
}).refine(data => data.perTradeAmount <= data.totalInvestment, {
    message: 'Per-trade amount cannot exceed total investment',
    path: ['perTradeAmount']
});

const copyWalletWithdrawSchema = z.object({
    amount: z.number().positive('Amount must be greater than 0').optional()
});

// POST /copy-trade/wallet/create - Create (or return existing) custodial copy wallet
app.post('/copy-trade/wallet/create', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const wallet = await ensureCopyWallet(req.userId!);
        const balance = await getCopyWalletSolBalance(wallet.publicKey);

        await prisma.copyWallet.update({
            where: { userId: req.userId! },
            data: {
                availableAmount: balance,
                lastBalanceCheckAt: new Date()
            }
        }).catch(() => { });

        res.json({
            success: true,
            wallet: {
                publicKey: wallet.publicKey,
                balance,
                status: wallet.status
            }
        });
    } catch (error) {
        console.error('Create copy wallet error:', error);
        res.status(500).json({ error: 'Failed to create copy wallet' });
    }
});

// GET /copy-trade/wallet - Get custodial copy wallet details + SOL balance
app.get('/copy-trade/wallet', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const wallet = await getCopyWallet(req.userId!);
        if (!wallet) {
            res.json({ success: true, wallet: null });
            return;
        }

        const balance = await getCopyWalletSolBalance(wallet.publicKey);

        await prisma.copyWallet.update({
            where: { userId: req.userId! },
            data: {
                availableAmount: balance,
                lastBalanceCheckAt: new Date()
            }
        }).catch(() => { });

        res.json({
            success: true,
            wallet: {
                publicKey: wallet.publicKey,
                balance,
                status: wallet.status
            }
        });
    } catch (error) {
        console.error('Get copy wallet error:', error);
        res.status(500).json({ error: 'Failed to fetch copy wallet' });
    }
});

// POST /copy-trade/wallet/withdraw - Withdraw SOL from custodial copy wallet to user's main wallet
app.post('/copy-trade/wallet/withdraw', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    let copyKeypair: Keypair | null = null;
    try {
        const data = copyWalletWithdrawSchema.parse(req.body ?? {});
        const userId = req.userId!;

        const copyWallet = await getCopyWallet(userId);
        if (!copyWallet) {
            res.status(404).json({ error: 'Copy wallet not found' });
            return;
        }

        if (copyWallet.status !== 'active') {
            res.status(400).json({ error: 'Copy wallet is not active' });
            return;
        }

        const userWallet = await prisma.wallet.findUnique({
            where: { userId },
            select: { publicKey: true }
        });
        if (!userWallet?.publicKey) {
            res.status(400).json({ error: 'Main wallet not found' });
            return;
        }

        copyKeypair = await getCopyWalletKeypair(userId);
        if (!copyKeypair) {
            res.status(500).json({ error: 'Unable to access copy wallet signing key' });
            return;
        }

        const fromPubkey = new PublicKey(copyWallet.publicKey);
        const toPubkey = new PublicKey(userWallet.publicKey);

        const currentLamports = await executeRpcCall(
            conn => conn.getBalance(fromPubkey, 'confirmed'),
            'getBalance'
        );
        const feeBufferLamports = 5000;
        const requestedLamports = data.amount ? Math.floor(data.amount * LAMPORTS_PER_SOL) : 0;

        const lamportsToWithdraw = requestedLamports > 0
            ? requestedLamports
            : Math.max(0, currentLamports - feeBufferLamports);

        if (lamportsToWithdraw <= 0) {
            res.status(400).json({ error: 'No withdrawable SOL in copy wallet' });
            return;
        }

        if (lamportsToWithdraw + feeBufferLamports > currentLamports) {
            res.status(400).json({
                error: 'Insufficient copy wallet balance',
                available: currentLamports / LAMPORTS_PER_SOL
            });
            return;
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: lamportsToWithdraw
            })
        );

        const latestBlockhash = await executeRpcCall(
            conn => conn.getLatestBlockhash(),
            'getLatestBlockhash'
        );
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
        transaction.feePayer = fromPubkey;
        transaction.sign(copyKeypair);

        const signature = await executeRpcCall(
            conn => conn.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            }),
            'sendRawTransaction'
        );

        await executeRpcCall(
            conn => conn.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            }, 'confirmed'),
            'confirmTransaction'
        );

        const latestBalance = await getCopyWalletSolBalance(copyWallet.publicKey);
        await prisma.copyWallet.update({
            where: { userId },
            data: {
                availableAmount: latestBalance,
                lastBalanceCheckAt: new Date()
            }
        }).catch(() => { });

        res.json({
            success: true,
            signature,
            withdrawnAmount: lamportsToWithdraw / LAMPORTS_PER_SOL,
            toAddress: userWallet.publicKey,
            explorerUrl: `https://solscan.io/tx/${signature}`
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues[0]?.message || 'Validation failed' });
            return;
        }
        console.error('Copy wallet withdraw error:', error);
        const { statusCode, message } = handleRpcError(error);
        res.status(statusCode).json({ error: message });
    } finally {
        if (copyKeypair) {
            const secretKeyRef = copyKeypair.secretKey;
            for (let i = 0; i < secretKeyRef.length; i++) {
                secretKeyRef[i] = 0;
            }
            copyKeypair = null;
        }
    }
});

// POST /copy-trade/config - Create/update copy trading config
app.post('/copy-trade/config', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = copyConfigSchema.parse(req.body);
        const userId = req.userId!;
        const copyWallet = await ensureCopyWallet(userId);

        // Validate per-trade vs total
        if (data.perTradeAmount > data.totalInvestment) {
            res.status(400).json({ error: 'Per-trade amount cannot exceed total investment' });
            return;
        }

        await setCopyWalletAllocation(userId, data.totalInvestment).catch(() => { });

        // Upsert config
        const config = await prisma.copyTradingConfig.upsert({
            where: { userId },
            update: {
                copyWalletId: copyWallet.id,
                name: data.name || undefined,
                traderAddress: data.traderAddress,
                totalInvestment: data.totalInvestment,
                perTradeAmount: data.perTradeAmount,
                stopLossPercent: data.stopLossPercent,
                takeProfitPercent: data.takeProfitPercent,
                exitWithTrader: data.exitWithTrader,
                isActive: true
            },
            create: {
                userId,
                copyWalletId: copyWallet.id,
                name: data.name || undefined,
                traderAddress: data.traderAddress,
                totalInvestment: data.totalInvestment,
                perTradeAmount: data.perTradeAmount,
                stopLossPercent: data.stopLossPercent,
                takeProfitPercent: data.takeProfitPercent,
                exitWithTrader: data.exitWithTrader,
                isActive: true
            }
        });

        // Register webhook for this trader address (non-blocking)
        // Errors are logged but don't fail the request
        ensureTraderWebhook(data.traderAddress).then(result => {
            if (!result.success) {
                console.warn(`[CopyTrading] Webhook registration warning for ${data.traderAddress}:`, result.error);
            }
        }).catch(err => {
            console.error(`[CopyTrading] Webhook registration error:`, err);
        });

        res.json({ success: true, config });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues[0]?.message || 'Validation failed' });
            return;
        }
        console.error('Copy config error:', error);
        res.status(500).json({ error: 'Failed to save copy trading config' });
    }
});

// GET /copy-trade/config - Get user's copy trading config
app.get('/copy-trade/config', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const config = await prisma.copyTradingConfig.findUnique({
            where: { userId: req.userId! },
            include: {
                copyWallet: {
                    select: {
                        publicKey: true,
                        status: true,
                        availableAmount: true,
                        lastBalanceCheckAt: true
                    }
                }
            }
        });

        res.json({ success: true, config });
    } catch (error) {
        console.error('Get copy config error:', error);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

// GET /copy-trade/queue - Get pending trades for user
app.get('/copy-trade/queue', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const items = await getPendingQueueItems(req.userId!);
        res.json({ success: true, queue: items });
    } catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({ error: 'Failed to fetch queue' });
    }
});

// POST /copy-trade/execute/:queueId - Mark trade as executed
app.post('/copy-trade/execute/:queueId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const queueId = req.params.queueId as string;
        const { slOrderId, tpOrderId, executedData } = req.body;

        // Verify queue item belongs to user
        const queueItem = await prisma.copyTradeQueue.findFirst({
            where: { id: queueId, userId: req.userId! }
        });

        if (!queueItem) {
            res.status(404).json({ error: 'Queue item not found' });
            return;
        }

        // Pass executed swap data if provided by client
        const success = await markTradeExecuted(queueId, slOrderId, tpOrderId, executedData);

        if (success) {
            res.json({ success: true, message: 'Trade marked as executed' });
        } else {
            res.status(400).json({ error: 'Failed to execute trade' });
        }
    } catch (error) {
        console.error('Execute trade error:', error);
        res.status(500).json({ error: 'Failed to execute trade' });
    }
});

// GET /copy-trade/positions - List user's open positions (including pending exits)
app.get('/copy-trade/positions', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const positions = await prisma.copyPosition.findMany({
            where: {
                userId: req.userId!,
                OR: [
                    { status: 'open' },
                    { status: 'pending_exit' },
                    { status: 'sl_hit' },
                    { status: 'tp_hit' }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, positions });
    } catch (error) {
        console.error('Get positions error:', error);
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});

// POST /copy-trade/close/:positionId - Initiate position close
// Returns cancel transactions for SL/TP and unsigned sell transaction for client signing
app.post('/copy-trade/close/:positionId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const positionId = req.params.positionId as string;

        const position = await prisma.copyPosition.findFirst({
            where: { id: positionId, userId: req.userId! },
            include: { config: true }
        });

        if (!position) {
            res.status(404).json({ error: 'Position not found' });
            return;
        }

        if (position.status !== 'open' && position.status !== 'pending_exit') {
            res.status(400).json({ error: 'Position already closed' });
            return;
        }

        // Get user's public key from wallet
        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.userId! },
            select: { publicKey: true }
        });

        if (!wallet?.publicKey) {
            res.status(400).json({ error: 'User wallet not found' });
            return;
        }

        // Get cancel transactions for SL/TP orders
        const cancelTransactions: { orderId: string; transaction: string | null }[] = [];

        if (position.slOrderId) {
            const cancelTx = await cancelLimitOrder(position.slOrderId);
            cancelTransactions.push({ orderId: position.slOrderId, transaction: cancelTx });
        }
        if (position.tpOrderId) {
            const cancelTx = await cancelLimitOrder(position.tpOrderId);
            cancelTransactions.push({ orderId: position.tpOrderId, transaction: cancelTx });
        }

        // Get decimals for the input token (the one being sold) from Jupiter token list
        const inputDecimals = await getTokenDecimals(position.inputMint);

        // Calculate raw amount to sell (tokenAmount in smallest units)
        const sellAmountRaw = Math.floor(position.tokenAmount * Math.pow(10, inputDecimals));

        // Get sell swap transaction (sell input token back to output token)
        const sellTransaction = await getSwapTransaction({
            inputMint: position.inputMint,
            outputMint: position.outputMint,
            amount: sellAmountRaw,
            slippageBps: 50,
            userPublicKey: wallet.publicKey
        });

        if (!sellTransaction) {
            res.status(500).json({ error: 'Failed to create sell transaction' });
            return;
        }

        res.json({
            success: true,
            message: 'Close transactions ready - sign and broadcast to complete close',
            cancelTransactions,
            sellTransaction: {
                transaction: sellTransaction.swapTransaction,
                lastValidBlockHeight: sellTransaction.lastValidBlockHeight
            },
            position: {
                id: position.id,
                inputMint: position.inputMint,
                inputSymbol: position.inputSymbol,
                outputMint: position.outputMint,
                outputSymbol: position.outputSymbol,
                tokenAmount: position.tokenAmount
            }
        });
    } catch (error) {
        console.error('Close position error:', error);
        res.status(500).json({ error: 'Failed to close position' });
    }
});

// POST /copy-trade/confirm-close/:positionId - Confirm position closed after sell
app.post('/copy-trade/confirm-close/:positionId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const positionId = req.params.positionId as string;
        const { sellSignature } = req.body;

        const position = await prisma.copyPosition.findFirst({
            where: { id: positionId, userId: req.userId! }
        });

        if (!position) {
            res.status(404).json({ error: 'Position not found' });
            return;
        }

        // Update position status to closed
        await prisma.copyPosition.update({
            where: { id: positionId as string },
            data: {
                status: 'closed',
                closedAt: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Position closed',
            sellSignature
        });
    } catch (error) {
        console.error('Confirm close error:', error);
        res.status(500).json({ error: 'Failed to confirm close' });
    }
});

// DELETE /copy-trade/config - Stop copying (soft delete)
app.delete('/copy-trade/config', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const config = await prisma.copyTradingConfig.findUnique({
            where: { userId: req.userId! },
            include: { positions: { where: { status: 'open' } } }
        });

        if (!config) {
            res.status(404).json({ error: 'Config not found' });
            return;
        }

        // Store trader address before marking inactive
        const traderAddress = config.traderAddress;

        // Collect cancel transactions for all SL/TP orders
        // These must be signed and broadcast by the client to actually cancel orders
        const cancelTransactions: { positionId: string; orderId: string; transaction: string | null }[] = [];
        for (const position of config.positions) {
            if (position.slOrderId) {
                const cancelTx = await cancelLimitOrder(position.slOrderId);
                cancelTransactions.push({ positionId: position.id, orderId: position.slOrderId, transaction: cancelTx });
            }
            if (position.tpOrderId) {
                const cancelTx = await cancelLimitOrder(position.tpOrderId);
                cancelTransactions.push({ positionId: position.id, orderId: position.tpOrderId, transaction: cancelTx });
            }
            // Store cancel transactions on position for client retrieval
            if (position.slOrderId || position.tpOrderId) {
                await prisma.copyPosition.update({
                    where: { id: position.id },
                    data: {
                        cancelTransactions: JSON.stringify(cancelTransactions.filter(c => c.transaction)),
                        status: 'pending_cancel'
                    }
                });
            }
        }

        // Cancel any pending queue items for this config
        await prisma.copyTradeQueue.updateMany({
            where: {
                configId: config.id,
                status: 'pending'
            },
            data: { status: 'cancelled' }
        });

        // Actually delete the config (not just soft-delete)
        await prisma.copyTradingConfig.delete({
            where: { userId: req.userId! }
        });

        // Remove webhook if no other followers (non-blocking)
        deleteTraderWebhook(traderAddress).then(success => {
            if (!success) {
                console.warn(`[CopyTrading] Failed to delete webhook for ${traderAddress}`);
            }
        }).catch(err => {
            console.error(`[CopyTrading] Webhook deletion error:`, err);
        });

        // Return cancel transactions to client - they must be signed and broadcast
        // Orders are NOT canceled until the client signs these transactions
        const validCancels = cancelTransactions.filter(c => c.transaction);
        res.json({
            success: true,
            message: validCancels.length > 0
                ? 'Copy trading stopped. Sign and broadcast cancel transactions to complete.'
                : 'Copy trading stopped',
            cancelTransactions: validCancels,
            pendingPositions: config.positions.map(p => ({ id: p.id, status: 'pending_cancel' }))
        });
    } catch (error) {
        console.error('Stop copy trading error:', error);
        res.status(500).json({ error: 'Failed to stop copy trading' });
    }
});

// POST /webhooks/helius - Helius webhook for trader activity
app.post('/webhooks/helius', async (req: Request, res: Response): Promise<void> => {
    // Always return 200 to Helius immediately
    res.status(200).json({ received: true });

    try {
        // Verify webhook secret
        const authHeader = req.headers.authorization;
        const expectedSecret = process.env.HELIUS_AUTH_HEADER;

        if (expectedSecret && authHeader !== expectedSecret) {
            console.warn('Invalid webhook authorization');
            return;
        }

        const payload = req.body;

        // Process each transaction in the webhook
        const transactions = Array.isArray(payload) ? payload : [payload];

        for (const tx of transactions) {
            // Check if it's a swap/transfer transaction
            // Helius event types: TRANSFER, SWAP, UNKNOWN
            const isRelevant = tx.type === 'SWAP' || tx.type === 'TRANSFER';

            if (!isRelevant) continue;

            // Extract trader address (fee payer)
            const traderAddress = tx.feePayer;
            if (!traderAddress) continue;

            // Find users copying this trader
            const configs = await prisma.copyTradingConfig.findMany({
                where: {
                    traderAddress,
                    isActive: true
                }
            });

            if (configs.length === 0) continue;

            // Extract swap details from token transfers
            const tokenTransfers = tx.tokenTransfers || [];
            const nativeTransfers = tx.nativeTransfers || [];

            // Determine swap direction and amounts
            let inputMint = '';
            let outputMint = '';
            let inputAmount = 0;
            let outputAmount = 0;
            let inputSymbol = '';
            let outputSymbol = '';

            // Parse token transfers to find swap
            if (tokenTransfers.length >= 2) {
                // Usually swap has 2+ transfers (token in, token out)
                // Find the transfer from trader (input) and to trader (output)

                for (const transfer of tokenTransfers) {
                    if (transfer.fromUserAccount === traderAddress) {
                        // Selling this token
                        inputMint = transfer.mint;
                        inputAmount = transfer.tokenAmount;
                        inputSymbol = transfer.symbol || 'Unknown';
                    }
                    if (transfer.toUserAccount === traderAddress) {
                        // Buying this token
                        outputMint = transfer.mint;
                        outputAmount = transfer.tokenAmount;
                        outputSymbol = transfer.symbol || 'Unknown';
                    }
                }
            }

            // Handle SOL transfers (wrapped SOL)
            if (nativeTransfers.length > 0) {
                for (const transfer of nativeTransfers) {
                    if (transfer.fromUserAccount === traderAddress) {
                        inputMint = 'So11111111111111111111111111111111111111112';
                        inputAmount = transfer.amount / 1e9;
                        inputSymbol = 'SOL';
                    }
                    if (transfer.toUserAccount === traderAddress) {
                        outputMint = 'So11111111111111111111111111111111111111112';
                        outputAmount = transfer.amount / 1e9;
                        outputSymbol = 'SOL';
                    }
                }
            }

            if (!inputMint || !outputMint) continue;

            // Determine swap type from trader's perspective
            // If trader receives output token, it's a BUY
            // If trader sends input token (selling something they bought before), it's a SELL
            // For simplicity: if trader receives SOL/USDC/stable, it's a SELL; if they send it, it's a BUY
            const stableMints = ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'];
            const isTraderSellingStable = stableMints.includes(inputMint) || inputMint === 'So11111111111111111111111111111111111111112';
            const isTraderBuyingStable = stableMints.includes(outputMint) || outputMint === 'So11111111111111111111111111111111111111112';

            // Default: if trader is spending stable/SOL, they're buying tokens (BUY)
            // If trader is receiving stable/SOL, they're selling tokens (SELL)
            let swapType: 'buy' | 'sell' = 'buy';
            if (isTraderBuyingStable && !isTraderSellingStable) {
                swapType = 'sell'; // Trader is selling tokens for stable
            } else if (isTraderSellingStable && !isTraderBuyingStable) {
                swapType = 'buy'; // Trader is buying tokens with stable
            }

            // Log trader activity with correct swap type
            await prisma.traderActivity.create({
                data: {
                    traderAddress,
                    txSignature: tx.signature,
                    swapType,
                    inputMint,
                    outputMint,
                    inputAmount,
                    outputAmount,
                    timestamp: new Date(tx.timestamp * 1000)
                }
            }).catch(() => { }); // Ignore duplicates

            // For BUYs, execute server-side from custodial copy wallet first.
            // If execution fails, fall back to legacy queue so users do not miss trades during migration.
            if (swapType === 'buy') {
                // Validate input amounts to prevent divide-by-zero and NaN
                // Skip trades with invalid amounts that would cause calculation errors
                if (inputAmount <= 0 || outputAmount <= 0) {
                    console.warn(`[Webhook] Skipping trade with invalid amounts: input=${inputAmount}, output=${outputAmount}, tx=${tx.signature}`);
                    continue;
                }

                // Calculate price ratio from trader's swap
                // price = inputAmount / outputAmount (what trader spent / what trader received)
                const priceRatio = inputAmount / outputAmount;

                // Guard against NaN/Infinity from unexpected division
                if (!Number.isFinite(priceRatio) || priceRatio <= 0) {
                    console.warn(`[Webhook] Skipping trade with invalid price ratio: ${priceRatio}, tx=${tx.signature}`);
                    continue;
                }

                // Process configs in parallel batches for scalability
                // Limit concurrent executions to avoid overwhelming RPC/BLOCKCHAIN
                const BATCH_SIZE = 10;
                const MAX_SYNC_EXECUTION = 50; // If more copiers, process async in background

                // For very large copier counts, return early and let background processing handle it
                if (configs.length > MAX_SYNC_EXECUTION) {
                    console.log(`[Webhook] Large copier count (${configs.length}), queuing all for async processing`);
                    // Queue all for background processing
                    await Promise.all(configs.map(config => {
                        const cappedOutputAmount = Math.min(config.perTradeAmount, inputAmount);
                        if (cappedOutputAmount <= 0) return Promise.resolve();
                        const proportionalInputAmount = cappedOutputAmount / priceRatio;
                        if (!Number.isFinite(proportionalInputAmount) || proportionalInputAmount < 0) return Promise.resolve();

                        return queueCopyTrade({
                            userId: config.userId,
                            configId: config.id,
                            traderAddress,
                            traderTxSignature: tx.signature,
                            inputMint: outputMint,
                            inputSymbol: outputSymbol,
                            outputMint: inputMint,
                            outputSymbol: inputSymbol,
                            inputAmount: proportionalInputAmount,
                            outputAmount: cappedOutputAmount
                        });
                    }));
                    continue;
                }

                // Process in batches of BATCH_SIZE concurrently
                for (let i = 0; i < configs.length; i += BATCH_SIZE) {
                    const batch = configs.slice(i, i + BATCH_SIZE);

                    await Promise.all(batch.map(async (config) => {
                        // Cap the spend to user's perTradeAmount
                        const cappedOutputAmount = Math.min(config.perTradeAmount, inputAmount);

                        // Skip if capped amount is invalid
                        if (cappedOutputAmount <= 0) {
                            console.warn(`[Webhook] Skipping config ${config.id}: invalid capped amount ${cappedOutputAmount}`);
                            return;
                        }

                        // Calculate proportional input amount based on price ratio
                        const proportionalInputAmount = cappedOutputAmount / priceRatio;

                        // Final validation before writing to database
                        if (!Number.isFinite(proportionalInputAmount) || proportionalInputAmount < 0) {
                            console.warn(`[Webhook] Skipping config ${config.id}: calculated NaN/Infinity input amount`);
                            return;
                        }

                        const custodialExecution = await executeCopyTradeWithCustodialWallet({
                            config: {
                                id: config.id,
                                userId: config.userId,
                                perTradeAmount: config.perTradeAmount,
                                totalInvestment: config.totalInvestment,
                                stopLossPercent: config.stopLossPercent,
                                takeProfitPercent: config.takeProfitPercent
                            },
                            traderTxSignature: tx.signature,
                            inputMint: outputMint,
                            inputSymbol: outputSymbol,
                            outputMint: inputMint,
                            outputSymbol: inputSymbol,
                            inputAmount: proportionalInputAmount,
                            outputAmount: cappedOutputAmount
                        });

                        if (custodialExecution.success) {
                            console.log(`[CopyTrading] Custodial execution success for user ${config.userId} (${tx.signature})`);
                            return;
                        }

                        console.warn(`[CopyTrading] Custodial execution failed for user ${config.userId}, queue fallback: ${custodialExecution.error}`);
                        await queueCopyTrade({
                            userId: config.userId,
                            configId: config.id,
                            traderAddress,
                            traderTxSignature: tx.signature,
                            inputMint: outputMint,
                            inputSymbol: outputSymbol,
                            outputMint: inputMint,
                            outputSymbol: inputSymbol,
                            inputAmount: proportionalInputAmount,
                            outputAmount: cappedOutputAmount
                        });
                    }));
                }
            }
        }
    } catch (error) {
        console.error('Webhook processing error:', error);
    }
});

// In-memory storage for trending tokens with daily refresh
let trendingTokensCache: any[] = [];
let lastTrendingUpdate: Date | null = null;

// Helper to check if we should refresh (past 15:00 UTC today and not yet updated)
function shouldRefreshTrending(): boolean {
    const now = new Date();
    const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()));

    // Check if current time is past 15:00 UTC
    const currentHourUTC = nowUTC.getUTCHours();
    if (currentHourUTC < 15) {
        return false; // Not yet 15:00 UTC
    }

    // If never updated, refresh
    if (!lastTrendingUpdate) {
        return true;
    }

    // Check if last update was before today at 15:00 UTC
    const lastUpdateUTC = new Date(Date.UTC(
        lastTrendingUpdate.getUTCFullYear(),
        lastTrendingUpdate.getUTCMonth(),
        lastTrendingUpdate.getUTCDate(),
        lastTrendingUpdate.getUTCHours(),
        lastTrendingUpdate.getUTCMinutes()
    ));

    const todayAt15UTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0));

    return lastUpdateUTC < todayAt15UTC;
}

// Helper to convert DexScreener icon hash/URL to full CDN URL
// API returns either a full URL or just a hash like "0368cacef34590445c7557761ddcec24127477b49bd2af8dc9cd7027d6e9e74c"
function toDexScreenerImageUrl(value: string | undefined | null, tokenAddress: string): string {
    if (!value || value.trim() === '') {
        // Fallback: Use DexScreener's direct token image CDN
        return `https://dd.dexscreener.com/ds-data/tokens/solana/${tokenAddress}.png`;
    }
    // Already a full URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }
    // It's a hash - construct CDN URL
    return `https://cdn.dexscreener.com/cms/images/${value}?width=64&height=64&fit=crop&quality=95&format=auto`;
}

// Fetch trending tokens from DexScreener - Top 10 by 24h price change (Solana only)
async function fetchTrendingTokens(): Promise<any[]> {
    try {
        console.log('[Trending] Fetching top gainers by 24h price change...');

        // Step 1: Get token profiles for images/banners
        const profilesResponse = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', {
            timeout: 10000
        });
        const profiles = profilesResponse.data || [];

        // Create map of token address -> profile (for images)
        const profileMap = new Map();
        for (const p of profiles) {
            if (p.chainId === 'solana' && p.tokenAddress) {
                profileMap.set(p.tokenAddress, { icon: p.icon, header: p.header });
            }
        }

        // Step 2: Get boosted tokens (these are active/trending on DexScreener)
        const boostsResponse = await axios.get('https://api.dexscreener.com/token-boosts/top/v1', {
            timeout: 10000
        });
        const boosts = boostsResponse.data || [];
        const solanaBoosts = boosts.filter((t: any) => t.chainId === 'solana');

        if (solanaBoosts.length === 0) {
            console.log('[Trending] No Solana tokens, using fallback');
            return trendingTokensCache.length > 0 ? trendingTokensCache : getFallbackTokens();
        }

        // Step 3: Get pair data for price info (batch up to 30 addresses)
        const addresses = solanaBoosts.slice(0, 30).map((t: any) => t.tokenAddress).join(',');
        const pairsResponse = await axios.get(`https://api.dexscreener.com/tokens/v1/solana/${addresses}`, {
            timeout: 15000
        });

        // API returns array directly, not nested under .pairs
        const pairs = Array.isArray(pairsResponse.data) ? pairsResponse.data : [];
        console.log('[Trending] Pairs fetched:', pairs.length, 'for addresses:', addresses.split(',').length);

        // Build token -> best pair map (highest liquidity pair per token)
        const tokenPairMap = new Map();
        for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (addr && (!tokenPairMap.has(addr) || (pair.liquidity?.usd || 0) > (tokenPairMap.get(addr).liquidity?.usd || 0))) {
                tokenPairMap.set(addr, pair);
            }
        }
        console.log('[Trending] Unique tokens mapped:', tokenPairMap.size);

        // Step 4: Transform and sort by 24h price change (biggest gainers first)
        const transformedTokens = solanaBoosts
            .map((boost: any) => {
                const pair = tokenPairMap.get(boost.tokenAddress);
                const profile = profileMap.get(boost.tokenAddress);

                // Get image from multiple sources, converting hashes to full URLs
                const rawIcon = profile?.icon || boost.icon || pair?.info?.imageUrl || '';
                const logo = toDexScreenerImageUrl(rawIcon, boost.tokenAddress);

                // Banner: convert hash to URL if needed
                const rawBanner = profile?.header || boost.header || pair?.info?.header || '';
                const banner = rawBanner && !rawBanner.startsWith('http')
                    ? `https://cdn.dexscreener.com/cms/images/${rawBanner}?width=900&height=300&fit=crop&quality=95&format=auto`
                    : rawBanner;

                return {
                    address: boost.tokenAddress,
                    symbol: pair?.baseToken?.symbol || boost.tokenAddress.slice(0, 6),
                    name: pair?.baseToken?.name || 'Unknown',
                    price: parseFloat(pair?.priceUsd) || 0,
                    priceChange24h: parseFloat(pair?.priceChange?.h24) || 0,
                    volume24h: parseFloat(pair?.volume?.h24) || 0,
                    marketCap: parseFloat(pair?.marketCap) || parseFloat(pair?.fdv) || 0,
                    liquidity: parseFloat(pair?.liquidity?.usd) || 0,
                    logo,
                    banner
                };
            })
            .filter((t: any) => t.price > 0) // Only tokens with valid prices
            .sort((a: any, b: any) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h)) // Sort by biggest movers
            .slice(0, 10); // Top 10

        console.log('[Trending] Sample token data:', JSON.stringify(transformedTokens[0] || {}, null, 2));
        console.log('[Trending] Tokens:', transformedTokens.map((t: any) => `${t.symbol}(${t.priceChange24h.toFixed(1)}%)`).join(', '));
        return transformedTokens;
    } catch (error: any) {
        console.error('[Trending] API error:', error.message || error);
        return trendingTokensCache.length > 0 ? trendingTokensCache : getFallbackTokens();
    }
}

// Fallback: Top Solana tokens when API fails
function getFallbackTokens(): any[] {
    return [
        { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', price: 100, priceChange24h: 5.2, volume24h: 2000000000, marketCap: 45000000000, liquidity: 500000000, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
        { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', price: 1, priceChange24h: 0.01, volume24h: 800000000, marketCap: 25000000000, liquidity: 1000000000, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
        { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', price: 0.8, priceChange24h: 12.5, volume24h: 150000000, marketCap: 1200000000, liquidity: 80000000, logo: 'https://static.jup.ag/jup/icon.png' },
        { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', price: 0.00002, priceChange24h: 8.3, volume24h: 120000000, marketCap: 800000000, liquidity: 50000000, logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
        { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', price: 1.5, priceChange24h: -3.2, volume24h: 100000000, marketCap: 1500000000, liquidity: 60000000, logo: 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link' },
        { address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', symbol: 'TRUMP', name: 'Official Trump', price: 15, priceChange24h: 25.4, volume24h: 500000000, marketCap: 3000000000, liquidity: 100000000, logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN.png' },
        { address: '3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o', symbol: 'MOODENG', name: 'Moo Deng', price: 0.05, priceChange24h: 18.7, volume24h: 80000000, marketCap: 50000000, liquidity: 20000000, logo: '' },
        { address: 'J3NKxxXZcnNiMjKw9hYb2K4LUxmgB8mGaSWt8BYTtC9d', symbol: 'ZEREBRO', name: 'Zerebro', price: 0.02, priceChange24h: 35.2, volume24h: 45000000, marketCap: 20000000, liquidity: 15000000, logo: '' },
        { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', symbol: 'POPCAT', name: 'Popcat', price: 0.4, priceChange24h: 6.8, volume24h: 60000000, marketCap: 400000000, liquidity: 35000000, logo: 'https://bafkreidvnhdzuq3pvhnzq26hjydmhrr2xw2flkxkflg7swmrxnx7c7xvey.ipfs.nftstorage.link' },
        { address: 'GJtJuWD9qYXG9QDwVcYiXR4eBrwyUPleTwJm9fF21M1u', symbol: 'FWOG', name: 'Fwog', price: 0.015, priceChange24h: 42.1, volume24h: 30000000, marketCap: 15000000, liquidity: 8000000, logo: '' },
    ];
}

// GET /market/tokens - Get top 30 SOLANA tokens sorted by 1h price change (trending in last hour)
app.get('/market/tokens', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
    try {
        // Check cache first
        const cached = tokenCache.get('top_tokens');
        if (cached) {
            res.json({ success: true, tokens: cached, cached: true });
            return;
        }

        // Step 1: Get token profiles for images/banners
        const profilesResponse = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', {
            timeout: 10000
        });
        const profiles = profilesResponse.data || [];

        // Create map of token address -> profile (for images)
        const profileMap = new Map();
        for (const p of profiles) {
            if (p.chainId === 'solana' && p.tokenAddress) {
                profileMap.set(p.tokenAddress, { icon: p.icon, header: p.header });
            }
        }

        // Step 2: Get boosted tokens
        const boostsResponse = await axios.get('https://api.dexscreener.com/token-boosts/top/v1', {
            timeout: 10000
        });
        const boosts = boostsResponse.data || [];
        const solanaBoosts = boosts.filter((t: any) => t.chainId === 'solana');

        if (solanaBoosts.length === 0) {
            const stale = tokenCache.get('top_tokens');
            if (stale) {
                res.json({ success: true, tokens: stale, cached: true, stale: true });
                return;
            }
            res.status(500).json({ error: 'No tokens available' });
            return;
        }

        // Step 3: Get pair data for price info (batch up to 30 addresses for API limit)
        const addresses = solanaBoosts.slice(0, 30).map((t: any) => t.tokenAddress).join(',');
        const pairsResponse = await axios.get(`https://api.dexscreener.com/tokens/v1/solana/${addresses}`, {
            timeout: 15000
        });

        // API returns array directly
        const pairs = Array.isArray(pairsResponse.data) ? pairsResponse.data : [];
        console.log('[Market] Pairs fetched:', pairs.length);

        // Build token -> best pair map (highest liquidity pair per token)
        const tokenPairMap = new Map();
        for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (addr && (!tokenPairMap.has(addr) || (pair.liquidity?.usd || 0) > (tokenPairMap.get(addr).liquidity?.usd || 0))) {
                tokenPairMap.set(addr, pair);
            }
        }
        console.log('[Market] Unique tokens mapped:', tokenPairMap.size);

        // Step 4: Transform and sort by 1h price change (biggest movers = trending in last hour)
        const transformedTokens = solanaBoosts
            .map((boost: any) => {
                const pair = tokenPairMap.get(boost.tokenAddress);
                const profile = profileMap.get(boost.tokenAddress);

                // Get image from multiple sources, converting hashes to full URLs
                const rawIcon = profile?.icon || boost.icon || pair?.info?.imageUrl || '';
                const logo = toDexScreenerImageUrl(rawIcon, boost.tokenAddress);

                // Banner: convert hash to URL if needed
                const rawBanner = profile?.header || boost.header || pair?.info?.header || '';
                const banner = rawBanner && !rawBanner.startsWith('http')
                    ? `https://cdn.dexscreener.com/cms/images/${rawBanner}?width=900&height=300&fit=crop&quality=95&format=auto`
                    : rawBanner;

                return {
                    address: boost.tokenAddress,
                    symbol: pair?.baseToken?.symbol || boost.tokenAddress.slice(0, 6),
                    name: pair?.baseToken?.name || 'Unknown',
                    price: parseFloat(pair?.priceUsd) || 0,
                    priceChange24h: parseFloat(pair?.priceChange?.h24) || 0,
                    priceChange1h: parseFloat(pair?.priceChange?.h1) || 0,
                    volume24h: parseFloat(pair?.volume?.h24) || 0,
                    marketCap: parseFloat(pair?.marketCap) || parseFloat(pair?.fdv) || 0,
                    liquidity: parseFloat(pair?.liquidity?.usd) || 0,
                    logo,
                    banner
                };
            })
            .filter((t: any) => t.price > 0) // Only tokens with valid prices
            .sort((a: any, b: any) => Math.abs(b.priceChange1h) - Math.abs(a.priceChange1h)) // Sort by 1h change
            .slice(0, 50); // Top 50 (frontend shows 30)

        // Cache the results
        tokenCache.set('top_tokens', transformedTokens);

        console.log('[Market] Sample:', JSON.stringify(transformedTokens[0] || {}, null, 2));
        console.log('[Market] Top tokens by 1h change:', transformedTokens.slice(0, 5).map((t: any) => `${t.symbol}(${t.priceChange1h?.toFixed(1)}%)`).join(', '));
        res.json({ success: true, tokens: transformedTokens, cached: false });
    } catch (error) {
        console.error('Market tokens fetch error:', error);

        // Return stale cache if available
        const stale = tokenCache.get('top_tokens');
        if (stale) {
            res.json({ success: true, tokens: stale, cached: true, stale: true });
            return;
        }

        res.status(500).json({ error: 'Failed to fetch market tokens' });
    }
});

// GET /market/trending - Get top 10 trending tokens (refreshes daily at 15:00 UTC)
app.get('/market/trending', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
    try {
        // Check if we need to refresh (past 15:00 UTC and not updated today)
        if (shouldRefreshTrending() || trendingTokensCache.length === 0) {
            const tokens = await fetchTrendingTokens();
            if (tokens.length > 0) {
                trendingTokensCache = tokens;
                lastTrendingUpdate = new Date();
            }
        }

        res.json({
            success: true,
            tokens: trendingTokensCache,
            lastUpdated: lastTrendingUpdate?.toISOString() || null
        });
    } catch (error) {
        console.error('Trending tokens error:', error);
        // Return cached data even if error
        res.json({
            success: true,
            tokens: trendingTokensCache,
            lastUpdated: lastTrendingUpdate?.toISOString() || null,
            stale: true
        });
    }
});

// ============================================
// SOCIAL FEED ENDPOINTS
// ============================================

// Create Post
app.post('/posts', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, visibility, tokenAddress, tokenSymbol, tokenName, tokenVerified, tokenPriceAtPost } = req.body;

        if (!content || content.length > 500) {
            res.status(400).json({ error: 'Content required, max 500 chars' });
            return;
        }

        let tokenData = null;
        if (tokenAddress) {
            try {
                new PublicKey(tokenAddress);
                // Use provided token metadata if verified, otherwise fetch from Jupiter
                if (tokenVerified && tokenSymbol) {
                    tokenData = {
                        address: tokenAddress,
                        symbol: tokenSymbol,
                        name: tokenName || tokenSymbol,
                        verified: true,
                        price: tokenPriceAtPost || 0
                    };
                } else {
                    // Fetch token info from Jupiter
                    const jupRes = await axios.get(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);
                    const priceData = jupRes.data.data[tokenAddress];
                    if (priceData) {
                        tokenData = {
                            address: tokenAddress,
                            symbol: priceData.mintSymbol || 'Unknown',
                            name: priceData.mintSymbol || 'Unknown Token',
                            verified: true,
                            price: priceData.price || 0
                        };
                    }
                }
            } catch {
                tokenData = {
                    address: tokenAddress,
                    symbol: tokenSymbol || 'Unknown',
                    name: tokenName || 'Unknown Token',
                    verified: false,
                    price: 0
                };
            }
        }

        const post = await prisma.post.create({
            data: {
                userId: req.userId!,
                content,
                visibility: visibility || 'public',
                tokenAddress: tokenData?.address,
                tokenSymbol: tokenData?.symbol,
                tokenName: tokenData?.name,
                tokenVerified: tokenData?.verified || false,
                tokenPriceAtPost: tokenData?.price
            },
            include: {
                user: { select: { username: true, profileImage: true } }
            }
        });

        res.status(201).json({ success: true, post });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Get Feed
app.get('/feed', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { cursor, limit = '20', mode } = req.query;
        const { posts, nextCursor } = await getFeed(req.userId!, cursor as string, parseInt(limit as string), mode as string);

        const postIds = posts.map((p: any) => p.id);
        const userLikes = await prisma.like.findMany({
            where: { postId: { in: postIds }, userId: req.userId! },
            select: { postId: true }
        });
        const likedIds = new Set(userLikes.map(l => l.postId));

        res.json({
            success: true,
            posts: posts.map((p: any) => ({ ...p, isLiked: likedIds.has(p.id) })),
            nextCursor
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

// Vote on Post (Agree/Disagree) - MUST be before /posts/:id
app.post('/posts/:id/vote', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const postId = req.params.id as string;
        const { type } = req.body; // "agree" or "disagree"

        if (!type || (type !== 'agree' && type !== 'disagree')) {
            res.status(400).json({ error: 'Vote type must be "agree" or "disagree"' });
            return;
        }

        // Check if user already voted on this post
        const existingVote = await prisma.vote.findUnique({
            where: { postId_userId: { postId, userId: req.userId! } }
        });

        if (existingVote) {
            res.status(409).json({ error: 'You have already voted on this post', existingVote });
            return;
        }

        // Create the vote
        const vote = await prisma.vote.create({
            data: {
                postId,
                userId: req.userId!,
                type
            }
        });

        res.status(201).json({ success: true, vote });
    } catch (err) {
        res.status(500).json({ error: 'Failed to vote' });
    }
});

// Get vote counts for a post - MUST be before /posts/:id
app.get('/posts/:id/votes', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const postId = req.params.id as string;

        // Get all votes for this post
        const votes = await prisma.vote.findMany({
            where: { postId }
        });

        // Get user's vote if any
        const userVote = await prisma.vote.findUnique({
            where: { postId_userId: { postId, userId: req.userId! } }
        });

        // Calculate metrics
        const agreeCount = votes.filter(v => v.type === 'agree').length;
        const disagreeCount = votes.filter(v => v.type === 'disagree').length;
        const totalVotes = agreeCount + disagreeCount;

        // Calculate percentages (round off, no decimals)
        let agreePercent = 0;
        let disagreePercent = 0;

        if (totalVotes > 0) {
            agreePercent = Math.round((agreeCount / totalVotes) * 100);
            disagreePercent = Math.round((disagreeCount / totalVotes) * 100);
        }

        res.json({
            success: true,
            agreeCount,
            disagreeCount,
            totalVotes,
            agreePercent,
            disagreePercent,
            userVote: userVote?.type || null
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch votes' });
    }
});

// Get Single Post
app.get('/posts/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const postId = req.params.id as string;
        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                user: { select: { id: true, username: true, profileImage: true } },
                comments: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                    include: { user: { select: { username: true, profileImage: true } } }
                },
                _count: { select: { likes: true, comments: true } }
            }
        });

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        if (post.visibility === 'followers') {
            const isFollowing = await prisma.follow.findFirst({
                where: { followerId: req.userId!, followingId: post.userId }
            });
            if (!isFollowing && post.userId !== req.userId) {
                res.status(403).json({ error: 'Private post' });
                return;
            }
        }

        // VIP posts: allow the post owner to retrieve VIP posts
        // Block non-owners until VIP membership is implemented
        if (post.visibility === 'vip') {
            if (post.userId !== req.userId) {
                res.status(403).json({ error: 'VIP posts not available yet' });
                return;
            }
            // Owner is allowed to proceed
        }

        const isLiked = await prisma.like.findFirst({
            where: { postId: post.id, userId: req.userId! }
        });

        res.json({
            success: true,
            post: {
                ...post,
                isLiked: !!isLiked,
                likesCount: post._count.likes,
                commentsCount: post._count.comments
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch post' });
    }
});

// Delete Post
app.delete('/posts/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const postId = req.params.id as string;
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        if (post.userId !== req.userId) {
            res.status(403).json({ error: 'Not authorized' });
            return;
        }

        await prisma.post.delete({ where: { id: postId } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// Like/Unlike
app.post('/posts/:id/like', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const postId = req.params.id as string;
        const existing = await prisma.like.findUnique({
            where: { postId_userId: { postId: postId, userId: req.userId! } }
        });

        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            await prisma.post.update({
                where: { id: postId },
                data: { likesCount: { decrement: 1 } }
            });
            res.json({ success: true, liked: false });
        } else {
            await prisma.like.create({
                data: { postId: postId, userId: req.userId! }
            });
            await prisma.post.update({
                where: { id: postId },
                data: { likesCount: { increment: 1 } }
            });
            res.json({ success: true, liked: true });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

// Add Comment
app.post('/posts/:id/comment', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const postId = req.params.id as string;
        const { content } = req.body;
        if (!content || content.length > 300) {
            res.status(400).json({ error: 'Content required, max 300 chars' });
            return;
        }

        // Load the target post first
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, userId: true, visibility: true }
        });

        // If missing, return 404
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Visibility checks
        if (post.visibility === 'followers') {
            // Ensure requester is the author or follows the author
            const isAuthor = post.userId === req.userId;
            if (!isAuthor) {
                const isFollowing = await prisma.follow.findFirst({
                    where: { followerId: req.userId!, followingId: post.userId }
                });
                if (!isFollowing) {
                    res.status(403).json({ error: 'Cannot comment on this post' });
                    return;
                }
            }
        }

        if (post.visibility === 'vip') {
            // Reject until VIP is implemented - only author can comment
            if (post.userId !== req.userId) {
                res.status(403).json({ error: 'VIP posts not available yet' });
                return;
            }
        }

        // Only then create the comment and increment commentsCount
        const comment = await prisma.comment.create({
            data: { postId: postId, userId: req.userId!, content },
            include: { user: { select: { username: true, profileImage: true } } }
        });

        await prisma.post.update({
            where: { id: postId },
            data: { commentsCount: { increment: 1 } }
        });

        res.status(201).json({ success: true, comment });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Get User Profile
app.get('/users/:username', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const username = req.params.username as string;
        const user = await prisma.user.findUnique({
            where: { username: username },
            include: {
                wallet: { select: { publicKey: true } },
                _count: { select: { followersRel: true, followingRel: true, posts: true } }
            }
        }) as any;

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isFollowing = await prisma.follow.findFirst({
            where: { followerId: req.userId!, followingId: user.id }
        });

        const isCopying = await prisma.copyTradingConfig.findFirst({
            where: { userId: req.userId!, traderAddress: user.wallet?.publicKey }
        });

        const copyTraderCount = await prisma.copyTradingConfig.count({
            where: { traderAddress: user.wallet?.publicKey, isActive: true }
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                profileImage: user.profileImage,
                walletAddress: user.wallet?.publicKey,
                followers: user._count?.followersRel || 0,
                following: user._count?.followingRel || 0,
                postsCount: user._count?.posts || 0,
                copyTraderCount,
                isFollowing: !!isFollowing,
                isCopying: !!isCopying,
                roi30d: user.roi30d || 0,
                winRate: user.winRate || 0,
                maxDrawdown: user.maxDrawdown || null,
                followersEquity: user.followersEquity || null
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Get User's Posts
app.get('/users/:username/posts', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const username = req.params.username as string;
        const visibility = req.query.visibility as string | undefined;
        const user = await prisma.user.findUnique({
            where: { username: username },
            select: { id: true, profileImage: true }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isOwnProfile = user.id === req.userId;

        const where: any = { userId: user.id };

        // Filter by visibility if specified and viewing own profile
        if (visibility && isOwnProfile) {
            where.visibility = visibility;
        } else if (isOwnProfile) {
            // Owner can see all their own posts
            where.OR = [
                { visibility: 'public' },
                { visibility: 'followers' },
                { visibility: 'vip' }
            ];
        } else {
            // Check if current user follows the target user
            const isFollowing = await prisma.follow.findFirst({
                where: { followerId: req.userId!, followingId: user.id }
            });

            // If following, show both public and followers-only posts
            // Otherwise, show only public posts
            if (isFollowing) {
                where.OR = [
                    { visibility: 'public' },
                    { visibility: 'followers' }
                ];
            } else {
                where.visibility = 'public';
            }
            // TODO: Show VIP posts if subscribed
        }

        const posts = await prisma.post.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { likes: true, comments: true } },
                likes: { where: { userId: req.userId! }, select: { id: true } }
            }
        });

        const formattedPosts = posts.map(post => ({
            id: post.id,
            userId: post.userId,
            content: post.content,
            visibility: post.visibility,
            tokenAddress: post.tokenAddress,
            tokenSymbol: post.tokenSymbol,
            tokenName: post.tokenName,
            likesCount: post._count.likes,
            commentsCount: post._count.comments,
            createdAt: post.createdAt,
            user: { username: username, profileImage: user.profileImage || null },
            isLiked: post.likes.length > 0
        }));

        res.json({ success: true, posts: formattedPosts });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Follow/Unfollow
app.post('/users/:id/follow', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const targetUserId = req.params.id as string;

        if (targetUserId === req.userId) {
            res.status(400).json({ error: 'Cannot follow yourself' });
            return;
        }

        const existing = await prisma.follow.findFirst({
            where: { followerId: req.userId!, followingId: targetUserId }
        });

        if (existing) {
            await prisma.follow.delete({ where: { id: existing.id } });
            await prisma.user.update({
                where: { id: targetUserId },
                data: { followers: { decrement: 1 } }
            });
            await prisma.user.update({
                where: { id: req.userId! },
                data: { following: { decrement: 1 } }
            });
            res.json({ success: true, following: false });
        } else {
            await prisma.follow.create({
                data: { followerId: req.userId!, followingId: targetUserId }
            });
            await prisma.user.update({
                where: { id: targetUserId },
                data: { followers: { increment: 1 } }
            });
            await prisma.user.update({
                where: { id: req.userId! },
                data: { following: { increment: 1 } }
            });
            res.json({ success: true, following: true });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle follow' });
    }
});

// ====== IBUY Endpoints ======

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Token Verification
app.post('/tokens/verify', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { address } = req.body;
        if (!address) {
            res.status(400).json({ error: 'Token address required' });
            return;
        }
        const result = await verifyToken(address);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Token verification failed' });
    }
});

// IBUY Prepare - Now uses Queue System for viral post handling
import { enqueueIBuy, getQueueStatus, processIBuyQueue, completeIBuy } from './services/ibuyQueueService';

app.post('/ibuy/prepare', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { postId, amount } = req.body;
        if (!postId || !amount || amount <= 0) {
            res.status(400).json({ error: 'Post ID and valid amount required' });
            return;
        }

        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: { user: { include: { wallet: true } } }
        });

        if (!post || !post.tokenAddress) {
            res.status(400).json({ error: 'Post not found or has no token' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.userId! },
            include: { wallet: true }
        });

        if (!user?.wallet?.publicKey) {
            res.status(400).json({ error: 'User wallet not found' });
            return;
        }

        // Add to queue for processing (handles viral scenarios)
        const result = await enqueueIBuy(req.userId!, postId, amount);

        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }

        // Get queue status
        const status = await getQueueStatus(req.userId!);

        res.json({
            success: true,
            queued: true,
            queueId: result.queueId,
            position: result.position,
            message: `Queued at position ${result.position}. Processing ${status.processing} items.`,
            postId,
            tokenAddress: post.tokenAddress,
            tokenSymbol: post.tokenSymbol || 'Unknown',
            creatorWallet: post.user.wallet?.publicKey
        });
    } catch (err: any) {
        console.error('IBUY prepare error:', err?.response?.data || err.message);
        res.status(500).json({ error: err.message || 'Failed to prepare IBUY' });
    }
});

// IBUY Queue Status
app.get('/ibuy/queue', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const status = await getQueueStatus(req.userId!);
        res.json({
            success: true,
            pending: status.pending,
            processing: status.processing,
            items: status.userQueue
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// IBUY Process Queue (admin/worker endpoint - call periodically)
app.post('/ibuy/process-queue', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { batchSize = 10 } = req.body;
        const result = await processIBuyQueue(batchSize);
        res.json({
            success: true,
            processed: result.processed,
            successful: result.successful,
            failed: result.failed
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// IBUY Execute - Now completes queue item
app.post('/ibuy/execute', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { queueId, signature } = req.body;

        if (!queueId || !signature) {
            res.status(400).json({ error: 'Queue ID and signature required' });
            return;
        }

        // Complete the queued iBuy
        const result = await completeIBuy(queueId, signature, req.userId!);

        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }

        res.json({ success: true, positionId: result.positionId });
    } catch (err) {
        console.error('IBUY execute error:', err);
        res.status(500).json({ error: 'Failed to execute IBUY' });
    }
});

// Get IBUY Positions
app.get('/ibuy/positions', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const positions = await prisma.iBuyPosition.findMany({
            where: { userId: req.userId!, status: 'open' }
        });

        // Get unique token addresses
        const tokenAddresses = [...new Set(positions.map(p => p.tokenAddress))];

        // Fetch current prices from Jupiter
        const prices: Record<string, number> = {};
        if (tokenAddresses.length > 0) {
            try {
                const priceRes = await axios.get(`https://price.jup.ag/v6/price?ids=${tokenAddresses.join(',')}`, {
                    timeout: 5000
                });
                for (const addr of tokenAddresses) {
                    prices[addr] = priceRes.data.data?.[addr]?.price || 0;
                }
            } catch {
                // Prices will be 0 if fetch fails
            }
        }

        // Calculate P&L for each position (prices in USD)
        const positionsWithPnl = positions.map(pos => {
            const currentPrice = prices[pos.tokenAddress] || 0; // USD per token
            const currentValue = pos.remainingAmount * currentPrice; // USD
            const costBasis = pos.remainingAmount * pos.entryPrice; // USD (entryPrice stored in USD)
            const unrealizedPnl = currentPrice > 0 ? currentValue - costBasis : 0; // USD
            const pnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

            return {
                ...pos,
                currentPrice,      // USD per token
                currentValue,      // USD
                unrealizedPnl,     // USD
                pnlPercent,        // %
                currency: 'USD'
            };
        });

        res.json({ success: true, positions: positionsWithPnl });
    } catch (err) {
        console.error('Get positions error:', err);
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});

// Helper to get token decimals from Jupiter for IBUY
async function getIBuyTokenDecimals(mintAddress: string): Promise<number> {
    try {
        const response = await axios.get(`https://api.jup.ag/tokens/v1/token/${mintAddress}`, {
            timeout: 5000
        });
        return response.data.decimals ?? 6;
    } catch {
        // Fallback: try Jupiter strict list
        try {
            const response = await axios.get('https://token.jup.ag/strict', { timeout: 5000 });
            const token = response.data.find((t: any) => t.address === mintAddress);
            return token?.decimals ?? 6;
        } catch {
            return 6;
        }
    }
}

// In-memory store for pending sells (reset on server restart)
const pendingSells = new Map<string, {
    positionId: string;
    percentage: number;
    sellAmount: number;
    expectedOutAmount: string;
    timestamp: number;
}>();

// IBUY Sell Prepare (Step 1: Get quote only, no DB changes)
app.post('/ibuy/sell/prepare', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { positionId, percentage } = req.body;
        if (!positionId || !percentage || percentage < 1 || percentage > 100) {
            res.status(400).json({ error: 'Position ID and valid percentage required' });
            return;
        }

        const position = await prisma.iBuyPosition.findFirst({
            where: { id: positionId, userId: req.userId!, status: 'open' },
            include: { post: { include: { user: { include: { wallet: true } } } } }
        });

        if (!position) {
            res.status(404).json({ error: 'Position not found' });
            return;
        }

        const sellAmount = position.remainingAmount * (percentage / 100);
        if (sellAmount < 0.000001) {
            res.status(400).json({ error: 'Sell amount too small' });
            return;
        }

        // Get token decimals from Jupiter
        const decimals = await getIBuyTokenDecimals(position.tokenAddress);
        const rawAmount = Math.floor(sellAmount * Math.pow(10, decimals));

        // Get Jupiter Ultra API quote
        const quoteParams = new URLSearchParams({
            inputMint: position.tokenAddress,
            outputMint: SOL_MINT,
            amount: rawAmount.toString(),
            slippageBps: '50',
        });

        const quoteUrl = `${JUPITER_ULTRA_API}/order?${quoteParams}`;
        console.log(`[IBUY Sell] Fetching quote from: ${quoteUrl}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const quoteResponse = await fetch(quoteUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!quoteResponse.ok) {
            const errorText = await quoteResponse.text();
            console.error(`[IBUY Sell] Jupiter returned ${quoteResponse.status}:`, errorText.substring(0, 500));
            res.status(400).json({ error: `Jupiter quote failed: ${errorText.substring(0, 200)}` });
            return;
        }

        const quoteData = await quoteResponse.json();

        if (quoteData.errorCode) {
            console.error(`[IBUY Sell] Jupiter error: ${quoteData.errorCode} - ${quoteData.errorMessage}`);
            res.status(400).json({ error: quoteData.errorMessage || quoteData.errorCode });
            return;
        }

        // Transform to match expected format
        const quote = {
            inputMint: quoteData.inputMint || position.tokenAddress,
            outputMint: quoteData.outputMint || SOL_MINT,
            inAmount: quoteData.inAmount || rawAmount.toString(),
            outAmount: quoteData.outAmount,
            otherAmountThreshold: quoteData.otherAmountThreshold || quoteData.outAmount,
            swapMode: 'ExactIn',
            slippageBps: 50,
            priceImpactPct: quoteData.priceImpactPct || '0',
            routePlan: quoteData.routePlan || [],
            swapTransaction: quoteData.transaction || quoteData.swapTransaction,
        };

        // Store pending sell data (expires in 5 minutes)
        const pendingId = `${req.userId!}_${positionId}_${Date.now()}`;
        pendingSells.set(pendingId, {
            positionId,
            percentage,
            sellAmount,
            expectedOutAmount: quote.outAmount,
            timestamp: Date.now()
        });

        // Clean old pending sells
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [key, value] of pendingSells.entries()) {
            if (value.timestamp < fiveMinutesAgo) {
                pendingSells.delete(key);
            }
        }

        res.json({
            success: true,
            pendingId,
            quote
        });
    } catch (err: any) {
        console.error('IBUY sell prepare error:', err?.response?.data || err.message);
        res.status(500).json({ error: err.message || 'Failed to prepare sell' });
    }
});

// IBUY Sell Execute (Step 2: Execute after swap, update DB)
app.post('/ibuy/sell/execute', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { pendingId, signature, actualOutAmount } = req.body;
        if (!pendingId || !signature) {
            res.status(400).json({ error: 'Pending ID and signature required' });
            return;
        }

        const pending = pendingSells.get(pendingId);
        if (!pending) {
            res.status(400).json({ error: 'Sell session expired or not found' });
            return;
        }

        // Verify the pending sell belongs to this user
        if (!pendingId.startsWith(req.userId!)) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const position = await prisma.iBuyPosition.findFirst({
            where: { id: pending.positionId, userId: req.userId!, status: 'open' }
        });

        if (!position) {
            pendingSells.delete(pendingId);
            res.status(404).json({ error: 'Position not found or already closed' });
            return;
        }

        // Use actual output amount from swap, or fallback to expected
        const solReceived = parseInt(actualOutAmount || pending.expectedOutAmount) / 1e9;

        // Calculate P&L
        const costBasis = pending.sellAmount * position.entryPrice;
        const profit = solReceived - costBasis;

        // Minimum $10 profit (~0.067 SOL at $150/SOL) before sharing
        const MIN_PROFIT_SOL = 0.067;
        const creatorShare = (profit > MIN_PROFIT_SOL) ? profit * 0.05 : 0;

        // Update position
        const newRemaining = position.remainingAmount - pending.sellAmount;
        const isFullyClosed = newRemaining < 0.000001;

        await prisma.iBuyPosition.update({
            where: { id: pending.positionId },
            data: {
                remainingAmount: newRemaining,
                realizedPnl: { increment: Math.max(0, profit) },
                creatorSharePaid: { increment: creatorShare },
                status: isFullyClosed ? 'closed' : 'open',
                closedAt: isFullyClosed ? new Date() : null
            }
        });

        // Record creator revenue if there's profit
        if (creatorShare > 0) {
            await prisma.creatorRevenue.create({
                data: {
                    creatorId: position.creatorId,
                    positionId: pending.positionId,
                    amount: creatorShare,
                    type: 'profit_share'
                }
            });
        }

        // Clean up pending sell
        pendingSells.delete(pendingId);

        res.json({
            success: true,
            solReceived,
            profit,
            creatorShare,
            isFullyClosed
        });
    } catch (err: any) {
        console.error('IBUY sell execute error:', err?.message);
        res.status(500).json({ error: 'Failed to execute sell' });
    }
});

// Get IBUY Settings
app.get('/ibuy/settings', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let settings = await prisma.userSettings.findUnique({
            where: { userId: req.userId! }
        });

        if (!settings) {
            settings = await prisma.userSettings.create({
                data: {
                    userId: req.userId!,
                    ibuySlippage: 50,
                    ibuyDefaultSol: 0.1,
                    autoApprove: false
                }
            });
        }

        res.json({
            success: true,
            settings: {
                ibuySlippage: settings.ibuySlippage,
                ibuyDefaultSol: settings.ibuyDefaultSol,
                autoApprove: settings.autoApprove
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update IBUY Settings
app.put('/ibuy/settings', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { ibuySlippage, ibuyDefaultSol, autoApprove } = req.body;

        const settings = await prisma.userSettings.upsert({
            where: { userId: req.userId! },
            create: {
                userId: req.userId!,
                ibuySlippage: ibuySlippage ?? 50,
                ibuyDefaultSol: ibuyDefaultSol ?? 0.1,
                autoApprove: autoApprove ?? false
            },
            update: {
                ...(ibuySlippage !== undefined && { ibuySlippage }),
                ...(ibuyDefaultSol !== undefined && { ibuyDefaultSol }),
                ...(autoApprove !== undefined && { autoApprove })
            }
        });

        res.json({
            success: true,
            settings: {
                ibuySlippage: settings.ibuySlippage,
                ibuyDefaultSol: settings.ibuyDefaultSol,
                autoApprove: settings.autoApprove
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get Creator Earnings
app.get('/ibuy/creator-earnings', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const revenues = await prisma.creatorRevenue.findMany({
            where: { creatorId: req.userId! }
        });

        const totalEarnings = revenues.reduce((sum, r) => sum + r.amount, 0);
        const positionCount = new Set(revenues.map(r => r.positionId)).size;
        const avgProfit = positionCount > 0 ? totalEarnings / positionCount : 0;

        // Group by post
        const positionIds = [...new Set(revenues.map(r => r.positionId))];
        const positions = await prisma.iBuyPosition.findMany({
            where: { id: { in: positionIds } },
            select: { id: true, postId: true, tokenSymbol: true }
        });

        const postMap = new Map(positions.map(p => [p.id, p]));
        const breakdown = revenues.reduce((acc, r) => {
            const pos = postMap.get(r.positionId);
            const key = pos?.postId || 'unknown';
            if (!acc[key]) {
                acc[key] = { postId: key, tokenSymbol: pos?.tokenSymbol || 'Unknown', earnings: 0 };
            }
            acc[key].earnings += r.amount;
            return acc;
        }, {} as Record<string, { postId: string; tokenSymbol: string; earnings: number }>);

        res.json({
            success: true,
            totalEarnings,
            positionCount,
            avgProfit,
            breakdown: Object.values(breakdown)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});

// ============================================
// TRIGGER/LIMIT ORDER ENDPOINTS (Jupiter)
// ============================================

const JUPITER_TRIGGER_API = 'https://api.jup.ag/trigger/v1';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';

// Helper to build Jupiter API headers
const jupiterHeaders = (extra?: Record<string, string>) => ({
    'Content-Type': 'application/json',
    ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
    ...extra,
});

// POST /trigger/createOrder - Create a limit order
app.post('/trigger/createOrder', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { inputMint, outputMint, maker, payer, makingAmount, takingAmount, slippageBps } = req.body;

        if (!inputMint || !outputMint || !maker || !payer || !makingAmount || !takingAmount) {
            res.status(400).json({ error: 'Missing required parameters' });
            return;
        }

        console.log(`[Trigger] Creating order: ${inputMint} -> ${outputMint}, maker: ${maker}`);

        const response = await axios.post(`${JUPITER_TRIGGER_API}/createOrder`, {
            inputMint,
            outputMint,
            maker,
            payer,
            params: {
                makingAmount: makingAmount.toString(),
                takingAmount: takingAmount.toString(),
                ...(slippageBps ? { slippageBps: slippageBps.toString() } : {}),
            },
            computeUnitPrice: 'auto',
        }, {
            timeout: 15000,
            headers: jupiterHeaders(),
        });

        res.json({
            orderId: response.data.order,
            transaction: response.data.transaction
        });
    } catch (error: any) {
        console.error('[Trigger] Create order failed:', error.response?.data || error.message);
        // Forward Jupiter's status code if available (e.g., 400 for validation errors)
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error || 'Failed to create limit order';
        const errorCause = error.response?.data?.cause || error.message;
        res.status(statusCode).json({
            error: errorMessage,
            details: errorCause
        });
    }
});

// POST /trigger/execute - Execute a signed limit order
app.post('/trigger/execute', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { signedTransaction, orderId } = req.body;

        if (!signedTransaction || !orderId) {
            res.status(400).json({ error: 'Missing signedTransaction or orderId' });
            return;
        }

        console.log(`[Trigger] Executing order: ${orderId}`);

        const response = await axios.post(`${JUPITER_TRIGGER_API}/execute`, {
            signedTransaction,
            orderId
        }, {
            timeout: 30000,
            headers: jupiterHeaders(),
        });

        res.json({
            status: response.data.status,
            signature: response.data.signature
        });
    } catch (error: any) {
        console.error('[Trigger] Execute order failed:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to execute limit order',
            details: error.response?.data?.error || error.message
        });
    }
});

// POST /trigger/cancelOrder - Cancel a limit order
app.post('/trigger/cancelOrder', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            res.status(400).json({ error: 'Missing orderId' });
            return;
        }

        console.log(`[Trigger] Cancelling order: ${orderId}`);

        const response = await axios.post(`${JUPITER_TRIGGER_API}/cancelOrder`, {
            orderId
        }, {
            timeout: 15000,
            headers: jupiterHeaders(),
        });

        res.json({
            transaction: response.data.transaction
        });
    } catch (error: any) {
        console.error('[Trigger] Cancel order failed:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to cancel limit order',
            details: error.response?.data?.error || error.message
        });
    }
});

// GET /trigger/orders - Get user's trigger orders
app.get('/trigger/orders', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { user, orderStatus } = req.query;

        if (!user) {
            res.status(400).json({ error: 'Missing user parameter' });
            return;
        }

        const params = new URLSearchParams();
        params.append('user', user as string);
        if (orderStatus) {
            params.append('orderStatus', orderStatus as string);
        }

        console.log(`[Trigger] Fetching orders for: ${user}`);

        const response = await axios.get(`${JUPITER_TRIGGER_API}/getTriggerOrders?${params}`, {
            timeout: 10000,
            headers: jupiterHeaders(),
        });

        res.json({
            orders: response.data.orders || []
        });
    } catch (error: any) {
        console.error('[Trigger] Get orders failed:', error.response?.data || error.message);
        // Return empty orders on failure instead of 500 to avoid noisy client errors
        res.json({
            orders: []
        });
    }
});

// 404 Handler - Catch-all for undefined endpoints
app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ====== Cron Jobs ======

import { monitorTraderExits, monitorLimitOrders, cleanExpiredQueueItems } from './cron/monitor';
import { distributeCreatorRevenues } from './cron/revenueDistribution';

// Run every minute
setInterval(async () => {
    await Promise.all([
        monitorTraderExits(),
        monitorLimitOrders(),
        cleanExpiredQueueItems()
    ]);
}, 60 * 1000);

// Run revenue distribution daily (every 24 hours)
setInterval(async () => {
    await distributeCreatorRevenues();
}, 24 * 60 * 60 * 1000);

// Run once on startup
setTimeout(() => {
    distributeCreatorRevenues();
}, 5000);

// ====== Start Server ======

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
