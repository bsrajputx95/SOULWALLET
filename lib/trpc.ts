import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use 'any' type for the mock AppRouter since we don't have a real tRPC backend
export const trpc = createTRPCReact<any>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  throw new Error(
    "No base url found, please set EXPO_PUBLIC_RORK_API_BASE_URL"
  );
};

// @ts-ignore - Mock tRPC client for development
export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      async headers() {
        const userId = await AsyncStorage.getItem('userId');
        return {
          authorization: 'Bearer mock-token',
          'x-user-id': userId || '',
        };
      },
    }),
  ],
});
