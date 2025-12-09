# Implementation Plan

- [x] 1. Add Custodial Wallet API Endpoints




  - [ ] 1.1 Add setupCustodialWallet endpoint to copyTradingRouter
    - Create custodial wallet for user if not exists


    - Return public key for deposits
    - _Requirements: 1.1, 1.2_


  - [x] 1.2 Add getCustodialBalance endpoint to copyTradingRouter




    - Fetch SOL and USDC balance from Solana RPC
    - Return formatted balance data
    - _Requirements: 1.3_
  - [x] 1.3 Write property test for custodial wallet encryption round-trip

    - **Property 1: Custodial Wallet Encryption Round-Trip**
    - **Validates: Requirements 1.1**



- [x] 2. Initialize Copy Trading Services on Server Startup



  - [ ] 2.1 Add service initialization to src/server/index.ts
    - Initialize custodialWalletService

    - Start transactionMonitor
    - Start priceMonitor

    - Add graceful shutdown handlers
    - _Requirements: 9.1, 9.2_
  - [x] 2.2 Add feature flag check for copy trading


    - Only start services if COPY_TRADING_ENABLED=true



    - _Requirements: 9.1_


- [ ] 3. Checkpoint - Ensure backend services start correctly
  - Ensure all tests pass, ask the user if questions arise.





- [x] 4. Add Validation Property Tests



  - [ ] 4.1 Write property test for wallet address validation
    - **Property 3: Wallet Address Validation**
    - **Validates: Requirements 2.1**
  - [x] 4.2 Write property test for budget constraint validation

    - **Property 2: Budget Constraint Validation**
    - **Validates: Requirements 2.2**
  - [ ] 4.3 Write property test for SL/TP range validation
    - **Property 5: Stop-Loss Range Validation**

    - **Property 6: Take-Profit Range Validation**
    - **Validates: Requirements 3.1, 3.2**
  - [ ] 4.4 Write property test for transaction limit enforcement
    - **Property 11: Transaction Limit Enforcement**

    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 5. Add Business Logic Property Tests


  - [x] 5.1 Write property test for P&L calculation



    - **Property 7: P&L Calculation Correctness**
    - **Validates: Requirements 4.2**
  - [x] 5.2 Write property test for profit sharing calculation

    - **Property 9: Profit Sharing Calculation**
    - **Validates: Requirements 5.4**
  - [x] 5.3 Write property test for proportional exit calculation




    - **Property 10: Proportional Exit Calculation**
    - **Validates: Requirements 6.2**

- [ ] 6. Checkpoint - Ensure all property tests pass
  - Ensure all tests pass, ask the user if questions arise.



- [ ] 7. Update Frontend Copy Trading UI
  - [ ] 7.1 Add custodial wallet setup flow to home screen
    - Show deposit address when no custodial wallet
    - Display custodial balance
    - Validate sufficient balance before copying
    - _Requirements: 1.2, 1.3, 1.4_
  - [ ] 7.2 Update copy trading modal with real API calls
    - Connect to startCopying mutation
    - Show loading and error states
    - Validate inputs before submission
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 7.3 Add open positions display with real-time P&L
    - Fetch from getOpenPositions query
    - Display current price and unrealized P&L
    - Add manual close button
    - _Requirements: 4.1, 4.2, 5.1, 5.2_
  - [ ] 7.4 Add copy trading statistics display
    - Fetch from getStats query
    - Show win rate, total trades, net profit
    - _Requirements: 4.4_

- [ ] 8. Checkpoint - Ensure frontend compiles without errors
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Add Balance Check Before Copy Trading
  - [ ] 9.1 Add balance validation to startCopying endpoint
    - Check custodial wallet USDC balance
    - Return error if insufficient for totalBudget
    - _Requirements: 1.4_
  - [ ] 9.2 Add balance check to execution queue before buy
    - Verify USDC balance before executing swap
    - Skip order if insufficient balance
    - _Requirements: 1.4_

- [ ] 10. Final Integration Testing
  - [ ] 10.1 Verify copy trading flow end-to-end
    - Create custodial wallet
    - Start copying a trader
    - Verify position creation on detected trade
    - Verify SL/TP triggers
    - Verify profit sharing on close
    - _Requirements: All_

- [ ] 11. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
