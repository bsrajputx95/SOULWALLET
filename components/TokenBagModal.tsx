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
  Alert,
} from 'react-native';
import { X, ShoppingBag, Settings } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { NeonButton } from './NeonButton';
import { logger } from '../lib/client-logger';
import { trpc } from '../lib/trpc';
import { useSolanaWallet } from '../hooks/solana-wallet-store';

// Mint addresses on Solana
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

interface Token {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
  address: string;
  postId?: string; // Required for Buy More
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
  const [inputCurrency, setInputCurrency] = useState<'SOL' | 'USDC'>('SOL');
  const [isSelling, setIsSelling] = useState(false);
  const [buyingToken, setBuyingToken] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Map<string, number>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(false);

  // Get wallet for swap execution
  const { executeSwap, publicKey } = useSolanaWallet();

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
  const sellMutation = trpc.social.sellIBuyToken.useMutation();

  // Buy iBuy token mutation (for Buy More)
  const ibuyMutation = trpc.social.ibuyToken.useMutation();

  // Load settings when query completes
  useEffect(() => {
    if (settingsQuery.data) {
      setBuyAmount(settingsQuery.data.buyAmount.toString());
      setSlippage(settingsQuery.data.slippage);
      setInputCurrency(settingsQuery.data.inputCurrency || 'SOL');
    }
  }, [settingsQuery.data]);

  // Get OPEN purchases only (not sold yet)
  const openPurchases = React.useMemo(() => {
    if (!purchasesQuery.data) return [];
    return purchasesQuery.data.filter((p: any) => p.status === 'OPEN');
  }, [purchasesQuery.data]);

  const openMints: string[] = React.useMemo(() => {
    if (openPurchases.length === 0) return [];
    return Array.from(new Set(openPurchases.map((p: any) => String(p.tokenMint))));
  }, [openPurchases]);

  const metadataQuery = trpc.wallet.getTokenMetadata.useQuery(
    { mints: openMints },
    { enabled: visible && openMints.length > 0 }
  );

  const metadataMap = React.useMemo(() => {
    const entries = metadataQuery.data?.metadata ?? [];
    return entries.reduce((acc, meta: any) => {
      acc[String(meta.mint)] = meta;
      return acc;
    }, {} as Record<string, any>);
  }, [metadataQuery.data]);

  // Fetch token prices from Jupiter
  const fetchTokenPrices = React.useCallback(async (mints: string[]) => {
    if (mints.length === 0) return;
    setPricesLoading(true);
    try {
      const mintIds = mints.join(',');
      const response = await fetch(`https://price.jup.ag/v6/price?ids=${mintIds}`);
      const data = await response.json();

      if (data?.data) {
        const prices = new Map<string, number>();
        Object.entries(data.data).forEach(([mint, info]: [string, any]) => {
          if (info?.price) {
            prices.set(mint, info.price);
          }
        });
        setTokenPrices(prices);
      }
    } catch (error) {
      logger.warn('Failed to fetch token prices:', error);
    } finally {
      setPricesLoading(false);
    }
  }, []);

  // Fetch prices when modal opens
  useEffect(() => {
    if (visible && openMints.length > 0) {
      void fetchTokenPrices(openMints);
    }
  }, [visible, openMints, fetchTokenPrices]);

  // Transform purchases to Token format for display with P&L
  const ibuyTokens: Token[] = React.useMemo(() => {
    if (!purchasesQuery.data) return [];

    // Group purchases by token and sum amounts
    const tokenMap = new Map<string, Token>();
    purchasesQuery.data.forEach((p: { tokenMint: string; tokenSymbol?: string | null; tokenName?: string | null; amountBought: number; amountRemaining?: number; priceInUsdc: number; status: string }) => {
      if (p.status !== 'OPEN') return; // Only show unsold
      const remaining = p.amountRemaining && p.amountRemaining > 0 ? p.amountRemaining : p.amountBought;
      const remainingCostBasis = p.amountBought > 0 ? p.priceInUsdc * (remaining / p.amountBought) : 0;
      const existing = tokenMap.get(p.tokenMint);
      if (existing) {
        existing.balance += remaining;
        existing.value += remainingCostBasis;
      } else {
        const meta = metadataMap[p.tokenMint];
        tokenMap.set(p.tokenMint, {
          symbol: p.tokenSymbol || meta?.symbol || p.tokenMint.slice(0, 6),
          name: p.tokenName || meta?.name || 'Unknown Token',
          balance: remaining,
          value: remainingCostBasis,
          change24h: 0, // Will be calculated below
          address: p.tokenMint,
        });
      }
    });

    // Calculate P&L using live prices
    const tokens = Array.from(tokenMap.values());
    tokens.forEach(token => {
      const currentPrice = tokenPrices.get(token.address);
      if (currentPrice && token.balance > 0) {
        const currentValue = token.balance * currentPrice;
        const costBasis = token.value;
        const pnlPercent = ((currentValue - costBasis) / costBasis) * 100;
        token.change24h = pnlPercent; // Repurpose as P&L %
      }
    });

    return tokens;
  }, [purchasesQuery.data, tokenPrices, metadataMap]);

