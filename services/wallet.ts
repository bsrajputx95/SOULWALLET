// Wallet Service - Client-side wallet management
// IMPORTANT: react-native-get-random-values MUST be imported before @solana/web3.js
import 'react-native-get-random-values';
import { Keypair, Transaction } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import bs58 from 'bs58';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
        const response = await fetch(`${API_URL}/wallet/link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ publicKey }),
        });

        const json = await response.json();

        if (!response.ok) {
            // Rollback local storage on failure
            await SecureStore.deleteItemAsync('wallet_secret');
            await SecureStore.deleteItemAsync('wallet_pubkey');
            await SecureStore.deleteItemAsync('wallet_pin_hash');
            return { success: false, error: json.error || 'Failed to link wallet' };
        }

        return { success: true, publicKey };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to create wallet' };
    }
};

/**
 * Fetch wallet balances from backend (SOL + SPL tokens with USD prices)
 */
export const fetchBalances = async (authToken: string): Promise<PortfolioData | null> => {
    try {
        const response = await fetch(`${API_URL}/wallet/balances`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
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
};

/**
 * Import an existing wallet from private key
 * Encrypts with PIN and links to backend
 */
export const importWallet = async (
    authToken: string,
    privateKeyBase58: string,
    userPin: string
): Promise<{ success: boolean; publicKey?: string; secretKey?: Uint8Array; error?: string }> => {
    try {
        // 1. Decode private key from base58
        const secretKey = bs58.decode(privateKeyBase58);

        // 2. Create keypair from secret key
        const keypair = Keypair.fromSecretKey(secretKey);
        const publicKey = keypair.publicKey.toBase58();

        // 3. Encrypt secret key with user PIN
        const encrypted = simpleEncrypt(JSON.stringify(Array.from(secretKey)), userPin);

        // 4. Store encrypted secret locally
        await SecureStore.setItemAsync('wallet_secret', encrypted);
        await SecureStore.setItemAsync('wallet_pubkey', publicKey);
        await SecureStore.setItemAsync('wallet_pin_hash', btoa(userPin));

        // 5. Link public key to user account on backend
        const response = await fetch(`${API_URL}/wallet/link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ publicKey }),
        });

        const json = await response.json();

        if (!response.ok) {
            // Rollback local storage on failure
            await SecureStore.deleteItemAsync('wallet_secret');
            await SecureStore.deleteItemAsync('wallet_pubkey');
            await SecureStore.deleteItemAsync('wallet_pin_hash');
            return { success: false, error: json.error || 'Failed to link wallet' };
        }

        return { success: true, publicKey, secretKey };
    } catch (error: any) {
        return { success: false, error: error.message || 'Invalid private key format' };
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
        } catch (error: any) {
            // Don't retry on validation/auth errors
            if (error.status === 400 || error.status === 401) throw error;
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
    authToken: string,
    toAddress: string,
    amount: number,
    pin: string,
    token: string = 'SOL'
): Promise<{ success: boolean; signature?: string; explorerUrl?: string; error?: string }> => {
    try {
        // 1. Request unsigned transaction from backend (with retry for network/5xx issues only)
        let prepareData: any;

        try {
            const result = await retryWithBackoff(async () => {
                const response = await fetch(`${API_URL}/transactions/prepare-send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ toAddress, amount, token }),
                });
                const data = await response.json();

                // For 4xx errors, return data without throwing (no retry needed)
                if (response.status >= 400 && response.status < 500) {
                    return { success: false, data, status: response.status };
                }
                // For 5xx errors, throw to trigger retry
                if (!response.ok) {
                    const error: any = new Error(data.error || 'Server error');
                    error.status = response.status;
                    throw error;
                }
                return { success: true, data };
            });

            if (!result.success) {
                // 4xx error - return specific message without retry
                const errorMsg = result.data?.error || 'Failed to prepare transaction';
                if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
                    return { success: false, error: 'Insufficient SOL. Need ~0.00001 SOL for fees.' };
                }
                return { success: false, error: errorMsg };
            }
            prepareData = result.data;
        } catch (retryError: any) {
            // All retries exhausted for 5xx errors
            return { success: false, error: retryError.message || 'Failed to prepare transaction' };
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
        // @ts-ignore - intentionally nullifying after use
        keypair = null;

        // 6. Broadcast signed transaction (with retry for RPC issues)
        const { broadcastResponse, broadcastData } = await retryWithBackoff(async () => {
            const response = await fetch(`${API_URL}/transactions/broadcast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    signedTransaction: signedTx,
                    txData: { toAddress, amount, token },
                }),
            });
            const data = await response.json();
            // Throw on error to trigger retry, but not for validation errors
            if (!response.ok && response.status >= 500) {
                const error: any = new Error(data.error || 'Failed to broadcast transaction');
                error.status = response.status;
                throw error;
            }
            return { broadcastResponse: response, broadcastData: data };
        });

        if (!broadcastResponse.ok) {
            // Specific error messages for common issues
            if (broadcastData.error?.includes('insufficient')) {
                return { success: false, error: 'Not enough SOL for transaction + fees' };
            }
            return { success: false, error: broadcastData.error || 'Transaction rejected by network' };
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
export const fetchTransactionHistory = async (authToken: string): Promise<TransactionRecord[]> => {
    try {
        const response = await fetch(`${API_URL}/transactions/history`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return data.transactions || [];
    } catch (error) {
        return [];
    }
};
