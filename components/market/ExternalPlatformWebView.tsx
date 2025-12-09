/**
 * External Platform WebView Component
 * 
 * Displays external DEX platforms (Raydium, Pump.fun, BullX, DexScreener)
 * in a WebView with wallet connection capability.
 * 
 * Note: Requires react-native-webview to be installed:
 * npx expo install react-native-webview
 */

import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useSolanaWallet } from '../../hooks/solana-wallet-store';
import { NeonButton } from '../NeonButton';

// Platform URLs
const PLATFORM_URLS: Record<string, string> = {
  raydium: 'https://raydium.io/swap/',
  pumpfun: 'https://pump.fun/',
  bullx: 'https://bullx.io/',
  dexscreener: 'https://dexscreener.com/solana',
};

const PLATFORM_NAMES: Record<string, string> = {
  raydium: 'Raydium',
  pumpfun: 'Pump.fun',
  bullx: 'BullX',
  dexscreener: 'DexScreener',
};

interface ExternalPlatformWebViewProps {
  platform: 'raydium' | 'pumpfun' | 'bullx' | 'dexscreener';
  onError?: (error: string) => void;
}

/**
 * WebView component for external DEX platforms
 * 
 * Currently shows a placeholder with option to open in browser.
 * Full WebView implementation requires react-native-webview package.
 */
export const ExternalPlatformWebView: React.FC<ExternalPlatformWebViewProps> = ({
  platform,
  onError,
}) => {
  const { publicKey } = useSolanaWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformUrl = PLATFORM_URLS[platform] || '';
  const platformName = PLATFORM_NAMES[platform] || platform;

  const handleOpenInBrowser = useCallback(async () => {
    if (!platformUrl) {
      setError('Platform URL not configured');
      return;
    }
    
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [platformUrl, platformName, onError]);

  const handleRetry = useCallback(() => {
    setError(null);
    handleOpenInBrowser();
  }, [handleOpenInBrowser]);

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <RefreshCw size={16} color={COLORS.textPrimary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.placeholderContainer}>
        {/* Platform Icon/Logo */}
        <View style={styles.platformIcon}>
          <Text style={styles.platformIconText}>
            {platformName.charAt(0)}
          </Text>
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
          title={loading ? 'Opening...' : `Open ${platformName}`}
          onPress={handleOpenInBrowser}
          disabled={loading}
          style={styles.openButton}
        />

        {/* Alternative: Copy URL */}
        <TouchableOpacity 
          style={styles.copyLinkButton}
          onPress={() => {
            // In a real app, use Clipboard API
            if (__DEV__) console.log('Copy URL:', platformUrl);
          }}
        >
          <ExternalLink size={14} color={COLORS.textSecondary} />
          <Text style={styles.copyLinkText}>{platformUrl}</Text>
        </TouchableOpacity>

        {/* Info Text */}
        <Text style={styles.infoText}>
          {Platform.OS === 'web' 
            ? 'Click to open in a new tab'
            : 'Opens in your default browser'
          }
        </Text>

        {/* WebView Note */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            💡 For in-app trading, install react-native-webview:
          </Text>
          <Text style={styles.codeText}>
            npx expo install react-native-webview
          </Text>
        </View>
      </View>
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
});

export default ExternalPlatformWebView;
