import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';

interface TraderCardProps {
  username?: string;
  walletAddress?: string;
  roi: number;
  period?: string;
  onPress?: () => void;
}

export const TraderCard: React.FC<TraderCardProps> = ({
  username,
  walletAddress,
  roi,
  period = '24h',
  onPress,
}) => {
  // Format wallet address: first 4 chars...last 4 chars
  const formatAddress = (addr?: string) => {
    if (!addr) return '...';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Copy wallet address to clipboard
  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    Alert.alert('Copied!', 'Wallet address copied to clipboard');
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <NeonCard style={styles.container}>
        <View style={styles.content}>
          <View style={styles.addressRow}>
            <Text style={styles.address}>
              {formatAddress(walletAddress)}
            </Text>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation?.();
                void handleCopyAddress();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.copyButton}
            >
              <Copy size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[
            styles.roi,
            { color: roi >= 0 ? COLORS.success : COLORS.error }
          ]}>
            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}% today
          </Text>
        </View>
      </NeonCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  address: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  copyButton: {
    marginLeft: SPACING.xs,
    padding: 4,
  },
  roi: {
    ...FONTS.monospace,
    fontSize: 14,
    fontWeight: '700',
  },
});