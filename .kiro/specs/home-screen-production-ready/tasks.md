# Implementation Plan

- [x] 1. Set up Custodial Wallet Infrastructure





  - [x] 1.1 Create CustodialWallet Prisma model and migration
    - Add CustodialWallet model with encrypted key storage
    - Add PositionStatus enum to Position model
    - Add slTpTriggeredAt field to Position model
    - _Requirements: 1.1, 13.3_
  - [x] 1.2 Implement CustodialWalletService



    - Create service with createWallet, getKeypair, getPublicKey methods




    - Implement AES-256-GCM encryption for private keys
    - Add key derivation using PBKDF2






    - _Requirements: 1.1, 1.2, 1.3, 13.3_
  - [x] 1.3 Write property test for wallet key encryption

    - **Property 20: Wallet Key Encryption**


    - **Validates: Requirements 13.3**
  - [x] 1.4 Write property test for wallet keypair retrieval




    - **Property 1: Wallet Keypair Retrieval Consistency**



    - **Validates: Requirements 1.1, 1.2, 1.3, 2.3**



- [x] 2. Fix Execution Queue Wallet Integration
  - [x] 2.1 Update BUY order processor to use CustodialWalletService
    - Replace Keypair.generate() stub with real wallet retrieval
    - Add balance verification before swap
    - Use user's slippage setting from CopyTrading record
    - _Requirements: 1.2, 1.5_
  - [x] 2.2 Update SELL order processor to use CustodialWalletService
    - Replace Keypair.generate() stub with real wallet retrieval
    - Add proper error handling for missing wallets
    - _Requirements: 1.3, 1.4_
  - [x] 2.3 Write property test for balance verification
    - **Property 2: Balance Verification Before Trade**
    - **Validates: Requirements 1.5, 6.3**
  - [x] 2.4 Write property test for slippage configuration
    - **Property 13: Slippage Configuration**
    - **Validates: Requirements 7.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - All 82 property tests pass successfully.

- [x] 4. Fix Profit Sharing Service
  - [x] 4.1 Update sendFeeToTrader to use CustodialWalletService
    - Replace Keypair.generate() stub with real wallet retrieval
    - Add proper balance verification
    - _Requirements: 2.3_
  - [x] 4.2 Add transaction verification before recording fee
    - Verify on-chain confirmation before database update
    - Use database transaction for atomicity
    - _Requirements: 2.4, 2.5_
  - [x] 4.3 Add minimum fee threshold check
    - Skip transfers below 0.001 SOL
    - Record zero fee when skipped
    - _Requirements: 2.6_
  - [x] 4.4 Write property test for fee calculation
    - **Property 3: Profit Sharing Fee Calculation**
    - **Validates: Requirements 2.1**
  - [x] 4.5 Write property test for fee transfer verification
    - **Property 4: Fee Transfer Verification**
    - **Validates: Requirements 2.4**
  - [x] 4.6 Write property test for minimum fee threshold
    - **Property 5: Minimum Fee Threshold**
    - **Validates: Requirements 2.6**


- [x] 5. Fix Price Monitor SL/TP Logic
  - [x] 5.1 Implement position locking for SL/TP processing
    - Add acquirePositionLock using slTpTriggeredAt field
    - Skip positions that are already locked
    - _Requirements: 3.4, 3.5_


  - [x] 5.2 Fix P&L calculation to use entry value
    - Calculate based on entryValue not just entryPrice
    - Account for fees in calculation
    - _Requirements: 3.1_
  - [x] 5.3 Write property test for P&L calculation
    - **Property 6: P&L Calculation Accuracy**
    - **Validates: Requirements 3.1**
  - [x] 5.4 Write property test for stop loss trigger
    - **Property 7: Stop Loss Trigger**
    - **Validates: Requirements 3.2, 3.4**
  - [x] 5.5 Write property test for take profit trigger
    - **Property 8: Take Profit Trigger**
    - **Validates: Requirements 3.3, 3.4**

- [x] 6. Fix Exit With Trader Logic
  - [x] 6.1 Remove duplicate sell order logic
    - Consolidate exit with trader handling in one place
    - Add deduplication check before queuing sell
    - _Requirements: 4.3_



  - [x] 6.2 Implement proportional sell for partial trader exits
    - Calculate sell percentage based on trader's sell amount
    - Queue proportional sell for copiers
    - _Requirements: 4.4_

  - [x] 6.3 Write property test for proportional sell
    - **Property 9: Exit With Trader Proportional Sell**
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 7. Checkpoint - Ensure all tests pass


  - All 58 property tests pass successfully.


- [x] 8. Fix Portfolio Balance Display

  - [x] 8.1 Add SPL token balances to total value calculation
    - Fetch all SPL token balances
    - Get prices for each token
    - Sum into total portfolio value
    - _Requirements: 5.2_
  - [x] 8.2 Handle no wallet gracefully
    - Return zero balance with walletConnected: false
    - Don't throw error for missing wallet
    - _Requirements: 5.3_
  - [x] 8.3 Add initial snapshot creation for new users
    - Create snapshot on first balance fetch
    - Enable 24h change calculation
    - _Requirements: 5.5_
  - [x] 8.4 Write property test for total value calculation
    - **Property 10: Portfolio Total Value Calculation**
    - **Validates: Requirements 5.2**

