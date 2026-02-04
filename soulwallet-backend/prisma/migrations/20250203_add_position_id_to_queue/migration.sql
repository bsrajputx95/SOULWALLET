-- Clear copy_trade_queue table to avoid unique constraint conflicts
-- This is safe as queue items are ephemeral and will be recreated
TRUNCATE TABLE "copy_trade_queue";

-- Drop the old unique constraint if it exists
ALTER TABLE "copy_trade_queue" DROP CONSTRAINT IF EXISTS "copy_trade_queue_userId_traderTxSignature_key";

-- Add positionId column
ALTER TABLE "copy_trade_queue" ADD COLUMN IF NOT EXISTS "positionId" TEXT;

-- Create index on positionId
CREATE INDEX IF NOT EXISTS "copy_trade_queue_positionId_idx" ON "copy_trade_queue"("positionId");

-- Add new unique constraint
ALTER TABLE "copy_trade_queue" ADD CONSTRAINT "unique_queue_item" UNIQUE ("userId", "traderTxSignature", "positionId");
