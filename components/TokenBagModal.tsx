import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { X, ShoppingBag, Settings } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { NeonButton } from './NeonButton';
import { NeonInput } from './NeonInput';
import { logger } from '../lib/client-logger';

interface Token {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
  address: string;
}

interface TokenBagModalProps {
  visible: boolean;
  onClose: () => void;
}

// Mock data for iBuy tokens
const mockTokens: Token[] = [
  {
    symbol: 'PEPE',
    name: 'Pepe',
    balance: 1000000,
    value: 1250.50,
    change24h: 15.2,
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    balance: 500000,
    value: 890.75,
    change24h: -8.4,
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  },
  {
    symbol: 'WIF',
    name: 'dogwifhat',
    balance: 250,
    value: 2100.25,
    change24h: 22.8,
    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  },
];

export const TokenBagModal: React.FC<TokenBagModalProps> = ({
  visible,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  const modalHeight = height * 0.67; // 2/3 of screen height

  const [showSettings, setShowSettings] = useState(false);
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [confirmedBuyAmount, setConfirmedBuyAmount] = useState<string>('');
  const [confirmedSlippage, setConfirmedSlippage] = useState<number>(0.5);

  const applySettings = () => {
    setConfirmedBuyAmount(buyAmount);
    setConfirmedSlippage(slippage);
    setShowSettings(false);
  };

  const handleSell = (token: Token, percentage: number) => {
    // In a real app, this would call the sell API
    logger.debug(`Selling ${percentage}% of ${token.symbol}`);
  };

  const handleBuyMore = (token: Token) => {
    // In a real app, this would navigate to buy screen
    logger.debug(
      `Buying more ${token.symbol} with amount ${confirmedBuyAmount || '(unset)'} USDC and slippage ${confirmedSlippage}%`
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modalContainer, { maxHeight: modalHeight }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ShoppingBag size={24} color={COLORS.solana} />
              <Text style={styles.title}>My iBuy Tokens</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => setShowSettings((s) => !s)}
                style={[styles.iconButton, showSettings && styles.iconButtonActive]}
              >
                <Settings size={20} color={COLORS.textSecondary} />
              </Pressable>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={24} color={COLORS.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {showSettings && (
              <View style={styles.settingsContainer}>
                <View style={styles.settingsPanel}>
                  <Text style={styles.settingsTitle}>Buy Settings</Text>
                  <View style={styles.settingsRow}>
                    <NeonInput
                      label="Buy Amount (USDC)"
                      placeholder="Enter amount"
                      value={buyAmount}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        setBuyAmount(cleaned);
                      }}
                    />
                  </View>

                  <View style={styles.settingsRow}>
                    <Text style={styles.settingsLabel}>Slippage Tolerance</Text>
                    <View style={styles.slippageButtons}>
                      {[0.1, 0.5, 1, 3].map((p) => (
                        <NeonButton
                          key={p}
                          title={`${p}%`}
                          variant={Math.abs(slippage - p) < 0.0001 ? 'primary' : 'outline'}
                          size="small"
                          style={styles.slippageButton}
                          onPress={() => setSlippage(p)}
                        />
                      ))}
                    </View>
                    <View style={styles.customSlippageRow}>
                      <NeonInput
                        label="Custom (%)"
                        placeholder="0.1 - 50"
                        value={String(slippage)}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/[^0-9.]/g, '');
                          const num = parseFloat(cleaned);
                          if (!isNaN(num)) {
                            const clamped = Math.max(0.01, Math.min(50, num));
                            setSlippage(parseFloat(clamped.toFixed(2)));
                          } else if (cleaned === '') {
                            setSlippage(0.5);
                          }
                        }}
                      />
                    </View>
                    <NeonButton
                      title="OK"
                      variant="primary"
                      size="small"
                      fullWidth
                      style={styles.applyButton}
                      onPress={applySettings}
                    />
                  </View>
                </View>
              </View>
            )}
            {mockTokens.map((token, index) => (
              <NeonCard
                key={token.address}
                style={styles.tokenCard}
                color={COLORS.gradientPurple}
                intensity="medium"
              >
                <View style={styles.tokenHeader}>
                  <View style={styles.tokenInfo}>
                    <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                    <Text style={styles.tokenName}>{token.name}</Text>
                  </View>
                  <View style={styles.tokenValues}>
                    <Text style={styles.tokenValue}>${token.value.toFixed(2)}</Text>
                    <Text
                      style={[
                        styles.tokenChange,
                        token.change24h >= 0 ? styles.positive : styles.negative,
                      ]}
                    >
                      {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.balanceContainer}>
                  <Text style={styles.balanceLabel}>Holdings:</Text>
                  <Text style={styles.balanceValue}>
                    {formatNumber(token.balance)} {token.symbol}
                  </Text>
                </View>

                {/* Sell Buttons */}
                <View style={styles.sellContainer}>
                  <Text style={styles.sellLabel}>Quick Sell:</Text>
                  <View style={styles.sellButtons}>
                    {[10, 25, 50, 100].map((percentage) => (
                      <NeonButton
                        key={percentage}
                        title={`${percentage}%`}
                        variant="outline"
                        size="small"
                        style={styles.sellButton}
                        onPress={() => handleSell(token, percentage)}
                      />
                    ))}
                  </View>
                </View>

                {/* Buy More Button */}
                <NeonButton
                  title="Buy More"
                  variant="primary"
                  size="medium"
                  fullWidth
                  style={styles.buyMoreButton}
                  onPress={() => handleBuyMore(token)}
                />
              </NeonCard>
            ))}
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
    paddingBottom: 20,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
    marginLeft: SPACING.s,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s,
  },
  iconButtonActive: {
    backgroundColor: COLORS.solana + '20',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContainer: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.s,
  },
  settingsPanel: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
  },
  settingsTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  settingsRow: {
    marginBottom: SPACING.m,
  },
  settingsLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.s,
  },
  slippageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  slippageButton: {
    flex: 1,
    marginHorizontal: 2,
  },
  customSlippageRow: {
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.l,
  },
  tokenCard: {
    marginBottom: SPACING.m,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.m,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tokenName: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  tokenValues: {
    alignItems: 'flex-end',
  },
  tokenValue: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tokenChange: {
    ...FONTS.phantomMedium,
    fontSize: 14,
    marginTop: 2,
  },
  positive: {
    color: COLORS.success,
  },
  negative: {
    color: COLORS.error,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    backgroundColor: COLORS.background + '50',
    borderRadius: BORDER_RADIUS.small,
  },
  balanceLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  balanceValue: {
    ...FONTS.phantomBold,
    color: COLORS.solana,
    fontSize: 14,
  },
  sellContainer: {
    marginBottom: SPACING.m,
  },
  sellLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.s,
  },
  sellButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sellButton: {
    flex: 1,
    marginHorizontal: 2,
  },
  buyMoreButton: {
    marginTop: SPACING.s,
  },
  applyButton: {
    marginTop: SPACING.s,
  },
});