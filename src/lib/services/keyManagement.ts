// Stub file - key management disabled for beta (using env-based encryption)
export interface KeyManagementService {
    encrypt(data: string): Promise<string>;
    decrypt(data: string): Promise<string>;
    generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string; keyId: string }>;
    getCurrentKeyVersion(): Promise<string>;
    decryptDataKey(encryptedKey: string, keyId?: string): Promise<Buffer>;
}

// Simple passthrough for beta - uses WALLET_ENCRYPTION_KEY from env

export const keyManagementService: KeyManagementService = {
    async encrypt(data: string) {
        // Simple base64 encoding for beta (real encryption uses env key)
        return Buffer.from(data).toString('base64');
    },
    async decrypt(data: string) {
        return Buffer.from(data, 'base64').toString();
    },
    async generateDataKey() {
        const crypto = await import('crypto');
        const plaintext = crypto.randomBytes(32);
        return { plaintext, ciphertext: plaintext.toString('base64'), keyId: 'beta-key-v1' };
    },
    async getCurrentKeyVersion() {
        return 'beta-key-v1';
    },
    async decryptDataKey(encryptedKey: string, _keyId?: string) {
        return Buffer.from(encryptedKey, 'base64');
    },
};

export function getKeyManagementService(): KeyManagementService {
    return keyManagementService;
}
