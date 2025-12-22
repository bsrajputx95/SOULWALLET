import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { X, ShoppingBag, Settings } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { NeonButton } from './NeonButton';
import { logger } from '../lib/client-logger';
import { trpc } from '../lib/trpc';

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

export const TokenBagModal: React.FC<TokenBagModalProps> = ({
  visible,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  const modalHeight = height * 0.67; // 2/3 of screen height

  const [showSettings, setShowSettings] = useState(false);
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);

  // Fetch persisted settings from API
  const settingsQuery = trpc.user.getIBuySettings.useQuery(undefined, {
    enabled: visible,
  });
  const updateSettingsMutation = trpc.user.updateIBuySettings.useMutation();

  // Fetch iBuy purchases from API
  const purchasesQuery = trpc.social.getIBuyPurchases.useQuery(undefined, {
    enabled: visible,
  });

  // Sell iBuy token mutation
  const sellMutation = trpc.social.sellIBuyToken.useMutation({
    onSuccess: (data) => {
      purchasesQuery.refetch();
      // Show success message with profit info
      const profitText = data.profit >= 0 ? `+$${data.profit.toFixed(2)}` : `-$${Math.abs(data.profit).toFixed(2)}`;
      const feeText = data.creatorFee > 0 ? `\n5% creator fee: $${data.creatorFee.toFixed(2)} → @${data.creatorUsername}` : '';
      alert(`Sold! ${profitText}${feeText}`);
    },
    onError: (error: any) => {
      alert(`Sell failed: ${error.message}`);
    },
  });

  // Load settings when query completes
  useEffect(() => {
    if (settingsQuery.data) {
      setBuyAmount(settingsQuery.data.buyAmount.toString());
      setSlippage(settingsQuery.data.slippage);
    }
  }, [settingsQuery.data]);

  // Get OPEN purchases only (not sold yet)
  const openPurchases = React.useMemo(() => {
    if (!purchasesQuery.data) return [];
    return purchasesQuery.data.filter((p: any) => p.status === 'OPEN');
  }, [purchasesQuery.data]);

  // Transform purchases to Token format for display
  const ibuyTokens: Token[] = React.useMemo(() => {
    if (!purchasesQuery.data) return [];

    // Group purchases by token and sum amounts
    const tokenMap = new Map<string, Token>();
    purchasesQuery.data.forEach((p: { tokenMint: string; tokenSymbol?: string | null; tokenName?: string | null; amountBought: number; priceInUsdc: number; status: string }) => {
      if (p.status !== 'OPEN') return; // Only show unsold
      const existing = tokenMap.get(p.tokenMint);
      if (existing) {
        existing.balance += p.amountBought;
        existing.value += p.priceInUsdc;
      } else {
        tokenMap.set(p.tokenMint, {
          symbol: p.tokenSymbol || p.tokenMint.slice(0, 6),
          name: p.tokenName || 'Unknown Token',
          balance: p.amountBought,
          value: p.priceInUsdc,
          change24h: 0, // TODO: Get live price data
          address: p.tokenMint,
        });
      }
    });
    return Array.from(tokenMap.values());
  }, [purchasesQuery.data]);

  const applySettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        buyAmount: parseFloat(buyAmount) || 10,
        slippage: slippage,
      });
      setShowSettings(false);
    } catch (error) {
      logger.error('Failed to save iBuy settings:', error);
    }
  };

  // Sell a specific token - finds the first open purchase and sells it
  const handleSell = (token: Token, percentage: number) => {
    // Find open purchases for this token
    const tokenPurchases = openPurchases.filter((p: any) => p.tokenMint === token.address);
    if (tokenPurchases.length === 0) {
      alert('No open positions to sell');
      return;
    }

    // For now, sell the first purchase (100% of that position)
    // In production, you'd do a Jupiter swap here first
    const purchase = tokenPurchases[0];
    const simulatedSellPrice = purchase.priceInUsdc * (1 + (Math.random() * 0.4 - 0.1)); // Simulate +/- price change

    sellMutation.mutate({
      purchaseId: purchase.id,
      sellAmountUsdc: simulatedSellPrice * (percentage / 100),
      sellTxSig: `sim_${Date.now()}`, // In production, this comes from Jupiter swap
    });
  };

  const handleBuyMore = (token: Token) => {
    // In a real app, this would navigate to buy screen
    logger.debug(
      `Buying more ${token.symbol} with amount ${buyAmount || '(unset)'} USDC and slippage ${slippage}%`
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
        <View style={[styles.modalContainer, { minHeight: modalHeight, maxHeight: height * 0.85 }]}>
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
            >
              {showSettings && (
                <View style={styles.settingsContainer}>
                  <View style={styles.settingsPanel}>
                    <Text style={styles.settingsTitle}>Buy Settings</Text>

                    <View style={styles.settingsRow}>
                      <Text style={styles.inputLabel}>Buy Amount (USDC)</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Enter amount"
                          placeholderTextColor={COLORS.textSecondary}
                          value={buyAmount}
                          keyboardType="decimal-pad"
                          autoCorrect={false}
                          autoCapitalize="none"
                          onChangeText={(text) => {
                            const cleaned = text.replace(/[^0-9.]/g, '');
                            setBuyAmount(cleaned);
                          }}
                        />
                      </View>
                    </View>

                    <View style={styles.settingsRow}>
                      <Text style={styles.inputLabel}>Slippage Tolerance (%)</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Enter slippage (e.g. 0.5)"
                          placeholderTextColor={COLORS.textSecondary}
                          value={String(slippage)}
                          keyboardType="decimal-pad"
                          autoCorrect={false}
                          autoCapitalize="none"
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
                    </View>

                    <NeonButton
                      title="Apply Settings"
                      variant="primary"
                      size="medium"
                      fullWidth
                      style={styles.applyButton}
                      onPress={applySettings}
                    />
                  </View>
                </View>
              )}

              {/* Empty state when no iBuy tokens */}
              {ibuyTokens.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No iBuy tokens yet</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Tokens you buy via iBuy will appear here
                  </Text>
                </View>
              )}

              {ibuyTokens.map((token: Token) => (
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
          </KeyboardAvoidingView>
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
  inputLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '50',
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.background,
  },
  textInput: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    fontSize: 16,
  },
  settingsLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.s,
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
  emptyState: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  emptyStateSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center' as const,
  },
});