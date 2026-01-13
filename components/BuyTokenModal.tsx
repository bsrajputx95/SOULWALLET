/**
 * BuyTokenModal - Simple buy popup for purchasing tokens
 * 
 * Shows a minimal UI to buy a token with SOL:
 * - Token info (name/address)
 * - Amount in SOL input
 * - Slippage selection
 * - Buy button
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { X, ArrowDown, AlertTriangle, Check } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSolanaWallet } from '../hooks/solana-wallet-store';
import { jupiterSwap } from '../services/jupiter-swap';
import { trpc } from '../lib/trpc';
import { logger } from '../lib/client-logger';

// SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';

interface BuyTokenModalProps {
    visible: boolean;
    onClose: () => void;
    tokenMint: string | null;
    tokenSymbol?: string;
    tokenName?: string;
}

export const BuyTokenModal: React.FC<BuyTokenModalProps> = ({
    visible,
    onClose,
    tokenMint,
    tokenSymbol,
    tokenName,
}) => {
    const { wallet, publicKey, refreshBalances, getAvailableTokens } = useSolanaWallet();
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState(0.5);
    const [isLoading, setIsLoading] = useState(false);
    const [isBuying, setIsBuying] = useState(false);
    const [estimatedOutput, setEstimatedOutput] = useState<string | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);

    const recordTransactionMutation = trpc.wallet.recordTransaction.useMutation();

    // Get SOL balance
    const availableTokens = getAvailableTokens();
    const solToken = availableTokens.find(t => t.symbol === 'SOL');
    const solBalance = solToken?.balance || 0;

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!visible) {
            setAmount('');
            setEstimatedOutput(null);
            setQuoteError(null);
        }
    }, [visible]);

    // Fetch quote when amount changes
    useEffect(() => {
        if (!tokenMint || !amount || parseFloat(amount) <= 0) {
            setEstimatedOutput(null);
            setQuoteError(null);
            return;
        }

        const fetchQuote = async () => {
            try {
                setIsLoading(true);
                setQuoteError(null);

                const amountInLamports = Math.floor(parseFloat(amount) * 1e9);
                const slippageBps = Math.floor(slippage * 100);

                const quote = await jupiterSwap.getQuote({
                    inputMint: SOL_MINT,
                    outputMint: tokenMint,
                    amount: amountInLamports,
                    slippageBps,
                });

                // Assuming 9 decimals for output token (most common)
                const outputAmount = parseFloat(quote.outAmount) / 1e9;
                setEstimatedOutput(outputAmount.toFixed(4));
            } catch (error) {
                if (__DEV__) logger.error('Quote error:', error);
                setQuoteError('Unable to get quote');
                setEstimatedOutput(null);
            } finally {
                setIsLoading(false);
            }
        };

        const debounce = setTimeout(fetchQuote, 500);
        return () => clearTimeout(debounce);
    }, [tokenMint, amount, slippage]);

    const handleBuy = useCallback(async () => {
        if (!wallet || !publicKey || !tokenMint || !amount) {
            Alert.alert('Error', 'Missing required data');
            return;
        }

        const buyAmount = parseFloat(amount);
        if (isNaN(buyAmount) || buyAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount');
            return;
        }

        if (buyAmount > solBalance) {
            Alert.alert('Insufficient Balance', `You only have ${solBalance.toFixed(4)} SOL`);
            return;
        }

        try {
            setIsBuying(true);

            // Get fresh quote
            const amountInLamports = Math.floor(buyAmount * 1e9);
            const slippageBps = Math.floor(slippage * 100);

            const quote = await jupiterSwap.getQuote({
                inputMint: SOL_MINT,
                outputMint: tokenMint,
                amount: amountInLamports,
                slippageBps,
            });

            // Execute swap
            const signature = await jupiterSwap.executeSwap({
                wallet,
                quoteResponse: quote,
                wrapAndUnwrapSol: true,
                prioritizationFeeLamports: 10000000,
                asLegacyTransaction: false,
            });

            if (!signature) {
                throw new Error('Transaction failed');
            }

            // Record transaction
            try {
                await recordTransactionMutation.mutateAsync({
                    signature,
                    type: 'SWAP',
                    amount: buyAmount,
                    token: SOL_MINT,
                    tokenSymbol: 'SOL',
                    to: publicKey,
                    from: publicKey,
                    notes: `Bought ${tokenSymbol || tokenMint.slice(0, 6)} with ${buyAmount} SOL`,
                });
            } catch (recordError) {
                if (__DEV__) logger.error('Failed to record transaction:', recordError);
            }

            Alert.alert(
                '✅ Purchase Successful!',
                `Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
                [{ text: 'OK', onPress: onClose }]
            );

            await refreshBalances();
        } catch (error) {
            if (__DEV__) logger.error('Buy error:', error);
            Alert.alert('Purchase Failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsBuying(false);
        }
    }, [wallet, publicKey, tokenMint, amount, slippage, solBalance, tokenSymbol, onClose, refreshBalances, recordTransactionMutation]);

    if (!tokenMint) return null;

    const displaySymbol = tokenSymbol || tokenMint.slice(0, 6).toUpperCase();
    const displayName = tokenName || `Token ${tokenMint.slice(0, 8)}...`;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Buy Token</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Token Info */}
                    <View style={styles.tokenInfo}>
                        <View style={styles.tokenIcon}>
                            <Text style={styles.tokenIconText}>{displaySymbol.charAt(0)}</Text>
                        </View>
                        <View style={styles.tokenDetails}>
                            <Text style={styles.tokenSymbol}>{displaySymbol}</Text>
                            <Text style={styles.tokenAddress} numberOfLines={1}>
                                {tokenMint.slice(0, 12)}...{tokenMint.slice(-8)}
                            </Text>
                        </View>
                    </View>

                    {/* Amount Input */}
                    <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Amount (SOL)</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                            <TouchableOpacity
                                style={styles.maxButton}
                                onPress={() => setAmount((solBalance * 0.95).toFixed(4))}
                            >
                                <Text style={styles.maxButtonText}>MAX</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.balanceText}>
                            Balance: {solBalance.toFixed(4)} SOL
                        </Text>
                    </View>

                    {/* Estimated Output */}
                    {amount && parseFloat(amount) > 0 && (
                        <View style={styles.outputSection}>
                            <ArrowDown size={20} color={COLORS.textSecondary} />
                            <View style={styles.outputInfo}>
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={COLORS.solana} />
                                ) : quoteError ? (
                                    <View style={styles.errorRow}>
                                        <AlertTriangle size={16} color={COLORS.error} />
                                        <Text style={styles.errorText}>{quoteError}</Text>
                                    </View>
                                ) : estimatedOutput ? (
                                    <Text style={styles.outputAmount}>
                                        ~{estimatedOutput} {displaySymbol}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    )}

                    {/* Slippage */}
                    <View style={styles.slippageSection}>
                        <Text style={styles.slippageLabel}>Slippage Tolerance</Text>
                        <View style={styles.slippageOptions}>
                            {[0.1, 0.5, 1, 3].map((value) => (
                                <TouchableOpacity
                                    key={value}
                                    style={[
                                        styles.slippageOption,
                                        slippage === value && styles.slippageOptionActive,
                                    ]}
                                    onPress={() => setSlippage(value)}
                                >
                                    <Text
                                        style={[
                                            styles.slippageOptionText,
                                            slippage === value && styles.slippageOptionTextActive,
                                        ]}
                                    >
                                        {value}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Buy Button */}
                    <TouchableOpacity
                        style={[
                            styles.buyButton,
                            (!amount || parseFloat(amount) <= 0 || isBuying || quoteError) && styles.buyButtonDisabled,
                        ]}
                        onPress={handleBuy}
                        disabled={!amount || parseFloat(amount) <= 0 || isBuying || !!quoteError}
                    >
                        {isBuying ? (
                            <ActivityIndicator size="small" color={COLORS.textPrimary} />
                        ) : (
                            <>
                                <Check size={20} color={COLORS.textPrimary} />
                                <Text style={styles.buyButtonText}>Buy {displaySymbol}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Powered by Jupiter */}
                    <Text style={styles.poweredBy}>Powered by Jupiter</Text>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.m,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.large,
        padding: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    title: {
        ...FONTS.orbitronBold,
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.medium,
        marginBottom: SPACING.l,
    },
    tokenIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.solana + '30',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    tokenIconText: {
        ...FONTS.orbitronBold,
        fontSize: 18,
        color: COLORS.solana,
    },
    tokenDetails: {
        flex: 1,
    },
    tokenSymbol: {
        ...FONTS.phantomBold,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    tokenAddress: {
        ...FONTS.sfProRegular,
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    inputSection: {
        marginBottom: SPACING.m,
    },
    inputLabel: {
        ...FONTS.sfProMedium,
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.medium,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    input: {
        flex: 1,
        ...FONTS.sfProMedium,
        fontSize: 24,
        color: COLORS.textPrimary,
        padding: SPACING.m,
    },
    maxButton: {
        backgroundColor: COLORS.solana,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.small,
        marginRight: SPACING.s,
    },
    maxButtonText: {
        ...FONTS.sfProBold,
        fontSize: 12,
        color: COLORS.textPrimary,
    },
    balanceText: {
        ...FONTS.sfProRegular,
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    outputSection: {
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    outputInfo: {
        marginTop: SPACING.xs,
        minHeight: 24,
    },
    outputAmount: {
        ...FONTS.phantomBold,
        fontSize: 18,
        color: COLORS.success,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    errorText: {
        ...FONTS.sfProRegular,
        fontSize: 14,
        color: COLORS.error,
    },
    slippageSection: {
        marginBottom: SPACING.l,
    },
    slippageLabel: {
        ...FONTS.sfProMedium,
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: SPACING.s,
    },
    slippageOptions: {
        flexDirection: 'row',
        gap: SPACING.s,
    },
    slippageOption: {
        flex: 1,
        paddingVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.small,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    slippageOptionActive: {
        backgroundColor: COLORS.solana,
        borderColor: COLORS.solana,
    },
    slippageOptionText: {
        ...FONTS.sfProMedium,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    slippageOptionTextActive: {
        color: COLORS.textPrimary,
    },
    buyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.success,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.medium,
        gap: SPACING.s,
    },
    buyButtonDisabled: {
        backgroundColor: COLORS.textSecondary,
        opacity: 0.5,
    },
    buyButtonText: {
        ...FONTS.phantomBold,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    poweredBy: {
        ...FONTS.sfProRegular,
        fontSize: 11,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.m,
    },
});

export default BuyTokenModal;
