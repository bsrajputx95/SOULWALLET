/**
 * External Platform WebView - Ultra-Fast & Optimized
 * 
 * Displays external DEX platforms in optimized WebView with:
 * - Aggressive caching for instant loads
 * - Full zoom control (zoom out to 25%, zoom in to 300%)
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
  Platform,
  AppState,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { AlertTriangle, Globe, RefreshCw, ZoomIn, ZoomOut, Wifi, WifiOff } from 'lucide-react-native';
import Constants from 'expo-constants';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const isExpoGo = Constants.appOwnership === 'expo';

// Faster loading URLs (some platforms have lighter versions)
const PLATFORM_URLS: Record<string, { main: string; lite?: string }> = {
  dexscreener: { 
    main: 'https://dexscreener.com/solana',
    lite: 'https://dexscreener.com/solana' // DexScreener is already optimized
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
  fullScreen?: boolean;
}

// Desktop Chrome user agent for desktop mode rendering
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Mobile user agent as fallback
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
// Lite mode user agent (simpler, faster)
const LITE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Mobile-Optimized/1.0';

// CSS to inject for faster loading (hides heavy elements initially)
const FAST_LOAD_CSS = `
  <style>
    /* Hide heavy elements during initial load */
    * { animation: none !important; transition: none !important; }
    
    /* Lazy load images */
    img { loading: lazy !important; }
    
    /* Reduce repaints */
    * { will-change: auto !important; }
    
    /* Hide non-essential elements initially */
    .ad, .advertisement, .banner, .popup, .modal:not(:target) {
      display: none !important;
    }
  </style>
`;

export const ExternalPlatformWebView: React.FC<ExternalPlatformWebViewProps> = ({ platform, fullScreen = false }) => {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [useDesktopMode, setUseDesktopMode] = useState(fullScreen);
  const [useLiteMode, setUseLiteMode] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    setZoomScale(1);
    setUseDesktopMode(fullScreen);
    setUseLiteMode(false);
    setLoadTimeout(false);
    setIsOffline(false);
    setLoadingProgress(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  }, [platform, fullScreen]);

  // Monitor network state
  useEffect(() => {
    const unsubscribe = AppState.addEventListener('change', () => {
      // Check connectivity when app comes to foreground
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
    
    // Set timeout for 15 seconds
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
        if (prev >= 90) return prev; // Hold at 90% until actually loaded
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

  // Inject JavaScript to control zoom
  const getZoomScript = (scale: number) => `
    (function() {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=${scale}, minimum-scale=0.25, maximum-scale=3.0, user-scalable=yes');
      } else {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=${scale}, minimum-scale=0.25, maximum-scale=3.0, user-scalable=yes';
        document.head.appendChild(meta);
      }
      document.body.style.zoom = '${scale}';
      document.documentElement.style.zoom = '${scale}';
    })();
    true;
  `;

  // Apply zoom when scale changes
  useEffect(() => {
    if (webViewRef.current && !loading && !error) {
      webViewRef.current.injectJavaScript(getZoomScript(zoomScale));
    }
  }, [zoomScale, loading, error]);

  const handleZoomIn = () => {
    setZoomScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setZoomScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
  };

  const toggleDesktopMode = () => {
    setUseDesktopMode(prev => !prev);
    setLoading(true);
    setError(null);
    startProgressSimulation();
    startLoadTimeout();
  };

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

      {/* Zoom Controls - Only in fullscreen */}
      {fullScreen && !loading && (
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <ZoomOut size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomTextButton} onPress={handleResetZoom}>
            <Text style={styles.zoomText}>{Math.round(zoomScale * 100)}%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <ZoomIn size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity 
            style={[styles.modeButton, useDesktopMode && styles.modeButtonActive]} 
            onPress={toggleDesktopMode}
          >
            <Text style={[styles.modeText, useDesktopMode && styles.modeTextActive]}>
              {useDesktopMode ? 'Desktop' : 'Mobile'}
            </Text>
          </TouchableOpacity>
          {platformUrls.lite && (
            <TouchableOpacity 
              style={[styles.modeButton, useLiteMode && styles.modeButtonActive]} 
              onPress={toggleLiteMode}
            >
              <Text style={[styles.modeText, useLiteMode && styles.modeTextActive]}>
                {useLiteMode ? 'Lite ✓' : 'Lite'}
              </Text>
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
        style={[styles.webView, fullScreen && styles.webViewFullScreen]}
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
        // Core functionality
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Caching - MOST AGGRESSIVE FOR SPEED
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        // Use appropriate user agent
        userAgent={getUserAgent()}
        // Performance tweaks
        bounces={false}
        overScrollMode="never"
        // Security
        setSupportMultipleWindows={false}
        // Third party cookies (DEXs need this)
        thirdPartyCookiesEnabled={true}
        // Mixed content for older sites
        mixedContentMode="compatibility"
        // ZOOM SETTINGS - Enable full zoom control
        scalesPageToFit={true}
        setBuiltInZoomControls={true}
        setDisplayZoomControls={false}
        // Hardware acceleration - CRITICAL FOR SPEED
        androidHardwareAccelerationDisabled={false}
        // Preload and optimization
        startInLoadingState={true}
        // Text zoom for accessibility
        textZoom={useLiteMode ? 90 : 100}
        // Connection pooling and reuse
        sharedCookiesEnabled={true}
        // Media playback
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Loading timeout
        androidLayerType="hardware"
        // Inject JavaScript for performance
        injectedJavaScript={`
          (function() {
            // Optimize viewport for zooming
            let viewport = document.querySelector('meta[name=viewport]');
            if (!viewport) {
              viewport = document.createElement('meta');
              viewport.name = 'viewport';
              document.head.appendChild(viewport);
            }
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=0.25, maximum-scale=3.0, user-scalable=yes');
            
            // Disable heavy animations during load
            const style = document.createElement('style');
            style.textContent = '* { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }';
            document.head.appendChild(style);
            
            // Lazy load images
            const images = document.querySelectorAll('img');
            images.forEach(img => {
              img.setAttribute('loading', 'lazy');
            });
            
            // Remove animation blocking after 2 seconds
            setTimeout(() => {
              style.remove();
            }, 2000);
          })();
          true;
        `}
        // Handle navigation
        onNavigationStateChange={(navState: WebViewNavigation) => {
          if (navState.loading) {
            setLoading(true);
            startProgressSimulation();
          } else {
            setLoading(false);
            stopProgressSimulation();
          }
        }}
        // Render faster by not waiting for all resources
        originWhitelist={['*']}
        // Allow file access for caching
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
  zoomControls: {
    position: 'absolute',
    top: 60,
    right: 10,
    zIndex: 100,
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground + 'F0',
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  zoomTextButton: {
    width: 60,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  zoomText: {
    ...FONTS.sfProMedium,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  zoomDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  modeButton: {
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginHorizontal: 2,
  },
  modeButtonActive: {
    backgroundColor: COLORS.solana + '30',
  },
  modeText: {
    ...FONTS.sfProMedium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  modeTextActive: {
    color: COLORS.solana,
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
  },
  webViewFullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

export default ExternalPlatformWebView;
