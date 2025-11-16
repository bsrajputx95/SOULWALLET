import { useState, useEffect } from 'react';
import createContextHook from '../lib/create-context-hook';
import { trpcClient } from '../lib/trpc';
import { SecureStorage } from '../lib/secure-storage';

export interface User {
  id: string;
  username: string;
  email: string;
  profileImage?: string;
  walletAddress?: string;
  isVerified: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  defaultCurrency?: string;
  language?: string;
  twoFactorEnabled?: boolean;
  walletData?: {
    publicKey: string;
    privateKey: string;
    mnemonic: string;
  };
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStorage.getToken();
      const storedUser = await SecureStorage.getUserData();
      
      if (token && storedUser) {
        setUser(storedUser);
      } else {
        // Clear any partial data if token or user is missing
        await SecureStorage.clearAll();
      }
    } catch (err) {
      setError('Failed to load user data');
      console.error('Failed to load user:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string, rememberMe: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use tRPC client for login
      const result = await trpcClient.auth.login.mutate({ identifier, password });
      
      const loggedInUser: User = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        isVerified: result.user.isVerified ?? false,
        walletAddress: result.user.walletAddress,
      };
      
      // Store tokens securely and user data
      await SecureStorage.setToken(result.token);
      if (result.refreshToken) {
        await SecureStorage.setRefreshToken(result.refreshToken);
      }
      await SecureStorage.setUserData(loggedInUser);
      await SecureStorage.setRememberMe(rememberMe);
      
      setUser(loggedInUser);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      console.error('Login error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, email: string, password: string, confirmPassword: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use tRPC client for signup
      const result = await trpcClient.auth.signup.mutate({ username, email, password, confirmPassword });
      
      const newUser: User = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        isVerified: result.user.isVerified ?? false,
        walletAddress: result.user.walletAddress,
      };
      
      // Store tokens securely and user data
      await SecureStorage.setToken(result.token);
      if (result.refreshToken) {
        await SecureStorage.setRefreshToken(result.refreshToken);
      }
      await SecureStorage.setUserData(newUser);
      
      setUser(newUser);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMessage);
      console.error('Signup error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    try {
      if (!user) return;
      
      const updatedUser = { ...user, ...updates };
      await SecureStorage.setUserData(updatedUser);
      setUser(updatedUser);
    } catch (err) {
      console.error('Update user error:', err);
      setError('Failed to update user data');
    }
  };

  const logout = async () => {
    try {
      try {
        await trpcClient.auth.logout.mutate();
      } catch {}
      await SecureStorage.clearAll();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return {
    user,
    isLoading,
    error,
    login,
    signup,
    updateUser,
    logout,
    isAuthenticated: !!user };
});