  const applySettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        buyAmount: parseFloat(buyAmount) || 10,
        slippage: slippage,
        inputCurrency: inputCurrency,
      });
      setShowSettings(false);
    } catch (error) {
      logger.error('Failed to save iBuy settings:', error);
    }
  };

  // Sell a specific token - supports multi-position proportional sells
  const handleSell = async (token: Token, percentage: number) => {
    if (!publicKey) {
      Alert.alert('Wallet Not Connected', 'Please connect your wallet first.');
      return;
    }

    // Find all open purchases for this token
    const tokenPurchases = openPurchases
      .filter((p: any) => p.tokenMint === token.address)
      .slice()
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (tokenPurchases.length === 0) {
      Alert.alert('No Position', 'No open positions to sell.');
      return;
    }

    const decimals = Number(metadataMap[token.address]?.decimals ?? 0);
    const factor = Math.pow(10, decimals);
    const toRaw = (ui: number) => Math.max(0, Math.floor(ui * factor));
    const toUi = (raw: number) => raw / factor;

    const lots = tokenPurchases.map((p: any) => {
      const remaining = p.amountRemaining && p.amountRemaining > 0 ? p.amountRemaining : p.amountBought;
      return { ...p, remaining };
    });

    const totalBalanceRaw = lots.reduce((sum: number, p: any) => sum + toRaw(p.remaining), 0);
    const totalSellRaw = Math.floor(totalBalanceRaw * (percentage / 100));

    if (totalSellRaw <= 0) {
      Alert.alert('Invalid Amount', 'Sell amount too small.');
      return;
    }

    setIsSelling(true);

    try {
      let remainingToSellRaw = totalSellRaw;
      const sellPlan: Array<{ purchase: any; sellRaw: number; sellUi: number }> = [];
      for (const purchase of lots) {
        if (remainingToSellRaw <= 0) break;
        const availableRaw = toRaw(purchase.remaining);
        if (availableRaw <= 0) continue;
        const sellRaw = Math.min(availableRaw, remainingToSellRaw);
        if (sellRaw <= 0) continue;
        sellPlan.push({ purchase, sellRaw, sellUi: toUi(sellRaw) });
        remainingToSellRaw -= sellRaw;
      }

      if (sellPlan.length === 0) {
        Alert.alert('Invalid Amount', 'Sell amount too small.');
        return;
      }

      // Execute single swap for the total sell amount
      const result = await executeSwap({
        inputMint: token.address,
        outputMint: USDC_MINT,
        amount: sellPlan.reduce((sum, p) => sum + p.sellRaw, 0),
        slippageBps: Math.round(slippage * 100),
      });

      if (!result?.signature) {
        throw new Error('Swap failed - no transaction signature');
      }

      const totalSoldRaw = sellPlan.reduce((sum, p) => sum + p.sellRaw, 0);
      const estimatedCostBasisSold = sellPlan.reduce((sum, p) => {
        const amountBought = Number(p.purchase.amountBought || 0);
        const costBasis = Number(p.purchase.priceInUsdc || 0);
        if (amountBought <= 0) return sum;
        return sum + costBasis * (p.sellUi / amountBought);
      }, 0);

      // Use actual USDC received from swap, or fallback to cost basis estimate
      const sellAmountUsdc = result.outputAmount ?? estimatedCostBasisSold;

      const results = await Promise.allSettled(
        sellPlan.map(({ purchase, sellRaw, sellUi }) => {
          const share = totalSoldRaw > 0 ? sellRaw / totalSoldRaw : 0;
          return sellMutation.mutateAsync({
            purchaseId: purchase.id,
            sellAmountUsdc: sellAmountUsdc * share,
            sellTxSig: result.signature,
            amountSoldTokens: sellUi,
          });
        })
      );

      const succeeded = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean) as Array<{ profit: number; creatorFee: number; creatorUsername: string }>;

      await purchasesQuery.refetch();

      if (succeeded.length === 0) {
        throw new Error('Failed to record sell');
      }

      const totalProfit = succeeded.reduce((sum, r) => sum + (r.profit || 0), 0);
      const totalCreatorFee = succeeded.reduce((sum, r) => sum + (r.creatorFee || 0), 0);
      const creatorUsernames = Array.from(new Set(succeeded.map((r) => r.creatorUsername).filter(Boolean)));
      const profitText = totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`;
      const feeText =
        totalCreatorFee > 0
          ? creatorUsernames.length === 1
            ? `\n5% creator fee: $${totalCreatorFee.toFixed(2)} â†’ @${creatorUsernames[0]}`
            : `\nCreator fees: $${totalCreatorFee.toFixed(2)}`
          : '';
      Alert.alert('Sold!', `${profitText}${feeText}`);
    } catch (error: any) {
      logger.error('Sell swap failed:', error);
      Alert.alert('Swap Failed', error.message || 'Failed to execute sell swap');
    } finally {
      setIsSelling(false);
    }
  };

  const handleBuyMore = async (token: Token) => {
    if (!publicKey) {
      Alert.alert('Wallet Not Connected', 'Please connect your wallet first.');
      return;
    }

    // Find any open purchase for this token to get postId
    const existingPurchase = openPurchases.find((p: any) => p.tokenMint === token.address);
    if (!existingPurchase?.postId) {
      Alert.alert('No Post', 'Cannot find originating post for this token.');
      return;
    }

    setBuyingToken(token.address);
    try {
      logger.info(`[iBuy] Buying more ${token.symbol} with ${inputCurrency}...`);

      // Use the selected input currency
      const inputMint = inputCurrency === 'USDC' ? USDC_MINT : SOL_MINT;

      const result = await ibuyMutation.mutateAsync({
        postId: existingPurchase.postId,
        tokenMint: token.address,
        inputMint: inputMint,
      });

      if (result.success) {
        await purchasesQuery.refetch();
        Alert.alert(
          'Success!',
          `Bought ${token.symbol} for $${result.amountUsd || buyAmount} ${inputCurrency}`
        );
      }
    } catch (error: any) {
      logger.error('[iBuy] Buy More failed:', error);
      Alert.alert('Buy Failed', error.message || 'Failed to execute buy');
    } finally {
      setBuyingToken(null);
    }
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

                    {/* SOL/USDC Input Currency Toggle */}
                    <View style={styles.settingsRow}>
                      <Text style={styles.inputLabel}>Input Currency</Text>
                      <View style={styles.presetsRow}>
                        <NeonButton
                          title="SOL"
                          variant={inputCurrency === 'SOL' ? 'primary' : 'outline'}
                          size="small"
                          style={styles.presetButton}
                          onPress={() => setInputCurrency('SOL')}
                        />
                        <NeonButton
                          title="USDC"
                          variant={inputCurrency === 'USDC' ? 'primary' : 'outline'}
                          size="small"
                          style={styles.presetButton}
                          onPress={() => setInputCurrency('USDC')}
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

              {ibuyTokens.map((token: Token) => {
                // Calculate current value if we have price
                const currentPrice = tokenPrices.get(token.address);
                const currentValue = currentPrice ? token.balance * currentPrice : null;
                const pnlAmount = currentValue ? currentValue - token.value : null;

                return (
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
                        {currentValue ? (
                          <>
                            <Text style={styles.tokenValue}>${currentValue.toFixed(2)}</Text>
                            <Text
                              style={[
                                styles.tokenChange,
                                token.change24h >= 0 ? styles.positive : styles.negative,
                              ]}
                            >
                              {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                              {pnlAmount ? ` (${pnlAmount >= 0 ? '+' : ''}$${pnlAmount.toFixed(2)})` : ''}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.tokenValue}>${token.value.toFixed(2)}</Text>
                            <Text style={styles.tokenChangeLoading}>
                              {pricesLoading ? 'Loading...' : 'Cost basis'}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>

                    <View style={styles.balanceContainer}>
                      <Text style={styles.balanceLabel}>Holdings:</Text>
                      <Text style={styles.balanceValue}>
                        {formatNumber(token.balance)} {token.symbol}
                      </Text>
                    </View>

                    {/* Cost basis info */}
                    {currentValue && (
                      <View style={styles.balanceContainer}>
                        <Text style={styles.balanceLabel}>Cost basis:</Text>
                        <Text style={styles.balanceValue}>${token.value.toFixed(2)}</Text>
                      </View>
                    )}

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
                            disabled={isSelling}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Buy More Button */}
                    <NeonButton
                      title={buyingToken === token.address ? "Buying..." : "Buy More"}
                      variant="primary"
                      size="medium"
                      fullWidth
                      style={styles.buyMoreButton}
                      onPress={() => handleBuyMore(token)}
                      disabled={!!buyingToken}
                    />
                  </NeonCard>
                );
              })}
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
  tokenChangeLoading: {
    ...FONTS.phantomMedium,
    fontSize: 12,
    marginTop: 2,
    color: COLORS.textSecondary,
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
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  presetButton: {
    flex: 1,
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
