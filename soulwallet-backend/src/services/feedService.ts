import prisma from '../db';

const GLOBAL_USERS = ['soulwallet', 'bhavanisingh'];

export async function getFeed(userId: string, cursor?: string, limit = 20, mode?: string) {
  // Get who user follows
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  });
  const followingIds = following.map(f => f.followingId);

  // Get global user IDs (their posts show everywhere)
  const globalUsers = await prisma.user.findMany({
    where: { username: { in: GLOBAL_USERS } },
    select: { id: true }
  });
  const globalUserIds = globalUsers.map(u => u.id);

  // Build WHERE clause for visibility
  // VIP posts are EXCLUDED until VIP membership is fully implemented
  const visibilityFilter: any = {
    OR: [
      { visibility: 'public' },
      { AND: [{ visibility: 'followers' }, { userId: { in: followingIds } }] },
      // Global users' posts show everywhere (public or followers-only)
      { userId: { in: globalUserIds } }
    ]
  };

  // If mode is 'following', only show posts from followed users + global users
  if (mode === 'following') {
    visibilityFilter.OR = [
      { AND: [{ visibility: 'public' }, { userId: { in: followingIds } }] },
      { AND: [{ visibility: 'followers' }, { userId: { in: followingIds } }] },
      { userId: { in: globalUserIds } } // Global users always show
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
