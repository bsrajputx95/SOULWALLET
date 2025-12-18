import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';

interface WalletCardProps {
  balance: number;
  dailyPnl: number;
  currency?: string;
  pnlPeriod?: '1d' | '7d' | '30d' | '1y';
  onPeriodChange?: (period: '1d' | '7d' | '30d' | '1y') => void;
  isMultiChain?: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  balance,
  dailyPnl,
  currency = 'USD',
  pnlPeriod = '1d',
  onPeriodChange,
  isMultiChain = false,
}) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getPnlColor = (pnl: number) => {
    return pnl >= 0 ? COLORS.success : COLORS.error;
  };

  const getPnlPrefix = (pnl: number) => {
    return pnl >= 0 ? '+' : '';
  };

  const getPnlPercentage = (pnl: number, balance: number) => {
    if (balance === 0) return '0.00%';
    const percentage = (pnl / (balance - pnl)) * 100;
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  return (
    <NeonCard color={isMultiChain ? COLORS.gradientGold : COLORS.gradientPurple}>
      <View style={styles.container}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>🪙 Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balance)}</Text>
        </View>

        <View style={styles.pnlContainer}>
          <View style={styles.pnlHeader}>
            <Text style={styles.pnlLabel}>{pnlPeriod === '1d' ? 'Daily' : pnlPeriod === '7d' ? '7-Day' : pnlPeriod === '30d' ? '30-Day' : 'Yearly'} PnL</Text>
            {onPeriodChange && (
              <TouchableOpacity
                style={styles.periodButton}
                onPress={() => {
                  const periods: ('1d' | '7d' | '30d' | '1y')[] = ['1d', '7d', '30d', '1y'];
                  const currentIndex = periods.indexOf(pnlPeriod);
                  const nextIndex = (currentIndex + 1) % periods.length;
                  onPeriodChange(periods[nextIndex]!);
                }}
              >
                <Text style={styles.periodText}>{pnlPeriod.toUpperCase()}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.pnlValueContainer}>
            <Text style={[
              styles.pnlValue,
              { color: getPnlColor(dailyPnl) }
            ]}>
              {getPnlPrefix(dailyPnl)}{formatCurrency(dailyPnl)}
            </Text>
            <Text style={[
              styles.pnlPercentage,
              { color: getPnlColor(dailyPnl) }
            ]}>
              ({getPnlPercentage(dailyPnl, balance)})
            </Text>
          </View>
        </View>
      </View>
    </NeonCard>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.s,
  },
  balanceContainer: {
    marginBottom: SPACING.m,
  },
  balanceLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  balanceValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  pnlContainer: {},
  pnlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
    minWidth: 50,
    justifyContent: 'center',
  },
  periodText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 12,
    fontWeight: '700',
  },
  pnlLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  pnlValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pnlValue: {
    ...FONTS.monospace,
    fontSize: 18,
    fontWeight: '700',
  },
  pnlPercentage: {
    ...FONTS.monospace,
    fontSize: 14,
    marginLeft: SPACING.s,
  },
});