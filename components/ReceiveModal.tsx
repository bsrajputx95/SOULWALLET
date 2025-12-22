import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    useWindowDimensions,
    Alert,
    Share,
} from 'react-native';
import { X, Copy, Share2, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSolanaWallet } from '../hooks/solana-wallet-store';

interface ReceiveModalProps {
    visible: boolean;
    onClose: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
    visible,
    onClose,
}) => {
    const { height } = useWindowDimensions();
    const modalHeight = height * 0.65;

    const { publicKey } = useSolanaWallet();
    const [copied, setCopied] = useState(false);

    const walletAddress = publicKey || '';

    const handleCopyAddress = async () => {
        if (!walletAddress) return;

        await Clipboard.setStringAsync(walletAddress);
        setCopied(true);

        setTimeout(() => setCopied(false), 2000);
    };

    const handleShareAddress = async () => {
        if (!walletAddress) return;

        try {
            await Share.share({
                message: `My SoulWallet address:\n\n${walletAddress}`,
                title: 'My Wallet Address',
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share address');
        }
    };

    // Format address for display
    const formatAddress = (address: string) => {
        if (!address) return '--';
        return `${address.slice(0, 8)}...${address.slice(-8)}`;
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

                <View style={[styles.modalContainer, { maxHeight: modalHeight }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Receive</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {/* QR Code */}
                        <View style={styles.qrCard}>
                            <View style={styles.qrContainer}>
                                {walletAddress ? (
                                    <QRCode
                                        value={walletAddress}
                                        size={180}
                                        backgroundColor={COLORS.background}
                                        color={COLORS.textPrimary}
                                    />
                                ) : (
                                    <Text style={styles.noWalletText}>No wallet connected</Text>
                                )}
                            </View>
                            <Text style={styles.qrHint}>
                                Scan this QR code to receive tokens
                            </Text>
                        </View>

                        {/* Wallet Address */}
                        <View style={styles.addressCard}>
                            <Text style={styles.addressLabel}>Your Wallet Address</Text>
                            <Text style={styles.addressFull} selectable>
                                {walletAddress || '--'}
                            </Text>
                            <Text style={styles.addressShort}>
                                {formatAddress(walletAddress)}
                            </Text>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.actionButton, copied && styles.actionButtonSuccess]}
                                onPress={handleCopyAddress}
                            >
                                {copied ? (
                                    <Check size={20} color={COLORS.success} />
                                ) : (
                                    <Copy size={20} color={COLORS.textPrimary} />
                                )}
                                <Text style={[styles.actionButtonText, copied && styles.actionButtonTextSuccess]}>
                                    {copied ? 'Copied!' : 'Copy'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={handleShareAddress}
                            >
                                <Share2 size={20} color={COLORS.textPrimary} />
                                <Text style={styles.actionButtonText}>Share</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Network Info */}
                        <View style={styles.networkInfo}>
                            <Text style={styles.networkLabel}>Network</Text>
                            <Text style={styles.networkValue}>Solana Mainnet</Text>
                        </View>
                    </View>
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
        paddingBottom: 30,
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
        alignItems: 'center',
    },
    qrCard: {
        alignItems: 'center',
        padding: SPACING.l,
        width: '100%',
        marginBottom: SPACING.m,
    },
    qrContainer: {
        padding: SPACING.m,
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.medium,
        marginBottom: SPACING.m,
    },
    qrHint: {
        ...FONTS.phantomRegular,
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    noWalletText: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.textSecondary,
        padding: SPACING.l,
    },
    addressCard: {
        width: '100%',
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    addressLabel: {
        ...FONTS.phantomMedium,
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    addressFull: {
        ...FONTS.phantomRegular,
        fontSize: 11,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
        opacity: 0.7,
    },
    addressShort: {
        ...FONTS.phantomBold,
        fontSize: 16,
        color: COLORS.solana,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: SPACING.m,
        marginBottom: SPACING.m,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.l,
        borderRadius: BORDER_RADIUS.medium,
        gap: SPACING.s,
        minWidth: 120,
        justifyContent: 'center',
    },
    actionButtonSuccess: {
        backgroundColor: COLORS.success + '30',
    },
    actionButtonText: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    actionButtonTextSuccess: {
        color: COLORS.success,
    },
    networkInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingTop: SPACING.m,
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBackground,
    },
    networkLabel: {
        ...FONTS.phantomRegular,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    networkValue: {
        ...FONTS.phantomMedium,
        fontSize: 14,
        color: COLORS.success,
    },
});

export default ReceiveModal;
