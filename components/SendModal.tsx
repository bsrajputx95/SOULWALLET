import React, { useState, useMemo, useEffect } from 'react';
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
import { X, ChevronDown, QrCode } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { VALIDATION } from '../constants/validation';
import { sendTransaction, getLocalPublicKey } from '../services/wallet';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { useAlert } from '../contexts/AlertContext';

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
    holdings?: Token[];
}

export const SendModal: React.FC<SendModalProps> = ({
    visible,
    onClose,
    onSuccess,
    holdings = [],
}) => {
    const { showAlert } = useAlert();
    const { height } = useWindowDimensions();
    const modalHeight = height * 0.85;

    // State
    const [publicKey, setPublicKey] = useState<string>('');
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [amount, setAmount] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [showTokenSelector, setShowTokenSelector] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [addressError, setAddressError] = useState('');
    const [amountError, setAmountError] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // PIN input state
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');

    // Load public key on mount
    useEffect(() => {
        if (visible) {
            getLocalPublicKey().then(key => {
                if (key) setPublicKey(key);
            });
        }
    }, [visible]);

    // Available tokens from holdings prop
    const availableTokens = useMemo(() => holdings, [holdings]);

    // Set default token
    useEffect(() => {
        if (visible && availableTokens.length > 0 && !selectedToken) {
            const solToken = availableTokens.find(t => t.symbol === 'SOL');
            if (solToken) setSelectedToken(solToken);
        }
    }, [visible, availableTokens, selectedToken]);

    // Reset form when modal closes
    useEffect(() => {
        if (!visible) {
            setAmount('');
            setRecipientAddress('');
            setAddressError('');
            setAmountError('');
            setIsSending(false);
            setPin('');
            setPinError('');
            setShowPinModal(false);
        }
    }, [visible]);

    // Validate Solana address
    const validateAddress = (address: string): boolean => {
        const trimmed = address.trim();
        if (!trimmed) {
            setAddressError('Address is required');
            return false;
        }
        // Check for self-send first
        if (trimmed === publicKey) {
            setAddressError('Cannot send to yourself');
            return false;
        }
        // Basic Solana address validation using centralized constants
        const isValid = VALIDATION.SOLANA_ADDRESS.PATTERN.test(trimmed);
        if (!isValid) {
            setAddressError('Invalid Solana address format');
            return false;
        }
        setAddressError('');
        return true;
    };

    // Validate amount
    const validateAmount = (value: string): boolean => {
        const num = parseFloat(value);
        // Check for non-numeric input
        if (!value || isNaN(num)) {
            setAmountError('Enter a valid number');
            return false;
        }
        if (num <= 0) {
            setAmountError('Amount must be greater than 0');
            return false;
        }
        // Minimum amount for SOL (covers fees)
        if (selectedToken?.symbol === 'SOL' && num < 0.00001) {
            setAmountError('Minimum 0.00001 SOL');
            return false;
        }
        // Max decimals check (9 for SOL)
        const decimals = value.includes('.') ? (value.split('.')[1]?.length || 0) : 0;
        if (decimals > 9) {
            setAmountError('Maximum 9 decimal places');
            return false;
        }
        if (selectedToken && num > selectedToken.balance) {
            setAmountError('Insufficient balance');
            return false;
        }
        setAmountError('');
        return true;
    };

    // Handle QR scan
    const handleScanQR = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                showAlert('Camera Permission', 'Camera access is required to scan QR codes');
                return;
            }
        }
        setShowScanner(true);
    };

    // Handle barcode scanned
    const handleBarcodeScanned = ({ data }: { data: string }) => {
        setShowScanner(false);
        // Extract address from QR (could be solana:address or just address)
        let address = data;
        if (data.startsWith('solana:')) {
            address = data.replace('solana:', '').split('?')[0] || data;
        }
        setRecipientAddress(address);
        validateAddress(address);
    };

    const handleSend = () => {
        if (!selectedToken) {
            showAlert('Error', 'Please select a token');
            return;
        }

        if (!validateAddress(recipientAddress) || !validateAmount(amount)) {
            return;
        }

        // Show PIN modal
        setShowPinModal(true);
    };

    const handleConfirmSend = async () => {
        // PIN validation: numeric only, 4-6 digits (matching solana-setup.tsx)
        if (!/^\d+$/.test(pin)) {
            setPinError('PIN must contain only digits (0-9)');
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

        setIsSending(true);
        setPinError('');

        try {
            // Get auth token
            const authToken = await SecureStore.getItemAsync('token');
            if (!authToken) {
                showAlert('Error', 'Session expired, please log in');
                setIsSending(false);
                setShowPinModal(false);
                return;
            }

            // Only SOL supported in Phase 2.2
            if (selectedToken?.symbol !== 'SOL') {
                showAlert('Coming Soon', 'SPL token transfers will be available in Phase 2.3');
                setIsSending(false);
                setShowPinModal(false);
                return;
            }

            // Call real sendTransaction
            const result = await sendTransaction(
                authToken,
                recipientAddress,
                parseFloat(amount),
                pin,
                selectedToken?.symbol || 'SOL'
            );

            // Clear PIN immediately
            setPin('');
            setShowPinModal(false);

            if (result.success) {
                // Show toast for immediate feedback
                showSuccessToast(`Sent ${amount} ${selectedToken?.symbol}`);
                // Trigger refresh immediately before showing alert
                if (onSuccess) await onSuccess();
                // Also show Alert with Solscan link
                showAlert(
                    '✅ Transaction Sent!',
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
                // Show error toast
                showErrorToast(result.error || 'Transaction failed');
            }
        } catch (error: any) {
            showAlert('Transaction Failed', error.message || 'Failed to send transaction');
        } finally {
            setIsSending(false);
            setPin('');
        }
    };

    const handleMaxAmount = () => {
        if (selectedToken) {
            // Leave 0.0001 SOL for transaction fee if sending SOL
            const maxAmount = selectedToken.symbol === 'SOL'
                ? Math.max(0, selectedToken.balance - 0.0001)
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
                        <View style={styles.inputCard}>
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
                        </View>

                        {/* Amount Input */}
                        <View style={styles.inputCard}>
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
                        </View>

                        {/* Recipient Address */}
                        <View style={styles.inputCard}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Recipient Address</Text>
                                <TouchableOpacity onPress={handleScanQR} style={styles.scanButton}>
                                    <QrCode size={20} color={COLORS.solana} />
                                    <Text style={styles.scanButtonText}>Scan</Text>
                                </TouchableOpacity>
                            </View>
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
                        </View>

                        {/* Send Button */}
                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (isSending || !selectedToken || !amount || !recipientAddress) && styles.sendButtonDisabled
                            ]}
                            onPress={handleSend}
                            disabled={isSending || !selectedToken || !amount || !recipientAddress}
                        >
                            <Text style={styles.sendButtonText}>
                                {isSending ? 'Sending...' : 'Send'}
                            </Text>
                        </TouchableOpacity>
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

            {/* QR Scanner Modal */}
            <Modal
                visible={showScanner}
                animationType="slide"
                onRequestClose={() => setShowScanner(false)}
            >
                <View style={styles.scannerContainer}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>Scan QR Code</Text>
                        <TouchableOpacity onPress={() => setShowScanner(false)}>
                            <X size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    <CameraView
                        style={styles.camera}
                        facing="back"
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                        }}
                        onBarcodeScanned={handleBarcodeScanned}
                    />
                    <Text style={styles.scannerHint}>Point at a Solana wallet QR code</Text>
                </View>
            </Modal>

            {/* PIN Input Modal */}
            <Modal
                visible={showPinModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowPinModal(false);
                    setPin('');
                    setPinError('');
                }}
            >
                <View style={styles.selectorOverlay}>
                    <View style={styles.selectorContainer}>
                        <View style={styles.selectorHeader}>
                            <Text style={styles.selectorTitle}>Confirm Transaction</Text>
                            <TouchableOpacity onPress={() => {
                                setShowPinModal(false);
                                setPin('');
                                setPinError('');
                            }}>
                                <X size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>
                            <Text style={styles.pinLabel}>Enter your wallet PIN to confirm</Text>
                            <TextInput
                                style={[styles.input, styles.pinInput]}
                                value={pin}
                                onChangeText={(text) => {
                                    setPin(text);
                                    setPinError('');
                                }}
                                placeholder="Enter PIN"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                                secureTextEntry
                                maxLength={6}
                                autoFocus
                            />
                            {pinError ? (
                                <Text style={styles.errorText}>{pinError}</Text>
                            ) : null}

                            <View style={styles.pinSummary}>
                                <Text style={styles.pinSummaryLabel}>Sending</Text>
                                <Text style={styles.pinSummaryValue}>{amount} {selectedToken?.symbol}</Text>
                                <Text style={styles.pinSummaryLabel}>To</Text>
                                <Text style={styles.pinSummaryAddress}>
                                    {recipientAddress.slice(0, 12)}...{recipientAddress.slice(-12)}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    (isSending || pin.length < 4) && styles.sendButtonDisabled
                                ]}
                                onPress={handleConfirmSend}
                                disabled={isSending || pin.length < 4}
                            >
                                {isSending ? (
                                    <ActivityIndicator color={COLORS.textPrimary} />
                                ) : (
                                    <Text style={styles.sendButtonText}>Confirm Send</Text>
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
        backgroundColor: COLORS.solana,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.medium,
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: COLORS.cardBackground,
        opacity: 0.5,
    },
    sendButtonText: {
        ...FONTS.phantomBold,
        fontSize: 16,
        color: COLORS.textPrimary,
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
    // Scanner styles
    scanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    scanButtonText: {
        ...FONTS.phantomMedium,
        fontSize: 12,
        color: COLORS.solana,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        backgroundColor: COLORS.background,
    },
    scannerTitle: {
        ...FONTS.phantomBold,
        fontSize: 18,
        color: COLORS.textPrimary,
    },
    camera: {
        flex: 1,
    },
    scannerHint: {
        ...FONTS.phantomRegular,
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        padding: SPACING.l,
        backgroundColor: COLORS.background,
    },
    // PIN Modal styles
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
    pinSummaryAddress: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
});

export default SendModal;

