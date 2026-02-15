import React, { useCallback, useEffect, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Image,
} from 'react-native';
import { X } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { createCopyConfig, createCopyWallet, fetchCopyWallet, CopyTradingWallet } from '../services/copyTrading';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useAlert } from '../contexts/AlertContext';

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
    const { showAlert } = useAlert();
    const [copyAmount, setCopyAmount] = useState('5');
    const [amountPerTrade, setAmountPerTrade] = useState('0.5');
    const [stopLoss, setStopLoss] = useState('10');
    const [takeProfit, setTakeProfit] = useState('30');

    const [exitWithTrader, setExitWithTrader] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [copyName, setCopyName] = useState('');
    const [copyWallet, setCopyWallet] = useState<CopyTradingWallet | null>(null);
    const [isWalletLoading, setIsWalletLoading] = useState(false);
    // Manual wallet address input (for manual setup when no trader address)
    const [manualWalletAddress, setManualWalletAddress] = useState('');

    // Use manual address if trader has no address (manual setup)
    const isManualSetup = !trader?.walletAddress;
    const effectiveWalletAddress = isManualSetup ? manualWalletAddress : trader?.walletAddress;

    const loadCopyWallet = useCallback(async () => {
        try {
            setIsWalletLoading(true);
            const authToken = await SecureStore.getItemAsync('token');
            if (!authToken) {
                setCopyWallet(null);
                return;
            }

            const walletResult = await fetchCopyWallet(authToken);
            if (walletResult.success && walletResult.wallet) {
                setCopyWallet(walletResult.wallet);
                return;
            }

            const created = await createCopyWallet(authToken);
            if (created.success && created.wallet) {
                setCopyWallet(created.wallet);
                return;
            }

            setCopyWallet(null);
        } catch {
            setCopyWallet(null);
        } finally {
            setIsWalletLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            void loadCopyWallet();
        }
    }, [visible, loadCopyWallet]);

    const handleStartCopying = async () => {
        if (!effectiveWalletAddress || effectiveWalletAddress.trim().length === 0) {
            showAlert('Error', 'Please enter a wallet address to copy.');
            return;
        }

        const totalBudget = parseFloat(copyAmount) || 1000;
        const perTrade = parseFloat(amountPerTrade) || 100;

        if (perTrade > totalBudget) {
            showAlert('Error', 'Amount per trade cannot exceed total budget');
            return;
        }

        try {
            setIsPending(true);

            const authToken = await SecureStore.getItemAsync('token');
            if (!authToken) {
                showAlert('Error', 'Please login first');
                return;
            }

            if (!copyWallet) {
                const walletResult = await createCopyWallet(authToken);
                if (!walletResult.success || !walletResult.wallet) {
                    showErrorToast(walletResult.error || 'Failed to initialize trading wallet');
                    return;
                }
                setCopyWallet(walletResult.wallet);
            }

            const result = await createCopyConfig({
                ...(copyName.trim() ? { name: copyName.trim() } : {}),
                traderAddress: effectiveWalletAddress!,
                totalInvestment: totalBudget,
                perTradeAmount: perTrade,
                stopLossPercent: exitWithTrader ? 0 : (parseFloat(stopLoss) || 10),
                takeProfitPercent: exitWithTrader ? 0 : (parseFloat(takeProfit) || 30),
                exitWithTrader
            }, authToken);

            if (result.success) {
                showSuccessToast('Copy trading configured!');
                showAlert('Success', `You are now copying ${trader?.username || 'this trader'}`);
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
                            {isManualSetup
                                ? 'Enter a name and wallet address to start copy trading'
                                : `Set up copy trading parameters for @${trader.username}`
                            }
                        </Text>

                        <View style={styles.walletInfoCard}>
                            <Text style={styles.walletInfoTitle}>Trading Wallet</Text>
                            {isWalletLoading ? (
                                <Text style={styles.walletInfoText}>Loading trading wallet...</Text>
                            ) : copyWallet ? (
                                <>
                                    <Text style={styles.walletInfoText}>
                                        {copyWallet.publicKey.slice(0, 8)}...{copyWallet.publicKey.slice(-8)}
                                    </Text>
                                    <Text style={styles.walletInfoBalance}>
                                        Balance: ◎ {copyWallet.balance.toFixed(4)}
                                    </Text>
                                </>
                            ) : (
                                <Text style={styles.walletInfoText}>Trading wallet will be created on start.</Text>
                            )}
                            <Text style={styles.inputHint}>
                                Deposit SOL here for instant server-side copy execution.
                            </Text>
                        </View>

                        {/* Copy trade name input */}
                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Copy Trade Name</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. ELON's wallet"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={copyName}
                                    onChangeText={setCopyName}
                                    maxLength={50}
                                />
                            </View>
                        </View>

                        {/* Wallet address input for manual setup */}
                        {isManualSetup && (
                            <View style={styles.inputSection}>
                                <Text style={styles.inputLabel}>Wallet Address to Copy</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter Solana wallet address..."
                                        placeholderTextColor={COLORS.textSecondary}
                                        value={manualWalletAddress}
                                        onChangeText={setManualWalletAddress}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>
                        )}

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Total Budget (SOL)</Text>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputPrefix}>◎</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="5"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={copyAmount}
                                    onChangeText={setCopyAmount}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Amount per Trade (SOL)</Text>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputPrefix}>◎</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0.5"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={amountPerTrade}
                                    onChangeText={setAmountPerTrade}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {!exitWithTrader && (
                            <>
                                <View style={styles.inputSection}>
                                    <Text style={styles.inputLabel}>Stop Loss (%)</Text>
                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="10"
                                            placeholderTextColor={COLORS.textSecondary}
                                            value={stopLoss}
                                            onChangeText={(val) => {
                                                setStopLoss(val);
                                                if (val.trim()) setExitWithTrader(false);
                                            }}
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
                                            onChangeText={(val) => {
                                                setTakeProfit(val);
                                                if (val.trim()) setExitWithTrader(false);
                                            }}
                                            keyboardType="numeric"
                                        />
                                        <Text style={styles.inputSuffix}>%</Text>
                                    </View>
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            style={[styles.exitWithTraderButton, exitWithTrader && styles.exitWithTraderButtonActive]}
                            onPress={() => {
                                const next = !exitWithTrader;
                                setExitWithTrader(next);
                                if (next) {
                                    // Clear TP/SL when enabling exit-with-trader
                                    setStopLoss('');
                                    setTakeProfit('');
                                }
                            }}
                        >
                            <Text style={[styles.exitWithTraderText, exitWithTrader && styles.exitWithTraderTextActive]}>
                                {exitWithTrader ? '✓ ' : ''}Exit with Trader
                            </Text>
                            <Text style={styles.exitWithTraderSubtext}>
                                {exitWithTrader
                                    ? 'Will exit when trader exits (no custom TP/SL)'
                                    : 'Automatically exit when trader exits'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Fixed footer button - outside ScrollView so it never gets clipped */}
                    <View style={styles.footerButton}>
                        <TouchableOpacity
                            style={[
                                styles.startCopyButton,
                                isPending && styles.startCopyButtonDisabled
                            ]}
                            disabled={isPending}
                            onPress={handleStartCopying}
                        >
                            <Text style={styles.startCopyText}>
                                {isPending ? 'Starting...' : 'Start Copying'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal >
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
    copyModalContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.large,
        width: '100%',
        maxHeight: '85%',
        overflow: 'hidden',
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
        paddingBottom: SPACING.m,
    },
    footerButton: {
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.l,
        paddingTop: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: COLORS.background,
    },
    modalDescription: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: SPACING.l,
    },
    walletInfoCard: {
        backgroundColor: COLORS.solana + '10',
        borderRadius: BORDER_RADIUS.medium,
        borderWidth: 1,
        borderColor: COLORS.solana + '20',
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    walletInfoTitle: {
        ...FONTS.phantomBold,
        color: COLORS.solana,
        fontSize: 14,
        marginBottom: SPACING.xs,
    },
    walletInfoText: {
        ...FONTS.monospace,
        color: COLORS.textPrimary,
        fontSize: 12,
    },
    walletInfoBalance: {
        ...FONTS.phantomMedium,
        color: COLORS.success,
        fontSize: 13,
        marginTop: SPACING.xs,
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
    startCopyButton: {
        backgroundColor: COLORS.success + '20',
        borderRadius: BORDER_RADIUS.medium,
        paddingVertical: SPACING.m,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.success + '30',
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

