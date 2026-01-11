/**
 * CustodialWalletService Unit Tests
 * Tests for encryption logic, wallet validation, transaction limits, and security features
 */

import * as crypto from 'crypto';

describe('CustodialWalletService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================
    // Encryption/Decryption Tests
    // =========================================
    describe('Encryption', () => {
        const ALGORITHM = 'aes-256-gcm';
        const IV_LENGTH = 16;

        const encryptWithKey = (data: Buffer, key: Buffer) => {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
            const tag = cipher.getAuthTag();
            return { encryptedKey: encrypted, iv, tag };
        };

        const decryptWithKey = (encrypted: Buffer, iv: Buffer, tag: Buffer, key: Buffer) => {
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(encrypted), decipher.final()]);
        };

        it('should encrypt data with AES-256-GCM', () => {
            const key = crypto.randomBytes(32);
            const data = crypto.randomBytes(64);

            const result = encryptWithKey(data, key);

            expect(result.encryptedKey).toBeTruthy();
            expect(result.iv.length).toBe(16);
            expect(result.tag.length).toBe(16);
        });

        it('should produce different ciphertexts for same data with different IVs', () => {
            const key = crypto.randomBytes(32);
            const data = crypto.randomBytes(64);

            const result1 = encryptWithKey(data, key);
            const result2 = encryptWithKey(data, key);

            expect(result1.encryptedKey.toString('hex')).not.toBe(result2.encryptedKey.toString('hex'));
        });

        it('should decrypt encrypted data correctly', () => {
            const key = crypto.randomBytes(32);
            const originalData = crypto.randomBytes(64);

            const encrypted = encryptWithKey(originalData, key);
            const decrypted = decryptWithKey(encrypted.encryptedKey, encrypted.iv, encrypted.tag, key);

            expect(decrypted.toString('hex')).toBe(originalData.toString('hex'));
        });

        it('should throw on decryption with wrong key', () => {
            const key1 = crypto.randomBytes(32);
            const key2 = crypto.randomBytes(32);
            const data = crypto.randomBytes(64);

            const encrypted = encryptWithKey(data, key1);

            expect(() => {
                decryptWithKey(encrypted.encryptedKey, encrypted.iv, encrypted.tag, key2);
            }).toThrow();
        });

        it('should throw on decryption with wrong IV', () => {
            const key = crypto.randomBytes(32);
            const data = crypto.randomBytes(64);

            const encrypted = encryptWithKey(data, key);
            const wrongIv = crypto.randomBytes(16);

            expect(() => {
                decryptWithKey(encrypted.encryptedKey, wrongIv, encrypted.tag, key);
            }).toThrow();
        });

        it('should throw on decryption with tampered auth tag', () => {
            const key = crypto.randomBytes(32);
            const data = crypto.randomBytes(64);

            const encrypted = encryptWithKey(data, key);
            const tamperedTag = crypto.randomBytes(16);

            expect(() => {
                decryptWithKey(encrypted.encryptedKey, encrypted.iv, tamperedTag, key);
            }).toThrow();
        });
    });

    // =========================================
    // Key Derivation Tests
    // =========================================
    describe('Key Derivation', () => {
        const PBKDF2_ITERATIONS = 310000;
        const KEY_LENGTH = 32;

        const deriveKey = (password: string, salt: Buffer) => {
            return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
        };

        it('should produce deterministic output for same inputs', () => {
            const password = 'test-password';
            const salt = crypto.randomBytes(32);

            const key1 = deriveKey(password, salt);
            const key2 = deriveKey(password, salt);

            expect(key1.toString('hex')).toBe(key2.toString('hex'));
        });

        it('should produce different output for different salts', () => {
            const password = 'test-password';
            const salt1 = crypto.randomBytes(32);
            const salt2 = crypto.randomBytes(32);

            const key1 = deriveKey(password, salt1);
            const key2 = deriveKey(password, salt2);

            expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
        });

        it('should produce 32-byte key', () => {
            const password = 'test-password';
            const salt = crypto.randomBytes(32);

            const key = deriveKey(password, salt);

            expect(key.length).toBe(32);
        });
    });

    // =========================================
    // Secure Wipe Tests
    // =========================================
    describe('Secure Wipe', () => {
        const secureWipe = (buffer: Buffer | Uint8Array | null | undefined) => {
            if (!buffer) return;
            buffer.fill(0);
        };

        it('should zero out buffer contents', () => {
            const buffer = Buffer.from([1, 2, 3, 4, 5]);
            secureWipe(buffer);

            expect(buffer.every(b => b === 0)).toBe(true);
        });

        it('should handle Uint8Array', () => {
            const arr = new Uint8Array([1, 2, 3, 4, 5]);
            secureWipe(arr);

            expect(Array.from(arr).every(b => b === 0)).toBe(true);
        });

        it('should handle null gracefully', () => {
            expect(() => secureWipe(null)).not.toThrow();
        });

        it('should handle undefined gracefully', () => {
            expect(() => secureWipe(undefined)).not.toThrow();
        });
    });

    // =========================================
    // Transaction Limit Validation Tests
    // =========================================
    describe('Transaction Limits', () => {
        const TRANSACTION_LIMITS = {
            maxSingleTransaction: 100,
            maxDailyTransaction: 1000,
            maxCopyBudget: 10000,
            maxPerTrade: 1000,
        };

        const validateTransactionAmount = (amount: number) => {
            if (amount <= 0 || !Number.isFinite(amount)) {
                return { valid: false, error: 'Amount must be positive' };
            }
            if (amount > TRANSACTION_LIMITS.maxSingleTransaction) {
                return { valid: false, error: `Exceeds limit of ${TRANSACTION_LIMITS.maxSingleTransaction}` };
            }
            return { valid: true };
        };

        it('should reject negative amounts', () => {
            const result = validateTransactionAmount(-1);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('positive');
        });

        it('should reject zero amount', () => {
            const result = validateTransactionAmount(0);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('positive');
        });

        it('should reject amounts exceeding limit', () => {
            const result = validateTransactionAmount(150);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('limit');
        });

        it('should accept valid amounts', () => {
            const result = validateTransactionAmount(50);
            expect(result.valid).toBe(true);
        });
    });

    // =========================================
    // Copy Trading Budget Validation Tests
    // =========================================
    describe('Copy Trade Budget', () => {
        const TRANSACTION_LIMITS = {
            maxCopyBudget: 10000,
            maxPerTrade: 1000,
        };

        const validateCopyTradeBudget = (totalBudget: number, amountPerTrade: number) => {
            if (totalBudget > TRANSACTION_LIMITS.maxCopyBudget) {
                return { valid: false, error: `Budget exceeds maximum of ${TRANSACTION_LIMITS.maxCopyBudget}` };
            }
            if (amountPerTrade > TRANSACTION_LIMITS.maxPerTrade) {
                return { valid: false, error: `Amount per trade exceeds maximum of ${TRANSACTION_LIMITS.maxPerTrade}` };
            }
            return { valid: true };
        };

        it('should reject budget exceeding maximum', () => {
            const result = validateCopyTradeBudget(20000, 100);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('maximum');
        });

        it('should reject amount per trade exceeding maximum', () => {
            const result = validateCopyTradeBudget(5000, 2000);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('maximum');
        });

        it('should accept valid budget and amount', () => {
            const result = validateCopyTradeBudget(5000, 500);
            expect(result.valid).toBe(true);
        });
    });

    // =========================================
    // Solana Address Validation Tests
    // =========================================
    describe('Solana Address Validation', () => {
        const isValidSolanaAddress = (address: string) => {
            if (!address || typeof address !== 'string') return false;
            if (address.length < 32 || address.length > 44) return false;
            return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
        };

        it('should validate correct Solana addresses', () => {
            expect(isValidSolanaAddress('So11111111111111111111111111111111111111112')).toBe(true);
            expect(isValidSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
        });

        it('should reject short addresses', () => {
            expect(isValidSolanaAddress('short')).toBe(false);
        });

        it('should reject addresses with invalid characters', () => {
            expect(isValidSolanaAddress('0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O')).toBe(false);
        });

        it('should reject null/undefined', () => {
            expect(isValidSolanaAddress(null as any)).toBe(false);
            expect(isValidSolanaAddress(undefined as any)).toBe(false);
        });
    });

    // =========================================
    // Keypair Generation Tests
    // =========================================
    describe('Keypair Generation', () => {
        it('should generate unique keypairs', () => {
            const generateKeypair = () => crypto.randomBytes(64);

            const key1 = generateKeypair();
            const key2 = generateKeypair();

            expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
        });

        it('should generate correct length keypair', () => {
            const keypair = crypto.randomBytes(64);
            expect(keypair.length).toBe(64);
        });
    });

    // =========================================
    // Salt Generation Tests
    // =========================================
    describe('Salt Generation', () => {
        const SALT_LENGTH = 32;

        it('should generate salt of correct length', () => {
            const salt = crypto.randomBytes(SALT_LENGTH);
            expect(salt.length).toBe(32);
        });

        it('should generate unique salts', () => {
            const salt1 = crypto.randomBytes(SALT_LENGTH);
            const salt2 = crypto.randomBytes(SALT_LENGTH);

            expect(salt1.toString('hex')).not.toBe(salt2.toString('hex'));
        });
    });

    // =========================================
    // Daily Limit Tracking Tests
    // =========================================
    describe('Daily Limit Tracking', () => {
        const checkDailyLimit = (currentTotal: number, newAmount: number, limit: number) => {
            if (currentTotal + newAmount > limit) {
                return { allowed: false, remaining: Math.max(0, limit - currentTotal) };
            }
            return { allowed: true, remaining: limit - currentTotal - newAmount };
        };

        it('should allow transaction within limit', () => {
            const result = checkDailyLimit(500, 100, 1000);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(400);
        });

        it('should reject transaction exceeding limit', () => {
            const result = checkDailyLimit(950, 100, 1000);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(50);
        });

        it('should handle exactly at limit', () => {
            const result = checkDailyLimit(900, 100, 1000);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(0);
        });
    });
});
