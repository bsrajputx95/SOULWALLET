import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export async function validateSession(): Promise<boolean> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) {
    router.replace('/(auth)/login');
    return false;
  }
  return true;
}

export async function clearSession(onClear?: () => void): Promise<void> {
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('user_data');
  await SecureStore.deleteItemAsync('wallet_secret');
  await SecureStore.deleteItemAsync('wallet_pubkey');
  await SecureStore.deleteItemAsync('wallet_pin_hash');
  await SecureStore.deleteItemAsync('cached_pin');
  await SecureStore.deleteItemAsync('cached_pin_expiry');
  
  // Invoke callback to clear in-memory auth state
  if (onClear) {
    onClear();
  }
}
