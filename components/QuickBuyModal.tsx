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
import { useSolanaWallet } from '../hooks/solana-wallet-store';
import { logger } from '../lib/client-logger';
import { trpcClient } from '../lib/trpc';

interface QuickBuyModalProps {
    visible: boolean;
    onClose: () => void;
}

interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string;
    decimals: number;
    price?: number;
    // Verification status
    verified?: boolean; // true if from Jupiter strict list
    source?: 'jupiter' | 'quote' | 'generic'; // where the metadata came from
    hasMetadata?: boolean; // whether full metadata is available
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';

export const QuickBuyModal: React.FC<QuickBuyModalProps> = ({ visible, onClose }) => {
    const { publicKey, balance, executeSwap, refreshBalances } = useSolanaWallet();

    const [tokenAddress, setTokenAddress] = useState('');
    const [solAmount, setSolAmount] = useState('');
    const [slippage, setSlippage] = useState('1');
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isBuying, setIsBuying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setTokenAddress('');
            setSolAmount('');
            setSlippage('1');
            setTokenInfo(null);
            setError(null);
        }
    }, [visible]);

    // Validate Solana address format (32-44 base58 chars)
    const isValidSolanaAddress = (address: string): boolean => {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
    };

    // Verify token with retry logic (max 3 attempts)
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

        const address = tokenAddress.trim();
        const MAX_ATTEMPTS = 3;
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                logger.info(`[QuickBuy] Verifying token (attempt ${attempt}) via backend`);
                const res = await trpcClient.market.verifyToken.query({ tokenAddress: address });
                setTokenInfo({
                    address,
                    symbol: res.symbol,
                    name: res.name,
                    logoURI: res.logoURI || undefined,
                    decimals: res.decimals,
                    price: res.price || 0,
                    verified: res.verified,
                    source: res.source,
                    hasMetadata: res.hasMetadata,
                });
                setIsVerifying(false);
                return;
            } catch (err) {
                lastError = err;
                if (attempt < MAX_ATTEMPTS) {
                    await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)));
                }
            }
        }
        logger.error('[QuickBuy] Token verification failed:', lastError as Error);
        setError('Unable to verify token after multiple attempts.');
        setIsVerifying(false);
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

    // Execute buy via Jupiter
    const handleBuy = async () => {
        if (!publicKey) {
            Alert.alert('Connect Wallet', 'Please connect your wallet to buy tokens.');
            return;
        }

        if (!tokenInfo) {
            setError('Please verify the token first');
            return;
        }

        const amount = parseFloat(solAmount);
        if (isNaN(amount) || amount <= 0) {
            setError('Please enter a valid SOL amount');
            return;
        }

        if (amount > (balance || 0)) {
            setError(`Insufficient SOL balance. You have ${balance?.toFixed(4)} SOL`);
            return;
        }

        const slippageBps = Math.round(parseFloat(slippage) * 100);
        if (isNaN(slippageBps) || slippageBps < 10 || slippageBps > 5000) {
            setError('Slippage must be between 0.1% and 50%');
            return;
        }

        setIsBuying(true);
        setError(null);

        try {
            // 1. Fetch quote from backend (optional, mainly for price impact/output preview)
            const quote = await trpcClient.swap.getQuote.query({
                inputMint: SOL_MINT,
                outputMint: tokenInfo.address,
                amount,
                slippage: parseFloat(slippage),
            });

            // 2. Request swap transaction from backend
            const swapRes = await trpcClient.swap.swap.mutate({
                fromMint: SOL_MINT,
                toMint: tokenInfo.address,
                amount,
                slippage: parseFloat(slippage),
            });

            if (!swapRes.swapTransaction) {
                throw new Error('Failed to get swap transaction from server');
            }

            // 3. Sign & send transaction locally
            const { signature } = await executeSwap(swapRes.swapTransaction);

            // 4. Notify backend of signature
            await trpcClient.swap.confirmSwap.mutate({ transactionId: swapRes.transactionId, signature });

            // 5. Refresh balances
            await refreshBalances();

            // Calculate output amount for display (outputAmount is already in human-readable format)
            const outputAmount = quote.outputAmount;

            Alert.alert(
                '🎉 Purchase Successful!',
                `Bought ${outputAmount.toFixed(4)} ${tokenInfo.symbol}\nfor ${amount} SOL`,
                [
                    { text: 'View on Solscan', onPress: () => { } },
                    { text: 'Done', onPress: onClose }
                ]
            );
        } catch (err: any) {
            logger.error('Quick buy failed:', err);
            setError(err.message || 'Transaction failed. Please try again.');
        } finally {
            setIsBuying(false);
        }
    };

    const estimatedOutput = tokenInfo?.price && solAmount
        ? (parseFloat(solAmount) * (tokenInfo.price > 0 ? 1 / tokenInfo.price : 0))
        : 0;

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
                                />
                                <Pressable
                                    style={styles.verifyButton}
                                    onPress={handleVerifyToken}
                                    disabled={isVerifying}
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
                                        {tokenInfo.price ? (
                                            <Text style={styles.tokenPrice}>
                                                ${tokenInfo.price < 0.0001
                                                    ? tokenInfo.price.toExponential(2)
                                                    : tokenInfo.price.toFixed(6)}
                                            </Text>
                                        ) : null}
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
                                />
                                <Text style={styles.solLabel}>SOL</Text>
                            </View>
                            <View style={styles.presetButtons}>
                                {['0.1', '0.5', '1', '2'].map((preset) => (
                                    <Pressable
                                        key={preset}
                                        style={[styles.presetButton, solAmount === preset && styles.presetButtonActive]}
                                        onPress={() => setSolAmount(preset)}
                                    >
                                        <Text style={[styles.presetText, solAmount === preset && styles.presetTextActive]}>
                                            {preset} SOL
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={styles.balanceText}>
                                Balance: {balance?.toFixed(4) || '0'} SOL
                            </Text>
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
                                />
                                <Text style={styles.percentLabel}>%</Text>
                            </View>
                            <View style={styles.presetButtons}>
                                {['0.5', '1', '2', '5'].map((preset) => (
                                    <Pressable
                                        key={preset}
                                        style={[styles.presetButton, slippage === preset && styles.presetButtonActive]}
                                        onPress={() => setSlippage(preset)}
                                    >
                                        <Text style={[styles.presetText, slippage === preset && styles.presetTextActive]}>
                                            {preset}%
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Estimated Output */}
                        {tokenInfo && solAmount && (
                            <View style={styles.estimateCard}>
                                <Text style={styles.estimateLabel}>Estimated Output</Text>
                                <Text style={styles.estimateValue}>
                                    ~{estimatedOutput.toFixed(4)} {tokenInfo.symbol}
                                </Text>
                            </View>
                        )}

                        {/* Error Message */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <AlertCircle size={16} color={COLORS.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {/* Buy Button */}
                        <Pressable
                            style={[
                                styles.buyButton,
                                (!tokenInfo || !solAmount || isBuying) && styles.buyButtonDisabled
                            ]}
                            onPress={handleBuy}
                            disabled={!tokenInfo || !solAmount || isBuying}
                        >
                            <LinearGradient
                                colors={tokenInfo && solAmount && !isBuying
                                    ? [COLORS.success, COLORS.success + '80']
                                    : [COLORS.textSecondary, COLORS.textSecondary + '80']
                                }
                                style={styles.buyButtonGradient}
                            >
                                {isBuying ? (
                                    <ActivityIndicator size="small" color={COLORS.textPrimary} />
                                ) : (
                                    <Text style={styles.buyButtonText}>
                                        {!publicKey ? 'Connect Wallet' : 'Buy Now'}
                                    </Text>
                                )}
                            </LinearGradient>
                        </Pressable>

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
    tokenPrice: {
        ...FONTS.monospace,
        color: COLORS.solana,
        fontSize: 12,
        marginTop: 2,
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
    balanceText: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: SPACING.xs,
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
