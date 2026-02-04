import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

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
 * Clear all session data (for logout)
 */
export const clearSession = async (): Promise<void> => {
    try {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('user_data');
    } catch {
        // Silent fail
    }
};
