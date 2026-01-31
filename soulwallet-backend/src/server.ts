import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
