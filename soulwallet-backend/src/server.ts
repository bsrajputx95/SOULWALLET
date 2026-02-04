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
import { getConnection, executeRpcCall, getRpcStatus } from './services/rpcManager';

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

        // 1. Get SOL Balance (with RPC fallback)
        let solBalance: number;
        try {
            solBalance = await executeRpcCall(
                conn => conn.getBalance(pubKey),
                'getBalance'
            );
        } catch (rpcErr) {
            const { statusCode, message } = handleRpcError(rpcErr);
            res.status(statusCode).json({ error: message });
            return;
        }
        const solAmount = solBalance / LAMPORTS_PER_SOL;

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
import { cancelLimitOrder, checkOrderStatus, getSwapTransaction, getTokenDecimals } from './services/jupiterLimitOrder';
import { ensureTraderWebhook, deleteTraderWebhook } from './services/heliusWebhook';

// Validation schemas for copy trading
const copyConfigSchema = z.object({
    traderAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address'),
    totalInvestment: z.number().positive().max(10000, 'Max $10,000 allowed'),
    perTradeAmount: z.number().positive(),
    stopLossPercent: z.number().min(1).max(50).default(10),
    takeProfitPercent: z.number().min(5).max(1000).default(30),
    exitWithTrader: z.boolean().default(true)
}).refine(data => data.perTradeAmount <= data.totalInvestment, {
    message: 'Per-trade amount cannot exceed total investment',
    path: ['perTradeAmount']
});

// POST /copy-trade/config - Create/update copy trading config
app.post('/copy-trade/config', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = copyConfigSchema.parse(req.body);
        const userId = req.userId!;

        // Validate per-trade vs total
        if (data.perTradeAmount > data.totalInvestment) {
            res.status(400).json({ error: 'Per-trade amount cannot exceed total investment' });
            return;
        }

        // Upsert config
        const config = await prisma.copyTradingConfig.upsert({
            where: { userId },
            update: {
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
            where: { userId: req.userId! }
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

        // Mark config as inactive ONLY after preparing cancel transactions
        await prisma.copyTradingConfig.update({
            where: { userId: req.userId! },
            data: { isActive: false }
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

            // Only queue copy trades for BUYs (when trader buys, we copy the buy)
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

                for (const config of configs) {
                    // Cap the spend to user's perTradeAmount
                    const cappedOutputAmount = Math.min(config.perTradeAmount, inputAmount);

                    // Skip if capped amount is invalid
                    if (cappedOutputAmount <= 0) {
                        console.warn(`[Webhook] Skipping config ${config.id}: invalid capped amount ${cappedOutputAmount}`);
                        continue;
                    }

                    // Calculate proportional input amount based on price ratio
                    // proportionalInputAmount = cappedOutputAmount / priceRatio
                    // This ensures we get the correct amount of output tokens for our input
                    const proportionalInputAmount = cappedOutputAmount / priceRatio;

                    // Final validation before writing to database
                    if (!Number.isFinite(proportionalInputAmount) || proportionalInputAmount < 0) {
                        console.warn(`[Webhook] Skipping config ${config.id}: calculated NaN/Infinity input amount`);
                        continue;
                    }

                    await queueCopyTrade({
                        userId: config.userId,
                        configId: config.id,
                        traderAddress,
                        traderTxSignature: tx.signature,
                        inputMint: outputMint,           // We buy what trader bought
                        inputSymbol: outputSymbol,
                        outputMint: inputMint,           // We spend what trader spent
                        outputSymbol: inputSymbol,
                        inputAmount: proportionalInputAmount,  // Proportional to capped spend
                        outputAmount: cappedOutputAmount       // Capped to perTradeAmount
                    });
                }
            }
        }
    } catch (error) {
        console.error('Webhook processing error:', error);
    }
});

// 404 Handler - Catch-all for undefined endpoints
app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ====== Cron Jobs ======

import { monitorTraderExits, monitorLimitOrders, cleanExpiredQueueItems } from './cron/monitor';

// Run every minute
setInterval(async () => {
    await Promise.all([
        monitorTraderExits(),
        monitorLimitOrders(),
        cleanExpiredQueueItems()
    ]);
}, 60 * 1000);

// ====== Start Server ======

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
