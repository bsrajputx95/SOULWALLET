/**
 * Database Encryption Tests
 *
 * Tests for the encryption middleware in src/lib/prisma/encryption.ts
 * Verifies AES-256-GCM encryption/decryption and deterministic hash generation
 */

import { encrypt, decrypt, hashForLookup, verifyEncryption, generateEncryptionKey } from '../../src/lib/prisma/encryption';

// Mock logger to prevent console noise
jest.mock('../../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('Database Encryption', () => {
    // Store original env
    const originalEnv = process.env;

    beforeAll(() => {
        // Set up test encryption key (32 bytes = 64 hex chars)
        process.env.PGCRYPTO_KEY = 'a'.repeat(64);
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('encrypt/decrypt roundtrip', () => {
        it('should encrypt and decrypt a simple string', () => {
            const plaintext = 'test@example.com';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should produce different ciphertext for same plaintext (random IV)', () => {
            const plaintext = 'same-value';
            const encrypted1 = encrypt(plaintext);
            const encrypted2 = encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should handle empty strings', () => {
            const plaintext = '';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle unicode characters', () => {
            const plaintext = 'こんにちは🌍';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle long strings', () => {
            const plaintext = 'x'.repeat(10000);
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });
    });

    describe('encrypted format', () => {
        it('should produce base64-encoded format with colons', () => {
            const encrypted = encrypt('test');
            const parts = encrypted.split(':');

            expect(parts.length).toBe(3);
            // Each part should be valid base64
            parts.forEach(part => {
                expect(() => Buffer.from(part, 'base64')).not.toThrow();
            });
        });
    });

    describe('decrypt edge cases', () => {
        it('should return non-encrypted values as-is', () => {
            const plainValue = 'not-encrypted-value';
            const result = decrypt(plainValue);

            expect(result).toBe(plainValue);
        });

        it('should return invalid format values as-is', () => {
            const invalidFormat = 'invalid:format';
            const result = decrypt(invalidFormat);

            expect(result).toBe(invalidFormat);
        });

        it('should handle corrupted ciphertext gracefully', () => {
            // Return as-is if decryption fails
            const corruptedValue = 'dGVzdA==:dGVzdA==:corrupted';
            const result = decrypt(corruptedValue);

            expect(result).toBe(corruptedValue);
        });
    });

    describe('hashForLookup', () => {
        it('should generate deterministic hash', () => {
            const value = 'test@example.com';
            const hash1 = hashForLookup(value);
            const hash2 = hashForLookup(value);

            expect(hash1).toBe(hash2);
        });

        it('should be case-insensitive', () => {
            const hash1 = hashForLookup('Test@Example.COM');
            const hash2 = hashForLookup('test@example.com');

            expect(hash1).toBe(hash2);
        });

        it('should trim whitespace', () => {
            const hash1 = hashForLookup('  test@example.com  ');
            const hash2 = hashForLookup('test@example.com');

            expect(hash1).toBe(hash2);
        });

        it('should produce 64-char hex string (SHA-256)', () => {
            const hash = hashForLookup('test');

            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should produce different hashes for different values', () => {
            const hash1 = hashForLookup('user1@example.com');
            const hash2 = hashForLookup('user2@example.com');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('verifyEncryption', () => {
        it('should return true when encryption is working', () => {
            const result = verifyEncryption();

            expect(result).toBe(true);
        });
    });

    describe('generateEncryptionKey', () => {
        it('should generate 64-char hex string', () => {
            const key = generateEncryptionKey();

            expect(key).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should generate unique keys each time', () => {
            const key1 = generateEncryptionKey();
            const key2 = generateEncryptionKey();

            expect(key1).not.toBe(key2);
        });
    });

    describe('missing encryption key', () => {
        it('should throw error when PGCRYPTO_KEY is not set', () => {
            const originalKey = process.env.PGCRYPTO_KEY;
            delete process.env.PGCRYPTO_KEY;

            expect(() => encrypt('test')).toThrow('PGCRYPTO_KEY environment variable is not set');

            process.env.PGCRYPTO_KEY = originalKey;
        });
    });
});
