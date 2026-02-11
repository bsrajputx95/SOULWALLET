import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    Modal,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
    FlatList,
    Image,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { X, ChevronDown, ArrowUpDown, AlertTriangle } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { getQuote, searchToken, getTokenList, executeSwap, JupiterToken, SwapQuote } from '../services/swap';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useAlert } from '../contexts/AlertContext';

interface Token {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    logo?: string | undefined;
    balance: number;
}

interface SwapModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    holdings?: Token[];
}

export const SwapModal: React.FC<SwapModalProps> = ({
    visible,
    onClose,
    onSuccess,
    holdings = [],
}) => {
    const { showAlert } = useAlert();
    const { height } = useWindowDimensions();
    const modalHeight = height * 0.9;

    const [fromToken, setFromToken] = useState<Token | null>(null);
    const [toToken, setToToken] = useState<JupiterToken | null>(null);
    const [amount, setAmount] = useState('');
    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [loading, setLoading] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [showFromSearch, setShowFromSearch] = useState(false);
    const [showToSearch, setShowToSearch] = useState(false);
    const [fromSearchQuery, setFromSearchQuery] = useState('');
    const [toSearchQuery, setToSearchQuery] = useState('');
    const [slippage, setSlippage] = useState(0.5);
    const [showSlippageSettings, setShowSlippageSettings] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [quoteError, setQuoteError] = useState('');
    const [jupiterTokens, setJupiterTokens] = useState<JupiterToken[]>([]);
    const [loadingTokens, setLoadingTokens] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (visible) {
            setLoadingTokens(true);
            getTokenList().then(setJupiterTokens).finally(() => setLoadingTokens(false));
        }
    }, [visible]);

    useEffect(() => {
        if (visible && holdings.length > 0 && !fromToken) {
            const solToken = holdings.find(t => t.symbol === 'SOL');
            if (solToken) setFromToken(solToken);
        }
    }, [visible, holdings, fromToken]);

    useEffect(() => {
        if (!visible) {
            setAmount('');
            setQuote(null);
            setQuoteError('');
            setPin('');
            setPinError('');
            setShowPinModal(false);
            setLoading(false);
            setSwapping(false);
        }
    }, [visible]);

    const fetchQuote = useCallback(async (signal?: AbortSignal) => {
        if (!fromToken || !toToken || !amount) {
            setQuote(null);
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setQuote(null);
            return;
        }

        if (fromToken.mint === toToken.address) {
            setQuoteError('Cannot swap same token');
            return;
        }

        const amountInSmallestUnits = Math.floor(amountNum * Math.pow(10, fromToken.decimals));

        setLoading(true);
        setQuoteError('');

        try {
            const slippageBps = Math.round(slippage * 100);
            const quoteResult = await getQuote(
                fromToken.mint,
                toToken.address,
                amountInSmallestUnits,
                slippageBps,
                signal
            );
            setQuote(quoteResult);
        } catch (err: any) {
            setQuoteError(err.message || 'Failed to fetch quote');
            setQuote(null);
        } finally {
            setLoading(false);
        }
    }, [fromToken, toToken, amount, slippage]);

    useEffect(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        const timer = setTimeout(() => fetchQuote(abortControllerRef.current!.signal), 500);
        return () => {
            clearTimeout(timer);
            abortControllerRef.current?.abort();
        };
    }, [fetchQuote]);

    const estimatedOutput = useMemo(() => {
        if (!quote || !toToken) return '0';
        const out = Number(quote.outAmount) / Math.pow(10, toToken.decimals);
        return out < 0.0001 ? out.toExponential(4) : out.toFixed(6);
    }, [quote, toToken]);

    const priceImpact = useMemo(() => {
        if (!quote) return 0;
        return parseFloat(quote.priceImpactPct || '0');
    }, [quote]);

    const minReceived = useMemo(() => {
        if (!quote || !toToken) return '0';
        const out = Number(quote.outAmount) / Math.pow(10, toToken.decimals);
        const min = out * (1 - slippage / 100);
        return min < 0.0001 ? min.toExponential(4) : min.toFixed(6);
    }, [quote, toToken, slippage]);

    const rate = useMemo(() => {
        if (!quote || !fromToken || !toToken) return '';
        const inAmt = Number(quote.inAmount) / Math.pow(10, fromToken.decimals);
        const outAmt = Number(quote.outAmount) / Math.pow(10, toToken.decimals);
        if (inAmt === 0) return '';
        const r = outAmt / inAmt;
        return r < 0.0001 ? r.toExponential(4) : r.toFixed(6);
    }, [quote, fromToken, toToken]);

    const routeLabels = useMemo(() => {
        if (!quote || !quote.routePlan || quote.routePlan.length === 0) return '';
        return quote.routePlan.map(r => r.swapInfo?.label || '').filter(Boolean).join(' → ');
    }, [quote]);

    const handleMaxAmount = () => {
        if (!fromToken) return;
        const max = fromToken.symbol === 'SOL'
            ? Math.max(0, fromToken.balance - 0.001)
            : fromToken.balance;
        setAmount(max.toString());
    };

    const handleFlipTokens = () => {
        if (!fromToken || !toToken) return;

        const matchingHolding = holdings.find(h => h.mint === toToken.address);
        const newFromToken: Token = matchingHolding || {
            symbol: toToken.symbol,
            name: toToken.name,
            mint: toToken.address,
            decimals: toToken.decimals,
            logo: toToken.logoURI || undefined,
            balance: 0,
        };

        const newToToken: JupiterToken = {
            symbol: fromToken.symbol,
            name: fromToken.name,
            address: fromToken.mint,
            decimals: fromToken.decimals,
            logoURI: fromToken.logo || undefined,
        };

        setFromToken(newFromToken);
        setToToken(newToToken);
        setAmount('');
        setQuote(null);
    };

    const handleSwapPress = () => {
        if (!quote || loading || swapping) return;

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showAlert('Error', 'Enter a valid amount');
            return;
        }

        if (fromToken && amountNum > fromToken.balance) {
            showAlert('Error', 'Insufficient balance');
            return;
        }

        setShowPinModal(true);
    };

    const handleConfirmSwap = async () => {
        if (!/^\d+$/.test(pin)) {
            setPinError('PIN must contain only digits');
            return;
        }
        if (pin.length < 4) {
            setPinError('PIN must be at least 4 digits');
            return;
        }
        if (pin.length > 6) {
            setPinError('PIN must not exceed 6 digits');
            return;
        }

        if (!quote) {
            setPinError('No quote available');
            return;
        }

        setSwapping(true);
        setPinError('');

        try {
            const result = await executeSwap(quote, pin);

            setPin('');
            setShowPinModal(false);

            if (result.success) {
                showSuccessToast(`Swapped ${amount} ${fromToken?.symbol}`);
                // Trigger refresh immediately before showing alert
                if (onSuccess) await onSuccess();
                showAlert(
                    'Swap Successful!',
                    `Signature: ${result.signature?.slice(0, 8)}...${result.signature?.slice(-8)}`,
                    [
                        {
                            text: 'View on Solscan',
                            onPress: () => {
                                if (result.explorerUrl) {
                                    Linking.openURL(result.explorerUrl);
                                }
                                onClose();
                            },
                        },
                        {
                            text: 'Done',
                            onPress: () => {
                                onClose();
                            },
                        },
                    ]
                );
            } else {
                showErrorToast(result.error || 'Swap failed');
            }
        } catch (error: any) {
            showAlert('Swap Failed', error.message || 'Failed to execute swap');
        } finally {
            setSwapping(false);
            setPin('');
        }
    };

    const filteredFromTokens = useMemo(() => {
        if (!fromSearchQuery.trim()) return holdings;
        const q = fromSearchQuery.toLowerCase();
        return holdings.filter(
            t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
        );
    }, [holdings, fromSearchQuery]);

    const [filteredToTokens, setFilteredToTokens] = useState<JupiterToken[]>([]);
    const [toSearchLoading, setToSearchLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            setToSearchLoading(true);
            const results = await searchToken(toSearchQuery);
            setFilteredToTokens(results);
            setToSearchLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [toSearchQuery]);

    useEffect(() => {
        if (showToSearch && jupiterTokens.length > 0 && filteredToTokens.length === 0) {
            setFilteredToTokens(jupiterTokens.slice(0, 20));
        }
    }, [showToSearch, jupiterTokens, filteredToTokens.length]);

    const canSwap = quote && !loading && !swapping && fromToken && toToken && parseFloat(amount) > 0;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={[styles.modalContainer, { maxHeight: modalHeight }]}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Swap</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={styles.inputCard}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>From</Text>
                                <TouchableOpacity onPress={handleMaxAmount}>
                                    <Text style={styles.maxButton}>MAX</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.tokenSelector} onPress={() => setShowFromSearch(true)}>
                                <View style={styles.tokenInfo}>
                                    {fromToken?.logo && <Image source={{ uri: fromToken.logo }} style={styles.tokenLogo} />}
                                    <View>
                                        <Text style={styles.tokenSymbol}>{fromToken?.symbol || 'Select'}</Text>
                                        {fromToken && <Text style={styles.tokenBalance}>Balance: {fromToken.balance.toFixed(6)}</Text>}
                                    </View>
                                </View>
                                <ChevronDown size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.input}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                            />
                            {fromToken && parseFloat(amount) > fromToken.balance && (
                                <Text style={styles.errorText}>Insufficient balance</Text>
                            )}
                        </View>

                        <TouchableOpacity style={styles.flipButton} onPress={handleFlipTokens}>
                            <ArrowUpDown size={20} color={COLORS.solana} />
                        </TouchableOpacity>

                        <View style={styles.inputCard}>
                            <Text style={styles.label}>To</Text>
                            <TouchableOpacity style={styles.tokenSelector} onPress={() => setShowToSearch(true)}>
                                <View style={styles.tokenInfo}>
                                    {toToken?.logoURI && <Image source={{ uri: toToken.logoURI }} style={styles.tokenLogo} />}
                                    <View>
                                        <Text style={styles.tokenSymbol}>{toToken?.symbol || 'Select'}</Text>
                                    </View>
                                </View>
                                <ChevronDown size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                            <View style={styles.outputContainer}>
                                {loading ? (
                                    <ActivityIndicator size="small" color={COLORS.solana} />
                                ) : (
                                    <Text style={styles.outputText}>{estimatedOutput}</Text>
                                )}
                            </View>
                            {quoteError ? <Text style={styles.errorText}>{quoteError}</Text> : null}
                        </View>

                        {quote && (
                            <View style={styles.quoteCard}>
                                <View style={styles.quoteRow}>
                                    <Text style={styles.quoteLabel}>Rate</Text>
                                    <Text style={styles.quoteValue}>1 {fromToken?.symbol} ≈ {rate} {toToken?.symbol}</Text>
                                </View>
                                <View style={styles.quoteRow}>
                                    <Text style={styles.quoteLabel}>Price Impact</Text>
                                    <Text style={[styles.quoteValue, priceImpact > 5 && styles.warningText]}>
                                        {priceImpact.toFixed(2)}%
                                        {priceImpact > 5 && <AlertTriangle size={12} color={COLORS.warning} />}
                                    </Text>
                                </View>
                                <View style={styles.quoteRow}>
                                    <Text style={styles.quoteLabel}>Min Received</Text>
                                    <Text style={styles.quoteValue}>{minReceived} {toToken?.symbol}</Text>
                                </View>
                                {routeLabels ? (
                                    <View style={styles.quoteRow}>
                                        <Text style={styles.quoteLabel}>Route</Text>
                                        <Text style={styles.quoteValue}>{routeLabels}</Text>
                                    </View>
                                ) : null}
                            </View>
                        )}

                        <TouchableOpacity style={styles.slippageToggle} onPress={() => setShowSlippageSettings(!showSlippageSettings)}>
                            <Text style={styles.slippageToggleText}>Slippage: {slippage}%</Text>
                            <ChevronDown size={16} color={COLORS.textSecondary} style={showSlippageSettings && { transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>

                        {showSlippageSettings && (
                            <View style={styles.slippageContainer}>
                                <View style={styles.slippagePresets}>
                                    {[0.1, 0.5, 1, 2].map(val => (
                                        <TouchableOpacity
                                            key={val}
                                            style={[styles.slippagePreset, slippage === val && styles.slippagePresetActive]}
                                            onPress={() => setSlippage(val)}
                                        >
                                            <Text style={[styles.slippagePresetText, slippage === val && styles.slippagePresetTextActive]}>{val}%</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <View style={styles.slippageInputRow}>
                                    <TextInput
                                        style={styles.slippageInput}
                                        value={String(slippage)}
                                        onChangeText={text => {
                                            const num = parseFloat(text) || 0.1;
                                            if (num < 0.1) {
                                                setSlippage(0.1);
                                            } else if (num > 50) {
                                                setSlippage(50);
                                            } else {
                                                setSlippage(num);
                                            }
                                        }}
                                        keyboardType="numeric"
                                        placeholder="Custom"
                                        placeholderTextColor={COLORS.textSecondary}
                                    />
                                    <Text style={styles.slippagePercent}>%</Text>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.swapButton, !canSwap && styles.swapButtonDisabled]}
                            onPress={handleSwapPress}
                            disabled={!canSwap}
                        >
                            <Text style={styles.swapButtonText}>
                                {loading ? 'Fetching quote...' : swapping ? 'Swapping...' : 'Swap'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>

            <Modal visible={showFromSearch} animationType="slide" transparent onRequestClose={() => setShowFromSearch(false)}>
                <View style={styles.selectorOverlay}>
                    <View style={styles.selectorContainer}>
                        <View style={styles.selectorHeader}>
                            <Text style={styles.selectorTitle}>Select Token</Text>
                            <TouchableOpacity onPress={() => setShowFromSearch(false)}>
                                <X size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            value={fromSearchQuery}
                            onChangeText={setFromSearchQuery}
                            placeholder="Search by name or symbol"
                            placeholderTextColor={COLORS.textSecondary}
                        />
                        <FlatList
                            data={filteredFromTokens}
                            keyExtractor={item => item.mint}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.tokenItem, fromToken?.mint === item.mint && styles.tokenItemSelected]}
                                    onPress={() => {
                                        setFromToken(item);
                                        setShowFromSearch(false);
                                        setFromSearchQuery('');
                                    }}
                                >
                                    {item.logo && <Image source={{ uri: item.logo }} style={styles.tokenItemLogo} />}
                                    <View style={styles.tokenItemInfo}>
                                        <Text style={styles.tokenItemSymbol}>{item.symbol}</Text>
                                        <Text style={styles.tokenItemName}>{item.name}</Text>
                                    </View>
                                    <Text style={styles.tokenItemBalance}>{item.balance.toFixed(6)}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No tokens with balance</Text>}
                        />
                    </View>
                </View>
            </Modal>

            <Modal visible={showToSearch} animationType="slide" transparent onRequestClose={() => setShowToSearch(false)}>
                <View style={styles.selectorOverlay}>
                    <View style={styles.selectorContainer}>
                        <View style={styles.selectorHeader}>
                            <Text style={styles.selectorTitle}>Select Token</Text>
                            <TouchableOpacity onPress={() => setShowToSearch(false)}>
                                <X size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            value={toSearchQuery}
                            onChangeText={setToSearchQuery}
                            placeholder="Search by name, symbol, or address"
                            placeholderTextColor={COLORS.textSecondary}
                        />
                        {toSearchLoading ? (
                            <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.solana} />
                        ) : (
                            <FlatList
                                data={filteredToTokens}
                                keyExtractor={item => item.address}
                                renderItem={({ item }) => {
                                    const holdingMatch = holdings.find(h => h.mint === item.address);
                                    return (
                                        <TouchableOpacity
                                            style={[styles.tokenItem, toToken?.address === item.address && styles.tokenItemSelected]}
                                            onPress={() => {
                                                setToToken(item);
                                                setShowToSearch(false);
                                                setToSearchQuery('');
                                            }}
                                        >
                                            {item.logoURI && <Image source={{ uri: item.logoURI }} style={styles.tokenItemLogo} />}
                                            <View style={styles.tokenItemInfo}>
                                                <Text style={styles.tokenItemSymbol}>{item.symbol}</Text>
                                                <Text style={styles.tokenItemName}>{item.name}</Text>
                                            </View>
                                            {holdingMatch && <Text style={styles.tokenItemBalance}>{holdingMatch.balance.toFixed(6)}</Text>}
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={<Text style={styles.emptyText}>No tokens found</Text>}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={showPinModal} animationType="slide" transparent onRequestClose={() => { setShowPinModal(false); setPin(''); setPinError(''); }}>
                <View style={styles.selectorOverlay}>
                    <View style={styles.selectorContainer}>
                        <View style={styles.selectorHeader}>
                            <Text style={styles.selectorTitle}>Confirm Swap</Text>
                            <TouchableOpacity onPress={() => { setShowPinModal(false); setPin(''); setPinError(''); }}>
                                <X size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.pinContent}>
                            <Text style={styles.pinLabel}>Enter your wallet PIN to confirm</Text>
                            <TextInput
                                style={[styles.input, styles.pinInput]}
                                value={pin}
                                onChangeText={text => { setPin(text); setPinError(''); }}
                                placeholder="Enter PIN"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                                secureTextEntry
                                maxLength={6}
                                autoFocus
                            />
                            {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}

                            <View style={styles.pinSummary}>
                                <Text style={styles.pinSummaryLabel}>Swapping</Text>
                                <Text style={styles.pinSummaryValue}>{amount} {fromToken?.symbol}</Text>
                                <Text style={styles.pinSummaryLabel}>For approximately</Text>
                                <Text style={styles.pinSummaryValue}>~{estimatedOutput} {toToken?.symbol}</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.swapButton, (swapping || pin.length < 4) && styles.swapButtonDisabled]}
                                onPress={handleConfirmSwap}
                                disabled={swapping || pin.length < 4}
                            >
                                {swapping ? (
                                    <ActivityIndicator color={COLORS.textPrimary} />
                                ) : (
                                    <Text style={styles.swapButtonText}>Confirm Swap</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContainer: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.large,
        paddingBottom: 20,
        width: '100%',
        maxWidth: 400,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBackground,
    },
    title: {
        ...FONTS.phantomBold,
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    content: {
        padding: SPACING.m,
    },
    inputCard: {
        marginBottom: SPACING.m,
        padding: SPACING.m,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
    },
    label: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: SPACING.s,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    maxButton: {
        ...FONTS.phantomBold,
        fontSize: 12,
        color: COLORS.solana,
    },
    tokenSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.s,
        marginBottom: SPACING.s,
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
    tokenSymbol: {
        ...FONTS.phantomBold,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    tokenBalance: {
        ...FONTS.phantomRegular,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    input: {
        ...FONTS.phantomRegular,
        fontSize: 24,
        color: COLORS.textPrimary,
        padding: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.medium,
        backgroundColor: COLORS.background,
    },
    outputContainer: {
        paddingVertical: SPACING.m,
        alignItems: 'flex-start',
    },
    outputText: {
        ...FONTS.phantomBold,
        fontSize: 24,
        color: COLORS.textPrimary,
    },
    flipButton: {
        alignSelf: 'center',
        padding: SPACING.s,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.full,
        marginVertical: -SPACING.s,
        zIndex: 1,
        borderWidth: 2,
        borderColor: COLORS.background,
    },
    quoteCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    quoteRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
    },
    quoteLabel: {
        ...FONTS.phantomRegular,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    quoteValue: {
        ...FONTS.phantomMedium,
        fontSize: 12,
        color: COLORS.textPrimary,
    },
    warningText: {
        color: COLORS.warning,
    },
    slippageToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        marginBottom: SPACING.m,
    },
    slippageToggleText: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    slippageContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        marginTop: -SPACING.s,
    },
    slippagePresets: {
        flexDirection: 'row',
        gap: SPACING.s,
        marginBottom: SPACING.s,
    },
    slippagePreset: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.m,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.small,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    slippagePresetActive: {
        backgroundColor: COLORS.solana + '20',
        borderColor: COLORS.solana,
    },
    slippagePresetText: {
        ...FONTS.phantomMedium,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    slippagePresetTextActive: {
        color: COLORS.solana,
    },
    slippageInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slippageInput: {
        ...FONTS.phantomRegular,
        fontSize: 14,
        color: COLORS.textPrimary,
        padding: SPACING.s,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.small,
        borderWidth: 1,
        borderColor: COLORS.border,
        width: 80,
    },
    slippagePercent: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.textSecondary,
        marginLeft: SPACING.xs,
    },
    swapButton: {
        backgroundColor: COLORS.solana,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.medium,
        alignItems: 'center',
        marginTop: SPACING.m,
    },
    swapButtonDisabled: {
        backgroundColor: COLORS.cardBackground,
        opacity: 0.5,
    },
    swapButtonText: {
        ...FONTS.phantomBold,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    errorText: {
        ...FONTS.phantomRegular,
        fontSize: 12,
        color: COLORS.error,
        marginTop: SPACING.xs,
    },
    selectorOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.l,
    },
    selectorContainer: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.large,
        width: '100%',
        maxHeight: '80%',
        overflow: 'hidden',
    },
    selectorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBackground,
    },
    selectorTitle: {
        ...FONTS.phantomBold,
        fontSize: 18,
        color: COLORS.textPrimary,
    },
    searchInput: {
        ...FONTS.phantomRegular,
        fontSize: 14,
        color: COLORS.textPrimary,
        padding: SPACING.m,
        backgroundColor: COLORS.cardBackground,
        margin: SPACING.m,
        borderRadius: BORDER_RADIUS.medium,
    },
    tokenItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBackground,
    },
    tokenItemSelected: {
        backgroundColor: COLORS.solana + '20',
    },
    tokenItemLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: SPACING.m,
    },
    tokenItemInfo: {
        flex: 1,
    },
    tokenItemSymbol: {
        ...FONTS.phantomBold,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    tokenItemName: {
        ...FONTS.phantomRegular,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    tokenItemBalance: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    emptyText: {
        ...FONTS.phantomRegular,
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        padding: SPACING.l,
    },
    pinContent: {
        padding: SPACING.m,
    },
    pinLabel: {
        ...FONTS.phantomMedium,
        fontSize: 16,
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: SPACING.m,
    },
    pinInput: {
        textAlign: 'center',
        fontSize: 24,
        letterSpacing: 8,
    },
    pinSummary: {
        marginTop: SPACING.l,
        padding: SPACING.m,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
    },
    pinSummaryLabel: {
        ...FONTS.phantomRegular,
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: SPACING.s,
    },
    pinSummaryValue: {
        ...FONTS.phantomBold,
        fontSize: 20,
        color: COLORS.solana,
    },
});

export default SwapModal;
