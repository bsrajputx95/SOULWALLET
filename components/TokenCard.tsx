import React, { useState, memo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { formatSubscriptPrice, formatLargeNumber } from '../utils/formatPrice';

interface TokenCardProps {
  symbol: string;
  price: number;
  change: number;
  liquidity?: number;
  volume?: number;
  logo?: string;
  onPress?: () => void;
}

// Memoized for performance with 50-token lists
export const TokenCard = memo<TokenCardProps>(({
  symbol,
  price,
  change,
  liquidity,
  volume,
  logo,
  onPress,
}) => {
  const [imageError, setImageError] = useState(false);

  // Show image only if valid HTTPS
  const showImage = logo?.startsWith('https://') && !imageError;
  
  const isPositive = change >= 0;
  const changeColor = isPositive ? COLORS.success : COLORS.error;
  const tokenColor = getTokenColor(symbol);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/coin/${symbol.toLowerCase()}` as any);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <NeonCard style={styles.container} color={tokenColor}>
        <View style={styles.content}>
          <View style={styles.left}>
            <View style={styles.symbolRow}>
              {showImage ? (
                <Image
                  source={{ uri: logo }}
                  style={styles.logo}
                  onError={() => setImageError(true)}
                />
              ) : (
                <View style={[styles.logoPlaceholder, { backgroundColor: tokenColor[0] + '30' }]}>
                  <Text style={styles.logoText}>{symbol[0]}</Text>
                </View>
              )}
              <Text style={styles.symbol} numberOfLines={1} ellipsizeMode="tail">
                {symbol.length > 12 ? symbol.slice(0, 12) + '...' : symbol}
              </Text>
            </View>
            <Text style={styles.price}>{formatSubscriptPrice(price)}</Text>
          </View>

          <View style={styles.right}>
            <Text style={[styles.change, { color: changeColor }]}>
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </Text>

            {(!!liquidity || !!volume) && (
              <View style={styles.stats}>
                {!!liquidity && (
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: COLORS.usdc }]}>L</Text>
                    <Text style={styles.statValue}>{formatLargeNumber(liquidity)}</Text>
                  </View>
                )}
                {!!volume && (
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: COLORS.solana }]}>M</Text>
                    <Text style={styles.statValue}>{formatLargeNumber(volume)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </NeonCard>
    </TouchableOpacity>
  );
}, (prev, next) => {
  // Custom comparison for memo - only re-render if data changes
  return (
    prev.symbol === next.symbol &&
    prev.price === next.price &&
    prev.change === next.change &&
    prev.liquidity === next.liquidity &&
    prev.volume === next.volume &&
    prev.logo === next.logo
  );
});

TokenCard.displayName = 'TokenCard';

const getTokenColor = (symbol: string): readonly [string, string, ...string[]] => {
  const s = symbol.toUpperCase();
  if (s === 'SOL') return [COLORS.solana, COLORS.solana + '80'] as const;
  if (s === 'ETH') return [COLORS.ethereum, COLORS.ethereum + '80'] as const;
  if (s === 'USDC') return [COLORS.usdc, COLORS.usdc + '80'] as const;
  if (s === 'WIF') return [COLORS.wif, COLORS.wif + '80'] as const;
  if (s === 'JUP') return ['#C7931E', '#C7931E80'] as const;
  if (s === 'BONK') return ['#FF8C00', '#FF8C0080'] as const;
  return COLORS.gradientPurple;
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
  left: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.s,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  symbol: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    flexShrink: 1,
  },
  price: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  right: {
    alignItems: 'flex-end',
  },
  change: {
    ...FONTS.monospace,
    fontSize: 14,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.s,
  },
  statLabel: {
    fontSize: 12,
    marginRight: 2,
    ...FONTS.phantomBold,
  },
  statValue: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});

export default TokenCard;
