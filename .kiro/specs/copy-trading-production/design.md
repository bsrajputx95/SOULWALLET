# Copy Trading Production Design

## Overview

This design document describes the architecture for making SoulWallet's copy trading feature 100% production-ready. The core infrastructure is already implemented - this focuses on integration, frontend updates, and production hardening.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                     COPY TRADING ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FRONTEND (React Native)                                            │
│  ├── Home Tab: Copy Trading UI, Position Cards                      │
│  ├── Trader Discovery: Top Traders List                             │
│  └── Portfolio: Copied Wallets Tab                                  │
│                                                                     │
│  BACKEND SERVICES                                                   │
│  ├── copyTradingRouter: tRPC endpoints                              │
│  ├── CustodialWalletService: Encrypted wallet management            │
│  ├── TransactionMonitor: Helius WebSocket for trader detection      │
│  ├── ExecutionQueue: Bull queue for trade execution                 │
│  ├── PriceMonitor: 5-second SL/TP checking                          │
│  └── ProfitSharing: 5% fee on profitable trades                     │
│                                                                     │
│  EXTERNAL SERVICES                                                  │
│  ├── Helius: WebSocket + RPC                                        │
│  ├── Jupiter: Swap quotes and execution                             │
│  └── Redis: Bull queue backend                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```


## Components and Interfaces

### 1. Custodial Wallet Setup Flow

```typescript
// Frontend: app/(tabs)/index.tsx - Copy Trading Setup
interface CopyTradingSetup {
  hasCustodialWallet: boolean;
  custodialWalletAddress: string | null;
  custodialBalance: number;
  depositRequired: number;
}

// Backend: copyTradingRouter.setupCustodialWallet
// Creates encrypted wallet, returns deposit address
```

### 2. Copy Trading Router Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `startCopying` | Create copy relationship | ✅ Implemented |
| `stopCopying` | Pause copying (keep positions) | ✅ Implemented |
| `updateSettings` | Modify SL/TP/budget | ✅ Implemented |
| `getMyCopyTrades` | List user's copy relationships | ✅ Implemented |
| `getOpenPositions` | List open positions with P&L | ✅ Implemented |
| `closePosition` | Manual position close | ✅ Implemented |
| `getStats` | Win rate, total profit | ✅ Implemented |
| `getTopTraders` | Featured traders list | ✅ Implemented |
| `setupCustodialWallet` | Create user's copy wallet | 🔧 To Add |
| `getCustodialBalance` | Get wallet balance | 🔧 To Add |

### 3. Service Initialization

```typescript
// src/server/index.ts - Service startup
async function initializeCopyTradingServices() {
  // Initialize custodial wallet encryption
  custodialWalletService.initialize();
  
  // Start transaction monitoring (Helius WebSocket)
  await transactionMonitor.start();
  
  // Start price monitoring (5-second loop)
  await priceMonitor.start();
  
  logger.info('Copy trading services initialized');
}
```

## Data Models

### Existing Models (Already in Prisma)

- `CopyTrading`: User-trader relationship with settings
- `Position`: Individual trade positions with P&L
- `TraderProfile`: Trader stats and metadata
- `MonitoredWallet`: Wallets tracked via WebSocket
- `CustodialWallet`: Encrypted server-side wallets
- `ExecutionQueue`: Trade queue records
- `DetectedTransaction`: Trader transactions detected

### Key Relationships

```
User (1) ──── (N) CopyTrading (N) ──── (1) TraderProfile
                    │
                    └── (N) Position
                    
User (1) ──── (1) CustodialWallet

TraderProfile (1) ──── (1) MonitoredWallet
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Custodial Wallet Encryption Round-Trip
*For any* user, creating a custodial wallet and then retrieving the keypair should produce a valid Solana keypair where the public key matches the stored address.
**Validates: Requirements 1.1**

### Property 2: Budget Constraint Validation
*For any* copy trading settings, amountPerTrade must not exceed totalBudget, and the system should reject invalid configurations.
**Validates: Requirements 2.2**

### Property 3: Wallet Address Validation
*For any* string input, the system should correctly identify valid Solana base58 addresses (32-44 characters, valid base58 charset) and reject invalid ones.
**Validates: Requirements 2.1**

### Property 4: Duplicate Copy Prevention
*For any* user attempting to copy the same trader twice, the second attempt should fail or reactivate the existing relationship, never creating duplicates.
**Validates: Requirements 2.5**

### Property 5: Stop-Loss Range Validation
*For any* stop-loss input, values outside the range [-100, 0] should be rejected.
**Validates: Requirements 3.1**

### Property 6: Take-Profit Range Validation
*For any* take-profit input, values outside the range (0, 1000] should be rejected.
**Validates: Requirements 3.2**

### Property 7: P&L Calculation Correctness
*For any* position with entry value E and current value C, unrealized P&L should equal (C - E) and percentage should equal ((C - E) / E) * 100.
**Validates: Requirements 4.2**

### Property 8: Position Ownership Verification
*For any* position close request, the system should only allow the owning user to close their positions.
**Validates: Requirements 5.1**

### Property 9: Profit Sharing Calculation
*For any* closed position with profit P > 0, the fee amount should equal P * 0.05 (5%).
**Validates: Requirements 5.4**

### Property 10: Proportional Exit Calculation
*For any* trader partial sell of X% of their position, copiers with exitWithTrader enabled should sell X% of their position.
**Validates: Requirements 6.2**

### Property 11: Transaction Limit Enforcement
*For any* transaction amount exceeding the configured limits, the system should reject the transaction.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 12: Retry Behavior
*For any* failed trade execution, the system should retry up to 3 times with exponential backoff delays.
**Validates: Requirements 9.4**

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| Insufficient balance | Return clear error with required amount |
| Invalid wallet address | Reject with validation error |
| WebSocket disconnect | Auto-reconnect after 5 seconds |
| Jupiter quote failure | Retry 3x, then fail with error |
| Transaction timeout | Retry with higher priority fee |
| Position already closed | Return idempotent success |
| Duplicate copy attempt | Return existing relationship |

## Testing Strategy

### Property-Based Testing (fast-check)

The following properties will be tested using fast-check:
- Wallet address validation (Property 3)
- Budget constraint validation (Property 2)
- SL/TP range validation (Properties 5, 6)
- P&L calculation (Property 7)
- Profit sharing calculation (Property 9)
- Proportional exit calculation (Property 10)
- Transaction limit enforcement (Property 11)

### Unit Tests

- Custodial wallet encryption/decryption
- Jupiter swap quote parsing
- Position lock acquisition
- Stats aggregation

### Integration Tests

- Full copy trading flow (setup → detect → execute → close)
- Profit sharing end-to-end
- WebSocket reconnection
