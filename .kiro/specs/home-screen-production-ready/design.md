# Design Document: Home Screen Production Ready

## Overview

This design document outlines the architecture and implementation approach for making the SoulWallet Home Screen production-ready. The primary focus is on fixing critical security vulnerabilities in the copy trading system, implementing proper wallet signing, and ensuring robust error handling throughout the application.

## Architecture

The home screen system consists of several interconnected layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Home Screen │  │ Wallet Store│  │ Solana Store│                 │
│  │ (index.tsx) │  │             │  │             │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         │                │                │                         │
│         └────────────────┼────────────────┘                         │
│                          │                                          │
│                    ┌─────▼─────┐                                    │
│                    │ tRPC Client│                                   │
│                    └─────┬─────┘                                    │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────────┐
│                    BACKEND LAYER                                    │
│                    ┌─────▼─────┐                                    │
│                    │ tRPC Router│                                   │
│                    └─────┬─────┘                                    │
│         ┌────────────────┼────────────────┐                         │
│   ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐                  │
│   │ Portfolio │    │Copy Trading│    │  Wallet   │                  │
│   │  Router   │    │   Router   │    │  Router   │                  │
│   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘                  │
│         │                │                │                         │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
┌─────────┼────────────────┼────────────────┼─────────────────────────┐
│                    SERVICE LAYER                                    │
│   ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐                  │
│   │  Market   │    │ Execution │    │  Wallet   │                  │
│   │  Data     │    │   Queue   │    │  Service  │                  │
│   └───────────┘    └─────┬─────┘    └─────┬─────┘                  │
│                          │                │                         │
│                    ┌─────▼─────┐    ┌─────▼─────┐                  │
│                    │  Profit   │    │  Custodial│                  │
│                    │  Sharing  │    │  Wallet   │                  │
│                    └───────────┘    └───────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Custodial Wallet Service (New Component)

The critical missing piece is a secure wallet management system for server-side transaction signing.

```typescript
interface CustodialWalletService {
  // Create a new custodial wallet for a user
  createWallet(userId: string): Promise<{ publicKey: string }>;
  
  // Get user's wallet keypair for signing (internal use only)
  getKeypair(userId: string): Promise<Keypair | null>;
  
  // Get user's public key
  getPublicKey(userId: string): Promise<string | null>;
  
  // Check wallet balance
  getBalance(userId: string): Promise<number>;
  
  // Sign and send a transaction
  signAndSend(userId: string, transaction: Transaction): Promise<string>;
}
```


### 2. Execution Queue Service (Enhanced)

```typescript
interface ExecutionQueueService {
  // Add buy order with proper wallet integration
  addBuyOrder(data: BuyOrderData): Promise<string>;
  
  // Add sell order with proper wallet integration
  addSellOrder(data: SellOrderData): Promise<string>;
  
  // Process buy with real wallet signing
  processBuyOrder(job: BuyOrderData): Promise<ExecutionResult>;
  
  // Process sell with real wallet signing
  processSellOrder(job: SellOrderData): Promise<ExecutionResult>;
}

interface BuyOrderData {
  userId: string;
  copyTradingId: string;
  tokenMint: string;
  amount: number;
  detectedTxId: string;
  priority?: number;
}

interface ExecutionResult {
  success: boolean;
  txHash?: string;
  positionId?: string;
  error?: string;
}
```

### 3. Profit Sharing Service (Enhanced)

```typescript
interface ProfitSharingService {
  // Process profit sharing with real wallet signing
  processProfitSharing(positionId: string): Promise<ProfitSharingResult>;
  
  // Verify transaction on-chain before recording
  verifyTransaction(signature: string): Promise<boolean>;
}

interface ProfitSharingResult {
  success: boolean;
  feeAmount?: number;
  feeTxHash?: string;
  skipped?: boolean;
  error?: string;
}
```

### 4. Price Monitor Service (Enhanced)

```typescript
interface PriceMonitorService {
  // Check positions with locking
  checkAllPositions(): Promise<void>;
  
  // Acquire position lock before processing
  acquirePositionLock(positionId: string): Promise<boolean>;
  
  // Release position lock
  releasePositionLock(positionId: string): Promise<void>;
}
```

### 5. Frontend Validation Utilities

```typescript
interface ValidationUtils {
  // Validate Solana address
  validateSolanaAddress(address: string): boolean;
  
  // Validate copy trade form
  validateCopyTradeForm(data: CopyTradeFormData): ValidationResult;
}

interface CopyTradeFormData {
  traderWallet: string;
  totalBudget: string;
  amountPerTrade: string;
  stopLoss?: string;
  takeProfit?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
```

## Data Models

### Position Model (Enhanced)

