import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TextInput,
    Pressable,
    ActivityIndicator,
    ScrollView,
    Image,
} from 'react-native';
import { X, Search, AlertCircle, ShoppingCart, Shield } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { getQuote, executeSwap } from '../services/swap';
import { api } from '../services/api';
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
    verified: boolean;
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

    // Abort controllers for race condition prevention
    const verifyAbortRef = useRef<AbortController | null>(null);
    const quoteAbortRef = useRef<AbortController | null>(null);

    // Reset on open
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

    // Fetch quote with debounce and abort
    useEffect(() => {
        // Cancel previous quote request
        if (quoteAbortRef.current) {
            quoteAbortRef.current.abort();
        }

        if (!tokenInfo || !solAmount || parseFloat(solAmount) <= 0) {
            setQuote(null);
            return;
        }

        const controller = new AbortController();
        quoteAbortRef.current = controller;

        const fetchQuote = async () => {
            setIsFetchingQuote(true);
            try {
                const amountInLamports = Math.floor(parseFloat(solAmount) * Math.pow(10, SOL_DECIMALS));
                const slippageBps = Math.round(parseFloat(slippage || '1') * 100);

                const quoteResult = await getQuote(
                    SOL_MINT,
                    tokenInfo.address,
                    amountInLamports,
                    slippageBps,
                    controller.signal
                );

                if (!controller.signal.aborted) {
                    setQuote(quoteResult);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    setQuote(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsFetchingQuote(false);
                }
            }
        };

        const timer = setTimeout(fetchQuote, 400);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [tokenInfo, solAmount, slippage]);

    // Validate Solana address
    const isValidSolanaAddress = useCallback((address: string): boolean => {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
    }, []);

    // Verify token with abort support
    const handleVerifyToken = useCallback(async () => {
        const addr = tokenAddress.trim();
        if (!addr) {
            setError('Enter token address');
            return;
        }
        if (!isValidSolanaAddress(addr)) {
            setError('Invalid address format');
            return;
        }

        // Cancel previous verification
        if (verifyAbortRef.current) {
            verifyAbortRef.current.abort();
        }

        const controller = new AbortController();
        verifyAbortRef.current = controller;

        setIsVerifying(true);
        setError(null);
        setTokenInfo(null);

        try {
            const data = await api.get<{ tokens: any[] }>(`/tokens/search?query=${addr}`);
            
            if (controller.signal.aborted) return;

            const token = data.tokens?.find((t: any) => t.id === addr || t.address === addr);

            if (token) {
                setTokenInfo({
                    address: token.id || token.address,
                    symbol: token.symbol || 'Unknown',
                    name: token.name || 'Unknown Token',
                    decimals: token.decimals || 9,
                    logoURI: token.logoURI || token.icon || token.image,
                    verified: token.verified || false,
                });
            } else {
                // Unknown token - allow with warning
                setTokenInfo({
                    address: addr,
                    symbol: 'Unknown',
                    name: 'Unverified Token',
                    decimals: 9,
                    verified: false,
                });
            }
        } catch {
            if (!controller.signal.aborted) {
                setError('Verification failed');
            }
        } finally {
            if (!controller.signal.aborted) {
                setIsVerifying(false);
            }
        }
    }, [tokenAddress]);

    // Auto-verify on complete address
    useEffect(() => {
        if (tokenAddress.length >= 32 && isValidSolanaAddress(tokenAddress)) {
            const timer = setTimeout(() => {
                handleVerifyToken();
            }, 600);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [tokenAddress, handleVerifyToken]);

    // Execute buy
    const handleBuy = () => {
        if (!tokenInfo || !solAmount || parseFloat(solAmount) <= 0 || !quote) {
            setError('Complete all fields');
            return;
        }
        setShowPinInput(true);
        setError(null);
    };

    // Confirm swap
    const handleConfirmSwap = async () => {
        if (!pin || pin.length < 4 || !quote) {
            setError('Enter valid PIN');
            return;
        }

        setIsBuying(true);
        setError(null);

        try {
            const result = await executeSwap(quote, pin);

            if (result.success) {
                showSuccessToast(`Bought ${tokenInfo?.symbol}`);
                setPin('');
                onClose();
                onSuccess?.();
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

    const estimatedOutput = quote && tokenInfo
        ? (Number(quote.outAmount) / Math.pow(10, tokenInfo.decimals)).toFixed(6)
        : '0';

    const canBuy = tokenInfo && solAmount && parseFloat(solAmount) > 0 && quote && !isFetchingQuote;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
                            <Text style={styles.label}>Token Address</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Paste token mint address..."
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
                            <View style={[styles.tokenCard, !tokenInfo.verified && styles.tokenCardUnverified]}>
                                <View style={styles.tokenInfo}>
                                    {tokenInfo.logoURI ? (
                                        <Image source={{ uri: tokenInfo.logoURI }} style={styles.tokenLogo} />
                                    ) : (
                                        <View style={styles.tokenLogoPlaceholder}>
                                            <Text style={styles.tokenLogoText}>{tokenInfo.symbol[0]}</Text>
                                        </View>
                                    )}
                                    <View style={styles.tokenDetails}>
                                        <Text style={styles.tokenSymbol}>{tokenInfo.symbol}</Text>
                                        <Text style={styles.tokenName} numberOfLines={1}>{tokenInfo.name}</Text>
                                    </View>
                                    {tokenInfo.verified ? (
                                        <View style={styles.verifiedBadge}>
                                            <Shield size={14} color={COLORS.success} />
                                            <Text style={styles.verifiedText}>Verified</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.unverifiedBadge}>
                                            <AlertCircle size={14} color={COLORS.warning} />
                                            <Text style={styles.unverifiedText}>Unknown</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Warning for unverified */}
                        {tokenInfo && !tokenInfo.verified && (
                            <View style={styles.warningBox}>
                                <AlertCircle size={14} color={COLORS.warning} />
                                <Text style={styles.warningText}>Unverified token. Trade with caution.</Text>
                            </View>
                        )}

                        {/* Amount Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Amount (SOL)</Text>
                            <View style={styles.amountRow}>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholder="0.1"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={solAmount}
                                    onChangeText={setSolAmount}
                                    keyboardType="decimal-pad"
                                    editable={!isBuying}
                                />
                                <Text style={styles.solLabel}>SOL</Text>
                            </View>
                            <View style={styles.presetRow}>
                                {['0.1', '0.5', '1', '2'].map((p) => (
                                    <Pressable
                                        key={p}
                                        style={[styles.presetBtn, solAmount === p && styles.presetBtnActive]}
                                        onPress={() => setSolAmount(p)}
                                        disabled={isBuying}
                                    >
                                        <Text style={[styles.presetText, solAmount === p && styles.presetTextActive]}>
                                            {p}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Slippage */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Slippage (%)</Text>
                            <View style={styles.presetRow}>
                                {['0.5', '1', '2', '5'].map((p) => (
                                    <Pressable
                                        key={p}
                                        style={[styles.presetBtn, slippage === p && styles.presetBtnActive]}
                                        onPress={() => setSlippage(p)}
                                        disabled={isBuying}
                                    >
                                        <Text style={[styles.presetText, slippage === p && styles.presetTextActive]}>
                                            {p}%
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Quote Loading */}
                        {isFetchingQuote && (
                            <View style={styles.quoteLoading}>
                                <ActivityIndicator size="small" color={COLORS.solana} />
                                <Text style={styles.quoteLoadingText}>Fetching quote...</Text>
                            </View>
                        )}

                        {/* Estimated Output */}
                        {quote && !isFetchingQuote && (
                            <View style={styles.estimateCard}>
                                <Text style={styles.estimateLabel}>You'll receive</Text>
                                <Text style={styles.estimateValue}>
                                    ~{estimatedOutput} {tokenInfo?.symbol}
                                </Text>
                            </View>
                        )}

                        {/* PIN Input */}
                        {showPinInput && (
                            <View style={styles.pinContainer}>
                                <Text style={styles.label}>Enter PIN</Text>
                                <TextInput
                                    style={styles.pinInput}
                                    placeholder="****"
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
                                        style={[styles.pinBtn, styles.pinCancelBtn]}
                                        onPress={() => { setShowPinInput(false); setPin(''); }}
                                        disabled={isBuying}
                                    >
                                        <Text style={styles.pinCancelText}>Back</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.pinBtn, styles.pinConfirmBtn, (!pin || pin.length < 4) && styles.disabledBtn]}
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

                        {/* Error */}
                        {error && (
                            <View style={styles.errorBox}>
                                <AlertCircle size={14} color={COLORS.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {/* Buy Button */}
                        {!showPinInput && (
                            <Pressable
                                style={[styles.buyButton, !canBuy && styles.buyButtonDisabled]}
                                onPress={handleBuy}
                                disabled={!canBuy}
                            >
                                <LinearGradient
                                    colors={canBuy ? [COLORS.success, COLORS.success + '80'] : [COLORS.textSecondary, COLORS.textSecondary + '80']}
                                    style={styles.buyButtonGradient}
                                >
                                    <Text style={styles.buyButtonText}>
                                        {isFetchingQuote ? 'Getting Quote...' : 'Buy Now'}
                                    </Text>
                                </LinearGradient>
                            </Pressable>
                        )}

                        <Text style={styles.disclaimer}>
                            ⚠️ Verify token address before trading
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
    tokenCardUnverified: {
        borderColor: COLORS.warning + '50',
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
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.success + '20',
        paddingHorizontal: SPACING.s,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.small,
        gap: 4,
    },
    verifiedText: {
        ...FONTS.phantomMedium,
        color: COLORS.success,
        fontSize: 11,
    },
    unverifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.warning + '20',
        paddingHorizontal: SPACING.s,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.small,
        gap: 4,
    },
    unverifiedText: {
        ...FONTS.phantomMedium,
        color: COLORS.warning,
        fontSize: 11,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        backgroundColor: COLORS.warning + '20',
        borderRadius: BORDER_RADIUS.small,
        padding: SPACING.m,
        marginBottom: SPACING.l,
    },
    warningText: {
        ...FONTS.phantomRegular,
        color: COLORS.warning,
        fontSize: 12,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    solLabel: {
        ...FONTS.phantomBold,
        color: COLORS.solana,
        fontSize: 14,
        marginLeft: SPACING.m,
    },
    presetRow: {
        flexDirection: 'row',
        gap: SPACING.s,
        marginTop: SPACING.s,
    },
    presetBtn: {
        flex: 1,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.small,
        paddingVertical: SPACING.xs,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
    },
    presetBtnActive: {
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
    quoteLoading: {
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
        alignItems: 'center',
    },
    estimateLabel: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    estimateValue: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 20,
        marginTop: SPACING.xs,
    },
    pinContainer: {
        marginBottom: SPACING.l,
    },
    pinInput: {
        ...FONTS.monospace,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        color: COLORS.textPrimary,
        fontSize: 20,
        textAlign: 'center',
        letterSpacing: 8,
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
    },
    pinButtons: {
        flexDirection: 'row',
        gap: SPACING.m,
        marginTop: SPACING.m,
    },
    pinBtn: {
        flex: 1,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.medium,
        alignItems: 'center',
    },
    pinCancelBtn: {
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.textSecondary + '30',
    },
    pinCancelText: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 16,
    },
    pinConfirmBtn: {
        backgroundColor: COLORS.solana,
    },
    pinConfirmText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    disabledBtn: {
        opacity: 0.5,
    },
    errorBox: {
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
});

export default QuickBuyModal;
