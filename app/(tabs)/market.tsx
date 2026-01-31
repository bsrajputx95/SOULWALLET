import React, { useState, useCallback } from 'react';
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

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

// Import TokenCard
import { TokenCard } from '../../components/TokenCard';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ExternalPlatformWebView } from '../../components/market/ExternalPlatformWebView';
import { QueueStatusBanner } from '../../components/QueueStatusBanner';
import { MarketSkeleton } from '../../components/SkeletonLoader';
import { QuickBuyModal } from '../../components/QuickBuyModal';

// Static dummy market data for pure UI
const DUMMY_TOKENS = [
  { id: '1', symbol: 'SOL', name: 'Solana', price: 105.25, change24h: 2.5, liquidity: 500000, volume: 150000, transactions: 1200, contractAddress: 'So11111111111111111111111111111111111111112', pairAddress: 'SOL-USDC', logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { id: '2', symbol: 'BONK', name: 'Bonk', price: 0.000025, change24h: -3.2, liquidity: 300000, volume: 80000, transactions: 850, contractAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', pairAddress: 'BONK-SOL', logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  { id: '3', symbol: 'JUP', name: 'Jupiter', price: 0.82, change24h: 5.1, liquidity: 450000, volume: 120000, transactions: 980, contractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', pairAddress: 'JUP-USDC', logo: 'https://static.jup.ag/jup/icon.png' },
];

type MarketTab = 'soulmarket' | 'dexscreener' | 'raydium' | 'bonk' | 'pumpfun' | 'orca';

export default function MarketScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Static dummy data - pure UI mode (no hooks)
  const tokens = DUMMY_TOKENS;
  const isLoading = false;
  const searchQuery = '';
  const refetch = async () => { };
  const hasMore = false;
  const loadMore = () => { };
  const totalCount = DUMMY_TOKENS.length;

  // Responsive padding logic like Home screen
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MarketTab>('soulmarket');
  const [showQuickBuyModal, setShowQuickBuyModal] = useState(false);

  // Loading state for skeleton - only show on initial cold start
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Set initial load to false once we have data
  React.useEffect(() => {
    if (tokens.length > 0) {
      setIsInitialLoad(false);
    }
    const timer = setTimeout(() => setIsInitialLoad(false), 3000);
    return () => clearTimeout(timer);
  }, [tokens.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Tokens are already filtered in the store, use directly
  // totalCount shows total filtered results, tokens shows paginated subset
  const visibleTokens = tokens;

  // Check if current tab requires WebView (non-scrollable container)
  const isWebViewTab = activeTab !== 'soulmarket';

  const renderSoulMarketContent = () => {
    return (
      <View style={styles.tabContent}>
        {/* Queue Status Banner for transaction monitoring */}
        <QueueStatusBanner onRetry={() => refetch()} />

        {/* Loading State */}
        {isLoading && tokens.length === 0 && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading SoulMarket tokens...</Text>
            <Text style={styles.loadingSubtext}>Filtering quality pairs with $250k+ liquidity</Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && visibleTokens.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No tokens found' : 'No tokens available'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term'
                : 'Quality tokens will appear here'}
            </Text>
          </View>
        )}

        {/* Token Count */}
        {totalCount > 0 && (
          <Text style={styles.tokenCount}>
            Showing {visibleTokens.length} of {totalCount} tokens
          </Text>
        )}

        {/* Skeleton during initial load */}
        {isInitialLoad && tokens.length === 0 ? (
          <MarketSkeleton />
        ) : (
          <>
            {/* Tokens List */}
            {visibleTokens.map(token => (
              <TokenCard
                key={token.id}
                symbol={token.symbol}
                name={token.name}
                price={token.price}
                change={token.change24h}
                {...(token.liquidity !== undefined ? { liquidity: token.liquidity } : {})}
                {...(token.volume !== undefined ? { volume: token.volume } : {})}
                {...(token.transactions !== undefined ? { transactions: token.transactions } : {})}
                {...(token.logo ? { logo: token.logo } : {})}
                onPress={() => {
                  // Navigate to coin details page with all available data
                  router.push({
                    pathname: `/coin/${token.symbol.toLowerCase()}` as any,
                    params: {
                      symbol: token.symbol,
                      name: token.name,
                      price: token.price.toString(),
                      change: token.change24h.toString(),
                      logo: token.logo || '',
                      contractAddress: token.contractAddress || '',
                      pairAddress: token.pairAddress || '',
                    }
                  });
                }}
              />
            ))}
          </>
        )}

        {/* Load More Button */}
        {hasMore && (
          <Pressable style={styles.loadMoreButton} onPress={loadMore}>
            <Text style={styles.loadMoreText}>Load More</Text>
          </Pressable>
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
  // Load more button
  loadMoreButton: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingVertical: SPACING.m,
    marginTop: SPACING.m,
    marginBottom: SPACING.l,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
  },
  loadMoreText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 14,
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