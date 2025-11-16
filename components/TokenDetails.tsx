import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, TrendingUp, TrendingDown, ExternalLink, Copy } from 'lucide-react-native';

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

  const isPositive = token.changePercent24h >= 0;

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.cardBackground, COLORS.background]}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenSymbol}>{token.symbol}</Text>
              <Text style={styles.tokenName}>{token.name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Price Section */}
            <View style={styles.priceSection}>
              <Text style={styles.price}>
                ${token.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </Text>
              <View style={styles.changeContainer}>
                {isPositive ? (
                  <TrendingUp size={16} color={COLORS.success} />
                ) : (
                  <TrendingDown size={16} color={COLORS.error} />
                )}
                <Text style={[styles.changeText, { color: isPositive ? COLORS.success : COLORS.error }]}>
                  ${Math.abs(token.change24h).toFixed(2)} ({Math.abs(token.changePercent24h).toFixed(2)}%)
                </Text>
              </View>
            </View>

            {/* Holdings Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Holdings</Text>
              <View style={styles.holdingRow}>
                <Text style={styles.holdingLabel}>Balance</Text>
                <Text style={styles.holdingValue}>
                  {token.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {token.symbol}
                </Text>
              </View>
              <View style={styles.holdingRow}>
                <Text style={styles.holdingLabel}>Value</Text>
                <Text style={styles.holdingValue}>
                  ${token.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Market Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Market Statistics</Text>
              {token.marketCap && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Market Cap</Text>
                  <Text style={styles.statValue}>${formatNumber(token.marketCap)}</Text>
                </View>
              )}
              {token.volume24h && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>24h Volume</Text>
                  <Text style={styles.statValue}>${formatNumber(token.volume24h)}</Text>
                </View>
              )}
              {token.supply && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Circulating Supply</Text>
                  <Text style={styles.statValue}>{formatNumber(token.supply, 0)} {token.symbol}</Text>
                </View>
              )}
            </View>

            {/* Contract Address */}
            {token.address && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contract Address</Text>
                <View style={styles.addressContainer}>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {token.address}
                  </Text>
                  <Pressable style={styles.copyButton}>
                    <Copy size={16} color={COLORS.primary} />
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
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
  },
  tokenSymbol: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  tokenName: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    opacity: 0.7,
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
    color: COLORS.text,
    marginBottom: SPACING.xs,
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
    color: COLORS.text,
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
    color: COLORS.text,
    opacity: 0.7,
  },
  holdingValue: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.text,
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
    color: COLORS.text,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
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
    color: COLORS.text,
    opacity: 0.8,
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