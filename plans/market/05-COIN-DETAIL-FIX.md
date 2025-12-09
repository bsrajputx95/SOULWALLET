# Coin Detail Page Fix

## Current Problem

The coin detail page uses entirely mock data:

```typescript
// app/coin/[symbol].tsx - Lines 230-260
const loadCoinData = useCallback(async () => {
  const mockCoinData: CoinData = {
    symbol: symbol?.toUpperCase() || 'SOL',
    price: Math.random() * 1000,  // FAKE!
    change24h: (Math.random() - 0.5) * 20,  // FAKE!
    marketCap: Math.random() * 1000000000,  // FAKE!
    ...
  };
```

## Solution

### 1. Add Backend Endpoint

```typescript
// src/server/routers/market.ts - Add getTokenDetails

getTokenDetails: protectedProcedure
  .input(z.object({ 
    symbol: z.string().min(1).max(20),
    address: z.string().optional(),
  }))
  .query(async ({ input }) => {
    try {
      // Search for token by symbol
      const searchResult = await marketData.search(input.symbol);
      
      if (!searchResult.pairs || searchResult.pairs.length === 0) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: 'Token not found' 
        });
      }

      // Find best match (Solana, highest liquidity)
      const solanaPairs = searchResult.pairs.filter(
        (p: any) => p.chainId === 'solana'
      );
      
      const pair = solanaPairs.length > 0 
        ? solanaPairs.sort((a: any, b: any) => 
            parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
          )[0]
        : searchResult.pairs[0];

      return {
        // Basic Info
        address: pair.baseToken?.address || '',
        symbol: pair.baseToken?.symbol || input.symbol,
        name: pair.baseToken?.name || 'Unknown',
        decimals: pair.baseToken?.decimals || 9,
        logo: pair.info?.imageUrl,
        
        // Price Data
        price: parseFloat(pair.priceUsd || '0'),
        priceChange1h: parseFloat(pair.priceChange?.h1 || '0'),
        priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
        priceChange7d: parseFloat(pair.priceChange?.d7 || '0'),
        
        // Market Data
        marketCap: parseFloat(pair.marketCap || '0'),
        fdv: parseFloat(pair.fdv || '0'),
        volume24h: parseFloat(pair.volume?.h24 || '0'),
        liquidity: parseFloat(pair.liquidity?.usd || '0'),
        
        // Transaction Data
        txns24h: {
          buys: pair.txns?.h24?.buys || 0,
          sells: pair.txns?.h24?.sells || 0,
          total: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
        },
        
        // Metadata
        website: pair.info?.websites?.[0] || null,
        twitter: pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url || null,
        telegram: pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url || null,
        description: pair.info?.description || null,
        
        // Verification
        verified: pair.info?.verified || false,
        pairAge: pair.pairCreatedAt 
          ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) 
          : null,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        chainId: pair.chainId,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('getTokenDetails error:', error);
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to fetch token details' 
      });
    }
  }),
```

### 2. Update Coin Detail Screen

```typescript
// app/coin/[symbol].tsx

import { trpc } from '../../lib/trpc';

export default function CoinDetailsScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  
  // Fetch real data
  const { 
    data: coinData, 
    isLoading, 
    error, 
    refetch 
  } = trpc.market.getTokenDetails.useQuery(
    { symbol: symbol?.toUpperCase() || '' },
    { 
      enabled: !!symbol,
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.solana} />
        <Text style={styles.loadingText}>Loading {symbol}...</Text>
      </View>
    );
  }

  // Error state
  if (error || !coinData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Token Not Found</Text>
        <Text style={styles.errorText}>
          Could not find data for {symbol}
        </Text>
        <NeonButton 
          title="Go Back" 
          onPress={() => router.back()} 
        />
      </View>
    );
  }

  // Rest of component uses coinData from API
  // ...
}
```

### 3. Add Transaction History Endpoint

```typescript
// src/server/routers/market.ts

getTokenTransactions: protectedProcedure
  .input(z.object({
    pairAddress: z.string(),
    limit: z.number().min(1).max(100).default(50),
  }))
  .query(async ({ input }) => {
    try {
      // DexScreener doesn't provide transaction history directly
      // We would need to use Solana RPC or a service like Helius
      
      // For now, return empty with a note
      return {
        transactions: [],
        note: 'Transaction history requires Helius/Solana RPC integration',
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch transactions',
      });
    }
  }),
```

### 4. Fix Trade Modal

