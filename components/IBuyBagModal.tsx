import React, { useState, useEffect, useCallback } from 'react';
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
    Alert,
    ActivityIndicator,
} from 'react-native';
import { X, ShoppingBag, Settings } from 'lucide-react-native';

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
    const { height } = useWindowDimensions();
    const modalHeight = height * 0.67;

    const [positions, setPositions] = useState<IBuyPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [selling, setSelling] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<IBuySettings>({
        ibuySlippage: 50,
        ibuyDefaultSol: 0.1,
        autoApprove: false,
    });
    const [tempSettings, setTempSettings] = useState(settings);

    // PIN modal state
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [pendingSellPosition, setPendingSellPosition] = useState<IBuyPosition | null>(null);
    const [pendingSellPercentage, setPendingSellPercentage] = useState(0);

    // Load positions when modal opens
    const loadPositions = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getMyIBuyBag();
            if (result.success && result.positions) {
                setPositions(result.positions);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Load settings when modal opens
    const loadSettings = useCallback(async () => {
        const s = await getIBuySettings();
        setSettings(s);
        setTempSettings(s);
    }, []);

    useEffect(() => {
        if (visible) {
            loadPositions();
            loadSettings();
        }
    }, [visible, loadPositions, loadSettings]);

    const handleSell = async (position: IBuyPosition, percentage: number) => {
        // Open PIN modal instead of Alert.prompt
        setPendingSellPosition(position);
        setPendingSellPercentage(percentage);
        setPin('');
        setPinError('');
        setShowPinModal(true);
    };

    const handleConfirmSell = async () => {
        // PIN validation
        if (!/^\d+$/.test(pin)) {
            setPinError('PIN must contain only digits');
            return;
        }
        if (pin.length < 4) {
            setPinError('PIN must be at least 4 digits');
            return;
        }
        if (!pendingSellPosition) return;

        setSelling(pendingSellPosition.id);
        setShowPinModal(false);
        try {
            const result = await sellIBuyPosition(pendingSellPosition.id, pendingSellPercentage, pin);
            if (result.success) {
                Alert.alert(
                    'Sold!',
                    `Profit: ${result.profit && result.profit > 0 ? '+' : ''}${result.profit?.toFixed(4) || '0'} SOL${
                        result.creatorShare ? `\nCreator fee: ${result.creatorShare.toFixed(4)} SOL` : ''
                    }`
                );
                loadPositions();
                onRefresh?.();
            } else {
                Alert.alert('Error', result.error || 'Sell failed');
            }
        } finally {
            setSelling(null);
            setPin('');
            setPendingSellPosition(null);
        }
    };

    const handleSaveSettings = async () => {
        const result = await updateIBuySettings(tempSettings);
        if (result.success) {
            setSettings(tempSettings);
            setShowSettings(false);
        } else {
            Alert.alert('Error', result.error || 'Failed to save settings');
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
                                        <View style={styles.presetsRow}>
                                            {[0.05, 0.1, 0.5, 1.0].map((amt) => (
                                                <Pressable
                                                    key={amt}
                                                    style={[
                                                        styles.presetButton,
                                                        tempSettings.ibuyDefaultSol === amt && styles.presetButtonActive,
                                                    ]}
                                                    onPress={() => setTempSettings({ ...tempSettings, ibuyDefaultSol: amt })}
                                                >
                                                    <Text style={styles.presetText}>{amt}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>

                                    <View style={styles.settingsRow}>
                                        <Text style={styles.settingsLabel}>Slippage (%)</Text>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.textInput}
                                                value={String(tempSettings.ibuySlippage / 100)}
                                                keyboardType="decimal-pad"
                                                onChangeText={(text) => {
                                                    const num = parseFloat(text);
                                                    if (!isNaN(num)) {
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
                                            <View>
                                                <Text style={styles.tokenSymbol}>{position.tokenSymbol}</Text>
                                                <Text style={styles.tokenAmount}>
                                                    {formatNumber(position.remainingAmount)} tokens
                                                </Text>
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
                                        </View>
                                    </NeonCard>
                                ))
                            )}
                        </ScrollView>
                    </KeyboardAvoidingView>

                    {/* PIN Input Modal */}
                    <Modal
                        visible={showPinModal}
                        transparent
                        animationType="fade"
                        onRequestClose={() => {
                            if (!selling) {
                                setShowPinModal(false);
                                setPin('');
                                setPinError('');
                            }
                        }}
                    >
                        <View style={pinStyles.overlay}>
                            <View style={pinStyles.container}>
                                <View style={pinStyles.header}>
                                    <Text style={pinStyles.title}>Confirm Sell</Text>
                                    <Pressable
                                        onPress={() => {
                                            if (!selling) {
                                                setShowPinModal(false);
                                                setPin('');
                                                setPinError('');
                                            }
                                        }}
                                    >
                                        <X size={24} color={COLORS.textPrimary} />
                                    </Pressable>
                                </View>

                                <Text style={pinStyles.label}>
                                    Sell {pendingSellPercentage}% of {pendingSellPosition?.tokenSymbol}
                                </Text>

                                <TextInput
                                    style={[pinStyles.input, pinError ? pinStyles.inputError : null]}
                                    value={pin}
                                    onChangeText={(text) => {
                                        setPin(text.replace(/[^0-9]/g, ''));
                                        setPinError('');
                                    }}
                                    placeholder="Enter PIN"
                                    placeholderTextColor={COLORS.textSecondary}
                                    keyboardType="numeric"
                                    secureTextEntry
                                    maxLength={6}
                                    autoFocus
                                    editable={!selling}
                                />

                                {pinError ? <Text style={pinStyles.errorText}>{pinError}</Text> : null}

                                <Pressable
                                    style={[
                                        pinStyles.confirmButton,
                                        (pin.length < 4 || selling) && pinStyles.confirmButtonDisabled,
                                    ]}
                                    onPress={handleConfirmSell}
                                    disabled={pin.length < 4 || !!selling}
                                >
                                    {selling ? (
                                        <ActivityIndicator color={COLORS.textPrimary} />
                                    ) : (
                                        <Text style={pinStyles.confirmButtonText}>Confirm Sell</Text>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    </Modal>
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
});

// PIN Modal styles
const pinStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.l,
    },
    container: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.large,
        padding: SPACING.l,
        width: '100%',
        maxWidth: 360,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    title: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 18,
    },
    label: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: SPACING.m,
        textAlign: 'center',
    },
    input: {
        ...FONTS.phantomRegular,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        fontSize: 24,
        color: COLORS.textPrimary,
        textAlign: 'center',
        letterSpacing: 8,
        marginBottom: SPACING.s,
    },
    inputError: {
        borderWidth: 1,
        borderColor: COLORS.error,
    },
    errorText: {
        ...FONTS.phantomRegular,
        color: COLORS.error,
        fontSize: 12,
        textAlign: 'center',
        marginBottom: SPACING.m,
    },
    confirmButton: {
        backgroundColor: COLORS.success,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: COLORS.textSecondary + '50',
    },
    confirmButtonText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
});
