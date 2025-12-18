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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import {
  Send,
  ArrowDown,
  Copy,
  QrCode,
  ChevronDown,
  Search,
  Wallet,
  CheckCircle,
  AlertCircle,
  X,
  ChevronRight,
  Users,
  Clipboard as ClipboardIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
// Removed react-native-share as it's not web-compatible
import * as Haptics from 'expo-haptics';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { logger } from '../lib/client-logger';
import { useSolanaWallet } from '../hooks/solana-wallet-store';
import { useAuth } from '../hooks/auth-store';
import { trpc } from '../lib/trpc';

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
  const { flow } = useLocalSearchParams();
  const initialFlow = Array.isArray(flow) ? flow[0] : flow;
  const initialTab: TabType = initialFlow === 'receive' ? 'receive' : 'send';
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
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Send form state
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean;
    message: string;
  }>({ isValid: false, message: '' });

  // Receive state
  const [showQRCode, setShowQRCode] = useState(true);
  const [selectedReceiveToken, setSelectedReceiveToken] = useState('SOL');

  // Available tokens
  const availableTokens = getAvailableTokens();

  // Get recent incoming transactions
  const { data: recentTransactions, isLoading: loadingTransactions } = trpc.wallet.getRecentIncoming.useQuery(
    { limit: 5 },
    { enabled: !!publicKey }
  );
  const { data: flags } = trpc.system.getFeatureFlags.useQuery();
  const recordTransactionMutation = trpc.wallet.recordTransaction.useMutation();

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
    if (!flags?.sendEnabled) {
      Alert.alert('Send Disabled', 'Sending is disabled in this environment.');
      return;
    }
    if (!flags?.simulationMode) {
      Alert.alert('Not Available', 'On-chain send is not enabled in this environment.');
      return;
    }
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

      // Record transaction in backend database
      try {
        await recordTransactionMutation.mutateAsync({
          signature,
          type: 'SEND',
          amount: parseFloat(sendAmount),
          token: selectedToken.mint,
          tokenSymbol: selectedToken.symbol,
          to: sendAddress,
          from: publicKey || undefined,
        });
        if (__DEV__) logger.info('Transaction recorded in database:', signature);
      } catch (recordError) {
        // Don't fail the whole operation if recording fails
        if (__DEV__) logger.error('Failed to record transaction:', recordError);
      }

      setSendSuccess(`Transaction successful! Signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
      setSendAddress('');
      setSendAmount('');

      // Refresh balances
      await refreshBalances();

    } catch (error: any) {
      if (__DEV__) logger.error('Send transaction failed:', error);
      setSendError(error.message || 'Transaction failed. Please try again.');
    } finally {
      setIsSending(false);
    }
  };



  // Handle address change with validation
  const handleAddressChange = (text: string) => {
    setSendAddress(text);

    if (!text.trim()) {
      setAddressValidation({ isValid: false, message: '' });
      return;
    }

    // Basic Solana address validation
    if (text.length < 32 || text.length > 44) {
      setAddressValidation({
        isValid: false,
        message: 'Invalid address length'
      });
    } else if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
      setAddressValidation({
        isValid: false,
        message: 'Invalid characters in address'
      });
    } else {
      setAddressValidation({
        isValid: true,
        message: 'Valid Solana address'
      });
    }
  };

  // Validate amount
  const validateAmount = (amount: string) => {
    if (!amount || !selectedToken) return;

    const numAmount = parseFloat(amount);
    if (numAmount > selectedToken.balance) {
      setSendError(`Insufficient balance. Available: ${selectedToken.balance.toFixed(6)} ${selectedToken.symbol}`);
    } else {
      setSendError('');
    }
  };

  // Handle send confirmation
  const handleSendConfirm = async () => {
    setShowConfirmation(false);
    await handleSend();
  };

  // Handle contact select
  const handleContactSelect = (contact: any) => {
    setSendAddress(contact.address);
    setShowContacts(false);
    handleAddressChange(contact.address);
  };

  // Fee estimation (placeholder)
  const feeEstimate = selectedToken ? { fee: 0.000005 } : null;

  // Contacts data (placeholder)
  const contacts: any[] = [];
  const loadingContacts = false;



  // Render token selector


  // Render send tab
  const renderSendTab = () => {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.sendDescription}>
          Send SOL and Solana tokens to any address
        </Text>

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
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.addressInput,
                  sendAddress && (addressValidation.isValid ? styles.inputValid : styles.inputError)
                ]}
                placeholder="Enter Solana address..."
                placeholderTextColor={COLORS.textSecondary}
                value={sendAddress}
                onChangeText={handleAddressChange}
                multiline
                numberOfLines={2}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.addressActions}>
                <TouchableOpacity
                  style={styles.addressActionButton}
                  onPress={handlePasteAddress}
                >
                  <ClipboardIcon size={16} color={COLORS.solana} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addressActionButton}
                  onPress={() => setShowContacts(true)}
                >
                  <Users size={16} color={COLORS.solana} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Address Validation Feedback */}
            {sendAddress && (
              <Text style={[
                styles.validationText,
                addressValidation.isValid ? styles.validText : styles.errorText
              ]}>
                {addressValidation.message}
              </Text>
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.amountInputContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                value={sendAmount}
                onChangeText={(text) => {
                  setSendAmount(text);
                  validateAmount(text);
                }}
                keyboardType="decimal-pad"
              />
              <Text style={styles.amountSuffix}>
                {selectedToken?.symbol || 'SOL'}
              </Text>
            </View>

            {selectedToken && (
              <TouchableOpacity
                style={styles.maxButton}
                onPress={() => {
                  const maxAmount = selectedToken.balance.toString();
                  setSendAmount(maxAmount);
                  validateAmount(maxAmount);
                }}
              >
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Transaction Fee */}
          {feeEstimate && (
            <View style={styles.feeInfo}>
              <Text style={styles.feeText}>
                Network Fee: {feeEstimate.fee} SOL
              </Text>
              <Text style={styles.feeSubtext}>
                Estimated confirmation time: ~30 seconds
              </Text>
            </View>
          )}

          {/* Error Display */}
          {sendError && (
            <View style={styles.errorContainer}>
              <AlertCircle size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          )}

          {/* Success Display */}
          {sendSuccess && (
            <View style={styles.successContainer}>
              <CheckCircle size={16} color={COLORS.success} />
              <Text style={styles.successText}>{sendSuccess}</Text>
            </View>
          )}

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!addressValidation.isValid || !sendAmount || !selectedToken || isSending || !flags?.sendEnabled || !flags?.simulationMode) && styles.sendButtonDisabled
            ]}
            onPress={() => setShowConfirmation(true)}
            disabled={!addressValidation.isValid || !sendAmount || !selectedToken || isSending || !flags?.sendEnabled || !flags?.simulationMode}
          >
            <LinearGradient
              colors={[COLORS.solana, COLORS.solana + '80']}
              style={styles.sendGradient}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Send size={20} color={COLORS.textPrimary} />
              )}
              <Text style={styles.sendButtonText}>
                {isSending ? 'SENDING...' : (!flags?.sendEnabled || !flags?.simulationMode) ? 'Disabled' : 'REVIEW TRANSACTION'}
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

        {/* Contacts Modal */}
        <Modal
          visible={showContacts}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowContacts(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Contact</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowContacts(false)}
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.contactsList}>
              {loadingContacts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.solana} />
                  <Text style={styles.loadingText}>Loading contacts...</Text>
                </View>
              ) : contacts && contacts.length > 0 ? (
                contacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={styles.contactItem}
                    onPress={() => handleContactSelect(contact)}
                  >
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactAddress}>
                        {contact.address.slice(0, 8)}...{contact.address.slice(-8)}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContacts}>
                  <Text style={styles.emptyContactsText}>
                    No contacts found. Add contacts from your transaction history.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmation}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowConfirmation(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Transaction</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowConfirmation(false)}
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.confirmationContent}>
              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>Sending</Text>
                <Text style={styles.confirmationValue}>
                  {sendAmount} {selectedToken?.symbol}
                </Text>
              </View>

              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>To</Text>
                <Text style={styles.confirmationAddress}>
                  {sendAddress}
                </Text>
              </View>

              {feeEstimate && (
                <View style={styles.confirmationSection}>
                  <Text style={styles.confirmationLabel}>Network Fee</Text>
                  <Text style={styles.confirmationValue}>
                    {feeEstimate.fee} SOL
                  </Text>
                </View>
              )}

              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.cancelButton]}
                  onPress={() => setShowConfirmation(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmationButton, styles.confirmButton, (!flags?.sendEnabled || !flags?.simulationMode) && { opacity: 0.6 }]}
                  onPress={handleSendConfirm}
                  disabled={isSending || !flags?.sendEnabled || !flags?.simulationMode}
                >
                  <LinearGradient
                    colors={[COLORS.solana, COLORS.solana + '80']}
                    style={styles.confirmGradient}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color={COLORS.textPrimary} />
                    ) : (
                      <Send size={18} color={COLORS.textPrimary} />
                    )}
                    <Text style={styles.confirmButtonText}>
                      {isSending ? 'Sending...' : (!flags?.sendEnabled || !flags?.simulationMode) ? 'Disabled' : 'Confirm Send'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  // Handle share address (web-compatible implementation)
  const handleShareAddress = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const walletAddress = publicKey || user?.walletAddress;
    if (!walletAddress) {
      Alert.alert('Error', 'No wallet address available');
      return;
    }

    try {
      const shareData = {
        title: 'My Solana Wallet Address',
        text: `Send SOL and SPL tokens to this address:\n\n${walletAddress}`,
        url: `solana:${walletAddress}`,
      };

      // Use Web Share API if available, otherwise fallback to clipboard
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard and show alert
        await Clipboard.setStringAsync(`${shareData.title}\n${shareData.text}`);
        Alert.alert(
          'Address Copied',
          'Your wallet address has been copied to clipboard',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.info('Share cancelled or failed:', error);
      // Fallback: copy to clipboard
      try {
        await Clipboard.setStringAsync(walletAddress);
        Alert.alert(
          'Address Copied',
          'Your wallet address has been copied to clipboard',
          [{ text: 'OK' }]
        );
      } catch (clipboardError) {
        logger.error('Failed to copy to clipboard:', clipboardError);
      }
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
      if (__DEV__) logger.error('Failed to paste:', error);
    }
  };

  // Handle copy address
  const handleCopyAddress = async () => {
    try {
      if (publicKey) {
        await Clipboard.setStringAsync(publicKey);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Address copied to clipboard');
      }
    } catch (error) {
      if (__DEV__) logger.error('Failed to copy address:', error);
      Alert.alert('Error', 'Failed to copy address');
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
          {/* Token Selector for Receive */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Receiving Token</Text>
            <View style={styles.tokenSelectorContainer}>
              <TouchableOpacity
                style={[styles.tokenSelectorButton, selectedReceiveToken === 'SOL' && styles.selectedTokenButton]}
                onPress={() => setSelectedReceiveToken('SOL')}
              >
                <Text style={[styles.tokenSelectorText, selectedReceiveToken === 'SOL' && styles.selectedTokenText]}>
                  SOL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tokenSelectorButton, selectedReceiveToken === 'SPL' && styles.selectedTokenButton]}
                onPress={() => setSelectedReceiveToken('SPL')}
              >
                <Text style={[styles.tokenSelectorText, selectedReceiveToken === 'SPL' && styles.selectedTokenText]}>
                  SPL Tokens
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            {showQRCode && walletAddress !== 'No wallet connected' ? (
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={walletAddress}
                  size={200}
                  color={COLORS.textPrimary}
                  backgroundColor={COLORS.cardBackground}
                  logo={require('../assets/icon.png')}
                  logoSize={40}
                  logoBackgroundColor={COLORS.cardBackground}
                  logoMargin={2}
                  logoBorderRadius={20}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.qrPlaceholder}
                onPress={() => setShowQRCode(!showQRCode)}
              >
                <QrCode size={120} color={COLORS.solana} />
                <Text style={styles.qrText}>Tap to {showQRCode ? 'hide' : 'show'} QR</Text>
              </TouchableOpacity>
            )}
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

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.halfButton]}
              onPress={handleCopyAddress}
              disabled={!publicKey}
            >
              <LinearGradient
                colors={[COLORS.solana, COLORS.solana + '80']}
                style={styles.actionGradient}
              >
                <Copy size={18} color={COLORS.textPrimary} />
                <Text style={styles.actionText}>COPY</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.halfButton]}
              onPress={handleShareAddress}
              disabled={!publicKey}
            >
              <LinearGradient
                colors={[COLORS.gradientPurple[0], COLORS.gradientPurple[0] + '80']}
                style={styles.actionGradient}
              >
                <Send size={18} color={COLORS.textPrimary} />
                <Text style={styles.actionText}>SHARE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Recent Incoming Transactions */}
          <View style={styles.recentTransactionsContainer}>
            <Text style={styles.sectionTitle}>Recent Incoming</Text>
            {loadingTransactions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.solana} />
                <Text style={styles.loadingText}>Loading transactions...</Text>
              </View>
            ) : recentTransactions && recentTransactions.transactions && recentTransactions.transactions.length > 0 ? (
              <ScrollView style={styles.transactionsList} showsVerticalScrollIndicator={false}>
                {recentTransactions.transactions.map((tx, index) => (
                  <View key={index} style={styles.transactionItem}>
                    <View style={styles.transactionIcon}>
                      <ArrowDown size={16} color={COLORS.success} />
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionAmount}>
                        +{tx.amount} {tx.tokenSymbol || 'SOL'}
                      </Text>
                      <Text style={styles.transactionTime}>
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.transactionStatus}>
                      {tx.status === 'CONFIRMED' ? '✓' : '⏳'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyTransactions}>
                <Text style={styles.emptyTransactionsText}>
                  No recent incoming transactions
                </Text>
              </View>
            )}
          </View>

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

      {/* Custom Header: single flow title, no tabs or back */}
      <View style={styles.customHeader}>
        <Text style={styles.headerTitle}>
          {activeTab === 'send' ? 'SEND' : 'RECEIVE'}
        </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  backButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardBackground,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  activeTab: {
    backgroundColor: COLORS.solana,
  },
  tabText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.textPrimary,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  sendDescription: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  receiveDescription: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  formContainer: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  inputSection: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputFocused: {
    borderColor: COLORS.solana,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pasteButton: {
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  pasteButtonText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.solana,
  },
  dropdownButton: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tokenLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  tokenSymbol: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  tokenName: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  tokenBalance: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  dropdownContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.sm,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  dropdownList: {
    maxHeight: 150,
  },
  dropdownItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '30',
  },
  tokenDetails: {
    flex: 1,
  },
  maxButton: {
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  maxButtonText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.solana,
  },
  sendButton: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.error,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.success,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  // Receive styles
  tokenSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tokenSelectorButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  selectedTokenButton: {
    backgroundColor: COLORS.solana,
  },
  tokenSelectorText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  selectedTokenText: {
    color: COLORS.textPrimary,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  qrCodeWrapper: {
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  qrText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  addressContainer: {
    marginBottom: SPACING.lg,
  },
  addressLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  addressBox: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressText: {
    fontSize: 14,
    fontFamily: FONTS.mono,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  actionButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  halfButton: {
    flex: 1,
  },
  actionGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  actionText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  recentTransactionsContainer: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  transactionsList: {
    maxHeight: 200,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
  },
  transactionAmount: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.success,
  },
  transactionTime: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  transactionStatus: {
    fontSize: 16,
    color: COLORS.success,
  },
  emptyTransactions: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyTransactionsText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  walletInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  walletInfoItem: {
    alignItems: 'center',
  },
  walletInfoLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  walletInfoValue: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  walletWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning + '20',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  walletWarningText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.warning,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  modalCloseButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardBackground,
  },
  // Contact styles
  contactsList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  contactAddress: {
    fontSize: 12,
    fontFamily: FONTS.mono,
    color: COLORS.textSecondary,
  },
  emptyContacts: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyContactsText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Confirmation styles
  confirmationContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  confirmationSection: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
  },
  confirmationLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  confirmationValue: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  confirmationAddress: {
    fontSize: 14,
    fontFamily: FONTS.mono,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 'auto',
    paddingBottom: SPACING.xl,
  },
  confirmationButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  confirmButton: {
    // Gradient handled by LinearGradient
  },
  confirmGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  // Validation styles
  validationText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: SPACING.sm,
  },
  validText: {
    color: COLORS.success,
  },
  inputValid: {
    borderColor: COLORS.success,
  },
  // Address input styles
  addressInput: {
    flex: 1,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addressActions: {
    flexDirection: 'column',
    gap: SPACING.sm,
  },
  addressActionButton: {
    padding: SPACING.sm,
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.md,
  },
  // Amount input styles
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  amountSuffix: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  // Fee info styles
  feeInfo: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  feeText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  feeSubtext: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  // Error/Success containers
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '20',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    flex: 1,
    marginRight: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
});