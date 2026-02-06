import prisma from '../db';

const GLOBAL_USERS = ['soulwallet', 'bhavanisingh'];

export async function getFeed(userId: string, cursor?: string, limit = 20, mode?: string) {
  // Get who user follows
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  });
  const followingIds = following.map(f => f.followingId);

  // Build WHERE clause for visibility
  // VIP posts are EXCLUDED until VIP membership is fully implemented
  const visibilityFilter: any = {
    OR: [
      { visibility: 'public' },
      { AND: [{ visibility: 'followers' }, { userId: { in: followingIds } }] }
      // VIP posts excluded from feed until membership is implemented
    ]
  };

  // If mode is 'following', only show posts from followed users
  if (mode === 'following') {
    visibilityFilter.OR = [
      { AND: [{ visibility: 'public' }, { userId: { in: followingIds } }] },
      { AND: [{ visibility: 'followers' }, { userId: { in: followingIds } }] }
    ];
  }

  // Add cursor filter if provided (using createdAt for simple cursor)
  let cursorFilter: any = {};
  if (cursor) {
    try {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        cursorFilter = {
          createdAt: { lt: cursorDate }
        };
      }
    } catch {
      // Invalid cursor, ignore
    }
  }

  // Fetch posts sorted by createdAt desc (simple cursor-based pagination)
  const posts = await prisma.post.findMany({
    where: {
      ...visibilityFilter,
      ...cursorFilter
    },
    include: {
      user: {
        select: { username: true, profileImage: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  // Calculate nextCursor from the last post's createdAt
  const nextCursor = posts.length > 0 
    ? posts[posts.length - 1].createdAt.toISOString()
    : null;

  return { posts, nextCursor };
}
