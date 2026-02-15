import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  Image,
  useWindowDimensions,
  Linking,
  KeyboardAvoidingView,
  Platform,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, ChevronRight, X, TrendingUp } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { NeonCard, NeonButton, PortfolioSkeleton, ErrorBoundary } from '@/components';
import { fetchBalances, hasLocalWallet, getLocalPublicKey, Holding, sendTransaction, api } from '@/services';
import { fetchCopyConfig, createCopyConfig, stopCopyTrading, fetchCopyWallet, createCopyWallet, withdrawCopyWallet, CopyTradingWallet, fetchCopyPositions, CopyPosition } from '@/services/copyTrading';
import { getMyIBuyBag, IBuyPosition } from '@/services/ibuy';
import { getTriggerOrders, cancelTriggerOrder, TriggerOrder } from '@/services/trigger';
import { validateSession } from '@/utils';
import { useAlert } from '@/contexts/AlertContext';

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
  contractAddress?: string;
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
  exitWithTrader?: boolean;
  roi: number;
};

type PortfolioTab = 'tokens' | 'copied' | 'orders' | 'watchlist';
type ChartPeriod = '24h' | '7d' | '30d' | 'all';
type ChartType = 'line' | 'candle';

// Token Logo component with fallback - MEMOIZED
const TokenLogo = React.memo<{ token: Token }>(({ token }) => {
  const [failed, setFailed] = useState(false);

  if (!token.logo || failed) {
    return (
      <View style={styles.tokenLogoPlaceholder}>
        <Text style={styles.tokenLogoText}>{token.symbol.charAt(0)}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: token.logo }}
      style={styles.tokenLogo}
      onError={() => setFailed(true)}
    />
  );
});

// Memoized Token Item component for holdings tab
interface TokenItemProps {
  token: Token;
  onPress: () => void;
  getTokenPercentage: (value: number) => number;
}

const TokenItem = React.memo<TokenItemProps>(({ token, onPress, getTokenPercentage }) => {
  return (
    <Pressable
      style={styles.tokenItem}
      onPress={onPress}
    >
      <View style={styles.tokenRow}>
        <View style={styles.tokenLogoContainer}>
          <TokenLogo token={token} />
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
  );
}, (prev, next) => {
  // Custom comparison for React.memo
  return (
    prev.token.id === next.token.id &&
    prev.token.usdValue === next.token.usdValue &&
    prev.token.change24h === next.token.change24h &&
    prev.token.price === next.token.price
  );
});

// Memoized Watchlist Token Item
interface WatchlistItemProps {
  token: {
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
  };
  onPress: () => void;
  onRemove: () => void;
}

