/**
 * Prisma Encryption Middleware
 * Provides automatic encryption/decryption of sensitive fields using pgcrypto.
 * Implements AES-256 symmetric encryption with key from environment variable.
 * @module encryption
 */

import crypto from 'crypto';
import { logger } from '../logger';

// Fields that should be encrypted at rest
const ENCRYPTED_FIELDS: Record<string, string[]> = {
    User: ['email', 'walletAddress'],
    CustodialWallet: ['encryptedKey'],
    KYCVerification: ['encryptedData'],
};

// Fields that need deterministic lookup hashes (for WHERE clause filtering)
// These require corresponding hash columns in the schema (e.g., emailHash)
const LOOKUP_HASH_FIELDS: Record<string, string[]> = {
    User: ['email', 'walletAddress'],  // User.emailHash, User.walletAddressHash columns required
};

// Algorithm for application-layer encryption
const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16;

/**
 * Get encryption key from environment
 * Key must be 32 bytes (256 bits) hex-encoded
 */
function getEncryptionKey(): Buffer {
    const key = process.env.PGCRYPTO_KEY;
    if (!key) {
        throw new Error('PGCRYPTO_KEY environment variable is not set');
    }

    // Handle hex-encoded key (64 chars = 32 bytes)
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
        return Buffer.from(key, 'hex');
    }

    // Handle base64-encoded key
    if (key.length === 44 && /^[A-Za-z0-9+/=]+$/.test(key)) {
        return Buffer.from(key, 'base64');
    }

    // Derive key from passphrase using PBKDF2
    const salt = process.env.PGCRYPTO_SALT || 'soulwallet-default-salt';
    return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt a string value using AES-256-GCM
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Create a deterministic HMAC-SHA256 hash for lookup fields
 * This hash is used for WHERE clause filtering on encrypted fields
 * Must be stored in a separate column (e.g., emailHash for email)
 */
export function hashForLookup(value: string): string {
    const key = getEncryptionKey();
    return crypto.createHmac('sha256', key)
        .update(value.toLowerCase().trim())
        .digest('hex');
}

/**
 * Check if a field should have a lookup hash
 */
function shouldHashForLookup(model: string, field: string): boolean {
    return LOOKUP_HASH_FIELDS[model]?.includes(field) ?? false;
}

/**
 * Get the hash column name for a field
 */
function getHashColumnName(field: string): string {
    return `${field}Hash`;
}

/**
 * Decrypt a string value using AES-256-GCM
 */
export function decrypt(encryptedValue: string): string {
    // Check if value is encrypted (contains our format separators)
    if (!encryptedValue.includes(':')) {
        return encryptedValue; // Not encrypted, return as-is
    }

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
        return encryptedValue; // Invalid format, return as-is
    }

    try {
        const key = getEncryptionKey();
        const [ivBase64, authTagBase64, ciphertext] = parts;

        if (!ivBase64 || !authTagBase64 || !ciphertext) {
            return encryptedValue; // Invalid parts
        }

        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        logger.warn('Failed to decrypt value, returning as-is', { error });
        return encryptedValue;
    }
}

/**
 * Check if a field should be encrypted
 */
function shouldEncryptField(model: string, field: string): boolean {
    return ENCRYPTED_FIELDS[model]?.includes(field) ?? false;
}

/**
 * Encrypt fields in data object before write
 * Also generates lookup hashes for fields that need them
 */
function encryptFields(model: string, data: any): any {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((item) => encryptFields(model, item));

    const result: Record<string, any> = { ...data };

    for (const [key, value] of Object.entries(result)) {
        if (shouldEncryptField(model, key) && typeof value === 'string' && value.length > 0) {
            // Don't re-encrypt already encrypted values
            if (!value.includes(':') || value.split(':').length !== 3) {
                result[key] = encrypt(value);

                // Also generate lookup hash if this field needs one
                if (shouldHashForLookup(model, key)) {
                    result[getHashColumnName(key)] = hashForLookup(value);
                }
            }
        }
    }

    return result;
}

/**
 * Decrypt fields in data object after read
 */
