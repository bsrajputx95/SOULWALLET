import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@/lib/create-context-hook';
import { trpcClient } from '@/lib/trpc';

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
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        // For testing purposes, create a default user if none exists
        const defaultUser: User = {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          isVerified: true,
          walletAddress: 'sol1234...5678',
        };
        await AsyncStorage.setItem('user', JSON.stringify(defaultUser));
        await AsyncStorage.setItem('userId', defaultUser.id);
        setUser(defaultUser);
      }
    } catch (err) {
      setError('Failed to load user data');
      console.error('Failed to load user:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use tRPC client for login
      const result = await trpcClient.auth.login.mutate({ username, password });
      
      const loggedInUser: User = {
        id: result.id,
        username: result.username,
        email: result.email,
        isVerified: true,
        walletAddress: 'sol1234...5678', // This would come from wallet creation
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(loggedInUser));
      await AsyncStorage.setItem('userId', result.id);
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

  const signup = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use tRPC client for signup
      const result = await trpcClient.auth.signup.mutate({ username, email, password });
      
      const newUser: User = {
        id: result.id,
        username: result.username,
        email: result.email,
        isVerified: false,
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      await AsyncStorage.setItem('userId', result.id);
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
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      console.error('Update user error:', err);
      setError('Failed to update user data');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userId');
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
    isAuthenticated: !!user,
  };
});