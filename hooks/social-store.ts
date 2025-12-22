import { useState } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { trpc } from '@/lib/trpc';

export interface TraderProfile {
  id: string;
  username: string;
  profileImage?: string;
  isVerified: boolean;
  badge?: 'elite' | 'general' | 'pro' | 'vip';
  followers: number;
  following: number;
  copyTraders: number;
  roi30d: number;
  vipFollowers: number;
  pnl24h: number;
  maxDrawdown: number;
  winRate: number;
  vipPrice?: number;
}

export interface SocialPost {
  id: string;
  username: string;
  profileImage?: string;
  isVerified: boolean;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  reposts: number;
  mentionedToken?: string;
  mentionedTokenMint?: string;
  visibility?: 'public' | 'vip' | 'followers';
}

export const [SocialProvider, useSocial] = createContextHook(() => {
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);

  // Fetch feed from backend
  const feedQuery = trpc.social.getFeed.useQuery({
    feedType: 'all',
    limit: 20,
  }, {
    refetchInterval: 30000,
  });

  // Fetch top traders
  const tradersQuery = trpc.copyTrading.getTopTraders.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Transform traders data
  const traders: TraderProfile[] = tradersQuery.data?.map(trader => ({
    id: trader.id,
    username: trader.username || 'Unknown',
    profileImage: trader.avatarUrl,
    isVerified: trader.isFeatured,
    badge: 'general',
    followers: trader.totalFollowers,
    following: 0,
    copyTraders: trader.activeFollowers || 0,
    roi30d: trader.roi30d,
    vipFollowers: 0,
    pnl24h: 0,
    maxDrawdown: 0,
    winRate: trader.winRate,
    vipPrice: undefined,
  })) || [];

  // Transform posts data
  const posts: SocialPost[] = feedQuery.data?.posts.map(post => ({
    id: post.id,
    username: post.user.username,
    profileImage: post.user.profileImage || undefined,
    isVerified: post.user.isVerified,
    content: post.content,
    timestamp: new Date(post.createdAt).toLocaleString(),
    likes: post.likesCount,
    comments: post.commentsCount,
    reposts: post.repostsCount,
    mentionedToken: post.mentionedTokenSymbol || post.mentionedTokenName || (post.mentionedTokenMint ? `${post.mentionedTokenMint.slice(0, 6)}...` : undefined),
    mentionedTokenMint: post.mentionedTokenMint || undefined,
    visibility: post.visibility === 'PUBLIC' ? 'public' : post.visibility === 'VIP' ? 'vip' : 'followers',
  })) || [];

  // Get trader profile by username
  const getTraderProfile = (username: string): TraderProfile | undefined => {
    return traders.find(trader => trader.username === username);
  };

  // Follow/unfollow user
  const toggleFollowMutation = trpc.social.toggleFollow.useMutation();

  const toggleFollow = async (userId: string) => {
    await toggleFollowMutation.mutateAsync({ userId });
    await feedQuery.refetch();
  };

  // Check if user is followed
  const isFollowing = (username: string): boolean => {
    return followedUsers.includes(username);
  };

  return {
    traders,
    posts,
    getTraderProfile,
    toggleFollow,
    isFollowing,
    followedUsers,
  };
});
