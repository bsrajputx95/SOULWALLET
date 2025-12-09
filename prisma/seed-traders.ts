import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const TOP_TRADERS = [
  {
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    username: '@AlphaWolf',
    bio: 'Top Solana trader with consistent 40%+ monthly returns',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlphaWolf',
    isFeatured: true,
    featuredOrder: 1,
    totalROI: 42.5,
    roi7d: 18.3,
    roi30d: 42.5,
    roi90d: 50.2,
    winRate: 75,
    totalTrades: 150,
    avgTradeSize: 500,
    totalVolume: 75000,
    totalFollowers: 342,
  },
  {
    walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    username: '@ChainSniper',
    bio: 'Early token hunter | Verified trader',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChainSniper',
    isFeatured: true,
    featuredOrder: 2,
    totalROI: 31.2,
    roi7d: 12.1,
    roi30d: 31.2,
    roi90d: 38.5,
    winRate: 68,
    totalTrades: 200,
    avgTradeSize: 300,
    totalVolume: 60000,
    totalFollowers: 287,
  },
  {
    walletAddress: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
    username: '@ghostxsol',
    bio: 'Memecoin specialist | High risk high reward',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ghostxsol',
    isFeatured: true,
    featuredOrder: 3,
    totalROI: 42.5,
    roi7d: 15.8,
    roi30d: 42.5,
    roi90d: 55.0,
    winRate: 72,
    totalTrades: 180,
    avgTradeSize: 450,
    totalVolume: 81000,
    totalFollowers: 412,
  },
  {
    walletAddress: '6XmbKpXAJKnbVZgVxfMgCXYbAB4tXgkfYYhAcAasGq5K',
    username: '@DeFiWhale',
    bio: 'Large cap focus | Stable returns',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DeFiWhale',
    isFeatured: true,
    featuredOrder: 4,
    totalROI: 28.7,
    roi7d: 8.2,
    roi30d: 28.7,
    roi90d: 35.4,
    winRate: 82,
    totalTrades: 95,
    avgTradeSize: 2000,
    totalVolume: 190000,
    totalFollowers: 523,
  },
  {
    walletAddress: '3yFwqXBfZY4jBVUafQ1YEXw189y2dN3V5KQq9uzBDy1E',
    username: '@MoonHunter',
    bio: 'New token launches | Quick flips',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MoonHunter',
    isFeatured: true,
    featuredOrder: 5,
    totalROI: 35.8,
    roi7d: 22.4,
    roi30d: 35.8,
    roi90d: 41.2,
    winRate: 65,
    totalTrades: 312,
    avgTradeSize: 250,
    totalVolume: 78000,
    totalFollowers: 189,
  },
  {
    walletAddress: '8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR',
    username: '@SolanaMaxi',
    bio: 'SOL ecosystem plays | Long term holds',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SolanaMaxi',
    isFeatured: true,
    featuredOrder: 6,
    totalROI: 25.3,
    roi7d: 5.7,
    roi30d: 25.3,
    roi90d: 32.1,
    winRate: 78,
    totalTrades: 87,
    avgTradeSize: 1500,
    totalVolume: 130500,
    totalFollowers: 298,
  },
  {
    walletAddress: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    username: '@QuickFlip',
    bio: 'Scalping expert | Multiple daily trades',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=QuickFlip',
    isFeatured: true,
    featuredOrder: 7,
    totalROI: 29.4,
    roi7d: 11.3,
    roi30d: 29.4,
    roi90d: 36.8,
    winRate: 71,
    totalTrades: 428,
    avgTradeSize: 150,
    totalVolume: 64200,
    totalFollowers: 156,
  },
  {
    walletAddress: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    username: '@CryptoSage',
    bio: 'Technical analysis pro | Chart patterns',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoSage',
    isFeatured: true,
    featuredOrder: 8,
    totalROI: 33.6,
    roi7d: 9.8,
    roi30d: 33.6,
    roi90d: 40.2,
    winRate: 74,
    totalTrades: 165,
    avgTradeSize: 600,
    totalVolume: 99000,
    totalFollowers: 367,
  },
  {
    walletAddress: 'Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD',
    username: '@TokenSniper',
    bio: 'Launch pad specialist | Early entries',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TokenSniper',
    isFeatured: true,
    featuredOrder: 9,
    totalROI: 38.9,
    roi7d: 19.2,
    roi30d: 38.9,
    roi90d: 45.7,
    winRate: 69,
    totalTrades: 234,
    avgTradeSize: 350,
    totalVolume: 81900,
    totalFollowers: 445,
  },
  {
    walletAddress: 'FriELggez2Dy3phZeHHAdpcoEXkKQVkv6tx3zDtCVP8T',
    username: '@DiamondHands',
    bio: 'HODL strategy | Patient trader',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DiamondHands',
    isFeatured: true,
    featuredOrder: 10,
    totalROI: 27.1,
    roi7d: 6.4,
    roi30d: 27.1,
    roi90d: 33.5,
    winRate: 85,
    totalTrades: 52,
    avgTradeSize: 3000,
    totalVolume: 156000,
    totalFollowers: 612,
  },
];

async function seedTraders() {
  // Production safety check
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  WARNING: Running trader seed script in production');
    console.log('⚠️  This will create/update 10 featured traders');
    console.log('⚠️  Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await delay(5000);
  }

  // Verify database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  console.log('🌱 Seeding top traders...');
  
  for (const trader of TOP_TRADERS) {
    try {
      const created = await prisma.traderProfile.upsert({
        where: { walletAddress: trader.walletAddress },
        update: trader,
        create: trader,
      });
      console.log(`✅ Seeded trader: ${created.username} (${created.walletAddress})`);
      
      // Also create monitored wallet for each trader
      await prisma.monitoredWallet.upsert({
        where: { walletAddress: trader.walletAddress },
        update: {
          isActive: true,
          traderId: created.id,
        },
        create: {
          walletAddress: trader.walletAddress,
          traderId: created.id,
          isActive: true,
        },
      });
    } catch (error: any) {
      console.error(`❌ Failed to seed trader ${trader.username} (${trader.walletAddress}):`, error.message);
    }
  }
  
  // Seed Summary
  console.log('📊 Seed Summary:');
  const traderCount = await prisma.traderProfile.count({ where: { isFeatured: true } });
  const monitoredCount = await prisma.monitoredWallet.count({ where: { isActive: true } });
  console.log(`   Featured Traders: ${traderCount}`);
  console.log(`   Monitored Wallets: ${monitoredCount}`);

  console.log('✅ All traders seeded successfully!');
}

seedTraders()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
