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
import { X, ChevronDown, QrCode } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

// Static dummy data for pure UI mode
const DUMMY_PUBLIC_KEY = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const DUMMY_TOKENS = [
    { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', decimals: 9, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png', balance: 10.5 },
    { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png', balance: 500 },
];

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

    // Static dummy data - pure UI mode (no hooks)
    const publicKey = DUMMY_PUBLIC_KEY;
    const getAvailableTokens = () => DUMMY_TOKENS;
    const sendSol = async (_recipient: string, _amount: number) => {
        Alert.alert('🚧 Demo Mode', 'Send functionality is simulated in demo mode.');
        return 'demo_signature_' + Date.now();
    };
    const sendToken = async (_recipient: string, _amount: number, _mint: string, _decimals: number) => {
        Alert.alert('🚧 Demo Mode', 'Send functionality is simulated in demo mode.');
        return 'demo_signature_' + Date.now();
    };

    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [amount, setAmount] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [showTokenSelector, setShowTokenSelector] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [addressError, setAddressError] = useState('');
    const [amountError, setAmountError] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

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

    // Handle QR scan
    const handleScanQR = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is required to scan QR codes');
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
            console.error('Send transaction failed:', error);
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
});

export default SendModal;

