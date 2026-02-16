/**
 * External Platform WebView - Lightweight & Fast
 * 
 * Displays external DEX platforms in optimized WebView
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { AlertTriangle, Globe, RefreshCw } from 'lucide-react-native';
import Constants from 'expo-constants';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const isExpoGo = Constants.appOwnership === 'expo';

const PLATFORM_URLS: Record<string, string> = {
  dexscreener: 'https://dexscreener.com/solana',
  raydium: 'https://raydium.io/swap/',
  bonk: 'https://bonk.fun/',
  pumpfun: 'https://pump.fun/',
  orca: 'https://www.orca.so/',
};

const PLATFORM_NAMES: Record<string, string> = {
  dexscreener: 'DexScreener',
  raydium: 'Raydium',
  bonk: 'Bonk',
  pumpfun: 'Pump.fun',
  orca: 'Orca',
};

interface ExternalPlatformWebViewProps {
  platform: 'dexscreener' | 'raydium' | 'bonk' | 'pumpfun' | 'orca';
  fullScreen?: boolean;
}

export const ExternalPlatformWebView: React.FC<ExternalPlatformWebViewProps> = ({ platform, fullScreen = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const platformUrl = PLATFORM_URLS[platform] || '';
  const platformName = PLATFORM_NAMES[platform] || platform;

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <AlertTriangle size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Platform Unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setError(null); setLoading(true); }}>
            <RefreshCw size={16} color={COLORS.textPrimary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Expo Go fallback
  if (isExpoGo) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.iconCircle}>
            <Globe size={40} color={COLORS.solana} />
          </View>
          <Text style={styles.platformTitle}>{platformName}</Text>
          <Text style={styles.description}>Trade tokens directly on {platformName}</Text>
          <View style={styles.devBuildNote}>
            <Text style={styles.noteText}>💡 Requires development build:</Text>
            <Text style={styles.codeText}>npx expo run:android</Text>
          </View>
        </View>
      </View>
    );
  }

  // Native WebView - Optimized
  return (
    <View style={styles.container}>
      {/* Loading - simplified without platform name */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.solana} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* WebView - Performance Optimized */}
      <WebView
        source={{ uri: platformUrl }}
        style={[styles.webView, fullScreen && styles.webViewFullScreen]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => setError(e.nativeEvent.description || 'Failed to load')}
        // Core functionality
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Caching - KEY FOR SPEED
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        // Use modern browser engine
        userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
        // Performance tweaks
        bounces={false}
        overScrollMode="never"
        // Security - prevent popups
        setSupportMultipleWindows={false}
        // Third party cookies (some DEXs need this)
        thirdPartyCookiesEnabled={true}
        // Mixed content for older sites
        mixedContentMode="compatibility"
        // Full-screen zoom settings
        scalesPageToFit={fullScreen}
        setBuiltInZoomControls={fullScreen}
        setDisplayZoomControls={fullScreen}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.solana + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  platformTitle: {
    ...FONTS.orbitronBold,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  description: {
    ...FONTS.sfProRegular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.l,
  },
  devBuildNote: {
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    width: '100%',
    maxWidth: 300,
  },
  noteText: {
    ...FONTS.sfProRegular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  codeText: {
    ...FONTS.monospace,
    fontSize: 12,
    color: COLORS.solana,
  },
  errorTitle: {
    ...FONTS.orbitronBold,
    fontSize: 18,
    color: COLORS.error,
    marginTop: SPACING.m,
    marginBottom: SPACING.s,
  },
  errorText: {
    ...FONTS.sfProRegular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.l,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
  },
  retryText: {
    ...FONTS.sfProMedium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: SPACING.xs,
  },

  loadingOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  loadingText: {
    ...FONTS.sfProMedium,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.m,
  },
  webView: {
    flex: 1,
  },
  webViewFullScreen: {
    // Full-screen WebView takes entire space
    backgroundColor: COLORS.background,
  },
});

export default ExternalPlatformWebView;
