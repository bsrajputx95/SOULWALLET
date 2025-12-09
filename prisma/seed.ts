import 'dotenv/config';
import { PrismaClient, PostVisibility } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/lib/services/auth';

const prisma = new PrismaClient();

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // Production safety check
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  WARNING: Running seed script in production environment');
    console.log('⚠️  This will create test users and data');
    console.log('⚠️  Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await delay(5000);
  }

  // Verify database connection before seeding
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  console.log('🌱 Seeding database...');

  // Create test user (with idempotency check)
  const existingTestUser = await prisma.user.findFirst({
    where: { email: 'test@soulwallet.dev' },
  });

  let testUser;
  if (existingTestUser) {
    console.log('ℹ️ Test user already exists, skipping create:', existingTestUser.username);
    testUser = existingTestUser;
  } else {
    const hashedPassword = await bcrypt.hash('Test123!@#', 10);
    testUser = await prisma.user.create({
      data: {
        email: 'test@soulwallet.dev',
        username: 'testuser',
        password: hashedPassword,
        name: 'Test User',
        walletAddress: null, // Will be created when user sets up wallet
      },
    });
    console.log('✅ Test user created:');
    console.log('   Email: test@soulwallet.dev');
    console.log('   Password: Test123!@#');
    console.log('   Username:', testUser.username);
  }

  // Seed Summary
  console.log('📊 Seed Summary:');
  const userCount = await prisma.user.count();
  const postCount = await prisma.post.count();
  console.log(`   Users: ${userCount}`);
  console.log(`   Posts: ${postCount}`);

  console.log('🎉 Database seeded successfully!');

  const newUsername = '@bhavanisingh';
  const newEmail = 'bhavani.sb.rajput@gmail.com';
  const newPassword = '12345678Kb@';

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: newUsername.toLowerCase() }, { email: newEmail.toLowerCase() }],
    },
  });
  if (existing) {
    console.log('ℹ️ User already exists, skipping create:', existing.username);
  } else {
    const hashed = await bcrypt.hash(newPassword, 12);
    const created = await prisma.user.create({
      data: {
        username: newUsername.toLowerCase(),
        email: newEmail.toLowerCase(),
        password: hashed,
        followersCount: 0,
        followingCount: 0,
        vipFollowersCount: 0,
        copyTradersCount: 0,
        roi30d: 0,
        pnl24h: 0,
        pnl1w: 0,
        pnl1m: 0,
        pnl90d: 0,
      },
    });
    await prisma.post.create({
      data: {
        userId: created.id,
        content: 'i love solana buy it',
        visibility: PostVisibility.PUBLIC,
        likesCount: 0,
        repostsCount: 0,
      },
    });
    const verifyUser = await prisma.user.findUnique({ where: { id: created.id } });
    const verifyPosts = await prisma.post.findMany({ where: { userId: created.id } });
    console.log('✅ Created user:', verifyUser?.username, verifyUser?.email);
    console.log('✅ Post count:', verifyPosts.length);
    const canLogin = await AuthService.login({ identifier: newUsername.toLowerCase(), password: newPassword }, { ipAddress: '127.0.0.1', userAgent: 'seed-script' }).then(() => true).catch(() => false);
    console.log('✅ Login test:', canLogin ? 'success' : 'failed');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