```prisma
model Position {
  id              String    @id @default(cuid())
  copyTradingId   String
  tokenMint       String
  tokenSymbol     String
  tokenName       String?
  entryTxHash     String
  entryPrice      Float
  entryAmount     Float
  entryValue      Float
  entryTimestamp  DateTime  @default(now())
  exitTxHash      String?
  exitPrice       Float?
  exitAmount      Float?
  exitValue       Float?
  exitTimestamp   DateTime?
  exitReason      String?
  profitLoss      Float?
  profitLossPercent Float?
  feeAmount       Float?
  feeTxHash       String?
  status          PositionStatus @default(OPEN)
  slTpTriggeredAt DateTime?  // NEW: Lock flag for SL/TP processing
  
  copyTrading     CopyTrading @relation(fields: [copyTradingId], references: [id])
  
  @@index([copyTradingId])
  @@index([status])
  @@index([tokenMint])
}

enum PositionStatus {
  OPEN
  CLOSING
  CLOSED
  FAILED
}
```

### CustodialWallet Model (New)

```prisma
model CustodialWallet {
  id              String   @id @default(cuid())
  userId          String   @unique
  publicKey       String   @unique
  encryptedKey    String   // AES-256-GCM encrypted private key
  keyVersion      Int      @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id])
  
  @@index([publicKey])
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified. Redundant properties have been consolidated.

### Property 1: Wallet Keypair Retrieval Consistency

*For any* user with a custodial wallet, when the execution queue retrieves their keypair, the keypair's public key SHALL match the user's stored public key.

**Validates: Requirements 1.1, 1.2, 1.3, 2.3**

### Property 2: Balance Verification Before Trade

*For any* copy trade execution attempt, if the user's balance is less than the required amount plus fees, the system SHALL reject the trade with an insufficient balance error.

**Validates: Requirements 1.5, 6.3**

### Property 3: Profit Sharing Fee Calculation

*For any* closed position with positive profit, the calculated fee SHALL equal exactly 5% of the profit amount.

**Validates: Requirements 2.1**

### Property 4: Fee Transfer Verification

*For any* profit sharing fee transfer, the fee SHALL only be recorded in the database after on-chain transaction confirmation succeeds.

**Validates: Requirements 2.4**

### Property 5: Minimum Fee Threshold

*For any* calculated fee that converts to less than 0.001 SOL, the system SHALL skip the transfer and record zero fee amount.

**Validates: Requirements 2.6**

### Property 6: P&L Calculation Accuracy

*For any* position with entry price E and current price C, the P&L percentage SHALL equal ((C - E) / E) * 100.

**Validates: Requirements 3.1**

### Property 7: Stop Loss Trigger

*For any* open position where the P&L percentage is less than or equal to the stop loss threshold, the price monitor SHALL trigger exactly one sell order.

**Validates: Requirements 3.2, 3.4**

### Property 8: Take Profit Trigger

*For any* open position where the P&L percentage is greater than or equal to the take profit threshold, the price monitor SHALL trigger exactly one sell order.

**Validates: Requirements 3.3, 3.4**

### Property 9: Exit With Trader Proportional Sell

*For any* trader partial sell of X%, copiers with exitWithTrader enabled SHALL have sell orders queued for X% of their position amount.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 10: Portfolio Total Value Calculation

*For any* set of token balances B and corresponding prices P, the total portfolio value SHALL equal the sum of (B[i] * P[i]) for all tokens.

**Validates: Requirements 5.2**

### Property 11: Solana Address Validation

*For any* string input, the address validation function SHALL return true if and only if the string is a valid base58-encoded Solana public key of 32-44 characters.

**Validates: Requirements 6.1, 14.1**

### Property 12: Price Impact Warning

*For any* swap quote with price impact greater than 1%, the system SHALL display a warning to the user.

**Validates: Requirements 7.2**

### Property 13: Slippage Configuration

*For any* swap execution, the slippage parameter sent to Jupiter SHALL match the user's configured slippage tolerance.

**Validates: Requirements 7.3**

### Property 14: Coin Data Completeness

*For any* coin displayed in the trending list, the data object SHALL contain non-null values for price, 24h change percentage, and volume.

**Validates: Requirements 8.4**

### Property 15: Trader Profile Auto-Creation

*For any* valid Solana wallet address submitted for copy trading, if no trader profile exists, the system SHALL create one before proceeding.

**Validates: Requirements 9.4**

### Property 16: Copy Trade Form Validation

*For any* copy trade form submission, the validation SHALL reject if: trader wallet is invalid, total budget is not positive, or amount per trade exceeds total budget.

**Validates: Requirements 10.1, 14.2, 14.3**

### Property 17: Stop Loss Sign Conversion

*For any* positive stop loss input value V, the stored value SHALL be -|V| (negative).

**Validates: Requirements 14.4**

### Property 18: Rate Limiting Enforcement

*For any* sequence of N mutations within time window T, if N exceeds the rate limit, subsequent mutations SHALL be rejected until the window resets.

**Validates: Requirements 13.1**

### Property 19: Transaction Amount Limits

*For any* transaction with amount A, if A exceeds the configured maximum limit, the transaction SHALL be rejected.

**Validates: Requirements 13.2**

### Property 20: Wallet Key Encryption

*For any* custodial wallet stored in the database, the private key field SHALL be encrypted and not readable as plaintext.

**Validates: Requirements 13.3**

### Property 21: Log Redaction

*For any* log entry, the output SHALL NOT contain private keys, access tokens, or refresh tokens in plaintext.

**Validates: Requirements 13.4**

### Property 22: Retry with Exponential Backoff

*For any* failed network request, the retry delays SHALL follow exponential backoff pattern: delay(n) = min(baseDelay * 2^n, maxDelay) for attempts 1 through 3.

**Validates: Requirements 12.3**

### Property 23: Auth Header Inclusion

*For any* authenticated API request, the request headers SHALL include a valid Bearer token in the Authorization header.

**Validates: Requirements 11.3**


## Error Handling

### Backend Error Handling Strategy

```typescript
// Standardized error codes
enum ErrorCode {
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  POSITION_LOCKED = 'POSITION_LOCKED',
  TRADER_NOT_FOUND = 'TRADER_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

// Error response structure
interface ServiceError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}
```

### Frontend Error Handling

```typescript
// Global error handler for tRPC
const handleTRPCError = (error: TRPCClientError) => {
  switch (error.data?.code) {
    case 'UNAUTHORIZED':
      // Attempt token refresh, then redirect to login if failed
      break;
    case 'BAD_REQUEST':
      // Show validation error to user
      break;
    case 'TOO_MANY_REQUESTS':
      // Show rate limit message with retry time
      break;
    default:
      // Log to Sentry and show generic error
      break;
  }
};
```

### Transaction Error Recovery

1. **Failed Copy Trade Execution**: Mark ExecutionQueue record as FAILED, increment retry counter, re-queue if under max attempts
2. **Failed Profit Sharing**: Do not record fee, log for manual review, retry on next position close
3. **Failed SL/TP Trigger**: Release position lock, retry on next price check cycle

## Testing Strategy

### Unit Testing Framework

- **Framework**: Jest with TypeScript
- **Mocking**: jest-mock-extended for service mocks
- **Coverage Target**: 80% for critical services

### Property-Based Testing Framework

- **Framework**: fast-check
- **Configuration**: Minimum 100 iterations per property
- **Focus Areas**: Validation functions, calculations, state transitions

### Test Categories

#### 1. Unit Tests
- Validation functions (address, form inputs)
- Fee calculations
- P&L calculations
- Data transformations

#### 2. Property-Based Tests
- All 23 correctness properties listed above
- Each property test tagged with: `**Feature: home-screen-production-ready, Property {N}: {description}**`

#### 3. Integration Tests
- Copy trade flow end-to-end
- Profit sharing flow
- SL/TP trigger flow
- API endpoint responses

### Test File Structure

```
__tests__/
├── unit/
│   ├── validation.test.ts
│   ├── calculations.test.ts
│   └── transformations.test.ts
├── property/
│   ├── wallet-keypair.property.test.ts
│   ├── fee-calculation.property.test.ts
│   ├── pnl-calculation.property.test.ts
│   ├── validation.property.test.ts
│   └── rate-limiting.property.test.ts
└── integration/
    ├── copy-trading.test.ts
    ├── profit-sharing.test.ts
    └── price-monitor.test.ts
