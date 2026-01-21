/**
 * External Platform WebView Component
 * 
 * Displays external DEX platforms (DexScreener, Raydium, Bonk, Pump.fun, Orca)
 * in a WebView with wallet connection capability.
 * 
 * Features:
 * - Token-aware routing: Extracts token mint from WebView URL for smart swap navigation
 * - Wallet injection bridge: Exposes SoulWallet object to WebView for wallet interactions
 * - Jupiter fallback: Redirects to native swap when WebView fails
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { RefreshCw, AlertTriangle, Globe } from 'lucide-react-native';
import Constants from 'expo-constants';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

// Check if running in Expo Go (WebView doesn't work in Expo Go)
const isExpoGo = Constants.appOwnership === 'expo';

// Platform URLs
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
  onError?: (error: string) => void;
}

/**
 * WebView component for external DEX platforms
 */
export const ExternalPlatformWebView: React.FC<ExternalPlatformWebViewProps> = ({
  platform,
  onError,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const platformUrl = PLATFORM_URLS[platform] || '';
  const platformName = PLATFORM_NAMES[platform] || platform;

  // Auto-load WebView when component mounts (helps with perceived speed)
  React.useEffect(() => {
    // Reset loading state when platform changes
    setLoading(true);
    setError(null);
    setHasLoaded(false);
  }, [platform]);

  // Handle WebView navigation state changes
  const handleNavigationStateChange = useCallback((_navState: WebViewNavigation) => {
    // Simple navigation tracking (no token detection)
  }, []);

  // When load finishes, mark as loaded to prevent flicker on re-visits
  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    setHasLoaded(true);
  }, []);

  const handleRefresh = useCallback(() => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Platform Unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>

          {/* Retry button */}
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <RefreshCw size={16} color={COLORS.textPrimary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Web platform - use iframe
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.iframeContainer}>
          <iframe
            src={platformUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={platformName}
          />
        </View>
      </View>
    );
  }

  // Expo Go fallback - WebView doesn't work in Expo Go
  if (isExpoGo) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholderContainer}>
          {/* Platform Icon */}
          <View style={styles.platformIcon}>
            <Globe size={40} color={COLORS.solana} />
          </View>

          {/* Platform Name */}
          <Text style={styles.platformTitle}>{platformName}</Text>

          {/* Description */}
          <Text style={styles.description}>
            Trade tokens directly on {platformName}
          </Text>

          {/* Info Text */}
          <Text style={styles.infoText}>
            In-app browsing requires a development build
          </Text>

          {/* Dev Build Note */}
          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>
              💡 In-app browsing requires a development build:
            </Text>
            <Text style={styles.codeText}>
              npx expo run:android
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Native mobile - use WebView
  return (
    <View style={styles.container}>
      {/* Header with refresh action */}
      <View style={styles.webHeader}>
        <Text style={styles.platformTitle}>{platformName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleRefresh}>
            <RefreshCw size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.solana} />
          <Text style={styles.loadingText}>Loading {platformName}...</Text>
        </View>
      )}

      {/* WebView */}
      <WebView
        key={platform} // Force re-mount on platform change for clean state
        ref={webViewRef}
        source={{ uri: platformUrl }}
        style={[styles.webView, { opacity: hasLoaded ? 1 : 0.99 }]} // Slight opacity change forces render
        onLoadStart={() => setLoading(true)}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavigationStateChange}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(nativeEvent.description || 'Failed to load page');
          onError?.(nativeEvent.description || 'Failed to load page');
        }}
        onHttpError={(syntheticEvent) => {
          // Handle HTTP errors (4xx, 5xx)
          const { nativeEvent } = syntheticEvent;
          if (nativeEvent.statusCode >= 400) {
            console.warn(`HTTP ${nativeEvent.statusCode} loading ${platformName}`);
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false} // We handle our own loading state
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        // Caching for faster subsequent loads
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        incognito={false}
        // Additional performance settings
        allowsBackForwardNavigationGestures={true}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  platformIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.solana + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  platformIconText: {
    ...FONTS.orbitronBold,
    fontSize: 32,
    color: COLORS.solana,
  },
  platformTitle: {
    ...FONTS.orbitronBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 0,
  },
  description: {
    ...FONTS.sfProRegular,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.l,
  },
  walletStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.l,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.s,
  },
  statusText: {
    ...FONTS.sfProMedium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  openButton: {
    width: '100%',
    maxWidth: 280,
    marginBottom: SPACING.m,
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.s,
    marginBottom: SPACING.m,
  },
  copyLinkText: {
    ...FONTS.sfProRegular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  infoText: {
    ...FONTS.sfProRegular,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.l,
  },
  noteContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    width: '100%',
    maxWidth: 320,
  },
  noteText: {
    ...FONTS.sfProRegular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  codeText: {
    ...FONTS.monospace,
    fontSize: 11,
    color: COLORS.solana,
    backgroundColor: COLORS.background,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    overflow: 'hidden',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
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
    marginBottom: SPACING.m,
  },
  retryText: {
    ...FONTS.sfProMedium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: SPACING.xs,
  },
  // Jupiter fallback styles (Comment 4)
  jupiterFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.s,
    gap: SPACING.s,
  },
  jupiterFallbackText: {
    ...FONTS.sfProMedium,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  fallbackHint: {
    ...FONTS.sfProRegular,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  // WebView specific styles
  webHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
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
  externalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
  },
  externalText: {
    ...FONTS.sfProMedium,
    fontSize: 12,
    color: COLORS.solana,
    marginLeft: SPACING.xs,
  },
  iframeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Floating "Trade in App" button
  floatingTradeButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    gap: SPACING.xs,
  },
  floatingTradeText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  // Token detected badge
  tokenDetectedBadge: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.solana,
  },
  tokenDetectedText: {
    ...FONTS.sfProMedium,
    fontSize: 10,
    color: COLORS.solana,
  },
});

export default ExternalPlatformWebView;
