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
  CopyTradeExecutionModal,
  QueueStatusBanner,
} from '@/components';
import * as SecureStore from 'expo-secure-store';
import { createWallet, fetchBalances, hasLocalWallet, getLocalPublicKey, Holding, fetchCopyConfig, fetchCopyPositions, checkCopyTradeQueue, CopyTradeQueueItem, CopyPosition, api } from '@/services';
import { fetchTrendingTokens } from '@/services/market';
import { showErrorToast, validateSession } from '@/utils';
import { useAlert } from '@/contexts/AlertContext';

// Static fallback wallet data for UI display
const DUMMY_WALLET = {
  publicKey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  balance: 1234.56,
  tokens: [
    { symbol: 'SOL', name: 'Solana', balance: 10.5, usdValue: 1050, mint: 'So11111111111111111111111111111111111111112', decimals: 9, logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' },
    { symbol: 'USDC', name: 'USD Coin', balance: 500, usdValue: 500, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
  ],
};

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
  const [hasWallet, setHasWallet] = useState<boolean>(false);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState<boolean>(false);
  const [walletPin, setWalletPin] = useState<string>('');
  const [isCreatingWallet, setIsCreatingWallet] = useState<boolean>(false);

  // Real user profile state
  const [user, setUser] = useState<any>(null);
  const [_authLoading, setAuthLoading] = useState(true);
  const _isAuthenticated = !!user;
  const dailyPnl = 0; // Will be calculated from holdings

  // Fetch user profile from backend
  const fetchUserProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setAuthLoading(false);
        return;
      }

      const data = await api.get<{ user: unknown }>('/me');
      setUser(data.user || data);
    } catch {
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    void validateSession();
    fetchUserProfile();
  }, []);

  // Suppress unused variable warnings (used in Phase 2.2 Create Wallet modal)
  void showCreateWalletModal; void setShowCreateWalletModal;
  void isCreatingWallet;
  void hasWallet; void isLoadingWallet;

  // Load wallet data
  const loadWalletData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setIsLoadingWallet(false);
        return;
      }

      // Check if wallet exists locally
      const hasLocal = await hasLocalWallet();
      setHasWallet(hasLocal);

      if (hasLocal) {
        const pubkey = await getLocalPublicKey();
        setWalletAddress(pubkey);
        if (__DEV__) console.log('[Home] Local wallet:', pubkey);
      }

      // Fetch balances from backend (works if wallet is linked to user)
      if (__DEV__) console.log('[Home] Fetching balances...');
      const portfolio = await fetchBalances(token);
      if (portfolio) {
        if (__DEV__) console.log('[Home] Portfolio:', portfolio);
        setTotalBalance(portfolio.totalUsdValue);
        setHoldings(portfolio.holdings);
        // Update wallet address from backend if not set locally
        if (!walletAddress && portfolio.publicKey) {
          setWalletAddress(portfolio.publicKey);
          setHasWallet(true);
        }
      } else {
        if (__DEV__) console.log('[Home] No portfolio data');
        showErrorToast('Failed to load balances');
      }
    } catch (error: any) {
      // "No wallet linked" is expected when wallet exists locally but isn't linked to backend yet
      if (error?.message?.includes('No wallet linked')) {
        if (__DEV__) console.log('[Home] Wallet not linked to backend yet — skipping balance fetch');
      } else {
        if (__DEV__) console.error('[Home] Error loading wallet:', error);
        showErrorToast('Failed to load wallet data');
      }
    } finally {
      setIsLoadingWallet(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // Refresh wallet data when tab gains focus (e.g. after swap on coin detail)
  useFocusEffect(
    useCallback(() => {
      loadWalletData();
    }, [loadWalletData])
  );

  const refetch = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  // Handle wallet creation
  const handleCreateWallet = async () => {
    if (walletPin.length < 4) {
      showAlert('Error', 'PIN must be at least 4 digits');
      return;
    }

    setIsCreatingWallet(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        showAlert('Error', 'Please login first');
        return;
      }

      const result = await createWallet(token, walletPin);
      if (result.success) {
        setWalletAddress(result.publicKey || null);
        setHasWallet(true);
        setShowCreateWalletModal(false);
        setWalletPin('');
        showAlert('Success', 'Wallet created successfully!');
        await loadWalletData();
      } else {
        showAlert('Error', result.error || 'Failed to create wallet');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to create wallet');
    } finally {
      setIsCreatingWallet(false);
    }
  };
  void handleCreateWallet; // Used in Phase 2.2 Create Wallet modal

  // Static wallet data fallback for UI display
  const _solanaWallet = { publicKey: walletAddress || DUMMY_WALLET.publicKey };
  const solanaPublicKey = walletAddress || DUMMY_WALLET.publicKey;
  const _getAvailableTokens = () => holdings.length > 0 ? holdings.map(h => ({
    symbol: h.symbol,
    name: h.name,
    balance: h.balance,
    usdValue: h.usdValue,
    mint: h.mint,
    decimals: h.decimals,
    logo: WELL_KNOWN_TOKEN_LOGOS[h.symbol] || undefined
  })) : DUMMY_WALLET.tokens;
  const _executeSwap = async (_params?: any) => ({ success: true, signature: 'demo_signature_' + Date.now(), outputAmount: 0 });

  // Mock profile query - use local user data
  const profileQuery = { data: { profileImage: null }, isLoading: false };

  // Real trending tokens from API (refreshes daily at 15:00 UTC)
  const [trendingTokens, setTrendingTokens] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [_lastTrendingUpdate, setLastTrendingUpdate] = useState<string | null>(null);

  // Fetch trending tokens on mount
  useEffect(() => {
    loadTrendingTokens();
  }, []);

  const loadTrendingTokens = async () => {
    setTrendingLoading(true);
    const result = await fetchTrendingTokens();
    if (result.success && result.tokens) {
      // Transform to match TokenCard format
      const transformed = result.tokens.map((token: any) => ({
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
        marketCap: token.marketCap || 0,
      }));
      setTrendingTokens(transformed);
      setLastTrendingUpdate(result.lastUpdated || null);
    }
    setTrendingLoading(false);
  };

  // Poll prices every 5 minutes for trending tokens
  useEffect(() => {
    if (trendingTokens.length === 0) return;

    const pollPrices = async () => {
      const result = await fetchTrendingTokens();
      if (result.success && result.tokens) {
        const transformed = result.tokens.map((token: any) => ({
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
          marketCap: token.marketCap || 0,
        }));
        setTrendingTokens(transformed);
      }
    };

    const interval = setInterval(pollPrices, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [trendingTokens.length]);

  // Transform trending tokens for display
  const topCoins = React.useMemo(() => {
    return trendingTokens.map((token: any) => ({
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      price: token.price,
      change24h: token.change24h,
      volume24h: token.volume24h,
      logo: token.logo,
      banner: token.banner,
      liquidity: token.liquidity,
      marketCap: token.marketCap,
      contractAddress: token.contractAddress,
      pairAddress: token.contractAddress, // Use address as pair address for navigation
    }));
  }, [trendingTokens]);

  // Mock custodial wallet data - coming soon
  const custodialWalletData: any = { hasWallet: false, balance: 0 };
  const refetchCustodialWallet = async () => ({});
  const setupCustodialWalletMutation = { mutateAsync: async (): Promise<any> => ({ publicKey: 'mock-public-key' }) };

  // Copy Trading State
  const [copyPositions, setCopyPositions] = React.useState<CopyPosition[]>([]);
  const [copyQueue, setCopyQueue] = React.useState<CopyTradeQueueItem[]>([]);
  const [copyConfig, setCopyConfig] = React.useState<any>(null);
  const [isLoadingCopyData, setIsLoadingCopyData] = React.useState(false);
  const [showExecutionModal, setShowExecutionModal] = React.useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = React.useState<CopyTradeQueueItem | null>(null);

  // Copy trading data is now loaded from the backend via loadCopyTradingData
  // copyConfig, copyPositions, and copyQueue are populated from real API calls
  const copyTradeSettings = copyConfig ? [copyConfig] : [];

  // Copy positions from backend
  const copyTrades = copyPositions || [];

  const getStats = () => {
    if (!copyConfig) {
      return { activeCopies: 0, totalTrades: 0, profitLoss: 0, profitLossPercentage: 0 };
    }
    // Map stats to frontend format
    return {
      activeCopies: copyTradeSettings.filter((ct: any) => ct.isActive).length,
      totalTrades: copyPositions.length,
      profitLoss: 0,
      profitLossPercentage: 0,
    };
  };

  // Mock copy trade mutations - coming soon
  const createCopyTradeMutation = { mutateAsync: async (_p: any): Promise<any> => { throw new Error('Feature not available'); }, isPending: false };
  const stopCopyTradeMutation = { mutateAsync: async (_p: any): Promise<any> => { throw new Error('Feature not available'); }, isPending: false };

  const _createCopyTrade = async (params: any) => {
    try {
      // Check if user has custodial wallet
      if (!custodialWalletData?.hasWallet) {
        // Setup custodial wallet first
        const result = await setupCustodialWalletMutation.mutateAsync();
        showAlert(
          'Custodial Wallet Created',
          `Deposit USDC to ${result.publicKey?.slice(0, 8)}...${result.publicKey?.slice(-8)} to start copy trading.`,
          [{ text: 'OK', onPress: () => refetchCustodialWallet() }]
        );
        return;
      }

      // Check if user has sufficient USDC balance
      if ((custodialWalletData?.usdcBalance || 0) < params.totalAmount) {
        showAlert(
          'Insufficient Balance',
          `You need ${params.totalAmount} USDC but only have ${custodialWalletData?.usdcBalance?.toFixed(2) || 0} USDC.\n\nDeposit to: ${custodialWalletData?.publicKey?.slice(0, 8)}...${custodialWalletData?.publicKey?.slice(-8)}`
        );
        return;
      }

      await createCopyTradeMutation.mutateAsync({
        walletAddress: params.targetWalletAddress,
        totalBudget: params.totalAmount,
        amountPerTrade: params.amountPerTrade,
        stopLoss: params.stopLoss ? -Math.abs(params.stopLoss) : undefined,
        takeProfit: params.takeProfit,
        exitWithTrader: false,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create copy trade');
    }
  };



  // Load copy trading data (positions, queue, config)
  const loadCopyTradingData = useCallback(async () => {
    try {
      setIsLoadingCopyData(true);
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      // Fetch config, positions, and queue in parallel
      const [configResult, positionsResult, queueResult] = await Promise.all([
        fetchCopyConfig(token),
        fetchCopyPositions(token),
        checkCopyTradeQueue(token)
      ]);

      if (configResult.success) {
        setCopyConfig(configResult.config);
      }
      if (positionsResult.success && positionsResult.positions) {
        setCopyPositions(positionsResult.positions);
      }
      if (queueResult.success && queueResult.queue) {
        setCopyQueue(queueResult.queue.filter(item => item.status === 'pending'));
      }
    } finally {
      setIsLoadingCopyData(false);
    }
  }, []);

  // Load copy trading data on mount and when auth changes
  useEffect(() => {
    loadCopyTradingData();
  }, [loadCopyTradingData, user]);

  // Handle queue banner action - open execution modal
  const handleQueueAction = useCallback(() => {
    if (copyQueue.length > 0) {
      setSelectedQueueItem(copyQueue[0] ?? null);
      setShowExecutionModal(true);
    }
  }, [copyQueue]);

  // Handle successful execution - refresh data
  const handleExecutionSuccess = useCallback(() => {
    loadCopyTradingData();
    setShowExecutionModal(false);
    setSelectedQueueItem(null);
  }, [loadCopyTradingData]);

  const stopCopyTrade = async (copyTradingId: string) => {
    try {
      await stopCopyTradeMutation.mutateAsync({ copyTradingId });
      showAlert('Success', 'Stopped copy trading');
      // Refresh copy trading data
      loadCopyTradingData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to stop copy trading');
    }
  };

  const _isCreating = createCopyTradeMutation.isPending || false;

  const [activeTab, setActiveTab] = React.useState<'coins' | 'traders' | 'copy'>('coins');
  const [pnlPeriod, setPnlPeriod] = React.useState<'1d' | '7d' | '30d' | '1y'>('1d');

  // Search and filter states
  const [coinsSearchQuery, _setCoinsSearchQuery] = React.useState('');
  const [tradersSearchQuery, _setTradersSearchQuery] = React.useState('');
  const [_debouncedTradersSearch, setDebouncedTradersSearch] = React.useState('');

  // ✅ Debounced search for real-time market search
  const [debouncedCoinsSearch, setDebouncedCoinsSearch] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCoinsSearch(coinsSearchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [coinsSearchQuery]);

  // Mock market search - using local data
  const searchData: any = { pairs: [] };
  const searchLoading = false;

  // Transform search results
  const searchCoins = React.useMemo(() => {
    if (!searchData?.pairs) return [];

    return searchData.pairs.slice(0, 10).map((pair: any) => {
      const symbol = pair.baseToken?.symbol || 'UNKNOWN';
      return {
        id: pair.pairAddress || `${pair.chainId}-${pair.dexId}`,
        symbol,
        name: pair.baseToken?.name || 'Unknown Token',
        price: parseFloat(pair.priceUsd || '0'),
        change24h: parseFloat(pair.priceChange?.h24 || '0'),
        volume24h: parseFloat(pair.volume?.h24 || '0'),
        // Use DexScreener logo, header image, or well-known token logos as fallback
        logo: pair.info?.imageUrl || pair.info?.header || getWellKnownTokenLogo(symbol),
        // Add missing fields to match topCoins structure
        liquidity: parseFloat(pair.liquidity?.usd || '0'),
        transactions: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
        contractAddress: pair.baseToken?.address || '',
        pairAddress: pair.pairAddress || '',
      };
    });
  }, [searchData]);

  // Determine which coins to display
  const _displayCoins = debouncedCoinsSearch.length >= 2 ? searchCoins : topCoins;
  const _isLoadingCoins = debouncedCoinsSearch.length >= 2 ? searchLoading : trendingLoading;

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

    // Generate random positive gains between 10% and 250%
    return walletAddresses.map((address, index) => ({
      id: `trader-${index}`,
      name: `Trader ${index + 1}`,
      walletAddress: address,
      roi: Math.floor(Math.random() * 240 + 10), // Random 10-250%
      username: `${address.slice(0, 4)}...${address.slice(-4)}`,
    }));
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTradersSearch(tradersSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [tradersSearchQuery]);

  // Mock trader search - coming soon
  const _searchedTradersData: any = { data: [] };
  const _searchedTradersLoading = false;

  // New Copy Trading State (state declarations moved to before loadCopyTradingData)
  const [showCopyModal, setShowCopyModal] = React.useState(false);
  const [selectedTrader, setSelectedTrader] = React.useState<{ username: string; walletAddress: string } | null>(null);

  // Legacy state (to be removed after migration)
  const [selectedTraderWallet, _setSelectedTraderWallet] = React.useState<string | null>(null);
  const [copyAmount, _setCopyAmount] = React.useState('1000');
  const [amountPerTrade, _setAmountPerTrade] = React.useState('100');
  const [stopLoss, _setStopLoss] = React.useState('10');
  const [takeProfit, _setTakeProfit] = React.useState('30');
  const [maxSlippage, _setMaxSlippage] = React.useState('0.5');

  // Wallet action modals
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [showReceiveModal, setShowReceiveModal] = React.useState(false);
  const [showSwapModal, setShowSwapModal] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), loadTrendingTokens()]);
    setRefreshing(false);
  }, [refetch]);

  // Validate Solana address using regex (pure frontend)
  const validateSolanaAddress = (address: string): boolean => {
    if (!address || address.trim().length === 0) return false;
    // Solana addresses are base58 encoded, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  // Validate copy trade form
  const _validateCopyTradeForm = (): boolean => {
    const amount = parseFloat(copyAmount);
    const perTrade = parseFloat(amountPerTrade);
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    const slip = maxSlippage ? parseFloat(maxSlippage) : 0.5;
    if (!selectedTraderWallet || !validateSolanaAddress(selectedTraderWallet)) {
      showAlert('Error', 'Please enter a valid wallet address');
      return false;
    }
    if (isNaN(amount) || amount <= 0) {
      showAlert('Invalid Input', 'Total amount must be a positive number');
      return false;
    }
    if (isNaN(perTrade) || perTrade <= 0) {
      showAlert('Invalid Input', 'Amount per trade must be a positive number');
      return false;
    }
    if (perTrade > amount) {
      showAlert('Invalid Input', 'Amount per trade cannot exceed total budget');
      return false;
    }
    if (sl !== undefined && (isNaN(sl) || sl > 0 || sl < -100)) {
      showAlert('Invalid Input', 'Stop loss must be between -100% and 0%');
      return false;
    }
    if (tp !== undefined && (isNaN(tp) || tp <= 0 || tp > 1000)) {
      showAlert('Invalid Input', 'Take profit must be between 0% and 1000%');
      return false;
    }
    if (isNaN(slip) || slip <= 0 || slip > 50) {
      showAlert('Invalid Input', 'Max slippage must be between 0% and 50%');
      return false;
    }
    if (typeof totalBalance === 'number' && amount > totalBalance) {
      showAlert('Insufficient Balance', 'Reduce total amount to fit your balance');
      return false;
    }
    return true;
  };

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
                      name={coin.name}
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

                {/* Active Copy Settings */}
                {copyTradeSettings.length > 0 && (
                  <View style={styles.activeCopiesContainer}>
                    <Text style={styles.activeCopiesTitle}>Active Copy Trades</Text>
                    {copyTradeSettings.map((setting: any) => (
                      <View key={setting.id} style={styles.activeCopyItem}>
                        <View style={styles.activeCopyInfo}>
                          <Text style={styles.activeCopyWallet}>
                            {setting.name || setting.trader?.username || `${setting.traderAddress?.slice(0, 8)}...${setting.traderAddress?.slice(-8)}`}
                          </Text>
                          <Text style={styles.activeCopyAmount}>◎{setting.perTradeAmount}/trade</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.stopCopyButton}
                          onPress={() => stopCopyTrade(setting.id)}
                        >
                          <Text style={styles.stopCopyText}>Stop</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
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
                {profileQuery.data?.profileImage ? (
                  <Image source={{ uri: profileQuery.data.profileImage }} style={styles.avatar} />
                ) : user?.profileImage ? (
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

          {/* Copy Trade Queue Status Banner */}
          <QueueStatusBanner
            onViewQueue={handleQueueAction}
            pollInterval={30000}
          />

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
          loadCopyTradingData();
        }}
        trader={selectedTrader}
      />

      {/* Copy Trade Execution Modal */}
      <CopyTradeExecutionModal
        visible={showExecutionModal}
        onClose={() => {
          setShowExecutionModal(false);
          setSelectedQueueItem(null);
        }}
        onSuccess={handleExecutionSuccess}
        queueItem={selectedQueueItem}
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
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
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
  searchAndFilterContainer: {
    marginBottom: SPACING.m
  },
  searchWithDropdownContainer: {
    position: 'relative',
    zIndex: 1000,
    elevation: 1000
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    marginBottom: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  searchInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s,
    paddingVertical: SPACING.xs
  },
  timeFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  timeFilterButton: {
    flex: 1,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small,
    marginHorizontal: 2
  },
  activeTimeFilterButton: {
    backgroundColor: COLORS.solana + '20'
  },
  timeFilterText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  activeTimeFilterText: {
    color: COLORS.solana
  },
  timeCycleButton: {
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    marginLeft: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
    minWidth: 50,
    alignItems: 'center'
  },
  timeCycleText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 12
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
  copyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    marginBottom: SPACING.m
  },
  copyInputPrefix: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginRight: SPACING.xs
  },
  inputValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16
  },
  sliderContainer: {
    marginBottom: SPACING.m
  },
  sliderTrack: {
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
    marginVertical: SPACING.s,
    position: 'relative'
  },
  sliderFill: {
    height: 6,
    backgroundColor: COLORS.solana,
    borderRadius: 3
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.solana,
    top: -7,
    marginLeft: -10
  },
  sliderValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
    textAlign: 'right'
  },
  startCopyingButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginTop: SPACING.m
  },
  startCopyingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m
  },
  startCopyingText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.large,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: COLORS.solana + '30'
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
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20
  },
  modalContent: {
    padding: SPACING.l
  },
  modalScrollContent: {
    paddingBottom: SPACING.l
  },
  modalDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: SPACING.l,
    lineHeight: 24
  },
  inputSection: {
    marginBottom: SPACING.m
  },
  inputLabel: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  inputPrefix: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 18,
    marginRight: SPACING.s
  },
  inputSuffix: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 18,
    marginLeft: SPACING.s
  },
  input: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    paddingVertical: SPACING.m
  },
  startCopyButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginTop: SPACING.l
  },
  startCopyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m
  },
  startCopyText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s
  },
  exitWithTraderButton: {
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '30'
  },
  exitWithTraderText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 16,
    marginBottom: SPACING.xs
  },
  exitWithTraderSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  tokenSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    padding: 2,
    marginBottom: SPACING.m
  },
  tokenOption: {
    flex: 1,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.small,
    alignItems: 'center'
  },
  selectedTokenOption: {
    backgroundColor: COLORS.solana + '20'
  },
  tokenOptionText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14
  },
  selectedTokenOptionText: {
    color: COLORS.solana
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: SPACING.l
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.solana + '30'
  },
  addressContainer: {
    marginBottom: SPACING.l
  },
  addressLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.s
  },
  addressBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  addressText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 12,
    textAlign: 'center'
  },
  actionButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginTop: SPACING.m
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m
  },
  actionText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s
  },
  swapContainer: {
    marginBottom: SPACING.l
  },
  swapSection: {
    marginBottom: SPACING.m
  },
  swapInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20'
  },
  swapInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginRight: SPACING.m
  },
  swapOutput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginRight: SPACING.m
  },
  swapArrow: {
    alignItems: 'center',
    marginVertical: SPACING.s
  },
  swapArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.solana + '30'
  },
  swapInfo: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l
  },
  swapInfoText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs
  },
  slippageContainer: {
    marginBottom: SPACING.m
  },
  slippageLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs
  },
  slippageOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  slippageChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
    backgroundColor: COLORS.background,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs
  },
  activeSlippageChip: {
    backgroundColor: COLORS.solana + '20',
    borderColor: COLORS.solana + '40'
  },
  slippageChipText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  activeSlippageChipText: {
    color: COLORS.solana
  },
  slippageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    height: 32
  },
  slippageInput: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    width: 56,
    paddingVertical: 0,
    fontSize: 12
  },
  slippagePercent: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    marginLeft: 4,
    fontSize: 12
  },
  dropdownButton: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginBottom: SPACING.m
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m
  },
  dropdownButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s
  },
  dropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginBottom: SPACING.m,
    maxHeight: 200
  },
  swapDropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginTop: SPACING.s,
    maxHeight: 150
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10'
  },
  modalSearchInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s,
    paddingVertical: SPACING.xs
  },
  dropdownList: {
    maxHeight: 150
  },
  swapDropdownList: {
    maxHeight: 100
  },
  dropdownItem: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10'
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  tokenLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.s
  },
  tokenLogoSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: SPACING.xs
  },
  tokenSymbol: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14
  },
  tokenName: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  swapTokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    minWidth: 80
  },
  swapTokenText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginRight: SPACING.xs
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
  activeCopiesContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m
  },
  activeCopiesTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s
  },
  activeCopyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10'
  },
  activeCopyInfo: {
    flex: 1
  },
  activeCopyWallet: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs
  },
  activeCopyAmount: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  stopCopyButton: {
    backgroundColor: COLORS.error + '20',
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.error + '30'
  },
  stopCopyText: {
    ...FONTS.phantomMedium,
    color: COLORS.error,
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
  testTradeButton: {
    backgroundColor: COLORS.warning + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.s,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning + '30'
  },
  testTradeText: {
    ...FONTS.phantomMedium,
    color: COLORS.warning,
    fontSize: 14
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
  trendingSubtitle: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.m,
    textAlign: 'center',
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
  // Comment 3: Skeleton loading styles
  skeletonContainer: {
    paddingHorizontal: SPACING.m,
  },
  skeletonCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  skeletonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonRight: {
    alignItems: 'flex-end',
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  skeletonTextContainer: {
    marginLeft: SPACING.s,
  },
  skeletonTextLarge: {
    width: 80,
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.xs,
  },
  skeletonTextSmall: {
    width: 60,
    height: 10,
    borderRadius: 4,
    backgroundColor: COLORS.background,
  },
  skeletonTextMedium: {
    width: 70,
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.xs,
  },
});

