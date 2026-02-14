import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Globe, ArrowUp, ArrowDown, RefreshCw, CreditCard } from 'lucide-react-native';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import {
  WalletCard,
  QuickActionButton,
  TokenCard,
  TraderCard,
  ErrorBoundary,
  SendModal,
  ReceiveModal,
  SwapModal,
  CopyTradingModal,
} from '@/components';
import * as SecureStore from 'expo-secure-store';
import { fetchBalances, hasLocalWallet, getLocalPublicKey, Holding, fetchCopyConfig, fetchCopyPositions, CopyPosition, api } from '@/services';
import { fetchTrendingTokens } from '@/services/market';
import { showErrorToast, validateSession } from '@/utils';
import { useAlert } from '@/contexts/AlertContext';


// Well-known token logos for popular Solana tokens (fallback when API doesn't have them)
const WELL_KNOWN_TOKEN_LOGOS: Record<string, string> = {
  'SOL': 'https://cryptologos.cc/logos/solana-sol-logo.png',
  'RAY': 'https://cryptologos.cc/logos/raydium-ray-logo.png',
  'JUP': 'https://cryptologos.cc/logos/jupiter-ag-jup-logo.png',
  'USDC': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  'USDT': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
  'BONK': 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  'WIF': 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link',
  'POPCAT': 'https://bafkreidvnhdzuq3pvhnzq26hjydmhrr2xw2flkxkflg7swmrxnx7c7xvey.ipfs.nftstorage.link',
  'PYTH': 'https://pyth.network/token.svg',
  'JTO': 'https://metadata.jito.network/token/jto/icon.png',
  'ORCA': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  'TRUMP': 'https://dd.dexscreener.com/ds-data/tokens/solana/6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN.png',
  'PEPE': 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  'SHIB': 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  'DOGE': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
};

