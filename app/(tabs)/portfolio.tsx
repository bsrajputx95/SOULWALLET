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
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, ChevronRight, X, TrendingUp, ShoppingCart, DollarSign, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { NeonCard } from '../../components/NeonCard';
import { NeonButton } from '../../components/NeonButton';
import { NeonInput } from '../../components/NeonInput';
import { useAuth } from '../../hooks/auth-store';
import { useSolanaWallet } from '../../hooks/solana-wallet-store';
import type { Token, CopiedWallet } from '../../hooks/wallet-store';
import { useWallet } from '../../hooks/wallet-store';
import { trpc } from '../../lib/trpc';

type PortfolioTab = 'tokens' | 'copied' | 'watchlist';
type ChartPeriod = '24h' | '7d' | '30d' | 'all';
type ChartType = 'line' | 'candle';

export default function PortfolioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { publicKey: solanaPublicKey } = useSolanaWallet();
  const { tokens, copiedWallets, totalBalance, dailyPnl, refetch, updateCopiedWallet } = useWallet();
  const openPositionsQuery = trpc.copyTrading.getOpenPositions.useQuery({}, { refetchInterval: 30000 });

  // Fetch trending tokens for watchlist price data
  const { data: trendingData } = trpc.market.trending.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Responsive padding logic like Home screen
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PortfolioTab>('tokens');
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
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
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Wallet creation/import is handled by /solana-setup page

  // Header height for content offset
  const HEADER_HEIGHT = 60;

  const loadWatchlist = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('watchlist_tokens');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        setWatchlistSymbols(list.map((s: string) => s.toUpperCase()));
      } else {
        setWatchlistSymbols([]);
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
    loadWatchlist();
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
                      setEditAmount('1000');
                      setEditAmountPerTrade('100');
                      setEditSL('10');
                      setEditTP('30');
                      setEditSlippage('1');
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
            {watchlistSymbols.length === 0 ? (
              <View style={{ padding: SPACING.m }}>
                <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 14 }}>
                  No watchlisted tokens yet. Tap the star on any coin.
                </Text>
              </View>
            ) : (
              watchlistSymbols.map((symbol) => {
                // First check user's wallet tokens
                let token = tokens.find(t => t.symbol.toUpperCase() === symbol);

                // If not in wallet, check trending market data
                let marketToken: { symbol: string; name: string; price: number; change24h: number; logo?: string; volume24h?: number; } | null = null;
                if (!token && trendingData?.pairs) {
                  const pair = trendingData.pairs.find(
                    (p: any) => p.baseToken?.symbol?.toUpperCase() === symbol
                  );
                  if (pair) {
                    marketToken = {
                      symbol: pair.baseToken?.symbol || symbol,
                      name: pair.baseToken?.name || symbol,
                      price: parseFloat(pair.priceUsd || '0'),
                      change24h: parseFloat(pair.priceChange?.h24 || '0'),
                      logo: pair.info?.imageUrl,
                      volume24h: parseFloat(pair.volume?.h24 || '0'),
                    };
                  }
                }

                // If neither wallet nor market data available, show placeholder
                if (!token && !marketToken) {
                  return (
                    <Pressable
                      key={symbol}
                      style={styles.tokenItem}
                      onPress={() => router.push(`/coin/${symbol.toLowerCase()}`)}
                    >
                      <View style={styles.tokenRow}>
                        <View style={styles.tokenLogoContainer}>
                          <View style={styles.tokenLogoPlaceholder}>
                            <Text style={styles.tokenLogoText}>{symbol.charAt(0)}</Text>
                          </View>
                        </View>
                        <View style={styles.tokenInfo}>
                          <Text style={styles.tokenSymbol}>{symbol}</Text>
                          <Text style={styles.tokenPrice}>Loading...</Text>
                          <Text style={[styles.tokenChange, { color: COLORS.textSecondary }]}>—</Text>
                        </View>
                      </View>
                      <View style={styles.tokenValue}>
                        <Text style={styles.tokenValueText}>—</Text>
                        <Text style={styles.tokenPercentage}>(—)</Text>
                      </View>
                    </Pressable>
                  );
                }

                // Use wallet token or market token data
                const displayToken = token || marketToken;
                return (
                  <Pressable
                    key={displayToken.symbol}
                    style={styles.tokenItem}
                    onPress={() => router.push(`/coin/${displayToken.symbol.toLowerCase()}`)}
                  >
                    <View style={styles.tokenRow}>
                      <View style={styles.tokenLogoContainer}>
                        {displayToken.logo ? (
                          <Image source={{ uri: displayToken.logo }} style={styles.tokenLogo} />
                        ) : (
                          <View style={styles.tokenLogoPlaceholder}>
                            <Text style={styles.tokenLogoText}>{displayToken.symbol.charAt(0)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.tokenInfo}>
                        <Text style={styles.tokenSymbol}>{displayToken.symbol}</Text>
                        <Text style={styles.tokenPrice}>
                          ${displayToken.price < 0.01 ? displayToken.price.toFixed(6) : displayToken.price.toFixed(2)}
                        </Text>
                        <Text style={[
                          styles.tokenChange,
                          { color: displayToken.change24h >= 0 ? COLORS.success : COLORS.error }
                        ]}>
                          {displayToken.change24h >= 0 ? '+' : ''}{displayToken.change24h.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tokenValue}>
                      <Text style={styles.tokenValueText}>
                        {token && 'value' in token
                          ? `$${token.value.toLocaleString()}`
                          : marketToken?.volume24h
                            ? `Vol: $${(marketToken.volume24h >= 1000000 ? (marketToken.volume24h / 1000000).toFixed(1) + 'M' : marketToken.volume24h >= 1000 ? (marketToken.volume24h / 1000).toFixed(1) + 'K' : marketToken.volume24h.toFixed(0))}`
                            : '—'}
                      </Text>
                      <Text style={styles.tokenPercentage}>
                        {token && 'value' in token ? `(${getTokenPercentage(token.value).toFixed(0)}%)` : '24h'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
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
              import('react-native').then(({ Linking }) => Linking.openURL(url));
            } else {
              Alert.alert('No Wallet', 'Connect a wallet to view activity');
            }
          }}
        >
          <Text style={styles.activityButtonText}>Wallet Activity</Text>
          <ChevronRight size={20} color={COLORS.textPrimary} />
        </Pressable>
      </ScrollView>

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
                        // Navigate to swap screen with token pre-selected
                        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
                        const tokenMint = selectedToken?.id || '';

                        setSelectedToken(null);
                        setTradeMode(null);
                        setTradeAmount('');

                        router.push({
                          pathname: '/swap',
                          params: {
                            inputMint: tradeMode === 'buy' ? usdcMint : tokenMint,
                            outputMint: tradeMode === 'buy' ? tokenMint : usdcMint,
                            amount: tradeAmount,
                          },
                        });
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
                    if (__DEV__) console.log('Stop copying:', selectedWallet?.username);
                    setSelectedWallet(null);
                  }}
                  style={[styles.editActionButton, { backgroundColor: COLORS.error + '20' }]}
                />

                <NeonButton
                  title="Save Changes"
                  onPress={() => {
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

                      updateCopiedWallet(selectedWallet.id, updates);
                    }
                    setSelectedWallet(null);
                  }}
                  style={styles.editActionButton}
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
    marginBottom: SPACING.m,
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
    marginBottom: SPACING.l
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
    marginBottom: SPACING.l
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
    marginBottom: SPACING.m
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
