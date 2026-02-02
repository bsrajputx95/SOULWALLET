import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import axios from 'axios';
import bs58 from 'bs58';
import prisma from './db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast if JWT_SECRET is missing
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined');
    process.exit(1);
}

// Solana RPC connection (lazy initialization)
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com';
let connection: Connection | null = null;

const getConnection = () => {
    if (!connection) {
        connection = new Connection(HELIUS_RPC_URL, 'confirmed');
    }
    return connection;
};

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
const JUPITER_PRICE_API = 'https://price.jup.ag/v6/price';

// ====== Middleware Stack ======

// CORS configuration (allow all origins for development)
app.use(cors());

// JSON body parser
app.use(express.json());

// Rate limiter (100 requests per 15 minutes per IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

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
    phone: z.string().optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
    profileImage: z.string().url().optional(),
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
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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

        // Check if address already linked to another user
        const existing = await prisma.wallet.findUnique({ where: { publicKey } });
        if (existing && existing.userId !== req.userId) {
            res.status(409).json({ error: 'Address already linked to another account' });
            return;
        }

        // Create or update wallet
        const wallet = await prisma.wallet.upsert({
            where: { userId: req.userId! },
            update: { publicKey },
            create: { userId: req.userId!, publicKey, network: 'mainnet-beta' }
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

// GET /wallet/balances - Get SOL + Token balances with USD prices
app.get('/wallet/balances', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Get user's wallet
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
        if (!wallet) {
            res.status(404).json({ error: 'No wallet linked' });
            return;
        }

        const pubKey = new PublicKey(wallet.publicKey);

        // 1. Get SOL Balance (with RPC error handling)
        let solBalance: number;
        try {
            solBalance = await getConnection().getBalance(pubKey);
        } catch (rpcErr) {
            const { statusCode, message } = handleRpcError(rpcErr);
            res.status(statusCode).json({ error: message });
            return;
        }
        const solAmount = solBalance / LAMPORTS_PER_SOL;

        // 2. Get Token Accounts (SPL tokens like USDC) (with RPC error handling)
        let tokenAccounts: any;
        try {
            tokenAccounts = await getConnection().getParsedTokenAccountsByOwner(
                pubKey,
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
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

        // 3. Fetch Prices from Jupiter (FREE API)
        let prices: Record<string, number> = {};
        try {
            // Jupiter accepts comma-separated mint addresses
            const priceResponse = await axios.get(JUPITER_PRICE_API, {
                params: { ids: tokenAddresses.join(',') }
            });
            // Jupiter returns { data: { mint: { id, mintSymbol, vsToken, vsTokenSymbol, price } } }
            const jupData = priceResponse.data?.data || {};
            for (const [mint, info] of Object.entries(jupData)) {
                prices[mint] = (info as any)?.price || 0;
            }
        } catch (priceErr) {
            console.warn('Jupiter price fetch failed:', priceErr);
        }

        // 4. Format Response
        const holdings = [];
        let totalUsd = 0;

        // Add SOL
        const solPrice = prices['So11111111111111111111111111111111111111112'] || 0;
        const solUsd = solAmount * solPrice;
        totalUsd += solUsd;

        holdings.push({
            symbol: 'SOL',
            name: 'Solana',
            mint: 'So11111111111111111111111111111111111111112',
            balance: solAmount,
            price: solPrice,
            usdValue: solUsd,
            decimals: 9
        });

        // Add SPL Tokens
        for (const token of tokenAccounts.value) {
            const info = token.account.data.parsed.info;
            const mint = info.mint;
            const amount = Number(info.tokenAmount.amount) / Math.pow(10, info.tokenAmount.decimals);

            if (amount <= 0) continue;

            const price = prices[mint] || 0;
            const usdValue = amount * price;
            totalUsd += usdValue;

            // Known token symbols
            let symbol = 'Unknown';
            let name = 'Unknown Token';
            if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1') {
                symbol = 'USDC';
                name = 'USD Coin';
            } else if (mint === 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263') {
                symbol = 'BONK';
                name = 'Bonk';
            } else if (mint === 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN') {
                symbol = 'JUP';
                name = 'Jupiter';
            }

            holdings.push({
                symbol,
                name,
                mint,
                balance: amount,
                price,
                usdValue,
                decimals: info.tokenAmount.decimals
            });
        }

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

// GET /tokens/search - Search tokens for dropdowns
app.get('/tokens/search', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
    // For beta, return top Solana tokens
    const topTokens = [
        { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
        { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1', decimals: 6 },
        { symbol: 'BONK', name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
        { symbol: 'JUP', name: 'Jupiter', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 }
    ];
    res.json({ success: true, tokens: topTokens });
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

        // Check balance
        const balance = await getConnection().getBalance(fromPubkey);
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

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } = await getConnection().getLatestBlockhash();
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
        res.status(500).json({ error: 'Failed to prepare transaction' });
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

        // Decode and send the signed transaction
        const signedTxBuffer = bs58.decode(validatedData.signedTransaction);

        const signature = await getConnection().sendRawTransaction(signedTxBuffer, {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        // Wait for confirmation
        const latestBlockhash = await getConnection().getLatestBlockhash();
        await getConnection().confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, 'confirmed');

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

// GET /health (Unauthenticated - for Railway monitoring)
app.get('/health', (_req: Request, res: Response): void => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

// 404 Handler - Catch-all for undefined endpoints
app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ====== Start Server ======

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
