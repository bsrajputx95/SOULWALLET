/**
 * ✅ PRODUCTION-READY WALLET CREATION
 * - Client-side key generation only
 * - Encrypted storage with user password
 * - BIP39 mnemonic support
 * - No backend key storage
 */

// CRITICAL: Polyfill must be imported FIRST before any crypto libraries
import 'react-native-get-random-values';

import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { SecureStorage, setSecureItem, getSecureItem } from '@/lib/secure-storage';
import { trpcClient } from '@/lib/trpc';
import bs58 from 'bs58';

/**
 * React hook for wallet management
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export class WalletManager {
  /**
   * Generate new wallet (CLIENT-SIDE ONLY)
   */
  static async createNewWallet(password: string): Promise<{
    keypair: Keypair;
    mnemonic: string;
    publicKey: string;
  }> {
    try {
      console.log('[WalletManager] Step 1: Starting wallet creation');
      
      // Generate BIP39 mnemonic (12 words)
      console.log('[WalletManager] Step 2: Generating mnemonic...');
      const mnemonic = bip39.generateMnemonic();
      console.log('[WalletManager] Step 2: Mnemonic generated successfully');

      // Derive seed from mnemonic
      console.log('[WalletManager] Step 3: Deriving seed from mnemonic...');
      const seed = await bip39.mnemonicToSeed(mnemonic);
      console.log('[WalletManager] Step 3: Seed derived successfully');

      // Derive Solana keypair using standard path
      console.log('[WalletManager] Step 4: Deriving keypair from seed...');
      const path = "m/44'/501'/0'/0'"; // Solana derivation path
      const derivedSeed = derivePath(path, seed.toString('hex')).key;
      console.log('[WalletManager] Step 4: Keypair path derived successfully');
      
      console.log('[WalletManager] Step 5: Creating Keypair from seed...');
      const keypair = Keypair.fromSeed(derivedSeed);
      console.log('[WalletManager] Step 5: Keypair created successfully');

      // Encrypt private key with user password
      console.log('[WalletManager] Step 6: Encrypting private key...');
      const privateKeyBase58 = bs58.encode(keypair.secretKey);
      await SecureStorage.setEncryptedPrivateKey(privateKeyBase58, password);
      console.log('[WalletManager] Step 6: Private key encrypted and stored');

      // Encrypt mnemonic separately
      console.log('[WalletManager] Step 7: Encrypting mnemonic...');
      await SecureStorage.setEncryptedMnemonic(mnemonic, password);
      console.log('[WalletManager] Step 7: Mnemonic encrypted and stored');

      console.log('[WalletManager] Step 8: Wallet creation complete');
      return {
        keypair,
        mnemonic,
        publicKey: keypair.publicKey.toString(),
      };
    } catch (error) {
      console.error('[WalletManager] Error creating wallet:', error);
      
      // Log full error details for debugging
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('[WalletManager] Error message:', errorMsg);
      console.error('[WalletManager] Error stack:', errorStack);
      
      // Re-throw the original error to see what's actually happening
      throw error;
    }
  }

  /**
   * Import wallet from mnemonic (CLIENT-SIDE ONLY)
   */
  static async importFromMnemonic(
    mnemonic: string,
    password: string
  ): Promise<{ keypair: Keypair; publicKey: string }> {
    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Same derivation process as creation
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const path = "m/44'/501'/0'/0'";
    const derivedSeed = derivePath(path, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);

    // Encrypt and store
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    await SecureStorage.setEncryptedPrivateKey(privateKeyBase58, password);
    await SecureStorage.setEncryptedMnemonic(mnemonic, password);

    return {
      keypair,
      publicKey: keypair.publicKey.toString(),
    };
  }

  /**
   * Import wallet from private key (CLIENT-SIDE ONLY)
   */
  static async importFromPrivateKey(
    privateKey: string,
    password: string
  ): Promise<{ keypair: Keypair; publicKey: string }> {
    let keypair: Keypair;

    try {
      // Try base58 format first
      const secretKey = bs58.decode(privateKey);
      keypair = Keypair.fromSecretKey(secretKey);
    } catch {
      // Try JSON array format
      const secretKey = new Uint8Array(JSON.parse(privateKey));
      keypair = Keypair.fromSecretKey(secretKey);
    }

    // Encrypt and store
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    await SecureStorage.setEncryptedPrivateKey(privateKeyBase58, password);

    return {
      keypair,
      publicKey: keypair.publicKey.toString(),
    };
  }

  /**
   * Retrieve wallet (requires password)
   */
  static async getWallet(password: string): Promise<Keypair> {
    const privateKeyBase58 = await SecureStorage.getDecryptedPrivateKey(password);

    if (!privateKeyBase58) {
      throw new Error('No wallet found. Please create or import a wallet.');
    }

    const secretKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(secretKey);
  }

  /**
   * Check if wallet exists
   */
  static async hasWallet(): Promise<boolean> {
    try {
      // Try to get encrypted private key (doesn't require password)
      const encrypted = await getSecureItem('wallet_private_key_enc');
      return encrypted !== null;
    } catch {
      return false;
    }
  }

  /**
   * Delete wallet (WARNING: IRREVERSIBLE)
   */
  static async deleteWallet(): Promise<void> {
    await SecureStorage.deleteEncryptedPrivateKey();
    await SecureStorage.deleteEncryptedMnemonic();
  }

  /**
   * Export mnemonic (requires password)
   */
  static async exportMnemonic(password: string): Promise<string> {
    const mnemonic = await SecureStorage.getDecryptedMnemonic(password);

    if (!mnemonic) {
      throw new Error('No mnemonic found for this wallet.');
    }

    return mnemonic;
  }

  /**
   * Export private key (requires password)
   */
  static async exportPrivateKey(password: string): Promise<string> {
    const privateKeyBase58 = await SecureStorage.getDecryptedPrivateKey(password);

    if (!privateKeyBase58) {
      throw new Error('No wallet found.');
    }

    return privateKeyBase58;
  }

  /**
   * Change wallet password
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Decrypt with old password
    const privateKeyBase58 = await SecureStorage.getDecryptedPrivateKey(oldPassword);
    const mnemonic = await SecureStorage.getDecryptedMnemonic(oldPassword);

    if (!privateKeyBase58) {
      throw new Error('Invalid old password or no wallet found.');
    }

    // Re-encrypt with new password
    await SecureStorage.setEncryptedPrivateKey(privateKeyBase58, newPassword);

    if (mnemonic) {
      await SecureStorage.setEncryptedMnemonic(mnemonic, newPassword);
    }
  }

  /**
   * Register wallet with backend (public key only)
   * Uses existing user.updateWalletAddress endpoint
   * Non-blocking: wallet creation succeeds even if sync fails
   */
  static async registerWallet(publicKey: string): Promise<boolean> {
    try {
      // Store public key locally first (unencrypted, for app access)
      await setSecureItem('wallet_public_key', publicKey);

      // Sync to backend using existing endpoint
      await trpcClient.user.updateWalletAddress.mutate({ walletAddress: publicKey });
      console.log('[WalletManager] Wallet synced to backend:', publicKey.slice(0, 8) + '...');
      return true;
    } catch (error) {
      // Non-blocking: log the error but don't throw
      // Wallet is still usable locally, sync can be retried later
      console.warn('[WalletManager] Backend sync failed (non-blocking):', error);
      return false;
    }
  }
}

