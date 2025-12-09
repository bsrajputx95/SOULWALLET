# Requirements Document

## Introduction

This document specifies the requirements for making the SoulWallet Home Screen production-ready, secure, and industry-standard. The home screen is the flagship feature containing copy trading functionality - the core differentiator of the app. Based on a comprehensive audit, critical security vulnerabilities and functionality gaps have been identified that must be addressed before deployment.

## Glossary

- **Copy Trading**: Feature allowing users to automatically replicate trades made by selected traders
- **Profit Sharing**: 5% fee deducted from profitable copy trades and sent to the trader
- **SL (Stop Loss)**: Automatic position closure when losses reach a specified percentage
- **TP (Take Profit)**: Automatic position closure when gains reach a specified percentage
- **Exit With Trader**: Option to automatically close positions when the copied trader sells
- **Execution Queue**: Bull queue system for processing copy trade orders
- **Position**: An open or closed copy trade representing token holdings
- **Custodial Wallet**: Server-managed wallet for executing copy trades on behalf of users

## Requirements

### Requirement 1: Wallet Signing for Copy Trade Execution

**User Story:** As a copy trader, I want my copy trades to execute automatically when the trader I'm copying makes a trade, so that I can replicate their strategy without manual intervention.

#### Acceptance Criteria

1. WHEN a copy trade is triggered THEN the Execution_Queue SHALL retrieve the user's valid wallet keypair for transaction signing
2. WHEN the Execution_Queue processes a BUY order THEN the system SHALL sign the Jupiter swap transaction with the user's actual wallet
3. WHEN the Execution_Queue processes a SELL order THEN the system SHALL sign the Jupiter swap transaction with the user's actual wallet
4. IF the user's wallet keypair is unavailable THEN the system SHALL fail the trade with a descriptive error and notify the user
5. WHEN executing a copy trade THEN the system SHALL verify the user has sufficient balance before attempting the swap


### Requirement 2: Profit Sharing Fee Transfer

**User Story:** As a trader being copied, I want to receive 5% of the profits from users who copy my trades, so that I am compensated for my trading expertise.

#### Acceptance Criteria

1. WHEN a copy trade position closes with positive profit THEN the Profit_Sharing_Service SHALL calculate 5% of the profit as the fee
2. WHEN calculating the fee THEN the Profit_Sharing_Service SHALL convert the USDC fee amount to SOL using real-time Jupiter pricing
3. WHEN transferring the fee THEN the Profit_Sharing_Service SHALL sign the transaction with the user's actual wallet keypair
4. WHEN the fee transfer transaction is submitted THEN the system SHALL verify on-chain confirmation before recording the fee as paid
5. IF the fee transfer fails THEN the system SHALL NOT record the fee as paid and SHALL log the failure for retry
6. IF the calculated fee is below 0.001 SOL THEN the system SHALL skip the transfer and record zero fee to avoid transaction costs exceeding the fee amount

### Requirement 3: Stop Loss and Take Profit Execution

**User Story:** As a copy trader, I want my positions to automatically close when they hit my stop loss or take profit levels, so that I can manage risk without constant monitoring.

#### Acceptance Criteria

1. WHEN the Price_Monitor checks a position THEN the system SHALL calculate the current P&L percentage based on entry value and current price
2. WHEN the P&L percentage falls to or below the stop loss threshold THEN the Price_Monitor SHALL trigger a sell order for the position
3. WHEN the P&L percentage rises to or above the take profit threshold THEN the Price_Monitor SHALL trigger a sell order for the position
4. WHEN a SL/TP condition is detected THEN the system SHALL acquire a position lock to prevent duplicate sell orders
5. IF a position is already being processed for SL/TP THEN the system SHALL skip processing that position

### Requirement 4: Exit With Trader Functionality

**User Story:** As a copy trader, I want the option to automatically exit my positions when the trader I'm copying sells, so that I can follow their complete trading strategy.

#### Acceptance Criteria

1. WHEN a monitored trader executes a SELL transaction THEN the Transaction_Monitor SHALL detect and parse the sell details
2. WHEN a trader sell is detected AND the copier has exitWithTrader enabled THEN the system SHALL queue sell orders for matching open positions
3. WHEN processing exit with trader THEN the system SHALL prevent duplicate sell orders from being queued
4. WHEN the trader sells a partial amount THEN the system SHALL calculate and execute a proportional sell for the copier

### Requirement 5: Balance Display and Loading

**User Story:** As a wallet user, I want to see my accurate total balance including all tokens, so that I know my complete portfolio value.

#### Acceptance Criteria

1. WHEN loading the portfolio overview THEN the Portfolio_Service SHALL fetch SOL balance from Solana RPC
2. WHEN calculating total value THEN the Portfolio_Service SHALL include SPL token balances with their current USD values
3. WHEN the user has no linked wallet THEN the system SHALL return zero balance with a walletConnected flag set to false
4. IF the price API fails THEN the system SHALL use the last cached price and indicate price staleness to the user
5. WHEN displaying 24-hour change THEN the system SHALL create an initial snapshot for new users on first balance fetch


