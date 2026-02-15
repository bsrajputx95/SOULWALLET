import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SimpleCandlestickChart } from '@/components/SimpleCandlestickChart';
import { COLORS, BORDER_RADIUS, FONTS, SPACING } from '@/constants';
import { NeonCard, NeonButton, GlowingText } from '@/components';
import { formatSubscriptPrice, formatLargeNumber as formatLargeNum, showErrorToast, showSuccessToast } from '@/utils';
import { getQuote, executeSwap, getTokenDecimals } from '@/services/swap';
import { createTriggerOrder, executeTriggerOrder } from '@/services/trigger';
import { getLocalPublicKey } from '@/services/wallet';
import { useAlert } from '@/contexts/AlertContext';

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
  banner?: string | null; // Banner/header image from DexScreener
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

export default function CoinDetailsScreen() {
  const { showAlert, showPrompt } = useAlert();
  // Read all params passed from home screen for data consistency
  const params = useLocalSearchParams<{
    symbol: string;
    price?: string;
    change?: string;
    logo?: string;
    banner?: string;
    contractAddress?: string;
    pairAddress?: string;
    name?: string;
    marketCap?: string;
    volume24h?: string;
    liquidity?: string;
  }>();
  const symbol = params.symbol;

  // Use passed data if available (from home screen navigation)
  const passedPrice = params.price ? parseFloat(params.price) : undefined;
  const passedChange = params.change ? parseFloat(params.change) : undefined;
  const passedLogo = params.logo || undefined;
  const passedBanner = params.banner || undefined;
  const passedContractAddress = params.contractAddress || undefined;
  const passedPairAddress = params.pairAddress || undefined;
  const passedName = params.name || undefined;
  const passedMarketCap = params.marketCap ? parseFloat(params.marketCap) : undefined;
  const passedVolume24h = params.volume24h ? parseFloat(params.volume24h) : undefined;
  const passedLiquidity = params.liquidity ? parseFloat(params.liquidity) : undefined;

  // Helper to format display name when symbol is missing/unknown
  const getDisplaySymbol = () => {
    if (symbol && symbol.toUpperCase() !== 'UNKNOWN') return symbol.toUpperCase();
    if (passedName) return passedName.slice(0, 8).toUpperCase();
    if (passedContractAddress) return passedContractAddress.slice(0, 6) + '...';
    return 'TOKEN';
  };

  // Fetch real token data from API - use symbol if valid, otherwise skip
  const shouldFetchBySymbol = !!symbol && symbol.toUpperCase() !== 'UNKNOWN';

  // Mock token details query - uses passed params or fallback data
  const apiData: any = null; // Local-only mode, no external API
  const isLoadingApi = false;
  const refetchApi = async () => ({});

  // Transform API data to CoinData format - prefer passed params for consistency
  // CRITICAL: Create fallback coinData from passed params even if API fails
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
        age: apiData.pairAge ? apiData.pairAge + 'h' : 'Unknown',
        pairAge: apiData.pairAge,
        // Use passed logo from home screen for consistency
        logo: passedLogo || apiData.logo,
        // Banner/header image
        banner: apiData.banner || null,
        description: apiData.description,
        website: apiData.website,
        twitter: apiData.twitter,
        telegram: apiData.telegram,
        txns24h: apiData.txns24h,
      };
    }

    // Fallback: Create coinData from passed params if we have pairAddress or contractAddress
    // This ensures TokenInfo always loads if DexScreener data was passed
    if (passedPairAddress || passedContractAddress) {
      return {
        symbol: getDisplaySymbol(),
        name: passedName || 'Unknown Token',
        price: passedPrice ?? 0,
        change24h: passedChange ?? 0,
        marketCap: passedMarketCap ?? 0,
        volume24h: passedVolume24h ?? 0,
        liquidity: passedLiquidity ?? 0,
        holders: 0,
        contractAddress: passedContractAddress || passedPairAddress || '',
        verified: false,
        age: 'Unknown',
        logo: passedLogo || null,
        banner: passedBanner || null,
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
  }, [apiData, symbol, passedPrice, passedChange, passedLogo, passedContractAddress, passedPairAddress, passedName]);

  // Removed: transactions and topTraders state - tabs now show "Coming Soon"
  const [activeTab, setActiveTab] = useState<'chart' | 'trades' | 'holders'>('chart');
  const [refreshing, setRefreshing] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [sentimentTimeframe, setSentimentTimeframe] = useState<'1h' | '1d' | '1w' | '1m' | '1y'>('1d');
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1h');
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 640;

  // Mock price history - using static mock data (pure UI mode)
  const isLoadingChart = false;

  // Convert to OHLCV format for candlestick chart - always mock in pure UI mode
  const chartData = useMemo(() => {
    // Generate mock OHLCV data (pure UI mode - no real API data)
    return Array.from({ length: 50 }, (_v, _i) => {
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
  }, [coinData?.price]);

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
      const arr: any[] = raw ? JSON.parse(raw) : [];

      // Check if token exists (by symbol, supporting both old string format and new object format)
      const existingIndex = arr.findIndex((item: any) =>
        typeof item === 'string' ? item === token : item.symbol === token
      );

      if (existingIndex >= 0) {
        // Remove from watchlist
        const next = arr.filter((_, i) => i !== existingIndex);
        setWatchlisted(false);
        await AsyncStorage.setItem('watchlist_tokens', JSON.stringify(next));
        showAlert('Removed from watchlist');
      } else {
        // Add full token data to watchlist
        const tokenData = {
          symbol: token,
          name: coinData?.name || passedName || token,
          logo: coinData?.logo || passedLogo || '',
          price: coinData?.price || passedPrice || 0,
          change24h: coinData?.change24h || passedChange || 0,
          contractAddress: coinData?.contractAddress || passedContractAddress || '',
          banner: coinData?.banner || passedBanner || '',
          marketCap: coinData?.marketCap || passedMarketCap || 0,
          volume24h: coinData?.volume24h || passedVolume24h || 0,
          liquidity: coinData?.liquidity || passedLiquidity || 0,
        };
        const next = [...arr, tokenData];
        setWatchlisted(true);
        await AsyncStorage.setItem('watchlist_tokens', JSON.stringify(next));
        showAlert('Added to watchlist');
      }
    } catch (e) {
      showAlert('Error', 'Could not update watchlist');
    }
  };

  // Top bar removed

  // Trade modal state
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | null>(null);
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [tradePriceType, setTradePriceType] = useState<'market' | 'target'>('market');
  const [tradeTargetPrice, setTradeTargetPrice] = useState<string>('');
  const [tradeSlippage, setTradeSlippage] = useState<string>('1.0');
  const [isTrading, setIsTrading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);

  // Token addresses
  const SOL_MINT = 'So11111111111111111111111111111111111111112';


  const openTradeModal = async (mode: 'buy' | 'sell') => {
    setTradeMode(mode);
    setTradeAmount('');
    setTradePriceType('market');
    setTradeTargetPrice('');
    setTradeSlippage('1.0');
    setTradeModalVisible(true);

    // Fetch balances when opening modal
    await fetchBalances();
  };

  const closeTradeModal = () => {
    setTradeModalVisible(false);
    setIsTrading(false);
  };

  // Fetch user's token balances
  const fetchBalances = async () => {
    try {
      const publicKey = await getLocalPublicKey();
      if (!publicKey) return;

      // Fetch balances from backend
      const { fetchBalances: fetchWalletBalances } = await import('@/services/wallet');

      // Get token from SecureStore
      const authToken = await import('expo-secure-store').then(s => s.getItemAsync('token'));
      if (!authToken) return;

      const portfolio = await fetchWalletBalances(authToken);
      if (portfolio) {
        // Find the token balance
        const tokenHolding = portfolio.holdings.find(
          h => h.mint.toLowerCase() === (coinData?.contractAddress || '').toLowerCase()
        );
        setTokenBalance(tokenHolding?.balance || 0);

        // Find SOL balance
        const solHolding = portfolio.holdings.find(
          h => h.mint === SOL_MINT
        );
        setSolBalance(solHolding?.balance || 0);


      }
    } catch (error) {
      console.error('[Trade] Failed to fetch balances:', error);
    }
  };

  // Handle MAX button for sell
  const handleMaxSell = () => {
    setTradeAmount(tokenBalance.toString());
  };

  // Get current balance based on mode
  const getCurrentBalance = () => {
    if (tradeMode === 'buy') {
      return solBalance;
    }
    return tokenBalance;
  };

  // Get input mint address (SOL for buy, token for sell)
  const getInputMint = () => {
    if (tradeMode === 'buy') {
      return SOL_MINT;
    }
    return coinData?.contractAddress || '';
  };

  // Get output mint address (token for buy, SOL for sell)
  const getOutputMint = () => {
    if (tradeMode === 'buy') {
      return coinData?.contractAddress || '';
    }
    return SOL_MINT;
  };

  // Execute market order via swap API
  const executeMarketOrder = async () => {
    try {
      const amount = parseFloat(tradeAmount);
      if (isNaN(amount) || amount <= 0) {
        showAlert('Invalid Amount', 'Please enter a valid amount');
        return;
      }

      // Check balance
      const balance = getCurrentBalance();
      if (amount > balance) {
        showAlert('Insufficient Balance', 'You only have ' + balance.toFixed(6) + ' ' + (tradeMode === 'buy' ? 'SOL' : coinData?.symbol));
        return;
      }

      setIsTrading(true);

      // Get token decimals
      const inputMint = getInputMint();
      const outputMint = getOutputMint();
      const inputDecimals = await getTokenDecimals(inputMint);

      // Convert amount to raw units
      const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals));

      // Get slippage in bps (1% = 100 bps)
      const slippageBps = Math.floor(parseFloat(tradeSlippage || '0.5') * 100);

      showSuccessToast('Getting best price...');

      // Get quote from Jupiter
      const quote = await getQuote(inputMint, outputMint, rawAmount, slippageBps);

      if (!quote) {
        throw new Error('Could not get swap quote');
      }

      // Request PIN for signing
      const outDecimals = await getTokenDecimals(outputMint);
      const outAmount = (parseInt(quote.outAmount) / Math.pow(10, outDecimals)).toFixed(6);

      showAlert(
        'Confirm Swap',
        (tradeMode === 'buy' ? 'Buy ' : 'Sell ') + amount + ' ' + (tradeMode === 'buy' ? 'SOL' : coinData?.symbol) + ' for ~' + outAmount + ' ' + (tradeMode === 'buy' ? coinData?.symbol : 'SOL'),
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsTrading(false) },
          {
            text: 'Confirm',
            onPress: () => executeMarketSwap(quote)
          },
        ]
      );
    } catch (error: any) {
      if (__DEV__) console.error('[Trade] Market order failed:', error);
      const msg = error?.message || 'Swap failed';
      if (msg.includes('slippage') || msg.includes('Slippage') || msg.includes('Price changed')) {
        // Auto-bump slippage and notify user
        const currentSlippage = parseFloat(tradeSlippage || '1.0');
        const newSlippage = Math.min(currentSlippage * 2, 5).toFixed(1);
        setTradeSlippage(newSlippage);
        showErrorToast(`Price moved too fast. Slippage increased to ${newSlippage}% — please retry.`);
      } else {
        showErrorToast(msg);
      }
      setIsTrading(false);
    }
  };

  // Execute the actual swap transaction
  const executeMarketSwap = async (quote: any) => {
    try {
      showSuccessToast('Please enter your PIN to sign...');

      // Request PIN from user
      showPrompt(
        'Enter PIN',
        'Enter your wallet PIN to sign the transaction',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsTrading(false) },
          {
            text: 'Sign & Swap',
            onPress: async (pin?: string) => {
              if (!pin) {
                showErrorToast('PIN is required');
                setIsTrading(false);
                return;
              }

              try {
                showSuccessToast('Executing swap...');
                const result = await executeSwap(quote, pin);

                if (result.success) {
                  showSuccessToast('Swap successful!');
                  showAlert(
                    'Swap Successful!',
                    'Transaction: ' + result.signature?.slice(0, 20) + '...',
                    [
                      { text: 'View on Solscan', onPress: () => Linking.openURL(result.explorerUrl || '') },
                      { text: 'OK', style: 'cancel' },
                    ]
                  );
                  closeTradeModal();
                } else {
                  throw new Error(result.error || 'Swap failed');
                }
              } catch (error: any) {
                if (__DEV__) console.error('[Trade] Swap execution failed:', error);
                showErrorToast(error.message || 'Swap failed');
                setIsTrading(false);
              }
            },
          },
        ],
        true,
        'Enter PIN'
      );
    } catch (error: any) {
      if (__DEV__) console.error('[Trade] Market swap failed:', error);
      showErrorToast(error.message || 'Swap failed');
      setIsTrading(false);
    }
  };

  // Execute limit order via trigger API
  const executeLimitOrder = async () => {
    try {
      const amount = parseFloat(tradeAmount);
      const targetPrice = parseFloat(tradeTargetPrice);

      if (isNaN(amount) || amount <= 0) {
        showAlert('Invalid Amount', 'Please enter a valid amount');
        return;
      }

      if (isNaN(targetPrice) || targetPrice <= 0) {
        showAlert('Invalid Target Price', 'Please enter a valid target price');
        return;
      }

      // Check balance
      const balance = getCurrentBalance();
      if (amount > balance) {
        showAlert('Insufficient Balance', 'You only have ' + balance.toFixed(6) + ' ' + (tradeMode === 'buy' ? 'SOL' : coinData?.symbol));
        return;
      }

      setIsTrading(true);

      const inputMint = getInputMint();
      const outputMint = getOutputMint();
      const inputDecimals = await getTokenDecimals(inputMint);
      const outputDecimals = await getTokenDecimals(outputMint);

      let makingAmount: string;
      let takingAmount: string;

      if (tradeMode === 'buy') {
        // Buying: input is SOL, output is token
        // makingAmount = how much SOL we're spending
        // takingAmount = how much token we want at target price
        const inputRaw = Math.floor(amount * Math.pow(10, inputDecimals));
        makingAmount = inputRaw.toString();

        // Calculate output based on target price
        // For buy: targetPrice is in USD per token
        // We need to calculate how many tokens we get for our SOL
        // Use token's current price for calculations
        const solPriceUsd = coinData?.price || 150;
        const solValueUsd = amount * solPriceUsd;
        const expectedTokens = solValueUsd / targetPrice;
        takingAmount = Math.floor(expectedTokens * Math.pow(10, outputDecimals)).toString();
      } else {
        // Selling: input is token, output is SOL
        // makingAmount = how much token we're selling
        // takingAmount = how much SOL we want at target price
        const inputRaw = Math.floor(amount * Math.pow(10, inputDecimals));
        makingAmount = inputRaw.toString();

        // Calculate output based on target price
        // For sell: targetPrice is in USD per token
        const tokenValueUsd = amount * targetPrice;
        // Use token's current price for calculations
        const solPriceUsd = coinData?.price || 150;
        const expectedSol = tokenValueUsd / solPriceUsd;
        takingAmount = Math.floor(expectedSol * Math.pow(10, outputDecimals)).toString();
      }

      showAlert(
        'Confirm Limit Order',
        'Create limit order to ' + (tradeMode === 'buy' ? 'buy' : 'sell') + ' ' + amount + ' ' + coinData?.symbol + ' at $' + targetPrice,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsTrading(false) },
          {
            text: 'Create Order',
            onPress: async () => {
              try {
                showSuccessToast('Creating limit order...');

                const order = await createTriggerOrder({
                  inputMint,
                  outputMint,
                  makingAmount,
                  takingAmount,
                  slippageBps: Math.floor(parseFloat(tradeSlippage || '0.5') * 100),
                });

                if (!order) {
                  throw new Error('Failed to create limit order');
                }

                // Request PIN to sign
                showPrompt(
                  'Enter PIN',
                  'Enter your wallet PIN to sign the limit order',
                  [
                    { text: 'Cancel', style: 'cancel', onPress: () => setIsTrading(false) },
                    {
                      text: 'Sign & Submit',
                      onPress: async (pin?: string) => {
                        if (!pin) {
                          showErrorToast('PIN is required');
                          setIsTrading(false);
                          return;
                        }

                        try {
                          // Decode and sign transaction
                          const { Keypair } = await import('@solana/web3.js');
                          const { decryptWalletSecret } = await import('@/services/wallet');
                          const secretKey = await decryptWalletSecret(pin);

                          if (!secretKey) {
                            throw new Error('Invalid PIN');
                          }

                          const keypair = Keypair.fromSecretKey(secretKey);

                          // Deserialize transaction
                          const { Buffer } = await import('buffer');
                          const transactionBuffer = Buffer.from(order.transaction, 'base64');
                          const { VersionedTransaction } = await import('@solana/web3.js');
                          const transaction = VersionedTransaction.deserialize(transactionBuffer);

                          // Sign
                          transaction.sign([keypair]);

                          // Execute
                          const signedTx = Buffer.from(transaction.serialize()).toString('base64');
                          const result = await executeTriggerOrder(signedTx, order.orderId);

                          if (result) {
                            showSuccessToast('Limit order created!');
                            showAlert(
                              'Limit Order Created!',
                              'Your order will execute when the price reaches $' + targetPrice,
                              [{ text: 'OK' }]
                            );
                            closeTradeModal();
                          } else {
                            throw new Error('Failed to submit order');
                          }
                        } catch (error: any) {
                          if (__DEV__) console.error('[Trade] Limit order submission failed:', error);
                          showErrorToast(error.message || 'Failed to submit order');
                          setIsTrading(false);
                        }
                      },
                    },
                  ],
                  true,
                  'Enter PIN'
                );
              } catch (error: any) {
                if (__DEV__) console.error('[Trade] Limit order creation failed:', error);
                showErrorToast(error.message || 'Failed to create limit order');
                setIsTrading(false);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      if (__DEV__) console.error('[Trade] Limit order failed:', error);
      showErrorToast(error.message || 'Failed to create limit order');
      setIsTrading(false);
    }
  };

  const confirmTrade = async () => {
    if (tradePriceType === 'market') {
      await executeMarketOrder();
    } else {
      await executeLimitOrder();
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
    showAlert('Copied', 'Address copied to clipboard');
  };

  const openLink = (url: string) => {
    void Linking.openURL(url);
  };

  const formatPrice = formatSubscriptPrice;

  const formatLargeNumber = formatLargeNum;

  // Loading state - only show if we're fetching by symbol AND don't have fallback data
  if (isLoadingApi && shouldFetchBySymbol && !passedPairAddress && !passedContractAddress) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.solana} />
        <Text style={styles.loadingText}>Loading {getDisplaySymbol()}...</Text>
      </View>
    );
  }

  // Error state - only show if we have NO data at all (no API data AND no passed params)
  if (!coinData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Token Not Found</Text>
        <Text style={styles.errorText}>
          {'Could not find data for ' + getDisplaySymbol()}
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
        {/* Banner Image (if available from DexScreener) */}
        {coinData.banner && (
          <View style={styles.bannerContainer}>
            <Image
              source={{ uri: coinData.banner }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', COLORS.background]}
              style={styles.bannerGradient}
            />
          </View>
        )}

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
                  <GlowingText
                    text={coinData.symbol.length > 10 ? coinData.symbol.slice(0, 10) + '...' : coinData.symbol}
                    style={styles.tokenSymbol}
                    fontSize={coinData.symbol.length <= 4 ? 24 : coinData.symbol.length <= 6 ? 20 : coinData.symbol.length <= 8 ? 16 : 14}
                  />
                  {coinData.verified && (
                    <Shield color={COLORS.success} size={16} style={styles.verifiedIcon} />
                  )}
                </View>
                <Text style={styles.tokenName} numberOfLines={1} ellipsizeMode="tail">{coinData.name}</Text>
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

        {/* About / Description */}
        {coinData.description && (
          <NeonCard style={styles.aboutCard}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text
              style={styles.aboutText}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {coinData.description}
            </Text>
          </NeonCard>
        )}

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
          <View style={[styles.modalCard, isTrading && styles.modalCardDisabled]}>
            <Text style={styles.modalTitle}>
              {tradeMode === 'buy' ? 'Buy' : 'Sell'} {coinData.symbol}
              {isTrading && ' (Processing...)'}
            </Text>

            {/* Single-page trade form */}
            <View style={styles.modalSection}>
              {/* Balance Display */}
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>
                  {tradeMode === 'buy'
                    ? 'SOL Balance: ' + solBalance.toFixed(4) + ' SOL'
                    : 'Token Balance: ' + tokenBalance.toFixed(6) + ' ' + coinData.symbol}
                </Text>
              </View>

              <Text style={styles.modalLabel}>
                {tradeMode === 'buy'
                  ? 'Amount (SOL)'
                  : 'Amount (' + coinData.symbol + ')'}
              </Text>
              <View style={styles.amountInputContainer}>
                <TextInput
                  value={tradeAmount}
                  onChangeText={setTradeAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textSecondary}
                  style={[styles.modalInput, styles.amountInput]}
                  editable={!isTrading}
                />
                {/* MAX button for sell mode */}
                {tradeMode === 'sell' && (
                  <TouchableOpacity
                    style={styles.maxButton}
                    onPress={handleMaxSell}
                    disabled={isTrading}
                  >
                    <Text style={styles.maxButtonText}>MAX</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Direction Indicator */}
              <View style={styles.swapDirectionRow}>
                <Text style={styles.swapDirectionText}>
                  {tradeMode === 'buy'
                    ? 'Using SOL to buy ' + coinData.symbol
                    : 'Selling ' + coinData.symbol + ' for SOL'}
                </Text>
              </View>

              <Text style={styles.modalLabel}>Price Type</Text>
              <View style={styles.segmentedRow}>
                <TouchableOpacity
                  style={[styles.segmentedItem, tradePriceType === 'market' && styles.segmentedItemActive]}
                  onPress={() => setTradePriceType('market')}
                  disabled={isTrading}
                >
                  <Text style={[styles.segmentedText, tradePriceType === 'market' && styles.segmentedTextActive]}>Market</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentedItem, tradePriceType === 'target' && styles.segmentedItemActive]}
                  onPress={() => setTradePriceType('target')}
                  disabled={isTrading}
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
                    editable={!isTrading}
                  />
                  <Text style={styles.targetHint}>
                    'Current: ' + formatPrice(coinData.price) + ' | ',
                    {tradeMode === 'buy'
                      ? `Order executes when price drops to target`
                      : `Order executes when price rises to target`}
                  </Text>
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
                  editable={!isTrading}
                />
              </View>

              <NeonButton
                title={isTrading ? 'Processing...' : (tradeMode === 'buy' ? 'Buy' : 'Sell')}
                onPress={confirmTrade}
                style={styles.modalPrimary}
                disabled={isTrading}
              />
              <NeonButton
                title="Cancel"
                variant="secondary"
                onPress={closeTradeModal}
                style={styles.modalSecondary}
                disabled={isTrading}
              />
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
    marginHorizontal: SPACING.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
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
    flexShrink: 1,
    maxWidth: '60%',
  },
  tokenSymbol: {
    fontSize: 24,
    marginRight: SPACING.s,
    flexShrink: 1,
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
    marginHorizontal: SPACING.xs,
    marginTop: 0,
    marginBottom: SPACING.xs,
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
    marginHorizontal: SPACING.xs,
    marginTop: 0,
    marginBottom: SPACING.xs,
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
  aboutCard: {
    margin: SPACING.m,
    marginTop: 0,
  },
  aboutText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: 'rgba(0,0,0,0.85)',
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
  // Banner styles
  bannerContainer: {
    width: '100%',
    height: 150,
    marginBottom: -SPACING.m, // Overlap with header card
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  // Trading modal styles
  modalCardDisabled: {
    pointerEvents: 'none' as const,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  balanceLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginBottom: SPACING.m,
  },
  amountInput: {
    flex: 1,
    marginBottom: 0,
  },
  maxButton: {
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '40',
  },
  maxButtonText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 12,
  },
  swapDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
    paddingHorizontal: SPACING.s,
  },
  swapDirectionText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  targetHint: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: SPACING.xs,
    marginBottom: SPACING.s,
  },
});

