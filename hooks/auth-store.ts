import { useState, useEffect } from 'react';
import createContextHook from '../lib/create-context-hook';
import { trpcClient } from '../lib/trpc';
import { SecureStorage } from '../lib/secure-storage';
import { logger } from '../lib/client-logger';
import { setUser as setSentryUser, clearUser as clearSentryUser, captureException, addBreadcrumb } from '../lib/sentry';

export interface User {
  id: string;
  username: string;
  email: string;
  profileImage?: string | undefined;
  walletAddress?: string | undefined;
  isVerified: boolean;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | undefined;
  dateOfBirth?: string | undefined;
  defaultCurrency?: string | undefined;
  language?: string | undefined;
  twoFactorEnabled?: boolean | undefined;
  walletData?: {
    publicKey: string;
    privateKey: string;
    mnemonic: string;
  } | undefined;
}

// Track hydration state globally so trpc can check it
let authHydrationComplete = false;
export const isAuthHydrated = () => authHydrationComplete;

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true - hydration in progress
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await SecureStorage.getToken();
      const storedUser = await SecureStorage.getUserData();

      if (token && storedUser) {
        // Convert stored user data to User type with defaults
        const restoredUser: User = {
          ...storedUser,
          isVerified: storedUser.isVerified ?? false,
          walletAddress: storedUser.walletAddress ?? undefined,
        };
        setUser(restoredUser);
        // Set Sentry user context for restored session
        setSentryUser({ id: restoredUser.id, username: restoredUser.username, email: restoredUser.email });
        addBreadcrumb('Session restored', { userId: restoredUser.id });
      }
      // Don't clear auth data during hydration - only clear on explicit logout or refresh failure
    } catch (err) {
      setError('Failed to load user data');
      logger.error('Failed to load user:', err);
      captureException(err instanceof Error ? err : new Error('Failed to load user'), { context: 'loadUser' });
    } finally {
      // Mark hydration complete and stop loading
      authHydrationComplete = true;
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string, rememberMe: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      addBreadcrumb('Login attempt', { identifier: identifier.includes('@') ? 'email' : 'username' });

      // Use tRPC client for login
      const result = await trpcClient.auth.login.mutate({ identifier, password });

      const loggedInUser: User = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        isVerified: result.user.isVerified ?? false,
        walletAddress: result.user.walletAddress ?? undefined,
      };

      // Store tokens securely and user data
      // Always store access token for current session
      await SecureStorage.setToken(result.token);

      // Always store refresh token so user stays logged in
      // The rememberMe flag now only affects session duration preference
      if (result.refreshToken) {
        await SecureStorage.setRefreshToken(result.refreshToken);
      }

      await SecureStorage.setUserData(loggedInUser);
      await SecureStorage.setRememberMe(rememberMe);

      setUser(loggedInUser);

      // Set Sentry user context
      setSentryUser({ id: loggedInUser.id, username: loggedInUser.username, email: loggedInUser.email });
      addBreadcrumb('Login successful', { userId: loggedInUser.id });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      // Only log minimal info in DEV, don't show full stack traces
      if (__DEV__) {
        console.log('[Login] Failed:', errorMessage);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, email: string, password: string, confirmPassword: string) => {
    try {
      setIsLoading(true);
      setError(null);
      addBreadcrumb('Signup attempt', { username });

      // Use tRPC client for signup
      const result = await trpcClient.auth.signup.mutate({ username, email, password, confirmPassword });

      const newUser: User = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        isVerified: result.user.isVerified ?? false,
        walletAddress: result.user.walletAddress ?? undefined,
      };

      // Store tokens securely and user data
      await SecureStorage.setToken(result.token);
      if (result.refreshToken) {
        await SecureStorage.setRefreshToken(result.refreshToken);
      }
      await SecureStorage.setUserData(newUser);

      setUser(newUser);

      // Set Sentry user context
      setSentryUser({ id: newUser.id, username: newUser.username, email: newUser.email });
      addBreadcrumb('Signup successful', { userId: newUser.id });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMessage);
      logger.error('Signup error:', err);
      captureException(err instanceof Error ? err : new Error(errorMessage), { context: 'signup' });
      // THROW the error so signup screen can catch and display it
      throw new Error(errorMessage);
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
      logger.error('Update user error:', err);
      setError('Failed to update user data');
    }
  };

  const logout = async () => {
    try {
      addBreadcrumb('Logout initiated', { userId: user?.id });
      // Clear Sentry user context before logout
      clearSentryUser();

      // Attempt server logout (non-blocking - local clear happens regardless)
      try {
        await trpcClient.auth.logout.mutate();
      } catch (serverErr) {
        // Log warning but continue with local cleanup
        logger.warn('Server logout failed, clearing local session only:', serverErr);
      }

      await SecureStorage.clearAll();
      setUser(null);
      addBreadcrumb('Logout completed');
    } catch (err) {
      logger.error('Logout error:', err);
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
    isAuthenticated: !!user
  };
});
