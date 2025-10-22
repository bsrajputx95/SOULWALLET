// Polyfills must be imported first
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';

// Setup Buffer global for Solana
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Orbitron_400Regular, Orbitron_500Medium, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { View, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";
import { trpc, trpcClient } from "../lib/trpc";



// Providers
import { AuthProvider } from "../hooks/auth-store";
import { WalletProvider } from "../hooks/wallet-store";
import { SocialProvider } from "../hooks/social-store";
import { SolanaWalletProvider } from "../hooks/solana-wallet-store";

import { AccountProvider } from "../hooks/account-store";
import { MarketProvider } from "../hooks/market-store";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Validate environment variables at app startup
import { validateEnvironmentOrThrow } from "../lib/validate-env";
if (__DEV__) {
  try {
    validateEnvironmentOrThrow();
  } catch (error) {
    // Log error but continue in development (allows working without backend)
    console.error(error);
  }
}

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
    }
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

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
                      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
                        <View style={styles.container}>
                          <RootLayoutNav />
                        </View>
                      </GestureHandlerRootView>
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