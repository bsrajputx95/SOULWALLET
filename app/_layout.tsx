import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React from "react";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Orbitron_400Regular, Orbitron_500Medium, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { View, StyleSheet, Platform } from "react-native";
import { COLORS } from "../constants/colors";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { performanceMonitor, trackBundleSize } from "../utils/performance";
import { WebPreviewBanner } from "../components/WebPreviewBanner";
import { registerBackgroundTasks } from "../services/backgroundTasks";

// Initialize performance monitoring
if (__DEV__) {
  performanceMonitor.startTiming('app-startup');
  trackBundleSize();
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync();

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
  const [timeoutReady, setTimeoutReady] = useState(false);

  // Load fonts
  const [fontsLoaded] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_700Bold,
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setTimeoutReady(true);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [fontsLoaded]);

  const appIsReady = fontsLoaded || timeoutReady;

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

  // Register background tasks for copy trading
  useEffect(() => {
    if (appIsReady) {
      registerBackgroundTasks();
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Web Preview Banner - shows only on web platform */}
          <WebPreviewBanner />
          <RootLayoutNav />
        </View>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
