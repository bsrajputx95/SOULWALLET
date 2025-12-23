/**
 * External Platform WebView Component
 * 
 * Displays external DEX platforms (DexScreener, Raydium, Bonk, Pump.fun, Orca)
 * in a WebView with wallet connection capability.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ExternalLink, RefreshCw, AlertTriangle, Globe } from 'lucide-react-native';
import Constants from 'expo-constants';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useSolanaWallet } from '../../hooks/solana-wallet-store';
import { NeonButton } from '../NeonButton';

// Check if running in Expo Go (WebView doesn't work in Expo Go)
const isExpoGo = Constants.appOwnership === 'expo';

// Platform URLs
const PLATFORM_URLS: Record<string, string> = {
  dexscreener: 'https://dexscreener.com/solana',
  raydium: 'https://raydium.io/swap/',
  bonk: 'https://bonkbot.io/',
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
  const { publicKey } = useSolanaWallet();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  const platformUrl = PLATFORM_URLS[platform] || '';
  const platformName = PLATFORM_NAMES[platform] || platform;

  const handleOpenInBrowser = useCallback(async () => {
    if (!platformUrl) {
      setError('Platform URL not configured');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(platformUrl);

      if (supported) {
        await Linking.openURL(platformUrl);
      } else {
        setError(`Cannot open ${platformName}`);
        onError?.(`Cannot open ${platformName}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open link';
      setError(message);
      onError?.(message);
    }
  }, [platformUrl, platformName, onError]);

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
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <RefreshCw size={16} color={COLORS.textPrimary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Web platform - use iframe or open in browser
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webHeader}>
          <View style={styles.walletStatus}>
            <View style={[
              styles.statusDot,
              { backgroundColor: publicKey ? COLORS.success : COLORS.warning }
            ]} />
            <Text style={styles.statusText}>
              {publicKey
                ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
                : 'Not connected'
              }
            </Text>
          </View>
          <TouchableOpacity style={styles.externalButton} onPress={handleOpenInBrowser}>
            <ExternalLink size={16} color={COLORS.solana} />
            <Text style={styles.externalText}>Open</Text>
          </TouchableOpacity>
        </View>
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

          {/* Wallet Status */}
          <View style={styles.walletStatus}>
            <View style={[
              styles.statusDot,
              { backgroundColor: publicKey ? COLORS.success : COLORS.warning }
            ]} />
            <Text style={styles.statusText}>
              {publicKey
                ? `Wallet: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
                : 'Wallet not connected'
              }
            </Text>
          </View>

          {/* Open in Browser Button */}
          <NeonButton
            title={`Open ${platformName}`}
            onPress={handleOpenInBrowser}
            style={styles.openButton}
          />

          {/* Info Text */}
          <Text style={styles.infoText}>
            Opens in your default browser
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
      {/* Header with wallet status and actions */}
      <View style={styles.webHeader}>
        <View style={styles.walletStatus}>
          <View style={[
            styles.statusDot,
            { backgroundColor: publicKey ? COLORS.success : COLORS.warning }
          ]} />
          <Text style={styles.statusText}>
            {publicKey
              ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
              : 'Not connected'
            }
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleRefresh}>
            <RefreshCw size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenInBrowser}>
            <ExternalLink size={18} color={COLORS.textSecondary} />
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
        ref={webViewRef}
        source={{ uri: platformUrl }}
        style={styles.webView}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(nativeEvent.description || 'Failed to load page');
          onError?.(nativeEvent.description || 'Failed to load page');
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
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
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
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
  },
  retryText: {
    ...FONTS.sfProMedium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: SPACING.xs,
  },
  // WebView specific styles
  webHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
});

export default ExternalPlatformWebView;
