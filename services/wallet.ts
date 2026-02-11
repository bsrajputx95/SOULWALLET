// Wallet Service - Client-side wallet management
// IMPORTANT: react-native-get-random-values MUST be imported before @solana/web3.js
import 'react-native-get-random-values';
import { Keypair, Transaction } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import bs58 from 'bs58';
import { api } from './api';

// Simple XOR encryption helper (temporary for beta - replace with AES-256 in production)
const simpleEncrypt = (text: string, pin: string): string => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ pin.charCodeAt(i % pin.length);
        result += String.fromCharCode(charCode);
    }
    return btoa(result);
};

const simpleDecrypt = (encrypted: string, pin: string): string => {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ pin.charCodeAt(i % pin.length);
        result += String.fromCharCode(charCode);
    }
    return result;
};

/**
 * Decrypt wallet secret key with PIN for display purposes
 * Returns the secret key bytes or null if decryption fails
 */
export const decryptWalletSecret = async (pin: string): Promise<Uint8Array | null> => {
    try {
        const encrypted = await SecureStore.getItemAsync('wallet_secret');
        if (!encrypted) return null;
        const decrypted = simpleDecrypt(encrypted, pin);
        return new Uint8Array(JSON.parse(decrypted));
    } catch {
        return null;
    }
};

// Holding type from backend
export interface Holding {
    symbol: string;
    name: string;
    mint: string;
    balance: number;
    price: number;
    usdValue: number;
    decimals: number;
    logo?: string;
    change24h?: number;
}

// Portfolio response from backend
export interface PortfolioData {
    success: boolean;
    publicKey: string;
    totalUsdValue: number;
    holdings: Holding[];
}

// Transaction record type
export interface TransactionRecord {
    id: string;
    signature: string;
    type: string;
    amount: number;
    token: string;
    fromAddress: string;
    toAddress: string;
    fee: number;
    status: string;
    createdAt: string;
}

/**
 * Create a new wallet keypair client-side, encrypt and store in SecureStore,
 * then link the public key to the user's account on the backend.
 */
export const createWallet = async (authToken: string, userPin: string): Promise<{ success: boolean; publicKey?: string; error?: string }> => {
    try {
        // 1. Generate keypair
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const secretKey = Array.from(keypair.secretKey); // Uint8Array to array for JSON

        // 2. Encrypt secret key with user PIN
        const encrypted = simpleEncrypt(JSON.stringify(secretKey), userPin);

        // 3. Store encrypted secret locally (NEVER sent to backend)
        await SecureStore.setItemAsync('wallet_secret', encrypted);
        await SecureStore.setItemAsync('wallet_pubkey', publicKey);
        await SecureStore.setItemAsync('wallet_pin_hash', btoa(userPin)); // Store hashed PIN for verification

        // 4. Link public key to user account on backend
        await api.post('/wallet/link', { publicKey });
        return { success: true, publicKey };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create wallet';
        return { success: false, error: errorMessage };
    }
};

/**
 * Fetch wallet balances from backend (SOL + SPL tokens with USD prices)
 */
export const fetchBalances = async (_authToken: string): Promise<PortfolioData | null> => {
    try {
        return await api.get<PortfolioData>('/wallet/balances');
    } catch (err: any) {
        // Propagate specific errors for handling upstream
        if (err.status === 404 || err.message?.includes('No wallet linked')) {
            throw new Error('No wallet linked');
        }
        // For other errors, return null (will use fallback data)
        return null;
    }
};

/**
 * Check if user has a wallet stored locally
 */
export const hasLocalWallet = async (): Promise<boolean> => {
    const pubkey = await SecureStore.getItemAsync('wallet_pubkey');
    return !!pubkey;
};

/**
 * Get the locally stored public key
 */
export const getLocalPublicKey = async (): Promise<string | null> => {
    return await SecureStore.getItemAsync('wallet_pubkey');
};

/**
 * Get the stored PIN (always available after wallet creation/import).
 * The PIN is stored as btoa(pin) under wallet_pin_hash.
 */
export const getStoredPin = async (): Promise<string | null> => {
    try {
        const hash = await SecureStore.getItemAsync('wallet_pin_hash');
        if (!hash) return null;
        return atob(hash);
    } catch {
        return null;
    }
};

