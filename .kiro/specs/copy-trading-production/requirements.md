# Requirements Document

## Introduction

This document specifies the requirements for making the SoulWallet copy trading feature 100% production-ready. The core infrastructure (custodial wallets, execution queue, price monitoring, profit sharing) is already implemented. This spec focuses on the remaining integration work, frontend polish, and production hardening.

## Glossary

- **Copy Trading System**: The automated system that mirrors trades from followed traders to copier wallets
- **Custodial Wallet**: Server-side encrypted wallet used for automated trade execution
- **Execution Queue**: Bull queue system for processing buy/sell orders with retry logic
- **Price Monitor**: Service that checks positions every 5 seconds for SL/TP conditions
- **Transaction Monitor**: WebSocket service that detects trader swaps via Helius
- **Profit Sharing**: 5% fee on profitable trades sent to the trader

## Requirements

### Requirement 1

**User Story:** As a user, I want to set up a custodial wallet for copy trading, so that the system can execute trades on my behalf automatically.

#### Acceptance Criteria

1. WHEN a user enables copy trading for the first time THEN the system SHALL create a custodial wallet with AES-256-GCM encrypted private key
2. WHEN a custodial wallet is created THEN the system SHALL display the deposit address to the user
3. WHEN a user views their copy trading settings THEN the system SHALL show the custodial wallet balance
4. WHEN a user attempts to start copying without sufficient balance THEN the system SHALL display an error with the required deposit amount

### Requirement 2

**User Story:** As a user, I want to start copying a trader by entering their wallet address, so that I can mirror their trades automatically.

#### Acceptance Criteria

1. WHEN a user enters a valid Solana wallet address THEN the system SHALL validate the address format using base58 regex
2. WHEN a user submits copy trading settings THEN the system SHALL validate that amountPerTrade does not exceed totalBudget
3. WHEN a user starts copying a new trader THEN the system SHALL create or reuse a TraderProfile record
4. WHEN a user starts copying THEN the system SHALL add the trader wallet to MonitoredWallet for WebSocket tracking
5. WHEN a user is already copying a trader THEN the system SHALL prevent duplicate copy relationships

### Requirement 3

**User Story:** As a user, I want to configure stop-loss and take-profit percentages, so that my positions are automatically closed at my risk tolerance.

#### Acceptance Criteria

1. WHEN a user sets a stop-loss percentage THEN the system SHALL accept values between -100% and 0%
2. WHEN a user sets a take-profit percentage THEN the system SHALL accept values between 0% and 1000%
3. WHEN a position's P&L reaches the stop-loss threshold THEN the system SHALL queue a sell order within 5 seconds
4. WHEN a position's P&L reaches the take-profit threshold THEN the system SHALL queue a sell order within 5 seconds
5. WHEN a SL/TP condition is triggered THEN the system SHALL acquire a position lock to prevent duplicate sells

### Requirement 4

**User Story:** As a user, I want to see my open positions and their current P&L, so that I can monitor my copy trading performance.

#### Acceptance Criteria

1. WHEN a user views open positions THEN the system SHALL display current price fetched from Jupiter API
2. WHEN a user views open positions THEN the system SHALL calculate unrealized P&L as (currentValue - entryValue)
3. WHEN a user views position history THEN the system SHALL show realized P&L and exit reason
4. WHEN a user views copy trading stats THEN the system SHALL show win rate, total trades, and net profit

### Requirement 5

**User Story:** As a user, I want to manually close a position, so that I can exit a trade before SL/TP triggers.

#### Acceptance Criteria

1. WHEN a user requests to close a position THEN the system SHALL verify ownership via userId
2. WHEN a user closes a position THEN the system SHALL queue a high-priority sell order
3. WHEN a position is closed THEN the system SHALL calculate profit/loss and update statistics
4. WHEN a position is closed with profit THEN the system SHALL process 5% profit sharing to the trader

### Requirement 6

**User Story:** As a user, I want the "Exit with Trader" option, so that my positions automatically close when the trader sells.

#### Acceptance Criteria

1. WHEN exitWithTrader is enabled and trader sells THEN the system SHALL queue sell orders for all matching positions
2. WHEN trader performs a partial sell THEN the system SHALL calculate proportional sell percentage
3. WHEN trader sells 50% of their position THEN the system SHALL sell 50% of the copier's position
4. WHEN processing trader sell THEN the system SHALL acquire position locks to prevent duplicate sells

### Requirement 7

**User Story:** As a user, I want to see featured top traders, so that I can discover profitable traders to copy.

#### Acceptance Criteria

1. WHEN a user views top traders THEN the system SHALL display featured traders ordered by featuredOrder
2. WHEN no featured traders exist THEN the system SHALL fallback to top performers by ROI
3. WHEN displaying a trader THEN the system SHALL show ROI, win rate, total trades, and active followers
4. WHEN a user views trader details THEN the system SHALL show performance chart data

### Requirement 8

**User Story:** As a system operator, I want transaction limits enforced, so that users cannot exceed safe trading amounts.

#### Acceptance Criteria

1. WHEN a user sets totalBudget THEN the system SHALL enforce maximum of 10,000 USDC
2. WHEN a user sets amountPerTrade THEN the system SHALL enforce maximum of 1,000 USDC
3. WHEN a single transaction exceeds 100 SOL THEN the system SHALL reject the transaction
4. WHEN daily transactions exceed 1,000 SOL THEN the system SHALL reject additional transactions

### Requirement 9

**User Story:** As a system operator, I want the copy trading services to run reliably, so that trades are executed without manual intervention.

#### Acceptance Criteria

1. WHEN the server starts THEN the system SHALL initialize TransactionMonitor WebSocket connection
2. WHEN the server starts THEN the system SHALL initialize PriceMonitor polling loop
3. WHEN WebSocket disconnects THEN the system SHALL automatically reconnect after 5 seconds
4. WHEN a trade execution fails THEN the system SHALL retry up to 3 times with exponential backoff
5. WHEN monitored wallets change THEN the system SHALL refresh subscriptions every 5 minutes
