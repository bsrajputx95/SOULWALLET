import { api } from './api';

export interface Post {
  id: string;
  userId: string;
  content: string;
  visibility: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  hashtags?: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  user: {
    username: string;
    profileImage?: string;
  };
  isLiked?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
    profileImage?: string;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  profileImage?: string;
  walletAddress?: string;
  followers: number;
  following: number;
  postsCount: number;
  copyTraderCount: number;
  isFollowing: boolean;
  isCopying: boolean;
  roi30d: number;
  winRate: number;
  maxDrawdown?: number;
  followersEquity?: number;
}

export interface TokenMetadata {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenVerified?: boolean;
  tokenPrice?: number;
}

// Extract hashtags from content
export const extractHashtags = (content: string): string[] => {
  const matches = content.match(/#[\w]+/g);
  if (!matches) return [];
  // Return unique lowercase hashtags without the # prefix
  return [...new Set(matches.map(tag => tag.slice(1).toLowerCase()))];
};

export const createPost = async (
  content: string,
  visibility: string = 'public',
  tokenMetadata?: TokenMetadata
): Promise<{ success: boolean; post?: Post; error?: string }> => {
  try {
    const payload: any = {
      content,
      visibility,
    };

    if (tokenMetadata) {
      payload.tokenAddress = tokenMetadata.tokenAddress;
      payload.tokenSymbol = tokenMetadata.tokenSymbol;
      payload.tokenName = tokenMetadata.tokenName;
      payload.tokenVerified = tokenMetadata.tokenVerified;
      payload.tokenPriceAtPost = tokenMetadata.tokenPrice;
    }

    // Auto-extract hashtags from content
    const hashtags = extractHashtags(content);
    if (hashtags.length > 0) {
      payload.hashtags = hashtags;
    }

    const response = await api.post<{ success: boolean; post: Post }>('/posts', payload);
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchMe = async (): Promise<{ success: boolean; user?: { id: string; username: string; email: string; profileImage?: string }; error?: string }> => {
  try {
    const response = await api.get<{ success: boolean; user: { id: string; username: string; email: string; profileImage?: string } }>('/me');
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchFeed = async (
  cursor?: string,
  mode?: string
): Promise<{ success: boolean; posts?: Post[]; nextCursor?: string | null; error?: string }> => {
  try {
    let url = `/feed?limit=20`;
    if (cursor) url += `&cursor=${cursor}`;
    if (mode) url += `&mode=${mode}`;
    const response = await api.get<{ success: boolean; posts: Post[]; nextCursor?: string | null }>(url);
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchPost = async (
  postId: string
): Promise<{ success: boolean; post?: Post & { comments: Comment[] }; error?: string }> => {
  try {
    const response = await api.get<{ success: boolean; post: Post & { comments: Comment[] } }>(`/posts/${postId}`);
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deletePost = async (
  postId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await api.delete<{ success: boolean }>(`/posts/${postId}`);
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const toggleLike = async (
  postId: string
): Promise<{ success: boolean; liked?: boolean; error?: string }> => {
  try {
    const response = await api.post<{ success: boolean; liked: boolean }>(`/posts/${postId}/like`, {});
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const addComment = async (
  postId: string,
  content: string
): Promise<{ success: boolean; comment?: Comment; error?: string }> => {
  try {
    const response = await api.post<{ success: boolean; comment: Comment }>(`/posts/${postId}/comment`, {
      content
    });
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchUserProfile = async (
  username: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> => {
  try {
    const response = await api.get<{ success: boolean; user: UserProfile }>(`/users/${username}`);
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchUserPosts = async (
  username: string,
  visibility?: 'public' | 'followers' | 'vip'
): Promise<{ success: boolean; posts?: Post[]; error?: string }> => {
  try {
    const url = visibility
      ? `/users/${username}/posts?visibility=${visibility}`
      : `/users/${username}/posts`;
    const response = await api.get<{ success: boolean; posts: Post[] }>(url);
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const toggleFollow = async (
  userId: string
): Promise<{ success: boolean; following?: boolean; error?: string }> => {
  try {
    const response = await api.post<{ success: boolean; following: boolean }>(`/users/${userId}/follow`, {});
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const verifyToken = async (
  address: string
): Promise<{ valid: boolean; symbol?: string; price?: number }> => {
  try {
    const res = await fetch(`https://price.jup.ag/v6/price?ids=${address}`);
    const data = await res.json();

    if (data.data && data.data[address]) {
      return {
        valid: true,
        symbol: data.data[address].mintSymbol,
        price: data.data[address].price
      };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
};

// Vote on post (agree/disagree)
export const voteOnPost = async (
  postId: string,
  type: 'agree' | 'disagree'
): Promise<{ success: boolean; vote?: any; error?: string }> => {
  try {
    const response = await api.post<{ success: boolean; vote: any }>(`/posts/${postId}/vote`, { type });
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Get vote counts for a post
export const getPostVotes = async (
  postId: string
): Promise<{
  success: boolean;
  agreeCount?: number;
  disagreeCount?: number;
  totalVotes?: number;
  agreePercent?: number;
  disagreePercent?: number;
  userVote?: string | null;
  error?: string;
}> => {
  try {
    const response = await api.get<{
      success: boolean;
      agreeCount: number;
      disagreeCount: number;
      totalVotes: number;
      agreePercent: number;
      disagreePercent: number;
      userVote: string | null;
    }>(`/posts/${postId}/votes`);
    return response;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
