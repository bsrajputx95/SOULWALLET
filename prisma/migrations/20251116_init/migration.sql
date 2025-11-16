-- CreateEnum
CREATE TYPE "OTPType" AS ENUM ('RESET_PASSWORD', 'VERIFY_EMAIL');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserBadge" AS ENUM ('GENERAL', 'PRO', 'ELITE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SEND', 'RECEIVE', 'SWAP');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'FOLLOWERS', 'VIP');

-- This migration will be applied by Prisma
-- Empty file - db push will create tables
