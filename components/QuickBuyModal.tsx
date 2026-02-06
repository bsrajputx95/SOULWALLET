import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TextInput,
    Pressable,
    ActivityIndicator,
    Alert,
    ScrollView,
    Image,
} from 'react-native';
import { X, Search, AlertCircle, CheckCircle, ShoppingCart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { getQuote, executeSwap, getTokenList, JupiterToken } from '../services/swap';
import { showSuccessToast, showErrorToast } from '../utils/toast';

interface QuickBuyModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string;
    decimals: number;
    price?: number;
    verified?: boolean;
    source?: 'jupiter' | 'generic';
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_DECIMALS = 9;

export const QuickBuyModal: React.FC<QuickBuyModalProps> = ({ visible, onClose, onSuccess }) => {
    const [tokenAddress, setTokenAddress] = useState('');
    const [solAmount, setSolAmount] = useState('');
    const [slippage, setSlippage] = useState('1');
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isBuying, setIsBuying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quote, setQuote] = useState<any>(null);
    const [isFetchingQuote, setIsFetchingQuote] = useState(false);
    const [showPinInput, setShowPinInput] = useState(false);
    const [pin, setPin] = useState('');
    const [jupiterTokens, setJupiterTokens] = useState<JupiterToken[]>([]);

    // Load Jupiter token list on mount
    useEffect(() => {
        getTokenList().then(setJupiterTokens).catch(() => {});
    }, []);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setTokenAddress('');
            setSolAmount('');
            setSlippage('1');
            setTokenInfo(null);
            setError(null);
            setQuote(null);
            setShowPinInput(false);
            setPin('');
        }
    }, [visible]);

    // Fetch quote when inputs change
    useEffect(() => {
        const fetchQuote = async () => {
            if (!tokenInfo || !solAmount || parseFloat(solAmount) <= 0) {
                setQuote(null);
                return;
            }

            setIsFetchingQuote(true);
            try {
                const amountInLamports = Math.floor(parseFloat(solAmount) * Math.pow(10, SOL_DECIMALS));
                const slippageBps = Math.round(parseFloat(slippage || '1') * 100);
                
                const quoteResult = await getQuote(
                    SOL_MINT,
                    tokenInfo.address,
                    amountInLamports,
                    slippageBps
                );
                
                setQuote(quoteResult);
            } catch (err: any) {
                setQuote(null);
            } finally {
                setIsFetchingQuote(false);
            }
        };

        const timer = setTimeout(fetchQuote, 500);
        return () => clearTimeout(timer);
    }, [tokenInfo, solAmount, slippage]);

    // Validate Solana address format (32-44 base58 chars)
    const isValidSolanaAddress = (address: string): boolean => {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
    };

    // Verify token with Jupiter token list
    const handleVerifyToken = async () => {
        const addr = tokenAddress.trim();
        if (!addr) {
            setError('Please enter a token address');
            return;
        }
        if (!isValidSolanaAddress(addr)) {
            setError('Invalid Solana token address format');
            return;
        }

        setIsVerifying(true);
        setError(null);
        setTokenInfo(null);

        try {
            // Check if token is in Jupiter's verified list
            const jupiterToken = jupiterTokens.find(t => t.address === addr);
            
            if (jupiterToken) {
                setTokenInfo({
                    address: jupiterToken.address,
                    symbol: jupiterToken.symbol,
                    name: jupiterToken.name,
                    decimals: jupiterToken.decimals,
                    logoURI: jupiterToken.logoURI,
                    verified: true,
                    source: 'jupiter',
                });
            } else {
                // For unverified tokens, use generic info
                setTokenInfo({
                    address: addr,
                    symbol: 'UNKNOWN',
                    name: 'Unknown Token',
                    decimals: 9,
                    verified: false,
                    source: 'generic',
                });
            }
        } catch {
            setError('Unable to verify token');
        } finally {
            setIsVerifying(false);
        }
    };

    // Auto-verify when address looks complete
    useEffect(() => {
        if (tokenAddress.length >= 32 && isValidSolanaAddress(tokenAddress)) {
            const timer = setTimeout(() => {
                void handleVerifyToken();
            }, 500);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [tokenAddress]);

    // Execute buy using Jupiter swap
    const handleBuy = async () => {
        if (!tokenInfo) {
            setError('Please verify the token first');
            return;
        }

        const amount = parseFloat(solAmount);
        if (isNaN(amount) || amount <= 0) {
            setError('Please enter a valid SOL amount');
            return;
        }

        if (!quote) {
            setError('No swap quote available');
            return;
        }

        setShowPinInput(true);
    };

    // Confirm swap with PIN
    const handleConfirmSwap = async () => {
        if (!pin || pin.length < 4) {
            setError('Please enter a valid PIN (min 4 digits)');
            return;
        }

        if (!quote) {
            setError('No quote available');
            return;
        }

        setIsBuying(true);
        setError(null);

        try {
            const result = await executeSwap(quote, pin);

            if (result.success) {
                showSuccessToast(`Bought ${tokenInfo?.symbol || 'tokens'}`);
                setPin('');
                setShowPinInput(false);
                onClose();
                onSuccess?.();
                
                Alert.alert(
                    'Swap Successful!',
                    `You swapped ${solAmount} SOL for ${tokenInfo?.symbol}`,
                    [
                        {
                            text: 'View on Solscan',
                            onPress: () => {
                                if (result.explorerUrl) {
                                    // Open in browser
                                }
                            },
                        },
                        { text: 'Done', style: 'default' }
                    ]
                );
            } else {
                setError(result.error || 'Swap failed');
                showErrorToast(result.error || 'Swap failed');
            }
        } catch (err: any) {
            const msg = err.message || 'Swap failed';
            setError(msg);
            showErrorToast(msg);
        } finally {
            setIsBuying(false);
        }
    };

    // Calculate estimated output
    const estimatedOutput = quote && tokenInfo
        ? (Number(quote.outAmount) / Math.pow(10, tokenInfo.decimals)).toFixed(6)
        : '0';

    const canBuy = tokenInfo && solAmount && parseFloat(solAmount) > 0 && quote && !isFetchingQuote;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <ShoppingCart size={24} color={COLORS.solana} />
                            <Text style={styles.title}>Quick Buy</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={COLORS.textSecondary} />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Token Address Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Token Contract Address</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter token mint address..."
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={tokenAddress}
                                    onChangeText={setTokenAddress}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!isBuying}
                                />
                                <Pressable
                                    style={styles.verifyButton}
                                    onPress={handleVerifyToken}
                                    disabled={isVerifying || isBuying}
                                >
                                    {isVerifying ? (
                                        <ActivityIndicator size="small" color={COLORS.solana} />
                                    ) : (
                                        <Search size={20} color={COLORS.solana} />
                                    )}
                                </Pressable>
                            </View>
                        </View>

                        {/* Token Info Card */}
                        {tokenInfo && (
                            <View style={[
                                styles.tokenCard,
                                !tokenInfo.verified && styles.tokenCardUnverified
                            ]}>
                                <View style={styles.tokenInfo}>
                                    {tokenInfo.logoURI ? (
                                        <Image source={{ uri: tokenInfo.logoURI }} style={styles.tokenLogo} />
                                    ) : (
                                        <View style={styles.tokenLogoPlaceholder}>
                                            <Text style={styles.tokenLogoText}>{tokenInfo.symbol?.[0]}</Text>
                                        </View>
                                    )}
                                    <View style={styles.tokenDetails}>
                                        <Text style={styles.tokenSymbol}>{tokenInfo.symbol}</Text>
                                        <Text style={styles.tokenName}>{tokenInfo.name}</Text>
                                    </View>
                                    {tokenInfo.verified ? (
                                        <CheckCircle size={20} color={COLORS.success} />
                                    ) : (
                                        <AlertCircle size={20} color={COLORS.warning || '#FFB800'} />
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Warning for unverified tokens */}
                        {tokenInfo && !tokenInfo.verified && (
                            <View style={styles.warningContainer}>
                                <AlertCircle size={16} color={COLORS.warning || '#FFB800'} />
                                <Text style={styles.warningText}>
                                    ⚠️ Unverified token. Verify the contract address on Solscan before trading.
                                </Text>
                            </View>
                        )}

                        {/* Amount Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Amount (SOL)</Text>
                            <View style={styles.amountContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0.1"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={solAmount}
                                    onChangeText={setSolAmount}
                                    keyboardType="decimal-pad"
                                    editable={!isBuying}
                                />
                                <Text style={styles.solLabel}>SOL</Text>
                            </View>
                            <View style={styles.presetButtons}>
                                {['0.1', '0.5', '1', '2'].map((preset) => (
                                    <Pressable
                                        key={preset}
                                        style={[styles.presetButton, solAmount === preset && styles.presetButtonActive]}
                                        onPress={() => setSolAmount(preset)}
                                        disabled={isBuying}
                                    >
                                        <Text style={[styles.presetText, solAmount === preset && styles.presetTextActive]}>
                                            {preset} SOL
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Slippage Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Slippage Tolerance (%)</Text>
                            <View style={styles.slippageContainer}>
                                <TextInput
                                    style={[styles.input, styles.slippageInput]}
                                    placeholder="1"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={slippage}
                                    onChangeText={setSlippage}
                                    keyboardType="decimal-pad"
                                    editable={!isBuying}
                                />
                                <Text style={styles.percentLabel}>%</Text>
                            </View>
                            <View style={styles.presetButtons}>
                                {['0.5', '1', '2', '5'].map((preset) => (
                                    <Pressable
                                        key={preset}
                                        style={[styles.presetButton, slippage === preset && styles.presetButtonActive]}
                                        onPress={() => setSlippage(preset)}
                                        disabled={isBuying}
                                    >
                                        <Text style={[styles.presetText, slippage === preset && styles.presetTextActive]}>
                                            {preset}%
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Quote Loading */}
                        {isFetchingQuote && (
                            <View style={styles.quoteLoadingContainer}>
                                <ActivityIndicator size="small" color={COLORS.solana} />
                                <Text style={styles.quoteLoadingText}>Fetching quote...</Text>
                            </View>
                        )}

                        {/* Estimated Output */}
                        {quote && !isFetchingQuote && (
                            <View style={styles.estimateCard}>
                                <Text style={styles.estimateLabel}>Estimated Output</Text>
                                <Text style={styles.estimateValue}>
                                    ~{estimatedOutput} {tokenInfo?.symbol}
                                </Text>
                                <Text style={styles.estimateSubtext}>
                                    Slippage: {slippage}%
                                </Text>
                            </View>
                        )}

                        {/* PIN Input (shown when confirming) */}
                        {showPinInput && (
                            <View style={styles.pinContainer}>
                                <Text style={styles.label}>Enter Wallet PIN</Text>
                                <TextInput
                                    style={[styles.input, styles.pinInput]}
                                    placeholder="Enter PIN"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={pin}
                                    onChangeText={setPin}
                                    keyboardType="numeric"
                                    secureTextEntry
                                    maxLength={6}
                                    autoFocus
                                    editable={!isBuying}
                                />
                                <View style={styles.pinButtons}>
                                    <Pressable
                                        style={[styles.pinButton, styles.pinCancelButton]}
                                        onPress={() => { setShowPinInput(false); setPin(''); }}
                                        disabled={isBuying}
                                    >
                                        <Text style={styles.pinCancelText}>Back</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.pinButton, styles.pinConfirmButton, (!pin || pin.length < 4) && styles.disabledButton]}
                                        onPress={handleConfirmSwap}
                                        disabled={!pin || pin.length < 4 || isBuying}
                                    >
                                        {isBuying ? (
                                            <ActivityIndicator size="small" color={COLORS.textPrimary} />
                                        ) : (
                                            <Text style={styles.pinConfirmText}>Confirm</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        {/* Error Message */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <AlertCircle size={16} color={COLORS.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {/* Buy Button (hidden when showing PIN input) */}
                        {!showPinInput && (
                            <Pressable
                                style={[
                                    styles.buyButton,
                                    (!canBuy) && styles.buyButtonDisabled
                                ]}
                                onPress={handleBuy}
                                disabled={!canBuy}
                            >
                                <LinearGradient
                                    colors={canBuy
                                        ? [COLORS.success, COLORS.success + '80']
                                        : [COLORS.textSecondary, COLORS.textSecondary + '80']
                                    }
                                    style={styles.buyButtonGradient}
                                >
                                    <Text style={styles.buyButtonText}>
                                        {isFetchingQuote ? 'Getting Quote...' : 'Buy Now'}
                                    </Text>
                                </LinearGradient>
                            </Pressable>
                        )}

                        <Text style={styles.disclaimer}>
                            ⚠️ Always verify the token address. Do your own research before buying.
                        </Text>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: BORDER_RADIUS.large,
        borderTopRightRadius: BORDER_RADIUS.large,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: COLORS.solana + '30',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBackground,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    title: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 20,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    content: {
        padding: SPACING.l,
    },
    inputGroup: {
        marginBottom: SPACING.l,
    },
    label: {
        ...FONTS.phantomSemiBold,
        color: COLORS.textPrimary,
        fontSize: 14,
        marginBottom: SPACING.s,
    },
    inputRow: {
        flexDirection: 'row',
        gap: SPACING.s,
    },
    input: {
        ...FONTS.monospace,
        flex: 1,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        color: COLORS.textPrimary,
        fontSize: 14,
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
    },
    verifyButton: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.solana + '30',
    },
    tokenCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.success + '30',
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tokenLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: SPACING.m,
    },
    tokenLogoPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.solana + '30',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    tokenLogoText: {
        ...FONTS.phantomBold,
        color: COLORS.solana,
        fontSize: 16,
    },
    tokenDetails: {
        flex: 1,
    },
    tokenSymbol: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    tokenName: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    solLabel: {
        ...FONTS.phantomBold,
        color: COLORS.solana,
        fontSize: 14,
        marginLeft: SPACING.m,
    },
    presetButtons: {
        flexDirection: 'row',
        gap: SPACING.s,
        marginTop: SPACING.s,
    },
    presetButton: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.small,
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
    },
    presetButtonActive: {
        backgroundColor: COLORS.solana + '20',
        borderColor: COLORS.solana,
    },
    presetText: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    presetTextActive: {
        color: COLORS.solana,
    },
    slippageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slippageInput: {
        flex: 0.3,
    },
    percentLabel: {
        ...FONTS.phantomBold,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginLeft: SPACING.s,
    },
    quoteLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.l,
        gap: SPACING.s,
    },
    quoteLoadingText: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    estimateCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
    },
    estimateLabel: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
        marginBottom: SPACING.xs,
    },
    estimateValue: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 18,
    },
    estimateSubtext: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: SPACING.xs,
    },
    pinContainer: {
        marginBottom: SPACING.l,
    },
    pinInput: {
        textAlign: 'center',
        letterSpacing: 8,
        fontSize: 20,
    },
    pinButtons: {
        flexDirection: 'row',
        gap: SPACING.m,
        marginTop: SPACING.m,
    },
    pinButton: {
        flex: 1,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.medium,
        alignItems: 'center',
    },
    pinCancelButton: {
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.textSecondary + '30',
    },
    pinCancelText: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 16,
    },
    pinConfirmButton: {
        backgroundColor: COLORS.solana,
    },
    pinConfirmText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.5,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        backgroundColor: COLORS.error + '20',
        borderRadius: BORDER_RADIUS.small,
        padding: SPACING.m,
        marginBottom: SPACING.l,
    },
    errorText: {
        ...FONTS.phantomRegular,
        color: COLORS.error,
        fontSize: 12,
        flex: 1,
    },
    buyButton: {
        borderRadius: BORDER_RADIUS.medium,
        overflow: 'hidden',
        marginBottom: SPACING.m,
    },
    buyButtonDisabled: {
        opacity: 0.6,
    },
    buyButtonGradient: {
        paddingVertical: SPACING.l,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyButtonText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 18,
    },
    disclaimer: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 11,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    tokenCardUnverified: {
        borderColor: (COLORS.warning || '#FFB800') + '50',
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        backgroundColor: (COLORS.warning || '#FFB800') + '20',
        borderRadius: BORDER_RADIUS.small,
        padding: SPACING.m,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: (COLORS.warning || '#FFB800') + '40',
    },
    warningText: {
        ...FONTS.phantomRegular,
        color: COLORS.warning || '#FFB800',
        fontSize: 12,
        flex: 1,
    },
});

export default QuickBuyModal;