### Requirement 6: Send Transaction Functionality

**User Story:** As a wallet user, I want to send SOL and SPL tokens to other addresses securely, so that I can transfer my assets.

#### Acceptance Criteria

1. WHEN a user initiates a send THEN the system SHALL validate the recipient address is a valid Solana public key
2. WHEN sending tokens THEN the system SHALL simulate the transaction before execution to catch errors
3. WHEN sending tokens THEN the system SHALL verify the user has sufficient balance including transaction fees
4. WHEN a send transaction completes THEN the system SHALL record the transaction in the database with signature and details
5. IF the transaction fails THEN the system SHALL display a descriptive error message to the user

### Requirement 7: Swap Functionality

**User Story:** As a wallet user, I want to swap between tokens using real market rates, so that I can exchange my assets efficiently.

#### Acceptance Criteria

1. WHEN displaying swap estimates THEN the system SHALL fetch real quotes from Jupiter API instead of mock rates
2. WHEN the price impact exceeds 1% THEN the system SHALL display a warning to the user before proceeding
3. WHEN executing a swap THEN the system SHALL use the user's configured slippage tolerance
4. WHEN a swap completes THEN the system SHALL record the transaction with input and output token details

### Requirement 8: Top Coins Display

**User Story:** As a user, I want to see trending coins with real market data, so that I can discover trading opportunities.

#### Acceptance Criteria

1. WHEN loading trending coins THEN the Market_Service SHALL fetch data from real market APIs
2. WHEN the market API fails THEN the system SHALL display an error state with retry option
3. WHEN searching for coins THEN the system SHALL support single-character searches for short symbols
4. WHEN displaying coin data THEN the system SHALL show price, 24h change, and volume

### Requirement 9: Top Traders Display

**User Story:** As a user, I want to see top-performing traders with real performance data, so that I can choose who to copy.

#### Acceptance Criteria

1. WHEN loading top traders THEN the Traders_Service SHALL fetch real PnL data from Birdeye API
2. IF no featured traders exist THEN the system SHALL fall back to displaying top performers by ROI
3. WHEN the Birdeye API fails THEN the system SHALL display cached data with a staleness indicator
4. WHEN a user wants to copy an arbitrary wallet THEN the system SHALL auto-create a trader profile if one does not exist


### Requirement 10: Frontend Validation and Error Handling

**User Story:** As a user, I want clear validation feedback and error messages, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN submitting a copy trade form THEN the system SHALL validate all required fields before submission
2. WHEN an API call fails THEN the system SHALL display a user-friendly error message with retry option
3. WHEN data is loading THEN the system SHALL distinguish between initial load and background refresh states
4. WHEN a mutation succeeds THEN the system SHALL invalidate related queries to refresh stale data

### Requirement 11: Authentication and Token Management

**User Story:** As a user, I want my session to remain active without frequent re-authentication, so that I have a seamless experience.

#### Acceptance Criteria

1. WHEN the access token is about to expire THEN the system SHALL automatically refresh it using the refresh token
2. IF the refresh token is invalid THEN the system SHALL redirect the user to the login screen
3. WHEN making API requests THEN the system SHALL include the current valid access token in headers
4. WHEN the user logs out THEN the system SHALL invalidate both access and refresh tokens

### Requirement 12: Offline Support and Network Handling

**User Story:** As a user, I want the app to handle network issues gracefully, so that I don't lose data or see confusing errors.

#### Acceptance Criteria

1. WHEN the device goes offline THEN the system SHALL display an offline indicator
2. WHEN offline THEN the system SHALL show cached data where available
3. WHEN network requests fail THEN the system SHALL retry with exponential backoff up to 3 attempts
4. WHEN the device comes back online THEN the system SHALL automatically refresh stale data

### Requirement 13: Security and Rate Limiting

**User Story:** As a platform operator, I want to protect the system from abuse and ensure secure transactions, so that users' funds are safe.

#### Acceptance Criteria

1. WHEN processing mutations THEN the system SHALL apply rate limiting to prevent abuse
2. WHEN executing transactions THEN the system SHALL enforce configurable amount limits
3. WHEN storing sensitive data THEN the system SHALL encrypt wallet keys at rest
4. WHEN logging requests THEN the system SHALL redact sensitive information like private keys and tokens

### Requirement 14: Copy Trade Form Validation

**User Story:** As a user setting up copy trading, I want clear validation of my inputs, so that I don't make configuration errors.

#### Acceptance Criteria

1. WHEN entering a trader wallet address THEN the system SHALL validate it is a valid Solana public key of at least 32 characters
2. WHEN entering total budget THEN the system SHALL validate it is a positive number
3. WHEN entering amount per trade THEN the system SHALL validate it is positive and does not exceed total budget
4. WHEN entering stop loss THEN the system SHALL convert positive input to negative percentage for storage
5. IF validation fails THEN the system SHALL display specific error messages for each invalid field
