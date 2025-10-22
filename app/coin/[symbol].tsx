import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft,
  Star,
  Copy,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
} from 'lucide-react-native';
import { COLORS } from '../../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../../constants/theme';
import { NeonCard } from '../../components/NeonCard';
import { NeonButton } from '../../components/NeonButton';
import { GlowingText } from '../../components/GlowingText';



interface CoinData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  contractAddress: string;
  verified: boolean;
  age: string;
  logo?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
  wallet: string;
  txHash: string;
}

interface TopTrader {
  id: string;
  wallet: string;
  username?: string;
  pnl: number;
  winRate: number;
  trades: number;
  avatar?: string;
}

export default function CoinDetailsScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  if (__DEV__) console.log('CoinDetailsScreen - symbol param:', symbol);
  const [coinData, setCoinData] = useState<CoinData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [activeTab, setActiveTab] = useState<'chart' | 'trades' | 'holders'>('chart');
  const [refreshing, setRefreshing] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);

  const loadCoinData = useCallback(async () => {
    // Mock data - replace with actual API calls
    const mockCoinData: CoinData = {
      symbol: symbol?.toUpperCase() || 'SOL',
      name: getTokenName(symbol?.toUpperCase() || 'SOL'),
      price: Math.random() * 1000,
      change24h: (Math.random() - 0.5) * 20,
      marketCap: Math.random() * 1000000000,
      volume24h: Math.random() * 100000000,
      liquidity: Math.random() * 50000000,
      holders: Math.floor(Math.random() * 100000),
      contractAddress: generateMockAddress(),
      verified: Math.random() > 0.3,
      age: `${Math.floor(Math.random() * 365)}d`,
      description: `${symbol?.toUpperCase()} is a revolutionary token built on Solana blockchain with advanced DeFi capabilities.`,
      website: 'https://example.com',
      twitter: 'https://twitter.com/example',
      telegram: 'https://t.me/example',
    };

    const mockTransactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tx-${i}`,
      type: Math.random() > 0.5 ? 'buy' : 'sell',
      amount: Math.random() * 10000,
      price: mockCoinData.price * (0.95 + Math.random() * 0.1),
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      wallet: generateMockAddress().slice(0, 8) + '...',
      txHash: generateMockAddress(),
    }));

    const mockTopTraders: TopTrader[] = Array.from({ length: 10 }, (_, i) => ({
      id: `trader-${i}`,
      wallet: generateMockAddress().slice(0, 8) + '...',
      username: `trader${i + 1}`,
      pnl: (Math.random() - 0.3) * 100000,
      winRate: 50 + Math.random() * 40,
      trades: Math.floor(Math.random() * 1000),
    }));

    setCoinData(mockCoinData);
    setTransactions(mockTransactions);
    setTopTraders(mockTopTraders);
  }, [symbol]);

  useEffect(() => {
    loadCoinData();
  }, [loadCoinData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCoinData();
    setRefreshing(false);
  };

  const copyToClipboard = (text: string) => {
    // In a real app, use Clipboard API
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 1000) return price.toFixed(2);
    return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (!coinData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color={COLORS.textPrimary} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setWatchlisted(!watchlisted)}
              style={styles.watchlistButton}
            >
              <Star
                color={watchlisted ? COLORS.solana : COLORS.textSecondary}
                size={24}
                fill={watchlisted ? COLORS.solana : 'transparent'}
              />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <NeonCard style={styles.headerCard}>
          <View style={styles.tokenHeader}>
            <View style={styles.tokenInfo}>
              {coinData.logo ? (
                <Image source={{ uri: coinData.logo }} style={styles.tokenLogo} />
              ) : (
                <View style={styles.tokenLogoPlaceholder}>
                  <Text style={styles.tokenLogoText}>{coinData.symbol.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.tokenDetails}>
                <View style={styles.tokenNameRow}>
                  <GlowingText text={coinData.symbol} style={styles.tokenSymbol} />
                  {coinData.verified && (
                    <Shield color={COLORS.success} size={16} style={styles.verifiedIcon} />
                  )}
                </View>
                <Text style={styles.tokenName}>{coinData.name}</Text>
              </View>
            </View>
            
            <View style={styles.priceContainer}>
              <Text style={styles.price}>${formatPrice(coinData.price)}</Text>
              <View style={styles.changeContainer}>
                {coinData.change24h >= 0 ? (
                  <TrendingUp color={COLORS.success} size={16} />
                ) : (
                  <TrendingDown color={COLORS.error} size={16} />
                )}
                <Text
                  style={[
                    styles.change,
                    { color: coinData.change24h >= 0 ? COLORS.success : COLORS.error },
                  ]}
                >
                  {coinData.change24h >= 0 ? '+' : ''}{coinData.change24h.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        </NeonCard>

        {/* Stats */}
        <NeonCard style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Market Cap</Text>
              <Text style={styles.statValue}>${formatLargeNumber(coinData.marketCap)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>24h Volume</Text>
              <Text style={styles.statValue}>${formatLargeNumber(coinData.volume24h)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Liquidity</Text>
              <Text style={styles.statValue}>${formatLargeNumber(coinData.liquidity)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Holders</Text>
              <Text style={styles.statValue}>{formatLargeNumber(coinData.holders)}</Text>
            </View>
          </View>
        </NeonCard>

        {/* Contract Address */}
        <NeonCard style={styles.contractCard}>
          <View style={styles.contractHeader}>
            <Text style={styles.contractLabel}>Contract Address</Text>
            <View style={styles.contractActions}>
              <TouchableOpacity
                onPress={() => copyToClipboard(coinData.contractAddress)}
                style={styles.actionButton}
              >
                <Copy color={COLORS.textSecondary} size={16} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openLink(`https://solscan.io/account/${coinData.contractAddress}`)}
                style={styles.actionButton}
              >
                <ExternalLink color={COLORS.textSecondary} size={16} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.contractAddress}>{coinData.contractAddress}</Text>
        </NeonCard>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {(['chart', 'trades', 'holders'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                activeTab === tab && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'chart' && (
          <NeonCard style={styles.chartCard}>
            <View style={styles.chartPlaceholder}>
              <Activity color={COLORS.solana} size={48} />
              <Text style={styles.chartPlaceholderText}>TradingView Chart</Text>
              <Text style={styles.chartSubtext}>Real-time price chart will be integrated here</Text>
            </View>
          </NeonCard>
        )}

        {activeTab === 'trades' && (
          <NeonCard style={styles.tradesCard}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {transactions.slice(0, 20).map((tx) => (
              <View key={tx.id} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <View
                    style={[
                      styles.transactionType,
                      {
                        backgroundColor:
                          tx.type === 'buy' ? COLORS.success + '20' : COLORS.error + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.transactionTypeText,
                        { color: tx.type === 'buy' ? COLORS.success : COLORS.error },
                      ]}
                    >
                      {tx.type.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionAmount}>
                      {formatLargeNumber(tx.amount)} {coinData.symbol}
                    </Text>
                    <Text style={styles.transactionWallet}>{tx.wallet}</Text>
                  </View>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={styles.transactionPrice}>${formatPrice(tx.price)}</Text>
                  <Text style={styles.transactionTime}>{formatTime(tx.timestamp)}</Text>
                </View>
              </View>
            ))}
          </NeonCard>
        )}

        {activeTab === 'holders' && (
          <NeonCard style={styles.holdersCard}>
            <Text style={styles.sectionTitle}>Top Traders</Text>
            {topTraders.map((trader, index) => (
              <View key={trader.id} style={styles.traderItem}>
                <View style={styles.traderLeft}>
                  <Text style={styles.traderRank}>#{index + 1}</Text>
                  <View style={styles.traderInfo}>
                    <Text style={styles.traderName}>
                      {trader.username || trader.wallet}
                    </Text>
                    <Text style={styles.traderTrades}>{trader.trades} trades</Text>
                  </View>
                </View>
                <View style={styles.traderRight}>
                  <Text
                    style={[
                      styles.traderPnl,
                      { color: trader.pnl >= 0 ? COLORS.success : COLORS.error },
                    ]}
                  >
                    {trader.pnl >= 0 ? '+' : ''}${formatLargeNumber(Math.abs(trader.pnl))}
                  </Text>
                  <Text style={styles.traderWinRate}>{trader.winRate.toFixed(1)}% WR</Text>
                </View>
              </View>
            ))}
          </NeonCard>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <NeonButton
            title="Buy"
            onPress={() => Alert.alert('Buy', `Buy ${coinData.symbol}`)}
            style={styles.actionButtonPrimary}
          />
          <NeonButton
            title="Sell"
            onPress={() => Alert.alert('Sell', `Sell ${coinData.symbol}`)}
            variant="secondary"
            style={styles.actionButtonSecondary}
          />
        </View>

        {/* Links */}
        {(coinData.website || coinData.twitter || coinData.telegram) && (
          <NeonCard style={styles.linksCard}>
            <Text style={styles.sectionTitle}>Links</Text>
            <View style={styles.linksContainer}>
              {coinData.website && (
                <TouchableOpacity
                  onPress={() => openLink(coinData.website!)}
                  style={styles.linkButton}
                >
                  <ExternalLink color={COLORS.textSecondary} size={16} />
                  <Text style={styles.linkText}>Website</Text>
                </TouchableOpacity>
              )}
              {coinData.twitter && (
                <TouchableOpacity
                  onPress={() => openLink(coinData.twitter!)}
                  style={styles.linkButton}
                >
                  <ExternalLink color={COLORS.textSecondary} size={16} />
                  <Text style={styles.linkText}>Twitter</Text>
                </TouchableOpacity>
              )}
              {coinData.telegram && (
                <TouchableOpacity
                  onPress={() => openLink(coinData.telegram!)}
                  style={styles.linkButton}
                >
                  <ExternalLink color={COLORS.textSecondary} size={16} />
                  <Text style={styles.linkText}>Telegram</Text>
                </TouchableOpacity>
              )}
            </View>
          </NeonCard>
        )}
      </ScrollView>
    </>
  );
}

const getTokenName = (symbol: string) => {
  const names: { [key: string]: string } = {
    SOL: 'Solana',
    ETH: 'Ethereum',
    BNB: 'BNB',
    USDC: 'USD Coin',
    WIF: 'Dogwifhat',
    BONK: 'Bonk',
    JUP: 'Jupiter',
    RAY: 'Raydium',
    RNDR: 'Render Token',
    PEPE: 'Pepe',
  };
  return names[symbol] || `${symbol} Token`;
};

const generateMockAddress = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  backButton: {
    padding: SPACING.s,
  },
  watchlistButton: {
    padding: SPACING.s,
  },
  headerCard: {
    margin: SPACING.m,
    marginBottom: SPACING.s,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: SPACING.m,
  },
  tokenLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.solana + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  tokenLogoText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
  },
  tokenDetails: {
    flex: 1,
  },
  tokenNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenSymbol: {
    fontSize: 24,
    marginRight: SPACING.s,
  },
  verifiedIcon: {
    marginLeft: SPACING.xs,
  },
  tokenName: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  change: {
    ...FONTS.monospace,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  statsCard: {
    margin: SPACING.m,
    marginTop: 0,
    marginBottom: SPACING.s,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: SPACING.s,
  },
  statLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  statValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  contractCard: {
    margin: SPACING.m,
    marginTop: 0,
    marginBottom: SPACING.s,
  },
  contractHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  contractLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  contractActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: SPACING.s,
    marginLeft: SPACING.s,
  },
  contractAddress: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.s,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small,
  },
  activeTab: {
    backgroundColor: COLORS.solana + '20',
  },
  tabText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  activeTabText: {
    color: COLORS.solana,
  },
  chartCard: {
    margin: SPACING.m,
    marginTop: 0,
    height: 300,
  },
  chartPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginTop: SPACING.m,
  },
  chartSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.s,
    textAlign: 'center',
  },
  tradesCard: {
    margin: SPACING.m,
    marginTop: 0,
  },
  holdersCard: {
    margin: SPACING.m,
    marginTop: 0,
  },
  sectionTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.m,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '30',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionType: {
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    marginRight: SPACING.s,
  },
  transactionTypeText: {
    ...FONTS.phantomBold,
    fontSize: 10,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionAmount: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  transactionWallet: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionPrice: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  transactionTime: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  traderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '30',
  },
  traderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  traderRank: {
    ...FONTS.phantomBold,
    color: COLORS.textSecondary,
    fontSize: 14,
    width: 30,
  },
  traderInfo: {
    flex: 1,
    marginLeft: SPACING.s,
  },
  traderName: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  traderTrades: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  traderRight: {
    alignItems: 'flex-end',
  },
  traderPnl: {
    ...FONTS.monospace,
    fontSize: 14,
    fontWeight: '600',
  },
  traderWinRate: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    margin: SPACING.m,
    gap: SPACING.s,
  },
  actionButtonPrimary: {
    flex: 1,
  },
  actionButtonSecondary: {
    flex: 1,
  },
  linksCard: {
    margin: SPACING.m,
    marginTop: 0,
    marginBottom: SPACING.xl,
  },
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
  },
  linkText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s,
  },
});