/**
 * ✅ PRODUCTION-READY WALLET CREATION
 * - Client-side key generation only
 * - Encrypted storage with user password
 * - BIP39 mnemonic support
 * - No backend key storage
 */
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { SecureStorage } from '@/lib/secure-storage';
import { trpc } from '@/lib/trpc';
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
    // Generate BIP39 mnemonic (12 words)
    const mnemonic = bip39.generateMnemonic();
    
    // Derive seed from mnemonic
    const seed = await bip39.mnemonicToSeed(mnemonic);
    
    // Derive Solana keypair using standard path
    const path = "m/44'/501'/0'/0'"; // Solana derivation path
    const derivedSeed = derivePath(path, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);
    
    // Encrypt private key with user password
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    await SecureStorage.setEncryptedPrivateKey(privateKeyBase58, password);
    
    // Encrypt mnemonic separately
    await SecureStorage.setEncryptedMnemonic(mnemonic, password);
    
    return {
      keypair,
      mnemonic,
      publicKey: keypair.publicKey.toString(),
    };
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
      const encrypted = await SecureStorage.getSecureItem('wallet_private_key_enc');
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
   */
  static async registerWallet(publicKey: string): Promise<void> {
    // Only send public key to backend
    await trpc.wallet.register.mutate({ publicKey });
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
          
          // Register with backend
          await WalletManager.registerWallet(result.publicKey);
          
          set({
            isCreating: false,
            hasWallet: true,
            currentPublicKey: result.publicKey,
          });
          
          return {
            mnemonic: result.mnemonic,
            publicKey: result.publicKey,
          };
        } catch (error: any) {
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
          
          // Register with backend
          await WalletManager.registerWallet(result.publicKey);
          
          set({
            isImporting: false,
            hasWallet: true,
            currentPublicKey: result.publicKey,
          });
          
          return result.publicKey;
        } catch (error: any) {
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
          
          // Register with backend
          await WalletManager.registerWallet(result.publicKey);
          
          set({
            isImporting: false,
            hasWallet: true,
            currentPublicKey: result.publicKey,
          });
          
          return result.publicKey;
        } catch (error: any) {
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
            const publicKey = await SecureStorage.getSecureItem('wallet_public_key');
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
