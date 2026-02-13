-- Copy Trading V2 migration
-- Adds dedicated custodial copy wallets and queue worker metadata for autonomous execution

-- Create copy_wallets table
CREATE TABLE IF NOT EXISTS "copy_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "allocatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastBalanceCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "copy_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "copy_wallets_userId_key" ON "copy_wallets"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "copy_wallets_publicKey_key" ON "copy_wallets"("publicKey");
CREATE INDEX IF NOT EXISTS "copy_wallets_status_idx" ON "copy_wallets"("status");
CREATE INDEX IF NOT EXISTS "copy_wallets_userId_status_idx" ON "copy_wallets"("userId", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'copy_wallets_userId_fkey'
    ) THEN
        ALTER TABLE "copy_wallets"
            ADD CONSTRAINT "copy_wallets_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Link config to copy wallet
ALTER TABLE "copy_trading_configs" ADD COLUMN IF NOT EXISTS "copyWalletId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "copy_trading_configs_copyWalletId_key" ON "copy_trading_configs"("copyWalletId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'copy_trading_configs_copyWalletId_fkey'
    ) THEN
        ALTER TABLE "copy_trading_configs"
            ADD CONSTRAINT "copy_trading_configs_copyWalletId_fkey"
            FOREIGN KEY ("copyWalletId") REFERENCES "copy_wallets"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Queue metadata for worker-based execution
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "lockedBy" TEXT;
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3);
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "txSignature" TEXT;
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "webhookReceivedAt" TIMESTAMP(3);
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "enqueueLatencyMs" INTEGER;
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "submitLatencyMs" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "copy_trade_queue_idempotencyKey_key" ON "copy_trade_queue"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "copy_trade_queue_status_createdAt_idx" ON "copy_trade_queue"("status", "createdAt");