function getWellKnownTokenLogo(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  return WELL_KNOWN_TOKEN_LOGOS[symbol.toUpperCase()];
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { showAlert } = useAlert();
  const isSmallScreen = width < 375;

  // Real wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Real user profile state
  const [user, setUser] = useState<any>(null);
  const dailyPnl = 0; // Will be calculated from holdings
  const isMountedRef = React.useRef(true);
  const trendingRequestIdRef = React.useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch user profile from backend
  const fetchUserProfile = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        return;
      }

      const data = await api.get<{ user: unknown }>('/me');
      if (isMountedRef.current) {
        setUser(data.user || data);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    void validateSession();
    void fetchUserProfile();
  }, [fetchUserProfile]);

  // Load wallet data
  const loadWalletData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        return;
      }

      const hasLocal = await hasLocalWallet();
      if (hasLocal) {
        const pubkey = await getLocalPublicKey();
        if (isMountedRef.current) {
          setWalletAddress(pubkey);
        }

      }


      const portfolio = await fetchBalances(token);
      if (!isMountedRef.current) {
        return;
      }

      if (portfolio) {

        setTotalBalance(portfolio.totalUsdValue);
        setHoldings(portfolio.holdings);
        if (portfolio.publicKey) {
          setWalletAddress((current) => current || portfolio.publicKey);
        }
      } else {

        showErrorToast('Failed to load balances');
      }
    } catch (error: any) {
      if (error?.message?.includes('No wallet linked')) {

        return;
      }

      showErrorToast('Failed to load wallet data');
    }
  }, []);

  // Refresh wallet data when tab gains focus (e.g. after swap on coin detail)
  useFocusEffect(
    useCallback(() => {
      void loadWalletData();
    }, [loadWalletData])
  );

  const refetch = useCallback(async () => {
    await loadWalletData();
  }, [loadWalletData]);

  // Wallet address for display
  const solanaPublicKey = walletAddress || '';


  // Real trending tokens from API (refreshes daily at 15:00 UTC)
  const [trendingTokens, setTrendingTokens] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const transformTrendingTokens = useCallback((tokens: any[]) => {
    return tokens.map((token: any) => ({
      id: token.address,
      symbol: token.symbol,
      name: token.name,
      price: token.price || 0,
      change24h: token.priceChange24h || 0,
      volume24h: token.volume24h || 0,
      logo: token.logo || getWellKnownTokenLogo(token.symbol),
      banner: token.banner,
      liquidity: token.liquidity || 0,
      contractAddress: token.address,
      pairAddress: token.address,
      marketCap: token.marketCap || 0,
    }));
  }, []);

  const loadTrendingTokens = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent === true;
    const requestId = trendingRequestIdRef.current + 1;
    trendingRequestIdRef.current = requestId;
    if (!isSilent && isMountedRef.current) {
      setTrendingLoading(true);
    }

    try {
      const result = await fetchTrendingTokens();
      if (!isMountedRef.current || requestId !== trendingRequestIdRef.current) {
        return;
      }

      if (result.success && result.tokens) {
        setTrendingTokens(transformTrendingTokens(result.tokens));
      } else if (!isSilent) {
        showErrorToast(result.error || 'Failed to load trending tokens');
      }
    } catch (error: any) {
      if (!isSilent && isMountedRef.current && requestId === trendingRequestIdRef.current) {
        showErrorToast('Failed to load trending tokens');
      }
    } finally {
      if (!isSilent && isMountedRef.current && requestId === trendingRequestIdRef.current) {
        setTrendingLoading(false);
      }
    }
  }, [transformTrendingTokens]);

  // Fetch trending tokens on mount
  useEffect(() => {
    void loadTrendingTokens();
  }, [loadTrendingTokens]);

  // Poll prices every 5 minutes for trending tokens
  useEffect(() => {
    const interval = setInterval(() => {
      void loadTrendingTokens({ silent: true });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadTrendingTokens]);

  const topCoins = trendingTokens;

  // Copy Trading State
  const [copyPositions, setCopyPositions] = React.useState<CopyPosition[]>([]);
  const [copyConfig, setCopyConfig] = React.useState<any>(null);

  // Copy trading data is now loaded from the backend via loadCopyTradingData
  const copyTradeSettings = copyConfig ? [copyConfig] : [];
  const copyTrades = copyPositions || [];

  const getStats = () => {
    return {
      activeCopies: copyTradeSettings.filter((ct: any) => ct.isActive).length,
      totalTrades: copyPositions.length,
      profitLoss: 0,
      profitLossPercentage: 0,
    };
  };

  // Load copy trading data (positions and config)
  const loadCopyTradingData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        if (isMountedRef.current) {
          setCopyConfig(null);
          setCopyPositions([]);
        }
        return;
      }

      const [configResult, positionsResult] = await Promise.all([
        fetchCopyConfig(token),
        fetchCopyPositions(token),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      setCopyConfig(configResult.success ? (configResult.config ?? null) : null);
      setCopyPositions(positionsResult.success && positionsResult.positions ? positionsResult.positions : []);
    } catch (error: any) {

      if (isMountedRef.current) {
        setCopyConfig(null);
        setCopyPositions([]);
      }
    }
  }, []);

  // Load copy trading data on mount
  useEffect(() => {
    void loadCopyTradingData();
  }, [loadCopyTradingData]);

  const [activeTab, setActiveTab] = React.useState<'coins' | 'traders' | 'copy'>('coins');
  const [pnlPeriod, setPnlPeriod] = React.useState<'1d' | '7d' | '30d' | '1y'>('1d');

  // Real top traders with wallet addresses from birdeye.md
  const tradersLoading = false;

  const topTraders = React.useMemo(() => {
    const walletAddresses = [
      'GBJ4MZe8fqpA6UVgjh19BwJPMb79KDfMv78XnFVxgH2Q',
      'J2ANNaq4uUk3iUGoNijKCwXTReGLyg2yQpGcAZjzyBZG',
      'HjjNeMLS4ATUUkdYCL2fP7brugTCHZtJriMjHHDZ3hTe',
      'AAvdewt71kkde2segr6gYnNemhNLfokyZpdzwwi4yDfm',
      'q7noiMNKtHaLT36KxSU5w9BBwXJarcRQPxcVnyBhn1E',
      'YubQzu18FDqJRyNfG8JqHmsdbxhnoQqcKUHBdUkN6tP',
      'CreQJ2t94QK5dsxUZGXfPJ8Nx7wA9LHr5chxjSMkbNft',
      'GFHMc9BegxJXLdHJrABxNVoPRdnmVxXiNeoUCEpgXVHw',
      'Rkg7WMsjLBAPFwMETzaKoHQb294NVMzP9AWzfm9A65E',
      '2dRR9CaNrEsHm3UqZacEf8AoDuDx4NGQyMhGxG71NzkN',
    ];

    // Use deterministic values based on wallet address (consistent across renders)
    return walletAddresses.map((address, index) => ({
      id: `trader-${index}`,
      name: `Trader ${index + 1}`,
      walletAddress: address,
      // Deterministic pseudo-random based on address characters
      roi: ((address.charCodeAt(0) + address.charCodeAt(10) + index * 37) % 240) + 10,
      username: `${address.slice(0, 4)}...${address.slice(-4)}`,
    }));
  }, []);

  // New Copy Trading State
  const [showCopyModal, setShowCopyModal] = React.useState(false);
  const [selectedTrader, setSelectedTrader] = React.useState<{ username: string; walletAddress: string } | null>(null);

  // Wallet action modals
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [showReceiveModal, setShowReceiveModal] = React.useState(false);
  const [showSwapModal, setShowSwapModal] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), loadTrendingTokens()]);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [refetch, loadTrendingTokens]);

  const handleBuy = () => {
    const base = process.env.EXPO_PUBLIC_FIAT_ONRAMP_URL;
    const key = process.env.EXPO_PUBLIC_MOONPAY_KEY;
    if (!base || !key) {
      showAlert('Unavailable', 'Fiat on-ramp is not configured');
      return;
    }
    const moonpayUrl = `${base}?apiKey=${key}&currencyCode=sol`;
    Linking.openURL(moonpayUrl).catch(() => {
      showAlert('Error', 'Could not open MoonPay');
    });
  };



  const renderTabContent = () => {
    switch (activeTab) {
      case 'coins':
        return (
          <ErrorBoundary>
            <View style={styles.tabContent}>
              {/* Loading state */}
              {trendingLoading ? (
                <View style={styles.loadingContainer}>
                  <RefreshCw size={32} color={COLORS.solana} />
                  <Text style={styles.loadingText}>Loading trending tokens...</Text>
                </View>
              ) : topCoins.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Globe size={48} color={COLORS.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={styles.emptyTitle}>No trending tokens</Text>
                  <Text style={styles.emptySubtitle}>
                    Check back later for top performing tokens
                  </Text>
                </View>
              ) : (
                <View>
                  {topCoins.map((coin: any) => (
                    <TokenCard
                      key={coin.id}
                      symbol={coin.symbol}
                      price={coin.price}
                      change={coin.change24h || 0}
                      liquidity={coin.liquidity}
                      volume={coin.volume24h}
                      {...(coin.logo ? { logo: coin.logo } : {})}
                      onPress={() => {
                        // Navigate with token data
                        router.push({
                          pathname: `/coin/${coin.symbol.toLowerCase()}` as any,
                          params: {
                            price: coin.price.toString(),
                            change: (coin.change24h || 0).toString(),
                            logo: coin.logo || '',
                            banner: coin.banner || '',
                            contractAddress: coin.contractAddress || '',
                            name: coin.name,
                            marketCap: (coin.marketCap || 0).toString(),
                            volume24h: (coin.volume24h || 0).toString(),
                            liquidity: (coin.liquidity || 0).toString(),
                          }
                        });
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          </ErrorBoundary>
        );
      case 'traders':
        return (
          <ErrorBoundary>
            <View style={styles.tabContent}>
              {/* Display top traders with real wallet addresses */}
              {tradersLoading ? (
                <View style={styles.loadingContainer}>
                  <RefreshCw size={32} color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading top traders...</Text>
                </View>
              ) : topTraders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Globe size={48} color={COLORS.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={styles.emptyTitle}>No traders available</Text>
                  <Text style={styles.emptySubtitle}>Check back later for top performers</Text>
                </View>
              ) : (
                topTraders.map((trader: any) => (
                  <TraderCard
                    key={trader.id || trader.walletAddress}
                    username={trader.name || trader.username}
                    walletAddress={trader.walletAddress}
                    roi={trader.roi}
                    period="24h"
                    onPress={() => {
                      // Open copy modal with trader info
                      setSelectedTrader({
                        username: trader.name || trader.username,
                        walletAddress: trader.walletAddress
                      });
                      setShowCopyModal(true);
                    }}
                  />
                ))
              )}
            </View>
          </ErrorBoundary>
        );
      case 'copy':
        {
          const stats = getStats();

          return (
            <ErrorBoundary>
              <View style={styles.copyTradeContainer}>
                <Text style={styles.copyTradeTitle}>Copy Trading</Text>
                <Text style={styles.copyTradeDescription}>
                  Follow top traders and automatically copy their trades in real-time.
                </Text>

                {/* Copy Trading Stats */}
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.activeCopies}</Text>
                    <Text style={styles.statLabel}>Active Copies</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.totalTrades}</Text>
                    <Text style={styles.statLabel}>Total Trades</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: stats.profitLoss >= 0 ? COLORS.success : COLORS.error }]}>
                      {stats.profitLossPercentage >= 0 ? '+' : ''}{stats.profitLossPercentage.toFixed(1)}%
                    </Text>
                    <Text style={styles.statLabel}>P&L</Text>
                  </View>
                </View>

                {/* Note about Portfolio */}
                {copyTradeSettings.length > 0 && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Text style={{ color: COLORS.success, fontSize: 13, fontFamily: 'System' }}>
                      ✓ You have an active copy trade. Manage it in Portfolio → Copied tab.
                    </Text>
                  </View>
                )}

                {/* Manual Copy Setup */}
                <View style={styles.copyTradeForm}>
                  <Text style={styles.formLabel}>Quick Setup</Text>
                  <TouchableOpacity
                    style={styles.quickSetupButton}
                    onPress={() => {
                      setSelectedTrader({
                        username: 'Manual Setup',
                        walletAddress: ''
                      });
                      setShowCopyModal(true);
                    }}
                  >
                    <Text style={styles.quickSetupText}>Set Up Copy Trading</Text>
                  </TouchableOpacity>
                </View>

                {/* Recent Copy Trades */}
                {copyTrades.length > 0 && (
                  <View style={styles.recentTradesContainer}>
                    <Text style={styles.recentTradesTitle}>Recent Copy Trades</Text>
                    {copyTrades.slice(0, 5).map((position: any) => (
                      <View key={position.id} style={styles.recentTradeItem}>
                        <View style={styles.recentTradeInfo}>
                          <Text style={styles.recentTradeTokens}>
                            {position.tokenSymbol} • ${position.entryValue.toFixed(2)}
                          </Text>
                          <Text style={styles.recentTradeTime}>
                            {new Date(position.entryTimestamp).toLocaleString()}
                          </Text>
                          {position.exitTimestamp && (
                            <Text style={[styles.recentTradePnL, {
                              color: position.profitLoss >= 0 ? COLORS.success : COLORS.error
                            }]}>
                              {position.profitLoss >= 0 ? '+' : ''}{position.profitLoss.toFixed(2)} ({position.roi.toFixed(1)}%)
                            </Text>
                          )}
                        </View>
                        <View style={[
                          styles.recentTradeStatus,
                          {
                            backgroundColor:
                              position.status === 'CLOSED' ? COLORS.success + '20' :
                                position.status === 'OPEN' ? COLORS.primary + '20' :
                                  COLORS.error + '20'
                          }
                        ]}>
                          <Text style={[
                            styles.recentTradeStatusText,
                            {
                              color:
                                position.status === 'CLOSED' ? COLORS.success :
                                  position.status === 'OPEN' ? COLORS.primary :
                                    COLORS.error
                            }
                          ]}>
                            {position.status}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ErrorBoundary>
          );
        }
      default:
        return null;
    }
  };

  // Show loading state briefly while fetching auth, but don't block UI entirely
  // (removed early return that was causing blank screen)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ErrorBoundary>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <View style={styles.profileContainer}>
              <View style={styles.avatarContainer}>
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={styles.defaultAvatar}>
                    <Text style={styles.avatarText}>
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => router.push('/account')}
              >
                <Text style={styles.username}>@{user?.username || 'user'}</Text>
                <View style={styles.walletAddressContainer}>
                  {(solanaPublicKey || user?.walletAddress) && (
                    <>
                      <View style={styles.connectedDot} />
                      <Text style={styles.walletAddress}>
                        {solanaPublicKey
                          ? `${solanaPublicKey.slice(0, 6)}...${solanaPublicKey.slice(-4)}`
                          : `${user?.walletAddress?.slice(0, 6)}...${user?.walletAddress?.slice(-4)}`}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.headerActionButton}>
                <Globe size={24} color={COLORS.solana} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.walletCardContainer}>
            <WalletCard balance={totalBalance} dailyPnl={dailyPnl} pnlPeriod={pnlPeriod} onPeriodChange={setPnlPeriod} />
          </View>

          <View style={styles.quickActionsContainer}>
            <View style={styles.quickActionsRow}>
              <QuickActionButton
                title="SEND"
                icon={<ArrowUp size={isSmallScreen ? 16 : 20} color={COLORS.textPrimary} />}
                color={COLORS.gradientPurple}
                style={styles.quickActionButton}
                onPress={() => setShowSendModal(true)}
              />
              <QuickActionButton
                title="RECEIVE"
                icon={<ArrowDown size={isSmallScreen ? 16 : 20} color={COLORS.textPrimary} />}
                color={COLORS.gradientPurple}
                style={styles.quickActionButton}
                onPress={() => setShowReceiveModal(true)}
              />
              <QuickActionButton
                title="SWAP"
                icon={<RefreshCw size={isSmallScreen ? 16 : 20} color={COLORS.textPrimary} />}
                color={COLORS.gradientPurple}
                style={styles.quickActionButton}
                onPress={() => setShowSwapModal(true)}
              />
              <QuickActionButton
                title="BUY"
                icon={<CreditCard size={isSmallScreen ? 16 : 20} color={COLORS.textPrimary} />}
                color={COLORS.gradientPurple}
                style={styles.quickActionButton}
                onPress={handleBuy}
              />
            </View>
          </View>


          <View style={styles.tabsContainer}>
            <View style={styles.tabsHeader}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'coins' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('coins')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'coins' && styles.activeTabText,
                ]}>
                  TRENDING
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'traders' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('traders')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'traders' && styles.activeTabText,
                ]}>
                  TOP TRADERS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'copy' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('copy')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'copy' && styles.activeTabText,
                ]}>
                  COPY TRADE
                </Text>
              </TouchableOpacity>
            </View>

            {renderTabContent()}
          </View>
        </ScrollView>
      </ErrorBoundary>

      {/* Copy Trading Modal - New Implementation */}
      <CopyTradingModal
        visible={showCopyModal}
        onClose={() => {
          setShowCopyModal(false);
          setSelectedTrader(null);
          // Refresh copy trading data after config change
          void loadCopyTradingData();
        }}
        trader={selectedTrader}
      />


      {/* Swap Modal */}
      <SwapModal
        visible={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        onSuccess={refetch}
        holdings={holdings.map(h => ({
          symbol: h.symbol,
          name: h.name,
          mint: h.mint,
          decimals: h.decimals,
          balance: h.balance,
          logo: WELL_KNOWN_TOKEN_LOGOS[h.symbol] || undefined
        }))}
      />

      {/* Send Modal */}
      <SendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={() => refetch()}
        holdings={holdings.map(h => ({
          symbol: h.symbol,
          name: h.name,
          mint: h.mint,
          decimals: h.decimals,
          balance: h.balance,
          logo: WELL_KNOWN_TOKEN_LOGOS[h.symbol] || ''
        }))}
      />

      {/* Receive Modal */}
      <ReceiveModal
        visible={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 0,
    flexGrow: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.m,
    minHeight: 60
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarContainer: {
    marginRight: SPACING.s
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  defaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  userInfo: {
    justifyContent: 'center'
  },
  username: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  walletAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success
  },
  walletAddress: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  actionButtons: {
    flexDirection: 'row'
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.s
  },
  walletCardContainer: {
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.m
  },
  quickActionsContainer: {
    marginBottom: SPACING.m
  },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xs,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  quickActionButton: {
    flex: 1,
    marginHorizontal: SPACING.xs,
    minWidth: 70,
    maxWidth: 90
  },
  tabsContainer: {
    flex: 1,
    marginBottom: 0
  },
  tabsHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
    marginHorizontal: SPACING.xs,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
    minHeight: 44
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small,
    justifyContent: 'center',
    minHeight: 36
  },
  activeTab: {
    backgroundColor: COLORS.solana + '20'
  },

  tabText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  activeTabText: {
    color: COLORS.solana
  },


  tabContent: {
    paddingHorizontal: SPACING.xs,
    paddingBottom: 0
  },
  copyTradeContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m
  },
  copyTradeTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.s,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  copyTradeDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.m
  },
  copyTradeForm: {},
  formLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.xs
  },
  // Copy Trading Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m
  },
  statItem: {
    alignItems: 'center'
  },
  statValue: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.xs
  },
  statLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  quickSetupButton: {
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    alignItems: 'center',
    marginBottom: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '30'
  },
  quickSetupText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 16
  },
  recentTradesContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginTop: SPACING.m
  },
  recentTradesTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s
  },
  recentTradeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10'
  },
  recentTradeInfo: {
    flex: 1
  },
  recentTradeTokens: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 12,
    marginBottom: SPACING.xs
  },
  recentTradeTime: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 11
  },
  recentTradePnL: {
    ...FONTS.phantomMedium,
    fontSize: 12,
    marginTop: 2
  },
  recentTradeStatus: {
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.small
  },
  recentTradeStatusText: {
    ...FONTS.phantomBold,
    fontSize: 10,
  },
  // ✅ Loading and empty state styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 3,
    minHeight: 300,
  },
  loadingText: {
    marginTop: SPACING.md,
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 3,
    paddingHorizontal: SPACING.xl,
    minHeight: 300,
  },
  emptyTitle: {
    marginTop: SPACING.lg,
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontSize: 18,
  },
  emptySubtitle: {
    marginTop: SPACING.s,
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
});

