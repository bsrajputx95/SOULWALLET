/**
 * Seed script for TraderProfile table
 * Populates the database with known high-performing Solana wallet addresses
 * 
 * Run with: npx ts-node prisma/seed-traders.ts
 * Or add to package.json scripts: "seed:traders": "ts-node prisma/seed-traders.ts"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Known high-performing Solana wallets (public addresses from Birdeye leaderboard)
const FEATURED_TRADERS = [
  {
    id: 'trader-solana-whale-1',
    walletAddress: '7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffXHsM',
    username: 'SolanaWhale',
    isFeatured: true,
    featuredOrder: 1,
  },
  {
    id: 'trader-defi-master',
    walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    username: 'DeFiMaster',
    isFeatured: true,
    featuredOrder: 2,
  },
  {
    id: 'trader-meme-hunter',
    walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    username: 'MemeHunter',
    isFeatured: true,
    featuredOrder: 3,
  },
  {
    id: 'trader-alpha-seeker',
    walletAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    username: 'AlphaSeeker',
    isFeatured: true,
    featuredOrder: 4,
  },
  {
    id: 'trader-token-sniper',
    walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    username: 'TokenSniper',
    isFeatured: true,
    featuredOrder: 5,
  },
  {
    id: 'trader-sol-maximalist',
    walletAddress: 'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5',
    username: 'SOLMaximalist',
    isFeatured: true,
    featuredOrder: 6,
  },
  {
    id: 'trader-yield-farmer',
    walletAddress: '3Kz8PqvVqJGxLsLFfqR9rGWfTA9PHbkMqyquMfLo1HR9',
    username: 'YieldFarmer',
    isFeatured: true,
    featuredOrder: 7,
  },
  {
    id: 'trader-nft-flipper',
    walletAddress: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
    username: 'NFTFlipper',
    isFeatured: true,
    featuredOrder: 8,
  },
  {
    id: 'trader-degen-trader',
    walletAddress: 'Hf4sT3MxKhLwqGkLzLGJucp5Dn8G3YLvTq6SqCiXc6bN',
    username: 'DegenTrader',
    isFeatured: true,
    featuredOrder: 9,
  },
  {
    id: 'trader-whale-watcher',
    walletAddress: 'BVxyYhm498L79r4HMQ9sxZ5bi41DmJmeWZ7SCS7Cyvna',
    username: 'WhaleWatcher',
    isFeatured: true,
    featuredOrder: 10,
  },
];

async function seedTraders() {
  console.log('🌱 Seeding trader profiles...');

  for (const trader of FEATURED_TRADERS) {
    try {
      await prisma.traderProfile.upsert({
        where: { id: trader.id },
        update: {
          username: trader.username,
          isFeatured: trader.isFeatured,
          featuredOrder: trader.featuredOrder,
        },
        create: {
          id: trader.id,
          walletAddress: trader.walletAddress,
          username: trader.username,
          isFeatured: trader.isFeatured,
          featuredOrder: trader.featuredOrder,
        },
      });
      console.log(`✅ Seeded trader: ${trader.username} (${trader.walletAddress.slice(0, 8)}...)`);
    } catch (error) {
      console.error(`❌ Failed to seed trader ${trader.username}:`, error);
    }
  }

  console.log('🎉 Trader seeding complete!');
}

seedTraders()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
