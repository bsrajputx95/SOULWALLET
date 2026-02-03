import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    Image,
} from 'react-native';
import { X } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { createCopyConfig } from '../services/copyTrading';
import { showSuccessToast, showErrorToast } from '../utils/toast';

interface CopyTradingModalProps {
    visible: boolean;
    onClose: () => void;
    trader: {
        username: string;
        walletAddress: string;
        profileImage?: string;
    } | null;
}

export function CopyTradingModal({ visible, onClose, trader }: CopyTradingModalProps) {
    const [copyAmount, setCopyAmount] = useState('1000');
    const [amountPerTrade, setAmountPerTrade] = useState('100');
    const [stopLoss, setStopLoss] = useState('10');
    const [takeProfit, setTakeProfit] = useState('30');
    const [maxSlippage, setMaxSlippage] = useState('0.5');
    const [exitWithTrader, setExitWithTrader] = useState(false);
    const [minProfitForSharing, setMinProfitForSharing] = useState('0');
    const [isPending, setIsPending] = useState(false);

    const handleStartCopying = async () => {
        if (!trader?.walletAddress) {
            Alert.alert('Error', 'Trader wallet address not found.');
            return;
        }

        const totalBudget = parseFloat(copyAmount) || 1000;
        const perTrade = parseFloat(amountPerTrade) || 100;

        if (perTrade > totalBudget) {
            Alert.alert('Error', 'Amount per trade cannot exceed total budget');
            return;
        }

        try {
            setIsPending(true);

            const authToken = await SecureStore.getItemAsync('token');
            if (!authToken) {
                Alert.alert('Error', 'Please login first');
                return;
            }

            const result = await createCopyConfig({
                traderAddress: trader.walletAddress,
                totalInvestment: totalBudget,
                perTradeAmount: perTrade,
                stopLossPercent: parseFloat(stopLoss) || 10,
                takeProfitPercent: parseFloat(takeProfit) || 30,
                exitWithTrader
            }, authToken);

            if (result.success) {
                showSuccessToast('Copy trading configured!');
                Alert.alert('Success', `You are now copying ${trader.username}`);
                onClose();
            } else {
                showErrorToast(result.error || 'Failed to start copy trading');
            }
        } catch (error: any) {
            showErrorToast(error.message || 'Failed to start copy trading');
        } finally {
            setIsPending(false);
        }
    };

    if (!trader) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.copyModalContainer}>
                    <View style={styles.modalHeader}>
                        <View style={styles.traderInfo}>
                            {trader.profileImage ? (
                                <Image source={{ uri: trader.profileImage }} style={styles.traderAvatar} />
                            ) : (
                                <View style={styles.traderAvatarPlaceholder}>
                                    <Text style={styles.traderAvatarText}>
                                        {trader.username.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <Text style={styles.modalTitle}>Copy @{trader.username}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.modalDescription}>
                            Set up copy trading parameters for @{trader.username}
                        </Text>

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Total Budget (USDC)</Text>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputPrefix}>$</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="1000"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={copyAmount}
                                    onChangeText={setCopyAmount}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Amount per Trade (USDC)</Text>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputPrefix}>$</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="100"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={amountPerTrade}
                                    onChangeText={setAmountPerTrade}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Stop Loss (%)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="10"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={stopLoss}
                                    onChangeText={setStopLoss}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.inputSuffix}>%</Text>
                            </View>
                        </View>

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Take Profit (%)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="30"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={takeProfit}
                                    onChangeText={setTakeProfit}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.inputSuffix}>%</Text>
                            </View>
                        </View>

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Max Slippage (%)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0.5"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={maxSlippage}
                                    onChangeText={setMaxSlippage}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.inputSuffix}>%</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.exitWithTraderButton, exitWithTrader && styles.exitWithTraderButtonActive]}
                            onPress={() => setExitWithTrader(prev => !prev)}
                        >
                            <Text style={[styles.exitWithTraderText, exitWithTrader && styles.exitWithTraderTextActive]}>
                                Exit with Trader
                            </Text>
                            <Text style={styles.exitWithTraderSubtext}>
                                Automatically exit when trader exits
                            </Text>
                        </TouchableOpacity>

                        {/* Fee disclosure */}
                        <View style={styles.feeDisclosure}>
                            <Text style={styles.feeDisclosureText}>
                                💡 5% of your profits will be shared with this trader when positions close in profit
                                {parseFloat(minProfitForSharing) > 0
                                    ? ` (only on profits above $${minProfitForSharing}).`
                                    : '.'}
                            </Text>
                        </View>

                        {/* Minimum Profit Threshold */}
                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Min Profit for Fee ($USDC)</Text>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputPrefix}>$</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0 (any profit)"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={minProfitForSharing}
                                    onChangeText={setMinProfitForSharing}
                                    keyboardType="numeric"
                                />
                            </View>
                            <Text style={styles.inputHint}>Fee only applied on profits above this amount</Text>
                        </View>



                        <TouchableOpacity
                            style={[
                                styles.startCopyButton,
                                startCopyingMutation.isPending && styles.startCopyButtonDisabled
                            ]}
                            disabled={startCopyingMutation.isPending}
                            onPress={handleStartCopying}
                        >
                            <Text style={styles.startCopyText}>
                                {startCopyingMutation.isPending ? 'Starting...' : 'Start Copying'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal >
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    copyModalContainer: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.large,
        borderTopRightRadius: BORDER_RADIUS.large,
        maxHeight: '85%',
        paddingBottom: SPACING.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        paddingBottom: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.background,
    },
    traderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    traderAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: SPACING.s,
    },
    traderAvatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.solana + '50',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.s,
    },
    traderAvatarText: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    modalTitle: {
        ...FONTS.phantomBold,
        color: COLORS.textPrimary,
        fontSize: 18,
    },
    modalContent: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
    },
    modalDescription: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: SPACING.l,
    },
    inputSection: {
        marginBottom: SPACING.m,
    },
    inputLabel: {
        ...FONTS.phantomMedium,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: SPACING.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.medium,
        paddingHorizontal: SPACING.m,
        height: 48,
    },
    inputPrefix: {
        ...FONTS.phantomBold,
        color: COLORS.textSecondary,
        fontSize: 16,
        marginRight: SPACING.s,
    },
    input: {
        ...FONTS.phantomRegular,
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    inputSuffix: {
        ...FONTS.phantomBold,
        color: COLORS.textSecondary,
        fontSize: 16,
        marginLeft: SPACING.s,
    },
    exitWithTraderButton: {
        backgroundColor: COLORS.solana + '10',
        borderRadius: BORDER_RADIUS.medium,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
        marginBottom: SPACING.m,
    },
    exitWithTraderButtonActive: {
        backgroundColor: COLORS.solana + '20',
        borderColor: COLORS.solana + '30',
    },
    exitWithTraderText: {
        ...FONTS.phantomBold,
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    exitWithTraderTextActive: {
        color: COLORS.solana,
    },
    exitWithTraderSubtext: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    feeDisclosure: {
        backgroundColor: COLORS.solana + '10',
        borderRadius: BORDER_RADIUS.medium,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
    },
    feeDisclosureText: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    startCopyButton: {
        backgroundColor: COLORS.success + '20',
        borderRadius: BORDER_RADIUS.medium,
        paddingVertical: SPACING.m,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.success + '30',
        marginBottom: SPACING.s,
    },
    startCopyButtonDisabled: {
        backgroundColor: COLORS.cardBackground,
        borderColor: COLORS.textSecondary + '30',
        opacity: 0.6,
    },
    startCopyText: {
        ...FONTS.phantomBold,
        color: COLORS.success,
        fontSize: 16,
    },
    inputHint: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 11,
        marginTop: SPACING.xs,
        opacity: 0.7,
    },
});

