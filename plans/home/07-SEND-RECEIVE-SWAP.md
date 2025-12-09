# Send, Receive & Swap Functionality Audit

## Overview
Audit of the core wallet transaction features: sending tokens, receiving tokens, and swapping between tokens.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSACTION FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SEND FLOW                                                      │
│  ─────────                                                      │
│  Frontend (send-receive.tsx)                                    │
│      │                                                          │
│      ├─> Validate address & amount                              │
│      ├─> useSolanaWallet.sendSol() or sendToken()               │
│      │       └─> Simulate transaction                           │
│      │       └─> Sign with user's keypair                       │
│      │       └─> Send via RPC                                   │
│      │       └─> Wait for confirmation                          │
│      └─> trpc.wallet.recordTransaction()                        │
│              └─> Store in database                              │
│                                                                 │
│  RECEIVE FLOW                                                   │
│  ────────────                                                   │
│  Frontend (send-receive.tsx)                                    │
│      │                                                          │
│      ├─> Display wallet address                                 │
│      ├─> Generate QR code                                       │
│      └─> Copy/Share address                                     │
│                                                                 │
│  SWAP FLOW                                                      │
│  ─────────                                                      │
│  Frontend (swap.tsx)                                            │
│      │                                                          │
│      ├─> Get quote from Jupiter                                 │
│      ├─> Display estimated output                               │
│      ├─> useSolanaWallet.executeSwap()                          │
│      │       └─> Sign transaction                               │
│      │       └─> Send via RPC                                   │
│      └─> Record transaction                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Send Implementation

### 2.1 Frontend (`app/send-receive.tsx`)

#### ✅ Working Correctly
- Address validation (length, characters)
- Amount validation
- Token selection dropdown
- Balance check before send
- Transaction simulation
- Confirmation modal
- Success/error feedback

#### Code Flow
```typescript
const handleSend = async () => {
  // Feature flag check
  if (!flags?.sendEnabled || !flags?.simulationMode) {
    Alert.alert('Send Disabled', 'Sending is disabled in this environment.');
    return;
  }

  // Validation
  if (!validateSendForm() || !wallet || !selectedToken) return;

  // Execute send
  if (selectedToken.symbol === 'SOL') {
    signature = await sendSol(sendAddress, amount);
  } else {
    signature = await sendToken(sendAddress, amount, selectedToken.mint, selectedToken.decimals);
  }

  // Record in database
  await recordTransactionMutation.mutateAsync({
    signature,
    type: 'SEND',
    amount: parseFloat(sendAmount),
    token: selectedToken.mint,
    tokenSymbol: selectedToken.symbol,
    to: sendAddress,
    from: publicKey || undefined,
  });
};
```

### 2.2 Solana Wallet Store (`hooks/solana-wallet-store.ts`)

#### sendSol Implementation
```typescript
const sendSol = async (toAddress: string, amount: number): Promise<string> => {
  // Create transaction
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: state.wallet.publicKey,
      toPubkey: toPublicKey,
      lamports,
    })
  );
  
  // SIMULATE FIRST
  const simulation = await simulateTransaction(transaction);
  if (!simulation.success) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }
  
  // Check balance
  const fee = await estimateTransactionFee(transaction);
  const required = (lamports + fee) / LAMPORTS_PER_SOL;
  if (state.balance < required) {
    throw new Error(`Insufficient balance. Required: ${required} SOL`);
  }
  
  // Send with timeout
  const signature = await Promise.race([
    sendAndConfirmTransaction(connection, transaction, [state.wallet]),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60000))
  ]);
  
  // Wait for finalization
  await waitForFinalization(signature);
  await refreshBalances();
  
  return signature;
};
```

#### sendToken Implementation
```typescript
const sendToken = async (toAddress: string, amount: number, tokenMint: string, decimals: number) => {
  // Get token accounts
  const sourceTokenAccount = await getAssociatedTokenAddress(mintPublicKey, wallet.publicKey);
  const destinationTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);
  
  // Check if destination account exists
  let destinationExists = true;
  try {
    await getAccount(connection, destinationTokenAccount);
  } catch {
    destinationExists = false;
    // Add create account instruction
    transaction.add(createAssociatedTokenAccountInstruction(...));
  }
  
  // Add transfer instruction
  transaction.add(createTransferInstruction(...));
  
  // Simulate, check balance, send
  // ...
};
```

