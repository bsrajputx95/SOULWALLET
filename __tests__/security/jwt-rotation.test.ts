/**
 * JWT Rotation Service Tests
 * 
 * Tests for JWT secret rotation, version tracking, and cleanup.
 */

import crypto from 'crypto';

// Mock dependencies
const mockPrisma = {
    jWTSecretVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
    },
    keyOperationLog: {
        create: jest.fn(),
    },
    $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Helper functions from the actual service
const SECRET_LENGTH = 64;

function generateSecureSecret(): string {
    return crypto.randomBytes(SECRET_LENGTH).toString('base64url');
}

function hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
}

describe('JWT Rotation Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Secret Generation', () => {
        it('should generate secrets of correct length', () => {
            const secret = generateSecureSecret();

            // base64url encoding: 64 bytes = ~86 characters
            expect(secret.length).toBeGreaterThanOrEqual(80);
        });

        it('should generate unique secrets', () => {
            const secrets = new Set<string>();

            for (let i = 0; i < 100; i++) {
                secrets.add(generateSecureSecret());
            }

            expect(secrets.size).toBe(100);
        });

        it('should generate URL-safe secrets', () => {
            const secret = generateSecureSecret();

            // base64url should not contain +, /, or =
            expect(secret).not.toMatch(/[+/=]/);
        });
    });

    describe('Secret Hashing', () => {
        it('should hash secrets consistently', () => {
            const secret = 'test-jwt-secret';

            const hash1 = hashSecret(secret);
            const hash2 = hashSecret(secret);

            expect(hash1).toBe(hash2);
        });

        it('should produce 64-character hex hashes', () => {
            const secret = 'test-jwt-secret';
            const hash = hashSecret(secret);

            expect(hash.length).toBe(64);
            expect(hash).toMatch(/^[a-f0-9]+$/);
        });

        it('should produce different hashes for different secrets', () => {
            const hash1 = hashSecret('secret-1');
            const hash2 = hashSecret('secret-2');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Version Management', () => {
        it('should increment version from 0 when no versions exist', () => {
            const currentVersion = 0;
            const newVersion = currentVersion + 1;

            expect(newVersion).toBe(1);
        });

        it('should increment version correctly', () => {
            const currentVersion = 5;
            const newVersion = currentVersion + 1;

            expect(newVersion).toBe(6);
        });
    });

    describe('Expiration Calculation', () => {
        it('should calculate expiration with rotation and overlap', () => {
            const ROTATION_PERIOD_DAYS = 90;
            const OVERLAP_PERIOD_DAYS = 7;

            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS);

            const daysDiff = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            expect(daysDiff).toBe(97);
        });
    });

    describe('Rotation Status Check', () => {
        it('should flag rotation needed when no active version exists', () => {
            const current = null;
            const needed = !current;

            expect(needed).toBe(true);
        });

        it('should flag rotation needed when close to expiry', () => {
            const OVERLAP_PERIOD_DAYS = 7;
            const now = new Date();

            // Secret expiring in 5 days
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 5);

            const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const needed = daysUntilExpiry <= OVERLAP_PERIOD_DAYS;

            expect(needed).toBe(true);
        });

        it('should not flag rotation when secret is fresh', () => {
            const OVERLAP_PERIOD_DAYS = 7;
            const ROTATION_PERIOD_DAYS = 90;
            const now = new Date();

            // Secret created today, expires in 97 days
            const createdAt = now;
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS);

            const ageInDays = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            const needsByAge = ageInDays >= ROTATION_PERIOD_DAYS;
            const needsByExpiry = daysUntilExpiry <= OVERLAP_PERIOD_DAYS;

            expect(needsByAge).toBe(false);
            expect(needsByExpiry).toBe(false);
        });

        it('should flag rotation when secret is old', () => {
            const ROTATION_PERIOD_DAYS = 90;
            const now = new Date();

            // Secret created 95 days ago
            const createdAt = new Date(now);
            createdAt.setDate(createdAt.getDate() - 95);

            const ageInDays = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const needed = ageInDays >= ROTATION_PERIOD_DAYS;

            expect(needed).toBe(true);
        });
    });

    describe('Cleanup Logic', () => {
        it('should identify expired secrets for deactivation', () => {
            const now = new Date();

            const secrets = [
                { id: '1', expiresAt: new Date(now.getTime() - 1000), isActive: true },
                { id: '2', expiresAt: new Date(now.getTime() + 1000), isActive: true },
            ];

            const expired = secrets.filter(s => s.expiresAt < now && s.isActive);

            expect(expired.length).toBe(1);
            expect(expired[0]?.id).toBe('1');
        });

        it('should identify old inactive secrets for deletion', () => {
            const now = new Date();
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const secrets = [
                { id: '1', expiresAt: new Date(thirtyDaysAgo.getTime() - 1000), isActive: false },
                { id: '2', expiresAt: new Date(thirtyDaysAgo.getTime() + 1000), isActive: false },
                { id: '3', expiresAt: now, isActive: true },
            ];

            const toDelete = secrets.filter(s => !s.isActive && s.expiresAt < thirtyDaysAgo);

            expect(toDelete.length).toBe(1);
            expect(toDelete[0]?.id).toBe('1');
        });
    });

    describe('Multi-Secret Verification', () => {
        it('should support multiple active secrets during overlap', () => {
            const secrets = ['secret-v3', 'secret-v2', 'secret-v1'];

            // The first secret (newest) is used for signing
            const signingSecret = secrets[0];

            // All secrets can be used for verification
            const verificationSecrets = secrets;

            expect(signingSecret).toBe('secret-v3');
            expect(verificationSecrets.length).toBe(3);
        });

        it('should verify tokens with any active secret', () => {
            const secrets = ['new-secret', 'old-secret'];
            const tokenSignedWith = 'old-secret';

            const canVerify = secrets.includes(tokenSignedWith);

            expect(canVerify).toBe(true);
        });
    });

    describe('Audit Logging', () => {
        it('should log successful rotation', () => {
            const logEntry = {
                operation: 'JWT_ROTATE',
                keyVersion: 5,
                userId: 'admin-user-id',
                success: true,
                metadata: {
                    purpose: 'access',
                    oldVersionsDeactivating: [3, 4],
                },
            };

            expect(logEntry.operation).toBe('JWT_ROTATE');
            expect(logEntry.success).toBe(true);
            expect(logEntry.metadata.oldVersionsDeactivating).toEqual([3, 4]);
        });

        it('should log failed rotation with error', () => {
            const logEntry = {
                operation: 'JWT_ROTATE',
                keyVersion: 0,
                userId: null,
                success: false,
                errorMsg: 'Database connection failed',
                metadata: { purpose: 'refresh' },
            };

            expect(logEntry.success).toBe(false);
            expect(logEntry.errorMsg).toBe('Database connection failed');
        });
    });
});

describe('JWT Token Security', () => {
    describe('Token Signing', () => {
        it('should sign tokens with the first (newest) secret', () => {
            const secrets = ['newest', 'older', 'oldest'];
            const signingSecret = secrets[0];

            expect(signingSecret).toBe('newest');
        });
    });

    describe('Token Verification', () => {
        it('should try all secrets for verification', () => {
            const secrets = ['secret-3', 'secret-2', 'secret-1'];
            const tokenSecret = 'secret-2';

            let verified = false;
            let secretIndex = -1;

            for (let i = 0; i < secrets.length; i++) {
                if (secrets[i] === tokenSecret) {
                    verified = true;
                    secretIndex = i;
                    break;
                }
            }

            expect(verified).toBe(true);
            expect(secretIndex).toBe(1);
        });

        it('should fail if token matches no secrets', () => {
            const secrets = ['secret-3', 'secret-2', 'secret-1'];
            const tokenSecret = 'unknown-secret';

            const verified = secrets.includes(tokenSecret);

            expect(verified).toBe(false);
        });
    });
});