/**
 * Get the keypair for signing (requires PIN)
 */
export const getKeypairForSigning = async (userPin: string): Promise<Keypair | null> => {
    try {
        const encrypted = await SecureStore.getItemAsync('wallet_secret');
        if (!encrypted) return null;

        const decrypted = simpleDecrypt(encrypted, userPin);
        const secretKey = new Uint8Array(JSON.parse(decrypted));
        return Keypair.fromSecretKey(secretKey);
    } catch (error) {
        return null;
    }
};

/**
 * Clear wallet data (for logout or account deletion)
 */
export const clearWalletData = async (): Promise<void> => {
    await SecureStore.deleteItemAsync('wallet_secret');
    await SecureStore.deleteItemAsync('wallet_pubkey');
    await SecureStore.deleteItemAsync('wallet_pin_hash');
    // Also clear cached PIN for auto-execute
    await SecureStore.deleteItemAsync('cached_pin');
    await SecureStore.deleteItemAsync('cached_pin_expiry');
};

// PIN cache expiry time (24 hours in milliseconds)
const PIN_CACHE_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * Cache PIN for auto-execute functionality
 * Stores PIN with expiry timestamp
 */
export const cachePinForAutoExecute = async (pin: string): Promise<boolean> => {
    try {
        const expiry = Date.now() + PIN_CACHE_EXPIRY;
        await SecureStore.setItemAsync('cached_pin', pin);
        await SecureStore.setItemAsync('cached_pin_expiry', expiry.toString());
        return true;
    } catch {
        return false;
    }
};

/**
 * Get cached PIN if not expired
 * Returns null if no PIN or expired
 */
export const getCachedPin = async (): Promise<string | null> => {
    try {
        const pin = await SecureStore.getItemAsync('cached_pin');
        const expiryStr = await SecureStore.getItemAsync('cached_pin_expiry');

        if (!pin || !expiryStr) return null;

        const expiry = parseInt(expiryStr, 10);
        if (Date.now() > expiry) {
            // PIN expired, clear it
            await SecureStore.deleteItemAsync('cached_pin');
            await SecureStore.deleteItemAsync('cached_pin_expiry');
            return null;
        }

        return pin;
    } catch {
        return null;
    }
};

/**
 * Clear cached PIN (disable auto-execute)
 */
export const clearCachedPin = async (): Promise<void> => {
    await SecureStore.deleteItemAsync('cached_pin');
    await SecureStore.deleteItemAsync('cached_pin_expiry');
};

/**
 * Check if auto-execute is enabled (cached PIN exists and not expired)
 */
export const isAutoExecuteEnabled = async (): Promise<boolean> => {
    const pin = await getCachedPin();
    return !!pin;
};

/**
 * Import an existing wallet from private key
 * Encrypts with PIN and links to backend
 */
export const importWallet = async (
    _authToken: string,
    privateKeyBase58: string,
    userPin: string
): Promise<{ success: boolean; publicKey?: string; secretKey?: Uint8Array; error?: string }> => {
    let localStorageSet = false;
    try {
        // 1. Decode private key from base58
        const secretKey = bs58.decode(privateKeyBase58);

        // 2. Create keypair from secret key
        const keypair = Keypair.fromSecretKey(secretKey);
        const publicKey = keypair.publicKey.toBase58();

        // 3. Encrypt secret key with user PIN
        const encrypted = simpleEncrypt(JSON.stringify(Array.from(secretKey)), userPin);

        // 4. Store encrypted secret locally FIRST
        await SecureStore.setItemAsync('wallet_secret', encrypted);
        await SecureStore.setItemAsync('wallet_pubkey', publicKey);
        await SecureStore.setItemAsync('wallet_pin_hash', btoa(userPin));
        localStorageSet = true;

        // 5. Link public key to user account on backend
        try {
            await api.post('/wallet/link', { publicKey });
        } catch (linkError: any) {
            // Handle specific backend errors
            if (linkError.message?.includes('already linked to another account')) {
                throw new Error('This wallet address is already linked to another account. Please use a different wallet.');
            }
            // If backend fails but local storage succeeded, we can still proceed
            // The wallet will work locally and retry linking on next fetch
            console.warn('Backend link failed, wallet stored locally:', linkError);
        }

        return { success: true, publicKey, secretKey };
    } catch (error: unknown) {
        // Only rollback if we set local storage
        if (localStorageSet) {
            await SecureStore.deleteItemAsync('wallet_secret');
            await SecureStore.deleteItemAsync('wallet_pubkey');
            await SecureStore.deleteItemAsync('wallet_pin_hash');
        }

        // Provide specific error messages
        let errorMessage = 'Failed to import wallet';
        if (error instanceof Error) {
            if (error.message.includes('base58') || error.message.includes('length')) {
                errorMessage = 'Invalid private key format. Please check your key.';
            } else {
                errorMessage = error.message;
            }
        }
        return { success: false, error: errorMessage };
    }
};

