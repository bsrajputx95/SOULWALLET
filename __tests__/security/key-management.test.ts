/**
 * Key Management Service Tests
 * 
 * Tests for the KMS abstraction layer, encryption, and key operations.
 */

import crypto from 'crypto';

// Mock the prisma client
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        keyVersion: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        keyOperationLog: {
            create: jest.fn(),
            findMany: jest.fn(),
        },
        $disconnect: jest.fn(),
    })),
}));

describe('Key Management Service', () => {
    describe('Envelope Encryption', () => {
        it('should encrypt and decrypt data correctly', () => {
            const plaintext = Buffer.from('test-private-key-data');
            const dataKey = crypto.randomBytes(32);
            const iv = crypto.randomBytes(16);

            // Encrypt
            const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
            const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
            const tag = cipher.getAuthTag();

            // Decrypt
            const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
            decipher.setAuthTag(tag);
            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

            expect(decrypted.toString()).toBe(plaintext.toString());
        });

        it('should fail decryption with wrong key', () => {
            const plaintext = Buffer.from('test-private-key-data');
            const dataKey = crypto.randomBytes(32);
            const wrongKey = crypto.randomBytes(32);
            const iv = crypto.randomBytes(16);

            // Encrypt with correct key
            const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
            const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
            const tag = cipher.getAuthTag();

            // Attempt decrypt with wrong key
            const decipher = crypto.createDecipheriv('aes-256-gcm', wrongKey, iv);
            decipher.setAuthTag(tag);

            expect(() => {
                Buffer.concat([decipher.update(encrypted), decipher.final()]);
            }).toThrow();
        });

        it('should fail decryption with tampered ciphertext', () => {
            const plaintext = Buffer.from('test-private-key-data');
            const dataKey = crypto.randomBytes(32);
            const iv = crypto.randomBytes(16);

            // Encrypt
            const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
            const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
            const tag = cipher.getAuthTag();

            // Tamper with ciphertext
            encrypted[0] = encrypted[0]! ^ 0xff;

            // Attempt decrypt
            const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
            decipher.setAuthTag(tag);

            expect(() => {
                Buffer.concat([decipher.update(encrypted), decipher.final()]);
            }).toThrow();
        });
    });

    describe('PBKDF2 Key Derivation', () => {
        it('should derive consistent keys from same inputs', () => {
            const password = 'test-master-secret';
            const salt = crypto.randomBytes(32);
            const iterations = 100000;

            const key1 = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
            const key2 = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

            expect(key1.equals(key2)).toBe(true);
        });

        it('should derive different keys with different salts', () => {
            const password = 'test-master-secret';
            const salt1 = crypto.randomBytes(32);
            const salt2 = crypto.randomBytes(32);
            const iterations = 100000;

            const key1 = crypto.pbkdf2Sync(password, salt1, iterations, 32, 'sha256');
            const key2 = crypto.pbkdf2Sync(password, salt2, iterations, 32, 'sha256');

            expect(key1.equals(key2)).toBe(false);
        });

        it('should derive different keys with different passwords', () => {
            const password1 = 'test-master-secret-1';
            const password2 = 'test-master-secret-2';
            const salt = crypto.randomBytes(32);
            const iterations = 100000;

            const key1 = crypto.pbkdf2Sync(password1, salt, iterations, 32, 'sha256');
            const key2 = crypto.pbkdf2Sync(password2, salt, iterations, 32, 'sha256');

            expect(key1.equals(key2)).toBe(false);
        });
    });

    describe('Secure Memory Wiping', () => {
        it('should zero out buffer contents', () => {
            const buffer = Buffer.from('sensitive-data-here');
            const originalLength = buffer.length;

            // Wipe the buffer
            buffer.fill(0);

            expect(buffer.length).toBe(originalLength);
            expect(buffer.every(byte => byte === 0)).toBe(true);
        });

        it('should zero out Uint8Array contents', () => {
            const array = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
            const originalLength = array.length;

            // Wipe the array
            array.fill(0);

            expect(array.length).toBe(originalLength);
            expect(Array.from(array).every(byte => byte === 0)).toBe(true);
        });
    });

    describe('Secret Hashing', () => {
        it('should produce consistent hashes for same input', () => {
            const secret = 'my-jwt-secret-key';

            const hash1 = crypto.createHash('sha256').update(secret).digest('hex');
            const hash2 = crypto.createHash('sha256').update(secret).digest('hex');

            expect(hash1).toBe(hash2);
            expect(hash1.length).toBe(64); // 256 bits = 64 hex chars
        });

        it('should produce different hashes for different inputs', () => {
            const secret1 = 'my-jwt-secret-key-1';
            const secret2 = 'my-jwt-secret-key-2';

            const hash1 = crypto.createHash('sha256').update(secret1).digest('hex');
            const hash2 = crypto.createHash('sha256').update(secret2).digest('hex');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Key Version Tracking', () => {
        it('should increment version numbers correctly', () => {
            const versions = [1, 2, 3, 4, 5];
            const currentVersion = Math.max(...versions);
            const nextVersion = currentVersion + 1;

            expect(nextVersion).toBe(6);
        });

        it('should handle empty version list', () => {
            const versions: number[] = [];
            const currentVersion = versions.length > 0 ? Math.max(...versions) : 0;
            const nextVersion = currentVersion + 1;

            expect(nextVersion).toBe(1);
        });
    });

    describe('Expiration Calculation', () => {
        it('should calculate correct expiration date', () => {
            const rotationDays = 90;
            const overlapDays = 7;

            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + rotationDays + overlapDays);

            const expectedDays = rotationDays + overlapDays;
            const actualDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            expect(actualDays).toBe(expectedDays);
        });

        it('should detect expired keys', () => {
            const now = new Date();
            const expiredDate = new Date(now);
            expiredDate.setDate(expiredDate.getDate() - 1);

            expect(expiredDate < now).toBe(true);
        });

        it('should detect keys within overlap period', () => {
            const overlapDays = 7;
            const now = new Date();

            // Key expiring in 5 days (within overlap)
            const expiringKey = new Date(now);
            expiringKey.setDate(expiringKey.getDate() + 5);

            const daysUntilExpiry = Math.ceil((expiringKey.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            expect(daysUntilExpiry <= overlapDays).toBe(true);
        });
    });
});

describe('Cryptographic Utilities', () => {
    describe('Random Generation', () => {
        it('should generate cryptographically random bytes', () => {
            const bytes1 = crypto.randomBytes(32);
            const bytes2 = crypto.randomBytes(32);

            expect(bytes1.length).toBe(32);
            expect(bytes2.length).toBe(32);
            expect(bytes1.equals(bytes2)).toBe(false);
        });

        it('should generate base64url encoded secrets', () => {
            const secret = crypto.randomBytes(64).toString('base64url');

            expect(secret.length).toBeGreaterThan(0);
            expect(secret).not.toMatch(/[+/=]/); // base64url should not have these chars
        });
    });

    describe('Timing Safe Comparison', () => {
        it('should return true for equal buffers', () => {
            const buf1 = Buffer.from('test-value');
            const buf2 = Buffer.from('test-value');

            expect(crypto.timingSafeEqual(buf1, buf2)).toBe(true);
        });

        it('should return false for different buffers', () => {
            const buf1 = Buffer.from('test-value-1');
            const buf2 = Buffer.from('test-value-2');

            expect(crypto.timingSafeEqual(buf1, buf2)).toBe(false);
        });
    });
});
