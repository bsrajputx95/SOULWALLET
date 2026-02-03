import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { X, AlertTriangle } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { CopyTradeQueueItem, executeCopyTrade } from '../services/copyTrading';
import * as SecureStore from 'expo-secure-store';

interface CopyTradeExecutionModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    queueItem: CopyTradeQueueItem | null;
}

export function CopyTradeExecutionModal({
    visible,
    onClose,
    onSuccess,
    queueItem
}: CopyTradeExecutionModalProps) {
    const [pin, setPin] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [step, setStep] = useState<'pin' | 'confirm' | 'executing'>('pin');

    const handleExecute = async () => {
        if (!queueItem) return;

        if (pin.length < 4) {
            Alert.alert('Error', 'PIN must be at least 4 digits');
            return;
        }

        setIsExecuting(true);
        setStep('executing');

        try {
            const authToken = await SecureStore.getItemAsync('token');
            if (!authToken) {
                Alert.alert('Error', 'Session expired');
                setIsExecuting(false);
                return;
            }

            const result = await executeCopyTrade(queueItem, pin, authToken);

            if (result.success) {
                Alert.alert(
                    'Trade Executed!',
                    `Successfully copied ${queueItem.inputSymbol}\nSignature: ${result.signature?.slice(0, 8)}...`,
                    [{ text: 'OK', onPress: () => { onSuccess(); onClose(); } }]
                );
            } else {
                Alert.alert('Execution Failed', result.error || 'Failed to execute trade');
                setStep('confirm');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Execution failed');
            setStep('confirm');
        } finally {
            setIsExecuting(false);
            setPin('');
        }
    };

    const renderContent = () => {
        if (!queueItem) return null;

        if (step === 'executing') {
            return (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.solana} />
                    <Text style={styles.executingText}>Executing Trade...</Text>
                    <Text style={styles.executingSubtext}>
                        Buying {queueItem.inputSymbol} at ${queueItem.entryPrice.toFixed(4)}
                    </Text>
                </View>
            );
        }

        return (
            <>
                <View style={styles.tradeInfo}>
                    <Text style={styles.tokenSymbol}>{queueItem.inputSymbol}</Text>
                    <Text style={styles.tokenAmount}>
                        {queueItem.inputAmount.toFixed(6)} tokens
                    </Text>
                    <Text style={styles.entryPrice}>
                        Entry: ${queueItem.entryPrice.toFixed(4)}
                    </Text>
                </View>

                {queueItem.slPrice && (
                    <View style={styles.sltpRow}>
                        <Text style={styles.sltpLabel}>Stop Loss:</Text>
                        <Text style={styles.slPrice}>${queueItem.slPrice.toFixed(4)}</Text>
                    </View>
                )}

                {queueItem.tpPrice && (
                    <View style={styles.sltpRow}>
                        <Text style={styles.sltpLabel}>Take Profit:</Text>
                        <Text style={styles.tpPrice}>${queueItem.tpPrice.toFixed(4)}</Text>
                    </View>
                )}

                <View style={styles.warningBox}>
                    <AlertTriangle size={16} color={COLORS.warning} />
                    <Text style={styles.warningText}>
                        This will execute a swap and create SL/TP limit orders on Jupiter.
                    </Text>
                </View>

                <Text style={styles.pinLabel}>Enter PIN to confirm</Text>
                <TextInput
                    style={styles.pinInput}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="Enter PIN"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={6}
                    autoFocus
                />

                <TouchableOpacity
                    style={[styles.executeButton, pin.length < 4 && styles.executeButtonDisabled]}
                    onPress={handleExecute}
                    disabled={pin.length < 4 || isExecuting}
                >
                    <Text style={styles.executeButtonText}>
                        {isExecuting ? 'Executing...' : 'Execute Trade'}
                    </Text>
                </TouchableOpacity>
            </>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Execute Copy Trade</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalContent}>
                        {renderContent()}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.l,
    },
    modalContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.large,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.background,
    },
    modalTitle: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 18,
    },
    modalContent: {
        padding: SPACING.l,
    },
    centerContent: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    executingText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 18,
        marginTop: SPACING.m,
    },
    executingSubtext: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginTop: SPACING.s,
    },
    tradeInfo: {
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    tokenSymbol: {
        ...FONTS.phantomBold,
        color: COLORS.solana,
        fontSize: 24,
    },
    tokenAmount: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginTop: SPACING.xs,
    },
    entryPrice: {
        ...FONTS.phantomMedium,
        color: COLORS.textPrimary,
        fontSize: 16,
        marginTop: SPACING.s,
    },
    sltpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: SPACING.s,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.background,
    },
    sltpLabel: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    slPrice: {
        ...FONTS.phantomMedium,
        color: COLORS.error,
        fontSize: 14,
    },
    tpPrice: {
        ...FONTS.phantomMedium,
        color: COLORS.success,
        fontSize: 14,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.warning + '15',
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        marginVertical: SPACING.l,
        gap: SPACING.s,
    },
    warningText: {
        ...FONTS.phantomRegular,
        color: COLORS.warning,
        fontSize: 12,
        flex: 1,
    },
    pinLabel: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: SPACING.s,
    },
    pinInput: {
        ...FONTS.phantomRegular,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        color: COLORS.textPrimary,
        fontSize: 24,
        textAlign: 'center',
        letterSpacing: 8,
        marginBottom: SPACING.l,
    },
    executeButton: {
        backgroundColor: COLORS.solana,
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        alignItems: 'center',
    },
    executeButtonDisabled: {
        opacity: 0.5,
    },
    executeButtonText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
});
