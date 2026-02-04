import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';
import { setAuthLogout } from '../services/api';

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  token: null, 
  isLoading: true,
  setToken: () => {},
  refresh: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const t = await SecureStore.getItemAsync('token');
      setTokenState(t);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken);
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('wallet_secret');
    await SecureStore.deleteItemAsync('wallet_pubkey');
    await SecureStore.deleteItemAsync('wallet_pin_hash');
    await SecureStore.deleteItemAsync('cached_pin');
    await SecureStore.deleteItemAsync('cached_pin_expiry');
    setTokenState(null);
    setIsLoading(false);
  }, []);

  // Register logout function with API client for 401 handling
  useEffect(() => {
    setAuthLogout(logout);
  }, [logout]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen to AppState changes to re-read SecureStore when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Re-read token from SecureStore when app becomes active
        void refresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ token, isLoading, setToken, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
