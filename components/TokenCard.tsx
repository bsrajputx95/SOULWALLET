import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { formatSubscriptPrice, formatLargeNumber as formatLargeNum } from '../utils/formatPrice';

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

// Validate logo URL - allow https and known trusted http domains
const isValidLogoUrl = (url?: string): boolean => {
  if (!url || url.trim() === '') return false;
  // Allow https URLs
  if (url.startsWith('https://')) return true;
  // Allow trusted http sources (arweave, ipfs gateways, dexscreener, etc.)
  const trustedHttpDomains = ['arweave.net', 'ipfs.io', 'nftstorage.link', 'cloudflare-ipfs.com', 'dd.dexscreener.com'];
  if (url.startsWith('http://')) {
    return trustedHttpDomains.some(domain => url.includes(domain));
  }
  return false;
};

export const TokenCard: React.FC<TokenCardProps> = ({
  symbol,
  name: _name, // Not displaying bio/name anymore
  price,
  change,
  liquidity,
  volume,
  transactions,
  logo,
  onPress,
}) => {
  // Track if image failed to load
  const [imageError, setImageError] = useState(false);

  // Determine if we should show the image or letter avatar
  const showImage = isValidLogoUrl(logo) && !imageError;
  // Use imported formatSubscriptPrice for DexScreener-style formatting
  const formatPrice = formatSubscriptPrice;

  // Use imported formatter for large numbers
  const formatLargeNumber = formatLargeNum;

  const getChangeColor = (change: number) => {
    return change >= 0 ? COLORS.success : COLORS.error;
  };

  const formatTxnCount = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return `${Math.round(num)}`;
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      const route = `/coin/${symbol.toLowerCase()}` as any;
      router.push(route);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <NeonCard style={styles.container} color={getTokenColor(symbol)}>
        <View style={styles.content}>
          <View style={styles.leftContent}>
            <View style={styles.symbolContainer}>
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
              <View style={styles.tokenInfo}>
                <Text style={styles.symbol} numberOfLines={1} ellipsizeMode="tail">
                  {symbol.length > 12 ? symbol.slice(0, 12) + '...' : symbol}
                </Text>
                {/* Removed name/bio display - just show ticker */}
              </View>
            </View>
            <Text style={styles.price}>{formatPrice(price)}</Text>
          </View>

          <View style={styles.rightContent}>
            <Text style={[styles.change, { color: getChangeColor(change) }]}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </Text>

            {(typeof liquidity === 'number' || typeof volume === 'number' || typeof transactions === 'number') && (
              <View style={styles.statsContainer}>
                {typeof liquidity === 'number' && liquidity > 0 && (
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, styles.statLabelL]}>L</Text>
                    <Text style={styles.statValue}>{formatLargeNumber(liquidity)}</Text>
                  </View>
                )}

                {typeof volume === 'number' && volume > 0 && (
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, styles.statLabelM]}>M</Text>
                    <Text style={styles.statValue}>{formatLargeNumber(volume)}</Text>
                  </View>
                )}

                {typeof transactions === 'number' && transactions > 0 && (
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, styles.statLabelT]}>T</Text>
                    <Text style={styles.statValue}>{formatTxnCount(transactions)}</Text>
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
    maxWidth: '70%',
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
  statLabelL: {
    color: COLORS.usdc,
  },
  statLabelM: {
    color: COLORS.solana,
  },
  statLabelT: {
    color: COLORS.warning,
  },
  statValue: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});