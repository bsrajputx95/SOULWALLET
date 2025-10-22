import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import {
  ArrowLeft,
  Send,
  ArrowDown,
  Copy,
  QrCode,
  ChevronDown,
  Search,
  Scan,
  Wallet,
  CheckCircle,
  AlertCircle,
  Camera,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSolanaWallet } from '../hooks/solana-wallet-store';
import { useAuth } from '../hooks/auth-store';

type TabType = 'send' | 'receive';

interface TokenOption {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logo?: string;
  balance: number;
}

export default function SendReceiveScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const {
    wallet,
    publicKey,
    balance,
    tokenBalances,
    isLoading,
    sendSol,
    sendToken,
    getAvailableTokens,
    refreshBalances,
  } = useSolanaWallet();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('send');

  // Send form state
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  // Receive state
  const [showQRCode, setShowQRCode] = useState(false);

  // Available tokens
  const availableTokens = getAvailableTokens();

  // Set default token to SOL
  useEffect(() => {
    if (!selectedToken && availableTokens.length > 0) {
      const solToken = availableTokens.find(token => token.symbol === 'SOL');
      setSelectedToken(solToken || availableTokens[0]);
    }
  }, [availableTokens, selectedToken]);

  // Filter tokens based on search
  const getFilteredTokens = (search: string) => {
    if (!search) return availableTokens;
    return availableTokens.filter(token =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase())
    );
  };

  // Validate send form
  const validateSendForm = () => {
    if (!sendAddress.trim()) {
      setSendError('Please enter a recipient address');
      return false;
    }

    if (!sendAmount.trim() || parseFloat(sendAmount) <= 0) {
      setSendError('Please enter a valid amount');
      return false;
    }

    if (!selectedToken) {
      setSendError('Please select a token');
      return false;
    }

    const amount = parseFloat(sendAmount);
    if (amount > selectedToken.balance) {
      setSendError(`Insufficient balance. Available: ${selectedToken.balance.toFixed(6)} ${selectedToken.symbol}`);
      return false;
    }

    // Basic Solana address validation
    if (sendAddress.length < 32 || sendAddress.length > 44) {
      setSendError('Invalid Solana address format');
      return false;
    }

    setSendError('');
    return true;
  };

  // Handle send transaction
  const handleSend = async () => {
    if (!validateSendForm() || !wallet || !selectedToken) return;

    try {
      setIsSending(true);
      setSendError('');
      setSendSuccess('');

      const amount = parseFloat(sendAmount);
      let signature: string;

      if (selectedToken.symbol === 'SOL') {
        signature = await sendSol(sendAddress, amount);
      } else {
        signature = await sendToken(
          sendAddress,
          amount,
          selectedToken.mint,
          selectedToken.decimals
        );
      }

      setSendSuccess(`Transaction successful! Signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
      setSendAddress('');
      setSendAmount('');
      
      // Refresh balances
      await refreshBalances();
      
    } catch (error: any) {
      if (__DEV__) console.error('Send transaction failed:', error);
      setSendError(error.message || 'Transaction failed. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle copy address
  const handleCopyAddress = async () => {
    if (!publicKey) return;
    
    try {
      await Clipboard.setStringAsync(publicKey);
      Alert.alert('Copied!', 'Wallet address copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy address');
    }
  };

  // Handle paste address
  const handlePasteAddress = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText) {
        setSendAddress(clipboardText);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to paste:', error);
    }
  };

  // Render token selector
  const renderTokenSelector = () => {
    if (!selectedToken) return null;

    return (
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Token</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowTokenDropdown(!showTokenDropdown)}
        >
          <View style={styles.dropdownButtonContent}>
            <View style={styles.tokenInfo}>
              {selectedToken.logo && (
                <Image source={{ uri: selectedToken.logo }} style={styles.tokenLogo} />
              )}
              <View>
                <Text style={styles.tokenSymbol}>{selectedToken.symbol}</Text>
                <Text style={styles.tokenBalance}>
                  Balance: {selectedToken.balance.toFixed(6)}
                </Text>
              </View>
            </View>
            <ChevronDown size={20} color={COLORS.textSecondary} />
          </View>
        </TouchableOpacity>

        {showTokenDropdown && (
          <View style={styles.dropdownContainer}>
            <View style={styles.searchContainer}>
              <Search size={16} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tokens..."
                placeholderTextColor={COLORS.textSecondary}
                value={tokenSearch}
                onChangeText={setTokenSearch}
              />
            </View>
            <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
              {getFilteredTokens(tokenSearch).map((token) => (
                <TouchableOpacity
                  key={token.mint}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedToken(token);
                    setShowTokenDropdown(false);
                    setTokenSearch('');
                  }}
                >
                  <View style={styles.tokenInfo}>
                    {token.logo && (
                      <Image source={{ uri: token.logo }} style={styles.tokenLogo} />
                    )}
                    <View style={styles.tokenDetails}>
                      <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                      <Text style={styles.tokenName}>{token.name}</Text>
                      <Text style={styles.tokenBalance}>
                        Balance: {token.balance.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  // Render send tab
  const renderSendTab = () => {
    return (
      <View style={styles.tabContent}>
        {/* Form Container */}
        <LinearGradient
          colors={[COLORS.cardBackground, COLORS.cardBackground + 'E0']}
          style={styles.formContainer}
        >
          {/* Token Selector */}
          {renderTokenSelector()}

          {/* Recipient Address */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Recipient Address</Text>
            <View style={styles.addressInputContainer}>
              <TextInput
                style={styles.addressInput}
                placeholder="Enter Solana address..."
                placeholderTextColor={COLORS.textSecondary}
                value={sendAddress}
                onChangeText={setSendAddress}
                multiline
                numberOfLines={2}
              />
              <View style={styles.addressActions}>
                <TouchableOpacity
                  style={styles.addressActionButton}
                  onPress={handlePasteAddress}
                >
                  <Copy size={16} color={COLORS.solana} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addressActionButton}
                  onPress={() => Alert.alert('QR Scanner', 'QR code scanner would open here')}
                >
                  <Scan size={16} color={COLORS.solana} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.amountInputContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                value={sendAmount}
                onChangeText={setSendAmount}
                keyboardType="numeric"
              />
              <Text style={styles.amountSuffix}>{selectedToken?.symbol || ''}</Text>
            </View>
            {selectedToken && (
              <TouchableOpacity
                style={styles.maxButton}
                onPress={() => setSendAmount(selectedToken.balance.toString())}
              >
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Transaction Fee Info */}
          <View style={styles.feeInfo}>
            <Text style={styles.feeText}>Network Fee: ~0.000005 SOL</Text>
            <Text style={styles.feeSubtext}>Solana Network</Text>
          </View>

          {/* Error/Success Messages */}
          {sendError ? (
            <View style={styles.errorContainer}>
              <AlertCircle size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          ) : null}

          {sendSuccess ? (
            <View style={styles.successContainer}>
              <CheckCircle size={16} color={COLORS.success} />
              <Text style={styles.successText}>{sendSuccess}</Text>
            </View>
          ) : null}

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.actionButton, (!wallet || isSending) && styles.disabledButton]}
            onPress={handleSend}
            disabled={!wallet || isSending}
          >
            <LinearGradient
              colors={[COLORS.solana, COLORS.solana + '80']}
              style={styles.actionGradient}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Send size={20} color={COLORS.textPrimary} />
              )}
              <Text style={styles.actionText}>
                {isSending ? 'SENDING...' : 'SEND'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {!wallet && (
            <View style={styles.walletWarning}>
              <Wallet size={16} color={COLORS.warning} />
              <Text style={styles.walletWarningText}>
                Connect or create a wallet to send transactions
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  // Render receive tab
  const renderReceiveTab = () => {
    const walletAddress = publicKey || user?.walletAddress || 'No wallet connected';

    return (
      <View style={styles.tabContent}>
        <Text style={styles.receiveDescription}>
          Share this address to receive SOL and Solana tokens
        </Text>

        {/* Form Container */}
        <LinearGradient
          colors={[COLORS.cardBackground, COLORS.cardBackground + 'E0']}
          style={styles.formContainer}
        >
          {/* QR Code */}
          <View style={styles.qrContainer}>
            <TouchableOpacity
              style={styles.qrPlaceholder}
              onPress={() => setShowQRCode(!showQRCode)}
            >
              <QrCode size={120} color={COLORS.solana} />
              <Text style={styles.qrText}>Tap to {showQRCode ? 'hide' : 'show'} QR</Text>
            </TouchableOpacity>
          </View>

          {/* Address */}
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Your Solana Address</Text>
            <View style={styles.addressBox}>
              <Text style={styles.addressText} selectable>
                {walletAddress}
              </Text>
            </View>
          </View>

          {/* Copy Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopyAddress}
            disabled={!publicKey}
          >
            <LinearGradient
              colors={[COLORS.solana, COLORS.solana + '80']}
              style={styles.actionGradient}
            >
              <Copy size={20} color={COLORS.textPrimary} />
              <Text style={styles.actionText}>COPY ADDRESS</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Wallet Info */}
          <View style={styles.walletInfo}>
            <View style={styles.walletInfoItem}>
              <Text style={styles.walletInfoLabel}>SOL Balance</Text>
              <Text style={styles.walletInfoValue}>
                {balance.toFixed(6)} SOL
              </Text>
            </View>
            <View style={styles.walletInfoItem}>
              <Text style={styles.walletInfoLabel}>Token Accounts</Text>
              <Text style={styles.walletInfoValue}>
                {tokenBalances.length} tokens
              </Text>
            </View>
          </View>

          {!wallet && (
            <View style={styles.walletWarning}>
              <Wallet size={16} color={COLORS.warning} />
              <Text style={styles.walletWarningText}>
                Connect or create a wallet to receive transactions
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        {/* Tab Header */}
        <View style={styles.tabsHeader}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'send' && styles.activeTab]}
            onPress={() => setActiveTab('send')}
          >
            <Send size={20} color={activeTab === 'send' ? COLORS.solana : COLORS.textSecondary} />
            <Text
              style={[
                styles.tabText,
                activeTab === 'send' && styles.activeTabText,
              ]}
            >
              SEND
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'receive' && styles.activeTab]}
            onPress={() => setActiveTab('receive')}
          >
            <ArrowDown size={20} color={activeTab === 'receive' ? COLORS.solana : COLORS.textSecondary} />
            <Text
              style={[
                styles.tabText,
                activeTab === 'receive' && styles.activeTabText,
              ]}
            >
              LOAD
            </Text>
          </TouchableOpacity>
        </View>

        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={COLORS.solana} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tab Content */}
        {activeTab === 'send' ? renderSendTab() : renderReceiveTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  customHeader: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.m,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    right: SPACING.l,
    top: SPACING.l,
    padding: SPACING.s,
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.small,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xl,
  },
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
    marginRight: 60,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.small,
    gap: SPACING.s,
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
  tabContent: {
    flex: 1,
  },
  inputSection: {
    marginBottom: SPACING.l,
  },
  inputLabel: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  dropdownButton: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
  },
  dropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginTop: SPACING.s,
    maxHeight: 200,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10',
  },
  searchInput: {
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
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.s,
  },
  tokenDetails: {
    flex: 1,
  },
  tokenSymbol: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  tokenName: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  tokenBalance: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  addressInputContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  addressInput: {
    ...FONTS.monospace,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.s,
  },
  addressActionButton: {
    padding: SPACING.s,
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.small,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.m,
  },
  amountInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    paddingVertical: SPACING.m,
  },
  amountSuffix: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  maxButton: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.small,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.s,
  },
  maxButtonText: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 12,
  },
  feeInfo: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l,
  },
  feeText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  feeSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l,
    gap: SPACING.s,
  },
  errorText: {
    ...FONTS.phantomRegular,
    color: COLORS.error,
    fontSize: 14,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l,
    gap: SPACING.s,
  },
  successText: {
    ...FONTS.phantomRegular,
    color: COLORS.success,
    fontSize: 14,
    flex: 1,
  },
  actionButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginBottom: SPACING.l,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m,
    gap: SPACING.s,
  },
  actionText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  walletWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    gap: SPACING.s,
  },
  walletWarningText: {
    ...FONTS.phantomRegular,
    color: COLORS.warning,
    fontSize: 14,
    flex: 1,
  },
  receiveDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.l,
    lineHeight: 24,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.solana + '30',
  },
  qrText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.s,
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
    lineHeight: 18,
  },
  walletInfo: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.l,
  },
  walletInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.solana + '10',
  },
  walletInfoLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  walletInfoValue: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  formContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.solana + '40',
    padding: 16,
    marginTop: SPACING.m,
  },
});