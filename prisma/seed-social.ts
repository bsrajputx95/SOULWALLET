import { PrismaClient, PostVisibility, UserBadge } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedSocialData() {
  console.log('🌱 Seeding social data...');

  try {
    // Create test users with social profiles
    const users = [
      {
        email: 'alice@example.com',
        username: 'alice_trader',
        name: 'Alice Johnson',
        password: await bcrypt.hash('password123', 12),
        bio: 'Professional crypto trader | 5+ years experience | Solana maximalist',
        profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
        coverImage: 'https://picsum.photos/800/200?random=1',
        isVerified: true,
        badge: UserBadge.ELITE,
        vipPrice: 10,
        vipDescription: 'Get exclusive trading signals and early access to my positions',
        followersCount: 1250,
        followingCount: 89,
        vipFollowersCount: 45,
        copyTradersCount: 78,
        roi30d: 45.67,
        pnl24h: 234.56,
        pnl1w: 1234.56,
        pnl1m: 5678.90,
        pnl90d: 12345.67,
        maxDrawdown: -15.5,
        winRate: 68.5,
        totalTrades: 456,
        walletAddress: 'ALiCE11111111111111111111111111111111111111',
      },
      {
        email: 'bob@example.com',
        username: 'bob_defi',
        name: 'Bob Smith',
        password: await bcrypt.hash('password123', 12),
        bio: 'DeFi enthusiast | Yield farming expert | Building on Solana',
        profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
        coverImage: 'https://picsum.photos/800/200?random=2',
        isVerified: true,
        badge: UserBadge.PRO,
        vipPrice: 5,
        vipDescription: 'Learn my DeFi strategies and get alpha on new protocols',
        followersCount: 890,
        followingCount: 234,
        vipFollowersCount: 23,
        copyTradersCount: 34,
        roi30d: 23.45,
        pnl24h: 123.45,
        pnl1w: 567.89,
        pnl1m: 2345.67,
        pnl90d: 8901.23,
        maxDrawdown: -12.3,
        winRate: 62.3,
        totalTrades: 234,
        walletAddress: 'BOB111111111111111111111111111111111111111',
      },
      {
        email: 'charlie@example.com',
        username: 'charlie_nft',
        name: 'Charlie Davis',
        password: await bcrypt.hash('password123', 12),
        bio: 'NFT collector | Art enthusiast | Solana NFTs only',
        profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
        coverImage: 'https://picsum.photos/800/200?random=3',
        isVerified: false,
        badge: UserBadge.GENERAL,
        followersCount: 456,
        followingCount: 678,
        walletAddress: 'CHARLiE11111111111111111111111111111111111',
      },
    ];

    // Create users
    const createdUsers = [];
    for (const userData of users) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: userData,
        create: userData,
      });
      createdUsers.push(user);
      console.log(`✅ Created/updated user: ${user.username}`);
    }

    // Create follow relationships
    const followData = [
      { followerId: createdUsers[1]!.id, followingId: createdUsers[0]!.id },
      { followerId: createdUsers[2]!.id, followingId: createdUsers[0]!.id },
      { followerId: createdUsers[2]!.id, followingId: createdUsers[1]!.id },
      { followerId: createdUsers[0]!.id, followingId: createdUsers[1]!.id },
    ];
    
    for (const follow of followData) {
      try {
        await prisma.follow.create({ data: follow });
      } catch (e) {
        // Ignore duplicate errors
      }
    }
    console.log('✅ Created follow relationships');

    // Create VIP subscriptions
    const vipSub = await prisma.vIPSubscription.upsert({
      where: {
        subscriberId_creatorId: {
          subscriberId: createdUsers[2]!.id,
          creatorId: createdUsers[0]!.id,
        },
      },
      update: {
        priceInSol: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      create: {
        subscriberId: createdUsers[2].id,
        creatorId: createdUsers[0].id,
        priceInSol: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    console.log('✅ Created VIP subscription');

    // Create sample posts
    const posts = [
      {
        userId: createdUsers[0].id,
        content: '🚀 Just opened a long position on $SOL at $150. Target: $180, Stop Loss: $140. This setup looks incredibly bullish! #Solana #Trading',
        visibility: PostVisibility.PUBLIC,
        mentionedTokenName: 'Solana',
        mentionedTokenSymbol: 'SOL',
        mentionedTokenMint: 'So11111111111111111111111111111111111111112',
        likesCount: 45,
        commentsCount: 12,
        repostsCount: 5,
      },
      {
        userId: createdUsers[0].id,
        content: '📊 Market analysis: The current consolidation phase is healthy. Expecting a breakout soon. VIP members check your DMs for detailed entry points.',
        visibility: PostVisibility.VIP,
        likesCount: 23,
        commentsCount: 8,
        repostsCount: 2,
      },
      {
        userId: createdUsers[1].id,
        content: '💎 Found a gem! $BONK is showing strong accumulation patterns. Whales are quietly loading up. This could be the next 10x opportunity.',
        visibility: PostVisibility.PUBLIC,
        mentionedTokenName: 'Bonk',
        mentionedTokenSymbol: 'BONK',
        mentionedTokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        likesCount: 67,
        commentsCount: 23,
        repostsCount: 12,
      },
      {
        userId: createdUsers[1].id,
        content: '🔥 DeFi tip: Always check the TVL trend before entering a liquidity pool. Declining TVL often signals upcoming issues.',
        visibility: PostVisibility.FOLLOWERS,
        likesCount: 34,
        commentsCount: 9,
        repostsCount: 7,
      },
      {
        userId: createdUsers[2].id,
        content: '🎨 Just minted my first NFT collection on Solana! The gas fees are so much better than ETH. Check it out!',
        visibility: PostVisibility.PUBLIC,
        likesCount: 12,
        commentsCount: 5,
        repostsCount: 2,
      },
    ];

    // Create posts
    const createdPosts = [];
    for (const postData of posts) {
      const post = await prisma.post.create({
        data: postData,
      });
      createdPosts.push(post);
      console.log(`✅ Created post: ${post.content.substring(0, 50)}...`);
    }

    // Create likes
    await prisma.postLike.createMany({
      data: [
        { postId: createdPosts[0].id, userId: createdUsers[1].id },
        { postId: createdPosts[0].id, userId: createdUsers[2].id },
        { postId: createdPosts[2].id, userId: createdUsers[0].id },
        { postId: createdPosts[2].id, userId: createdUsers[2].id },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Created post likes');

    // Create comments
    const comments = [
      {
        postId: createdPosts[0].id,
        userId: createdUsers[1].id,
        content: 'Great call! I\'m following this trade.',
      },
      {
        postId: createdPosts[0].id,
        userId: createdUsers[2].id,
        content: 'What\'s your timeframe for this trade?',
      },
      {
        postId: createdPosts[2].id,
        userId: createdUsers[0].id,
        content: 'BONK is definitely undervalued right now.',
      },
    ];

    for (const commentData of comments) {
      await prisma.postComment.create({
        data: commentData,
      });
    }
    console.log('✅ Created post comments');

    // Create reposts
    await prisma.repost.createMany({
      data: [
        {
          postId: createdPosts[0].id,
          userId: createdUsers[1].id,
          comment: 'This is a solid setup. Following Alice\'s trade here.',
        },
        {
          postId: createdPosts[2].id,
          userId: createdUsers[0].id,
          comment: 'Bob found another gem! 💎',
        },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Created reposts');

    // Create notifications
    await prisma.notification.createMany({
      data: [
        {
          userId: createdUsers[0].id,
          title: 'New Follower',
          message: 'Bob started following you',
          type: 'SOCIAL',
          metadata: { followerId: createdUsers[1].id },
        },
        {
          userId: createdUsers[0].id,
          title: 'New Like',
          message: 'Someone liked your post',
          type: 'SOCIAL',
          metadata: { postId: createdPosts[0].id },
        },
        {
          userId: createdUsers[1].id,
          title: 'New Comment',
          message: 'Alice commented on your post',
          type: 'SOCIAL',
          metadata: { postId: createdPosts[2].id },
        },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Created notifications');

    console.log('✨ Social data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding social data:', error);
    throw error;
  }
}

// Run the seed function
seedSocialData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
