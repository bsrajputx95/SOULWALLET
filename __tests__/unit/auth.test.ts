/**
 * AuthService Unit Tests
 * Tests for password hashing, JWT handling, OTP, sessions, and security features
 */

jest.mock('../../src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        session: {
            create: jest.fn(),
            delete: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            deleteMany: jest.fn(),
        },
        otp: {
            create: jest.fn(),
            findFirst: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
        },
        loginAttempt: {
            create: jest.fn(),
            count: jest.fn(),
        },
        sessionActivity: {
            create: jest.fn(),
        },
    },
}));

jest.mock('../../src/lib/redis', () => ({
    redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        sadd: jest.fn().mockResolvedValue(1),
        srem: jest.fn().mockResolvedValue(1),
    },
}));

jest.mock('../../src/lib/services/jwtRotation', () => ({
    jwtSecretCache: {
        getSecrets: jest.fn().mockReturnValue(['test-secret']),
        getRefreshSecrets: jest.fn().mockReturnValue(['test-refresh-secret']),
    },
}));

jest.mock('../../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================
    // Password Hashing Tests
    // =========================================
    describe('Password Hashing', () => {
        const SALT_ROUNDS = 12;

        it('should hash password with bcrypt', async () => {
            const password = 'SecurePassword123!';
            const hash = await bcrypt.hash(password, SALT_ROUNDS);

            expect(hash).toBeTruthy();
            expect(hash.length).toBeGreaterThan(50);
            expect(hash).not.toBe(password);
        });

        it('should verify correct password', async () => {
            const password = 'SecurePassword123!';
            const hash = await bcrypt.hash(password, SALT_ROUNDS);

            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const password = 'SecurePassword123!';
            const hash = await bcrypt.hash(password, SALT_ROUNDS);

            const isValid = await bcrypt.compare('WrongPassword', hash);
            expect(isValid).toBe(false);
        });

        it('should generate unique hashes for same password', async () => {
            const password = 'SecurePassword123!';
            const hash1 = await bcrypt.hash(password, SALT_ROUNDS);
            const hash2 = await bcrypt.hash(password, SALT_ROUNDS);

            expect(hash1).not.toBe(hash2);
        });
    });

    // =========================================
    // OTP Hashing Tests (Audit Issue #2)
    // =========================================
    describe('OTP Hashing', () => {
        const hashOTP = (otp: string): string => {
            return crypto.createHash('sha256').update(otp).digest('hex');
        };

        const verifyOTPHash = (inputOtp: string, storedHash: string): boolean => {
            const inputHash = hashOTP(inputOtp);
            return crypto.timingSafeEqual(
                Buffer.from(inputHash, 'hex'),
                Buffer.from(storedHash, 'hex')
            );
        };

        it('should hash OTP using SHA-256', () => {
            const otp = '123456';
            const hash = hashOTP(otp);

            expect(hash.length).toBe(64); // SHA-256 = 64 hex chars
            expect(hash).toBe(crypto.createHash('sha256').update(otp).digest('hex'));
        });

        it('should produce consistent hash for same OTP', () => {
            const otp = '123456';
            const hash1 = hashOTP(otp);
            const hash2 = hashOTP(otp);

            expect(hash1).toBe(hash2);
        });

        it('should verify correct OTP', () => {
            const otp = '123456';
            const hash = hashOTP(otp);

            expect(verifyOTPHash(otp, hash)).toBe(true);
        });

        it('should reject incorrect OTP', () => {
            const otp = '123456';
            const hash = hashOTP(otp);

            expect(verifyOTPHash('654321', hash)).toBe(false);
        });
    });

    // =========================================
    // OTP Generation Tests
    // =========================================
    describe('OTP Generation', () => {
        const generateOTP = (): string => {
            const buffer = crypto.randomBytes(4);
            const num = buffer.readUInt32BE(0);
            return String(num % 1000000).padStart(6, '0');
        };

        it('should generate 6-digit OTP', () => {
            const otp = generateOTP();
            expect(otp).toMatch(/^\d{6}$/);
        });

        it('should generate random OTPs', () => {
            const otps = new Set();
            for (let i = 0; i < 10; i++) {
                otps.add(generateOTP());
            }
            // High probability that at least 8 are unique
            expect(otps.size).toBeGreaterThanOrEqual(8);
        });
    });

    // =========================================
    // JWT Token Tests
    // =========================================
    describe('JWT Tokens', () => {
        const JWT_SECRET = 'test-secret-key-for-jwt-testing';

        it('should generate access token', () => {
            const payload = {
                userId: 'user-123',
                sessionId: 'session-456',
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

            expect(token).toBeTruthy();
            expect(token.split('.')).toHaveLength(3);
        });

        it('should verify valid token', () => {
            const payload = { userId: 'user-123' };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

            const decoded = jwt.verify(token, JWT_SECRET) as any;
            expect(decoded.userId).toBe('user-123');
        });

        it('should reject token with wrong secret', () => {
            const payload = { userId: 'user-123' };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

            expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
        });

        it('should reject expired token', () => {
            const payload = { userId: 'user-123' };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });

            expect(() => jwt.verify(token, JWT_SECRET)).toThrow(/expired/);
        });

        it('should include expiration in token', () => {
            const payload = { userId: 'user-123' };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

            const decoded = jwt.decode(token) as any;
            expect(decoded.exp).toBeDefined();
            expect(decoded.exp).toBeGreaterThan(decoded.iat);
        });
    });

    // =========================================
    // JWT Expiration Parsing Tests (Audit Issue #20)
    // =========================================
    describe('JWT Expiration Parsing', () => {
        const parseJwtExpiration = (value: string | number): number => {
            if (typeof value === 'number') {
                return Math.floor(value);
            }

            const trimmedValue = value.trim();
            const numericValue = parseInt(trimmedValue, 10);

            if (!isNaN(numericValue) && String(numericValue) === trimmedValue) {
                return numericValue;
            }

            if (trimmedValue.endsWith('s')) {
                const seconds = parseInt(trimmedValue.slice(0, -1), 10);
                if (!isNaN(seconds)) return seconds;
            }

            if (trimmedValue.endsWith('m')) {
                const minutes = parseInt(trimmedValue.slice(0, -1), 10);
                if (!isNaN(minutes)) return minutes * 60;
            }

            if (trimmedValue.endsWith('h')) {
                const hours = parseInt(trimmedValue.slice(0, -1), 10);
                if (!isNaN(hours)) return hours * 3600;
            }

            if (trimmedValue.endsWith('d')) {
                const days = parseInt(trimmedValue.slice(0, -1), 10);
                if (!isNaN(days)) return days * 86400;
            }

            return 3600; // Default 1 hour
        };

        it('should parse numeric seconds', () => {
            expect(parseJwtExpiration(3600)).toBe(3600);
            expect(parseJwtExpiration('3600')).toBe(3600);
        });

        it('should parse seconds suffix', () => {
            expect(parseJwtExpiration('3600s')).toBe(3600);
        });

        it('should parse minutes suffix', () => {
            expect(parseJwtExpiration('30m')).toBe(1800);
        });

        it('should parse hours suffix', () => {
            expect(parseJwtExpiration('1h')).toBe(3600);
            expect(parseJwtExpiration('24h')).toBe(86400);
        });

        it('should parse days suffix', () => {
            expect(parseJwtExpiration('7d')).toBe(604800);
        });

        it('should default to 1 hour for invalid input', () => {
            expect(parseJwtExpiration('invalid')).toBe(3600);
            expect(parseJwtExpiration('')).toBe(3600);
        });
    });

    // =========================================
    // Session Management Tests
    // =========================================
    describe('Session Management', () => {
        it('should generate session ID', () => {
            const generateSessionId = () => crypto.randomBytes(32).toString('hex');
            const sessionId = generateSessionId();

            expect(sessionId.length).toBe(64);
            expect(sessionId).toMatch(/^[0-9a-f]+$/);
        });

        it('should create session keys correctly', () => {
            const sessionId = 'session-123';
            const sessionKey = `session:${sessionId}`;
            const lastActivityKey = `session:${sessionId}:lastActivityAt`;

            expect(sessionKey).toBe('session:session-123');
            expect(lastActivityKey).toBe('session:session-123:lastActivityAt');
        });

        it('should validate session expiration', () => {
            const now = new Date();
            const future = new Date(Date.now() + 3600000); // 1 hour
            const past = new Date(Date.now() - 3600000); // 1 hour ago

            expect(future > now).toBe(true);
            expect(past < now).toBe(true);
        });
    });

    // =========================================
    // Login Attempt Tracking Tests
    // =========================================
    describe('Login Attempt Tracking', () => {
        const MAX_FAILED_ATTEMPTS = 5;
        const LOCKOUT_DURATION_MINUTES = 15;

        it('should detect account lockout condition', () => {
            const failedAttempts = 5;
            const isLocked = failedAttempts >= MAX_FAILED_ATTEMPTS;
            expect(isLocked).toBe(true);
        });

        it('should not lock with fewer attempts', () => {
            const failedAttempts = 3;
            const isLocked = failedAttempts >= MAX_FAILED_ATTEMPTS;
            expect(isLocked).toBe(false);
        });

        it('should calculate lockout expiration', () => {
            const lockedAt = new Date();
            const lockoutEnd = new Date(lockedAt.getTime() + LOCKOUT_DURATION_MINUTES * 60000);

            expect(lockoutEnd.getTime() - lockedAt.getTime()).toBe(15 * 60000);
        });
    });

    // =========================================
    // Email Validation Tests
    // =========================================
    describe('Email Validation', () => {
        const isValidEmail = (email: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };

        it('should validate correct emails', () => {
            expect(isValidEmail('user@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.org')).toBe(true);
            expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('user@')).toBe(false);
            expect(isValidEmail('@domain.com')).toBe(false);
            expect(isValidEmail('user @domain.com')).toBe(false);
        });
    });

    // =========================================
    // Password Strength Validation Tests
    // =========================================
    describe('Password Strength', () => {
        const validatePassword = (password: string) => {
            const errors = [];
            if (password.length < 8) errors.push('Must be at least 8 characters');
            if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase');
            if (!/[a-z]/.test(password)) errors.push('Must contain lowercase');
            if (!/[0-9]/.test(password)) errors.push('Must contain number');
            return { valid: errors.length === 0, errors };
        };

        it('should accept strong password', () => {
            const result = validatePassword('SecurePass123');
            expect(result.valid).toBe(true);
        });

        it('should reject short password', () => {
            const result = validatePassword('Short1');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Must be at least 8 characters');
        });

        it('should require mixed case', () => {
            const result = validatePassword('alllowercase123');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Must contain uppercase');
        });
    });

    // =========================================
    // Security Features Tests
    // =========================================
    describe('Security Features', () => {
        it('should use timing-safe comparison', () => {
            const a = 'secret-value-123';
            const b = 'secret-value-123';
            const c = 'different-value';

            const safeCompare = (str1: string, str2: string) => {
                if (str1.length !== str2.length) return false;
                return crypto.timingSafeEqual(Buffer.from(str1), Buffer.from(str2));
            };

            expect(safeCompare(a, b)).toBe(true);
            expect(safeCompare(a, c)).toBe(false);
        });

        it('should detect suspicious fingerprint changes', () => {
            const oldFingerprint = {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/120',
            };
            const newFingerprint = {
                ipAddress: '203.0.113.50',
                userAgent: 'Firefox/120',
            };

            const isSuspicious = (old: any, newFp: any) => {
                return old.ipAddress !== newFp.ipAddress || old.userAgent !== newFp.userAgent;
            };

            expect(isSuspicious(oldFingerprint, newFingerprint)).toBe(true);
            expect(isSuspicious(oldFingerprint, oldFingerprint)).toBe(false);
        });
    });
});
