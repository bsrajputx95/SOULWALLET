import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Copy } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';

interface TraderCardProps {
  username: string;
  profileImage?: string;
  roi: number;
  period?: string;
  isVerified?: boolean;
  onPress?: () => void;
  onCopyPress?: () => void;
}

export const TraderCard: React.FC<TraderCardProps> = ({
  username,
  profileImage,
  roi,
  period = '7d',
  isVerified = false,
  onPress,
  onCopyPress,
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <NeonCard style={styles.container}>
        <View style={styles.content}>
          <View style={styles.profileContainer}>
            <View style={styles.avatarContainer}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.defaultAvatar]}>
                  <Text style={styles.avatarText}>
                    {username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.usernameContainer}>
              <Text style={styles.username}>
                @{username}
                {isVerified && <Text style={styles.verified}> 🛡️</Text>}
              </Text>
            </View>
          </View>
          
          <View style={styles.rightContainer}>
            <View style={styles.statsContainer}>
              <Text style={[
                styles.roi,
                { color: roi >= 0 ? COLORS.success : COLORS.error }
              ]}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
              </Text>
              <Text style={styles.period}>({period})</Text>
            </View>
            {onCopyPress && (
              <TouchableOpacity 
                style={styles.copyButton}
                onPress={onCopyPress}
                activeOpacity={0.7}
              >
                <Copy size={16} color={COLORS.solana} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </NeonCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xs,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: SPACING.s,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
  },
  defaultAvatar: {
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  usernameContainer: {
    flex: 1,
  },
  username: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  verified: {
    fontSize: 14,
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  copyButton: {
    backgroundColor: COLORS.solana + '20',
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
  },
  roi: {
    ...FONTS.monospace,
    fontSize: 16,
    fontWeight: '700',
  },
  period: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: SPACING.xs,
  },
});