import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    useWindowDimensions,
    Share,
    ScrollView,
} from 'react-native';
import { X, Copy, Share2, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { getLocalPublicKey } from '../services/wallet';
import { useAlert } from '../contexts/AlertContext';

interface ReceiveModalProps {
    visible: boolean;
    onClose: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
    visible,
    onClose,
}) => {
    const { showAlert } = useAlert();
    const { height } = useWindowDimensions();
    const modalHeight = height * 0.80;

    const [publicKey, setPublicKey] = useState<string>('');
    const [copied, setCopied] = useState(false);

    // Load real public key when modal opens
    useEffect(() => {
        if (visible) {
            getLocalPublicKey().then(key => {
                if (key) setPublicKey(key);
            });
        }
    }, [visible]);

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
            showAlert('Error', 'Failed to share address');
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
                    <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
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
                    </ScrollView>
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
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
    },
    scrollContent: {
        paddingBottom: 20,
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
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.s,
        paddingBottom: SPACING.s,
        alignItems: 'center',
    },
    qrCard: {
        alignItems: 'center',
        padding: SPACING.s,
        width: '100%',
        marginBottom: SPACING.s,
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
        padding: SPACING.s,
        marginBottom: SPACING.s,
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
        marginBottom: SPACING.s,
        width: '100%',
        justifyContent: 'center',
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
