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
    TouchableOpacity,
} from 'react-native';
import { X, Search, AlertCircle, ShoppingCart, Shield, ExternalLink } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { getQuote, executeSwap, getTokenList, JupiterToken } from '../services/swap';
import { API_URL } from '../services/api';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import TokenDetails from './TokenDetails';

interface QuickBuyModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string | undefined;
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
    const [showTokenDetails, setShowTokenDetails] = useState(false);
    const [tokenMetadata, setTokenMetadata] = useState<any>(null);

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

    // Fetch token info from Jupiter API
    const fetchTokenFromJupiter = async (addr: string): Promise<TokenInfo | null> => {
        try {
            // Try Jupiter Tokens V2 API
            const response = await fetch(`${API_URL}/tokens/search?query=${addr}`);
            if (!response.ok) return null;
            
            const data = await response.json();
            if (!data.tokens || data.tokens.length === 0) return null;
            
            // Find exact match
            const token = data.tokens.find((t: any) => t.address === addr);
            if (!token) return null;
            
            // Store full metadata for TokenDetails
            setTokenMetadata(token);
            
            return {
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals || 9,
                logoURI: token.logoURI || token.icon,
                verified: token.verified || false,
                source: 'jupiter',
            };
        } catch {
            return null;
        }
    };

    // Open token details modal
    const handleTokenPress = () => {
        if (tokenInfo) {
            setShowTokenDetails(true);
        }
    };

    // Get token details data for modal
    const getTokenDetailsData = () => {
        if (!tokenInfo) return undefined;
        
        // Use metadata from Jupiter API if available
        if (tokenMetadata) {
            return {
                symbol: tokenMetadata.symbol || tokenInfo.symbol,
                name: tokenMetadata.name || tokenInfo.name,
                price: tokenMetadata.usdPrice || tokenMetadata.price || 0,
                change24h: tokenMetadata.priceChange24h || 0,
                changePercent24h: tokenMetadata.priceChange24h || 0,
                balance: 0,
                value: 0,
                marketCap: tokenMetadata.marketCap || tokenMetadata.mcap || 0,
                volume24h: tokenMetadata.volume24h || 0,
                supply: tokenMetadata.circSupply || tokenMetadata.totalSupply || 0,
                address: tokenInfo.address,
                logoURI: tokenMetadata.icon || tokenMetadata.logoURI || tokenInfo.logoURI,
            };
        }
        
        // Fallback to basic info
        return {
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            price: 0,
            change24h: 0,
            changePercent24h: 0,
            balance: 0,
            value: 0,
            marketCap: 0,
            volume24h: 0,
            supply: 0,
            address: tokenInfo.address,
            logoURI: tokenInfo.logoURI,
        };
    };

    // Verify token - check local list first, then Jupiter API
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
            // Tier 1: Check local hardcoded list
            const localToken = jupiterTokens.find(t => t.address === addr);
            if (localToken) {
                setTokenInfo({
                    address: localToken.address,
                    symbol: localToken.symbol,
                    name: localToken.name,
                    decimals: localToken.decimals,
                    logoURI: localToken.logoURI,
                    verified: true,
                    source: 'jupiter',
                });
                setIsVerifying(false);
                return;
            }
            
            // Tier 2: Fetch from Jupiter API
            const jupiterToken = await fetchTokenFromJupiter(addr);
            if (jupiterToken) {
                setTokenInfo(jupiterToken);
                setIsVerifying(false);
                return;
            }
            
            // Tier 3: Unknown token - still allow but with warning
            setTokenInfo({
                address: addr,
                symbol: 'Unknown',
                name: 'Unverified Token',
                decimals: 9,
                verified: false,
                source: 'generic',
            });
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

                        {/* Token Info Card - Tappable */}
                        {tokenInfo && (
                            <TouchableOpacity 
                                style={[
                                    styles.tokenCard,
                                    !tokenInfo.verified && styles.tokenCardUnverified
                                ]}
                                onPress={handleTokenPress}
                                activeOpacity={0.8}
                            >
                                <View style={styles.tokenInfo}>
                                    {tokenInfo.logoURI ? (
                                        <Image 
                                            source={{ uri: tokenInfo.logoURI }} 
                                            style={styles.tokenLogo}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.tokenLogoPlaceholder}>
                                            <Text style={styles.tokenLogoText}>{tokenInfo.symbol?.[0]}</Text>
                                        </View>
                                    )}
                                    <View style={styles.tokenDetails}>
                                        <Text style={styles.tokenSymbol}>{tokenInfo.symbol}</Text>
                                        <Text style={styles.tokenName} numberOfLines={1}>
                                            {tokenInfo.name}
                                        </Text>
                                    </View>
                                    <View style={styles.tokenBadgeContainer}>
                                        {tokenInfo.verified ? (
                                            <View style={styles.verifiedBadge}>
                                                <Shield size={14} color={COLORS.success} />
                                                <Text style={styles.verifiedText}>Verified</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.unverifiedBadge}>
                                                <AlertCircle size={14} color={COLORS.warning || '#FFB800'} />
                                                <Text style={styles.unverifiedText}>Unknown</Text>
                                            </View>
                                        )}
                                        <View style={styles.viewDetailsHint}>
                                            <Text style={styles.viewDetailsText}>Tap for details</Text>
                                            <ExternalLink size={12} color={COLORS.textSecondary} />
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Warning for unverified tokens */}
                        {tokenInfo && !tokenInfo.verified && (
                            <View style={styles.warningContainer}>
                                <AlertCircle size={16} color={COLORS.warning || '#FFB800'} />
                                <Text style={styles.warningText}>
                                    This token is not verified. Only trade if you trust this contract address.
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

            {/* Token Details - Inside Modal but separate overlay */}
            {showTokenDetails && tokenInfo && (
                <TokenDetails
                    token={getTokenDetailsData()!}
                    visible={showTokenDetails}
                    onClose={() => setShowTokenDetails(false)}
                    onBuy={() => {
                        setShowTokenDetails(false);
                        // Already in buy flow
                    }}
                />
            )}
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
    tokenBadgeContainer: {
        alignItems: 'flex-end',
        gap: SPACING.xs,
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
        backgroundColor: (COLORS.warning || '#FFB800') + '20',
        paddingHorizontal: SPACING.s,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.small,
        gap: 4,
    },
    unverifiedText: {
        ...FONTS.phantomMedium,
        color: COLORS.warning || '#FFB800',
        fontSize: 11,
    },
    viewDetailsHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    viewDetailsText: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 10,
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