interface WalletCreationState {
  isCreating: boolean;
  isImporting: boolean;
  hasWallet: boolean;
  currentPublicKey: string | null;
  error: string | null;

  // Actions
  createWallet: (password: string) => Promise<{ mnemonic: string; publicKey: string }>;
  importFromMnemonic: (mnemonic: string, password: string) => Promise<string>;
  importFromPrivateKey: (privateKey: string, password: string) => Promise<string>;
  checkWalletExists: () => Promise<void>;
  clearError: () => void;
}

export const useWalletCreationStore = create<WalletCreationState>()(
  devtools(
    (set, get) => ({
      isCreating: false,
      isImporting: false,
      hasWallet: false,
      currentPublicKey: null,
      error: null,

      createWallet: async (password: string) => {
        set({ isCreating: true, error: null });

        try {
          const result = await WalletManager.createNewWallet(password);
          console.log('[WalletCreation] Wallet created locally:', result.publicKey.slice(0, 8) + '...');

          // Register with backend (non-blocking)
          // Wallet creation succeeds even if backend sync fails
          const synced = await WalletManager.registerWallet(result.publicKey);

          set({
            isCreating: false,
            hasWallet: true,
            currentPublicKey: result.publicKey,
          });

          if (!synced) {
            console.log('[WalletCreation] Wallet created but backend sync pending');
          }

          return {
            mnemonic: result.mnemonic,
            publicKey: result.publicKey,
          };
        } catch (error: any) {
          console.error('[WalletCreation] Failed to create wallet:', error);
          set({
            isCreating: false,
            error: error.message || 'Failed to create wallet',
          });
          throw error;
        }
      },

      importFromMnemonic: async (mnemonic: string, password: string) => {
        set({ isImporting: true, error: null });

        try {
          const result = await WalletManager.importFromMnemonic(mnemonic, password);
          console.log('[WalletImport] Wallet imported from mnemonic:', result.publicKey.slice(0, 8) + '...');

          // Register with backend (non-blocking)
          const synced = await WalletManager.registerWallet(result.publicKey);

          set({
            isImporting: false,
            hasWallet: true,
            currentPublicKey: result.publicKey,
          });

          if (!synced) {
            console.log('[WalletImport] Wallet imported but backend sync pending');
          }

          return result.publicKey;
        } catch (error: any) {
          console.error('[WalletImport] Failed to import wallet:', error);
          set({
            isImporting: false,
            error: error.message || 'Failed to import wallet',
          });
          throw error;
        }
      },

      importFromPrivateKey: async (privateKey: string, password: string) => {
        set({ isImporting: true, error: null });

        try {
          const result = await WalletManager.importFromPrivateKey(privateKey, password);
          console.log('[WalletImport] Wallet imported from private key:', result.publicKey.slice(0, 8) + '...');

          // Register with backend (non-blocking)
          const synced = await WalletManager.registerWallet(result.publicKey);

          set({
            isImporting: false,
            hasWallet: true,
            currentPublicKey: result.publicKey,
          });

          if (!synced) {
            console.log('[WalletImport] Wallet imported but backend sync pending');
          }

          return result.publicKey;
        } catch (error: any) {
          console.error('[WalletImport] Failed to import wallet:', error);
          set({
            isImporting: false,
            error: error.message || 'Failed to import wallet',
          });
          throw error;
        }
      },

      checkWalletExists: async () => {
        try {
          const exists = await WalletManager.hasWallet();

          // If wallet exists, try to get public key from storage
          if (exists) {
            const publicKey = await getSecureItem('wallet_public_key');
            set({
              hasWallet: true,
              currentPublicKey: publicKey,
            });
          } else {
            set({
              hasWallet: false,
              currentPublicKey: null,
            });
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to check wallet',
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'wallet-creation-store',
    }
  )
);