```

### Mocking Strategy

- **Solana RPC**: Mock Connection class for balance/transaction queries
- **Jupiter API**: Mock quote and swap responses
- **Birdeye API**: Mock trader PnL data
- **Redis/Bull**: Use bull-mock for queue testing
- **Prisma**: Use prisma-mock or in-memory SQLite

## Security Considerations

### Wallet Key Storage

1. **Encryption**: AES-256-GCM with unique IV per key
2. **Key Derivation**: PBKDF2 with 100,000 iterations from master secret
3. **Master Secret**: Stored in environment variable, rotatable
4. **Access Control**: Only CustodialWalletService can decrypt keys

### Rate Limiting Configuration

```typescript
const rateLimits = {
  copyTrading: { window: 60000, max: 10 },  // 10 per minute
  transactions: { window: 60000, max: 20 }, // 20 per minute
  queries: { window: 60000, max: 100 },     // 100 per minute
};
```

### Transaction Limits

```typescript
const transactionLimits = {
  maxSingleSend: 100,      // 100 SOL
  maxDailySend: 1000,      // 1000 SOL
  maxCopyBudget: 10000,    // 10000 USDC
  maxPerTrade: 1000,       // 1000 USDC
};
```

## Implementation Notes

### Custodial Wallet Migration

For existing users without custodial wallets:
1. Create custodial wallet on first copy trade attempt
2. Prompt user to fund the custodial wallet
3. Display both linked wallet and custodial wallet in UI

### Position Locking Implementation

```typescript
// Use database field for locking
const acquireLock = async (positionId: string): Promise<boolean> => {
  const result = await prisma.position.updateMany({
    where: {
      id: positionId,
      slTpTriggeredAt: null,
      status: 'OPEN',
    },
    data: {
      slTpTriggeredAt: new Date(),
    },
  });
  return result.count > 0;
};
```

### Query Invalidation Pattern

```typescript
// After successful mutation
const utils = trpc.useUtils();

const createCopyTrade = trpc.copyTrading.startCopying.useMutation({
  onSuccess: () => {
    utils.copyTrading.getMyCopyTrades.invalidate();
    utils.copyTrading.getStats.invalidate();
    utils.portfolio.getOverview.invalidate();
  },
});
```
