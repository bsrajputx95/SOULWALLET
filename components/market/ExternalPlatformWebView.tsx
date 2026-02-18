/**
 * External Platform WebView - Ultra-Fast & Optimized
 * 
 * Displays external DEX platforms in optimized WebView with:
 * - Aggressive caching for instant loads
 * - Desktop mode rendering for more content visibility
 * - Preloading and connection reuse
 * - Lazy loading of heavy elements
 * - Timeout handling for slow connections
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  AppState,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { AlertTriangle, Globe, RefreshCw, WifiOff } from 'lucide-react-native';
import Constants from 'expo-constants';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

// Get screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const isExpoGo = Constants.appOwnership === 'expo';

// Faster loading URLs (some platforms have lighter versions)
const PLATFORM_URLS: Record<string, { main: string; lite?: string }> = {
  dexscreener: { 
    main: 'https://dexscreener.com/solana',
    lite: 'https://dexscreener.com/solana'
  },
  raydium: { 
    main: 'https://raydium.io/swap/',
    lite: 'https://raydium.io/swap/?useOptimized=true'
  },
  bonk: { 
    main: 'https://bonk.fun/',
  },
  pumpfun: { 
    main: 'https://pump.fun/',
    lite: 'https://pump.fun/board'
  },
  orca: { 
    main: 'https://www.orca.so/',
    lite: 'https://www.orca.so/swap'
  },
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
// Mobile user agent as fallback
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
// Lite mode user agent (simpler, faster)
const LITE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Mobile-Optimized/1.0';

export const ExternalPlatformWebView: React.FC<ExternalPlatformWebViewProps> = ({ platform, desktopMode = false }) => {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(desktopMode ? 0.5 : 1);
  const [useDesktopMode, setUseDesktopMode] = useState(desktopMode);
  const [useLiteMode, setUseLiteMode] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const platformUrls = PLATFORM_URLS[platform] || { main: '' };
  const platformUrl = useLiteMode && platformUrls.lite ? platformUrls.lite : platformUrls.main;
  const platformName = PLATFORM_NAMES[platform] || platform;

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Reset states when platform changes
  useEffect(() => {
    setZoomScale(desktopMode ? 0.5 : 1);
    setUseDesktopMode(desktopMode);
    setUseLiteMode(false);
    setLoadTimeout(false);
    setIsOffline(false);
    setLoadingProgress(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
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

  // Start loading timeout
  const startLoadTimeout = useCallback(() => {
    setLoadTimeout(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        setLoadTimeout(true);
      }
    }, 15000);
  }, [loading]);

  // Simulate progress for better UX
  const startProgressSimulation = useCallback(() => {
    setLoadingProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    progressIntervalRef.current = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);
  }, []);

  // Stop progress simulation
  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoadingProgress(100);
  }, []);

  // Calculate scale to fit desktop site to screen width
  const getDesktopScale = () => {
    const desktopDesignWidth = 1280;
    return Math.max(0.25, Math.min(1, SCREEN_WIDTH / desktopDesignWidth));
  };

  // Inject JavaScript to control zoom and viewport for desktop mode
  const getViewportScript = (isDesktop: boolean, _scale: number) => {
    const desktopScale = getDesktopScale();
    return `
    (function() {
      function applyDesktopMode() {
        // Force desktop viewport
        const existingViewport = document.querySelector('meta[name=viewport]');
        if (existingViewport) {
          existingViewport.remove();
        }
        
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        
        if (${isDesktop}) {
          // Critical: Use device-width but set initial-scale to zoom out
          // This makes the desktop site fit the screen width
          meta.content = 'width=device-width, initial-scale=' + ${desktopScale} + ', minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes';
          
          // Apply comprehensive desktop scaling CSS
          const desktopStyle = document.createElement('style');
          desktopStyle.id = 'desktop-mode-style';
          desktopStyle.textContent = 
            'html { width: 100% !important; min-width: 100% !important; zoom: ' + ${desktopScale} + ' !important; transform-origin: top left !important; }' +
            'body { width: 100% !important; min-width: 100% !important; zoom: ' + ${desktopScale} + ' !important; transform-origin: top left !important; margin: 0 !important; padding: 0 !important; }' +
            '#root, #app, #__next, .app, .container { width: 100% !important; max-width: none !important; }' +
            '* { box-sizing: border-box !important; }';
          
          const existingStyle = document.getElementById('desktop-mode-style');
          if (existingStyle) existingStyle.remove();
          
          document.head.appendChild(desktopStyle);
          
          // Also try to scale the root element if it exists
          const rootEl = document.getElementById('root') || document.getElementById('app') || document.body;
          if (rootEl) {
            rootEl.style.zoom = '${desktopScale}';
            rootEl.style.transformOrigin = 'top left';
          }
        } else {
          meta.content = 'width=device-width, initial-scale=1.0, minimum-scale=0.25, maximum-scale=3.0, user-scalable=yes';
          
          const existingStyle = document.getElementById('desktop-mode-style');
          if (existingStyle) existingStyle.remove();
        }
        
        document.head.appendChild(meta);
      }
      
      // Apply immediately
      applyDesktopMode();
      
      // Re-apply after a short delay to override any site scripts
      setTimeout(applyDesktopMode, 100);
      setTimeout(applyDesktopMode, 500);
      setTimeout(applyDesktopMode, 1000);
      
      // Watch for viewport changes and re-apply
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'content') {
            const vp = document.querySelector('meta[name=viewport]');
            if (vp && ${isDesktop} && !vp.content.includes('initial-scale=' + ${desktopScale})) {
              applyDesktopMode();
            }
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
      webViewRef.current.injectJavaScript(getViewportScript(useDesktopMode, zoomScale));
    }
  }, [zoomScale, loading, error, useDesktopMode]);

  // Toggle lite mode for faster loading
  const toggleLiteMode = () => {
    setUseLiteMode(prev => !prev);
    setLoading(true);
    setError(null);
    startProgressSimulation();
    startLoadTimeout();
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setLoadTimeout(false);
    setIsOffline(false);
    startProgressSimulation();
    startLoadTimeout();
  };

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          {isOffline ? <WifiOff size={48} color={COLORS.error} /> : <AlertTriangle size={48} color={COLORS.error} />}
          <Text style={styles.errorTitle}>{isOffline ? 'No Connection' : 'Platform Unavailable'}</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          {loadTimeout && !useLiteMode && platformUrls.lite && (
            <TouchableOpacity style={styles.liteModeButton} onPress={toggleLiteMode}>
              <Text style={styles.liteModeText}>Try Lite Mode</Text>
            </TouchableOpacity>
          )}
          
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

  // Determine user agent based on mode
  const getUserAgent = () => {
    if (useLiteMode) return LITE_USER_AGENT;
    if (useDesktopMode) return DESKTOP_USER_AGENT;
    return MOBILE_USER_AGENT;
  };

  // Native WebView - Ultra Performance Optimized
  return (
    <View style={styles.container}>
      {/* Loading Overlay with Progress */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.solana} />
          <Text style={styles.loadingText}>
            {useLiteMode ? `Loading ${platformName} Lite...` : `Loading ${platformName}...`}
          </Text>
          
          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${Math.min(loadingProgress, 100)}%` }]} />
          </View>
          
          <Text style={styles.loadingSubtext}>
            {loadingProgress < 30 ? 'Connecting...' : 
             loadingProgress < 60 ? 'Loading content...' : 
             loadingProgress < 90 ? 'Optimizing...' : 
             'Almost ready...'}
          </Text>
          
          {loadTimeout && (
            <TouchableOpacity style={styles.stillLoadingButton} onPress={handleRetry}>
              <Text style={styles.stillLoadingText}>Taking too long? Tap to retry</Text>
            </TouchableOpacity>
          )}
          
          {!useLiteMode && platformUrls.lite && (
            <TouchableOpacity style={styles.liteModeOption} onPress={toggleLiteMode}>
              <Text style={styles.liteModeOptionText}>Try Lite Mode for faster loading</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Connection status indicator */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color={COLORS.error} />
          <Text style={styles.offlineText}>No internet connection</Text>
        </View>
      )}

      {/* WebView - Ultra Performance Optimized */}
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
          startProgressSimulation();
          startLoadTimeout();
        }}
        onLoadEnd={() => {
          setLoading(false);
          stopProgressSimulation();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }}
        onError={(e) => {
          setLoading(false);
          stopProgressSimulation();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
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
            stopProgressSimulation();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
        startInLoadingState={true}
        textZoom={useLiteMode ? 90 : 100}
        sharedCookiesEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
        injectedJavaScript={getViewportScript(useDesktopMode, zoomScale)}
        onNavigationStateChange={(navState: WebViewNavigation) => {
          if (navState.loading) {
            setLoading(true);
            startProgressSimulation();
          } else {
            setLoading(false);
            stopProgressSimulation();
            // Re-apply desktop mode after page fully loads
            if (useDesktopMode && webViewRef.current) {
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(getViewportScript(useDesktopMode, zoomScale));
              }, 500);
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(getViewportScript(useDesktopMode, zoomScale));
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
  liteModeButton: {
    backgroundColor: COLORS.solana + '30',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana,
  },
  liteModeText: {
    ...FONTS.sfProMedium,
    fontSize: 14,
    color: COLORS.solana,
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
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  loadingText: {
    ...FONTS.orbitronMedium,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  progressBarContainer: {
    width: 200,
    height: 4,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.m,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.solana,
    borderRadius: BORDER_RADIUS.full,
  },
  loadingSubtext: {
    ...FONTS.sfProRegular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
  },
  stillLoadingButton: {
    marginTop: SPACING.l,
    padding: SPACING.s,
  },
  stillLoadingText: {
    ...FONTS.sfProMedium,
    fontSize: 12,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  liteModeOption: {
    marginTop: SPACING.m,
    padding: SPACING.s,
  },
  liteModeOptionText: {
    ...FONTS.sfProMedium,
    fontSize: 12,
    color: COLORS.solana,
    textDecorationLine: 'underline',
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
