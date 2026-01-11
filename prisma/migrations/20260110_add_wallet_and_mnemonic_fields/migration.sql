-- Migration: add_wallet_and_mnemonic_fields
-- Description: Adds Wallet model with BIP39 mnemonic backup support and mnemonic fields to CustodialWallet
-- Date: 2026-01-10

-- CreateTable: wallets (user's Solana wallets with client-side encrypted private keys)
CREATE TABLE IF NOT EXISTS "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "encryptedMnemonic" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "network" TEXT NOT NULL DEFAULT 'mainnet-beta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: token_holdings (token holdings for a wallet)
CREATE TABLE IF NOT EXISTS "token_holdings" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "decimals" INTEGER NOT NULL,
    "priceUSD" DOUBLE PRECISION,
    "valueUSD" DOUBLE PRECISION,
    "logo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: wallet_transactions (wallet-specific transactions)
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "amount" DOUBLE PRECISION,
    "tokenMint" TEXT,
    "tokenSymbol" TEXT,
    "fee" DOUBLE PRECISION,
    "blockTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- Add mnemonic backup fields to custodial_wallets
ALTER TABLE "custodial_wallets" ADD COLUMN IF NOT EXISTS "encryptedMnemonic" TEXT;
ALTER TABLE "custodial_wallets" ADD COLUMN IF NOT EXISTS "mnemonicIv" TEXT;
ALTER TABLE "custodial_wallets" ADD COLUMN IF NOT EXISTS "mnemonicTag" TEXT;

-- CreateIndex: wallets
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_publicKey_key" ON "wallets"("publicKey");
CREATE INDEX IF NOT EXISTS "wallets_userId_idx" ON "wallets"("userId");
CREATE INDEX IF NOT EXISTS "wallets_publicKey_idx" ON "wallets"("publicKey");
CREATE INDEX IF NOT EXISTS "wallets_userId_isPrimary_idx" ON "wallets"("userId", "isPrimary");

-- CreateIndex: token_holdings
CREATE INDEX IF NOT EXISTS "token_holdings_walletId_idx" ON "token_holdings"("walletId");
CREATE UNIQUE INDEX IF NOT EXISTS "token_holdings_walletId_mint_key" ON "token_holdings"("walletId", "mint");

-- CreateIndex: wallet_transactions
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_transactions_signature_key" ON "wallet_transactions"("signature");
CREATE INDEX IF NOT EXISTS "wallet_transactions_walletId_idx" ON "wallet_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "wallet_transactions_signature_idx" ON "wallet_transactions"("signature");
CREATE INDEX IF NOT EXISTS "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId", "createdAt");

-- AddForeignKey: wallets -> users
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: token_holdings -> wallets
ALTER TABLE "token_holdings" ADD CONSTRAINT "token_holdings_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: wallet_transactions -> wallets
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
