import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
const SESSION_KEYS = [
    'token',
    'user_data',
    'wallet_secret',
    'wallet_pubkey',
    'wallet_pin_hash',
    'cached_pin',
    'cached_pin_expiry',
] as const;

/**
 * Validate user session by checking for auth token
 * Redirects to login if no valid session exists
 * @returns Promise<boolean> - true if session is valid, false otherwise
 */
export const validateSession = async (): Promise<boolean> => {
    try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) {
            router.replace('/(auth)/login');
            return false;
        }
        return true;
    } catch {
        router.replace('/(auth)/login');
        return false;
    }
};

/**
 * Get the current auth token if it exists
 * @returns Promise<string | null> - The auth token or null
 */
export const getAuthToken = async (): Promise<string | null> => {
    try {
        return await SecureStore.getItemAsync('token');
    } catch {
        return null;
    }
};

/**
 * Persist auth session token and user payload.
 */
export const persistAuthSession = async (token: string, user: unknown): Promise<void> => {
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('user_data', JSON.stringify(user ?? null));
};

/**
 * Clear all session data (for logout)
 */
export const clearSession = async (): Promise<void> => {
    const clearTasks = SESSION_KEYS.map((key) => SecureStore.deleteItemAsync(key));
    await Promise.allSettled(clearTasks);
};
