-- AlterTable: Add type field to copy_trade_queue
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'entry';

-- AlterTable: Add cancelTransactions field to copy_trade_queue
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "cancelTransactions" TEXT;

-- AlterTable: Add type field to copy_positions
ALTER TABLE "copy_positions" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'entry';

-- AlterTable: Add cancelTransactions field to copy_positions  
ALTER TABLE "copy_positions" ADD COLUMN IF NOT EXISTS "cancelTransactions" TEXT;
