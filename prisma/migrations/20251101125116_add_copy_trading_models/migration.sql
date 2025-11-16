-- CreateTable
CREATE TABLE "trader_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "totalFollowers" INTEGER NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "totalROI" REAL NOT NULL DEFAULT 0,
    "avgTradeSize" REAL NOT NULL DEFAULT 0,
    "totalVolume" REAL NOT NULL DEFAULT 0,
    "roi7d" REAL NOT NULL DEFAULT 0,
    "roi30d" REAL NOT NULL DEFAULT 0,
    "roi90d" REAL NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "copy_trading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalBudget" REAL NOT NULL,
    "amountPerTrade" REAL NOT NULL,
    "stopLoss" REAL,
    "takeProfit" REAL,
    "exitWithTrader" BOOLEAN NOT NULL DEFAULT false,
    "totalCopied" INTEGER NOT NULL DEFAULT 0,
    "activeTrades" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" REAL NOT NULL DEFAULT 0,
    "totalFeesPaid" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "copy_trading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "copy_trading_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "trader_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "copyTradingId" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "entryTxHash" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "entryAmount" REAL NOT NULL,
    "entryValue" REAL NOT NULL,
    "entryTimestamp" DATETIME NOT NULL,
    "exitTxHash" TEXT,
    "exitPrice" REAL,
    "exitAmount" REAL,
    "exitValue" REAL,
    "exitTimestamp" DATETIME,
    "exitReason" TEXT,
    "profitLoss" REAL,
    "profitLossPercent" REAL,
    "feeAmount" REAL,
    "feeTxHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "positions_copyTradingId_fkey" FOREIGN KEY ("copyTradingId") REFERENCES "copy_trading" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monitored_wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "traderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenTx" TEXT,
    "lastSeenAt" DATETIME,
    "totalCopiers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "monitored_wallets_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "trader_profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "detected_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitoredWalletId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "amount" REAL NOT NULL,
    "price" REAL NOT NULL,
    "totalValue" REAL NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "copiesCreated" INTEGER NOT NULL DEFAULT 0,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "detected_transactions_monitoredWalletId_fkey" FOREIGN KEY ("monitoredWalletId") REFERENCES "monitored_wallets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "token_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenMint" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "priceUSD" REAL NOT NULL,
    "priceChange24h" REAL,
    "volume24h" REAL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "execution_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "copyTradingId" TEXT NOT NULL,
    "positionId" TEXT,
    "tokenMint" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "maxSlippage" REAL NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "txHash" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "walletAddress" TEXT,
    "walletVerifiedAt" DATETIME,
    "lockedUntil" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "email", "failedLoginAttempts", "id", "lockedUntil", "name", "password", "updatedAt", "username", "walletAddress") SELECT "createdAt", "email", "failedLoginAttempts", "id", "lockedUntil", "name", "password", "updatedAt", "username", "walletAddress" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "trader_profiles_walletAddress_key" ON "trader_profiles"("walletAddress");

-- CreateIndex
CREATE INDEX "trader_profiles_isFeatured_featuredOrder_idx" ON "trader_profiles"("isFeatured", "featuredOrder");

-- CreateIndex
CREATE INDEX "trader_profiles_totalROI_idx" ON "trader_profiles"("totalROI");

-- CreateIndex
CREATE INDEX "trader_profiles_walletAddress_idx" ON "trader_profiles"("walletAddress");

-- CreateIndex
CREATE INDEX "copy_trading_userId_isActive_idx" ON "copy_trading"("userId", "isActive");

-- CreateIndex
CREATE INDEX "copy_trading_traderId_isActive_idx" ON "copy_trading"("traderId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "copy_trading_userId_traderId_key" ON "copy_trading"("userId", "traderId");

-- CreateIndex
CREATE INDEX "positions_copyTradingId_status_idx" ON "positions"("copyTradingId", "status");

-- CreateIndex
CREATE INDEX "positions_tokenMint_status_idx" ON "positions"("tokenMint", "status");

-- CreateIndex
CREATE INDEX "positions_status_updatedAt_idx" ON "positions"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "monitored_wallets_walletAddress_key" ON "monitored_wallets"("walletAddress");

-- CreateIndex
CREATE INDEX "monitored_wallets_walletAddress_isActive_idx" ON "monitored_wallets"("walletAddress", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "detected_transactions_txHash_key" ON "detected_transactions"("txHash");

-- CreateIndex
CREATE INDEX "detected_transactions_txHash_idx" ON "detected_transactions"("txHash");

-- CreateIndex
CREATE INDEX "detected_transactions_monitoredWalletId_processed_idx" ON "detected_transactions"("monitoredWalletId", "processed");

-- CreateIndex
CREATE INDEX "detected_transactions_detectedAt_idx" ON "detected_transactions"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_prices_tokenMint_key" ON "token_prices"("tokenMint");

-- CreateIndex
CREATE INDEX "token_prices_tokenMint_idx" ON "token_prices"("tokenMint");

-- CreateIndex
CREATE INDEX "execution_queue_status_priority_createdAt_idx" ON "execution_queue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "execution_queue_userId_idx" ON "execution_queue"("userId");
