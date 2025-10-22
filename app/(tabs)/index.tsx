import React from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Globe, Zap, ArrowUp, ArrowDown, RefreshCw, CreditCard, X, Copy, QrCode, Send, ArrowUpDown, ChevronDown, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { WalletCard } from '../../components/WalletCard';
import { QuickActionButton } from '../../components/QuickActionButton';
import { TokenCard } from '../../components/TokenCard';
import { TraderCard } from '../../components/TraderCard';
import { useAuth } from '../../hooks/auth-store';
import { useWallet } from '../../hooks/wallet-store';

import { useSolanaWallet } from '../../hooks/solana-wallet-store';

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 414;
  
  // Responsive horizontal padding
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;
  const { user } = useAuth();
  const { tokens, totalBalance, dailyPnl, isLoading, refetch } = useWallet();

  const { 
    wallet: solanaWallet, 
    publicKey: solanaPublicKey, 
    balance: solanaBalance, 
    tokenBalances: solanaTokens, 
    isLoading: solanaLoading,
    sendSol,
    sendToken,
    getAvailableTokens,
    refreshBalances: refreshSolanaBalances
  } = useSolanaWallet();
  
  // Mock copy trade data
  const copyTradeSettings: any[] = [];
  const copyTrades: any[] = [];
  const getStats = () => ({ activeCopies: 0, totalTrades: 0, profitLoss: 0, profitLossPercentage: 0 });
  const createCopyTrade = async (params: any) => { 
    if (__DEV__) console.log('Create copy trade:', params); 
  };
  const stopCopyTrade = (address: string) => { 
    if (__DEV__) console.log('Stop copy trade:', address); 
  };
  const simulateTrade = (params: any) => { 
    if (__DEV__) console.log('Simulate trade:', params); 
  };
  const isCreating = false;
  
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'coins' | 'traders' | 'copy'>('coins');
  const [pnlPeriod, setPnlPeriod] = React.useState<'1d' | '7d' | '30d' | '1y'>('1d');
  
  // Search and filter states
  const [coinsSearchQuery, setCoinsSearchQuery] = React.useState('');
  const [tradersSearchQuery, setTradersSearchQuery] = React.useState('');
  const [coinsTimeFilter, setCoinsTimeFilter] = React.useState<'1d' | '7d' | '1m' | '1y'>('1d');
  const [tradersTimeFilter, setTradersTimeFilter] = React.useState<'1d' | '7d' | '1m' | '1y'>('1d');

  const [showCopyModal, setShowCopyModal] = React.useState(false);
  const [selectedTrader, setSelectedTrader] = React.useState<string | null>(null);
  const [selectedTraderWallet, setSelectedTraderWallet] = React.useState<string | null>(null);
  const [copyAmount, setCopyAmount] = React.useState('1000');
  const [amountPerTrade, setAmountPerTrade] = React.useState('100');
  const [stopLoss, setStopLoss] = React.useState('10');
  const [takeProfit, setTakeProfit] = React.useState('30');
  
  // Wallet action modals
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [showReceiveModal, setShowReceiveModal] = React.useState(false);
  const [showSwapModal, setShowSwapModal] = React.useState(false);
  
  // Send form state
  const [sendAddress, setSendAddress] = React.useState('');
  const [sendAmount, setSendAmount] = React.useState('');
  const [selectedToken, setSelectedToken] = React.useState('SOL');
  const [showSendTokenDropdown, setShowSendTokenDropdown] = React.useState(false);
  const [sendTokenSearch, setSendTokenSearch] = React.useState('');
  
  // Swap form state
  const [fromToken, setFromToken] = React.useState('SOL');
  const [toToken, setToToken] = React.useState('USDC');
  const [swapAmount, setSwapAmount] = React.useState('');
  const [estimatedOutput, setEstimatedOutput] = React.useState('0.00');
  const [showFromTokenDropdown, setShowFromTokenDropdown] = React.useState(false);
  const [showToTokenDropdown, setShowToTokenDropdown] = React.useState(false);
  const [fromTokenSearch, setFromTokenSearch] = React.useState('');
  const [toTokenSearch, setToTokenSearch] = React.useState('');
  
  // Use real Solana wallet address or demo address
  const walletAddress = solanaPublicKey || user?.walletAddress || 'DemoWallet1234567890abcdef1234567890abcdef12345678';
  
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
  
  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(walletAddress);
    Alert.alert('Copied!', 'Wallet address copied to clipboard');
  };
  
  const handleSend = () => {
    if (!sendAddress || !sendAmount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    Alert.alert(
      'Confirm Transaction',
      `Send ${sendAmount} ${selectedToken} to ${sendAddress.slice(0, 8)}...${sendAddress.slice(-8)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send', 
          onPress: () => {
            if (__DEV__) console.log('Sending:', { sendAddress, sendAmount, selectedToken });
            setShowSendModal(false);
            setSendAddress('');
            setSendAmount('');
            Alert.alert('Success', 'Transaction sent successfully!');
          }
        }
      ]
    );
  };
  
  const handleSwap = () => {
    if (!swapAmount) {
      Alert.alert('Error', 'Please enter an amount to swap');
      return;
    }
    
    Alert.alert(
      'Confirm Swap',
      `Swap ${swapAmount} ${fromToken} for ~${estimatedOutput} ${toToken}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Swap', 
          onPress: () => {
            if (__DEV__) console.log('Swapping:', { fromToken, toToken, swapAmount, estimatedOutput });
            setShowSwapModal(false);
            setSwapAmount('');
            Alert.alert('Success', 'Swap completed successfully!');
          }
        }
      ]
    );
  };
  
  const handleBuy = () => {
    const moonpayUrl = 'https://buy.moonpay.com/?apiKey=pk_live_xNzYzNzYzNzYzNzYzNzYzNzYzNzYzNzYz&currencyCode=sol';
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coins':
        return (
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
                  <TouchableOpacity 
                    style={styles.timeCycleButton}
                    onPress={() => {
                      const periods: ('1d' | '7d' | '1m' | '1y')[] = ['1d', '7d', '1m', '1y'];
                      const currentIndex = periods.indexOf(coinsTimeFilter);
                      const nextIndex = (currentIndex + 1) % periods.length;
                      setCoinsTimeFilter(periods[nextIndex]);
                    }}
                  >
                    <Text style={styles.timeCycleText}>{coinsTimeFilter.toUpperCase()}</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
            
            {/* Filtered Coins List */}
            {tokens
              .filter(token => 
                token.symbol.toLowerCase().includes(coinsSearchQuery.toLowerCase()) ||
                token.name.toLowerCase().includes(coinsSearchQuery.toLowerCase())
              )
              .map(token => (
                <TokenCard
                  key={token.id}
                  symbol={token.symbol}
                  name={token.name}
                  price={token.price}
                  change={token.change24h}
                  logo={token.logo}
                />
              ))
            }
          </View>
        );
      case 'traders':
        const allTraders = [
          { username: 'AlphaWolf', roi: 18.3, period: '7d', isVerified: true, profileImage: undefined },
          { username: 'ChainSniper', roi: 31.2, period: '30d', isVerified: false, profileImage: undefined },
          { username: 'ghostxsol', roi: 42.5, period: '30d', isVerified: true, profileImage: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61' },
          { username: 'cryptoQueen', roi: 15.8, period: '7d', isVerified: false, profileImage: undefined },
          { username: 'SolanaKing', roi: 67.4, period: '30d', isVerified: true, profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d' },
          { username: 'MemeHunter', roi: 24.7, period: '7d', isVerified: false, profileImage: undefined },
          { username: 'DeFiMaster', roi: 89.2, period: '30d', isVerified: true, profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e' },
          { username: 'PumpExpert', roi: 12.3, period: '7d', isVerified: false, profileImage: undefined },
          { username: 'WhaleWatcher', roi: 156.8, period: '30d', isVerified: true, profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e' },
          { username: 'CryptoNinja', roi: 38.9, period: '7d', isVerified: false, profileImage: undefined },
        ];
        
        return (
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
                  <TouchableOpacity 
                    style={styles.timeCycleButton}
                    onPress={() => {
                      const periods: ('1d' | '7d' | '1m' | '1y')[] = ['1d', '7d', '1m', '1y'];
                      const currentIndex = periods.indexOf(tradersTimeFilter);
                      const nextIndex = (currentIndex + 1) % periods.length;
                      setTradersTimeFilter(periods[nextIndex]);
                    }}
                  >
                    <Text style={styles.timeCycleText}>{tradersTimeFilter.toUpperCase()}</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
            
            {/* Filtered Traders List */}
            {allTraders
              .filter(trader => 
                trader.username.toLowerCase().includes(tradersSearchQuery.toLowerCase())
              )
              .map(trader => (
                <TraderCard
                  key={trader.username}
                  username={trader.username}
                  roi={trader.roi}
                  period={trader.period}
                  isVerified={trader.isVerified}
                  profileImage={trader.profileImage}
                  onPress={() => router.push(`/profile/${trader.username}`)}
                  onCopyPress={() => {
                    setSelectedTrader(trader.username);
                    setSelectedTraderWallet(`${trader.username}123456789abcdef123456789abcdef12345678`);
                    setShowCopyModal(true);
                  }}
                />
              ))
            }
          </View>
        );
      case 'copy':
        const stats = getStats();
        
        return (
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
                {copyTradeSettings.map((setting) => (
                  <View key={setting.id} style={styles.activeCopyItem}>
                    <View style={styles.activeCopyInfo}>
                      <Text style={styles.activeCopyWallet}>
                        {setting.targetWalletAddress.slice(0, 8)}...{setting.targetWalletAddress.slice(-8)}
                      </Text>
                      <Text style={styles.activeCopyAmount}>${setting.amountPerTrade}/trade</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.stopCopyButton}
                      onPress={() => stopCopyTrade(setting.targetWalletAddress)}
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
              
              {/* Test Trade Button */}
              <TouchableOpacity 
                style={styles.testTradeButton}
                onPress={() => {
                  if (copyTradeSettings.length > 0) {
                    const testWallet = copyTradeSettings[0].targetWalletAddress;
                    simulateTrade({
                      walletAddress: testWallet,
                      tokenIn: 'SOL',
                      tokenOut: 'USDC',
                      amountIn: 1,
                    });
                    Alert.alert('Test Trade', 'Simulated a trade for testing copy functionality');
                  } else {
                    Alert.alert('No Active Copies', 'Set up copy trading first to test');
                  }
                }}
              >
                <Text style={styles.testTradeText}>🧪 Test Copy Trade</Text>
              </TouchableOpacity>
            </View>
            
            {/* Recent Copy Trades */}
            {copyTrades.length > 0 && (
              <View style={styles.recentTradesContainer}>
                <Text style={styles.recentTradesTitle}>Recent Copy Trades</Text>
                {copyTrades.slice(0, 3).map((trade) => (
                  <View key={trade.id} style={styles.recentTradeItem}>
                    <View style={styles.recentTradeInfo}>
                      <Text style={styles.recentTradeTokens}>
                        {trade.amountIn.toFixed(4)} {trade.tokenIn} → {trade.amountOut.toFixed(4)} {trade.tokenOut}
                      </Text>
                      <Text style={styles.recentTradeTime}>
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <View style={[
                      styles.recentTradeStatus,
                      { backgroundColor: 
                        trade.status === 'executed' ? COLORS.success + '20' :
                        trade.status === 'pending' ? COLORS.warning + '20' :
                        COLORS.error + '20'
                      }
                    ]}>
                      <Text style={[
                        styles.recentTradeStatusText,
                        { color: 
                          trade.status === 'executed' ? COLORS.success :
                          trade.status === 'pending' ? COLORS.warning :
                          COLORS.error
                        }
                      ]}>
                        {trade.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
              <Text style={styles.walletAddress}>{user?.walletAddress || 'Connect wallet'}</Text>
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
              onPress={() => router.push('/send-receive')}
            />
            <QuickActionButton
              title="LOAD"
              icon={<ArrowDown size={isSmallScreen ? 16 : 20} color={COLORS.textPrimary} />}
              color={COLORS.gradientPurple}
              style={styles.quickActionButton}
              onPress={() => router.push('/send-receive')}
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
                TOP COINS
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
      
      {/* Copy Trading Modal */}
      <Modal
        visible={showCopyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCopyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.9, maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Copy @{selectedTrader}</Text>
              <TouchableOpacity onPress={() => setShowCopyModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
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
              
              <TouchableOpacity style={styles.exitWithTraderButton}>
                <Text style={styles.exitWithTraderText}>Exit with Trader</Text>
                <Text style={styles.exitWithTraderSubtext}>Automatically exit when trader exits</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.startCopyButton}
                onPress={async () => {
                  if (!selectedTraderWallet) {
                    Alert.alert('Error', 'Please enter a wallet address to copy');
                    return;
                  }
                  
                  try {
                    await createCopyTrade({
                      targetWalletAddress: selectedTraderWallet,
                      totalAmount: parseFloat(copyAmount) || 1000,
                      amountPerTrade: parseFloat(amountPerTrade) || 100,
                      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
                      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
                    });
                    
                    Alert.alert('Success', `Started copying ${selectedTrader || 'wallet'}!`);
                    setShowCopyModal(false);
                  } catch (error) {
                    Alert.alert('Error', 'Failed to set up copy trading');
                  }
                }}
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
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Send Modal */}
      <Modal
        visible={showSendModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.9, maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send SOL</Text>
              <TouchableOpacity onPress={() => setShowSendModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Token</Text>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowSendTokenDropdown(!showSendTokenDropdown)}
                >
                  <View style={styles.dropdownButtonContent}>
                    <View style={styles.tokenInfo}>
                      {availableTokens.find(t => t.symbol === selectedToken)?.logo && (
                        <Image 
                          source={{ uri: availableTokens.find(t => t.symbol === selectedToken)?.logo }} 
                          style={styles.tokenLogo} 
                        />
                      )}
                      <Text style={styles.dropdownButtonText}>
                        {selectedToken} {availableTokens.find(t => t.symbol === selectedToken)?.balance ? `(${availableTokens.find(t => t.symbol === selectedToken)?.balance?.toFixed(4)})` : ''}
                      </Text>
                    </View>
                    <ChevronDown size={20} color={COLORS.textSecondary} />
                  </View>
                </TouchableOpacity>
                
                {showSendTokenDropdown && (
                  <View style={styles.dropdownContainer}>
                    <View style={styles.modalSearchContainer}>
                      <Search size={16} color={COLORS.textSecondary} />
                      <TextInput
                        style={styles.modalSearchInput}
                        placeholder="Search tokens..."
                        placeholderTextColor={COLORS.textSecondary}
                        value={sendTokenSearch}
                        onChangeText={setSendTokenSearch}
                      />
                    </View>
                    <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
                      {getFilteredTokens(sendTokenSearch).map((token) => (
                        <TouchableOpacity
                          key={token.symbol}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedToken(token.symbol);
                            setShowSendTokenDropdown(false);
                            setSendTokenSearch('');
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
              
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Recipient Address</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Solana address..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={sendAddress}
                    onChangeText={setSendAddress}
                    multiline
                  />
                </View>
              </View>
              
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Amount</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textSecondary}
                    value={sendAmount}
                    onChangeText={setSendAmount}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputSuffix}>{selectedToken}</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleSend}
              >
                <LinearGradient
                  colors={[COLORS.solana, COLORS.solana + '80']}
                  style={styles.actionGradient}
                >
                  <Send size={20} color={COLORS.textPrimary} />
                  <Text style={styles.actionText}>SEND</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Receive Modal */}
      <Modal
        visible={showReceiveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReceiveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.9, maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive SOL</Text>
              <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Share this address to receive SOL and Solana tokens
              </Text>
              
              <View style={styles.qrContainer}>
                <View style={styles.qrPlaceholder}>
                  <QrCode size={120} color={COLORS.solana} />
                </View>
              </View>
              
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>Your Solana Address</Text>
                <View style={styles.addressBox}>
                  <Text style={styles.addressText}>{walletAddress}</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleCopyAddress}
              >
                <LinearGradient
                  colors={[COLORS.solana, COLORS.solana + '80']}
                  style={styles.actionGradient}
                >
                  <Copy size={20} color={COLORS.textPrimary} />
                  <Text style={styles.actionText}>COPY ADDRESS</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
            
            <View style={styles.modalContent}>
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
                        {availableTokens.find(t => t.symbol === fromToken)?.logo && (
                          <Image 
                            source={{ uri: availableTokens.find(t => t.symbol === fromToken)?.logo }} 
                            style={styles.tokenLogoSmall} 
                          />
                        )}
                        <Text style={styles.swapTokenText}>{fromToken}</Text>
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
                            key={token.symbol}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setFromToken(token.symbol);
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
                        {availableTokens.find(t => t.symbol === toToken)?.logo && (
                          <Image 
                            source={{ uri: availableTokens.find(t => t.symbol === toToken)?.logo }} 
                            style={styles.tokenLogoSmall} 
                          />
                        )}
                        <Text style={styles.swapTokenText}>{toToken}</Text>
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
                            key={token.symbol}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setToToken(token.symbol);
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
              
              <View style={styles.swapInfo}>
                <Text style={styles.swapInfoText}>Rate: 1 {fromToken} ≈ {fromToken === 'SOL' ? '150' : '0.0067'} {toToken}</Text>
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
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.m,
    minHeight: 60,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: SPACING.s,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  defaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userInfo: {
    justifyContent: 'center',
  },
  username: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  walletAddress: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.s,
  },
  walletCardContainer: {
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.m,
  },
  quickActionsContainer: {
    marginBottom: SPACING.m,
  },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xs,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  quickActionButton: {
    flex: 1,
    marginHorizontal: SPACING.xs,
    minWidth: 70,
    maxWidth: 90,
  },
  tabsContainer: {
    flex: 1,
    marginBottom: 0,
  },
  tabsHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
    marginHorizontal: SPACING.xs,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
    minHeight: 44,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small,
    justifyContent: 'center',
    minHeight: 36,
  },
  activeTab: {
    backgroundColor: COLORS.solana + '20',
  },

  tabText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  activeTabText: {
    color: COLORS.solana,
  },


  tabContent: {
    paddingHorizontal: SPACING.xs,
    paddingBottom: 0,
  },
  searchAndFilterContainer: {
    marginBottom: SPACING.m,
  },
  searchWithDropdownContainer: {
    position: 'relative',
    zIndex: 1000,
    elevation: 1000,
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
    borderColor: COLORS.solana + '20',
  },
  searchInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s,
    paddingVertical: SPACING.xs,
  },
  timeFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  timeFilterButton: {
    flex: 1,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small,
    marginHorizontal: 2,
  },
  activeTimeFilterButton: {
    backgroundColor: COLORS.solana + '20',
  },
  timeFilterText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  activeTimeFilterText: {
    color: COLORS.solana,
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
    alignItems: 'center',
  },
  timeCycleText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 12,
  },
  copyTradeContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
  },
  copyTradeTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.s,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  copyTradeDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.m,
  },
  copyTradeForm: {},
  formLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  copyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    marginBottom: SPACING.m,
  },
  copyInputPrefix: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  inputValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  sliderContainer: {
    marginBottom: SPACING.m,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
    marginVertical: SPACING.s,
    position: 'relative',
  },
  sliderFill: {
    height: 6,
    backgroundColor: COLORS.solana,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.solana,
    top: -7,
    marginLeft: -10,
  },
  sliderValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
    textAlign: 'right',
  },
  startCopyingButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginTop: SPACING.m,
  },
  startCopyingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m,
  },
  startCopyingText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  modalDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: SPACING.l,
    lineHeight: 24,
  },
  inputSection: {
    marginBottom: SPACING.m,
  },
  inputLabel: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  inputPrefix: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 18,
    marginRight: SPACING.s,
  },
  inputSuffix: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 18,
    marginLeft: SPACING.s,
  },
  input: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    paddingVertical: SPACING.m,
  },
  startCopyButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginTop: SPACING.l,
  },
  startCopyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m,
  },
  startCopyText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  exitWithTraderButton: {
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
  },
  exitWithTraderText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  exitWithTraderSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  tokenSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    padding: 2,
    marginBottom: SPACING.m,
  },
  tokenOption: {
    flex: 1,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.small,
    alignItems: 'center',
  },
  selectedTokenOption: {
    backgroundColor: COLORS.solana + '20',
  },
  tokenOptionText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  selectedTokenOptionText: {
    color: COLORS.solana,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: SPACING.l,
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.solana + '30',
  },
  addressContainer: {
    marginBottom: SPACING.l,
  },
  addressLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.s,
  },
  addressBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  addressText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 12,
    textAlign: 'center',
  },
  actionButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginTop: SPACING.m,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m,
  },
  actionText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  swapContainer: {
    marginBottom: SPACING.l,
  },
  swapSection: {
    marginBottom: SPACING.m,
  },
  swapInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  swapInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginRight: SPACING.m,
  },
  swapOutput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginRight: SPACING.m,
  },
  swapArrow: {
    alignItems: 'center',
    marginVertical: SPACING.s,
  },
  swapArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.solana + '30',
  },
  swapInfo: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l,
  },
  swapInfoText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  dropdownButton: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginBottom: SPACING.m,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
  },
  dropdownButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  dropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginBottom: SPACING.m,
    maxHeight: 200,
  },
  swapDropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginTop: SPACING.s,
    maxHeight: 150,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10',
  },
  modalSearchInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s,
    paddingVertical: SPACING.xs,
  },
  dropdownList: {
    maxHeight: 150,
  },
  swapDropdownList: {
    maxHeight: 100,
  },
  dropdownItem: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.s,
  },
  tokenLogoSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: SPACING.xs,
  },
  tokenSymbol: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  tokenName: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  swapTokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    minWidth: 80,
  },
  swapTokenText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginRight: SPACING.xs,
  },
  // Copy Trading Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  activeCopiesContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  activeCopiesTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  activeCopyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10',
  },
  activeCopyInfo: {
    flex: 1,
  },
  activeCopyWallet: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  activeCopyAmount: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  stopCopyButton: {
    backgroundColor: COLORS.error + '20',
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  stopCopyText: {
    ...FONTS.phantomMedium,
    color: COLORS.error,
    fontSize: 12,
  },
  quickSetupButton: {
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    alignItems: 'center',
    marginBottom: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
  },
  quickSetupText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 16,
  },
  testTradeButton: {
    backgroundColor: COLORS.warning + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.s,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  testTradeText: {
    ...FONTS.phantomMedium,
    color: COLORS.warning,
    fontSize: 14,
  },
  recentTradesContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginTop: SPACING.m,
  },
  recentTradesTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  recentTradeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10',
  },
  recentTradeInfo: {
    flex: 1,
  },
  recentTradeTokens: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  recentTradeTime: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  recentTradeStatus: {
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  recentTradeStatusText: {
    ...FONTS.phantomBold,
    fontSize: 10,
  },
});