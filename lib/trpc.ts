import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import superjson from 'superjson';
import { SecureStorage } from './secure-storage';
import Constants from 'expo-constants';
import type { AppRouter } from '../src/server/types';
import { isAuthHydrated } from './auth-hydration';


export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = (): string => {
  // Use Railway backend for Expo Go testing (localhost doesn't work from phone)
  if (__DEV__) {
    return 'https://soulwallet-production.up.railway.app';
  }

  // In production, use environment variable
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (apiUrl) {
    return apiUrl;
  }

  // Fallback: Log error but return empty string
  // This allows the app to render and show a proper error message
  // API calls will fail gracefully instead of crashing the app
  console.error(
    '🚨 EXPO_PUBLIC_API_URL is not configured!\n' +
    'API calls will fail. Please set this environment variable.'
  );

  return '';
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      // CRITICAL: In tRPC v11, transformer MUST be passed to httpLink, not createClient
      transformer: superjson,
      url: `${getBaseUrl()}/api/v1/trpc`,
      headers: async () => {
        const token = await SecureStorage.getToken();
        const headers: Record<string, string> = {};
        if (token) headers.authorization = `Bearer ${token}`;

        // Get app version
        const appVersion = (Constants as any)?.expoConfig?.version || (Constants as any)?.manifest?.version || '1.0.0';

        // CRITICAL: Mobile apps MUST send x-mobile-app-version header
        // Backend requires this to allow mobile app requests (bypasses origin validation)
        // Without this header, the backend will reject with "Null origin not allowed" 403 error
        headers['x-mobile-app-version'] = String(appVersion);

        // CSRF protection disabled for beta (mobile apps don't need CSRF)
        // Web-only protection - mobile apps use authorization tokens

        return headers;
      },
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await fetch(input, init);
        if (res.status !== 401) return res;

        // Don't attempt refresh if auth hydration is still in progress
        if (!isAuthHydrated()) {
          return res;
        }

        const refreshToken = await SecureStorage.getRefreshToken();
        if (!refreshToken) return res;

        const refreshClient = trpc.createClient({
          links: [
            httpLink({
              url: `${getBaseUrl()}/api/v1/trpc`,
              transformer: superjson,
            } as any),
          ],
        });

        try {
          const refreshed = await refreshClient.auth.refreshToken.mutate({ refreshToken });
          await SecureStorage.setToken(refreshed.accessToken);
          await SecureStorage.setRefreshToken(refreshed.refreshToken);

          const headers = new Headers(init?.headers || {});
          headers.set('authorization', `Bearer ${refreshed.accessToken}`);
          return await fetch(input, { ...init, headers });
        } catch (refreshError: any) {
          // Only clear auth if refresh explicitly fails with invalid/expired token
          const errorMessage = refreshError?.message?.toLowerCase() || '';
          const isInvalidToken = errorMessage.includes('invalid') ||
            errorMessage.includes('expired') ||
            errorMessage.includes('unauthorized');
          if (isInvalidToken) {
            await SecureStorage.clearAll();
          }
          return res;
        }
      }) as any,
    } as any),
  ],
});