```typescript
// app/coin/[symbol].tsx - Complete trade modal

const [tradeModalVisible, setTradeModalVisible] = useState(false);
const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
const [tradeAmount, setTradeAmount] = useState('');
const [tradeSlippage, setTradeSlippage] = useState('0.5');

const { wallet, publicKey } = useSolanaWallet();
const swapMutation = trpc.swap.swap.useMutation();

const handleTrade = async () => {
  if (!coinData || !tradeAmount || !publicKey) {
    Alert.alert('Error', 'Please enter an amount and connect wallet');
    return;
  }

  const amount = parseFloat(tradeAmount);
  if (isNaN(amount) || amount <= 0) {
    Alert.alert('Error', 'Please enter a valid amount');
    return;
  }

  try {
    // For buy: SOL -> Token
    // For sell: Token -> SOL
    const fromMint = tradeMode === 'buy' 
      ? 'So11111111111111111111111111111111111111112' // SOL
      : coinData.address;
    const toMint = tradeMode === 'buy'
      ? coinData.address
      : 'So11111111111111111111111111111111111111112';

    const result = await swapMutation.mutateAsync({
      fromMint,
      toMint,
      amount,
      slippage: parseFloat(tradeSlippage),
    });

    Alert.alert(
      'Trade Submitted',
      `${tradeMode === 'buy' ? 'Bought' : 'Sold'} ${amount} ${coinData.symbol}\nTx: ${result.signature.slice(0, 8)}...`,
      [{ text: 'OK', onPress: () => setTradeModalVisible(false) }]
    );
  } catch (error: any) {
    Alert.alert('Trade Failed', error.message || 'Unknown error');
  }
};

// Trade Modal JSX
<Modal visible={tradeModalVisible} transparent animationType="fade">
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>
          {tradeMode === 'buy' ? 'Buy' : 'Sell'} {coinData?.symbol}
        </Text>
        <TouchableOpacity onPress={() => setTradeModalVisible(false)}>
          <X size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, tradeMode === 'buy' && styles.modeButtonActive]}
          onPress={() => setTradeMode('buy')}
        >
          <Text style={[styles.modeText, tradeMode === 'buy' && styles.modeTextActive]}>
            Buy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, tradeMode === 'sell' && styles.modeButtonActive]}
          onPress={() => setTradeMode('sell')}
        >
          <Text style={[styles.modeText, tradeMode === 'sell' && styles.modeTextActive]}>
            Sell
          </Text>
        </TouchableOpacity>
      </View>

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Amount ({tradeMode === 'buy' ? 'SOL' : coinData?.symbol})
        </Text>
        <TextInput
          style={styles.input}
          value={tradeAmount}
          onChangeText={setTradeAmount}
          placeholder="0.00"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="numeric"
        />
      </View>

      {/* Slippage */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Slippage (%)</Text>
        <View style={styles.slippageRow}>
          {['0.5', '1.0', '2.0', '5.0'].map(val => (
            <TouchableOpacity
              key={val}
              style={[
                styles.slippageChip,
                tradeSlippage === val && styles.slippageChipActive
              ]}
              onPress={() => setTradeSlippage(val)}
            >
              <Text style={styles.slippageText}>{val}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Estimate */}
      {tradeAmount && coinData && (
        <View style={styles.estimate}>
          <Text style={styles.estimateLabel}>Estimated:</Text>
          <Text style={styles.estimateValue}>
            {tradeMode === 'buy'
              ? `~${(parseFloat(tradeAmount) / coinData.price).toFixed(4)} ${coinData.symbol}`
              : `~${(parseFloat(tradeAmount) * coinData.price).toFixed(4)} SOL`
            }
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <NeonButton
        title={swapMutation.isLoading ? 'Processing...' : `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${coinData?.symbol}`}
        onPress={handleTrade}
        disabled={swapMutation.isLoading || !tradeAmount}
      />

      {!publicKey && (
        <Text style={styles.walletWarning}>
          Connect wallet to trade
        </Text>
      )}
    </View>
  </View>
</Modal>
```

## Testing Checklist

1. [ ] Token details load from API
2. [ ] Price updates every 30 seconds
3. [ ] Error state shows for invalid tokens
4. [ ] Loading state shows while fetching
5. [ ] Trade modal opens correctly
6. [ ] Buy/sell mode toggle works
7. [ ] Amount input validates
8. [ ] Slippage selection works
9. [ ] Trade executes successfully
10. [ ] Wallet connection required message shows
