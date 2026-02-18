/**
 * External Platform WebView - Progressive Loading
 * 
 * Displays external DEX platforms in optimized WebView with:
 * - Progressive loading (WebView shown immediately, no full-screen spinner)
 * - Thin animated progress bar at top while loading
 * - Aggressive HTTP caching for faster repeat visits
 * - Desktop mode rendering for more content visibility
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  AppState,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { AlertTriangle, Globe, RefreshCw, WifiOff } from 'lucide-react-native';
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
  desktopMode?: boolean;
}

// Desktop Chrome user agent for desktop mode rendering
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Mobile user agent
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';

export const ExternalPlatformWebView: React.FC<ExternalPlatformWebViewProps> = ({ platform, desktopMode = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useDesktopMode, setUseDesktopMode] = useState(desktopMode);
  const [isOffline, setIsOffline] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  const platformUrl = PLATFORM_URLS[platform] || '';
  const platformName = PLATFORM_NAMES[platform] || platform;

  // Reset states when platform changes
  useEffect(() => {
    setUseDesktopMode(desktopMode);
    setIsOffline(false);
    progressAnim.setValue(0);
  }, [platform, desktopMode]);

  // Monitor network state
  useEffect(() => {
    const unsubscribe = AppState.addEventListener('change', () => {
      if (AppState.currentState === 'active') {
        // WebView will handle reconnection
      }
    });
    return () => unsubscribe.remove();
  }, []);

  // Animate the progress bar
  const animateProgress = useCallback((toValue: number, duration: number) => {
    Animated.timing(progressAnim, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  // Inject JavaScript to control viewport for desktop mode
  const getViewportScript = (isDesktop: boolean) => {
    return `
    (function() {
      function applyDesktopMode() {
        // Remove any existing viewport meta
        const existingViewport = document.querySelector('meta[name=viewport]');
        if (existingViewport) {
          existingViewport.remove();
        }
        
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        
        // Remove any previously injected desktop styles
        const existingStyle = document.getElementById('desktop-mode-style');
        if (existingStyle) existingStyle.remove();
        
        if (${isDesktop}) {
          // Set viewport width to 1280px (desktop width).
          // The WebView's scalesPageToFit will scale it down to fit the screen.
          meta.content = 'width=1280, minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes';
          
          // Only ensure containers don't cap at a mobile max-width
          const desktopStyle = document.createElement('style');
          desktopStyle.id = 'desktop-mode-style';
          desktopStyle.textContent = 
            '#root, #app, #__next, .app, .container { max-width: none !important; }' +
            '* { box-sizing: border-box !important; }';
          document.head.appendChild(desktopStyle);
        } else {
          meta.content = 'width=device-width, initial-scale=1.0, minimum-scale=0.25, maximum-scale=3.0, user-scalable=yes';
        }
        
        document.head.appendChild(meta);
      }
      
      // Apply immediately and re-apply to override any site scripts
      applyDesktopMode();
      setTimeout(applyDesktopMode, 100);
      setTimeout(applyDesktopMode, 500);
      setTimeout(applyDesktopMode, 1500);
      
      // Watch for viewport changes and re-apply
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'content') {
            applyDesktopMode();
          }
        });
      });
      
      const viewportMeta = document.querySelector('meta[name=viewport]');
      if (viewportMeta) {
        observer.observe(viewportMeta, { attributes: true });
      }
      
      true;
    })();
    true;
  `;
  };

  // Apply viewport settings when desktop mode changes or page loads
  useEffect(() => {
    if (webViewRef.current && !loading && !error) {
      webViewRef.current.injectJavaScript(getViewportScript(useDesktopMode));
    }
  }, [loading, error, useDesktopMode]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setIsOffline(false);
    progressAnim.setValue(0);
    webViewRef.current?.reload();
  };

  // Determine user agent based on mode
  const getUserAgent = () => {
    if (useDesktopMode) return DESKTOP_USER_AGENT;
    return MOBILE_USER_AGENT;
  };

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          {isOffline ? <WifiOff size={48} color={COLORS.error} /> : <AlertTriangle size={48} color={COLORS.error} />}
          <Text style={styles.errorTitle}>{isOffline ? 'No Connection' : 'Platform Unavailable'}</Text>
          <Text style={styles.errorText}>{error}</Text>

          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
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

  // Progress bar width interpolation
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Native WebView - Progressive Loading (WebView shown immediately)
  return (
    <View style={styles.container}>
      {/* Thin progress bar at the very top - only visible while loading */}
      {loading && (
        <View style={styles.progressBarContainer}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
      )}

      {/* Connection status indicator */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color={COLORS.error} />
          <Text style={styles.offlineText}>No internet connection</Text>
        </View>
      )}

      {/* WebView - Shown immediately, content streams in progressively */}
      <WebView
        ref={webViewRef}
        source={{
          uri: platformUrl,
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=3600',
          }
        }}
        style={[styles.webView, desktopMode ? styles.webViewDesktopMode : null]}
        onLoadStart={() => {
          setLoading(true);
          // Animate progress to ~85% during load
          animateProgress(85, 8000);
        }}
        onLoadEnd={() => {
          // Quickly animate to 100% and hide
          animateProgress(100, 200);
          setTimeout(() => setLoading(false), 300);
        }}
        onError={(e) => {
          setLoading(false);
          progressAnim.setValue(0);

          const errorDesc = e.nativeEvent.description || '';
          if (errorDesc.includes('network') || errorDesc.includes('Internet')) {
            setIsOffline(true);
            setError('Please check your internet connection and try again.');
          } else {
            setError(errorDesc || 'Failed to load. Please try again.');
          }
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400) {
            setLoading(false);
            progressAnim.setValue(0);
            setError(`Server error (${e.nativeEvent.statusCode}). Please try again later.`);
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        userAgent={getUserAgent()}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        thirdPartyCookiesEnabled={true}
        mixedContentMode="compatibility"
        scalesPageToFit={true}
        setBuiltInZoomControls={true}
        setDisplayZoomControls={false}
        startInLoadingState={false}
        textZoom={100}
        sharedCookiesEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
        injectedJavaScript={getViewportScript(useDesktopMode)}
        onNavigationStateChange={(navState: WebViewNavigation) => {
          if (navState.loading) {
            setLoading(true);
            progressAnim.setValue(0);
            animateProgress(85, 8000);
          } else {
            animateProgress(100, 200);
            setTimeout(() => setLoading(false), 300);
            // Re-apply desktop mode after page fully loads
            if (useDesktopMode && webViewRef.current) {
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(getViewportScript(useDesktopMode));
              }, 500);
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(getViewportScript(useDesktopMode));
              }, 1500);
            }
          }
        }}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
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
    paddingHorizontal: SPACING.m,
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
  // Thin progress bar at the top of the WebView
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.solana,
  },
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '20',
    paddingVertical: SPACING.xs,
    zIndex: 100,
  },
  offlineText: {
    ...FONTS.sfProMedium,
    fontSize: 12,
    color: COLORS.error,
    marginLeft: SPACING.xs,
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webViewDesktopMode: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
  },
});

export default ExternalPlatformWebView;
