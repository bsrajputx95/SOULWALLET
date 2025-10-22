import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Secure Storage Utility
 * Uses expo-secure-store for sensitive data (wallet keys)
 * Falls back to AsyncStorage for non-sensitive data
 */

const SECURE_KEYS = [
  'wallet_private_key',
  'wallet_mnemonic',
  'wallet_keypair',
];

/**
 * Check if a key should use secure storage
 */
function isSecureKey(key: string): boolean {
  return SECURE_KEYS.some(secureKey => key.includes(secureKey));
}

/**
 * Store a value securely
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (isSecureKey(key)) {
      // Use SecureStore for sensitive data
      await SecureStore.setItemAsync(key, value);
      if (__DEV__) {
        console.log(`✅ Stored securely: ${key}`);
      }
    } else {
      // Use AsyncStorage for non-sensitive data
      await AsyncStorage.setItem(key, value);
    }
  } catch (error) {
    console.error('Error storing item:', error);
    throw error;
  }
}

/**
 * Retrieve a value securely
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (isSecureKey(key)) {
      // Retrieve from SecureStore
      return await SecureStore.getItemAsync(key);
    } else {
      // Retrieve from AsyncStorage
      return await AsyncStorage.getItem(key);
    }
  } catch (error) {
    console.error('Error retrieving item:', error);
    return null;
  }
}

/**
 * Delete a value securely
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (isSecureKey(key)) {
      await SecureStore.deleteItemAsync(key);
      if (__DEV__) {
        console.log(`🗑️ Deleted securely: ${key}`);
      }
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
}

/**
 * Check if secure storage is available
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    // Try to set and get a test value
    const testKey = '__secure_storage_test__';
    const testValue = 'test';
    
    await SecureStore.setItemAsync(testKey, testValue);
    const result = await SecureStore.getItemAsync(testKey);
    await SecureStore.deleteItemAsync(testKey);
    
    return result === testValue;
  } catch (error) {
    console.error('Secure storage not available:', error);
    return false;
  }
}

// Export SecureStore directly for advanced use cases
export { SecureStore };
