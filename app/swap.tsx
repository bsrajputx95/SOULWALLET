import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, ArrowUpDown, Settings, Info, ChevronDown } from 'lucide-react-native';
import { useSolanaWallet } from '../hooks/solana-wallet-store';
import { jupiterSwap } from '../services/jupiter-swap';
import { NeonButton } from '../components/NeonButton';
import { NeonCard } from '../components/NeonCard';
import { GlowingText } from '../components/GlowingText';

interface Token {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logo?: string;
  balance: number;
}

// Use the SwapRoute type from jupiter-swap service
import type { SwapRoute } from '../services/jupiter-swap';

export default function SwapScreen() {
  const router = useRouter();
  const { wallet, publicKey, getAvailableTokens, refreshBalances, connection } = useSolanaWallet();
  
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [quote, setQuote] = useState<SwapRoute | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [showTokenSelector, setShowTokenSelector] = useState<boolean>(false);
  const [selectingFor, setSelectingFor] = useState<'from' | 'to'>('from');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [quoteTimer, setQuoteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  const availableTokens = useMemo(() => getAvailableTokens(), [getAvailableTokens]);
  
  // Set default tokens
  useEffect(() => {
    if (availableTokens.length > 0 && !fromToken) {
      const solToken = availableTokens.find(t => t.symbol === 'SOL');
      const usdcToken = availableTokens.find(t => t.symbol === 'USDC');
      
      if (solToken) setFromToken(solToken);
      if (usdcToken) setToToken(usdcToken);
    }
  }, [availableTokens, fromToken]);
  
  // Auto-fetch quote when inputs change
  useEffect(() => {
    if (quoteTimer) {
      clearTimeout(quoteTimer);
    }
    
    if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0) {
      const timer = setTimeout(() => {
        fetchQuote();
      }, 500); // Debounce for 500ms
      
      setQuoteTimer(timer);
    } else {
      setQuote(null);
      setToAmount('');
    }
    
    return () => {
      if (quoteTimer) clearTimeout(quoteTimer);
    };
  }, [fromToken, toToken, fromAmount, slippage]);
  
  const fetchQuote = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      return;
    }
    
    try {
      setIsLoading(true);
      const amountInSmallestUnit = parseFloat(fromAmount) * Math.pow(10, fromToken.decimals);
      const slippageBps = Math.floor(slippage * 100); // Convert percentage to basis points
      
      const quoteResponse = await jupiterSwap.getQuote(
        fromToken.mint,
        toToken.mint,
        amountInSmallestUnit.toString(),
        slippageBps
      );
      
      setQuote(quoteResponse);
      
      // Calculate output amount from the last market info
      const lastMarketInfo = quoteResponse.marketInfos[quoteResponse.marketInfos.length - 1];
      const outputAmount = parseFloat(lastMarketInfo.outAmount) / Math.pow(10, toToken.decimals);
      setToAmount(outputAmount.toFixed(6));
      
      } catch (error) {
      if (__DEV__) console.error('Error fetching quote:', error);
      Alert.alert('Error', 'Failed to fetch swap quote. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSwap = async () => {
    if (!wallet || !publicKey || !quote || !fromToken || !toToken) {
      Alert.alert('Error', 'Missing required data for swap');
      return;
    }
    
    try {
      setIsSwapping(true);
      
      // Get swap transaction
      const swapResponse = await jupiterSwap.getSwapTransaction(quote, publicKey);
      
      // Note: executeSwap would need to be implemented with proper transaction signing
      // For now, this is a placeholder that shows the intended flow
      Alert.alert(
        'Swap Ready',
        'Swap transaction prepared. In production, this would execute the swap.',
        [{ text: 'OK' }]
      );
      
      // Reset form
      setFromAmount('');
      setToAmount('');
      setQuote(null);
      return;
      
      // TODO: Implement actual swap execution when ready
      // const signature = await connection.sendTransaction(...);
      const signature = 'mock-signature';
      
      Alert.alert(
        'Swap Successful!',
        `Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        [
          {
            text: 'View on Explorer',
            onPress: () => {
              // Open Solana Explorer (would need Linking for web)
              if (__DEV__) console.log(`https://explorer.solana.com/tx/${signature}`);
            }
          },
          { text: 'OK' }
        ]
      );
      
      // Reset form
      setFromAmount('');
      setToAmount('');
      setQuote(null);
      
      // Refresh balances
      await refreshBalances();
      
    } catch (error) {
      if (__DEV__) console.error('Swap error:', error);
      Alert.alert('Swap Failed', error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsSwapping(false);
    }
  };
  
  const handleTokenSelect = (token: Token) => {
    if (selectingFor === 'from') {
      setFromToken(token);
      // If selecting the same token as 'to', swap them
      if (toToken && token.mint === toToken.mint) {
        setToToken(fromToken);
      }
    } else {
      setToToken(token);
      // If selecting the same token as 'from', swap them
      if (fromToken && token.mint === fromToken.mint) {
        setFromToken(toToken);
      }
    }
    setShowTokenSelector(false);
  };
  
  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };
  
  const handleMaxAmount = () => {
    if (fromToken) {
      setFromAmount(fromToken.balance.toString());
    }
  };
  
  const renderTokenSelector = () => {
    const filteredTokens = availableTokens.filter(token => {
      if (selectingFor === 'from') {
        return toToken ? token.mint !== toToken.mint : true;
      } else {
        return fromToken ? token.mint !== fromToken.mint : true;
      }
    });
    
    return (
      <Modal
        visible={showTokenSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTokenSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Token</Text>
            <TouchableOpacity
              onPress={() => setShowTokenSelector(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={filteredTokens}
            keyExtractor={(item) => item.mint}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.tokenItem}
                onPress={() => handleTokenSelect(item)}
              >
                <View style={styles.tokenInfo}>
                  {item.logo && (
                    <Image source={{ uri: item.logo }} style={styles.tokenLogo} />
                  )}
                  <View style={styles.tokenDetails}>
                    <Text style={styles.tokenSymbol}>{item.symbol}</Text>
                    <Text style={styles.tokenName}>{item.name}</Text>
                  </View>
                </View>
                <Text style={styles.tokenBalance}>{item.balance.toFixed(6)}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    );
  };
  
  const renderSettingsModal = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Swap Settings</Text>
          <TouchableOpacity
            onPress={() => setShowSettings(false)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.settingsContent}>
          <Text style={styles.settingLabel}>Slippage Tolerance</Text>
          <View style={styles.slippageOptions}>
            {[0.1, 0.5, 1.0, 3.0].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.slippageOption,
                  slippage === value && styles.slippageOptionActive
                ]}
                onPress={() => setSlippage(value)}
              >
                <Text style={[
                  styles.slippageOptionText,
                  slippage === value && styles.slippageOptionTextActive
                ]}>
                  {value}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.customSlippageContainer}>
            <Text style={styles.settingLabel}>Custom Slippage (%)</Text>
            <TextInput
              style={styles.customSlippageInput}
              value={slippage.toString()}
              onChangeText={(text) => {
                const value = parseFloat(text);
                if (!isNaN(value) && value >= 0 && value <= 50) {
                  setSlippage(value);
                }
              }}
              keyboardType="numeric"
              placeholder="0.5"
              placeholderTextColor="#666"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
  
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;
  const priceImpactColor = priceImpact > 5 ? '#ff4444' : priceImpact > 1 ? '#ffaa00' : '#00ff88';
  
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Swap',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
              <Settings size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <NeonCard style={styles.swapCard}>
          {/* From Token */}
          <View style={styles.tokenSection}>
            <View style={styles.tokenHeader}>
              <Text style={styles.tokenLabel}>From</Text>
              {fromToken && (
                <TouchableOpacity onPress={handleMaxAmount}>
                  <Text style={styles.maxButton}>MAX</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.tokenInputContainer}>
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => {
                  setSelectingFor('from');
                  setShowTokenSelector(true);
                }}
              >
                {fromToken ? (
                  <View style={styles.selectedToken}>
                    {fromToken.logo && (
                      <Image source={{ uri: fromToken.logo }} style={styles.tokenIcon} />
                    )}
                    <Text style={styles.tokenSymbolText}>{fromToken.symbol}</Text>
                    <ChevronDown size={16} color="#666" />
                  </View>
                ) : (
                  <View style={styles.selectTokenPlaceholder}>
                    <Text style={styles.selectTokenText}>Select Token</Text>
                    <ChevronDown size={16} color="#666" />
                  </View>
                )}
              </TouchableOpacity>
              
              <TextInput
                style={styles.amountInput}
                value={fromAmount}
                onChangeText={setFromAmount}
                placeholder="0.0"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
            
            {fromToken && (
              <Text style={styles.balanceText}>
                Balance: {fromToken.balance.toFixed(6)} {fromToken.symbol}
              </Text>
            )}
          </View>
          
          {/* Swap Button */}
          <View style={styles.swapButtonContainer}>
            <TouchableOpacity
              style={styles.swapButton}
              onPress={handleSwapTokens}
              disabled={!fromToken || !toToken}
            >
              <ArrowUpDown size={20} color="#00ff88" />
            </TouchableOpacity>
          </View>
          
          {/* To Token */}
          <View style={styles.tokenSection}>
            <Text style={styles.tokenLabel}>To</Text>
            
            <View style={styles.tokenInputContainer}>
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => {
                  setSelectingFor('to');
                  setShowTokenSelector(true);
                }}
              >
                {toToken ? (
                  <View style={styles.selectedToken}>
                    {toToken.logo && (
                      <Image source={{ uri: toToken.logo }} style={styles.tokenIcon} />
                    )}
                    <Text style={styles.tokenSymbolText}>{toToken.symbol}</Text>
                    <ChevronDown size={16} color="#666" />
                  </View>
                ) : (
                  <View style={styles.selectTokenPlaceholder}>
                    <Text style={styles.selectTokenText}>Select Token</Text>
                    <ChevronDown size={16} color="#666" />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.outputAmountContainer}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#00ff88" />
                ) : (
                  <Text style={styles.outputAmount}>{toAmount || '0.0'}</Text>
                )}
              </View>
            </View>
            
            {toToken && (
              <Text style={styles.balanceText}>
                Balance: {toToken.balance.toFixed(6)} {toToken.symbol}
              </Text>
            )}
          </View>
        </NeonCard>
        
        {/* Quote Information */}
        {quote && (
          <NeonCard style={styles.quoteCard}>
            <View style={styles.quoteHeader}>
              <Info size={16} color="#00ff88" />
              <Text style={styles.quoteTitle}>Swap Details</Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Price Impact</Text>
              <Text style={[styles.quoteValue, { color: priceImpactColor }]}>
                {priceImpact.toFixed(2)}%
              </Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Slippage Tolerance</Text>
              <Text style={styles.quoteValue}>{slippage}%</Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Minimum Received</Text>
              <Text style={styles.quoteValue}>
                {(parseFloat(quote.otherAmountThreshold) / Math.pow(10, toToken?.decimals || 6)).toFixed(6)} {toToken?.symbol}
              </Text>
            </View>
          </NeonCard>
        )}
        
        {/* Swap Button */}
        <NeonButton
          title={isSwapping ? 'Swapping...' : 'Swap'}
          onPress={handleSwap}
          disabled={!wallet || !quote || isLoading || isSwapping || !fromAmount || parseFloat(fromAmount) <= 0}
          style={styles.swapActionButton}
        />
        
        {!wallet && (
          <Text style={styles.walletWarning}>
            Please connect your wallet to start swapping
          </Text>
        )}
      </ScrollView>
      
      {renderTokenSelector()}
      {renderSettingsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    padding: 8,
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  swapCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00ff88' + '40',
  },
  tokenSection: {
    marginBottom: 16,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  maxButton: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: 'bold',
    padding: 4,
  },
  tokenInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 60,
  },
  tokenSelector: {
    minWidth: 120,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    height: 60,
  },
  selectedToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  selectTokenPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectTokenText: {
    color: '#666',
    fontSize: 16,
  },
  tokenIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  tokenSymbolText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  amountInput: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    fontSize: 18,
    textAlign: 'left',
    height: 60,
  },
  outputAmountContainer: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: 60,
  },
  outputAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  balanceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  swapButton: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  quoteCard: {
    marginBottom: 16,
    padding: 16,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quoteTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quoteLabel: {
    color: '#888',
    fontSize: 14,
  },
  quoteValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  swapActionButton: {
    marginTop: 8,
  },
  walletWarning: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tokenDetails: {
    gap: 2,
  },
  tokenSymbol: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tokenName: {
    color: '#888',
    fontSize: 12,
  },
  tokenBalance: {
    color: '#888',
    fontSize: 14,
  },
  settingsContent: {
    padding: 16,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  slippageOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  slippageOption: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  slippageOptionActive: {
    borderColor: '#00ff88',
    backgroundColor: '#001a0f',
  },
  slippageOptionText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  slippageOptionTextActive: {
    color: '#00ff88',
  },
  customSlippageContainer: {
    gap: 8,
  },
  customSlippageInput: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    fontSize: 16,
  },
});