function decryptFields(model: string, data: any): any {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((item) => decryptFields(model, item));

    const result: Record<string, any> = { ...data };

    for (const [key, value] of Object.entries(result)) {
        if (shouldEncryptField(model, key) && typeof value === 'string') {
            result[key] = decrypt(value);
        }
    }

    return result;
}

/**
 * Prisma middleware for automatic encryption/decryption
 * Apply this to Prisma client using prisma.$use()
 * 
 * IMPORTANT: For WHERE lookups on encrypted fields, use the hash column:
 * - User.email lookups -> use User.emailHash with hashForLookup(email)
 */
export const encryptionMiddleware = async (
    params: { model?: string; action: string; args?: Record<string, any> },
    next: (params: any) => Promise<any>
) => {
    const model = params.model;

    if (!model || !ENCRYPTED_FIELDS[model]) {
        return next(params);
    }

    // Encrypt on write operations
    if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(params.action)) {
        if (params.args?.data) {
            params.args.data = encryptFields(model, params.args.data);
        }
        if (params.args?.create) {
            params.args.create = encryptFields(model, params.args.create);
        }
        if (params.args?.update) {
            params.args.update = encryptFields(model, params.args.update);
        }
    }

    // Comment 1 Fix: Convert encrypted field lookups to use hash columns
    // Instead of trying to re-encrypt with random IV (which won't match),
    // we redirect lookups to use deterministic hash columns
    if (['findUnique', 'findFirst', 'findMany', 'delete', 'deleteMany'].includes(params.action)) {
        if (params.args?.where) {
            const where = params.args.where;
            const newWhere: Record<string, any> = {};

            for (const [key, value] of Object.entries(where)) {
                if (shouldHashForLookup(model, key) && typeof value === 'string') {
                    // Redirect lookup to hash column with deterministic hash
                    const hashColumn = getHashColumnName(key);
                    newWhere[hashColumn] = hashForLookup(value);
                    logger.debug(`[Encryption] Redirected ${model}.${key} lookup to ${hashColumn}`);
                } else {
                    // Keep non-encrypted field lookups as-is
                    newWhere[key] = value;
                }
            }

            params.args.where = newWhere;
        }
    }

    const result = await next(params);

    // Decrypt on read operations
    if (['findUnique', 'findFirst', 'findMany', 'create', 'update', 'upsert'].includes(params.action)) {
        if (Array.isArray(result)) {
            return result.map((item) => decryptFields(model, item));
        }
        return decryptFields(model, result);
    }

    return result;
};

export const encryptionExtension = {
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }: any) {
                if (!model || !ENCRYPTED_FIELDS[model]) {
                    return query(args)
                }

                const nextArgs = args ? { ...args } : {}

                if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(operation)) {
                    if (nextArgs.data) nextArgs.data = encryptFields(model, nextArgs.data)
                    if (nextArgs.create) nextArgs.create = encryptFields(model, nextArgs.create)
                    if (nextArgs.update) nextArgs.update = encryptFields(model, nextArgs.update)
                }

                if (['findUnique', 'findFirst', 'findMany', 'delete', 'deleteMany'].includes(operation)) {
                    if (nextArgs.where) {
                        const where = nextArgs.where
                        const newWhere: Record<string, any> = {}

                        for (const [key, value] of Object.entries(where)) {
                            if (shouldHashForLookup(model, key) && typeof value === 'string') {
                                const hashColumn = getHashColumnName(key)
                                newWhere[hashColumn] = hashForLookup(value)
                            } else {
                                newWhere[key] = value
                            }
                        }

                        nextArgs.where = newWhere
                    }
                }

                const result = await query(nextArgs)

                if (['findUnique', 'findFirst', 'findMany', 'create', 'update', 'upsert'].includes(operation)) {
                    return decryptFields(model, result)
                }

                return result
            },
        },
    },
}

/**
 * Generate a new encryption key
 * Use this for initial setup or key rotation
 */
export function generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Re-encrypt all data with a new key
 * Used during key rotation
 */
