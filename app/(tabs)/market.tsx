import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  TextInput,
  useWindowDimensions,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, Settings, Plus } from 'lucide-react-native';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useMarket } from '../../hooks/market-store';
import { parseFilterValue } from '../../types/market-filters';

// Import TokenCard
import { TokenCard } from '../../components/TokenCard';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ExternalPlatformWebView } from '../../components/market/ExternalPlatformWebView';

type MarketTab = 'soulmarket' | 'raydium' | 'pumpfun' | 'bullx' | 'dexscreener';

export default function MarketScreen() {
  const { width } = useWindowDimensions();
  const {
    tokens,
    isLoading,
    activeFilters,
    toggleFilter,
    searchQuery,
    setSearchQuery,
    refetch,
    setAdvancedFilters,
    clearFilters,
    activeFilterCount,
    hasMore,
    loadMore,
    totalCount,
  } = useMarket();

  // Responsive padding logic like Home screen
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MarketTab>('soulmarket');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  // Advanced filter states
  const [minLiquidity, setMinLiquidity] = useState('');
  const [maxLiquidity, setMaxLiquidity] = useState('');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [maxMarketCap, setMaxMarketCap] = useState('');
  const [minFDV, setMinFDV] = useState('');
  const [maxFDV, setMaxFDV] = useState('');
  const [pairFilter, setPairFilter] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [min24hTxns, setMin24hTxns] = useState('');
  const [min24hBuys, setMin24hBuys] = useState('');
  const [min24hSells, setMin24hSells] = useState('');
  const [min24hVolume, setMin24hVolume] = useState('');

  // Header animation constants and state
  const HEADER_HEIGHT = 100; // Optimized height for both header and tabs
  const SCROLL_THRESHOLD = 50; // Minimum scroll distance before hiding header
  const SCROLL_UP_THRESHOLD = 30; // Minimum upward scroll before showing header
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const scrollDirection = useRef<'up' | 'down' | null>(null);
  const headerHidden = useRef(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Tokens are already filtered in the store, use directly
  // totalCount shows total filtered results, tokens shows paginated subset
  const visibleTokens = tokens;

  // Handle scroll for header animation with improved behavior
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const scrollDiff = currentScrollY - lastScrollY.current;
        const currentDirection = scrollDiff > 0 ? 'down' : 'up';

        // Only trigger animation if scroll direction changed or significant scroll distance
        if (currentDirection !== scrollDirection.current || Math.abs(scrollDiff) > 5) {
          scrollDirection.current = currentDirection;

          if (currentDirection === 'down' && currentScrollY > SCROLL_THRESHOLD) {
            // Hide header when scrolling down past threshold (only if not already hidden)
            if (!headerHidden.current) {
              Animated.timing(headerTranslateY, {
                toValue: -HEADER_HEIGHT,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }).start(() => { headerHidden.current = true; setIsHeaderHidden(true); });
            }
          } else if (currentDirection === 'up' && scrollDiff < -SCROLL_UP_THRESHOLD) {
            // Show header only when scrolling up with sufficient momentum (only if hidden)
            if (headerHidden.current) {
              Animated.timing(headerTranslateY, {
                toValue: 0,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }).start(() => { headerHidden.current = false; setIsHeaderHidden(false); });
            }

            // Auto-close search bar when user scrolls up to reclaim space
            if (showSearchBar) {
              setShowSearchBar(false);
            }
          }
        }

        lastScrollY.current = currentScrollY;
      },
    }
  );
  const renderTabContent = () => {
    switch (activeTab) {
      case 'soulmarket':
        return (
          <View style={styles.tabContent}>
            {/* Loading State */}
            {isLoading && tokens.length === 0 && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading SoulMarket tokens...</Text>
                <Text style={styles.loadingSubtext}>Filtering quality pairs with 100k+ liquidity</Text>
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
              />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <Pressable style={styles.loadMoreButton} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Load More</Text>
              </Pressable>
            )}
          </View>
        );
      case 'raydium':
        return <ExternalPlatformWebView platform="raydium" />;
      case 'pumpfun':
        return <ExternalPlatformWebView platform="pumpfun" />;
      case 'bullx':
        return <ExternalPlatformWebView platform="bullx" />;
      case 'dexscreener':
        return <ExternalPlatformWebView platform="dexscreener" />;
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
        {/* Top Header Section */}
        <View style={styles.header}>
          <View style={styles.dropdown}>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => { if (__DEV__) console.log('Open dropdown'); }}
            >
              <Text style={styles.dropdownText}>
                {activeTab === 'soulmarket' && 'SoulMarket'}
                {activeTab === 'raydium' && 'Raydium'}
                {activeTab === 'pumpfun' && 'Pump.fun'}
                {activeTab === 'bullx' && 'BullX'}
                {activeTab === 'dexscreener' && 'Dexscreener'}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </Pressable>
          </View>

          <View style={styles.headerButtons}>
            <Pressable
              style={styles.filterButton}
              onPress={() => setShowSearchBar(!showSearchBar)}
            >
              <Search size={24} color={COLORS.solana} />
            </Pressable>
            <Pressable
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Settings size={24} color={COLORS.solana} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Tabs Section */}
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
                activeTab === 'bullx' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('bullx')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'bullx' && styles.activeTabText,
              ]}>
                BullX
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
                Dexscreener
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
      {showSearchBar && (
        <View style={[
          styles.filtersContainer,
          {
            paddingHorizontal: responsivePadding,
            marginTop: SPACING.s,
            marginBottom: SPACING.s,
          }
        ]}>
          <View style={styles.searchContainer}>
            <Search size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tokens..."
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={20} color={COLORS.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {showFilters && (
        <View style={[styles.filtersContainer, { paddingHorizontal: responsivePadding, marginTop: SPACING.s }]}>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsContainer}
          >
            <Pressable
              style={[
                styles.filterChip,
                activeFilters.includes('volume') && styles.activeFilterChip,
              ]}
              onPress={() => toggleFilter('volume')}
            >
              <Text style={[
                styles.filterChipText,
                activeFilters.includes('volume') && styles.activeFilterChipText,
              ]}>
                Volume {'>'}$1M
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterChip,
                activeFilters.includes('liquidity') && styles.activeFilterChip,
              ]}
              onPress={() => toggleFilter('liquidity')}
            >
              <Text style={[
                styles.filterChipText,
                activeFilters.includes('liquidity') && styles.activeFilterChipText,
              ]}>
                Liquidity {'>'}$500K
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterChip,
                activeFilters.includes('change') && styles.activeFilterChip,
              ]}
              onPress={() => toggleFilter('change')}
            >
              <Text style={[
                styles.filterChipText,
                activeFilters.includes('change') && styles.activeFilterChipText,
              ]}>
                24h Change {'>'}0%
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterChip,
                activeFilters.includes('age') && styles.activeFilterChip,
              ]}
              onPress={() => toggleFilter('age')}
            >
              <Text style={[
                styles.filterChipText,
                activeFilters.includes('age') && styles.activeFilterChipText,
              ]}>
                New Listings
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterChip,
                activeFilters.includes('verified') && styles.activeFilterChip,
              ]}
              onPress={() => toggleFilter('verified')}
            >
              <Text style={[
                styles.filterChipText,
                activeFilters.includes('verified') && styles.activeFilterChipText,
              ]}>
                Verified Only
              </Text>
            </Pressable>



            <Pressable
              style={styles.addFilterChip}
              onPress={() => setShowAdvancedFilters(true)}
            >
              <Plus size={16} color={COLORS.solana} />
              <Text style={styles.addFilterText}>Advanced Filters</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      <ErrorBoundary>
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderTabContent()}
        </ScrollView>
      </ErrorBoundary>

      {/* Advanced Filters Modal */}
      <Modal
        visible={showAdvancedFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAdvancedFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.95, maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Advanced Filters</Text>
              <Pressable onPress={() => setShowAdvancedFilters(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              {/* Liquidity */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Liquidity</Text>
                <View style={[styles.rangeInputContainer, styles.rangeInputColumn]}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 500M)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minLiquidity}
                    onChangeText={setMinLiquidity}
                  />
                  <Text style={[styles.rangeSeparator, styles.rangeSeparatorColumn]}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max"
                    placeholderTextColor={COLORS.textSecondary}
                    value={maxLiquidity}
                    onChangeText={setMaxLiquidity}
                  />
                </View>
              </View>

              {/* Market Cap */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Market Cap</Text>
                <View style={[styles.rangeInputContainer, styles.rangeInputColumn]}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 1B)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minMarketCap}
                    onChangeText={setMinMarketCap}
                  />
                  <Text style={[styles.rangeSeparator, styles.rangeSeparatorColumn]}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max"
                    placeholderTextColor={COLORS.textSecondary}
                    value={maxMarketCap}
                    onChangeText={setMaxMarketCap}
                  />
                </View>
              </View>

              {/* FDV */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>FDV (Fully Diluted Valuation)</Text>
                <View style={[styles.rangeInputContainer, styles.rangeInputColumn]}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 100M)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minFDV}
                    onChangeText={setMinFDV}
                  />
                  <Text style={[styles.rangeSeparator, styles.rangeSeparatorColumn]}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max"
                    placeholderTextColor={COLORS.textSecondary}
                    value={maxFDV}
                    onChangeText={setMaxFDV}
                  />
                </View>
              </View>

              {/* Pair */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Pair</Text>
                <TextInput
                  style={styles.fullWidthInput}
                  placeholder="e.g. SOL, USDC, ETH"
                  placeholderTextColor={COLORS.textSecondary}
                  value={pairFilter}
                  onChangeText={setPairFilter}
                />
              </View>

              {/* Age */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Age (hours)</Text>
                <View style={[styles.rangeInputContainer, styles.rangeInputColumn]}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 24)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minAge}
                    onChangeText={setMinAge}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.rangeSeparator, styles.rangeSeparatorColumn]}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max"
                    placeholderTextColor={COLORS.textSecondary}
                    value={maxAge}
                    onChangeText={setMaxAge}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* 24h Transactions */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>24h Transactions</Text>
                <TextInput
                  style={styles.fullWidthInput}
                  placeholder="Min transactions (e.g. 1000)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={min24hTxns}
                  onChangeText={setMin24hTxns}
                  keyboardType="numeric"
                />
              </View>

              {/* 24h Buys */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>24h Buys</Text>
                <TextInput
                  style={styles.fullWidthInput}
                  placeholder="Min buys (e.g. 500)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={min24hBuys}
                  onChangeText={setMin24hBuys}
                  keyboardType="numeric"
                />
              </View>

              {/* 24h Sells */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>24h Sells</Text>
                <TextInput
                  style={styles.fullWidthInput}
                  placeholder="Min sells (e.g. 300)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={min24hSells}
                  onChangeText={setMin24hSells}
                  keyboardType="numeric"
                />
              </View>

              {/* 24h Volume */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>24h Volume</Text>
                <TextInput
                  style={styles.fullWidthInput}
                  placeholder="Min volume (e.g. 1M)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={min24hVolume}
                  onChangeText={setMin24hVolume}
                />
              </View>

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.clearButton}
                  onPress={() => {
                    // Clear local state
                    setMinLiquidity('');
                    setMaxLiquidity('');
                    setMinMarketCap('');
                    setMaxMarketCap('');
                    setMinFDV('');
                    setMaxFDV('');
                    setPairFilter('');
                    setMinAge('');
                    setMaxAge('');
                    setMin24hTxns('');
                    setMin24hBuys('');
                    setMin24hSells('');
                    setMin24hVolume('');
                    // Clear store filters
                    clearFilters();
                  }}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </Pressable>

                <Pressable
                  style={styles.applyButton}
                  onPress={() => {
                    // Apply advanced filters to market store
                    setAdvancedFilters({
                      minLiquidity: parseFilterValue(minLiquidity),
                      maxLiquidity: parseFilterValue(maxLiquidity),
                      minMarketCap: parseFilterValue(minMarketCap),
                      maxMarketCap: parseFilterValue(maxMarketCap),
                      minFDV: parseFilterValue(minFDV),
                      maxFDV: parseFilterValue(maxFDV),
                      minAgeHours: parseFilterValue(minAge),
                      maxAgeHours: parseFilterValue(maxAge),
                      min24hTxns: parseFilterValue(min24hTxns),
                      min24hBuys: parseFilterValue(min24hBuys),
                      min24hSells: parseFilterValue(min24hSells),
                      minVolume24h: parseFilterValue(min24hVolume),
                      pairToken: pairFilter.trim() || undefined,
                    });
                    setShowAdvancedFilters(false);
                  }}
                >
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  combinedHeader: {
    backgroundColor: COLORS.background,
    paddingVertical: 0, // Completely removed all vertical padding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0, // Completely removed all vertical padding
    backgroundColor: COLORS.background,
    height: 60,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  dropdown: {
    flex: 1,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: {
    ...FONTS.orbitronBold,
    color: COLORS.solana,
    fontSize: 18,
    marginRight: SPACING.xs,
  },
  dropdownIcon: {
    color: COLORS.solana,
    fontSize: 12,
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
});