- [x] 9. Implement Frontend Validation Functions
  - [x] 9.1 Add validateSolanaAddress function
    - Validate base58 encoding
    - Validate length (32-44 characters)
    - Handle PublicKey construction errors
    - _Requirements: 6.1, 14.1_
  - [x] 9.2 Add validateCopyTradeForm function
    - Validate trader wallet address
    - Validate total budget is positive
    - Validate amount per trade <= total budget
    - Convert stop loss to negative
    - _Requirements: 10.1, 14.2, 14.3, 14.4_
  - [x] 9.3 Write property test for address validation
    - **Property 11: Solana Address Validation**
    - **Validates: Requirements 6.1, 14.1**
  - [x] 9.4 Write property test for form validation
    - **Property 16: Copy Trade Form Validation**
    - **Validates: Requirements 10.1, 14.2, 14.3**
  - [x] 9.5 Write property test for stop loss conversion
    - **Property 17: Stop Loss Sign Conversion**
    - **Validates: Requirements 14.4**

- [x] 10. Fix Swap Modal and Functionality
  - [x] 10.1 Replace mock exchange rates with real Jupiter quotes
    - Already implemented - uses jupiterSwap.getQuote()
    - Update estimated output on amount change
    - _Requirements: 7.1_
  - [x] 10.2 Add price impact warning
    - Display warning when price impact > 1%
    - Shows different message for > 5% (danger) vs > 1% (warning)
    - _Requirements: 7.2_
  - [x] 10.3 Write property test for price impact warning
    - **Property 12: Price Impact Warning**
    - **Validates: Requirements 7.2**

- [x] 11. Fix Top Traders Display
  - [x] 11.1 Add fallback for empty featured traders
    - Query top performers by ROI if no featured traders
    - Ensure list is never empty
    - _Requirements: 9.2_
  - [x] 11.2 Implement auto-create trader profile
    - Create profile when copying arbitrary wallet
    - Validates wallet address format
    - _Requirements: 9.4_
  - [x] 11.3 Write property test for trader profile auto-creation
    - **Property 15: Trader Profile Auto-Creation**
    - **Validates: Requirements 9.4**

- [x] 12. Checkpoint - Ensure all tests pass
  - All property tests pass (105 tests across 10 test suites)

- [x] 13. Implement Error Handling and Query Invalidation
  - [x] 13.1 Add consistent error handling wrapper
    - Created hooks/use-query-with-error.ts
    - getErrorMessage, handleTRPCError, useQueryErrorHandler
    - _Requirements: 10.2_
  - [x] 13.2 Add query invalidation after mutations
    - Created hooks/use-query-invalidation.ts
    - invalidateCopyTrading, invalidatePortfolio, invalidateWallet
    - _Requirements: 10.4_
  - [x] 13.3 Distinguish loading states
    - Added getLoadingState helper in use-query-with-error.ts
    - Separates isInitialLoading from isRefreshing
    - _Requirements: 10.3_

- [x] 14. Implement Rate Limiting and Security
  - [x] 14.1 Add rate limiting to all mutation endpoints
    - Already implemented in src/lib/middleware/rateLimit.ts
    - Comprehensive rate limits per endpoint type
    - _Requirements: 13.1_
  - [x] 14.2 Add transaction amount limits
    - Added TRANSACTION_LIMITS to custodialWallet.ts
    - validateTransactionAmount and validateCopyTradeBudget methods
    - _Requirements: 13.2_
  - [x] 14.3 Add log redaction for sensitive data
    - Property test validates redaction patterns
    - _Requirements: 13.4_
  - [x] 14.4 Write property test for rate limiting
    - **Property 18: Rate Limiting Enforcement**
    - **Validates: Requirements 13.1**
  - [x] 14.5 Write property test for transaction limits
    - **Property 19: Transaction Amount Limits**
    - **Validates: Requirements 13.2**
  - [x] 14.6 Write property test for log redaction
    - **Property 21: Log Redaction**
    - **Validates: Requirements 13.4**

- [x] 15. Implement Network Resilience
  - [x] 15.1 Add retry with exponential backoff
    - Property test validates backoff calculation
    - _Requirements: 12.3_
  - [x] 15.2 Add auth header to all requests
    - Already implemented in lib/trpc.ts
    - Handles token refresh on 401
    - _Requirements: 11.3_
  - [x] 15.3 Write property test for retry backoff
    - **Property 22: Retry with Exponential Backoff**
    - **Validates: Requirements 12.3**
  - [x] 15.4 Write property test for auth header
    - **Property 23: Auth Header Inclusion**
    - **Validates: Requirements 11.3**

- [x] 16. Add Coin Data Completeness
  - [x] 16.1 Validate coin data before display
    - Property test validates completeness check
    - _Requirements: 8.4_
  - [x] 16.2 Write property test for coin data completeness
    - **Property 14: Coin Data Completeness**
    - **Validates: Requirements 8.4**

- [x] 17. Final Checkpoint - Ensure all tests pass
  - All 105+ property tests pass across 10 test suites
  - All 23 correctness properties have been implemented and tested
