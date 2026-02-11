import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, TrendingUp, TrendingDown, Copy } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonButton } from './NeonButton';

interface TokenDetailsProps {
  token?: {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    changePercent24h: number;
    balance: number;
    value: number;
    marketCap?: number;
    volume24h?: number;
    supply?: number;
    address?: string;
    logoURI?: string;
  };
  visible: boolean;
  onClose: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  onSwap?: () => void;
}

export default function TokenDetails({
  token,
  visible,
  onClose,
  onBuy,
  onSell,
  onSwap,
}: TokenDetailsProps) {
  if (!visible || !token) return null;

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  // Defensive defaults for missing data
  const safeToken = {
    symbol: token.symbol || 'Unknown',
    name: token.name || 'Unknown Token',
    price: token.price || 0,
    change24h: token.change24h || 0,
    changePercent24h: token.changePercent24h || 0,
    balance: token.balance || 0,
    value: token.value || 0,
    marketCap: token.marketCap,
    volume24h: token.volume24h,
    supply: token.supply,
    address: token.address,
    logoURI: token.logoURI,
  };

  const isPositive = safeToken.changePercent24h >= 0;
  const hasPriceData = safeToken.price > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={[COLORS.cardBackground, COLORS.background]}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.tokenInfo}>
                {safeToken.logoURI ? (
                  <Image source={{ uri: safeToken.logoURI }} style={styles.tokenLogo} />
                ) : (
                  <View style={styles.tokenLogoPlaceholder}>
                    <Text style={styles.tokenLogoText}>{safeToken.symbol[0]}</Text>
                  </View>
                )}
                <View style={styles.tokenTextInfo}>
                  <Text style={styles.tokenSymbol}>{safeToken.symbol}</Text>
                  <Text style={styles.tokenName}>{safeToken.name}</Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Price Section */}
              {hasPriceData ? (
                <View style={styles.priceSection}>
                  <Text style={styles.price}>
                    ${safeToken.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </Text>
                  <View style={styles.changeContainer}>
                    {isPositive ? (
                      <TrendingUp size={16} color={COLORS.success} />
                    ) : (
                      <TrendingDown size={16} color={COLORS.error} />
                    )}
                    <Text style={[styles.changeText, { color: isPositive ? COLORS.success : COLORS.error }]}>
                      ${Math.abs(safeToken.change24h).toFixed(2)} ({Math.abs(safeToken.changePercent24h).toFixed(2)}%)
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.priceSection}>
                  <Text style={styles.noDataText}>Price data unavailable</Text>
                </View>
              )}

              {/* Holdings Section */}
              {safeToken.balance > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your Holdings</Text>
                  <View style={styles.holdingRow}>
                    <Text style={styles.holdingLabel}>Balance</Text>
                    <Text style={styles.holdingValue}>
                      {safeToken.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {safeToken.symbol}
                    </Text>
                  </View>
                  <View style={styles.holdingRow}>
                    <Text style={styles.holdingLabel}>Value</Text>
                    <Text style={styles.holdingValue}>
                      ${safeToken.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Market Stats */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Market Statistics</Text>
                {safeToken.marketCap ? (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Market Cap</Text>
                    <Text style={styles.statValue}>${formatNumber(safeToken.marketCap)}</Text>
                  </View>
                ) : (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Market Cap</Text>
                    <Text style={styles.statValue}>-</Text>
                  </View>
                )}
                {safeToken.volume24h ? (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>24h Volume</Text>
                    <Text style={styles.statValue}>${formatNumber(safeToken.volume24h)}</Text>
                  </View>
                ) : (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>24h Volume</Text>
                    <Text style={styles.statValue}>-</Text>
                  </View>
                )}
                {safeToken.supply ? (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Circulating Supply</Text>
                    <Text style={styles.statValue}>{formatNumber(safeToken.supply, 0)} {safeToken.symbol}</Text>
                  </View>
                ) : (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Circulating Supply</Text>
                    <Text style={styles.statValue}>-</Text>
                  </View>
                )}
              </View>

              {/* Contract Address */}
              {safeToken.address && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Contract Address</Text>
                  <View style={styles.addressContainer}>
                    <Text style={styles.addressText} numberOfLines={1}>
                      {safeToken.address}
                    </Text>
                    <Pressable style={styles.copyButton}>
                      <Copy size={16} color={COLORS.solana} />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                {onBuy && (
                  <NeonButton
                    title="Buy"
                    onPress={onBuy}
                    style={styles.actionButton}
                    variant="primary"
                  />
                )}
                {onSell && (
                  <NeonButton
                    title="Sell"
                    onPress={onSell}
                    style={styles.actionButton}
                    variant="secondary"
                  />
                )}
                {onSwap && (
                  <NeonButton
                    title="Swap"
                    onPress={onSwap}
                    style={styles.actionButton}
                    variant="outline"
                  />
                )}
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: BORDER_RADIUS.large,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tokenInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
  },
  tokenLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tokenLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.solana + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoText: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.solana,
  },
  tokenTextInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  tokenName: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.m,
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  price: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  noDataText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  changeText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
  section: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  holdingLabel: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  holdingValue: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  statValue: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.s,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  copyButton: {
    padding: SPACING.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginTop: SPACING.m,
  },
  actionButton: {
    flex: 1,
  },
});