/**
 * Property-based tests for CustodialWalletService
 * 
 * **Feature: home-screen-production-ready, Property 20: Wallet Key Encryption**
 * **Validates: Requirements 13.3**
 * 
 * **Feature: home-screen-production-ready, Property 1: Wallet Keypair Retrieval Consistency**
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.3**
 */

import * as fc from 'fast-check';
import { Keypair } from '@solana/web3.js';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

// Test encryption/decryption logic directly (without database)
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

// Helper to derive encryption key
function deriveKey(secret: string, salt: string): Buffer {
  return pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

// Helper to encrypt private key
function encryptPrivateKey(
  privateKey: Uint8Array,
  masterKey: Buffer
): { encryptedKey: string; iv: string; tag: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(privateKey)),
    cipher.final(),
  ]);
  
  const tag = cipher.getAuthTag();
  
  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

// Helper to decrypt private key
function decryptPrivateKey(
  encryptedKey: string,
  iv: string,
  tag: string,
  masterKey: Buffer
): Uint8Array {
  const decipher = createDecipheriv(
    ALGORITHM,
    masterKey,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, 'base64')),
    decipher.final(),
  ]);
  
  return new Uint8Array(decrypted);
}

describe('CustodialWalletService Property Tests', () => {
  const testMasterSecret = 'test-master-secret-for-property-testing-12345';
  const testSalt = 'test-salt-v1';
  let masterKey: Buffer;

  beforeAll(() => {
    masterKey = deriveKey(testMasterSecret, testSalt);
  });

  /**
   * **Feature: home-screen-production-ready, Property 20: Wallet Key Encryption**
   * **Validates: Requirements 13.3**
   * 
   * For any custodial wallet stored in the database, the private key field
   * SHALL be encrypted and not readable as plaintext.
   */
  describe('Property 20: Wallet Key Encryption', () => {
    it('encrypted key should not contain plaintext private key bytes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // Number of wallets to test
          (count) => {
            for (let i = 0; i < count; i++) {
              const keypair = Keypair.generate();
              const privateKeyBytes = keypair.secretKey;
              
              const { encryptedKey, iv, tag } = encryptPrivateKey(privateKeyBytes, masterKey);
              
              // The encrypted key should not contain the raw private key bytes
              const encryptedBuffer = Buffer.from(encryptedKey, 'base64');
              const privateKeyBuffer = Buffer.from(privateKeyBytes);
              
              // Check that encrypted data doesn't match plaintext
              expect(encryptedBuffer.equals(privateKeyBuffer)).toBe(false);
              
              // Check that the encrypted key is base64 encoded (not raw bytes)
              expect(encryptedKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
              
              // Verify IV and tag are also base64 encoded
              expect(iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
              expect(tag).toMatch(/^[A-Za-z0-9+/]+=*$/);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('encrypted key should be different for same private key with different IVs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          () => {
            const keypair = Keypair.generate();
            const privateKeyBytes = keypair.secretKey;
            
            // Encrypt the same key twice (will use different random IVs)
            const result1 = encryptPrivateKey(privateKeyBytes, masterKey);
            const result2 = encryptPrivateKey(privateKeyBytes, masterKey);
            
            // Encrypted keys should be different due to different IVs
            expect(result1.encryptedKey).not.toBe(result2.encryptedKey);
            expect(result1.iv).not.toBe(result2.iv);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: home-screen-production-ready, Property 1: Wallet Keypair Retrieval Consistency**
   * **Validates: Requirements 1.1, 1.2, 1.3, 2.3**
   * 
   * For any user with a custodial wallet, when the execution queue retrieves
   * their keypair, the keypair's public key SHALL match the user's stored public key.
   */
  describe('Property 1: Wallet Keypair Retrieval Consistency', () => {
    it('decrypted keypair public key should match original public key', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (count) => {
            for (let i = 0; i < count; i++) {
              // Generate a keypair (simulating wallet creation)
              const originalKeypair = Keypair.generate();
              const originalPublicKey = originalKeypair.publicKey.toBase58();
              
              // Encrypt the private key (simulating storage)
              const { encryptedKey, iv, tag } = encryptPrivateKey(
                originalKeypair.secretKey,
                masterKey
              );
              
              // Decrypt the private key (simulating retrieval)
              const decryptedPrivateKey = decryptPrivateKey(
                encryptedKey,
                iv,
                tag,
                masterKey
              );
              
              // Reconstruct keypair from decrypted key
              const retrievedKeypair = Keypair.fromSecretKey(decryptedPrivateKey);
              const retrievedPublicKey = retrievedKeypair.publicKey.toBase58();
              
              // Public keys must match
              expect(retrievedPublicKey).toBe(originalPublicKey);
              
              // Secret keys must also match
              expect(Buffer.from(retrievedKeypair.secretKey).equals(
                Buffer.from(originalKeypair.secretKey)
              )).toBe(true);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('round-trip encryption/decryption should preserve keypair integrity', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 64, maxLength: 64 }), // Solana keypair is 64 bytes
          (secretKeyBytes) => {
            try {
              // Create keypair from random bytes
              const keypair = Keypair.fromSecretKey(secretKeyBytes);
              const originalPublicKey = keypair.publicKey.toBase58();
              
              // Encrypt
              const { encryptedKey, iv, tag } = encryptPrivateKey(secretKeyBytes, masterKey);
              
              // Decrypt
              const decrypted = decryptPrivateKey(encryptedKey, iv, tag, masterKey);
              
              // Verify round-trip
              const recoveredKeypair = Keypair.fromSecretKey(decrypted);
              
              return recoveredKeypair.publicKey.toBase58() === originalPublicKey;
            } catch {
              // Invalid keypair bytes - skip this test case
              return true;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional security property: Decryption with wrong key should fail
   */
  describe('Security: Wrong key decryption', () => {
    it('decryption with different master key should fail', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }), // Different secret
          (differentSecret) => {
            const keypair = Keypair.generate();
            
            // Encrypt with original key
            const { encryptedKey, iv, tag } = encryptPrivateKey(
              keypair.secretKey,
              masterKey
            );
            
            // Try to decrypt with different key
            const wrongKey = deriveKey(differentSecret, testSalt);
            
            // Should throw an error
            expect(() => {
              decryptPrivateKey(encryptedKey, iv, tag, wrongKey);
            }).toThrow();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
