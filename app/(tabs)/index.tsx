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
  Modal,
  TextInput,
  Alert,
  Linking,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Globe, Zap, ArrowUp, ArrowDown, RefreshCw, CreditCard, X, ArrowUpDown, ChevronDown, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { WalletCard } from '../../components/WalletCard';
import { QuickActionButton } from '../../components/QuickActionButton';
import { TokenCard } from '../../components/TokenCard';
import { TraderCard } from '../../components/TraderCard';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { SendModal } from '../../components/SendModal';
import { ReceiveModal } from '../../components/ReceiveModal';
import * as SecureStore from 'expo-secure-store';
import { createWallet, fetchBalances, hasLocalWallet, getLocalPublicKey, Holding } from '../../services/wallet';

// Static dummy data for pure UI mode
const DUMMY_USER = {
  username: 'demo_user',
  email: 'demo@example.com',
  profileImage: null as string | null,
  walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
};
const DUMMY_WALLET = {
  publicKey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  balance: 1234.56,
  tokens: [
    { symbol: 'SOL', name: 'Solana', balance: 10.5, usdValue: 1050, mint: 'So11111111111111111111111111111111111111112', decimals: 9, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
    { symbol: 'USDC', name: 'USD Coin', balance: 500, usdValue: 500, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  ],
};

// Well-known token logos for popular Solana tokens (fallback when API doesn't have them)
const WELL_KNOWN_TOKEN_LOGOS: Record<string, string> = {
  'SOL': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  'RAY': 'https://raw.githubusercontent.com/raydium-io/media-assets/master/logo/logo_200x200.png',
  'JUP': 'https://static.jup.ag/jup/icon.png',
  'USDC': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  'USDT': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
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

  // Auth state from dummy for now (integrate with real auth later)
  const user = DUMMY_USER;
  const authLoading = false;
  const isAuthenticated = true;
  const dailyPnl = 0; // Will be calculated from holdings

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

        // Fetch balances from backend
        const portfolio = await fetchBalances(token);
        if (portfolio) {
          setTotalBalance(portfolio.totalUsdValue);
          setHoldings(portfolio.holdings);
        }
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setIsLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const refetch = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  // Handle wallet creation
  const handleCreateWallet = async () => {
    if (walletPin.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }

    setIsCreatingWallet(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      const result = await createWallet(token, walletPin);
      if (result.success) {
        setWalletAddress(result.publicKey || null);
        setHasWallet(true);
        setShowCreateWalletModal(false);
        setWalletPin('');
        Alert.alert('Success', 'Wallet created successfully!');
        await loadWalletData();
      } else {
        Alert.alert('Error', result.error || 'Failed to create wallet');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create wallet');
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // Static wallet data fallback for UI display
  const solanaWallet = { publicKey: walletAddress || DUMMY_WALLET.publicKey };
  const solanaPublicKey = walletAddress || DUMMY_WALLET.publicKey;
  const getAvailableTokens = () => holdings.length > 0 ? holdings.map(h => ({
    symbol: h.symbol,
    name: h.name,
    balance: h.balance,
    usdValue: h.usdValue,
    mint: h.mint,
    decimals: h.decimals,
    logo: WELL_KNOWN_TOKEN_LOGOS[h.symbol] || undefined
  })) : DUMMY_WALLET.tokens;
  const executeSwap = async (_params?: any) => ({ success: true, signature: 'demo_signature_' + Date.now(), outputAmount: 0 });

  // Mock profile query - use local user data
  const profileQuery = { data: { profileImage: null }, isLoading: false };

  // Mock trending data - using static mock data
  const trendingData: any = { pairs: [] };
  const trendingLoading = false;

  // Transform trending data to displayable format
  // Comment 3: Include liquidity, volume, and transactions for TokenCard
  const topCoins = React.useMemo(() => {
    if (!trendingData?.pairs) return [];

    return trendingData.pairs.slice(0, 20).map((pair: any) => {
      const symbol = pair.baseToken?.symbol || 'UNKNOWN';
      return {
        id: pair.pairAddress || `${pair.chainId}-${pair.dexId}`,
        symbol,
        name: pair.baseToken?.name || 'Unknown Token',
        price: parseFloat(pair.priceUsd || '0'),
        change1h: parseFloat(pair.priceChange?.h1 || '0'),
        change24h: parseFloat(pair.priceChange?.h24 || '0'),
        change7d: parseFloat(pair.priceChange?.h24 || '0') * 1.5, // Estimated from 24h (API limitation)
        volume24h: parseFloat(pair.volume?.h24 || '0'),
        // Use DexScreener logo, header image, or well-known token logos as fallback
        logo: pair.info?.imageUrl || pair.info?.header || getWellKnownTokenLogo(symbol),
        liquidity: parseFloat(pair.liquidity?.usd || '0'),
        transactions: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
        contractAddress: pair.baseToken?.address || '',
        pairAddress: pair.pairAddress || '',
      };
    });
  }, [trendingData]);

  // Mock custodial wallet data - coming soon
  const custodialWalletData: any = { hasWallet: false, balance: 0 };
  const refetchCustodialWallet = async () => ({});
  const setupCustodialWalletMutation = { mutateAsync: async (): Promise<any> => ({ publicKey: 'mock-public-key' }) };

  // Mock copy trading data - coming soon
  const myCopyTradesData: any[] = [];
  const copyStatsData: any = null;

  const copyTradeSettings = myCopyTradesData || [];

  // Mock positions data - using local token balances
  const positionsData: any = { positions: [] };

  const copyTrades = positionsData?.positions || [];

  const getStats = () => {
    if (!copyStatsData) {
      return { activeCopies: 0, totalTrades: 0, profitLoss: 0, profitLossPercentage: 0 };
    }
    // Map stats to frontend format
    return {
      activeCopies: copyTradeSettings.filter((ct: any) => ct.isActive).length,
      totalTrades: copyStatsData.totalTrades || 0,
      profitLoss: copyStatsData.netProfit || 0,
      profitLossPercentage: copyStatsData.winRate || 0,
    };
  };

  // Mock copy trade mutations - coming soon
  const createCopyTradeMutation = { mutateAsync: async (_p: any): Promise<any> => { throw new Error('Feature not available'); }, isPending: false };
  const stopCopyTradeMutation = { mutateAsync: async (_p: any): Promise<any> => { throw new Error('Feature not available'); }, isPending: false };

  const createCopyTrade = async (params: any) => {
    try {
      // Check if user has custodial wallet
      if (!custodialWalletData?.hasWallet) {
        // Setup custodial wallet first
        const result = await setupCustodialWalletMutation.mutateAsync();
        Alert.alert(
          'Custodial Wallet Created',
          `Deposit USDC to ${result.publicKey?.slice(0, 8)}...${result.publicKey?.slice(-8)} to start copy trading.`,
          [{ text: 'OK', onPress: () => refetchCustodialWallet() }]
        );
        return;
      }

      // Check if user has sufficient USDC balance
      if ((custodialWalletData?.usdcBalance || 0) < params.totalAmount) {
        Alert.alert(
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

  const stopCopyTrade = async (copyTradingId: string) => {
    try {
      await stopCopyTradeMutation.mutateAsync({ copyTradingId });
      Alert.alert('Success', 'Stopped copy trading');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to stop copy trading');
    }
  };

  const isCreating = createCopyTradeMutation.isPending || false;

  const [activeTab, setActiveTab] = React.useState<'coins' | 'traders' | 'copy'>('coins');
  const [pnlPeriod, setPnlPeriod] = React.useState<'1d' | '7d' | '30d' | '1y'>('1d');

  // Search and filter states
  const [coinsSearchQuery, setCoinsSearchQuery] = React.useState('');
  const [tradersSearchQuery, setTradersSearchQuery] = React.useState('');
  const [debouncedTradersSearch, setDebouncedTradersSearch] = React.useState('');

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
  const displayCoins = debouncedCoinsSearch.length >= 2 ? searchCoins : topCoins;
  const isLoadingCoins = debouncedCoinsSearch.length >= 2 ? searchLoading : trendingLoading;

  // Mock top traders - coming soon
  const tradersData: any = { data: [] };
  const tradersLoading = false;

  const topTraders = tradersData?.data || [];

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTradersSearch(tradersSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [tradersSearchQuery]);

  // Mock trader search - coming soon
  const searchedTradersData: any = { data: [] };
  const searchedTradersLoading = false;

  const [showCopyModal, setShowCopyModal] = React.useState(false);
  const [selectedTrader, setSelectedTrader] = React.useState<string | null>(null);
  const [selectedTraderWallet, setSelectedTraderWallet] = React.useState<string | null>(null);
  const [copyAmount, setCopyAmount] = React.useState('1000');
  const [amountPerTrade, setAmountPerTrade] = React.useState('100');
  const [stopLoss, setStopLoss] = React.useState('10');
  const [takeProfit, setTakeProfit] = React.useState('30');
  const [maxSlippage, setMaxSlippage] = React.useState('0.5');

  // Wallet action modals
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [showReceiveModal, setShowReceiveModal] = React.useState(false);
  const [showSwapModal, setShowSwapModal] = React.useState(false);


  // Swap form state - use mint addresses for any token
  const [fromToken, setFromToken] = React.useState('So11111111111111111111111111111111111111112'); // SOL
  const [toToken, setToToken] = React.useState('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
  const [swapAmount, setSwapAmount] = React.useState('');
  const [estimatedOutput, setEstimatedOutput] = React.useState('0.00');
  const [showFromTokenDropdown, setShowFromTokenDropdown] = React.useState(false);
  const [showToTokenDropdown, setShowToTokenDropdown] = React.useState(false);
  const [fromTokenSearch, setFromTokenSearch] = React.useState('');
  const [toTokenSearch, setToTokenSearch] = React.useState('');
  const [slippage, setSlippage] = React.useState(0.5);

  // Available tokens for dropdowns - use real Solana tokens if wallet is connected
  const availableTokens = React.useMemo(() => {
    if (solanaWallet) {
      return getAvailableTokens();
    }

    // Fallback to demo tokens
    const baseTokens = [
      { symbol: 'SOL', name: 'Solana', logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png', balance: 0, mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
      { symbol: 'USDC', name: 'USD Coin', logo: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png', balance: 0, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
      { symbol: 'WIF', name: 'Dogwifhat', logo: 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link', balance: 0, mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
    ];

    return baseTokens;
  }, [solanaWallet, getAvailableTokens]);

  // Filter tokens based on search
  const getFilteredTokens = (search: string) => {
    if (!search) return availableTokens;
    return availableTokens.filter(token =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase())
    );
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Validate Solana address using regex (pure frontend)
  const validateSolanaAddress = (address: string): boolean => {
    if (!address || address.trim().length === 0) return false;
    // Solana addresses are base58 encoded, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  // Validate copy trade form
  const validateCopyTradeForm = (): boolean => {
    const amount = parseFloat(copyAmount);
    const perTrade = parseFloat(amountPerTrade);
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    const slip = maxSlippage ? parseFloat(maxSlippage) : 0.5;
    if (!selectedTraderWallet || !validateSolanaAddress(selectedTraderWallet)) {
      Alert.alert('Error', 'Please enter a valid wallet address');
      return false;
    }
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Input', 'Total amount must be a positive number');
      return false;
    }
    if (isNaN(perTrade) || perTrade <= 0) {
      Alert.alert('Invalid Input', 'Amount per trade must be a positive number');
      return false;
    }
    if (perTrade > amount) {
      Alert.alert('Invalid Input', 'Amount per trade cannot exceed total budget');
      return false;
    }
    if (sl !== undefined && (isNaN(sl) || sl > 0 || sl < -100)) {
      Alert.alert('Invalid Input', 'Stop loss must be between -100% and 0%');
      return false;
    }
    if (tp !== undefined && (isNaN(tp) || tp <= 0 || tp > 1000)) {
      Alert.alert('Invalid Input', 'Take profit must be between 0% and 1000%');
      return false;
    }
    if (isNaN(slip) || slip <= 0 || slip > 50) {
      Alert.alert('Invalid Input', 'Max slippage must be between 0% and 50%');
      return false;
    }
    if (typeof totalBalance === 'number' && amount > totalBalance) {
      Alert.alert('Insufficient Balance', 'Reduce total amount to fit your balance');
      return false;
    }
    return true;
  };

  const handleSwap = async () => {
    // Validate inputs
    const amount = parseFloat(swapAmount);
    if (!swapAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to swap');
      return;
    }

    // Validate token mint addresses
    if (!fromToken || !validateSolanaAddress(fromToken)) {
      Alert.alert('Invalid Token', 'From token address is invalid');
      return;
    }
    if (!toToken || !validateSolanaAddress(toToken)) {
      Alert.alert('Invalid Token', 'To token address is invalid');
      return;
    }

    // Check balance
    const fromTokenData = availableTokens.find(t => t.mint === fromToken);
    if (fromTokenData && fromTokenData.balance < amount) {
      Alert.alert('Insufficient Balance', `You don't have enough. Balance: ${fromTokenData.balance.toFixed(6)}`);
      return;
    }

    try {
      if (!solanaWallet) {
        Alert.alert('Error', 'Wallet not connected');
        return;
      }

      // Get decimals for amount conversion
      const fromDecimals = fromTokenData?.decimals || 9;
      const amountInSmallestUnit = Math.floor(amount * Math.pow(10, fromDecimals));

      // Execute real swap via Jupiter
      const result = await executeSwap({
        inputMint: fromToken,
        outputMint: toToken,
        amount: amountInSmallestUnit,
        slippageBps: Math.round(slippage * 100), // Convert 0.5% to 50 bps
        expectedOutputAmount: parseFloat(estimatedOutput),
      });

      Alert.alert('Swap Successful!', `Transaction: ${result.signature.slice(0, 8)}...`);
      setShowSwapModal(false);
      setSwapAmount('');
    } catch (error: any) {
      console.error('Swap execution error:', error);
      const errorMsg = error?.message || error?.data?.message || 'Failed to execute swap';
      Alert.alert('Swap Failed', errorMsg);
    }
  };

  const handleBuy = () => {
    const base = process.env.EXPO_PUBLIC_FIAT_ONRAMP_URL;
    const key = process.env.EXPO_PUBLIC_MOONPAY_KEY;
    if (!base || !key) {
      Alert.alert('Unavailable', 'Fiat on-ramp is not configured');
      return;
    }
    const moonpayUrl = `${base}?apiKey=${key}&currencyCode=sol`;
    Linking.openURL(moonpayUrl).catch(() => {
      Alert.alert('Error', 'Could not open MoonPay');
    });
  };

  // Mock function to estimate swap output
  React.useEffect(() => {
    if (swapAmount && fromToken && toToken) {
      const mockRate = fromToken === 'SOL' ? 150 : 0.0067; // Mock exchange rates
      const estimated = (parseFloat(swapAmount) * mockRate).toFixed(2);
      setEstimatedOutput(estimated);
    } else {
      setEstimatedOutput('0.00');
    }
  }, [swapAmount, fromToken, toToken]);

  const minReceived = React.useMemo(() => {
    const est = parseFloat(estimatedOutput || '0');
    const s = Number(slippage) || 0;
    if (!isFinite(est) || est <= 0) return '0.00';
    const val = est * (1 - s / 100);
    return (val > 0 ? val : 0).toFixed(4);
  }, [estimatedOutput, slippage]);



  const renderTabContent = () => {
    switch (activeTab) {
      case 'coins':
        return (
          <ErrorBoundary>
            <View style={styles.tabContent}>
              {/* Search with Time Filter Dropdown for Coins */}
              <View style={styles.searchAndFilterContainer}>
                <View style={styles.searchWithDropdownContainer}>
                  <View style={styles.searchContainer}>
                    <Search size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search coins..."
                      placeholderTextColor={COLORS.textSecondary}
                      value={coinsSearchQuery}
                      onChangeText={setCoinsSearchQuery}
                      testID="coins-search-input"
                    />
                  </View>
                </View>
              </View>



              {/* Loading state */}
              {isLoadingCoins ? (
                <View style={styles.loadingContainer}>
                  <RefreshCw size={32} color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading coins...</Text>
                </View>
              ) : displayCoins.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Globe size={48} color={COLORS.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={styles.emptyTitle}>
                    {debouncedCoinsSearch ? 'No coins found' : 'No trending coins'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {debouncedCoinsSearch
                      ? 'Try a different search term'
                      : 'Check back later for trending tokens'}
                  </Text>
                </View>
              ) : (
                displayCoins.map((coin: any) => (
                  <TokenCard
                    key={coin.id}
                    symbol={coin.symbol}
                    name={coin.name}
                    price={coin.price}
                    change={coin.change24h || 0}
                    liquidity={coin.liquidity}
                    volume={coin.volume24h}
                    transactions={coin.transactions}
                    {...(coin.logo ? { logo: coin.logo } : {})}
                    onPress={() => {
                      // Navigate with token data to ensure consistency
                      router.push({
                        pathname: `/coin/${coin.symbol.toLowerCase()}` as any,
                        params: {
                          price: coin.price.toString(),
                          change: (coin.change24h || 0).toString(),
                          logo: coin.logo || '',
                          contractAddress: coin.contractAddress || '',
                          pairAddress: coin.pairAddress || '',
                          name: coin.name,
                        }
                      });
                    }}
                  />
                ))
              )}
            </View>
          </ErrorBoundary>
        );
      case 'traders':
        return (
          <ErrorBoundary>
            <View style={styles.tabContent}>
              {/* Search with Time Filter Dropdown for Traders */}
              <View style={styles.searchAndFilterContainer}>
                <View style={styles.searchWithDropdownContainer}>
                  <View style={styles.searchContainer}>
                    <Search size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search traders..."
                      placeholderTextColor={COLORS.textSecondary}
                      value={tradersSearchQuery}
                      onChangeText={setTradersSearchQuery}
                      testID="traders-search-input"
                    />
                  </View>
                </View>
              </View>

              {/* ✅ Display real traders from Birdeye or search results */}
              {(tradersLoading || searchedTradersLoading) ? (
                <View style={styles.loadingContainer}>
                  <RefreshCw size={32} color={COLORS.primary} />
                  <Text style={styles.loadingText}>{debouncedTradersSearch.length >= 3 ? 'Searching traders...' : 'Loading top traders...'}</Text>
                </View>
              ) : (debouncedTradersSearch.length >= 3 ? (searchedTradersData?.data || []).length === 0 : topTraders.length === 0) ? (
                <View style={styles.emptyContainer}>
                  <Globe size={48} color={COLORS.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={styles.emptyTitle}>{debouncedTradersSearch.length >= 3 ? 'No traders found' : 'No traders available'}</Text>
                  <Text style={styles.emptySubtitle}>{debouncedTradersSearch.length >= 3 ? 'Try a different search term' : 'Check back later for top performers'}</Text>
                </View>
              ) : (
                (debouncedTradersSearch.length >= 3 ? (searchedTradersData?.data || []) : topTraders)
                  .filter((trader: any) =>
                    (trader.name || '').toLowerCase().includes(tradersSearchQuery.toLowerCase()) ||
                    trader.walletAddress.toLowerCase().includes(tradersSearchQuery.toLowerCase())
                  )
                  .map((trader: any) => (
                    <TraderCard
                      key={trader.id || trader.walletAddress}
                      username={trader.name || trader.username}
                      walletAddress={trader.walletAddress}
                      roi={trader.roi}
                      period="24h"
                      onPress={() => {
                        // Simple: tap anywhere opens copy modal with address pre-filled
                        setSelectedTrader(trader.walletAddress);
                        setSelectedTraderWallet(trader.walletAddress);
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
                            {setting.trader?.username || `${setting.trader?.walletAddress.slice(0, 8)}...${setting.trader?.walletAddress.slice(-8)}`}
                          </Text>
                          <Text style={styles.activeCopyAmount}>${setting.amountPerTrade}/trade</Text>
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
                      setSelectedTrader('Manual Setup');
                      setSelectedTraderWallet('');
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

  if (authLoading || !isAuthenticated) {
    return null;
  }

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

      {/* Copy Trading Modal */}
      <Modal
        visible={showCopyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCopyModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCopyModal(false)} accessibilityRole="button" accessibilityLabel="Dismiss copy trading modal">
          <Pressable style={[styles.modalContainer, { width: width * 0.9, maxWidth: 400, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Copy @{selectedTrader}</Text>
              <TouchableOpacity onPress={() => setShowCopyModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDescription}>
                {selectedTrader === 'Manual Setup' ?
                  'Enter wallet address and trading parameters' :
                  `Set up copy trading parameters for @${selectedTrader}`
                }
              </Text>

              {selectedTrader === 'Manual Setup' && (
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Wallet Address to Copy</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter Solana wallet address..."
                      placeholderTextColor={COLORS.textSecondary}
                      value={selectedTraderWallet || ''}
                      onChangeText={setSelectedTraderWallet}
                      multiline
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Total Amount (USDC)</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1000"
                    placeholderTextColor={COLORS.textSecondary}
                    value={copyAmount}
                    onChangeText={setCopyAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Amount per Trade (USDC)</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="100"
                    placeholderTextColor={COLORS.textSecondary}
                    value={amountPerTrade}
                    onChangeText={setAmountPerTrade}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Stop Loss (%)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="10"
                    placeholderTextColor={COLORS.textSecondary}
                    value={stopLoss}
                    onChangeText={setStopLoss}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Take Profit (%)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor={COLORS.textSecondary}
                    value={takeProfit}
                    onChangeText={setTakeProfit}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Max Slippage (%)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="0.5"
                    placeholderTextColor={COLORS.textSecondary}
                    value={maxSlippage}
                    onChangeText={setMaxSlippage}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.exitWithTraderButton}>
                <Text style={styles.exitWithTraderText}>Exit with Trader</Text>
                <Text style={styles.exitWithTraderSubtext}>Automatically exit when trader exits</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.startCopyButton, isCreating ? { opacity: 0.7 } : null]}
                disabled={isCreating}
                onPress={async () => {
                  if (!validateCopyTradeForm()) return;
                  try {
                    await createCopyTrade({
                      targetWalletAddress: selectedTraderWallet,
                      totalAmount: parseFloat(copyAmount),
                      amountPerTrade: parseFloat(amountPerTrade),
                      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
                      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
                      maxSlippage: maxSlippage ? parseFloat(maxSlippage) : 0.5
                    });
                    Alert.alert('Success', `Started copying ${selectedTrader || 'wallet'}!`);
                    setShowCopyModal(false);
                    setSelectedTrader(null);
                    setSelectedTraderWallet(null);
                    setCopyAmount('1000');
                    setAmountPerTrade('100');
                    setStopLoss('10');
                    setTakeProfit('30');
                    setMaxSlippage('0.5');
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Failed to set up copy trading');
                  }
                }}
                accessibilityLabel="Start copying trader"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={[COLORS.success, COLORS.success + '80']}
                  style={styles.startCopyGradient}
                >
                  <Zap size={20} color={COLORS.textPrimary} />
                  <Text style={styles.startCopyText}>
                    {isCreating ? 'SETTING UP...' : 'START COPYING'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Swap Modal */}
      <Modal
        visible={showSwapModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSwapModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.9, maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Swap Tokens</Text>
              <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.swapContainer}>
                <View style={styles.swapSection}>
                  <Text style={styles.inputLabel}>From</Text>
                  <View style={styles.swapInputContainer}>
                    <TextInput
                      style={styles.swapInput}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textSecondary}
                      value={swapAmount}
                      onChangeText={setSwapAmount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.swapTokenButton}
                      onPress={() => setShowFromTokenDropdown(!showFromTokenDropdown)}
                    >
                      <View style={styles.tokenInfo}>
                        {availableTokens.find(t => t.mint === fromToken)?.logo && (
                          <Image
                            source={{ uri: availableTokens.find(t => t.mint === fromToken)?.logo }}
                            style={styles.tokenLogoSmall}
                          />
                        )}
                        <Text style={styles.swapTokenText}>
                          {availableTokens.find(t => t.mint === fromToken)?.symbol || 'Select'}
                        </Text>
                      </View>
                      <ChevronDown size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {showFromTokenDropdown && (
                    <View style={styles.swapDropdownContainer}>
                      <View style={styles.modalSearchContainer}>
                        <Search size={16} color={COLORS.textSecondary} />
                        <TextInput
                          style={styles.modalSearchInput}
                          placeholder="Search tokens..."
                          placeholderTextColor={COLORS.textSecondary}
                          value={fromTokenSearch}
                          onChangeText={setFromTokenSearch}
                        />
                      </View>
                      <ScrollView style={styles.swapDropdownList} showsVerticalScrollIndicator={false}>
                        {getFilteredTokens(fromTokenSearch).map((token) => (
                          <TouchableOpacity
                            key={token.mint}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setFromToken(token.mint);
                              setShowFromTokenDropdown(false);
                              setFromTokenSearch('');
                            }}
                          >
                            <View style={styles.tokenInfo}>
                              {token.logo && (
                                <Image source={{ uri: token.logo }} style={styles.tokenLogo} />
                              )}
                              <View>
                                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                                <Text style={styles.tokenName}>{token.name}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.swapArrow}>
                  <TouchableOpacity
                    style={styles.swapArrowButton}
                    onPress={() => {
                      const temp = fromToken;
                      setFromToken(toToken);
                      setToToken(temp);
                    }}
                  >
                    <ArrowUpDown size={20} color={COLORS.solana} />
                  </TouchableOpacity>
                </View>

                <View style={styles.swapSection}>
                  <Text style={styles.inputLabel}>To</Text>
                  <View style={styles.swapInputContainer}>
                    <Text style={styles.swapOutput}>{estimatedOutput}</Text>
                    <TouchableOpacity
                      style={styles.swapTokenButton}
                      onPress={() => setShowToTokenDropdown(!showToTokenDropdown)}
                    >
                      <View style={styles.tokenInfo}>
                        {availableTokens.find(t => t.mint === toToken)?.logo && (
                          <Image
                            source={{ uri: availableTokens.find(t => t.mint === toToken)?.logo }}
                            style={styles.tokenLogoSmall}
                          />
                        )}
                        <Text style={styles.swapTokenText}>
                          {availableTokens.find(t => t.mint === toToken)?.symbol || 'Select'}
                        </Text>
                      </View>
                      <ChevronDown size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {showToTokenDropdown && (
                    <View style={styles.swapDropdownContainer}>
                      <View style={styles.modalSearchContainer}>
                        <Search size={16} color={COLORS.textSecondary} />
                        <TextInput
                          style={styles.modalSearchInput}
                          placeholder="Search tokens..."
                          placeholderTextColor={COLORS.textSecondary}
                          value={toTokenSearch}
                          onChangeText={setToTokenSearch}
                        />
                      </View>
                      <ScrollView style={styles.swapDropdownList} showsVerticalScrollIndicator={false}>
                        {getFilteredTokens(toTokenSearch).map((token) => (
                          <TouchableOpacity
                            key={token.mint}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setToToken(token.mint);
                              setShowToTokenDropdown(false);
                              setToTokenSearch('');
                            }}
                          >
                            <View style={styles.tokenInfo}>
                              {token.logo && (
                                <Image source={{ uri: token.logo }} style={styles.tokenLogo} />
                              )}
                              <View>
                                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                                <Text style={styles.tokenName}>{token.name}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Slippage Tolerance */}
              <View style={styles.slippageContainer}>
                <Text style={styles.slippageLabel}>Slippage Tolerance</Text>
                <View style={styles.slippageOptions}>
                  {[0.1, 0.5, 1, 3].map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.slippageChip, slippage === v ? styles.activeSlippageChip : null]}
                      onPress={() => setSlippage(v)}
                    >
                      <Text style={[styles.slippageChipText, slippage === v ? styles.activeSlippageChipText : null]}>{v}%</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.slippageInputContainer}>
                    <TextInput
                      style={styles.slippageInput}
                      value={String(slippage)}
                      keyboardType="numeric"
                      placeholder="Custom"
                      placeholderTextColor={COLORS.textSecondary}
                      onChangeText={(text) => {
                        const num = Math.max(0, Math.min(50, parseFloat(text) || 0));
                        const fixed = Number.isFinite(num) ? parseFloat(num.toFixed(2)) : 0;
                        setSlippage(fixed);
                      }}
                    />
                    <Text style={styles.slippagePercent}>%</Text>
                  </View>
                </View>
              </View>

              <View style={styles.swapInfo}>
                <Text style={styles.swapInfoText}>Rate: 1 {fromToken} ≈ {fromToken === 'SOL' ? '150' : '0.0067'} {toToken}</Text>
                <Text style={styles.swapInfoText}>Minimum received at {slippage}%: {minReceived} {toToken}</Text>
                <Text style={styles.swapInfoText}>Network: Solana</Text>
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSwap}
              >
                <LinearGradient
                  colors={[COLORS.solana, COLORS.solana + '80']}
                  style={styles.actionGradient}
                >
                  <RefreshCw size={20} color={COLORS.textPrimary} />
                  <Text style={styles.actionText}>SWAP</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Send Modal */}
      <SendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={() => refetch()}
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