### 2.3 Issues Found

#### 🟠 High Priority

##### 2.3.1 Feature Flags Not Loaded on Mount
```typescript
const { data: flags } = trpc.system.getFeatureFlags.useQuery();
```
**ISSUE**: Button shows "Disabled" briefly before flags load

**FIX**: Add loading state or default to enabled

##### 2.3.2 No Retry on Network Failure
```typescript
const signature = await sendAndConfirmTransaction(...);
```
**FIX**: Add retry with exponential backoff

##### 2.3.3 60-Second Timeout May Be Too Short
```typescript
setTimeout(() => reject(new Error('Timeout')), 60000)
```
**ISSUE**: During network congestion, transactions can take longer

**FIX**: Make configurable, show progress indicator

#### 🟡 Medium Priority

##### 2.3.4 No Transaction History Link
**FIX**: After success, show link to view on Solscan

##### 2.3.5 No Recent Recipients
**FIX**: Show recently sent-to addresses for quick selection

---

## 3. Receive Implementation

### 3.1 Frontend (`app/send-receive.tsx`)

#### ✅ Working Correctly
- QR code generation with `react-native-qrcode-svg`
- Address display
- Copy to clipboard
- Share functionality (with web fallback)

#### Code
```typescript
const renderReceiveTab = () => {
  const walletAddress = publicKey || user?.walletAddress || 'No wallet connected';

  return (
    <View>
      {/* QR Code */}
      <QRCode
        value={walletAddress}
        size={200}
        logo={require('../assets/icon.png')}
      />
      
      {/* Address */}
      <Text selectable>{walletAddress}</Text>
      
      {/* Actions */}
      <TouchableOpacity onPress={handleCopyAddress}>Copy</TouchableOpacity>
      <TouchableOpacity onPress={handleShareAddress}>Share</TouchableOpacity>
    </View>
  );
};
```

### 3.2 Issues Found

#### 🟡 Medium Priority

##### 3.2.1 No Amount Request Feature
**FIX**: Allow user to specify amount in QR code:
```typescript
const solanaPayUrl = `solana:${walletAddress}?amount=${amount}&label=SoulWallet`;
```

##### 3.2.2 No Token-Specific QR
**FIX**: Generate Solana Pay URL with SPL token parameter

##### 3.2.3 No Incoming Transaction Notifications
**FIX**: Poll for new transactions or use WebSocket

---

## 4. Swap Implementation

### 4.1 Home Screen Modal (Basic)
```typescript
// In index.tsx - just redirects to swap screen
const handleSwap = () => {
  router.push('/swap');
};
```

### 4.2 Dedicated Swap Screen (`app/swap.tsx`)
**NOTE**: Need to verify this file exists and review implementation

### 4.3 Jupiter Integration (`services/jupiter-swap.ts`)

#### Frontend Service
```typescript
class JupiterSwapService {
  private readonly baseUrl = 'https://quote-api.jup.ag/v6';
  
  async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
    const response = await fetch(`${this.baseUrl}/quote?${params}`);
    return response.json();
  }
  
  async getSwapTransaction(route, userPublicKey) {
    const response = await fetch(`${this.baseUrl}/swap`, {
      method: 'POST',
      body: JSON.stringify({
        quoteResponse: route,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: { priorityLevel: "veryHigh" }
      })
    });
    return response.json();
  }
}
```

### 4.4 Backend Service (`src/lib/services/jupiterSwap.ts`)

```typescript
class JupiterSwap {
  async getQuote(params: QuoteRequest): Promise<QuoteResponse | null> {
    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.append('inputMint', params.inputMint);
    url.searchParams.append('outputMint', params.outputMint);
    url.searchParams.append('amount', params.amount.toString());
    url.searchParams.append('slippageBps', (params.slippageBps || 100).toString());
    
    const response = await fetch(url.toString());
    return response.json();
  }
  
  async executeSwap(params: SwapRequest): Promise<string> {
    const swapResponse = await this.getSwapTransaction({...});
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([wallet]);
    return await this.sendTransaction(transaction);
  }
}
```

