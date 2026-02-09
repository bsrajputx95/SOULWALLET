-- IBUY Feature Migration
-- Adds IBUY position tracking, creator revenue, and user settings

-- Add new columns to Post table
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "tokenVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "tokenPriceAtPost" DOUBLE PRECISION;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ibuyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ibuyVolume" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create index on tokenAddress for efficient lookups
CREATE INDEX IF NOT EXISTS "posts_tokenAddress_idx" ON "posts"("tokenAddress");

-- Create UserSettings table
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ibuySlippage" INTEGER NOT NULL DEFAULT 50,
    "ibuyDefaultSol" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- Create unique index on userId
CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_userId_key" ON "user_settings"("userId");

-- Create index on userId for lookups
CREATE INDEX IF NOT EXISTS "user_settings_userId_idx" ON "user_settings"("userId");

-- Add foreign key constraint for UserSettings
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create IBuyPosition table
CREATE TABLE IF NOT EXISTS "ibuy_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "solAmount" DOUBLE PRECISION NOT NULL,
    "tokenAmount" DOUBLE PRECISION NOT NULL,
    "creatorFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creatorSharePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ibuy_positions_pkey" PRIMARY KEY ("id")
);

-- Create indexes for IBuyPosition
CREATE INDEX IF NOT EXISTS "ibuy_positions_userId_status_idx" ON "ibuy_positions"("userId", "status");
CREATE INDEX IF NOT EXISTS "ibuy_positions_creatorId_idx" ON "ibuy_positions"("creatorId");
CREATE INDEX IF NOT EXISTS "ibuy_positions_postId_idx" ON "ibuy_positions"("postId");

-- Add foreign key constraints for IBuyPosition
ALTER TABLE "ibuy_positions" ADD CONSTRAINT "ibuy_positions_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ibuy_positions" ADD CONSTRAINT "ibuy_positions_creatorId_fkey" 
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ibuy_positions" ADD CONSTRAINT "ibuy_positions_postId_fkey" 
    FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create CreatorRevenue table
CREATE TABLE IF NOT EXISTS "creator_revenues" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_revenues_pkey" PRIMARY KEY ("id")
);

-- Create index for CreatorRevenue
CREATE INDEX IF NOT EXISTS "creator_revenues_creatorId_createdAt_idx" ON "creator_revenues"("creatorId", "createdAt");

-- Add foreign key constraint for CreatorRevenue
ALTER TABLE "creator_revenues" ADD CONSTRAINT "creator_revenues_creatorId_fkey" 
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Vote table (Agree/Disagree)
CREATE TABLE IF NOT EXISTS "votes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- "agree" or "disagree"
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- Create unique index to ensure one vote per user per post
CREATE UNIQUE INDEX IF NOT EXISTS "votes_postId_userId_key" ON "votes"("postId", "userId");

-- Create indexes for Vote
CREATE INDEX IF NOT EXISTS "votes_postId_idx" ON "votes"("postId");
CREATE INDEX IF NOT EXISTS "votes_userId_idx" ON "votes"("userId");

-- Add foreign key constraints for Vote
ALTER TABLE "votes" ADD CONSTRAINT "votes_postId_fkey" 
    FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
