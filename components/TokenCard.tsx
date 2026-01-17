import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';

interface TokenCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  liquidity?: number;
  volume?: number;
  transactions?: number;
  logo?: string;
  onPress?: () => void;
}

// Validate logo URL - must be https and non-empty
const isValidLogoUrl = (url?: string): boolean => {
  if (!url || url.trim() === '') return false;
  // Only allow https URLs
  if (!url.startsWith('https://')) return false;
  return true;
};

/**
 * Format price in DexScreener style: 0.0(5)234
 * Shows the number of leading zeros in parentheses for very small prices
 */
const formatDexScreenerPrice = (price: number): string => {
  if (price === 0) return '$0.00';

  // For prices >= 1, use normal formatting
  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }

  // For very small prices, count leading zeros after decimal point
  const priceStr = price.toFixed(20);
  const decimalIndex = priceStr.indexOf('.');

  if (decimalIndex === -1) return `$${price.toFixed(2)}`;

  // Count leading zeros after decimal point
  let zeroCount = 0;
  for (let i = decimalIndex + 1; i < priceStr.length; i++) {
    if (priceStr[i] === '0') {
      zeroCount++;
    } else {
      break;
    }
  }

  // If 4 or more leading zeros, use subscript notation
  if (zeroCount >= 4) {
    // Get the significant digits (up to 4 digits after the zeros)
    const significantPart = priceStr.slice(decimalIndex + 1 + zeroCount, decimalIndex + 1 + zeroCount + 4);
    return `$0.0(${zeroCount})${significantPart}`;
  }

  // For fewer zeros, show normally
  return `$${price.toFixed(6)}`;
};

export const TokenCard: React.FC<TokenCardProps> = ({
  symbol,
  name: _name,
  price,
  change,
  liquidity,
  volume,
  transactions: _transactions,
  logo,
  onPress,
}) => {
  // Track if image failed to load
  const [imageError, setImageError] = useState(false);

  // Determine if we should show the image or letter avatar
  const showImage = isValidLogoUrl(logo) && !imageError;

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? COLORS.success : COLORS.error;
  };

  const handlePress = () => {
    if (__DEV__) console.log('TokenCard pressed:', symbol);
    if (onPress) {
      if (__DEV__) console.log('Using custom onPress handler');
      onPress();
    } else {
      const route = `/coin/${symbol.toLowerCase()}` as any;
      if (__DEV__) console.log('Navigating to:', route);
      router.push(route);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <NeonCard style={styles.container} color={getTokenColor(symbol)}>
        <View style={styles.content}>
          {/* Left: Logo + Ticker */}
          <View style={styles.leftSection}>
            {showImage ? (
              <Image
                source={{ uri: logo }}
                style={styles.tokenLogo}
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={[styles.tokenLogoPlaceholder, { backgroundColor: getTokenColor(symbol)[0] + '30' }]}>
                <Text style={styles.tokenLogoText}>{symbol.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.ticker}>{symbol}</Text>
          </View>

          {/* Right: Price + Change */}
          <View style={styles.rightSection}>
            <Text style={styles.price}>{formatDexScreenerPrice(price)}</Text>
            <Text style={[styles.change, { color: getChangeColor(change) }]}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Bottom stats row (optional) */}
        {(liquidity || volume) && (
          <View style={styles.statsRow}>
            {liquidity && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>LIQ</Text>
                <Text style={styles.statValue}>{formatLargeNumber(liquidity)}</Text>
              </View>
            )}
            {volume && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>VOL</Text>
                <Text style={styles.statValue}>{formatLargeNumber(volume)}</Text>
              </View>
            )}
          </View>
        )}
      </NeonCard>
    </TouchableOpacity>
  );
};

const getTokenColor = (symbol: string): readonly [string, string, ...string[]] => {
  switch (symbol.toUpperCase()) {
    case 'SOL':
      return [COLORS.solana, COLORS.solana + '80'] as const;
    case 'ETH':
      return [COLORS.ethereum, COLORS.ethereum + '80'] as const;
    case 'BNB':
      return [COLORS.binance, COLORS.binance + '80'] as const;
    case 'USDC':
      return [COLORS.usdc, COLORS.usdc + '80'] as const;
    case 'WIF':
      return [COLORS.wif, COLORS.wif + '80'] as const;
    case 'RNDR':
      return ['#FF6B35', '#FF6B35' + '80'] as const;
    case 'PEPE':
      return ['#00D4AA', '#00D4AA' + '80'] as const;
    case 'JUP':
      return ['#C7931E', '#C7931E' + '80'] as const;
    case 'BONK':
      return ['#FF8C00', '#FF8C00' + '80'] as const;
    default:
      return COLORS.gradientPurple;
  }
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  tokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: SPACING.s,
  },
  tokenLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: SPACING.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoText: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  ticker: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  price: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  change: {
    ...FONTS.monospace,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.s,
    paddingTop: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBackground,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  statLabel: {
    ...FONTS.sfProMedium,
    fontSize: 10,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  statValue: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});