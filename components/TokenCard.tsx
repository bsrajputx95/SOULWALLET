import React from 'react';
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
  age?: string;
  logo?: string;
  onPress?: () => void;
}

export const TokenCard: React.FC<TokenCardProps> = ({
  symbol,
  name,
  price,
  change,
  liquidity,
  volume,
  age,
  logo,
  onPress,
}) => {
  const formatPrice = (price: number) => {
    if (price < 0.000001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 1000) return price.toFixed(2);
    return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

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
          <View style={styles.leftContent}>
            <View style={styles.symbolContainer}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.tokenLogo} />
              ) : (
                <View style={[styles.tokenLogoPlaceholder, { backgroundColor: getTokenColor(symbol)[0] + '30' }]}>
                  <Text style={styles.tokenLogoText}>{symbol.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.tokenInfo}>
                <Text style={styles.symbol}>{symbol}</Text>
                <Text style={styles.name}>{name}</Text>
              </View>
            </View>
            <Text style={styles.price}>${formatPrice(price)}</Text>
          </View>
          
          <View style={styles.rightContent}>
            <Text style={[styles.change, { color: getChangeColor(change) }]}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </Text>
            
            {(liquidity || volume || age) && (
              <View style={styles.statsContainer}>
                {liquidity && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>💧</Text>
                    <Text style={styles.statValue}>{formatLargeNumber(liquidity)}</Text>
                  </View>
                )}
                
                {volume && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>📊</Text>
                    <Text style={styles.statValue}>{formatLargeNumber(volume)}</Text>
                  </View>
                )}
                
                {age && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>⏰</Text>
                    <Text style={styles.statValue}>{age}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </NeonCard>
    </TouchableOpacity>
  );
};

const getTokenColor = (symbol: string) => {
  switch (symbol.toUpperCase()) {
    case 'SOL':
      return [COLORS.solana, COLORS.solana + '80'];
    case 'ETH':
      return [COLORS.ethereum, COLORS.ethereum + '80'];
    case 'BNB':
      return [COLORS.binance, COLORS.binance + '80'];
    case 'USDC':
      return [COLORS.usdc, COLORS.usdc + '80'];
    case 'WIF':
      return [COLORS.wif, COLORS.wif + '80'];
    case 'RNDR':
      return ['#FF6B35', '#FF6B35' + '80'];
    case 'PEPE':
      return ['#00D4AA', '#00D4AA' + '80'];
    case 'JUP':
      return ['#C7931E', '#C7931E' + '80'];
    case 'BONK':
      return ['#FF8C00', '#FF8C00' + '80'];
    default:
      return COLORS.gradientPurple;
  }
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
  leftContent: {
    flex: 1,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  symbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.s,
  },
  tokenLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoText: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  tokenInfo: {
    flex: 1,
  },
  symbol: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  name: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  price: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  change: {
    ...FONTS.monospace,
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
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
  },
  statValue: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});