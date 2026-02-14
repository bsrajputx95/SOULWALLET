import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    Pressable,
    ScrollView,
    useWindowDimensions,
    KeyboardAvoidingView,
    Platform,
    TextInput,
    ActivityIndicator,
    Image,
} from 'react-native';
import { X, ShoppingBag, Settings, Plus } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { NeonButton } from './NeonButton';
import {
    getMyIBuyBag,
    sellIBuyPosition,
    getIBuySettings,
    updateIBuySettings,
    IBuyPosition,
    IBuySettings,
} from '../services/ibuy';
import { getStoredPin } from '../services/wallet';
import { executeIBuy } from '../services/ibuy';
import { useAlert } from '../contexts/AlertContext';

interface IBuyBagModalProps {
    visible: boolean;
    onClose: () => void;
    onRefresh?: () => void;
}

export const IBuyBagModal: React.FC<IBuyBagModalProps> = ({
    visible,
    onClose,
    onRefresh,
}) => {
    const { showAlert } = useAlert();
    const { height } = useWindowDimensions();
    const modalHeight = height * 0.67;

    const [positions, setPositions] = useState<IBuyPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [selling, setSelling] = useState<string | null>(null);
    const [buyingMore, setBuyingMore] = useState<string | null>(null);
    const [tokenImages, setTokenImages] = useState<Record<string, string>>({});
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<IBuySettings>({
        ibuySlippage: 50,
        ibuyDefaultSol: 0.1,
        autoApprove: false,
    });
    const [tempSettings, setTempSettings] = useState(settings);
    // Separate string states for text inputs to avoid snap-back on edit
    const [slippageText, setSlippageText] = useState(String(settings.ibuySlippage / 100));
    const [solAmountText, setSolAmountText] = useState(String(settings.ibuyDefaultSol));

    // Refs for image caching (avoid dependency array issues)
    const fetchingMintsRef = useRef<Set<string>>(new Set());
    const tokenImagesRef = useRef<Record<string, string>>({});

    // Fetch token image from Jupiter - cached per session
    const fetchTokenImage = useCallback(async (mint: string) => {
        // Skip if already cached or currently fetching
        if (tokenImagesRef.current[mint] || fetchingMintsRef.current.has(mint)) return;
        
        fetchingMintsRef.current.add(mint);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`https://api.jup.ag/tokens/v1/token/${mint}`, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            const data = await res.json();
            if (data.logoURI) {
                tokenImagesRef.current[mint] = data.logoURI;
                setTokenImages({ ...tokenImagesRef.current });
            }
        } catch { 
            /* ignore - token image not critical */ 
        } finally {
            fetchingMintsRef.current.delete(mint);
        }
    }, []);  // Empty deps - uses refs

    // Load positions when modal opens
    const loadPositions = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getMyIBuyBag();
            if (result.success && result.positions) {
                setPositions(result.positions);
                // Fetch images for all tokens
                result.positions.forEach(p => fetchTokenImage(p.tokenAddress));
            }
        } finally {
            setLoading(false);
        }
    }, [fetchTokenImage]);

    // Load settings when modal opens
    const loadSettings = useCallback(async () => {
        const s = await getIBuySettings();
        setSettings(s);
        setTempSettings(s);
        setSlippageText(String(s.ibuySlippage / 100));
        setSolAmountText(String(s.ibuyDefaultSol));
    }, []);

    useEffect(() => {
        if (visible) {
            loadPositions();
            loadSettings();
        }
    }, [visible, loadPositions, loadSettings]);

    const handleSell = async (position: IBuyPosition, percentage: number) => {
        const pin = await getStoredPin();
        if (!pin) {
            showAlert('Error', 'No PIN found. Please re-login.');
            return;
        }

        setSelling(position.id);
        try {
            const result = await sellIBuyPosition(position.id, percentage, pin);
            if (result.success) {
                showAlert(
                    'Sold!',
                    `Profit: ${result.profit && result.profit > 0 ? '+' : ''}${result.profit?.toFixed(4) || '0'} SOL${result.creatorShare ? `\nCreator fee: ${result.creatorShare.toFixed(4)} SOL` : ''
                    }`
                );
                loadPositions();
                onRefresh?.();
            } else {
                showAlert('Error', result.error || 'Sell failed');
            }
        } finally {
            setSelling(null);
        }
    };

    const handleBuyMore = async (position: IBuyPosition) => {
        const pin = await getStoredPin();
        if (!pin) {
            showAlert('Error', 'No PIN found. Please re-login.');
            return;
        }

        showAlert(
            'Buy More',
            `Buy more ${position.tokenSymbol} for ${settings.ibuyDefaultSol} SOL?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Buy',
                    onPress: async () => {
                        setBuyingMore(position.id);
                        try {
                            const result = await executeIBuy(position.postId, settings.ibuyDefaultSol, pin);
                            if (result.success) {
                                showAlert('Success!', `Bought more ${position.tokenSymbol}`);
                                loadPositions();
                                onRefresh?.();
                            } else {
                                showAlert('Error', result.error || 'Buy failed');
                            }
                        } finally {
                            setBuyingMore(null);
                        }
                    },
                },
            ]
        );
    };

    const handleSaveSettings = async () => {
        // Apply text inputs to tempSettings before saving
        const slippageNum = parseFloat(slippageText);
        const solAmountNum = parseFloat(solAmountText);
        const finalSettings = {
            ...tempSettings,
            ibuySlippage: !isNaN(slippageNum) && slippageNum > 0 ? Math.round(slippageNum * 100) : tempSettings.ibuySlippage,
            ibuyDefaultSol: !isNaN(solAmountNum) && solAmountNum > 0 ? solAmountNum : tempSettings.ibuyDefaultSol,
        };
        const result = await updateIBuySettings(finalSettings);
        if (result.success) {
            setSettings(finalSettings);
            setTempSettings(finalSettings);
            setSlippageText(String(finalSettings.ibuySlippage / 100));
            setSolAmountText(String(finalSettings.ibuyDefaultSol));
            setShowSettings(false);
        } else {
            showAlert('Error', result.error || 'Failed to save settings');
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={[styles.modalContainer, { minHeight: modalHeight, maxHeight: height * 0.85 }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <ShoppingBag size={24} color={COLORS.success} />
                            <Text style={styles.title}>My IBUY Bag</Text>
                        </View>
                        <View style={styles.headerRight}>
                            <Pressable
                                onPress={() => setShowSettings((s) => !s)}
                                style={[styles.iconButton, showSettings && styles.iconButtonActive]}
                            >
                                <Settings size={20} color={COLORS.textSecondary} />
                            </Pressable>
                            <Pressable onPress={onClose} style={styles.closeButton}>
                                <X size={24} color={COLORS.textSecondary} />
                            </Pressable>
                        </View>
                    </View>

                    {/* Content */}
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                            {showSettings && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsTitle}>Settings</Text>

                                    <View style={styles.settingsRow}>
                                        <Text style={styles.settingsLabel}>Default SOL Amount</Text>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.textInput}
                                                value={solAmountText}
                                                placeholder="Enter SOL amount (e.g. 0.1)"
                                                placeholderTextColor={COLORS.textSecondary}
                                                keyboardType="decimal-pad"
                                                onChangeText={(text) => {
                                                    const cleaned = text.replace(/[^0-9.]/g, '');
                                                    setSolAmountText(cleaned);
                                                }}
                                                onBlur={() => {
                                                    const num = parseFloat(solAmountText);
                                                    if (!isNaN(num) && num > 0) {
                                                        setTempSettings({ ...tempSettings, ibuyDefaultSol: num });
                                                    }
                                                }}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.settingsRow}>
                                        <Text style={styles.settingsLabel}>Slippage (%)</Text>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.textInput}
                                                value={slippageText}
                                                keyboardType="decimal-pad"
                                                onChangeText={setSlippageText}
                                                onBlur={() => {
                                                    const num = parseFloat(slippageText);
                                                    if (!isNaN(num) && num > 0) {
                                                        setTempSettings({
                                                            ...tempSettings,
                                                            ibuySlippage: Math.round(num * 100),
                                                        });
                                                    }
                                                }}
                                            />
                                        </View>
                                    </View>

                                    <NeonButton
                                        title="Save"
                                        variant="primary"
                                        size="medium"
                                        fullWidth
                                        style={styles.saveButton}
                                        onPress={handleSaveSettings}
                                    />
                                </View>
                            )}

                            {loading ? (
                                <View style={styles.emptyState}>
                                    <ActivityIndicator size="large" color={COLORS.success} />
                                </View>
                            ) : positions.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyStateText}>No IBUY positions yet</Text>
                                    <Text style={styles.emptyStateSubtext}>Tap IBUY on posts to start!</Text>
                                </View>
                            ) : (
                                positions.map((position) => (
                                    <NeonCard
                                        key={position.id}
                                        style={styles.positionCard}
                                        color={COLORS.gradientPurple}
                                        intensity="medium"
                                    >
                                        <View style={styles.positionHeader}>
                                            <View style={styles.tokenInfoRow}>
                                                {tokenImages[position.tokenAddress] ? (
                                                    <Image
                                                        source={{ uri: tokenImages[position.tokenAddress] }}
                                                        style={styles.tokenImage}
                                                    />
                                                ) : (
                                                    <View style={styles.tokenImagePlaceholder}>
                                                        <Text style={styles.tokenImageLetter}>
                                                            {position.tokenSymbol?.charAt(0) || '?'}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View>
                                                    <Text style={styles.tokenSymbol}>{position.tokenSymbol}</Text>
                                                    <Text style={styles.tokenAmount}>
                                                        {formatNumber(position.remainingAmount)} tokens
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.valueContainer}>
                                                {position.currentValue !== undefined ? (
                                                    <>
                                                        <Text style={styles.currentValue}>
                                                            ${position.currentValue.toFixed(2)}
                                                        </Text>
                                                        <Text
                                                            style={[
                                                                styles.pnlText,
                                                                (position.pnlPercent || 0) >= 0 ? styles.positive : styles.negative,
                                                            ]}
                                                        >
                                                            {(position.pnlPercent || 0) >= 0 ? '+' : ''}
                                                            {(position.pnlPercent || 0).toFixed(1)}%
                                                        </Text>
                                                    </>
                                                ) : (
                                                    <Text style={styles.loadingText}>Loading...</Text>
                                                )}
                                            </View>
                                        </View>

                                        <View style={styles.detailsRow}>
                                            <Text style={styles.detailLabel}>Entry:</Text>
                                            <Text style={styles.detailValue}>${position.entryPrice.toFixed(6)}</Text>
                                        </View>

                                        {position.currentPrice !== undefined && (
                                            <View style={styles.detailsRow}>
                                                <Text style={styles.detailLabel}>Current:</Text>
                                                <Text style={styles.detailValue}>${position.currentPrice.toFixed(6)}</Text>
                                            </View>
                                        )}

                                        {/* Quick Sell Buttons */}
                                        <View style={styles.sellContainer}>
                                            <Text style={styles.sellLabel}>Quick Sell:</Text>
                                            <View style={styles.sellButtons}>
                                                {[25, 50, 75, 100].map((pct) => (
                                                    <NeonButton
                                                        key={pct}
                                                        title={`${pct}%`}
                                                        variant="outline"
                                                        size="small"
                                                        style={styles.sellButton}
                                                        onPress={() => handleSell(position, pct)}
                                                        disabled={selling === position.id}
                                                    />
                                                ))}
                                            </View>

                                            {/* Buy More */}
                                            <Pressable
                                                style={styles.buyMoreButton}
                                                onPress={() => handleBuyMore(position)}
                                                disabled={buyingMore === position.id}
                                            >
                                                {buyingMore === position.id ? (
                                                    <ActivityIndicator size="small" color={COLORS.success} />
                                                ) : (
                                                    <>
                                                        <Plus size={12} color={COLORS.success} />
                                                        <Text style={styles.buyMoreText}>Buy More</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                        </View>
                                    </NeonCard>
                                ))
                            )}
                        </ScrollView>
                    </KeyboardAvoidingView>

                </View>
            </View>
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
        padding: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBackground,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 20,
        marginLeft: SPACING.s,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.s,
    },
    iconButtonActive: {
        backgroundColor: COLORS.success + '20',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        padding: SPACING.l,
    },
    settingsPanel: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    settingsTitle: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
        marginBottom: SPACING.m,
    },
    settingsRow: {
        marginBottom: SPACING.m,
    },
    settingsLabel: {
        ...FONTS.phantomMedium,
        color: COLORS.textPrimary,
        fontSize: 14,
        marginBottom: SPACING.s,
    },
    presetsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    presetButton: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.small,
        paddingVertical: SPACING.s,
        alignItems: 'center',
    },
    presetButtonActive: {
        backgroundColor: COLORS.success + '30',
    },
    presetText: {
        ...FONTS.phantomSemiBold,
        color: COLORS.textPrimary,
    },
    inputWrapper: {
        borderWidth: 1,
        borderColor: COLORS.textSecondary + '50',
        borderRadius: BORDER_RADIUS.medium,
        backgroundColor: COLORS.background,
    },
    textInput: {
        ...FONTS.phantomRegular,
        color: COLORS.textPrimary,
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.m,
        fontSize: 16,
    },
    saveButton: {
        marginTop: SPACING.s,
    },
    emptyState: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyStateText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
        marginBottom: SPACING.xs,
    },
    emptyStateSubtext: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
    positionCard: {
        marginBottom: SPACING.m,
    },
    positionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.m,
    },
    tokenSymbol: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 18,
    },
    tokenAmount: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    valueContainer: {
        alignItems: 'flex-end',
    },
    currentValue: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    pnlText: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        marginTop: 2,
    },
    positive: {
        color: COLORS.success,
    },
    negative: {
        color: COLORS.error,
    },
    loadingText: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.s,
    },
    detailLabel: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    detailValue: {
        ...FONTS.phantomRegular,
        color: COLORS.textPrimary,
        fontSize: 12,
    },
    sellContainer: {
        marginTop: SPACING.m,
    },
    sellLabel: {
        ...FONTS.phantomMedium,
        color: COLORS.textPrimary,
        fontSize: 14,
        marginBottom: SPACING.s,
    },
    sellButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    sellButton: {
        flex: 1,
    },
    tokenInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tokenImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: SPACING.s,
    },
    tokenImagePlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: SPACING.s,
        backgroundColor: COLORS.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tokenImageLetter: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    buyMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.s,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.small,
        borderWidth: 1,
        borderColor: COLORS.success + '60',
        backgroundColor: COLORS.success + '10',
    },
    buyMoreText: {
        ...FONTS.phantomSemiBold,
        color: COLORS.success,
        fontSize: 12,
        marginLeft: 4,
    },
});

