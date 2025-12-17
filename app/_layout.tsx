// Polyfills must be imported first
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React from "react";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Orbitron_400Regular, Orbitron_500Medium, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { View, StyleSheet, Platform } from "react-native";
import { COLORS } from "../constants/colors";
import { trpc, trpcClient } from "../lib/trpc";

// Providers
import { AuthProvider } from "../hooks/auth-store";
import { WalletProvider } from "../hooks/wallet-store";
import { SocialProvider } from "../hooks/social-store";
import { SolanaWalletProvider } from "../hooks/solana-wallet-store";
import { AccountProvider } from "../hooks/account-store";
import { MarketProvider } from "../hooks/market-store";
import { NotificationBadgeProvider } from "../hooks/notification-provider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { performanceMonitor, trackBundleSize } from "../utils/performance";

// Validate environment variables at app startup
import { validateEnvironmentOrThrow } from "../lib/validate-env";

// Setup Buffer global for Solana (guarded)
if (typeof global !== 'undefined' && !(global as any).Buffer) {
  (global as any).Buffer = Buffer;
}
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

// Initialize performance monitoring
if (__DEV__) {
  performanceMonitor.startTiming('app-startup');
  trackBundleSize();
}
// TEMPORARILY DISABLED: Environment validation causing splash screen freeze
// Will re-enable after fixing .env configuration
// if (__DEV__) {
//   try {
//     validateEnvironmentOrThrow();
//   } catch (error) {
//     // Log error but continue in development (allows working without backend)
//     console.error(error);
//   }
// }

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.background },
      animation: 'fade',
    }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile/self" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="solana-setup" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  // Load fonts
  const [fontsLoaded] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      setAppIsReady(true);
    } else {
      // Proceed after 2 seconds if fonts fail to load
      const timeout = setTimeout(() => {
        console.warn('Font loading timeout - proceeding without custom fonts');
        setAppIsReady(true);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [fontsLoaded]);

  // Hide splash screen when app is ready
  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync()
        .then(() => {
          if (__DEV__) {
            performanceMonitor.endTiming('app-startup');
            performanceMonitor.logSummary();
          }
        })
        .catch((error) => {
          console.error('Failed to hide splash screen:', error);
        });
    }
  }, [appIsReady]);

  // Hide browser scrollbar globally (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.id = 'hide-scrollbar-style';
    style.innerHTML = `
      html, body { scrollbar-width: none; }
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    `;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById('hide-scrollbar-style');
      if (existing) existing.remove();
    };
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      {/* @ts-ignore - Mock tRPC setup for development */}
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WalletProvider>
              <SolanaWalletProvider>
                <SocialProvider>
                  <AccountProvider>
                    <MarketProvider>
                      <NotificationBadgeProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                          <View style={styles.container}>
                            <RootLayoutNav />
                          </View>
                        </GestureHandlerRootView>
                      </NotificationBadgeProvider>
                    </MarketProvider>
                  </AccountProvider>
                </SocialProvider>
              </SolanaWalletProvider>
            </WalletProvider>
          </AuthProvider>
        </QueryClientProvider>
        {/* @ts-ignore */}
      </trpc.Provider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});