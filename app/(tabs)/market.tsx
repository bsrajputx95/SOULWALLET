import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Pressable, 
  ScrollView, 
  RefreshControl,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Search, X, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { TokenCard } from '../../components/TokenCard';
import { NeonButton } from '../../components/NeonButton';
import { NeonInput } from '../../components/NeonInput';
import { useMarket } from '../../hooks/market-store';

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
    refetch 
  } = useMarket();

  // Responsive padding logic like Home screen
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MarketTab>('soulmarket');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
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

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'soulmarket':
        return (
          <View style={styles.tabContent}>
            {tokens.map(token => (
              <TokenCard
                key={token.id}
                symbol={token.symbol}
                name={token.name}
                price={token.price}
                change={token.change24h}
                liquidity={token.liquidity}
                volume={token.volume}
                age={token.age}
              />
            ))}
          </View>
        );
      case 'raydium':
      case 'pumpfun':
      case 'bullx':
      case 'dexscreener':
        return (
          <View style={styles.webViewPlaceholder}>
            <Text style={styles.webViewTitle}>
              {activeTab === 'raydium' && 'Raydium'}
              {activeTab === 'pumpfun' && 'Pump.fun'}
              {activeTab === 'bullx' && 'BullX'}
              {activeTab === 'dexscreener' && 'Dexscreener'}
            </Text>
            <Text style={styles.webViewDescription}>
              External platform would load here in a WebView.
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: responsivePadding }]}>
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
        
        <Pressable 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Settings size={24} color={COLORS.solana} />
        </Pressable>
      </View>
      
      {showFilters && (
        <View style={[styles.filtersContainer, { paddingHorizontal: responsivePadding }]}>
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
      
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsScroll, { paddingHorizontal: responsivePadding }]}
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
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingHorizontal: responsivePadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderTabContent()}
      </ScrollView>
      
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
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Liquidity */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Liquidity</Text>
                <View style={styles.rangeInputContainer}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 500M)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minLiquidity}
                    onChangeText={setMinLiquidity}
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
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
                <View style={styles.rangeInputContainer}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 1B)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minMarketCap}
                    onChangeText={setMinMarketCap}
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
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
                <View style={styles.rangeInputContainer}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 100M)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minFDV}
                    onChangeText={setMinFDV}
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
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
                <View style={styles.rangeInputContainer}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min (e.g. 24)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={minAge}
                    onChangeText={setMinAge}
                    keyboardType="numeric"
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
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
                  }}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </Pressable>
                
                <Pressable 
                  style={styles.applyButton}
                  onPress={() => {
                    // Apply filters logic here
                    if (__DEV__) {
                      console.log('Applying filters:', {
                        minLiquidity, maxLiquidity, minMarketCap, maxMarketCap,
                        minFDV, maxFDV, pairFilter, minAge, maxAge,
                        min24hTxns, min24hBuys, min24hSells, min24hVolume
                      });
                    }
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.m,
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
    marginBottom: SPACING.m,
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
    paddingBottom: 20,
  },
  tabContent: {
    marginBottom: SPACING.l,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
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
});