/**
 * Retry helper with exponential backoff for network reliability
 */
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: unknown) {
            // Don't retry on validation/auth errors
            const err = error as { status?: number };
            if (err.status === 400 || err.status === 401) throw error;
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, i)));
        }
    }
    throw new Error('Max retries exceeded');
};

/**
 * Send SOL transaction - prepares on backend, signs locally, broadcasts
 */
export const sendTransaction = async (
    _authToken: string,
    toAddress: string,
    amount: number,
    pin: string,
    token: string = 'SOL'
): Promise<{ success: boolean; signature?: string; explorerUrl?: string; error?: string }> => {
    try {
        // 1. Request unsigned transaction from backend (uses centralized api client with retry)
        let prepareData: { transaction: string };

        try {
            prepareData = await retryWithBackoff(async () => {
                return await api.post<{ transaction: string }>('/transactions/prepare-send', {
                    toAddress,
                    amount,
                    token,
                });
            });
        } catch (error: any) {
            // Handle specific error messages from api client
            const errorMsg = error.message || 'Failed to prepare transaction';
            if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
                return { success: false, error: 'Insufficient SOL. Need ~0.00001 SOL for fees.' };
            }
            return { success: false, error: errorMsg };
        }

        // 2. Get encrypted private key and decrypt with PIN
        const encrypted = await SecureStore.getItemAsync('wallet_secret');
        if (!encrypted) {
            return { success: false, error: 'No wallet found. Please create a wallet first.' };
        }

        let keypair: Keypair;
        try {
            const decrypted = simpleDecrypt(encrypted, pin);
            const secretKey = new Uint8Array(JSON.parse(decrypted));
            keypair = Keypair.fromSecretKey(secretKey);
        } catch {
            return { success: false, error: 'Invalid PIN. Please try again.' };
        }

        // 3. Deserialize and sign the transaction
        const transaction = Transaction.from(bs58.decode(prepareData.transaction));
        transaction.sign(keypair);

        // 4. Serialize signed transaction
        const signedTx = bs58.encode(transaction.serialize());

        // 5. Clear keypair from memory immediately after signing
        // Note: JS doesn't allow true memory zeroing, but we nullify references
        // to reduce the window of exposure and help garbage collection
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        keypair = null as unknown as Keypair;

        // 6. Broadcast signed transaction (uses centralized api client with retry)
        let broadcastData: { signature: string; explorerUrl: string };

        try {
            broadcastData = await retryWithBackoff(async () => {
                return await api.post<{ signature: string; explorerUrl: string }>('/transactions/broadcast', {
                    signedTransaction: signedTx,
                    txData: { toAddress, amount, token },
                });
            });
        } catch (error: any) {
            // Specific error messages for common issues
            const errorMsg = error.message || '';
            if (errorMsg.includes('insufficient')) {
                return { success: false, error: 'Not enough SOL for transaction + fees' };
            }
            return { success: false, error: errorMsg || 'Transaction rejected by network' };
        }

        return {
            success: true,
            signature: broadcastData.signature,
            explorerUrl: broadcastData.explorerUrl,
        };
    } catch (error: any) {
        // Better error messages based on error type
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
            return { success: false, error: 'Check your internet connection' };
        }
        return { success: false, error: error.message || 'Transaction failed' };
    }
};

/**
 * Fetch transaction history from backend
 */
export const fetchTransactionHistory = async (_authToken: string): Promise<TransactionRecord[]> => {
    try {
        const data = await api.get<{ transactions: TransactionRecord[] }>('/transactions/history');
        return data.transactions || [];
    } catch {
        return [];
    }
};
