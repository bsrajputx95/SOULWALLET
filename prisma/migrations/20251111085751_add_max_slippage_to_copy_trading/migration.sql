-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_copy_trading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalBudget" REAL NOT NULL,
    "amountPerTrade" REAL NOT NULL,
    "stopLoss" REAL,
    "takeProfit" REAL,
    "maxSlippage" REAL NOT NULL DEFAULT 0.5,
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
INSERT INTO "new_copy_trading" ("activeTrades", "amountPerTrade", "createdAt", "exitWithTrader", "id", "isActive", "stopLoss", "takeProfit", "totalBudget", "totalCopied", "totalFeesPaid", "totalProfit", "traderId", "updatedAt", "userId") SELECT "activeTrades", "amountPerTrade", "createdAt", "exitWithTrader", "id", "isActive", "stopLoss", "takeProfit", "totalBudget", "totalCopied", "totalFeesPaid", "totalProfit", "traderId", "updatedAt", "userId" FROM "copy_trading";
DROP TABLE "copy_trading";
ALTER TABLE "new_copy_trading" RENAME TO "copy_trading";
CREATE INDEX "copy_trading_userId_isActive_idx" ON "copy_trading"("userId", "isActive");
CREATE INDEX "copy_trading_traderId_isActive_idx" ON "copy_trading"("traderId", "isActive");
CREATE UNIQUE INDEX "copy_trading_userId_traderId_key" ON "copy_trading"("userId", "traderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
