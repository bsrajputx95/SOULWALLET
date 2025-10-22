import { getSecureItem, setSecureItem, deleteSecureItem } from '../secure-storage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the modules (mocks are set up in jest.setup.js)

describe('SecureStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setSecureItem', () => {
    it('should use SecureStore for sensitive keys', async () => {
      await setSecureItem('wallet_private_key', 'test-key');
      
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('wallet_private_key', 'test-key');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should use AsyncStorage for non-sensitive keys', async () => {
      await setSecureItem('user_name', 'john_doe');
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user_name', 'john_doe');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
      
      await expect(setSecureItem('wallet_private_key', 'test')).rejects.toThrow('Storage error');
    });
  });

  describe('getSecureItem', () => {
    it('should use SecureStore for sensitive keys', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-key');
      
      const result = await getSecureItem('wallet_mnemonic');
      
      expect(result).toBe('test-key');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('wallet_mnemonic');
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('should use AsyncStorage for non-sensitive keys', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('john_doe');
      
      const result = await getSecureItem('user_name');
      
      expect(result).toBe('john_doe');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('user_name');
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('should return null for non-existent keys', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      const result = await getSecureItem('non_existent');
      
      expect(result).toBeNull();
    });
  });

  describe('deleteSecureItem', () => {
    it('should use SecureStore for sensitive keys', async () => {
      await deleteSecureItem('wallet_keypair');
      
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wallet_keypair');
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should use AsyncStorage for non-sensitive keys', async () => {
      await deleteSecureItem('user_preferences');
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user_preferences');
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('key detection', () => {
    it('should correctly identify wallet private key as sensitive', async () => {
      await setSecureItem('wallet_private_key', 'key');
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should correctly identify wallet mnemonic as sensitive', async () => {
      await setSecureItem('wallet_mnemonic', 'mnemonic');
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should correctly identify wallet keypair as sensitive', async () => {
      await setSecureItem('wallet_keypair', 'keypair');
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });
  });
});