const WatchlistItem = React.memo<WatchlistItemProps>(({ token, onPress, onRemove }) => {
  return (
    <Pressable
      style={styles.tokenItem}
      onPress={onPress}
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
        <Text style={styles.tokenValueText}>
          {token.volume24h && token.volume24h > 0
            ? `Vol: $${token.volume24h >= 1000000
              ? (token.volume24h / 1000000).toFixed(1) + 'M'
              : token.volume24h >= 1000
                ? (token.volume24h / 1000).toFixed(1) + 'K'
                : token.volume24h.toFixed(0)}`
            : '—'}
        </Text>
        <Text style={styles.tokenPercentage}>24h</Text>
      </View>
      {/* Remove from watchlist button - small X at top right */}
      <Pressable
        style={styles.removeWatchlistButton}
        onPress={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      >
        <X size={14} color={COLORS.textSecondary} />
      </Pressable>
    </Pressable>
  );
}, (prev, next) => {
  return (
    prev.token.symbol === next.token.symbol &&
    prev.token.price === next.token.price &&
    prev.token.change24h === next.token.change24h
  );
});

export default function PortfolioScreen() {
  const router = useRouter();
  const { showAlert, showPrompt } = useAlert();

  // Real user profile state
  const [user, setUser] = useState<any>(null);
  const [solanaPublicKey, setSolanaPublicKey] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [copiedWallets, setCopiedWallets] = useState<CopiedWallet[]>([]);
  const [copyWallet, setCopyWallet] = useState<CopyTradingWallet | null>(null);
  const [isCopyWalletLoading, setIsCopyWalletLoading] = useState(false);
  const [isCopyWalletActionLoading, setIsCopyWalletActionLoading] = useState(false);
  const [isCopyLoading, setIsCopyLoading] = useState(false);

  // NEW: Positions state for earnings calculation
  const [iBuyPositions, setIBuyPositions] = useState<IBuyPosition[]>([]);
  const [copyPositions, setCopyPositions] = useState<CopyPosition[]>([]);

  // NEW: Trigger orders state
  const [triggerOrders, setTriggerOrders] = useState<TriggerOrder[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  // Abort controller refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch copy trading config from backend
  const loadCopyConfig = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      setIsCopyLoading(true);
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      if (signal?.aborted) return;
      
      const result = await fetchCopyConfig(token);
      if (signal?.aborted) return;
      
      if (result.success && result.config) {
        const cfg = result.config;
        setCopiedWallets([{
          id: cfg.id,
          address: cfg.traderAddress,
          name: (cfg as any).name || `Copy Trade`,
          isActive: cfg.isActive,
          pnl: 0,
          username: (cfg as any).name || `${cfg.traderAddress.slice(0, 6)}...${cfg.traderAddress.slice(-4)}`,
          walletAddress: cfg.traderAddress,
          totalAmount: cfg.totalInvestment,
          amountPerTrade: cfg.perTradeAmount,
          stopLoss: cfg.stopLossPercent,
          takeProfit: cfg.takeProfitPercent,
          exitWithTrader: cfg.exitWithTrader,
          roi: 0,
        }]);
      } else {
        setCopiedWallets([]);
      }
    } catch (e) {
      if (__DEV__) console.warn('Failed to load copy config', e);
    } finally {
      setIsCopyLoading(false);
    }
  }, []);

  const loadCopyWallet = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      setIsCopyWalletLoading(true);
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setCopyWallet(null);
        return;
      }
      if (signal?.aborted) return;

      const walletResult = await fetchCopyWallet(token);
      if (signal?.aborted) return;
      
      if (walletResult.success) {
        setCopyWallet(walletResult.wallet || null);
      } else {
        setCopyWallet(null);
      }
    } catch {
      setCopyWallet(null);
    } finally {
      setIsCopyWalletLoading(false);
    }
  }, []);

  // NEW: Load iBuy and Copy Trading positions
  const loadPositions = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setIBuyPositions([]);
        setCopyPositions([]);
        return;
      }
      if (signal?.aborted) return;

      // Fetch both position types in parallel
      const [iBuyRes, copyRes] = await Promise.all([
        getMyIBuyBag(),
        fetchCopyPositions(token)
      ]);
      
      if (signal?.aborted) return;

      if (iBuyRes.success) {
        setIBuyPositions(iBuyRes.positions || []);
      }
      if (copyRes.success) {
        setCopyPositions(copyRes.positions || []);
      }
    } catch (e) {
      if (__DEV__) console.warn('Failed to load positions', e);
    }
  }, []);

  // NEW: Load trigger/limit orders
  const loadTriggerOrders = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      setIsOrdersLoading(true);
      
      const orders = await getTriggerOrders('open');
      if (signal?.aborted) return;
      
      setTriggerOrders(orders);
    } catch (e) {
      if (__DEV__) console.warn('Failed to load trigger orders', e);
    } finally {
      setIsOrdersLoading(false);
    }
  }, []);

  // NEW: Cancel a trigger order
  const handleCancelOrder = useCallback(async (orderId: string) => {
    try {
      showAlert(
        'Cancel Order',
        'Are you sure you want to cancel this limit order?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                const tx = await cancelTriggerOrder(orderId);
                if (tx) {
                  showAlert('Success', 'Order cancelled successfully');
                  loadTriggerOrders(); // Refresh orders
                }
              } catch (error: any) {
                showAlert('Error', error.message || 'Failed to cancel order');
              }
            }
          }
        ]
      );
    } catch (e) {
      showAlert('Error', 'Failed to cancel order');
    }
  }, [showAlert, loadTriggerOrders]);

  const ensureCopyWallet = useCallback(async (): Promise<{ token: string; wallet: CopyTradingWallet | null }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      showAlert('Error', 'Please login first');
      return { token: '', wallet: null };
    }

    const existing = await fetchCopyWallet(token);
    if (existing.success && existing.wallet) {
      setCopyWallet(existing.wallet);
      return { token, wallet: existing.wallet };
    }

    const created = await createCopyWallet(token);
    if (created.success && created.wallet) {
      setCopyWallet(created.wallet);
      return { token, wallet: created.wallet };
    }

    showAlert('Error', created.error || existing.error || 'Failed to initialize trading wallet');
    return { token, wallet: null };
  }, [showAlert]);

  const handleDepositToCopyWallet = useCallback(() => {
    showPrompt(
      'Deposit SOL',
      'Enter amount of SOL to send to your trading wallet',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async (amountValue?: string) => {
            const amount = parseFloat((amountValue || '').trim());
            if (!Number.isFinite(amount) || amount <= 0) {
              showAlert('Invalid Amount', 'Please enter a valid SOL amount.');
              return;
            }

            const { token, wallet } = await ensureCopyWallet();
            if (!token || !wallet) return;

            showPrompt(
              'Enter PIN',
              'Enter your wallet PIN to confirm deposit',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Deposit',
                  onPress: async (pin?: string) => {
                    if (!pin || pin.length < 4) {
                      showAlert('Invalid PIN', 'PIN is required.');
                      return;
                    }

                    try {
                      setIsCopyWalletActionLoading(true);
                      const result = await sendTransaction(token, wallet.publicKey, amount, pin, 'SOL');
                      if (!result.success) {
                        showAlert('Deposit Failed', result.error || 'Failed to deposit SOL');
                        return;
                      }

                      await Promise.all([loadCopyWallet()]);
                      showAlert('Deposit Complete', `Sent ◎${amount.toFixed(4)} to trading wallet.`);
                    } finally {
                      setIsCopyWalletActionLoading(false);
                    }
                  }
                }
              ],
              true,
              'Enter PIN'
            );
          }
        }
      ],
      false,
      'Amount in SOL'
    );
  }, [ensureCopyWallet, loadCopyWallet, showAlert, showPrompt]);

  const handleWithdrawFromCopyWallet = useCallback(() => {
    showPrompt(
      'Withdraw SOL',
      'Enter amount to withdraw (leave blank to withdraw all available SOL)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async (amountValue?: string) => {
            const trimmed = (amountValue || '').trim();
            const parsedAmount = trimmed ? parseFloat(trimmed) : undefined;
            if (trimmed && (!Number.isFinite(parsedAmount) || (parsedAmount || 0) <= 0)) {
              showAlert('Invalid Amount', 'Please enter a valid SOL amount.');
              return;
            }

            const token = await SecureStore.getItemAsync('token');
            if (!token) {
              showAlert('Error', 'Please login first');
              return;
            }

            try {
              setIsCopyWalletActionLoading(true);
              const result = await withdrawCopyWallet(token, parsedAmount);
              if (!result.success) {
                showAlert('Withdraw Failed', result.error || 'Failed to withdraw SOL');
                return;
              }

              await Promise.all([loadCopyWallet()]);
              showAlert(
                'Withdraw Complete',
                `Received ◎${(result.withdrawnAmount || 0).toFixed(4)} from trading wallet.`
              );
            } finally {
              setIsCopyWalletActionLoading(false);
            }
          }
        }
      ],
      false,
      'Leave blank for all'
    );
  }, [loadCopyWallet, showAlert, showPrompt]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // FIXED: Calculate 24h market movement (not user PnL - that requires cost basis tracking)
  const marketMovement24h = React.useMemo(() => {
    return tokens.reduce((total, token) => {
      if (token.change24h && token.usdValue) {
        // Market movement = USD Value * (change24h / 100)
        return total + (token.usdValue * (token.change24h / 100));
      }
      return total;
    }, 0);
  }, [tokens]);

  // NEW: Calculate actual earnings from positions
  const copyTradeValue = React.useMemo(() => {
    return copyPositions.reduce((sum, p) => sum + (p.tokenAmount * (p.entryPrice || 0)), 0);
  }, [copyPositions]);

  const iBuyValue = React.useMemo(() => {
    return iBuyPositions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
  }, [iBuyPositions]);

  const totalPositionsValue = copyTradeValue + iBuyValue;

  // Fetch user profile from backend
  const fetchUserProfile = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      if (signal?.aborted) return;

      const data = await api.get<{ user: unknown }>('/me');
      if (signal?.aborted) return;
      setUser(data.user || data);
    } catch {
    }
  }, []);

  // Fetch wallet data from backend - with AbortController support
  const fetchWalletData = useCallback(async (isRefresh = false, signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        if (__DEV__) console.log('No auth token found');
        return;
      }
      if (signal?.aborted) return;

      // Check if wallet exists locally
      const hasLocal = await hasLocalWallet();
      let localPubkey: string | null = null;
      if (hasLocal) {
        localPubkey = await getLocalPublicKey();
        if (signal?.aborted) return;
        setSolanaPublicKey(localPubkey);
      }
      if (signal?.aborted) return;

      // Fetch balances from backend (works even if no local wallet)
      const portfolio = await fetchBalances(token);
      if (signal?.aborted) return;
      
      if (portfolio) {
        setTotalBalance(portfolio.totalUsdValue);
        // Use public key from backend if not available locally
        if (localPubkey) {
          setSolanaPublicKey(localPubkey);
        } else if (portfolio.publicKey) {
          setSolanaPublicKey(portfolio.publicKey);
        }

        // Transform holdings to Token type with real price data
        setTokens(portfolio.holdings.map((h: Holding, i: number) => ({
          id: String(i + 1),
          symbol: h.symbol,
          name: h.name,
          balance: h.balance,
          usdValue: h.usdValue,
          price: h.price || (h.balance > 0 ? h.usdValue / h.balance : 0),
          change24h: h.change24h || 0,
          value: h.usdValue,
          contractAddress: h.mint || '',
          ...(h.logo ? { logo: h.logo } : {}),
        })));
      } else {
        if (__DEV__) console.log('No portfolio data received');
      }
    } catch (err: any) {
      if (signal?.aborted) return;
      if (__DEV__) console.warn('Failed to fetch wallet data:', err);
      // If wallet not linked error, try to link it
      if (err.message?.includes('No wallet linked') || err.message?.includes('404')) {
        if (__DEV__) console.log('Wallet not linked, attempting to link...');
        const hasLocal = await hasLocalWallet();
        if (hasLocal) {
          const pubkey = await getLocalPublicKey();
          if (pubkey) {
            try {
              await api.post('/wallet/link', { publicKey: pubkey });
              if (__DEV__) console.log('Wallet linked, retrying fetch...');
              // Retry fetch
              fetchWalletData(isRefresh, signal);
              return;
            } catch (linkErr) {
              if (__DEV__) console.warn('Failed to link wallet:', linkErr);
            }
          }
        }
      }
      // Show error toast on refresh
      if (isRefresh) {
        showAlert('Error', 'Failed to fetch wallet data. Please try again.');
      }
    }
  }, [showAlert]);

  // Refetch function for pull-to-refresh
  const refetch = useCallback(async (signal?: AbortSignal) => {
    await Promise.all([
      fetchUserProfile(signal),
      fetchWalletData(true, signal)
    ]);
  }, [fetchUserProfile, fetchWalletData]);

  // Validate session on mount
  useEffect(() => {
    void validateSession();
  }, []);

  // Edit modal state — declared before useFocusEffect so we can skip refresh when modal is open
  const [selectedWallet, setSelectedWallet] = useState<CopiedWallet | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editAmountPerTrade, setEditAmountPerTrade] = useState('');
  const [editSL, setEditSL] = useState('');
  const [editTP, setEditTP] = useState('');
  const [editSlippage, setEditSlippage] = useState('');
  const [editExitWithTrader, setEditExitWithTrader] = useState(false);

  // FIXED: Reset modal state when closing
  const handleCloseModal = useCallback(() => {
    setSelectedWallet(null);
    setEditAmount('');
    setEditAmountPerTrade('');
    setEditSL('');
    setEditTP('');
    setEditSlippage('');
    setEditExitWithTrader(false);
  }, []);

  // Refresh when tab becomes focused - with AbortController
  useFocusEffect(
    useCallback(() => {
      // Skip refresh when edit modal is open to prevent input flickering
      if (selectedWallet) return;
      
      // Create new abort controller for this focus session
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      const loadAll = async () => {
        setIsLoading(true);
        await Promise.all([
          fetchUserProfile(signal),
          fetchWalletData(false, signal),
          loadCopyConfig(signal),
          loadCopyWallet(signal),
          loadPositions(signal)
        ]);
        if (!signal.aborted) {
          setIsLoading(false);
        }
      };
      loadAll();

      // Cleanup: abort pending requests when unfocusing
      return () => {
        abortControllerRef.current?.abort();
      };
    }, [fetchWalletData, fetchUserProfile, loadCopyConfig, loadCopyWallet, loadPositions, loadTriggerOrders, selectedWallet])
  );

  const [isUpdatingCopyTrade, setIsUpdatingCopyTrade] = useState(false);

  const updateCopiedWallet = async (_id: string, updates: any) => {
    try {
      setIsUpdatingCopyTrade(true);
      const token = await SecureStore.getItemAsync('token');
      if (!token) return false;

      // Find the current wallet to get current values
      const wallet = copiedWallets.find(w => w.id === _id);
      if (!wallet) return false;

      const result = await createCopyConfig({
        ...(wallet.name ? { name: wallet.name } : {}),
        traderAddress: wallet.address,
        totalInvestment: updates.totalAmount ?? wallet.totalAmount ?? 1000,
        perTradeAmount: updates.amountPerTrade ?? wallet.amountPerTrade ?? 100,
        stopLossPercent: updates.stopLoss ?? wallet.stopLoss ?? 10,
        takeProfitPercent: updates.takeProfit ?? wallet.takeProfit ?? 30,
        exitWithTrader: updates.exitWithTrader ?? wallet.exitWithTrader ?? true,
      }, token);

      if (result.success) {
        await loadCopyConfig();
        return true;
      } else {
        showAlert('Error', result.error || 'Failed to update copy trade');
        return false;
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update');
      return false;
    } finally {
      setIsUpdatingCopyTrade(false);
    }
  };

  const handleStopCopying = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      const result = await stopCopyTrading(token);
      if (result.success) {
        showAlert('Stopped', 'Copy trading has been stopped');
        setCopiedWallets([]);
        handleCloseModal();
        await loadCopyConfig();
      } else {
        showAlert('Error', result.error || 'Failed to stop copy trading');
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to stop');
    }
  };

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
  const [portfolioPeriod, setPortfolioPeriod] = useState<'1d' | '7d' | '30d' | '1y'>('1d');

  const loadWatchlist = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      const raw = await AsyncStorage.getItem('watchlist_tokens');
      if (signal?.aborted) return;
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

  // Remove token from watchlist
  const removeFromWatchlist = useCallback(async (symbolToRemove: string) => {
    try {
      const updatedList = watchlistTokens.filter(t => t.symbol !== symbolToRemove);
      setWatchlistTokens(updatedList);
      await AsyncStorage.setItem('watchlist_tokens', JSON.stringify(updatedList));
    } catch (e) {
      if (__DEV__) console.warn('Failed to remove from watchlist', e);
    }
  }, [watchlistTokens]);

  // FIXED: Pull-to-refresh with AbortController and proper error handling
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // Create abort controller for refresh
    const controller = new AbortController();
    const signal = controller.signal;
    
    try {
      await Promise.all([
        refetch(signal),
        loadPositions(signal),
        loadTriggerOrders(signal),
        loadWatchlist(signal),
        loadCopyConfig(signal),
        loadCopyWallet(signal)
      ]);
    } catch (err) {
      if (__DEV__) console.warn('Refresh error:', err);
      // Don't show alert on refresh - just let the data be stale
    } finally {
      if (!signal.aborted) {
        setRefreshing(false);
      }
    }
  }, [loadCopyConfig, loadCopyWallet, loadWatchlist, loadPositions, loadTriggerOrders, refetch]);

  useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  // Calculate percentages for token allocation
  const getTokenPercentage = useCallback((value: number) => {
    return totalBalance > 0 ? (value / totalBalance) * 100 : 0;
  }, [totalBalance]);

  // Token press handler - memoized
  const handleTokenPress = useCallback((token: Token) => {
    router.push({
      pathname: `/coin/${token.symbol.toLowerCase()}`,
      params: {
        symbol: token.symbol,
        name: token.name,
        logo: token.logo || '',
        price: String(token.price || 0),
        change: String(token.change24h || 0),
        contractAddress: token.contractAddress || '',
        banner: '',
        marketCap: '0',
        volume24h: '0',
        liquidity: '0',
      }
    } as any);
  }, [router]);

  // Watchlist token press handler
  const handleWatchlistPress = useCallback((watchToken: typeof watchlistTokens[0]) => {
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
  }, [router]);

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
                      { color: marketMovement24h >= 0 ? COLORS.success : COLORS.error }
                    ]}>
                      {marketMovement24h >= 0 ? '+' : ''}${marketMovement24h.toLocaleString()}
                    </Text>
                    <Text style={[
                      styles.pnlPercentage,
                      { color: marketMovement24h >= 0 ? COLORS.success : COLORS.error }
                    ]}>
                      ({marketMovement24h >= 0 ? '+' : ''}{totalBalance > marketMovement24h ? ((marketMovement24h / (totalBalance - marketMovement24h) * 100) || 0).toFixed(2) : '0.00'}%)
                    </Text>
                  </View>
                </View>
              </NeonCard>

              <View style={styles.earningsContainer}>
                <View style={styles.earningCard}>
                  <Text style={styles.earningLabel}>Copy Trade</Text>
                  <Text style={styles.earningValue}>${totalPositionsValue.toLocaleString()}</Text>
                </View>

                <View style={styles.earningCard}>
                  <Text style={styles.earningLabel}>Self</Text>
                  <Text style={styles.earningValue}>${Math.max(0, totalBalance - totalPositionsValue).toLocaleString()}</Text>
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
                    activeTab === 'orders' && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab('orders')}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === 'orders' && styles.activeTabText,
                  ]}>
                    Orders
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
                  {tokens.length === 0 && (
                    <View style={{ padding: SPACING.m, alignItems: 'center' }}>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' }}>
                        No tokens in your wallet yet.
                      </Text>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 12, marginTop: SPACING.s }}>
                        Buy tokens from the Market tab to see them here.
                      </Text>
                    </View>
                  )}
                  {tokens.map(token => (
                    <TokenItem
                      key={token.id}
                      token={token}
                      onPress={() => handleTokenPress(token)}
                      getTokenPercentage={getTokenPercentage}
                    />
                  ))}
                </View>
              )}

              {activeTab === 'copied' && (
                <View style={styles.walletsContainer}>
                  <NeonCard style={styles.tradingWalletCard}>
                    <View style={styles.tradingWalletHeader}>
                      <Text style={styles.tradingWalletTitle}>Trading Wallet</Text>
                      <Pressable
                        style={styles.tradingWalletRefresh}
                        onPress={() => { void loadCopyWallet(); }}
                        disabled={isCopyWalletLoading || isCopyWalletActionLoading}
                      >
                        <Text style={styles.tradingWalletRefreshText}>
                          {isCopyWalletLoading ? 'Loading...' : 'Refresh'}
                        </Text>
                      </Pressable>
                    </View>

                    {copyWallet ? (
                      <>
                        <Text style={styles.tradingWalletAddress}>
                          {copyWallet.publicKey.slice(0, 10)}...{copyWallet.publicKey.slice(-8)}
                        </Text>
                        <Text style={styles.tradingWalletBalance}>
                          Balance: ◎{copyWallet.balance.toFixed(4)}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.tradingWalletEmpty}>
                        No trading wallet yet. Create one to enable instant copy execution.
                      </Text>
                    )}

                    <View style={styles.tradingWalletActions}>
                      <Pressable
                        style={[styles.tradingWalletButton, (isCopyWalletLoading || isCopyWalletActionLoading) && styles.tradingWalletButtonDisabled]}
                        onPress={handleDepositToCopyWallet}
                        disabled={isCopyWalletLoading || isCopyWalletActionLoading}
                      >
                        <Text style={styles.tradingWalletButtonText}>Deposit</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.tradingWalletButton, styles.tradingWalletWithdrawButton, (isCopyWalletLoading || isCopyWalletActionLoading) && styles.tradingWalletButtonDisabled]}
                        onPress={handleWithdrawFromCopyWallet}
                        disabled={isCopyWalletLoading || isCopyWalletActionLoading}
                      >
                        <Text style={styles.tradingWalletWithdrawText}>Withdraw</Text>
                      </Pressable>
                    </View>
                  </NeonCard>
                  {isCopyLoading ? (
                    <View style={{ padding: SPACING.m, alignItems: 'center' }}>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 14 }}>Loading copy trades...</Text>
                    </View>
                  ) : copiedWallets.length === 0 ? (
                    <View style={{ padding: SPACING.m, alignItems: 'center' }}>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' }}>
                        No active copy trades.
                      </Text>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 12, marginTop: SPACING.s, textAlign: 'center' }}>
                        Go to Home → Copy Trade to set up copy trading.
                      </Text>
                    </View>
                  ) : (
                    copiedWallets.map(wallet => (
                      <NeonCard key={wallet.id} style={styles.walletCard}>
                        <View style={styles.walletHeader}>
                          <View style={styles.walletInfo}>
                            <Text style={styles.walletUsername}>{wallet.name}</Text>
                            <Text style={styles.copiedWalletAddress}>
                              {wallet.walletAddress ? `${wallet.walletAddress.slice(0, 8)}...${wallet.walletAddress.slice(-6)}` : wallet.address}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              style={styles.editButton}
                              onPress={() => {
                                setSelectedWallet(wallet);
                                setEditAmount(wallet.totalAmount?.toString() || '1000');
                                setEditAmountPerTrade(wallet.amountPerTrade?.toString() || '100');
                                setEditSL(wallet.stopLoss ? Math.abs(wallet.stopLoss).toString() : '10');
                                setEditTP(wallet.takeProfit?.toString() || '30');
                                setEditSlippage(wallet.slippage?.toString() || '1');
                                setEditExitWithTrader(wallet.exitWithTrader ?? false);
                              }}
                            >
                              <Text style={styles.editButtonText}>Edit</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.editButton, { backgroundColor: COLORS.error + '20' }]}
                              onPress={() => {
                                showAlert(
                                  'Delete Copy Trade',
                                  'Are you sure you want to permanently remove this copy trade setup?',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Delete', style: 'destructive', onPress: () => handleStopCopying() },
                                  ]
                                );
                              }}
                            >
                              <Text style={[styles.editButtonText, { color: COLORS.error }]}>Delete</Text>
                            </Pressable>
                          </View>
                        </View>

                        <View style={styles.walletStats}>
                          <View style={styles.walletStat}>
                            <Text style={styles.walletStatLabel}>Budget</Text>
                            <Text style={[styles.walletStatValue, { color: COLORS.textPrimary }]}>◎{wallet.totalAmount?.toFixed(1) || '0'}</Text>
                          </View>
                          <View style={styles.walletStat}>
                            <Text style={styles.walletStatLabel}>Per Trade</Text>
                            <Text style={[styles.walletStatValue, { color: COLORS.textPrimary }]}>◎{wallet.amountPerTrade?.toFixed(2) || '0'}</Text>
                          </View>
                          {wallet.exitWithTrader ? (
                            <View style={styles.walletStat}>
                              <Text style={styles.walletStatLabel}>Strategy</Text>
                              <Text style={[styles.walletStatValue, { color: COLORS.solana }]}>Exit with Trader</Text>
                            </View>
                          ) : (
                            <>
                              <View style={styles.walletStat}>
                                <Text style={styles.walletStatLabel}>SL</Text>
                                <Text style={[styles.walletStatValue, { color: COLORS.error }]}>{wallet.stopLoss}%</Text>
                              </View>
                              <View style={styles.walletStat}>
                                <Text style={styles.walletStatLabel}>TP</Text>
                                <Text style={[styles.walletStatValue, { color: COLORS.success }]}>{wallet.takeProfit}%</Text>
                              </View>
                            </>
                          )}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: wallet.isActive ? COLORS.success : COLORS.error }} />
                          <Text style={{ ...FONTS.sfProRegular, color: wallet.isActive ? COLORS.success : COLORS.error, fontSize: 12 }}>
                            {wallet.isActive ? 'Active' : 'Paused'}
                          </Text>
                        </View>
                      </NeonCard>
                    ))
                  )}
                </View>
              )}

              {activeTab === 'orders' && (
                <View style={styles.walletsContainer}>
                  {isOrdersLoading ? (
                    <View style={{ padding: SPACING.m, alignItems: 'center' }}>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 14 }}>
                        Loading orders...
                      </Text>
                    </View>
                  ) : triggerOrders.length === 0 ? (
                    <View style={{ padding: SPACING.m, alignItems: 'center' }}>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' }}>
                        No active limit orders.
                      </Text>
                      <Text style={{ ...FONTS.sfProRegular, color: COLORS.textSecondary, fontSize: 12, marginTop: SPACING.s, textAlign: 'center' }}>
                        Go to any coin and select "Target" to create a limit order.
                      </Text>
                    </View>
                  ) : (
                    triggerOrders.map((order) => (
                      <NeonCard key={order.id} style={styles.walletCard}>
                        <View style={styles.walletHeader}>
                          <View style={styles.walletInfo}>
                            <Text style={styles.walletUsername}>
                              {order.inputMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'Token'} 
                              → 
                              {order.outputMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'Token'}
                            </Text>
                            <Text style={styles.copiedWalletAddress}>
                              Order ID: {order.id.slice(0, 8)}...{order.id.slice(-6)}
                            </Text>
                          </View>

                          <Pressable
                            style={[styles.editButton, { backgroundColor: COLORS.error + '20' }]}
                            onPress={() => handleCancelOrder(order.id)}
                          >
                            <Text style={[styles.editButtonText, { color: COLORS.error }]}>Cancel</Text>
                          </Pressable>
                        </View>

                        <View style={styles.walletStats}>
                          <View style={styles.walletStat}>
                            <Text style={styles.walletStatLabel}>Status</Text>
                            <Text style={[styles.walletStatValue, { color: COLORS.success }]}>{order.status}</Text>
                          </View>
                          <View style={styles.walletStat}>
                            <Text style={styles.walletStatLabel}>Created</Text>
                            <Text style={[styles.walletStatValue, { color: COLORS.textPrimary }]}>
                              {new Date(order.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.solana }} />
                          <Text style={{ ...FONTS.sfProRegular, color: COLORS.solana, fontSize: 12 }}>
                            Limit Order Active
                          </Text>
                        </View>
                      </NeonCard>
                    ))
                  )}
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
                      <WatchlistItem
                        key={watchToken.symbol}
                        token={watchToken}
                        onPress={() => handleWatchlistPress(watchToken)}
                        onRemove={() => removeFromWatchlist(watchToken.symbol)}
                      />
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
                    { color: marketMovement24h >= 0 ? COLORS.success : COLORS.error }
                  ]}>
                    {marketMovement24h >= 0 ? '+' : ''}${marketMovement24h.toLocaleString()} ({chartPeriod})
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
                    showAlert('No Wallet', 'Connect a wallet to view activity');
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

      {/* Edit Copied Wallet Modal */}
      <Modal
        visible={selectedWallet !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
            {/* Tappable backdrop area to dismiss */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleCloseModal}
            />
            {/* Modal content — regular View so it doesn't steal touches from TextInput */}
            <View
              style={[
                styles.modalContainer,
                {
                  borderRadius: BORDER_RADIUS.large,
                  width: '90%',
                  height: '75%'
                }
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Copy Trading</Text>
                <Pressable onPress={handleCloseModal}>
                  <X size={24} color={COLORS.textPrimary} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalContent}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
              >
                <Text style={styles.editWalletTitle}>{selectedWallet?.name || selectedWallet?.username}</Text>

                <View style={styles.editInputSection}>
                  <Text style={styles.editInputLabel}>Total Amount (SOL)</Text>
                  <View style={styles.editInputContainer}>
                    <TextInput
                      style={styles.editInput}
                      placeholder="1000"
                      placeholderTextColor={COLORS.textSecondary}
                      value={editAmount}
                      onChangeText={setEditAmount}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.editInputSection}>
                  <Text style={styles.editInputLabel}>Amount per Trade (SOL)</Text>
                  <View style={styles.editInputContainer}>
                    <TextInput
                      style={styles.editInput}
                      placeholder="100"
                      placeholderTextColor={COLORS.textSecondary}
                      value={editAmountPerTrade}
                      onChangeText={setEditAmountPerTrade}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.editInputSection}>
                  <Text style={styles.editInputLabel}>Stop Loss (%)</Text>
                  <View style={styles.editInputContainer}>
                    <TextInput
                      style={styles.editInput}
                      placeholder="10"
                      placeholderTextColor={COLORS.textSecondary}
                      value={editSL}
                      onChangeText={setEditSL}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.editInputSection}>
                  <Text style={styles.editInputLabel}>Take Profit (%)</Text>
                  <View style={styles.editInputContainer}>
                    <TextInput
                      style={styles.editInput}
                      placeholder="30"
                      placeholderTextColor={COLORS.textSecondary}
                      value={editTP}
                      onChangeText={setEditTP}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.editInputSection}>
                  <Text style={styles.editInputLabel}>Slippage (%)</Text>
                  <View style={styles.editInputContainer}>
                    <TextInput
                      style={styles.editInput}
                      placeholder="1"
                      placeholderTextColor={COLORS.textSecondary}
                      value={editSlippage}
                      onChangeText={setEditSlippage}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Exit with Trader Toggle */}
                <Pressable
                  style={[styles.exitWithTraderButton, editExitWithTrader && styles.exitWithTraderButtonActive]}
                  onPress={() => {
                    const next = !editExitWithTrader;
                    setEditExitWithTrader(next);
                    if (next) {
                      // Clear TP/SL when enabling exit-with-trader
                      setEditSL('');
                      setEditTP('');
                    }
                  }}
                >
                  <Text style={[styles.exitWithTraderText, editExitWithTrader && styles.exitWithTraderTextActive]}>
                    {editExitWithTrader ? '✓ ' : ''}Exit with Trader
                  </Text>
                  <Text style={styles.exitWithTraderSubtext}>
                    {editExitWithTrader
                      ? 'Will exit when trader exits (no custom TP/SL)'
                      : 'Automatically exit when trader exits'}
                  </Text>
                </Pressable>

                <View style={styles.editActions}>
                  <NeonButton
                    title="Stop Copying"
                    onPress={async () => {
                      await handleStopCopying();
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
                        updates.exitWithTrader = editExitWithTrader;

                        const success = await updateCopiedWallet(selectedWallet.id, updates);
                        if (success) {
                          showAlert('Success', 'Copy trade settings updated');
                          handleCloseModal();
                        }
                      }
                    }}
                    style={[styles.editActionButton, isUpdatingCopyTrade && { opacity: 0.6 }]}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    marginBottom: SPACING.s,
    position: 'relative'
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
  removeWatchlistButton: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  walletsContainer: {
    marginBottom: SPACING.xs
  },
  tradingWalletCard: {
    marginBottom: SPACING.s
  },
  tradingWalletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs
  },
  tradingWalletTitle: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 15
  },
  tradingWalletRefresh: {
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4
  },
  tradingWalletRefreshText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 12
  },
  tradingWalletAddress: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  tradingWalletBalance: {
    ...FONTS.monospace,
    color: COLORS.success,
    fontSize: 14,
    marginTop: SPACING.xs
  },
  tradingWalletEmpty: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 13
  },
  tradingWalletActions: {
    flexDirection: 'row',
    marginTop: SPACING.s,
    gap: SPACING.s
  },
  tradingWalletButton: {
    flex: 1,
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.small,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.solana + '30'
  },
  tradingWalletWithdrawButton: {
    backgroundColor: COLORS.error + '12',
    borderColor: COLORS.error + '35'
  },
  tradingWalletButtonDisabled: {
    opacity: 0.6
  },
  tradingWalletButtonText: {
    ...FONTS.orbitronMedium,
    color: COLORS.solana,
    fontSize: 13
  },
  tradingWalletWithdrawText: {
    ...FONTS.orbitronMedium,
    color: COLORS.error,
    fontSize: 13
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
  exitWithTraderButton: {
    backgroundColor: COLORS.solana + '10',
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginBottom: SPACING.m,
  },
  exitWithTraderButtonActive: {
    backgroundColor: COLORS.solana + '20',
    borderColor: COLORS.solana + '30',
  },
  exitWithTraderText: {
    ...FONTS.phantomBold,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  exitWithTraderTextActive: {
    color: COLORS.solana,
  },
  exitWithTraderSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: 'bold'
  },
  checkboxLabel: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14
  },
  editInputSection: {
    marginBottom: SPACING.m
  },
  editInputLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.s
  },
  editInputContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
    padding: SPACING.m
  },
  editInput: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16,
    padding: 0
  }
});