### 4.5 Issues Found

#### 🟠 High Priority

##### 4.5.1 Home Screen Swap Modal Uses Mock Rates
```typescript
// In index.tsx
const mockRate = fromToken === 'SOL' ? 150 : 0.0067;
const estimated = (parseFloat(swapAmount) * mockRate).toFixed(2);
```
**FIX**: Fetch real quote from Jupiter before displaying

##### 4.5.2 No Price Impact Warning
**FIX**: Show warning if price impact > 1%:
```typescript
if (parseFloat(quote.priceImpactPct) > 1) {
  Alert.alert('High Price Impact', `This swap has ${quote.priceImpactPct}% price impact`);
}
```

##### 4.5.3 No Route Display
**FIX**: Show swap route (e.g., "SOL → USDC via Raydium")

#### 🟡 Medium Priority

##### 4.5.4 Slippage Not Persisted
```typescript
const [slippage, setSlippage] = useState(0.5);
```
**FIX**: Save to user preferences

##### 4.5.5 No Swap History
**FIX**: Show recent swaps with rates

---

## 5. Backend Wallet Router (`src/server/routers/wallet.ts`)

### 5.1 Endpoints Available
- `estimateFee` - Calculate transaction fee
- `getBalance` - Get SOL balance
- `getTokens` - Get all token balances
- `linkWallet` - Link wallet with signature verification
- `verifyWallet` - Verify wallet ownership
- `getWalletInfo` - Get linked wallet info
- `getRecentIncoming` - Get recent received transactions
- `generateReceiveQR` - Generate Solana Pay URL
- `getTokenMetadata` - Get token info
- `recordTransaction` - Record completed transaction

### 5.2 Issues Found

#### 🟠 High Priority

##### 5.2.1 Send Endpoint Commented Out
```typescript
/* send: protectedProcedure... */
```
**STATUS**: Intentional - frontend handles signing
**VERIFICATION**: Ensure `recordTransaction` is always called after client-side sends

##### 5.2.2 No Swap Recording Endpoint
**FIX**: Add dedicated swap recording with input/output tokens

---

## 6. Security Considerations

### ✅ Good Practices
1. Transaction simulation before send
2. Balance verification before send
3. Signature verification for wallet linking
4. Feature flags for enabling/disabling

### 🟠 Improvements Needed

#### 6.1 Rate Limiting on Transactions
**FIX**: Add rate limit to prevent spam:
```typescript
// Max 10 transactions per minute
await applyRateLimit('transaction', ctx.rateLimitContext);
```

#### 6.2 Transaction Amount Limits
**FIX**: Add configurable limits:
```typescript
const MAX_SINGLE_TRANSACTION = 1000; // SOL
if (amount > MAX_SINGLE_TRANSACTION) {
  throw new Error('Transaction exceeds maximum limit');
}
```

#### 6.3 Suspicious Activity Detection
**FIX**: Flag unusual patterns:
- Multiple large transactions in short time
- Transactions to known scam addresses
- Unusual token transfers

---

## 7. Testing Checklist

### Send Tests
- [ ] Send SOL to valid address
- [ ] Send SOL to invalid address → error
- [ ] Send more than balance → error
- [ ] Send SPL token
- [ ] Send to address without token account → creates account
- [ ] Network timeout → proper error handling
- [ ] Transaction recorded in database

### Receive Tests
- [ ] QR code generates correctly
- [ ] Address copies to clipboard
- [ ] Share works on mobile
- [ ] Share fallback works on web

### Swap Tests
- [ ] Quote fetches correctly
- [ ] Slippage applied correctly
- [ ] Swap executes successfully
- [ ] High price impact warning shown
- [ ] Transaction recorded

---

## 8. Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| 🟠 | Real quotes in home swap modal | 2hr |
| 🟠 | Price impact warning | 1hr |
| 🟠 | Transaction retry logic | 2hr |
| 🟠 | Rate limiting | 2hr |
| 🟡 | Amount request in QR | 2hr |
| 🟡 | Recent recipients | 3hr |
| 🟡 | Swap history | 3hr |
| 🟡 | Transaction limits | 2hr |
| 🟡 | Incoming notifications | 4hr |

**Total Estimated Effort: ~21 hours**
