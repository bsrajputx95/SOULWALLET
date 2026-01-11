-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('READ_ONLY', 'FULL_ACCESS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED', 'FAILED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PREMIUM';

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "walletAddress" TEXT,
    "walletVerifiedAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailHash" VARCHAR(64),
    "walletAddressHash" VARCHAR(64),
    "bio" TEXT,
    "profileImage" TEXT,
    "coverImage" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "badge" "UserBadge" NOT NULL DEFAULT 'GENERAL',
    "vipPrice" DOUBLE PRECISION,
    "vipDescription" TEXT,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "vipFollowersCount" INTEGER NOT NULL DEFAULT 0,
    "copyTradersCount" INTEGER NOT NULL DEFAULT 0,
    "roi30d" DOUBLE PRECISION,
    "pnl24h" DOUBLE PRECISION,
    "pnl1w" DOUBLE PRECISION,
    "pnl1m" DOUBLE PRECISION,
    "pnl90d" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "winRate" DOUBLE PRECISION,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "statsUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OTPType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "signature_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scope" "ApiKeyScope" NOT NULL DEFAULT 'READ_ONLY',
    "permissions" JSONB,
    "ipWhitelist" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_audits" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "endpoint" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "role" "Role",
    "apiKeyId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorization_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "name" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "trustedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "token" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalValueUSD" DOUBLE PRECISION NOT NULL,
    "tokens" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "successful" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_activities" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "metadata" JSONB,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
    "mentionedTokenName" TEXT,
    "mentionedTokenSymbol" TEXT,
    "mentionedTokenMint" TEXT,
    "images" JSONB,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "repostsCount" INTEGER NOT NULL DEFAULT 0,
    "agreeCount" INTEGER NOT NULL DEFAULT 0,
    "disagreeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_votes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ibuy_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buyAmount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "slippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ibuy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ibuy_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "tokenName" TEXT,
    "amountBought" DOUBLE PRECISION NOT NULL,
    "priceInUsdc" DOUBLE PRECISION NOT NULL,
    "buyTxSig" TEXT NOT NULL,
    "sellAmountUsdc" DOUBLE PRECISION,
    "sellTxSig" TEXT,
    "soldAt" TIMESTAMP(3),
    "profitLoss" DOUBLE PRECISION,
    "creatorFee" DOUBLE PRECISION,
    "creatorFeeTxSig" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ibuy_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reposts" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reposts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_subscriptions" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "priceInSol" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "transactionSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifications" JSONB,
    "privacy" JSONB,
    "security" JSONB,
    "adminIpWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trader_profiles" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "totalFollowers" INTEGER NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalROI" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgTradeSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roi7d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roi30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roi90d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trader_performance_snapshots" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "totalPnL" DOUBLE PRECISION NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "totalFollowers" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trader_performance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy_trading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "amountPerTrade" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "maxSlippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "exitWithTrader" BOOLEAN NOT NULL DEFAULT false,
    "totalCopied" INTEGER NOT NULL DEFAULT 0,
    "activeTrades" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFeesPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_trading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "copyTradingId" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "entryTxHash" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "entryAmount" DOUBLE PRECISION NOT NULL,
    "entryValue" DOUBLE PRECISION NOT NULL,
    "entryTimestamp" TIMESTAMP(3) NOT NULL,
    "exitTxHash" TEXT,
    "exitPrice" DOUBLE PRECISION,
    "exitAmount" DOUBLE PRECISION,
    "exitValue" DOUBLE PRECISION,
    "exitTimestamp" TIMESTAMP(3),
    "exitReason" TEXT,
    "profitLoss" DOUBLE PRECISION,
    "profitLossPercent" DOUBLE PRECISION,
    "feeAmount" DOUBLE PRECISION,
    "feeTxHash" TEXT,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "slTpTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_wallets" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "traderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenTx" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "totalCopiers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detected_transactions" (
    "id" TEXT NOT NULL,
    "monitoredWalletId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "copiesCreated" INTEGER NOT NULL DEFAULT 0,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "detected_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_prices" (
    "id" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "priceUSD" DOUBLE PRECISION NOT NULL,
    "priceChange24h" DOUBLE PRECISION,
    "volume24h" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_queue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "copyTradingId" TEXT NOT NULL,
    "positionId" TEXT,
    "tokenMint" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "maxSlippage" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "txHash" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "execution_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custodial_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyIv" TEXT NOT NULL,
    "keyTag" TEXT NOT NULL,
    "keySalt" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "dataKeyCiphertext" TEXT,
    "dataKeyKeyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custodial_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "kdfConfig" JSONB NOT NULL,
    "kmsKeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "key_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_operation_logs" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "userId" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorMsg" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jwt_secret_versions" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'access',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotatedBy" TEXT,

    CONSTRAINT "jwt_secret_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "feeAmount" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "previousHash" TEXT,
    "currentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "deletedData" JSONB,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'JSON',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tier" INTEGER NOT NULL DEFAULT 1,
    "encryptedData" TEXT,
    "dataKeyCiphertext" TEXT,
    "dataKeyKeyId" TEXT,
    "keyIv" TEXT,
    "keyTag" TEXT,
    "keySalt" TEXT,
    "keyVersion" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "riskScore" DOUBLE PRECISION,
    "riskLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "transactionId" TEXT,
    "transactionHash" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulatory_reports" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulatory_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_queue" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL,
    "responseCode" INTEGER,
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailHash_key" ON "users"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddressHash_key" ON "users"("walletAddressHash");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_email_emailVerifiedAt_idx" ON "users"("email", "emailVerifiedAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_createdAt_isVerified_idx" ON "users"("createdAt", "isVerified");

-- CreateIndex
CREATE INDEX "users_emailHash_idx" ON "users"("emailHash");

-- CreateIndex
CREATE INDEX "users_walletAddressHash_idx" ON "users"("walletAddressHash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_lastActivityAt_idx" ON "sessions"("userId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "otps_email_type_idx" ON "otps"("email", "type");

-- CreateIndex
CREATE INDEX "otps_code_idx" ON "otps"("code");

-- CreateIndex
CREATE UNIQUE INDEX "signature_nonces_nonce_key" ON "signature_nonces"("nonce");

-- CreateIndex
CREATE INDEX "signature_nonces_nonce_idx" ON "signature_nonces"("nonce");

-- CreateIndex
CREATE INDEX "signature_nonces_userId_createdAt_idx" ON "signature_nonces"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_isActive_idx" ON "api_keys"("userId", "isActive");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "authorization_audits_userId_createdAt_idx" ON "authorization_audits"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "authorization_audits_allowed_createdAt_idx" ON "authorization_audits"("allowed", "createdAt");

-- CreateIndex
CREATE INDEX "authorization_audits_action_createdAt_idx" ON "authorization_audits"("action", "createdAt");

-- CreateIndex
CREATE INDEX "devices_userId_lastSeenAt_idx" ON "devices"("userId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "devices_fingerprint_idx" ON "devices"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "devices_userId_fingerprint_key" ON "devices"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_signature_key" ON "transactions"("signature");

-- CreateIndex
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_status_createdAt_idx" ON "transactions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_type_userId_idx" ON "transactions"("type", "userId");

-- CreateIndex
CREATE INDEX "transactions_signature_idx" ON "transactions"("signature");

-- CreateIndex
CREATE INDEX "contacts_userId_idx" ON "contacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_userId_address_key" ON "contacts"("userId", "address");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_userId_timestamp_idx" ON "portfolio_snapshots"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "login_attempts_identifier_createdAt_idx" ON "login_attempts"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_createdAt_idx" ON "login_attempts"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "session_activities_userId_createdAt_idx" ON "session_activities"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "session_activities_sessionId_createdAt_idx" ON "session_activities"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "session_activities_suspicious_createdAt_idx" ON "session_activities"("suspicious", "createdAt");

-- CreateIndex
CREATE INDEX "posts_userId_idx" ON "posts"("userId");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_visibility_idx" ON "posts"("visibility");

-- CreateIndex
CREATE INDEX "posts_mentionedTokenSymbol_idx" ON "posts"("mentionedTokenSymbol");

-- CreateIndex
CREATE INDEX "posts_userId_createdAt_idx" ON "posts"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_mentionedTokenSymbol_createdAt_idx" ON "posts"("mentionedTokenSymbol", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_visibility_likesCount_idx" ON "posts"("visibility", "likesCount" DESC);

-- CreateIndex
CREATE INDEX "posts_visibility_createdAt_likesCount_idx" ON "posts"("visibility", "createdAt" DESC, "likesCount" DESC);

-- CreateIndex
CREATE INDEX "post_votes_postId_idx" ON "post_votes"("postId");

-- CreateIndex
CREATE INDEX "post_votes_userId_idx" ON "post_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "post_votes_userId_postId_key" ON "post_votes"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "ibuy_settings_userId_key" ON "ibuy_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ibuy_purchases_buyTxSig_key" ON "ibuy_purchases"("buyTxSig");

-- CreateIndex
CREATE INDEX "ibuy_purchases_userId_status_idx" ON "ibuy_purchases"("userId", "status");

-- CreateIndex
CREATE INDEX "ibuy_purchases_userId_createdAt_idx" ON "ibuy_purchases"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ibuy_purchases_tokenMint_idx" ON "ibuy_purchases"("tokenMint");

-- CreateIndex
CREATE INDEX "ibuy_purchases_postId_idx" ON "ibuy_purchases"("postId");

-- CreateIndex
CREATE INDEX "ibuy_purchases_status_createdAt_idx" ON "ibuy_purchases"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "post_likes_postId_idx" ON "post_likes"("postId");

-- CreateIndex
CREATE INDEX "post_likes_userId_idx" ON "post_likes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "post_likes_userId_postId_key" ON "post_likes"("userId", "postId");

-- CreateIndex
CREATE INDEX "post_comments_postId_idx" ON "post_comments"("postId");

-- CreateIndex
CREATE INDEX "post_comments_userId_idx" ON "post_comments"("userId");

-- CreateIndex
CREATE INDEX "post_comments_parentId_idx" ON "post_comments"("parentId");

-- CreateIndex
CREATE INDEX "reposts_postId_idx" ON "reposts"("postId");

-- CreateIndex
CREATE INDEX "reposts_userId_idx" ON "reposts"("userId");

-- CreateIndex
CREATE INDEX "reposts_createdAt_idx" ON "reposts"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reposts_userId_postId_key" ON "reposts"("userId", "postId");

-- CreateIndex
CREATE INDEX "follows_followerId_idx" ON "follows"("followerId");

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "follows"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_followingId_key" ON "follows"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "vip_subscriptions_subscriberId_idx" ON "vip_subscriptions"("subscriberId");

-- CreateIndex
CREATE INDEX "vip_subscriptions_creatorId_idx" ON "vip_subscriptions"("creatorId");

-- CreateIndex
CREATE INDEX "vip_subscriptions_expiresAt_idx" ON "vip_subscriptions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "vip_subscriptions_subscriberId_creatorId_key" ON "vip_subscriptions"("subscriberId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "push_tokens_userId_active_idx" ON "push_tokens"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_userId_platform_key" ON "push_tokens"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "trader_profiles_walletAddress_key" ON "trader_profiles"("walletAddress");

-- CreateIndex
CREATE INDEX "trader_profiles_isFeatured_featuredOrder_idx" ON "trader_profiles"("isFeatured", "featuredOrder");

-- CreateIndex
CREATE INDEX "trader_profiles_totalROI_idx" ON "trader_profiles"("totalROI");

-- CreateIndex
CREATE INDEX "trader_profiles_walletAddress_idx" ON "trader_profiles"("walletAddress");

-- CreateIndex
CREATE INDEX "trader_profiles_totalROI_isFeatured_idx" ON "trader_profiles"("totalROI" DESC, "isFeatured");

-- CreateIndex
CREATE INDEX "trader_performance_snapshots_traderId_date_idx" ON "trader_performance_snapshots"("traderId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "trader_performance_snapshots_traderId_date_key" ON "trader_performance_snapshots"("traderId", "date");

-- CreateIndex
CREATE INDEX "copy_trading_userId_isActive_idx" ON "copy_trading"("userId", "isActive");

-- CreateIndex
CREATE INDEX "copy_trading_traderId_isActive_idx" ON "copy_trading"("traderId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "copy_trading_userId_traderId_key" ON "copy_trading"("userId", "traderId");

-- CreateIndex
CREATE INDEX "positions_tokenMint_status_idx" ON "positions"("tokenMint", "status");

-- CreateIndex
CREATE INDEX "positions_status_updatedAt_idx" ON "positions"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "positions_copyTradingId_status_updatedAt_idx" ON "positions"("copyTradingId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "positions_status_exitTimestamp_idx" ON "positions"("status", "exitTimestamp" DESC);

-- CreateIndex
CREATE INDEX "positions_status_slTpTriggeredAt_idx" ON "positions"("status", "slTpTriggeredAt");

-- CreateIndex
CREATE INDEX "positions_copyTradingId_tokenMint_idx" ON "positions"("copyTradingId", "tokenMint");

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

-- CreateIndex
CREATE UNIQUE INDEX "custodial_wallets_userId_key" ON "custodial_wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "custodial_wallets_publicKey_key" ON "custodial_wallets"("publicKey");

-- CreateIndex
CREATE INDEX "custodial_wallets_publicKey_idx" ON "custodial_wallets"("publicKey");

-- CreateIndex
CREATE INDEX "custodial_wallets_userId_isActive_idx" ON "custodial_wallets"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "key_versions_version_key" ON "key_versions"("version");

-- CreateIndex
CREATE INDEX "key_versions_version_isActive_idx" ON "key_versions"("version", "isActive");

-- CreateIndex
CREATE INDEX "key_operation_logs_operation_createdAt_idx" ON "key_operation_logs"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "key_operation_logs_userId_createdAt_idx" ON "key_operation_logs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "jwt_secret_versions_secretHash_key" ON "jwt_secret_versions"("secretHash");

-- CreateIndex
CREATE UNIQUE INDEX "jwt_secret_versions_version_key" ON "jwt_secret_versions"("version");

-- CreateIndex
CREATE INDEX "jwt_secret_versions_version_isActive_idx" ON "jwt_secret_versions"("version", "isActive");

-- CreateIndex
CREATE INDEX "jwt_secret_versions_purpose_isActive_idx" ON "jwt_secret_versions"("purpose", "isActive");

-- CreateIndex
CREATE INDEX "jwt_secret_versions_expiresAt_idx" ON "jwt_secret_versions"("expiresAt");

-- CreateIndex
CREATE INDEX "financial_audit_logs_userId_createdAt_idx" ON "financial_audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "financial_audit_logs_operation_createdAt_idx" ON "financial_audit_logs"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "financial_audit_logs_resourceType_resourceId_idx" ON "financial_audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "financial_audit_logs_createdAt_idx" ON "financial_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "data_deletion_requests_userId_status_idx" ON "data_deletion_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "data_deletion_requests_status_createdAt_idx" ON "data_deletion_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "data_export_requests_userId_status_idx" ON "data_export_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "data_export_requests_status_createdAt_idx" ON "data_export_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "consent_logs_userId_consentType_idx" ON "consent_logs"("userId", "consentType");

-- CreateIndex
CREATE INDEX "consent_logs_consentType_createdAt_idx" ON "consent_logs"("consentType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_userId_key" ON "kyc_verifications"("userId");

-- CreateIndex
CREATE INDEX "kyc_verifications_status_tier_idx" ON "kyc_verifications"("status", "tier");

-- CreateIndex
CREATE INDEX "kyc_verifications_userId_idx" ON "kyc_verifications"("userId");

-- CreateIndex
CREATE INDEX "aml_alerts_userId_status_idx" ON "aml_alerts"("userId", "status");

-- CreateIndex
CREATE INDEX "aml_alerts_alertType_severity_idx" ON "aml_alerts"("alertType", "severity");

-- CreateIndex
CREATE INDEX "aml_alerts_status_createdAt_idx" ON "aml_alerts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "regulatory_reports_reportType_period_idx" ON "regulatory_reports"("reportType", "period");

-- CreateIndex
CREATE INDEX "regulatory_reports_createdAt_idx" ON "regulatory_reports"("createdAt");

-- CreateIndex
CREATE INDEX "dead_letter_queue_status_createdAt_idx" ON "dead_letter_queue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "dead_letter_queue_status_nextRetryAt_idx" ON "dead_letter_queue"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "dead_letter_queue_userId_idx" ON "dead_letter_queue"("userId");

-- CreateIndex
CREATE INDEX "webhooks_userId_active_idx" ON "webhooks"("userId", "active");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookId_createdAt_idx" ON "webhook_deliveries"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_createdAt_idx" ON "webhook_deliveries"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otps" ADD CONSTRAINT "otps_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_audits" ADD CONSTRAINT "authorization_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_audits" ADD CONSTRAINT "authorization_audits_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_activities" ADD CONSTRAINT "session_activities_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_activities" ADD CONSTRAINT "session_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_votes" ADD CONSTRAINT "post_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_votes" ADD CONSTRAINT "post_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ibuy_settings" ADD CONSTRAINT "ibuy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ibuy_purchases" ADD CONSTRAINT "ibuy_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ibuy_purchases" ADD CONSTRAINT "ibuy_purchases_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_subscriptions" ADD CONSTRAINT "vip_subscriptions_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_subscriptions" ADD CONSTRAINT "vip_subscriptions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trader_performance_snapshots" ADD CONSTRAINT "trader_performance_snapshots_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "trader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_trading" ADD CONSTRAINT "copy_trading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_trading" ADD CONSTRAINT "copy_trading_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "trader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_copyTradingId_fkey" FOREIGN KEY ("copyTradingId") REFERENCES "copy_trading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_wallets" ADD CONSTRAINT "monitored_wallets_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "trader_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detected_transactions" ADD CONSTRAINT "detected_transactions_monitoredWalletId_fkey" FOREIGN KEY ("monitoredWalletId") REFERENCES "monitored_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custodial_wallets" ADD CONSTRAINT "custodial_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_audit_logs" ADD CONSTRAINT "financial_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
