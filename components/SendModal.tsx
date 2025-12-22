import React, { useState, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    Modal,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
    FlatList,
    Image,
} from 'react-native';
import { X, ChevronDown } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { NeonButton } from './NeonButton';
import { useSolanaWallet } from '../hooks/solana-wallet-store';
import { logger } from '../lib/client-logger';

interface Token {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    logo?: string;
    balance: number;
}

interface SendModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const SendModal: React.FC<SendModalProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const { height } = useWindowDimensions();
    const modalHeight = height * 0.75;

    const { getAvailableTokens, sendSol, sendToken, publicKey } = useSolanaWallet();

    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [amount, setAmount] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [showTokenSelector, setShowTokenSelector] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [addressError, setAddressError] = useState('');
    const [amountError, setAmountError] = useState('');

    const availableTokens = useMemo(() => getAvailableTokens(), [getAvailableTokens]);

    // Set default token
    React.useEffect(() => {
        if (visible && availableTokens.length > 0 && !selectedToken) {
            const solToken = availableTokens.find(t => t.symbol === 'SOL');
            if (solToken) setSelectedToken(solToken);
        }
    }, [visible, availableTokens, selectedToken]);

    // Reset form when modal closes
    React.useEffect(() => {
        if (!visible) {
            setAmount('');
            setRecipientAddress('');
            setAddressError('');
            setAmountError('');
            setIsSending(false);
        }
    }, [visible]);

    // Validate Solana address
    const validateAddress = (address: string): boolean => {
        if (!address) {
            setAddressError('Address is required');
            return false;
        }
        // Basic Solana address validation (32-44 chars, base58)
        const isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
        if (!isValid) {
            setAddressError('Invalid Solana address');
            return false;
        }
        if (address === publicKey) {
            setAddressError('Cannot send to yourself');
            return false;
        }
        setAddressError('');
        return true;
    };

    // Validate amount
    const validateAmount = (value: string): boolean => {
        if (!value || parseFloat(value) <= 0) {
            setAmountError('Enter a valid amount');
            return false;
        }
        if (selectedToken && parseFloat(value) > selectedToken.balance) {
            setAmountError('Insufficient balance');
            return false;
        }
        setAmountError('');
        return true;
    };

    const handleSend = async () => {
        if (!selectedToken) {
            Alert.alert('Error', 'Please select a token');
            return;
        }

        if (!validateAddress(recipientAddress) || !validateAmount(amount)) {
            return;
        }

        setIsSending(true);

        try {
            let signature: string;

            // Use sendSol for SOL, sendToken for SPL tokens
            if (selectedToken.symbol === 'SOL') {
                signature = await sendSol(recipientAddress, parseFloat(amount));
            } else {
                signature = await sendToken(
                    recipientAddress,
                    parseFloat(amount),
                    selectedToken.mint,
                    selectedToken.decimals
                );
            }

            Alert.alert(
                'Transaction Sent!',
                `Sent ${amount} ${selectedToken.symbol}\n\nTx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            onSuccess?.();
                            onClose();
                        },
                    },
                ]
            );
        } catch (error: any) {
            logger.error('Send transaction failed:', error);
            Alert.alert('Transaction Failed', error.message || 'Failed to send transaction');
        } finally {
            setIsSending(false);
        }
    };

    const handleMaxAmount = () => {
        if (selectedToken) {
            // Leave a small amount for gas if sending SOL
            const maxAmount = selectedToken.symbol === 'SOL'
                ? Math.max(0, selectedToken.balance - 0.01)
                : selectedToken.balance;
            setAmount(maxAmount.toString());
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={[styles.modalContainer, { maxHeight: modalHeight }]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Send</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Token Selector */}
                        <NeonCard style={styles.inputCard}>
                            <Text style={styles.label}>Token</Text>
                            <TouchableOpacity
                                style={styles.tokenSelector}
                                onPress={() => setShowTokenSelector(true)}
                            >
                                <View style={styles.tokenInfo}>
                                    {selectedToken?.logo && (
                                        <Image source={{ uri: selectedToken.logo }} style={styles.tokenLogo} />
                                    )}
                                    <View>
                                        <Text style={styles.tokenSymbol}>
                                            {selectedToken?.symbol || 'Select Token'}
                                        </Text>
                                        {selectedToken && (
                                            <Text style={styles.tokenBalance}>
                                                Balance: {selectedToken.balance.toFixed(6)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <ChevronDown size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </NeonCard>

                        {/* Amount Input */}
                        <NeonCard style={styles.inputCard}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Amount</Text>
                                <TouchableOpacity onPress={handleMaxAmount}>
                                    <Text style={styles.maxButton}>MAX</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={amount}
                                onChangeText={(text) => {
                                    setAmount(text);
                                    if (text) validateAmount(text);
                                }}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                            />
                            {amountError ? (
                                <Text style={styles.errorText}>{amountError}</Text>
                            ) : null}
                        </NeonCard>

                        {/* Recipient Address */}
                        <NeonCard style={styles.inputCard}>
                            <Text style={styles.label}>Recipient Address</Text>
                            <TextInput
                                style={[styles.input, styles.addressInput]}
                                value={recipientAddress}
                                onChangeText={(text) => {
                                    setRecipientAddress(text);
                                    if (text) validateAddress(text);
                                }}
                                placeholder="Enter Solana address"
                                placeholderTextColor={COLORS.textSecondary}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {addressError ? (
                                <Text style={styles.errorText}>{addressError}</Text>
                            ) : null}
                        </NeonCard>

                        {/* Send Button */}
                        <NeonButton
                            title={isSending ? 'Sending...' : 'Send'}
                            onPress={handleSend}
                            disabled={isSending || !selectedToken || !amount || !recipientAddress}
                            variant="primary"
                            size="large"
                            fullWidth
                            style={styles.sendButton}
                        />
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>

            {/* Token Selector Modal */}
            <Modal
                visible={showTokenSelector}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowTokenSelector(false)}
            >
                <View style={styles.selectorOverlay}>
                    <View style={styles.selectorContainer}>
                        <View style={styles.selectorHeader}>
                            <Text style={styles.selectorTitle}>Select Token</Text>
                            <TouchableOpacity onPress={() => setShowTokenSelector(false)}>
                                <X size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={availableTokens.filter(t => t.balance > 0)}
                            keyExtractor={(item) => item.mint}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.tokenItem,
                                        selectedToken?.mint === item.mint && styles.tokenItemSelected,
                                    ]}
                                    onPress={() => {
                                        setSelectedToken(item);
                                        setShowTokenSelector(false);
                                    }}
                                >
                                    {item.logo && (
                                        <Image source={{ uri: item.logo }} style={styles.tokenItemLogo} />
                                    )}
                                    <View style={styles.tokenItemInfo}>
                                        <Text style={styles.tokenItemSymbol}>{item.symbol}</Text>
                                        <Text style={styles.tokenItemName}>{item.name}</Text>
                                    </View>
                                    <Text style={styles.tokenItemBalance}>
                                        {item.balance.toFixed(6)}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No tokens with balance</Text>
                            }
                        />
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
        borderColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.medium,
        backgroundColor: COLORS.background,
    },
    addressInput: {
        fontSize: 14,
    },
    errorText: {
        ...FONTS.phantomRegular,
        fontSize: 12,
        color: COLORS.error,
        marginTop: SPACING.xs,
    },
    sendButton: {
        marginTop: SPACING.m,
        marginBottom: SPACING.l,
    },
    // Token Selector Modal
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
});

export default SendModal;
