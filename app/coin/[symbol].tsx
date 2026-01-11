import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import {
  Star,
  Copy,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { SimpleCandlestickChart } from '../../components/SimpleCandlestickChart';
import { COLORS } from '../../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../../constants/theme';
import { NeonCard } from '../../components/NeonCard';
import { NeonButton } from '../../components/NeonButton';
import { GlowingText } from '../../components/GlowingText';
import { trpc } from '../../lib/trpc';

type Timeframe = '1h' | '1d' | '1w' | '1m' | '1y';
type ChartTimeframe = '5m' | '15m' | '1h' | '4h' | '1d';
const TF_ORDER: Timeframe[] = ['1h', '1d', '1w', '1m', '1y'];
const CHART_TIMEFRAMES: ChartTimeframe[] = ['5m', '15m', '1h', '4h', '1d'];



interface CoinData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  priceChange1h?: number;
  priceChange7d?: number;
  marketCap: number;
  fdv?: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  contractAddress: string;
  verified: boolean;
  age: string;
  pairAge?: number | null;
  logo?: string | null;
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  txns24h?: {
    buys: number;
    sells: number;
    total: number;
  };
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
  // Read all params passed from home screen for data consistency
  const params = useLocalSearchParams<{
    symbol: string;
    price?: string;
    change?: string;
    logo?: string;
    contractAddress?: string;
    pairAddress?: string;
    name?: string;
  }>();
  const symbol = params.symbol;

  // Use passed data if available (from home screen navigation)
  const passedPrice = params.price ? parseFloat(params.price) : undefined;
  const passedChange = params.change ? parseFloat(params.change) : undefined;
  const passedLogo = params.logo || undefined;
  const passedContractAddress = params.contractAddress || undefined;
  const passedPairAddress = params.pairAddress || undefined;
  const passedName = params.name || undefined;

  // Fetch real token data from API
  const {
    data: apiData,
    isLoading: isLoadingApi,
    error: apiError,
    refetch: refetchApi
  } = trpc.market.getTokenDetails.useQuery(
    { symbol: symbol?.toUpperCase() || '' },
    {
      enabled: !!symbol,
      refetchInterval: 30000, // Refresh every 30 seconds
      retry: 2,
    }
  );

  // Transform API data to CoinData format - prefer passed params for consistency
  const coinData: CoinData | null = useMemo(() => {
    if (apiData) {
      return {
        symbol: apiData.symbol,
        name: passedName || apiData.name,
        // Use passed price/change from home screen for consistency
        price: passedPrice !== undefined ? passedPrice : apiData.price,
        change24h: passedChange !== undefined ? passedChange : apiData.priceChange24h,
        priceChange1h: apiData.priceChange1h,
        priceChange7d: apiData.priceChange7d,
        marketCap: apiData.marketCap,
        fdv: apiData.fdv,
        volume24h: apiData.volume24h,
        liquidity: apiData.liquidity,
        holders: apiData.holders || 0,
        contractAddress: passedContractAddress || apiData.address,
        verified: apiData.verified,
        age: apiData.pairAge ? `${apiData.pairAge}h` : 'Unknown',
        pairAge: apiData.pairAge,
        // Use passed logo from home screen for consistency
        logo: passedLogo || apiData.logo,
        description: apiData.description,
        website: apiData.website,
        twitter: apiData.twitter,
        telegram: apiData.telegram,
        txns24h: apiData.txns24h,
      };
    }
    if (symbol?.toUpperCase() === 'SOL') {
      return {
        symbol: 'SOL',
        name: 'Solana',
        price: 162.34,
        change24h: 2.15,
        priceChange1h: 0.58,
        priceChange7d: 4.2,
        marketCap: 72000000000,
        fdv: 72000000000,
        volume24h: 3200000000,
        liquidity: 1800000000,
        holders: 2200000,
        contractAddress: 'So11111111111111111111111111111111111111112',
        verified: true,
        age: '48h',
        pairAge: 48,
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
        description: 'Solana is a high-performance blockchain for web-scale applications.',
        website: 'https://solana.com',
        twitter: 'https://twitter.com/solana',
        telegram: null,
        txns24h: { buys: 50000, sells: 48000, total: 98000 },
      };
    }
    return null;
  }, [apiData, symbol]);

  // Removed: transactions and topTraders state - tabs now show "Coming Soon"
  const [activeTab, setActiveTab] = useState<'chart' | 'trades' | 'holders'>('chart');
  const [refreshing, setRefreshing] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [sentimentTimeframe, setSentimentTimeframe] = useState<'1h' | '1d' | '1w' | '1m' | '1y'>('1d');
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1h');
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 640;

  // Fetch price history for chart
  const pairAddress = apiData?.pairAddress || '';
  const {
    data: priceHistoryData,
    isLoading: isLoadingChart,
    refetch: refetchChart,
  } = trpc.market.getPriceHistory.useQuery(
    { pairAddress, timeframe: chartTimeframe },
    {
      enabled: !!pairAddress && activeTab === 'chart',
      refetchInterval: 60000, // Refresh every minute
      retry: 1,
    }
  );

  // Convert to OHLCV format for candlestick chart
  const chartData = useMemo(() => {
    if (!priceHistoryData?.data || priceHistoryData.data.length === 0) {
      // Generate mock OHLCV data if no real data
      return Array.from({ length: 50 }, (_, i) => {
        const base = coinData?.price || 100;
        const variance = base * 0.03;
        const open = base + (Math.random() - 0.5) * variance;
        const close = base + (Math.random() - 0.5) * variance;
        return {
          open,
          high: Math.max(open, close) + Math.random() * variance * 0.3,
          low: Math.min(open, close) - Math.random() * variance * 0.3,
          close,
        };
      });
    }
    return priceHistoryData.data.map((d: any) => ({
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
  }, [priceHistoryData, coinData?.price]);

  // TradingView modal state
  const [showTradingView, setShowTradingView] = useState(false);

  const getMockSentiment = useCallback((tf: '1h' | '1d' | '1w' | '1m' | '1y') => {
    // Simple deterministic mock based on timeframe for consistent UI
    switch (tf) {
      case '1h':
        return { holding: 40, selling: 10, buying: 50 };
      case '1d':
        return { holding: 45, selling: 15, buying: 40 };
      case '1w':
        return { holding: 52, selling: 18, buying: 30 };
      case '1m':
        return { holding: 48, selling: 22, buying: 30 };
      case '1y':
        return { holding: 35, selling: 25, buying: 40 };
      default:
        return { holding: 40, selling: 10, buying: 50 };
    }
  }, []);

  const sentiment = getMockSentiment(sentimentTimeframe);

  const getMockStatChanges = useCallback((tf: Timeframe) => {
    // Deterministic mock deltas per timeframe; positive/negative for realism
    switch (tf) {
      case '1h':
        return { marketCap: 0.6, volume: 1.2, liquidity: 0.3, holders: 0.1 };
      case '1d':
        return { marketCap: 2.4, volume: 3.1, liquidity: 1.0, holders: 0.6 };
      case '1w':
        return { marketCap: 6.8, volume: 9.2, liquidity: 3.5, holders: 2.1 };
      case '1m':
        return { marketCap: 14.2, volume: 18.5, liquidity: 7.4, holders: 5.0 };
      case '1y':
        return { marketCap: 65.0, volume: 80.0, liquidity: 35.0, holders: 28.0 };
      default:
        return { marketCap: 0, volume: 0, liquidity: 0, holders: 0 };
    }
  }, []);

  const statChanges = getMockStatChanges(sentimentTimeframe);

  const cycleTimeframe = useCallback(() => {
    const idx = TF_ORDER.indexOf(sentimentTimeframe);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % TF_ORDER.length;
    setSentimentTimeframe(TF_ORDER[nextIdx] ?? '1d');
  }, [sentimentTimeframe]);

  const handleTimeframePress = useCallback(
    (tf: Timeframe) => {
      if (tf === sentimentTimeframe) {
        const idx = TF_ORDER.indexOf(sentimentTimeframe);
        const nextIdx = idx === -1 ? 0 : (idx + 1) % TF_ORDER.length;
        setSentimentTimeframe(TF_ORDER[nextIdx] ?? '1d');
      } else {
        setSentimentTimeframe(tf);
      }
    },
    [sentimentTimeframe]
  );

  // Watchlist persistence
  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        const raw = await AsyncStorage.getItem('watchlist_tokens');
        const arr: string[] = raw ? JSON.parse(raw) : [];
        setWatchlisted(arr.includes((symbol as string)?.toUpperCase() || ''));
      } catch (e) {
        // noop
      }
    };
    void loadWatchlist();
  }, [symbol]);

  const toggleWatchlist = async () => {
    try {
      const token = (symbol as string)?.toUpperCase() || '';
      const raw = await AsyncStorage.getItem('watchlist_tokens');
      const arr: string[] = raw ? JSON.parse(raw) : [];
      let next: string[];
      if (arr.includes(token)) {
        next = arr.filter(s => s !== token);
        setWatchlisted(false);
        await AsyncStorage.setItem('watchlist_tokens', JSON.stringify(next));
        Alert.alert('Removed from watchlist');
      } else {
        next = [...arr, token];
        setWatchlisted(true);
        await AsyncStorage.setItem('watchlist_tokens', JSON.stringify(next));
        Alert.alert('Added to watchlist');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not update watchlist');
    }
  };

  // Top bar removed

  // Trade modal state
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | null>(null);
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [tradePriceType, setTradePriceType] = useState<'market' | 'target'>('market');
  const [tradeTargetPrice, setTradeTargetPrice] = useState<string>('');
  const [tradeSlippage, setTradeSlippage] = useState<string>('0.5');

  const openTradeModal = (mode: 'buy' | 'sell') => {
    setTradeMode(mode);
    setTradeAmount('');
    setTradePriceType('market');
    setTradeTargetPrice('');
    setTradeSlippage('0.5');
    setTradeModalVisible(true);
  };

  const closeTradeModal = () => {
    setTradeModalVisible(false);
  };

  const confirmTrade = () => {
    // Validate amount
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    // Close modal and navigate to swap screen with token pre-selected
    setTradeModalVisible(false);

    // Guard against null coinData
    if (!coinData) return;

    // Navigate to swap screen with token param
    // For BUY: set token as output (buying this token with SOL)
    // For SELL: set fromSymbol to this token (selling this token for SOL)
    if (tradeMode === 'buy') {
      router.push({
        pathname: '/swap',
        params: {
          token: coinData.contractAddress, // Pre-fill as output token
          amount: tradeAmount,
          slippage: tradeSlippage,
        },
      });
    } else {
      // For sell, use fromSymbol to set as input token
      router.push({
        pathname: '/swap',
        params: {
          fromSymbol: coinData.symbol,
          toSymbol: 'SOL',
          amount: tradeAmount,
          slippage: tradeSlippage,
        },
      });
    }
  };

  // Mock data loading removed - Trades and Holders tabs now show "Coming Soon"

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchApi();
    setRefreshing(false);
  };

  const copyToClipboard = (_text: string) => {
    // In a real app, use Clipboard API
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  const openLink = (url: string) => {
    void Linking.openURL(url);
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

  // Loading state
  if (isLoadingApi) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.solana} />
        <Text style={styles.loadingText}>Loading {symbol?.toUpperCase()}...</Text>
      </View>
    );
  }

  // Error state
  if (!coinData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Token Not Found</Text>
        <Text style={styles.errorText}>
          {`Could not find data for ${symbol?.toUpperCase()}`}
        </Text>
        <NeonButton
          title="Go Back"
          onPress={() => router.back()}
          style={{ marginTop: SPACING.m }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
          headerTitle: '',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
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

        {/* Stats + Sentiment (responsive order) */}
        <NeonCard style={styles.statsCard}>
          <View style={[styles.statsRow, isSmallScreen && styles.statsRowSmall]}>
            {isSmallScreen ? (
              <>
                <View style={[styles.sentimentContainer, styles.sentimentContainerSmall]}>
                  <View style={styles.sentimentHeader}>
                    <TouchableOpacity onPress={cycleTimeframe} activeOpacity={0.7}>
                      <Text style={styles.sentimentTitle}>Sentiment</Text>
                    </TouchableOpacity>
                    <View style={styles.timeframeRow}>
                      {(['1h', '1d', '1w', '1m', '1y'] as const).map(tf => (
                        <TouchableOpacity
                          key={tf}
                          style={[styles.timeframePill, sentimentTimeframe === tf && styles.timeframePillActive]}
                          onPress={() => handleTimeframePress(tf)}
                        >
                          <Text style={[styles.timeframeText, sentimentTimeframe === tf && styles.timeframeTextActive]}>
                            {tf}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.sentimentItemRow}>
                    <Text style={styles.sentimentLabel}>Holding</Text>
                    <View style={styles.sentimentBarTrack}>
                      <View style={[styles.sentimentBarFill, { width: `${sentiment.holding}%`, backgroundColor: COLORS.textPrimary + '99' }]} />
                    </View>
                    <Text style={styles.sentimentValue}>{sentiment.holding}%</Text>
                  </View>
                  <View style={styles.sentimentItemRow}>
                    <Text style={styles.sentimentLabel}>Selling</Text>
                    <View style={styles.sentimentBarTrack}>
                      <View style={[styles.sentimentBarFill, { width: `${sentiment.selling}%`, backgroundColor: COLORS.error + '99' }]} />
                    </View>
                    <Text style={styles.sentimentValue}>{sentiment.selling}%</Text>
                  </View>
                  <View style={styles.sentimentItemRow}>
                    <Text style={styles.sentimentLabel}>Buying</Text>
                    <View style={styles.sentimentBarTrack}>
                      <View style={[styles.sentimentBarFill, { width: `${sentiment.buying}%`, backgroundColor: COLORS.success + '99' }]} />
                    </View>
                    <Text style={styles.sentimentValue}>{sentiment.buying}%</Text>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Market Cap</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>${formatLargeNumber(coinData.marketCap)}</Text>
                      <Text style={[
                        styles.statDelta,
                        { color: statChanges.marketCap >= 0 ? COLORS.success : COLORS.error },
                      ]}>
                        {statChanges.marketCap >= 0 ? '+' : ''}{statChanges.marketCap.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Volume</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>${formatLargeNumber(coinData.volume24h)}</Text>
                      <Text style={[
                        styles.statDelta,
                        { color: statChanges.volume >= 0 ? COLORS.success : COLORS.error },
                      ]}>
                        {statChanges.volume >= 0 ? '+' : ''}{statChanges.volume.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Liquidity</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>${formatLargeNumber(coinData.liquidity)}</Text>
                      <Text style={[
                        styles.statDelta,
                        { color: statChanges.liquidity >= 0 ? COLORS.success : COLORS.error },
                      ]}>
                        {statChanges.liquidity >= 0 ? '+' : ''}{statChanges.liquidity.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Holders</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>{formatLargeNumber(coinData.holders)}</Text>
                      <Text style={[
                        styles.statDelta,
                        { color: statChanges.holders >= 0 ? COLORS.success : COLORS.error },
                      ]}>
                        {statChanges.holders >= 0 ? '+' : ''}{statChanges.holders.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Market Cap</Text>
                    <Text style={styles.statValue}>${formatLargeNumber(coinData.marketCap)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Volume</Text>
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

                <View style={styles.sentimentContainer}>
                  <View style={styles.sentimentHeader}>
                    <TouchableOpacity onPress={cycleTimeframe} activeOpacity={0.7}>
                      <Text style={styles.sentimentTitle}>Sentiment</Text>
                    </TouchableOpacity>
                    <View style={styles.timeframeRow}>
                      {(['1h', '1d', '1w', '1m', '1y'] as const).map(tf => (
                        <TouchableOpacity
                          key={tf}
                          style={[styles.timeframePill, sentimentTimeframe === tf && styles.timeframePillActive]}
                          onPress={() => handleTimeframePress(tf)}
                        >
                          <Text style={[styles.timeframeText, sentimentTimeframe === tf && styles.timeframeTextActive]}>
                            {tf}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.sentimentItemRow}>
                    <Text style={styles.sentimentLabel}>Holding</Text>
                    <View style={styles.sentimentBarTrack}>
                      <View style={[styles.sentimentBarFill, { width: `${sentiment.holding}%`, backgroundColor: COLORS.textPrimary + '99' }]} />
                    </View>
                    <Text style={styles.sentimentValue}>{sentiment.holding}%</Text>
                  </View>
                  <View style={styles.sentimentItemRow}>
                    <Text style={styles.sentimentLabel}>Selling</Text>
                    <View style={styles.sentimentBarTrack}>
                      <View style={[styles.sentimentBarFill, { width: `${sentiment.selling}%`, backgroundColor: COLORS.error + '99' }]} />
                    </View>
                    <Text style={styles.sentimentValue}>{sentiment.selling}%</Text>
                  </View>
                  <View style={styles.sentimentItemRow}>
                    <Text style={styles.sentimentLabel}>Buying</Text>
                    <View style={styles.sentimentBarTrack}>
                      <View style={[styles.sentimentBarFill, { width: `${sentiment.buying}%`, backgroundColor: COLORS.success + '99' }]} />
                    </View>
                    <Text style={styles.sentimentValue}>{sentiment.buying}%</Text>
                  </View>
                </View>
              </>
            )}
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
            {/* Chart Timeframe Selector */}
            <View style={styles.chartTimeframeRow}>
              {CHART_TIMEFRAMES.map((tf) => (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.chartTimeframePill,
                    chartTimeframe === tf && styles.chartTimeframePillActive,
                  ]}
                  onPress={() => setChartTimeframe(tf)}
                >
                  <Text
                    style={[
                      styles.chartTimeframeText,
                      chartTimeframe === tf && styles.chartTimeframeTextActive,
                    ]}
                  >
                    {tf}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Candlestick Chart */}
            <View style={styles.chartContainer}>
              {isLoadingChart ? (
                <View style={styles.chartLoading}>
                  <ActivityIndicator size="large" color={COLORS.solana} />
                </View>
              ) : (
                <SimpleCandlestickChart
                  data={chartData}
                  height={200}
                  positiveColor={COLORS.success}
                  negativeColor={COLORS.error}
                />
              )}
            </View>

            {/* Chart Info & TradingView Button */}
            <View style={styles.chartInfo}>
              <Text style={styles.chartInfoText}>
                {chartData.length} candles • {chartTimeframe}
              </Text>
              <TouchableOpacity
                style={styles.tradingViewButton}
                onPress={() => setShowTradingView(true)}
              >
                <Activity size={14} color={COLORS.solana} />
                <Text style={styles.tradingViewButtonText}>TradingView</Text>
              </TouchableOpacity>
            </View>
          </NeonCard>
        )}

        {/* TradingView WebView Modal */}
        <Modal
          visible={showTradingView}
          animationType="slide"
          onRequestClose={() => setShowTradingView(false)}
        >
          <View style={styles.tradingViewContainer}>
            <View style={styles.tradingViewHeader}>
              <Text style={styles.tradingViewTitle}>
                {coinData?.symbol} Chart
              </Text>
              <TouchableOpacity onPress={() => setShowTradingView(false)}>
                <Text style={styles.tradingViewClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <WebView
              source={{
                uri: `https://www.dexscreener.com/solana/${coinData?.contractAddress}?embed=1&theme=dark&trades=0&info=0`
              }}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color={COLORS.solana} />
                  <Text style={styles.webViewLoadingText}>Loading TradingView...</Text>
                </View>
              )}
            />
          </View>
        </Modal>

        {activeTab === 'trades' && (
          <NeonCard style={styles.tradesCard}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <View style={styles.comingSoonContainer}>
              <Text style={styles.comingSoonText}>🚀 Coming Soon</Text>
              <Text style={styles.comingSoonSubtext}>
                Live transaction feed is under development
              </Text>
              <TouchableOpacity
                style={styles.dexscreenerButton}
                onPress={() => openLink(`https://dexscreener.com/solana/${coinData.contractAddress}`)}
              >
                <ExternalLink size={16} color={COLORS.solana} />
                <Text style={styles.dexscreenerButtonText}>View on DexScreener</Text>
              </TouchableOpacity>
            </View>
          </NeonCard>
        )}

        {activeTab === 'holders' && (
          <NeonCard style={styles.holdersCard}>
            <Text style={styles.sectionTitle}>Token Holders</Text>
            <View style={styles.comingSoonContainer}>
              <Text style={styles.comingSoonText}>🚀 Coming Soon</Text>
              <Text style={styles.comingSoonSubtext}>
                Holder analytics is under development
              </Text>
              <TouchableOpacity
                style={styles.dexscreenerButton}
                onPress={() => openLink(`https://dexscreener.com/solana/${coinData.contractAddress}`)}
              >
                <ExternalLink size={16} color={COLORS.solana} />
                <Text style={styles.dexscreenerButtonText}>View on DexScreener</Text>
              </TouchableOpacity>
            </View>
          </NeonCard>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <NeonButton
            title="Buy"
            onPress={() => openTradeModal('buy')}
            style={styles.actionButtonPrimary}
          />
          <NeonButton
            title="Sell"
            onPress={() => openTradeModal('sell')}
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

        {/* More Info */}
        <View style={styles.moreInfoContainer}>
          <NeonButton
            title="More Info"
            variant="secondary"
            onPress={() => Linking.openURL(`https://dexscreener.com/solana/${coinData.contractAddress}`)}
          />
        </View>
      </ScrollView>

      {/* Floating watchlist toggle */}
      <TouchableOpacity
        style={[styles.floatingWatchlist, { top: Math.round(height * 0.6) }]}
        onPress={toggleWatchlist}
        activeOpacity={0.8}
      >
        <Star color={watchlisted ? COLORS.solana : COLORS.textPrimary} size={22} />
      </TouchableOpacity>

      {/* Buy/Sell Modal (single page) */}
      <Modal
        visible={tradeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeTradeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tradeMode === 'buy' ? 'Buy' : 'Sell'} {coinData.symbol}</Text>

            {/* Single-page trade form */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Amount</Text>
              <TextInput
                value={tradeAmount}
                onChangeText={setTradeAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.modalInput}
              />

              <Text style={styles.modalLabel}>Price Type</Text>
              <View style={styles.segmentedRow}>
                <TouchableOpacity
                  style={[styles.segmentedItem, tradePriceType === 'market' && styles.segmentedItemActive]}
                  onPress={() => setTradePriceType('market')}
                >
                  <Text style={[styles.segmentedText, tradePriceType === 'market' && styles.segmentedTextActive]}>Market</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentedItem, tradePriceType === 'target' && styles.segmentedItemActive]}
                  onPress={() => setTradePriceType('target')}
                >
                  <Text style={[styles.segmentedText, tradePriceType === 'target' && styles.segmentedTextActive]}>Target</Text>
                </TouchableOpacity>
              </View>

              {tradePriceType === 'target' && (
                <View style={styles.targetRow}>
                  <Text style={styles.modalLabel}>Target Price (USD)</Text>
                  <TextInput
                    value={tradeTargetPrice}
                    onChangeText={setTradeTargetPrice}
                    keyboardType="decimal-pad"
                    placeholder={formatPrice(coinData.price)}
                    placeholderTextColor={COLORS.textSecondary}
                    style={styles.modalInput}
                  />
                </View>
              )}

              <View style={styles.targetRow}>
                <Text style={styles.modalLabel}>Slippage (%)</Text>
                <TextInput
                  value={tradeSlippage}
                  onChangeText={setTradeSlippage}
                  keyboardType="decimal-pad"
                  placeholder="0.5"
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.modalInput}
                />
              </View>

              <NeonButton title={tradeMode === 'buy' ? 'Buy' : 'Sell'} onPress={confirmTrade} style={styles.modalPrimary} />
              <NeonButton title="Cancel" variant="secondary" onPress={closeTradeModal} style={styles.modalSecondary} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Token name lookup - kept for potential future use
// const _getTokenName = (symbol: string) => {
//   const names: { [key: string]: string } = {
//     SOL: 'Solana',
//     ETH: 'Ethereum',
//     BNB: 'BNB',
//     USDC: 'USD Coin',
//     WIF: 'Dogwifhat',
//     BONK: 'Bonk',
//     JUP: 'Jupiter',
//     RAY: 'Raydium',
//     RNDR: 'Render Token',
//     PEPE: 'Pepe',
//   };
//   return names[symbol] || `${symbol} Token`;
// };

const generateMockAddress = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const styles = StyleSheet.create({
  // topBar removed
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
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
    marginTop: SPACING.m,
  },
  errorTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.error,
    fontSize: 20,
    marginBottom: SPACING.s,
  },
  errorText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: SPACING.l,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statsRowSmall: {
    flexDirection: 'column',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  statItem: {
    width: '50%',
    paddingVertical: SPACING.s,
  },

  floatingWatchlist: {
    position: 'absolute',
    right: SPACING.l,
    top: SPACING.l,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 20,
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
    fontSize: 15,
    fontWeight: '600',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
  statDelta: {
    ...FONTS.monospace,
    fontSize: 12,
    fontWeight: '600',
  },
  contractCard: {
    margin: SPACING.m,
    marginTop: 0,
    marginBottom: SPACING.s,
  },
  sentimentContainer: {
    width: 260,
    marginLeft: SPACING.s,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border + '30',
    paddingLeft: SPACING.m,
  },
  sentimentContainerSmall: {
    width: '100%',
    marginLeft: 0,
    borderLeftWidth: 0,
    paddingLeft: 0,
    marginTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border + '30',
    paddingTop: SPACING.m,
  },
  sentimentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  sentimentTitle: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  timeframePill: {
    paddingHorizontal: SPACING.s,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
  },
  timeframePillActive: {
    backgroundColor: COLORS.solana + '20',
    borderColor: COLORS.solana + '60',
  },
  timeframeText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  timeframeTextActive: {
    color: COLORS.solana,
  },
  sentimentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginTop: SPACING.xs,
  },
  sentimentLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    width: 70,
  },
  sentimentBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border + '30',
    overflow: 'hidden',
  },
  sentimentBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  sentimentValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 12,
    width: 44,
    textAlign: 'right',
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
    minHeight: 320,
  },
  chartTimeframeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.m,
  },
  chartTimeframePill: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
  },
  chartTimeframePillActive: {
    backgroundColor: COLORS.solana + '20',
    borderColor: COLORS.solana,
  },
  chartTimeframeText: {
    ...FONTS.phantomMedium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chartTimeframeTextActive: {
    color: COLORS.solana,
  },
  chartLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartLoadingText: {
    ...FONTS.phantomRegular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
  },
  chartContainer: {
    paddingRight: SPACING.s,
  },
  chartInfo: {
    marginTop: SPACING.s,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartInfoText: {
    ...FONTS.phantomRegular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chartPriceText: {
    ...FONTS.phantomMedium,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  tradingViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.medium,
  },
  tradingViewButtonText: {
    ...FONTS.phantomMedium,
    fontSize: 12,
    color: COLORS.solana,
  },
  tradingViewContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tradingViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.m,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tradingViewTitle: {
    ...FONTS.phantomBold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  tradingViewClose: {
    fontSize: 24,
    color: COLORS.textSecondary,
    padding: SPACING.xs,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  webViewLoadingText: {
    ...FONTS.phantomRegular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
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
  moreInfoContainer: {
    margin: SPACING.m,
  },
  // Modal styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '80%',
    maxWidth: 460,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
    minHeight: 480,
    maxHeight: '90%',
  },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  modalSection: {
    marginTop: SPACING.s,
  },
  modalLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    fontSize: 16,
    marginBottom: SPACING.m,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginBottom: SPACING.m,
  },
  segmentedItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
  },
  segmentedItemActive: {
    backgroundColor: COLORS.solana + '20',
    borderColor: COLORS.solana + '60',
  },
  segmentedText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  segmentedTextActive: {
    color: COLORS.solana,
  },
  targetRow: {
    marginTop: SPACING.s,
  },
  modalPrimary: {
    marginTop: SPACING.s,
  },
  modalSecondary: {
    marginTop: SPACING.s,
  },
  modalSummary: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  // Coming Soon styles
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.l,
  },
  comingSoonText: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.s,
  },
  comingSoonSubtext: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.m,
  },
  dexscreenerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '40',
  },
  dexscreenerButtonText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
});
