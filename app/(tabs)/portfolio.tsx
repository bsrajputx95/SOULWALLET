import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  Image,
  Alert,
  useWindowDimensions,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, ChevronRight, X, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { NeonCard, NeonButton, NeonInput, QueueStatusBanner, PortfolioSkeleton, ErrorBoundary } from '@/components';
import { fetchBalances, hasLocalWallet, getLocalPublicKey, Holding, api } from '@/services';
import { validateSession } from '@/utils';

// Static dummy types for pure UI mode
type Token = {
  id?: string;
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  logo?: string;
  price: number;
  change24h: number;
  value: number;
};
type CopiedWallet = {
  id: string;
  address: string;
  name: string;
  isActive: boolean;
  pnl: number;
  username?: string;
  walletAddress?: string;
  totalAmount?: number;
  amountPerTrade?: number;
  stopLoss?: number;
  takeProfit?: number;
  slippage?: number;
  roi: number;
};

type PortfolioTab = 'tokens' | 'copied' | 'watchlist';
type ChartPeriod = '24h' | '7d' | '30d' | 'all';
type ChartType = 'line' | 'candle';

export default function PortfolioScreen() {
  const router = useRouter();

  // Real user profile state
  const [user, setUser] = useState<any>(null);
  const [solanaPublicKey, setSolanaPublicKey] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [copiedWallets] = useState<CopiedWallet[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [dailyPnl] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from backend
  const fetchUserProfile = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      const data = await api.get<{ user: unknown }>('/me');
      setUser(data.user || data);
    } catch {
    }
  }, []);

  // Fetch wallet data from backend
  const fetchWalletData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      // Check if wallet exists locally
      const hasLocal = await hasLocalWallet();
      if (hasLocal) {
        const pubkey = await getLocalPublicKey();
        setSolanaPublicKey(pubkey);

        // Fetch balances from backend
        const portfolio = await fetchBalances(token);
        if (portfolio) {
          setTotalBalance(portfolio.totalUsdValue);
          // Transform holdings to Token type
          setTokens(portfolio.holdings.map((h: Holding, i: number) => ({
            id: String(i + 1),
            symbol: h.symbol,
            name: h.name,
            balance: h.balance,
            usdValue: h.usdValue,
            price: h.balance > 0 ? h.usdValue / h.balance : 0,
            change24h: 0,
            value: h.usdValue,
            ...(h.logo ? { logo: h.logo } : {}),
          })));
        }
      }
    } catch {
    }
  }, []);

  // Refetch function for pull-to-refresh
  const refetch = useCallback(async () => {
    await Promise.all([fetchUserProfile(), fetchWalletData()]);
  }, [fetchUserProfile, fetchWalletData]);

  // Load data on mount
  useEffect(() => {
    void validateSession();
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUserProfile(), fetchWalletData()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchUserProfile, fetchWalletData]);

  // Refresh when tab becomes focused
  useFocusEffect(
    useCallback(() => {
      // Refresh wallet data when portfolio tab is focused
      fetchWalletData();
    }, [fetchWalletData])
  );

  const updateCopiedWallet = async (_id: string, _updates: any, _totp: string) => {
    Alert.alert('🚧 Demo Mode', 'Copy trade update is simulated.');
    return true;
  };
  const isUpdatingCopyTrade = false;

  // Mock open positions query - coming soon
  const openPositionsQuery = { data: [] as any[], isLoading: false, refetch: async () => ({}) };

  // Loading state for skeleton
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Set initial load to false once data is loaded
  useEffect(() => {
    if (!isLoading) {
      setIsInitialLoad(false);
    }
    // Safety timeout
    const timer = setTimeout(() => setIsInitialLoad(false), 3000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Mock trending data - static mock data
  const trendingData: any = { pairs: [] };

  // Responsive padding logic like Home screen
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PortfolioTab>('tokens');
  const [watchlistTokens, setWatchlistTokens] = useState<Array<{
    symbol: string;
    name: string;
    logo?: string;
    price: number;
    change24h: number;
    contractAddress?: string;
    banner?: string;
    marketCap?: number;
    volume24h?: number;
    liquidity?: number;
  }>>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('24h');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeError, setTradeError] = useState<string | undefined>(undefined);
  const [selectedWallet, setSelectedWallet] = useState<CopiedWallet | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editAmountPerTrade, setEditAmountPerTrade] = useState('');
  const [editSL, setEditSL] = useState('');
  const [editTP, setEditTP] = useState('');
  const [editSlippage, setEditSlippage] = useState('');
  const [portfolioPeriod, setPortfolioPeriod] = useState<'1d' | '7d' | '30d' | '1y'>('1d');

  // Wallet creation/import is handled by /solana-setup page

  const loadWatchlist = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('watchlist_tokens');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        // Handle both old string format and new object format
        const normalizedList = list.map((item: any) => {
          if (typeof item === 'string') {
            // Convert old string format to object
            return {
              symbol: item.toUpperCase(),
              name: item,
              logo: '',
              price: 0,
              change24h: 0,
              contractAddress: '',
            };
          }
          return item;
        });
        setWatchlistTokens(normalizedList);
      } else {
        setWatchlistTokens([]);
      }
    } catch (e) {
      if (__DEV__) console.warn('Failed to load watchlist', e);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    await openPositionsQuery.refetch();
    await loadWatchlist();
    setRefreshing(false);
  }, [refetch, loadWatchlist]);

  useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  // Removed auto-hide header behavior on scroll

  // Calculate percentages for token allocation
  const getTokenPercentage = (value: number) => {
    return totalBalance > 0 ? (value / totalBalance) * 100 : 0;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[
        styles.header,
        {
          paddingHorizontal: responsivePadding
        }
      ]}>
        <View style={styles.profileContainer}>
          <Text style={styles.username}>@{user?.username || 'user'}</Text>
          <Pressable
            onPress={() => {
              if (!solanaPublicKey && !user?.walletAddress) {
                router.push('/solana-setup');
              }
            }}
          >
            <Text style={[
              styles.walletAddress,
              !(solanaPublicKey || user?.walletAddress) && { color: COLORS.solana }
            ]}>
              {(solanaPublicKey || user?.walletAddress)
                ? `${(solanaPublicKey || user?.walletAddress)!.slice(0, 6)}...${(solanaPublicKey || user?.walletAddress)!.slice(-4)}`
                : 'Connect wallet'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Settings size={24} color={COLORS.solana} />
        </Pressable>
      </View>

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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Settings now open in a dedicated screen; inline panel removed */}
          <QueueStatusBanner testID="queue-banner-portfolio" onRetry={() => refetch()} />

          {isInitialLoad && tokens.length === 0 ? <PortfolioSkeleton /> : (
            <>
              <NeonCard style={styles.portfolioCard}>
                <View style={styles.portfolioHeader}>
                  <View style={styles.portfolioTitleRow}>
                    <Text style={styles.portfolioTitle}>Portfolio Value</Text>
                    <Pressable
                      style={styles.periodButton}
                      onPress={() => {
                        const periods: ('1d' | '7d' | '30d' | '1y')[] = ['1d', '7d', '30d', '1y'];
                        const currentIndex = periods.indexOf(portfolioPeriod);
                        const nextIndex = (currentIndex + 1) % periods.length;
                        setPortfolioPeriod(periods[nextIndex]!);
                      }}
                    >
                      <Text style={styles.periodButtonText}>{portfolioPeriod.toUpperCase()}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.portfolioValue}>${totalBalance.toLocaleString()}</Text>
                  <View style={styles.pnlContainer}>
                    <Text style={[
                      styles.pnlValue,
                      { color: dailyPnl >= 0 ? COLORS.success : COLORS.error }
                    ]}>
                      {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toLocaleString()}
                    </Text>
                    <Text style={[
                      styles.pnlPercentage,
                      { color: dailyPnl >= 0 ? COLORS.success : COLORS.error }
                    ]}>
                      ({dailyPnl >= 0 ? '+' : ''}{totalBalance > dailyPnl ? ((dailyPnl / (totalBalance - dailyPnl) * 100) || 0).toFixed(2) : '0.00'}%)
                    </Text>
                  </View>
                </View>
              </NeonCard>

              <View style={styles.earningsContainer}>
                <View style={styles.earningCard}>
                  <Text style={styles.earningLabel}>Copy Trade</Text>
                  <Text style={styles.earningValue}>${((openPositionsQuery.data || []).reduce((sum: number, p: any) => sum + (p.currentValue || 0), 0)).toLocaleString()}</Text>
                </View>

                <View style={styles.earningCard}>
                  <Text style={styles.earningLabel}>Self</Text>
                  <Text style={styles.earningValue}>${(Math.max(0, totalBalance - ((openPositionsQuery.data || []).reduce((sum: number, p: any) => sum + (p.currentValue || 0), 0)))).toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.tabsContainer}>
                <Pressable
                  style={[
                    styles.tab,
                    activeTab === 'tokens' && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab('tokens')}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === 'tokens' && styles.activeTabText,
                  ]}>
                    Holdings
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.tab,
                    activeTab === 'copied' && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab('copied')}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === 'copied' && styles.activeTabText,
                  ]}>
                    Copied
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.tab,
                    activeTab === 'watchlist' && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab('watchlist')}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === 'watchlist' && styles.activeTabText,
                  ]}>
                    Watch List
                  </Text>
                </Pressable>


              </View>

              {activeTab === 'tokens' && (
                <View style={styles.tokensContainer}>
                  {tokens.map(token => (
                    <Pressable
                      key={token.id}
                      style={styles.tokenItem}
                      onPress={() => {
                        setSelectedToken(token);
                        setTradeMode(null);
                        setTradeAmount('');
                        setTradeError(undefined);
                      }}
                    >
                      <View style={styles.tokenRow}>
                        <View style={styles.tokenLogoContainer}>
                          {token.logo ? (
                            <Image source={{ uri: token.logo }} style={styles.tokenLogo} />
                          ) : (
                            <View style={styles.tokenLogoPlaceholder}>
                              <Text style={styles.tokenLogoText}>{token.symbol.charAt(0)}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.tokenInfo}>
                          <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                          <Text style={styles.tokenPrice}>
                            ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(2)}
                          </Text>
                          <Text style={[
                            styles.tokenChange,
                            { color: token.change24h >= 0 ? COLORS.success : COLORS.error }
                          ]}>
                            {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tokenValue}>
                        <Text style={styles.tokenValueText}>${token.value.toLocaleString()}</Text>
                        <Text style={styles.tokenPercentage}>
                          ({getTokenPercentage(token.value).toFixed(0)}%)
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {activeTab === 'copied' && (
                <View style={styles.walletsContainer}>
                  {copiedWallets.map(wallet => (
                    <NeonCard key={wallet.id} style={styles.walletCard}>
                      <View style={styles.walletHeader}>
                        <View style={styles.walletInfo}>
                          <Text style={styles.walletUsername}>@{wallet.username}</Text>
                          <Text style={styles.copiedWalletAddress}>{wallet.walletAddress}</Text>
                        </View>

                        <Pressable
                          style={styles.editButton}
                          onPress={() => {
                            setSelectedWallet(wallet);
                            setEditAmount(wallet.totalAmount?.toString() || '1000');
                            setEditAmountPerTrade(wallet.amountPerTrade?.toString() || '100');
                            setEditSL(wallet.stopLoss ? Math.abs(wallet.stopLoss).toString() : '10');
                            setEditTP(wallet.takeProfit?.toString() || '30');
                            setEditSlippage(wallet.slippage?.toString() || '1');
                          }}
                        >
                          <Text style={styles.editButtonText}>Edit</Text>
                        </Pressable>
                      </View>

                      <View style={styles.walletStats}>
                        <View style={styles.walletStat}>
                          <Text style={styles.walletStatLabel}>ROI</Text>
                          <Text style={[
                            styles.walletStatValue,
                            { color: wallet.roi >= 0 ? COLORS.success : COLORS.error }
                          ]}>
                            {wallet.roi >= 0 ? '+' : ''}{wallet.roi.toFixed(1)}%
                          </Text>
                        </View>

                        <View style={styles.walletStat}>
                          <Text style={styles.walletStatLabel}>PnL</Text>
                          <Text style={[
                            styles.walletStatValue,
                            { color: wallet.pnl >= 0 ? COLORS.success : COLORS.error }
                          ]}>
                            ${wallet.pnl.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </NeonCard>
                  ))}
                </View>
              )}

              {activeTab === 'watchlist' && (
                <View style={styles.tokensContainer}>
                  {watchlistTokens.length === 0 ? (
                    <View style={{ padding: SPACING.m }}>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 14 }}>
                        No watchlisted tokens yet. Tap the star on any coin.
                      </Text>
                    </View>
                  ) : (
                    watchlistTokens.map((watchToken) => (
                      <Pressable
                        key={watchToken.symbol}
                        style={styles.tokenItem}
                        onPress={() => {
                          // Navigate with full token data as params
                          router.push({
                            pathname: `/coin/${watchToken.symbol.toLowerCase()}`,
                            params: {
                              symbol: watchToken.symbol,
                              name: watchToken.name || watchToken.symbol,
                              logo: watchToken.logo || '',
                              price: String(watchToken.price || 0),
                              change: String(watchToken.change24h || 0),
                              contractAddress: watchToken.contractAddress || '',
                              banner: watchToken.banner || '',
                              marketCap: String(watchToken.marketCap || 0),
                              volume24h: String(watchToken.volume24h || 0),
                              liquidity: String(watchToken.liquidity || 0),
                            }
                          } as any);
                        }}
                      >
                        <View style={styles.tokenRow}>
                          <View style={styles.tokenLogoContainer}>
                            {watchToken.logo ? (
                              <Image source={{ uri: watchToken.logo }} style={styles.tokenLogo} />
                            ) : (
                              <View style={styles.tokenLogoPlaceholder}>
                                <Text style={styles.tokenLogoText}>{watchToken.symbol.charAt(0)}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.tokenInfo}>
                            <Text style={styles.tokenSymbol}>{watchToken.symbol}</Text>
                            <Text style={styles.tokenPrice}>
                              ${watchToken.price < 0.01 ? watchToken.price.toFixed(6) : watchToken.price.toFixed(2)}
                            </Text>
                            <Text style={[
                              styles.tokenChange,
                              { color: watchToken.change24h >= 0 ? COLORS.success : COLORS.error }
                            ]}>
                              {watchToken.change24h >= 0 ? '+' : ''}{watchToken.change24h.toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                        <View style={styles.tokenValue}>
                          <Text style={styles.tokenValueText}>
                            {watchToken.volume24h && watchToken.volume24h > 0
                              ? `Vol: $${watchToken.volume24h >= 1000000
                                ? (watchToken.volume24h / 1000000).toFixed(1) + 'M'
                                : watchToken.volume24h >= 1000
                                  ? (watchToken.volume24h / 1000).toFixed(1) + 'K'
                                  : watchToken.volume24h.toFixed(0)}`
                              : '—'}
                          </Text>
                          <Text style={styles.tokenPercentage}>24h</Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>PnL Chart</Text>

                  <View style={styles.chartControls}>
                    <View style={styles.periodSelector}>
                      {(['24h', '7d', '30d', 'all'] as ChartPeriod[]).map(period => (
                        <Pressable
                          key={period}
                          style={[
                            styles.periodOption,
                            chartPeriod === period && styles.activePeriodOption,
                          ]}
                          onPress={() => setChartPeriod(period)}
                        >
                          <Text style={[
                            styles.periodOptionText,
                            chartPeriod === period && styles.activePeriodOptionText,
                          ]}>
                            {period}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={styles.typeSelector}>
                      {(['line', 'candle'] as ChartType[]).map(type => (
                        <Pressable
                          key={type}
                          style={[
                            styles.typeOption,
                            chartType === type && styles.activeTypeOption,
                          ]}
                          onPress={() => setChartType(type)}
                        >
                          <Text style={[
                            styles.typeOptionText,
                            chartType === type && styles.activeTypeOptionText,
                          ]}>
                            {type === 'line' ? 'Line' : 'Candle'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.chartPlaceholder}>
                  <TrendingUp size={32} color={COLORS.textSecondary} />
                  <Text style={styles.chartPlaceholderText}>
                    Portfolio: ${totalBalance.toLocaleString()}
                  </Text>
                  <Text style={[
                    styles.chartPlaceholderSubtext,
                    { color: dailyPnl >= 0 ? COLORS.success : COLORS.error }
                  ]}>
                    {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toLocaleString()} ({chartPeriod})
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.activityButton}
                onPress={() => {
                  // Open Solscan for wallet activity
                  if (user?.walletAddress) {
                    const url = `https://solscan.io/account/${user.walletAddress}#txs`;
                    Linking.openURL(url);
                  } else {
                    Alert.alert('No Wallet', 'Connect a wallet to view activity');
                  }
                }}
              >
                <Text style={styles.activityButtonText}>Wallet Activity</Text>
                <ChevronRight size={20} color={COLORS.textPrimary} />
              </Pressable>
            </>
          )}
        </ScrollView>
      </ErrorBoundary>

      {/* Token Details Modal */}
      <Modal
        visible={selectedToken !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setSelectedToken(null); setTradeMode(null); setTradeAmount(''); setTradeError(undefined); }}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View
            style={[
              styles.modalContainer,
              {
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderRadius: BORDER_RADIUS.large,
                alignSelf: 'center',
                width: Math.min(width * 0.9, 560),
                maxHeight: '66%'
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedToken?.symbol} Details</Text>
              <Pressable onPress={() => { setSelectedToken(null); setTradeMode(null); setTradeAmount(''); setTradeError(undefined); }}>
                <X size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={true}>
              <View style={styles.tokenDetailsHeader}>
                <Text style={styles.tokenDetailsSymbol}>{selectedToken?.symbol}</Text>
                <Text style={styles.tokenDetailsName}>{selectedToken?.name}</Text>
                <Text style={styles.tokenDetailsPrice}>
                  ${selectedToken?.price && selectedToken.price < 0.01
                    ? selectedToken.price.toFixed(6)
                    : selectedToken?.price.toFixed(2)}
                </Text>
                <Text style={[
                  styles.tokenDetailsChange,
                  { color: (selectedToken?.change24h || 0) >= 0 ? COLORS.success : COLORS.error }
                ]}>
                  {(selectedToken?.change24h || 0) >= 0 ? '+' : ''}{selectedToken?.change24h.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.chartPlaceholder}>
                <TrendingUp size={48} color={COLORS.textSecondary} />
                <Text style={styles.chartPlaceholderText}>Price Chart</Text>
              </View>

              <View style={styles.tokenActions}>
                <Pressable
                  style={styles.tokenActionButton}
                  onPress={() => {
                    setTradeMode('buy');
                    setTradeAmount('');
                    setTradeError(undefined);
                  }}
                >
                  <ShoppingCart size={20} color={COLORS.success} />
                  <Text style={styles.tokenActionText}>Buy</Text>
                </Pressable>

                <Pressable
                  style={styles.tokenActionButton}
                  onPress={() => {
                    setTradeMode('sell');
                    setTradeAmount('');
                    setTradeError(undefined);
                  }}
                >
                  <DollarSign size={20} color={COLORS.error} />
                  <Text style={styles.tokenActionText}>Sell</Text>
                </Pressable>
              </View>

              {tradeMode && (
                <View style={styles.tradeContainer}>
                  <Text style={styles.tradeTitle}>
                    {tradeMode === 'buy' ? 'Buy' : 'Sell'} {selectedToken?.symbol}
                  </Text>
                  <NeonInput
                    label="Amount"
                    placeholder="0.00"
                    value={tradeAmount}
                    onChangeText={(text) => { setTradeAmount(text); setTradeError(undefined); }}
                    keyboardType="numeric"
                    error={tradeError || ''}
                  />
                  <View style={styles.tradeActions}>
                    <NeonButton
                      title="Cancel"
                      variant="outline"
                      onPress={() => { setTradeMode(null); setTradeAmount(''); setTradeError(undefined); }}
                      style={{ flex: 1 }}
                    />
                    <NeonButton
                      title={tradeMode === 'buy' ? 'Confirm Buy' : 'Confirm Sell'}
                      variant={tradeMode === 'buy' ? 'secondary' : 'danger'}
                      onPress={() => {
                        const value = parseFloat(tradeAmount);
                        if (!tradeAmount || isNaN(value) || value <= 0) {
                          setTradeError('Enter a valid amount');
                          return;
                        }
                        // Trade now done via Market tab WebView
                        setSelectedToken(null);
                        setTradeMode(null);
                        setTradeAmount('');

                        Alert.alert(
                          'Trade via Market Tab',
                          `To ${tradeMode === 'buy' ? 'buy' : 'sell'} ${selectedToken?.symbol || 'this token'}, go to Market tab and use DexScreener.`,
                          [
                            { text: 'Go to Market', onPress: () => router.push('/(tabs)/market') },
                            { text: 'Cancel', style: 'cancel' },
                          ]
                        );
                      }}
                      style={{ flex: 1, marginLeft: SPACING.m }}
                    />
                  </View>
                </View>
              )}

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Copied Wallet Modal */}
      <Modal
        visible={selectedWallet !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedWallet(null)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={[
            styles.modalContainer,
            {
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderRadius: BORDER_RADIUS.large,
              alignSelf: 'center',
              width: Math.min(width * 0.9, 560),
              maxHeight: '66%'
            }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Copy Trading</Text>
              <Pressable onPress={() => setSelectedWallet(null)}>
                <X size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={true}>
              <Text style={styles.editWalletTitle}>@{selectedWallet?.username}</Text>

              <NeonInput
                label="Total Amount (USDC)"
                placeholder="1000"
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
              />

              <NeonInput
                label="Amount per Trade (USDC)"
                placeholder="100"
                value={editAmountPerTrade}
                onChangeText={setEditAmountPerTrade}
                keyboardType="numeric"
              />

              <NeonInput
                label="Stop Loss (%)"
                placeholder="10"
                value={editSL}
                onChangeText={setEditSL}
                keyboardType="numeric"
              />

              <NeonInput
                label="Take Profit (%)"
                placeholder="30"
                value={editTP}
                onChangeText={setEditTP}
                keyboardType="numeric"
              />

              <NeonInput
                label="Slippage (%)"
                placeholder="1"
                value={editSlippage}
                onChangeText={setEditSlippage}
                keyboardType="numeric"
              />



              <View style={styles.editActions}>
                <NeonButton
                  title="Stop Copying"
                  onPress={() => {
                    setSelectedWallet(null);
                  }}
                  style={[styles.editActionButton, { backgroundColor: COLORS.error + '20' }]}
                />

                <NeonButton
                  title={isUpdatingCopyTrade ? "Saving..." : "Save Changes"}
                  disabled={isUpdatingCopyTrade}
                  onPress={async () => {
                    if (selectedWallet) {
                      const updates: Partial<CopiedWallet> = {};
                      const totalAmountVal = parseFloat(editAmount);
                      const amountPerTradeVal = parseFloat(editAmountPerTrade);
                      const stopLossVal = parseFloat(editSL);
                      const takeProfitVal = parseFloat(editTP);
                      const slippageVal = parseFloat(editSlippage);

                      if (!isNaN(totalAmountVal)) updates.totalAmount = totalAmountVal;
                      if (!isNaN(amountPerTradeVal)) updates.amountPerTrade = amountPerTradeVal;
                      if (!isNaN(stopLossVal)) updates.stopLoss = stopLossVal;
                      if (!isNaN(takeProfitVal)) updates.takeProfit = takeProfitVal;
                      if (!isNaN(slippageVal)) updates.slippage = slippageVal;

                      const success = await updateCopiedWallet(selectedWallet.id, updates, '');
                      if (success) {
                        Alert.alert('Success', 'Copy trade settings updated');
                        setSelectedWallet(null);
                      }
                    }
                  }}
                  style={[styles.editActionButton, isUpdatingCopyTrade && { opacity: 0.6 }]}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Wallet creation/import is handled by /solana-setup page */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.background,
    height: 60
  },
  profileContainer: {},
  username: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 16
  },
  walletAddress: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  portfolioTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
    minWidth: 50,
    justifyContent: 'center',
  },
  periodButtonText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 12,
    fontWeight: '700',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    minWidth: 60,
    zIndex: 1000
  },
  dropdownItem: {
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs
  },
  dropdownItemText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center'
  },
  walletSettingsCard: {
    marginBottom: SPACING.m,
    padding: SPACING.m
  },
  walletSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s
  },
  walletSettingsTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16
  },
  walletSettingsStatus: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  walletSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  walletSettingsLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  walletSettingsText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s
  },
  content: {
    flex: 1
  },
  contentContainer: {
    paddingBottom: 20
  },
  portfolioCard: {
    marginBottom: SPACING.m
  },
  portfolioHeader: {
    padding: SPACING.m
  },
  portfolioTitle: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 14
  },
  portfolioValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: SPACING.xs
  },
  pnlContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pnlValue: {
    ...FONTS.monospace,
    fontSize: 16,
    fontWeight: '700',
    marginRight: SPACING.xs
  },
  pnlPercentage: {
    ...FONTS.monospace,
    fontSize: 14
  },
  earningsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.s
  },
  earningCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginHorizontal: SPACING.xs
  },
  earningLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs
  },
  earningValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.xs,
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small
  },
  activeTab: {
    backgroundColor: COLORS.solana + '20'
  },
  tabText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textSecondary,
    fontSize: 14
  },
  activeTabText: {
    color: COLORS.solana
  },
  tokensContainer: {
    marginBottom: SPACING.xs
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.s
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  tokenLogoContainer: {
    marginRight: SPACING.s
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16
  },
  tokenLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.solana + '30',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tokenLogoText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 14
  },
  tokenInfo: {
    flex: 1
  },
  tokenSymbol: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.xs
  },
  tokenPrice: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs
  },
  tokenChange: {
    ...FONTS.monospace,
    fontSize: 14
  },
  tokenValue: {
    alignItems: 'flex-end'
  },
  tokenValueText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.xs
  },
  tokenPercentage: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  walletsContainer: {
    marginBottom: SPACING.xs
  },
  walletCard: {
    marginBottom: SPACING.s
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s
  },
  walletInfo: {
    flex: 1
  },
  walletUsername: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.xs
  },
  copiedWalletAddress: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  editButton: {
    backgroundColor: COLORS.solana + '20',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.small
  },
  editButtonText: {
    ...FONTS.orbitronMedium,
    color: COLORS.solana,
    fontSize: 12
  },
  walletStats: {
    flexDirection: 'row'
  },
  walletStat: {
    marginRight: SPACING.l
  },
  walletStatLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs
  },
  walletStatValue: {
    ...FONTS.monospace,
    fontSize: 16,
    fontWeight: '700'
  },
  chartContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l
  },
  chartHeader: {
    marginBottom: SPACING.xs
  },
  chartTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s
  },
  chartControls: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    padding: 2
  },
  periodOption: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.s,
    borderRadius: BORDER_RADIUS.small
  },
  activePeriodOption: {
    backgroundColor: COLORS.solana + '30'
  },
  periodOptionText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  activePeriodOptionText: {
    color: COLORS.solana
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    padding: 2
  },
  typeOption: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.s,
    borderRadius: BORDER_RADIUS.small
  },
  activeTypeOption: {
    backgroundColor: COLORS.solana + '30'
  },
  typeOptionText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  activeTypeOptionText: {
    color: COLORS.solana
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chartPlaceholderText: {
    ...FONTS.sfProMedium,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginTop: SPACING.s
  },
  chartPlaceholderSubtext: {
    ...FONTS.sfProRegular,
    fontSize: 14,
    marginTop: SPACING.xs
  },
  activityButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l
  },
  activityButtonText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.large,
    borderTopRightRadius: BORDER_RADIUS.large,
    paddingBottom: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground
  },
  modalTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18
  },
  modalContent: {
    padding: SPACING.l
  },
  modalScrollContent: {
    paddingBottom: SPACING.l
  },
  tokenDetailsHeader: {
    alignItems: 'center',
    marginBottom: SPACING.l
  },
  tokenDetailsSymbol: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 24,
    marginBottom: SPACING.xs
  },
  tokenDetailsName: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: SPACING.s
  },
  tokenDetailsPrice: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.xs
  },
  tokenDetailsChange: {
    ...FONTS.monospace,
    fontSize: 16,
    fontWeight: '700'
  },
  tokenActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.l
  },
  tokenActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: BORDER_RADIUS.medium,
    minWidth: 120,
    justifyContent: 'center'
  },
  tokenActionText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s
  },
  tradeContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginTop: SPACING.m,
  },
  tradeTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
    textAlign: 'center',
  },
  tradeActions: {
    flexDirection: 'row',
    marginTop: SPACING.s,
  },
  editWalletTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: SPACING.l
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.l
  },
  editActionButton: {
    flex: 1,
    marginHorizontal: SPACING.xs
  },

  // Wallet Connection Modal Styles
  walletChoiceContainer: {
    gap: SPACING.m
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  walletOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m
  },
  walletOptionContent: {
    flex: 1
  },
  walletOptionTitle: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.xs
  },
  walletOptionDescription: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20
  },
  importContainer: {
    gap: SPACING.m
  },
  importTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textAlign: 'center'
  },
  importDescription: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  importInput: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    color: COLORS.textPrimary,
    ...FONTS.monospace,
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  importActions: {
    flexDirection: 'row',
    gap: SPACING.m
  },
  importButton: {
    flex: 1,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    alignItems: 'center'
  },
  backButton: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '30'
  },
  backButtonText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textSecondary,
    fontSize: 14
  },
  importConfirmButton: {
    backgroundColor: COLORS.solana
  },
  importConfirmButtonText: {
    ...FONTS.orbitronMedium,
    color: COLORS.background,
    fontSize: 14
  },
  createContainer: {
    gap: SPACING.m
  },
  createTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textAlign: 'center'
  },
  createDescription: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  mnemonicContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
    marginBottom: SPACING.m
  },
  mnemonicWord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    padding: SPACING.s,
    minWidth: '30%',
    flex: 1
  },
  mnemonicNumber: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginRight: SPACING.xs,
    minWidth: 20
  },
  mnemonicText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
    flex: 1
  },
  showMnemonicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.s,
    marginBottom: SPACING.s
  },
  showMnemonicText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: SPACING.xs
  },
  copyMnemonicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.small,
    paddingVertical: SPACING.s
  },
  copyMnemonicText: {
    ...FONTS.orbitronMedium,
    color: COLORS.solana,
    fontSize: 14,
    marginLeft: SPACING.xs
  },
  confirmationContainer: {
    marginVertical: SPACING.m
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    marginRight: SPACING.s,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxChecked: {
    backgroundColor: COLORS.solana,
    borderColor: COLORS.solana
  },
  checkmark: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: 'bold' as const
  },
  checkboxText: {
    ...FONTS.sfProRegular,
    color: COLORS.textPrimary,
    fontSize: 14,
    flex: 1
  },
  createActions: {
    flexDirection: 'row',
    gap: SPACING.m
  },
  createButton: {
    flex: 1,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    alignItems: 'center'
  },
  createConfirmButton: {
    backgroundColor: COLORS.solana
  },
  createConfirmButtonDisabled: {
    backgroundColor: COLORS.textSecondary + '30'
  },
  createConfirmButtonText: {
    ...FONTS.orbitronMedium,
    color: COLORS.background,
    fontSize: 14
  },
  createConfirmButtonTextDisabled: {
    color: COLORS.textSecondary
  }
});

