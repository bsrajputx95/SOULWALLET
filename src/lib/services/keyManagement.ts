/**
 * Key Management Service - STUB FOR BETA
 * 
 * This is a simplified stub using environment variables.
 * Full AWS KMS/Vault integration will be implemented post-beta.
 */

import { logger } from '../logger';
import * as crypto from 'crypto';

export interface KeyManagementService {
    encrypt(data: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
    deriveKey(userId: string, purpose: string): Promise<string>;
    rotateKey(): Promise<void>;
    // Methods needed by CustodialWalletService
    generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string; keyId: string }>;
    decryptDataKey(ciphertext: string, keyId: string): Promise<Buffer>;
    getCurrentKeyVersion(): Promise<number>;
}

class EnvKeyManagementService implements KeyManagementService {
    private masterKey: string;
    private keyVersion = 1;

    constructor() {
        this.masterKey = process.env.WALLET_ENCRYPTION_KEY ||
            process.env.CUSTODIAL_WALLET_MASTER_SECRET ||
            'default-key-change-me-at-least-32-chars';

        if (this.masterKey.length < 32) {
            logger.warn('[KMS-STUB] Master key is less than 32 characters - insecure for production');
        }
    }

    async encrypt(data: string): Promise<string> {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(this.masterKey, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    async decrypt(ciphertext: string): Promise<string> {
        const [ivHex, encrypted] = ciphertext.split(':');
        if (!ivHex || !encrypted) throw new Error('Invalid ciphertext format');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.scryptSync(this.masterKey, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    async deriveKey(userId: string, purpose: string): Promise<string> {
        return crypto
            .createHmac('sha256', this.masterKey)
            .update(`${userId}:${purpose}`)
            .digest('hex');
    }

    async rotateKey(): Promise<void> {
        logger.info('[KMS-STUB] Key rotation skipped for beta');
    }

    /**
     * Generate a data encryption key (DEK) for envelope encryption
     * In production this would call AWS KMS GenerateDataKey or Vault Transit
     */
    async generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string; keyId: string }> {
        // Generate a random 32-byte key
        const plaintext = crypto.randomBytes(32);

        // "Encrypt" it with our master key (simulating KMS envelope encryption)
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(this.masterKey, 'kms-dek-salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(plaintext);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const ciphertext = iv.toString('base64') + ':' + encrypted.toString('base64');

        return {
            plaintext,
            ciphertext,
            keyId: 'beta-master-key',
        };
    }

    /**
     * Decrypt a data encryption key
     */
    async decryptDataKey(ciphertext: string, _keyId: string): Promise<Buffer> {
        const [ivB64, encryptedB64] = ciphertext.split(':');
        if (!ivB64 || !encryptedB64) throw new Error('Invalid DEK ciphertext format');

        const iv = Buffer.from(ivB64, 'base64');
        const encrypted = Buffer.from(encryptedB64, 'base64');
        const key = crypto.scryptSync(this.masterKey, 'kms-dek-salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted;
    }

    async getCurrentKeyVersion(): Promise<number> {
        return this.keyVersion;
    }
}

let kmsInstance: KeyManagementService | null = null;

export function getKeyManagementService(): KeyManagementService {
    if (!kmsInstance) {
        kmsInstance = new EnvKeyManagementService();
        logger.info('[KMS-STUB] Using environment-based key management for beta');
    }
    return kmsInstance;
}

export { EnvKeyManagementService };