export async function rotateEncryptionKey(
    prisma: any,
    oldKey: string,
    newKey: string
): Promise<{ success: boolean; rotatedRecords: number }> {
    let rotatedRecords = 0;

    try {
        // Temporarily set old key
        process.env.PGCRYPTO_KEY = oldKey;

        // For each model with encrypted fields
        for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
            const tableName = model.charAt(0).toLowerCase() + model.slice(1);
            const records = await (prisma as any)[tableName].findMany();

            for (const record of records) {
                const updates: Record<string, string> = {};

                // Decrypt with old key
                for (const field of fields) {
                    if (record[field]) {
                        const decrypted = decrypt(record[field]);

                        // Switch to new key for encryption
                        process.env.PGCRYPTO_KEY = newKey;
                        updates[field] = encrypt(decrypted);
                        process.env.PGCRYPTO_KEY = oldKey; // Switch back for next field
                    }
                }

                if (Object.keys(updates).length > 0) {
                    // Use new key for the update
                    process.env.PGCRYPTO_KEY = newKey;
                    await (prisma as any)[tableName].update({
                        where: { id: record.id },
                        data: updates,
                    });
                    rotatedRecords++;
                    process.env.PGCRYPTO_KEY = oldKey;
                }
            }
        }

        // Set new key as permanent
        process.env.PGCRYPTO_KEY = newKey;

        logger.info('Encryption key rotation completed', { rotatedRecords });
        return { success: true, rotatedRecords };
    } catch (error) {
        logger.error('Encryption key rotation failed', { error });
        throw error;
    }
}

/**
 * Verify encryption is working correctly
 */
export function verifyEncryption(): boolean {
    try {
        const testValue = 'test-encryption-verification';
        const encrypted = encrypt(testValue);
        const decrypted = decrypt(encrypted);
        return decrypted === testValue;
    } catch (error) {
        logger.error('Encryption verification failed', { error });
        return false;
    }
}

/**
 * Comment 1 Fix: Backfill lookup hashes for existing records
 * 
 * Call this after migration to populate emailHash and walletAddressHash
 * for existing User records. This enables WHERE clause filtering on
 * encrypted fields.
 * 
 * @param prisma - PrismaClient instance
 * @returns Statistics about backfilled records
 */
export async function backfillHashes(prisma: any): Promise<{
    success: boolean;
    processed: number;
    failed: number;
}> {
    logger.info('Starting hash backfill for encrypted fields...');

    let processed = 0;
    let failed = 0;

    try {
        // Get all users that need hash backfill
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { emailHash: null },
                    { walletAddressHash: null, walletAddress: { not: null } }
                ]
            },
            select: {
                id: true,
                email: true,
                walletAddress: true,
                emailHash: true,
                walletAddressHash: true,
            }
        });

        logger.info(`Found ${users.length} users needing hash backfill`);

        for (const user of users) {
            try {
                const updates: Record<string, string> = {};

                // Backfill emailHash if missing
                if (!user.emailHash && user.email) {
                    // If email is encrypted, decrypt it first
                    const plainEmail = isEncrypted(user.email)
                        ? decrypt(user.email)
                        : user.email;
                    updates.emailHash = hashForLookup(plainEmail);
                }

                // Backfill walletAddressHash if missing
                if (!user.walletAddressHash && user.walletAddress) {
                    // If walletAddress is encrypted, decrypt it first
                    const plainWallet = isEncrypted(user.walletAddress)
                        ? decrypt(user.walletAddress)
                        : user.walletAddress;
                    updates.walletAddressHash = hashForLookup(plainWallet);
                }

                if (Object.keys(updates).length > 0) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: updates,
                    });
                    processed++;
                }
            } catch (error) {
                failed++;
                logger.error('Failed to backfill hashes for user', {
                    userId: user.id,
                    error
                });
            }
        }

        logger.info('Hash backfill completed', { processed, failed });
        return { success: true, processed, failed };
    } catch (error) {
        logger.error('Hash backfill failed', { error });
        return { success: false, processed, failed };
    }
}

/**
 * Check if a value appears to be encrypted (contains : separators)
 */
function isEncrypted(value: string): boolean {
    return value.includes(':') && value.split(':').length === 3;
}

