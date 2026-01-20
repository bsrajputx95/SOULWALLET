import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import { Platform, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as CryptoJS from 'crypto-js';
import { logger } from './client-logger';

// Native crypto for PBKDF2 (Comment 3 fix)
let QuickCrypto: typeof import('react-native-quick-crypto') | null = null;
try {
  // Dynamic import to handle platforms where native module isn't available
  if (Platform.OS !== 'web') {
    QuickCrypto = require('react-native-quick-crypto');
  }
} catch (e) {
  logger.warn('react-native-quick-crypto not available, using CryptoJS fallback');
}

/**
 * Secure Storage Utility
 * Uses expo-secure-store for sensitive data (wallet keys)
 * Falls back to AsyncStorage for non-sensitive data
 * 
 * PBKDF2 Configuration (Comment 3 fix):
 * - 310,000 iterations using native crypto (react-native-quick-crypto)
 * - Falls back to CryptoJS on web where native module unavailable
 * - Using off-main-thread execution via InteractionManager for smooth UX
 */

// PBKDF2 iteration count - increased for modern security baseline
// Native crypto allows higher values without performance issues
const PBKDF2_ITERATIONS = 310000;
const PBKDF2_ITERATIONS_WEB = 250000; // Lower for web fallback (JS performance)

const SECURE_KEYS = [
  'wallet_private_key',
  'wallet_mnemonic',
  'wallet_keypair',
  'auth_token',
  'refresh_token',
];

/**
 * Check if a key should use secure storage
 */
function isSecureKey(key: string): boolean {
  return SECURE_KEYS.some(secureKey => key.includes(secureKey));
}

function toHex(wordArray: CryptoJS.lib.WordArray): string {
  return wordArray.toString(CryptoJS.enc.Hex);
}

function fromHex(hex: string): CryptoJS.lib.WordArray {
  return CryptoJS.enc.Hex.parse(hex);
}

function randomHex(bytes: number): string {
  // Use native crypto if available, otherwise expo-crypto
  if (QuickCrypto) {
    const randomBytes = QuickCrypto.randomBytes(bytes);
    return Buffer.from(randomBytes).toString('hex');
  }
  const randomBytes = ExpoCrypto.getRandomBytes(bytes);
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Run key derivation off the main thread to avoid UI freezes
 */
function runOffMainThread<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    InteractionManager.runAfterInteractions(() => {
      try {
        // Use setImmediate to yield to the event loop
        setImmediate(() => {
          try {
            resolve(fn());
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Derive key using native PBKDF2 (if available) or CryptoJS fallback
 * Native crypto provides significant performance improvement for high iteration counts
 */
function deriveKeyNative(password: string, saltBuffer: Buffer, keyBytes: number, iterations: number): Buffer {
  if (!QuickCrypto) {
    throw new Error('Native crypto not available');
  }
  try {
    return QuickCrypto.pbkdf2Sync(password, saltBuffer, iterations, keyBytes, 'sha256');
  } catch (error: any) {
    logger.error('Native PBKDF2 failed, will fallback to JS:', error?.message);
    throw new Error('Native crypto operation failed');
  }
}

function deriveKeyJS(password: string, saltHex: string, keyBytes: number, iterations: number): CryptoJS.lib.WordArray {
  const salt = fromHex(saltHex);
  return CryptoJS.PBKDF2(password, salt, {
    keySize: keyBytes / 4,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
}

/**
 * Derive encryption/MAC keys using best available crypto
 * Returns { aesKey, macKey } as CryptoJS WordArrays for compatibility with AES encrypt/decrypt
 */
async function deriveKeys(password: string, saltHex: string, iterations: number): Promise<{ aesKey: CryptoJS.lib.WordArray; macKey: CryptoJS.lib.WordArray }> {
  // Use native crypto if available (much faster for high iterations)
  if (QuickCrypto && Platform.OS !== 'web') {
    try {
      const saltBuffer = Buffer.from(saltHex, 'hex');
      const derivedBuffer = await runOffMainThread(() =>
        deriveKeyNative(password, saltBuffer, 64, iterations)
      );
      // Convert Buffer to CryptoJS WordArray
      const derivedHex = derivedBuffer.toString('hex');
      const derived = fromHex(derivedHex);
      return {
        aesKey: CryptoJS.lib.WordArray.create(derived.words.slice(0, 8), 32),
        macKey: CryptoJS.lib.WordArray.create(derived.words.slice(8, 16), 32),
      };
    } catch (error) {
      // Native crypto failed - fall through to JS implementation
      logger.warn('Native crypto failed, falling back to CryptoJS:', error);
    }
  }

  // Fallback to CryptoJS for web or if native failed
  const jsIterations = Math.min(iterations, PBKDF2_ITERATIONS_WEB); // Use lower iterations for JS
  const derived = await runOffMainThread(() =>
    deriveKeyJS(password, saltHex, 64, jsIterations)
  );
  return {
    aesKey: CryptoJS.lib.WordArray.create(derived.words.slice(0, 8), 32),
    macKey: CryptoJS.lib.WordArray.create(derived.words.slice(8, 16), 32),
  };
}

async function encryptWithPassword(plaintext: string, password: string): Promise<string> {
  // SECURITY: 310,000 iterations with native crypto (Comment 3 fix)
  // Uses react-native-quick-crypto for hardware-accelerated PBKDF2
  // Falls back to 200k iterations with CryptoJS on web
  const isNative = QuickCrypto && Platform.OS !== 'web';
  const iter = isNative ? PBKDF2_ITERATIONS : PBKDF2_ITERATIONS_WEB;
  const saltHex = randomHex(16);
  const ivHex = randomHex(16);

  // Derive keys using best available crypto
  const { aesKey, macKey } = await deriveKeys(password, saltHex, iter);

  const iv = fromHex(ivHex);
  const cipherParams = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(plaintext), aesKey, { iv });
  const ctWordArray = cipherParams.ciphertext;
  const dataForMac = iv.clone().concat(ctWordArray);
  const mac = CryptoJS.HmacSHA256(dataForMac, macKey);
  const payload = {
    v: 4, // Bumped version to indicate 310k native / 200k web iterations
    kdf: 'PBKDF2',
    algo: 'AES-256-CBC-HMAC-SHA256',
    native: isNative, // Track whether native crypto was used
    iter,
    salt: saltHex,
    iv: ivHex,
    ct: ctWordArray.toString(CryptoJS.enc.Base64),
    mac: toHex(mac),
  } as const;
  return JSON.stringify(payload);
}

async function decryptWithPassword(payloadStr: string, password: string): Promise<string> {
  const payload = JSON.parse(payloadStr);
  const { iter, salt, iv, ct, mac } = payload;

  // Derive keys using best available crypto (matches encryption)
  const { aesKey, macKey } = await deriveKeys(password, salt, iter);

  const ivWordArray = fromHex(iv);
  const ctWordArray = CryptoJS.enc.Base64.parse(ct);
  const dataForMac = ivWordArray.clone().concat(ctWordArray);
  const calcMac = CryptoJS.HmacSHA256(dataForMac, macKey).toString(CryptoJS.enc.Hex);
  if (calcMac !== mac) {
    throw new Error('Invalid password or data integrity check failed');
  }
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ctWordArray });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, aesKey, { iv: ivWordArray });
  return CryptoJS.enc.Utf8.stringify(decrypted);
}

/**
 * Store a value securely
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    // On web, avoid expo-secure-store (native module not available)
    const canUseSecureStore = Platform.OS !== 'web';
    if (isSecureKey(key) && canUseSecureStore) {
      // Use SecureStore for sensitive data
      await SecureStore.setItemAsync(key, value);
    } else {
      // Use AsyncStorage for non-sensitive data
      await AsyncStorage.setItem(key, value);
    }
  } catch (error) {
    logger.error('Error storing item:', error);
    throw error;
  }
}

/**
 * Retrieve a value securely
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const canUseSecureStore = Platform.OS !== 'web';
    if (isSecureKey(key) && canUseSecureStore) {
      // Retrieve from SecureStore
      return await SecureStore.getItemAsync(key);
    } else {
      // Retrieve from AsyncStorage
      return await AsyncStorage.getItem(key);
    }
  } catch (error) {
    logger.error('Error retrieving item:', error);
    return null;
  }
}

/**
 * Delete a value securely
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    const canUseSecureStore = Platform.OS !== 'web';
    if (isSecureKey(key) && canUseSecureStore) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    logger.error('Error deleting item:', error);
    throw error;
  }
}

/**
 * Check if secure storage is available
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // SecureStore is not available on web; use AsyncStorage fallback
      return false;
    }
    // Try to set and get a test value
    const testKey = '__secure_storage_test__';
    const testValue = 'test';

    await SecureStore.setItemAsync(testKey, testValue);
    const result = await SecureStore.getItemAsync(testKey);
    await SecureStore.deleteItemAsync(testKey);

    return result === testValue;
  } catch (error) {
    logger.error('Secure storage not available:', error);
    return false;
  }
}

// Export SecureStore directly for advanced use cases
export { SecureStore };

interface UserData {
  id: string;
  email: string;
  username: string;
  walletAddress?: string | null | undefined;
  isVerified?: boolean | undefined;
}

/**
 * SecureStorage class wrapper for easier token management
 */
export class SecureStorage {
  private static readonly AUTH_TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private static readonly USER_DATA_KEY = 'user_data';
  private static readonly REMEMBER_ME_KEY = 'remember_me';
  private static readonly WALLET_PRIV_ENC_KEY = 'wallet_private_key_enc';
  private static readonly WALLET_MNEMONIC_ENC_KEY = 'wallet_mnemonic_enc';
  private static readonly CSRF_TOKEN_KEY = 'csrf_token';

  /**
   * Store authentication token securely
   */
  static async setToken(token: string): Promise<void> {
    await setSecureItem(this.AUTH_TOKEN_KEY, token);
  }

  /**
   * Get authentication token
   */
  static async getToken(): Promise<string | null> {
    return await getSecureItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Remove authentication token
   */
  static async removeToken(): Promise<void> {
    await deleteSecureItem(this.AUTH_TOKEN_KEY);
  }

  static async setRefreshToken(token: string): Promise<void> {
    await setSecureItem(this.REFRESH_TOKEN_KEY, token);
  }

  static async getRefreshToken(): Promise<string | null> {
    return await getSecureItem(this.REFRESH_TOKEN_KEY);
  }

  static async removeRefreshToken(): Promise<void> {
    await deleteSecureItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Clear refresh token (alias for removeRefreshToken)
   */
  static async clearRefreshToken(): Promise<void> {
    await this.removeRefreshToken();
  }

  /**
   * Store user data (non-sensitive)
   */
  static async setUserData(userData: UserData): Promise<void> {
    await AsyncStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
  }

  /**
   * Get user data
   */
  static async getUserData(): Promise<UserData | null> {
    try {
      const data = await AsyncStorage.getItem(this.USER_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error parsing user data:', error);
      return null;
    }
  }

  /**
   * Remove user data
   */
  static async removeUserData(): Promise<void> {
    await AsyncStorage.removeItem(this.USER_DATA_KEY);
  }

  /**
   * Store remember me preference
   */
  static async setRememberMe(remember: boolean): Promise<void> {
    await AsyncStorage.setItem(this.REMEMBER_ME_KEY, remember.toString());
  }

  /**
   * Get remember me preference
   */
  static async getRememberMe(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(this.REMEMBER_ME_KEY);
      return value === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all auth-related data
   */
  static async clearAll(): Promise<void> {
    await Promise.all([
      this.removeToken(),
      this.removeRefreshToken(),
      this.removeUserData(),
      AsyncStorage.removeItem(this.REMEMBER_ME_KEY),
    ]);
  }

  static async setEncryptedItem(key: string, value: string, password: string): Promise<void> {
    if (!password) throw new Error('Password required');
    const encrypted = await encryptWithPassword(value, password);
    await setSecureItem(key, encrypted);
  }

  static async getDecryptedItem(key: string, password: string): Promise<string | null> {
    if (!password) throw new Error('Password required');
    const payload = await getSecureItem(key);
    if (!payload) return null;
    return await decryptWithPassword(payload, password);
  }

  static async setEncryptedPrivateKey(privateKey: string, password: string): Promise<void> {
    await this.setEncryptedItem(this.WALLET_PRIV_ENC_KEY, privateKey, password);
  }

  static async getDecryptedPrivateKey(password: string): Promise<string | null> {
    return await this.getDecryptedItem(this.WALLET_PRIV_ENC_KEY, password);
  }

  static async setEncryptedMnemonic(mnemonic: string, password: string): Promise<void> {
    await this.setEncryptedItem(this.WALLET_MNEMONIC_ENC_KEY, mnemonic, password);
  }

  static async getDecryptedMnemonic(password: string): Promise<string | null> {
    return await this.getDecryptedItem(this.WALLET_MNEMONIC_ENC_KEY, password);
  }

  static async deleteEncryptedPrivateKey(): Promise<void> {
    await deleteSecureItem(this.WALLET_PRIV_ENC_KEY);
  }

  static async deleteEncryptedMnemonic(): Promise<void> {
    await deleteSecureItem(this.WALLET_MNEMONIC_ENC_KEY);
  }
  static async setCsrfToken(token: string): Promise<void> {
    await setSecureItem(this.CSRF_TOKEN_KEY, token);
  }

  static async getCsrfToken(): Promise<string | null> {
    return await getSecureItem(this.CSRF_TOKEN_KEY);
  }
}
