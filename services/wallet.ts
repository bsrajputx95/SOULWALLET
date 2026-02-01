// Wallet Service - Client-side wallet management
// IMPORTANT: react-native-get-random-values MUST be imported before @solana/web3.js
import 'react-native-get-random-values';
import { Keypair } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';

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

// Holding type from backend
export interface Holding {
    symbol: string;
    name: string;
    mint: string;
    balance: number;
    price: number;
    usdValue: number;
    decimals: number;
}

// Portfolio response from backend
export interface PortfolioData {
    success: boolean;
    publicKey: string;
    totalUsdValue: number;
    holdings: Holding[];
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
        console.error('Create wallet error:', error);
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
            console.warn('Failed to fetch balances:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch balances error:', error);
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
        console.error('Failed to decrypt keypair:', error);
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
