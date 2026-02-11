import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { TokenCard, ErrorBoundary, QueueStatusBanner, MarketSkeleton, QuickBuyModal } from '@/components';
import { ExternalPlatformWebView } from '../../components/market/ExternalPlatformWebView';
import { fetchMarketTokens, MarketToken } from '@/services/market';
import { showErrorToast } from '@/utils';

type MarketTab = 'soulmarket' | 'dexscreener' | 'raydium' | 'bonk' | 'pumpfun' | 'orca';

export default function MarketScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Real market data from API
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  // Responsive padding logic like Home screen
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MarketTab>('soulmarket');
  const [showQuickBuyModal, setShowQuickBuyModal] = useState(false);

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
      setError(null);
      setUsingMockData(false);
      const response = await fetchMarketTokens();
      if (response.success) {
        setTokens(response.tokens);
      } else {
        console.warn('[Market] API returned unsuccessful response, using mock data');
        setTokens(mockTokens);
        setUsingMockData(true);
      }
    } catch (err) {
      console.error('[Market] Failed to fetch tokens:', err);
      // Use mock data as fallback when backend is unavailable
      setTokens(mockTokens);
      setUsingMockData(true);
      setError(null); // Clear error so mock data displays
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
    if (tokens.length === 0 || activeTab !== 'soulmarket') return;

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
  }, [tokens.length, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTokens();
    setRefreshing(false);
  }, [loadTokens]);

  const visibleTokens = tokens.slice(0, 30);

  // Check if current tab requires WebView (non-scrollable container)
  const isWebViewTab = activeTab !== 'soulmarket';

  const renderSoulMarketContent = () => {
    return (
      <View style={styles.tabContent}>
        {/* Queue Status Banner for transaction monitoring */}
        <QueueStatusBanner />

        {/* Loading State */}
        {isLoading && tokens.length === 0 && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading SoulMarket tokens...</Text>
            <Text style={styles.loadingSubtext}>Filtering quality pairs with $250k+ liquidity</Text>
          </View>
        )}

        {/* Error State */}
        {error && tokens.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Failed to load tokens</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadTokens}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !error && visibleTokens.length === 0 && (
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
                name={token.name}
                price={token.price}
                change={token.priceChange24h}
                {...(token.liquidity !== undefined ? { liquidity: token.liquidity } : {})}
                {...(token.volume24h !== undefined ? { volume: token.volume24h } : {})}
                {...(token.logo ? { logo: token.logo } : {})}
                onPress={() => {
                  // Navigate to coin details page with all available data
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

  const renderWebViewTab = () => {
    switch (activeTab) {
      case 'dexscreener':
        return <ExternalPlatformWebView platform="dexscreener" />;
      case 'raydium':
        return <ExternalPlatformWebView platform="raydium" />;
      case 'bonk':
        return <ExternalPlatformWebView platform="bonk" />;
      case 'pumpfun':
        return <ExternalPlatformWebView platform="pumpfun" />;
      case 'orca':
        return <ExternalPlatformWebView platform="orca" />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View
        style={[
          styles.combinedHeader,
          {
            paddingHorizontal: responsivePadding,
          }
        ]}
      >
        {/* Tabs Section - moved to top, no dropdown needed */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            <Pressable
              style={[
                styles.tab,
                activeTab === 'soulmarket' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('soulmarket')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'soulmarket' && styles.activeTabText,
              ]}>
                SoulMarket
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tab,
                activeTab === 'dexscreener' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('dexscreener')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'dexscreener' && styles.activeTabText,
              ]}>
                DexScreener
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tab,
                activeTab === 'raydium' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('raydium')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'raydium' && styles.activeTabText,
              ]}>
                Raydium
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tab,
                activeTab === 'bonk' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('bonk')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'bonk' && styles.activeTabText,
              ]}>
                Bonk
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tab,
                activeTab === 'pumpfun' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('pumpfun')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'pumpfun' && styles.activeTabText,
              ]}>
                Pump.fun
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tab,
                activeTab === 'orca' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('orca')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'orca' && styles.activeTabText,
              ]}>
                Orca
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>

      <ErrorBoundary>
        {isWebViewTab ? (
          /* WebView tabs need a flex container, not ScrollView */
          <View style={styles.webViewContainer}>
            {renderWebViewTab()}
          </View>
        ) : (
          /* SoulMarket tab uses ScrollView for scrollable content */
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              {
                paddingHorizontal: responsivePadding,
                paddingTop: SPACING.s
              }
            ]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
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
          // Refresh tokens after successful swap
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
  webViewContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  combinedHeader: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.xs, // Minimal vertical padding for tabs
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    marginBottom: SPACING.m,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  searchIcon: {
    marginRight: SPACING.s,
  },
  searchInput: {
    ...FONTS.sfProRegular,
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.m,
    fontSize: 16,
  },
  filterChipsContainer: {
    paddingBottom: SPACING.s,
  },
  filterChip: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.m,
    marginRight: SPACING.s,
  },
  activeFilterChip: {
    backgroundColor: COLORS.solana + '30',
  },
  filterChipText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  activeFilterChipText: {
    color: COLORS.solana,
  },
  tabsContainer: {
    marginBottom: 0, // Completely removed bottom margin
  },
  tabsScroll: {
  },
  tab: {
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    marginRight: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.cardBackground,
  },
  activeTab: {
    backgroundColor: COLORS.solana + '20',
  },
  tabText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  activeTabText: {
    color: COLORS.solana,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 0, // Removed bottom padding to eliminate blank space
  },
  tabContent: {
    marginBottom: 0, // Completely removed bottom margin
  },
  webViewPlaceholder: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },
  webViewTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 20,
    marginBottom: SPACING.m,
  },
  webViewDescription: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  addFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.m,
    marginRight: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '50',
  },
  addFilterText: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 12,
    marginLeft: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.large,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
  },
  modalContent: {
    padding: SPACING.l,
  },
  filterSection: {
    marginBottom: SPACING.l,
  },
  filterSectionTitle: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  rangeInputContainer: {
    alignItems: 'center',
    gap: SPACING.s,
  },
  rangeInputRow: {
    flexDirection: 'row',
  },
  rangeInputColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  rangeInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    color: COLORS.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  rangeSeparator: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  rangeSeparatorRow: {
    marginHorizontal: SPACING.s,
    alignSelf: 'center',
  },
  rangeSeparatorColumn: {
    marginVertical: SPACING.s,
    alignSelf: 'center',
  },
  fullWidthInput: {
    ...FONTS.phantomRegular,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    color: COLORS.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.m,
    marginTop: SPACING.l,
    paddingTop: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBackground,
  },
  clearButton: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '30',
  },
  clearButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  applyButton: {
    flex: 1,
    backgroundColor: COLORS.solana,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    alignItems: 'center',
  },
  applyButtonText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  // Loading and empty states
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
    marginBottom: SPACING.m,
  },
  retryButton: {
    backgroundColor: COLORS.solana,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    marginTop: SPACING.s,
  },
  retryButtonText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  // Filter badge
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.solana,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    ...FONTS.sfProMedium,
    color: COLORS.textPrimary,
    fontSize: 10,
  },
  // Token count
  tokenCount: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: SPACING.s,
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
});
