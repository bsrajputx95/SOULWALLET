-- AlterTable
ALTER TABLE "ibuy_purchases" ADD COLUMN "amountRemaining" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill for existing OPEN positions
UPDATE "ibuy_purchases"
SET "amountRemaining" = "amountBought"
WHERE "status" = 'OPEN' AND "amountRemaining" = 0;

