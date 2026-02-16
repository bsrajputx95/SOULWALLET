import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  Modal,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingCart, ChevronDown, RefreshCw, Maximize2, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { TokenCard, ErrorBoundary, MarketSkeleton, QuickBuyModal } from '@/components';
import { ExternalPlatformWebView } from '../../components/market/ExternalPlatformWebView';
import { fetchMarketTokens, MarketToken } from '@/services/market';

type MarketPlatform = 'soulmarket' | 'dexscreener' | 'raydium' | 'bonk' | 'pumpfun' | 'orca';

const PLATFORM_OPTIONS: { value: MarketPlatform; label: string }[] = [
  { value: 'soulmarket', label: 'SoulMarket' },
  { value: 'dexscreener', label: 'DexScreener' },
  { value: 'raydium', label: 'Raydium' },
  { value: 'bonk', label: 'Bonk' },
  { value: 'pumpfun', label: 'Pump.fun' },
  { value: 'orca', label: 'Orca' },
];

export default function MarketScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Real market data from API
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  // Responsive padding logic like Home screen
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;

  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<MarketPlatform>('soulmarket');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQuickBuyModal, setShowQuickBuyModal] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0); // For forcing WebView reload
  const [isFullScreen, setIsFullScreen] = useState(false); // Full-screen mode state

  // Loading state for skeleton - only show on initial cold start
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Mock tokens for development fallback when backend is unavailable
  const mockTokens: MarketToken[] = [
    {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      price: 162.34,
      priceChange24h: 2.15,
      volume24h: 3200000000,
      marketCap: 72000000000,
      liquidity: 1800000000,
      logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
      banner: '',
    },
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      price: 1.00,
      priceChange24h: 0.01,
      volume24h: 4500000000,
      marketCap: 42000000000,
      liquidity: 2500000000,
      logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      banner: '',
    },
    {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk',
      price: 0.00001234,
      priceChange24h: 15.5,
      volume24h: 85000000,
      marketCap: 750000000,
      liquidity: 12000000,
      logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      banner: '',
    },
    {
      address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      symbol: 'WIF',
      name: 'dogwifhat',
      price: 0.85,
      priceChange24h: -5.2,
      volume24h: 45000000,
      marketCap: 850000000,
      liquidity: 8000000,
      logo: 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link',
      banner: '',
    },
    {
      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      symbol: 'JUP',
      name: 'Jupiter',
      price: 0.92,
      priceChange24h: 8.4,
      volume24h: 25000000,
      marketCap: 1200000000,
      liquidity: 15000000,
      logo: 'https://static.jup.ag/jup/icon.png',
      banner: '',
    },
    {
      address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
      symbol: 'TRUMP',
      name: 'Official Trump',
      price: 18.50,
      priceChange24h: 25.3,
      volume24h: 120000000,
      marketCap: 3500000000,
      liquidity: 45000000,
      logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN.png',
      banner: '',
    },
    {
      address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
      symbol: 'POPCAT',
      name: 'Popcat',
      price: 0.42,
      priceChange24h: -2.8,
      volume24h: 15000000,
      marketCap: 420000000,
      liquidity: 5000000,
      logo: 'https://bafkreidvnhdzuq3pvhnzq26hjydmhrr2xw2flkxkflg7swmrxnx7c7xvey.ipfs.nftstorage.link',
      banner: '',
    },
    {
      address: 'GJtJuWD9qYXG9QDwVcYiXR4eBrwyUPleTwJm9fF21M1u',
      symbol: 'FWOG',
      name: 'Fwog',
      price: 0.035,
      priceChange24h: 45.2,
      volume24h: 8500000,
      marketCap: 35000000,
      liquidity: 1200000,
      logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/GJtJuWD9qYXG9QDwVcYiXR4eBrwyUPleTwJm9fF21M1u.png',
      banner: '',
    },
    {
      address: '3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o',
      symbol: 'MOODENG',
      name: 'Moo Deng',
      price: 0.18,
      priceChange24h: 12.5,
      volume24h: 12000000,
      marketCap: 180000000,
      liquidity: 3500000,
      logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o.png',
      banner: '',
    },
    {
      address: 'J3NKxxXZcnNiMjKw9hYb2K4LUxmgB8mGaSWt8BYTtC9d',
      symbol: 'ZEREBRO',
      name: 'Zerebro',
      price: 0.065,
      priceChange24h: -8.4,
      volume24h: 5500000,
      marketCap: 65000000,
      liquidity: 1800000,
      logo: 'https://dd.dexscreener.com/ds-data/tokens/solana/J3NKxxXZcnNiMjKw9hYb2K4LUxmgB8mGaSWt8BYTtC9d.png',
      banner: '',
    },
  ];

  // Fetch tokens from API
  const loadTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      setUsingMockData(false);
      const response = await fetchMarketTokens();
      if (response.success) {
        setTokens(response.tokens);
      } else {
        if (__DEV__) console.warn('[Market] API returned unsuccessful response, using mock data');
        setTokens(mockTokens);
        setUsingMockData(true);
      }
    } catch (err) {
      if (__DEV__) console.error('[Market] Failed to fetch tokens:', err);
      // Use mock data as fallback when backend is unavailable
      setTokens(mockTokens);
      setUsingMockData(true);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, []);

  // Load tokens on mount
  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // Poll prices every 5 minutes for market tokens
  useEffect(() => {
    if (tokens.length === 0 || selectedPlatform !== 'soulmarket') return;

    const pollPrices = async () => {
      try {
        const response = await fetchMarketTokens();
        if (response.success) {
          setTokens(response.tokens);
        }
      } catch (err) {
        // Silent fail - keep showing cached data
      }
    };

    const interval = setInterval(pollPrices, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [tokens.length, selectedPlatform]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTokens();
    setRefreshing(false);
  }, [loadTokens]);

  // Show up to 50 tokens
  const visibleTokens = tokens.slice(0, 50);

  // Check if current selection requires WebView
  const isWebViewPlatform = selectedPlatform !== 'soulmarket';

  // Handle platform change
  const handlePlatformChange = (platform: MarketPlatform) => {
    setSelectedPlatform(platform);
    setShowDropdown(false);
    if (platform !== 'soulmarket') {
      setWebViewKey(prev => prev + 1); // Force WebView refresh on platform change
    }
  };

  // Handle refresh for WebView
  const handleWebViewRefresh = () => {
    setWebViewKey(prev => prev + 1);
  };

  // Enter full-screen mode
  const enterFullScreen = async () => {
    setIsFullScreen(true);
    // Lock to landscape orientation
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    // Hide status bar
    StatusBar.setHidden(true);
  };

  // Exit full-screen mode
  const exitFullScreen = async () => {
    setIsFullScreen(false);
    // Reset to portrait orientation
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    // Show status bar
    StatusBar.setHidden(false);
  };

  const renderSoulMarketContent = () => {
    return (
      <View style={styles.tabContent}>
        {/* Loading State */}
        {isLoading && tokens.length === 0 && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading SoulMarket tokens...</Text>
            <Text style={styles.loadingSubtext}>Top trending tokens on Solana</Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && visibleTokens.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No tokens available</Text>
            <Text style={styles.emptySubtitle}>Quality tokens will appear here</Text>
          </View>
        )}

        {/* Mock Data Indicator */}
        {usingMockData && (
          <View style={styles.mockDataBanner}>
            <Text style={styles.mockDataText}>📡 Using demo data (backend offline)</Text>
          </View>
        )}

        {/* Skeleton during initial load */}
        {isInitialLoad && tokens.length === 0 ? (
          <MarketSkeleton />
        ) : (
          <>
            {/* Tokens List */}
            {visibleTokens.map(token => (
              <TokenCard
                key={token.address}
                symbol={token.symbol}
                price={token.price}
                change={token.priceChange24h}
                {...(token.liquidity !== undefined ? { liquidity: token.liquidity } : {})}
                {...(token.volume24h !== undefined ? { volume: token.volume24h } : {})}
                {...(token.logo ? { logo: token.logo } : {})}
                onPress={() => {
                  router.push({
                    pathname: `/coin/${token.symbol.toLowerCase()}` as any,
                    params: {
                      symbol: token.symbol,
                      name: token.name,
                      price: token.price.toString(),
                      change: token.priceChange24h.toString(),
                      logo: token.logo || '',
                      banner: token.banner || '',
                      contractAddress: token.address || '',
                      pairAddress: '',
                      marketCap: (token.marketCap || 0).toString(),
                      volume24h: (token.volume24h || 0).toString(),
                      liquidity: (token.liquidity || 0).toString(),
                    }
                  });
                }}
              />
            ))}
          </>
        )}
      </View>
    );
  };

  const renderWebViewContent = () => {
    return (
      <ExternalPlatformWebView
        key={webViewKey}
        platform={selectedPlatform as 'dexscreener' | 'raydium' | 'bonk' | 'pumpfun' | 'orca'}
      />
    );
  };

  // Header with dropdown
  const renderPlatformHeader = () => (
    <View style={styles.platformHeader}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setShowDropdown(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownButtonText}>
          {PLATFORM_OPTIONS.find(p => p.value === selectedPlatform)?.label}
        </Text>
        <ChevronDown size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {isWebViewPlatform && (
        <View style={styles.headerButtons}>
          {/* Full-screen button */}
          <TouchableOpacity style={styles.iconButton} onPress={enterFullScreen}>
            <Maximize2 size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {/* Reload button */}
          <TouchableOpacity style={styles.iconButton} onPress={handleWebViewRefresh}>
            <RefreshCw size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            {PLATFORM_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownItem,
                  selectedPlatform === option.value && styles.dropdownItemActive,
                ]}
                onPress={() => handlePlatformChange(option.value)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedPlatform === option.value && styles.dropdownItemTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  // Full-screen mode UI
  if (isFullScreen) {
    return (
      <View style={styles.fullScreenContainer}>
        {/* Exit button at top-right corner */}
        <TouchableOpacity style={styles.exitFullScreenButton} onPress={exitFullScreen}>
          <X size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Full-screen WebView with zoom enabled */}
        <ExternalPlatformWebView
          key={webViewKey}
          platform={selectedPlatform as 'dexscreener' | 'raydium' | 'bonk' | 'pumpfun' | 'orca'}
          fullScreen={true}
        />

        {/* Quick Buy button in full-screen mode */}
        <Pressable
          style={styles.fullScreenQuickBuyButton}
          onPress={() => setShowQuickBuyModal(true)}
        >
          <LinearGradient
            colors={[COLORS.solana, COLORS.solana + '80']}
            style={styles.fullScreenQuickBuyGradient}
          >
            <ShoppingCart size={24} color={COLORS.textPrimary} />
          </LinearGradient>
        </Pressable>

        {/* Quick Buy Modal */}
        <QuickBuyModal
          visible={showQuickBuyModal}
          onClose={() => setShowQuickBuyModal(false)}
          onSuccess={() => {
            loadTokens();
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Platform Dropdown Header */}
      <View style={[styles.header, { paddingHorizontal: responsivePadding }]}>
        {renderPlatformHeader()}
      </View>

      <ErrorBoundary>
        {isWebViewPlatform ? (
          /* WebView platforms */
          <View style={styles.webViewContainer}>
            {renderWebViewContent()}
          </View>
        ) : (
          /* SoulMarket uses ScrollView for scrollable content */
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingHorizontal: responsivePadding, paddingTop: SPACING.s }
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {renderSoulMarketContent()}
          </ScrollView>
        )}
      </ErrorBoundary>

      {/* Floating Quick Buy Cart Button */}
      <Pressable
        style={styles.floatingCartButton}
        onPress={() => setShowQuickBuyModal(true)}
      >
        <LinearGradient
          colors={[COLORS.solana, COLORS.solana + '80']}
          style={styles.floatingCartGradient}
        >
          <ShoppingCart size={24} color={COLORS.textPrimary} />
        </LinearGradient>
      </Pressable>

      {/* Quick Buy Modal */}
      <QuickBuyModal
        visible={showQuickBuyModal}
        onClose={() => setShowQuickBuyModal(false)}
        onSuccess={() => {
          loadTokens();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.xs,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  dropdownButtonText: {
    ...FONTS.orbitronBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: SPACING.m,
  },
  dropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownItem: {
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.solana + '20',
  },
  dropdownItemText: {
    ...FONTS.orbitronMedium,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  dropdownItemTextActive: {
    color: COLORS.solana,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Full-screen mode styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  exitFullScreenButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenQuickBuyButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 100,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.solana,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fullScreenQuickBuyGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 0,
  },
  tabContent: {
    marginBottom: 0,
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  loadingSubtext: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.s,
  },
  emptySubtitle: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  // Mock data indicator
  mockDataBanner: {
    backgroundColor: COLORS.warning + '30',
    borderRadius: BORDER_RADIUS.medium,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.s,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning + '50',
  },
  mockDataText: {
    ...FONTS.sfProMedium,
    color: COLORS.warning,
    fontSize: 12,
    textAlign: 'center',
  },
  // Floating cart button
  floatingCartButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.solana,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingCartGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
