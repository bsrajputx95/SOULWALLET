import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MessageSquare, Repeat, Heart, Send, X, Share2 } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { NeonCard, TokenCard } from '@/components';
import { fetchPost, toggleLike, addComment, voteOnPost, getPostVotes } from '@/services/social';
import { useAlert } from '@/contexts/AlertContext';

// Post data interface
interface PostData {
  id: string;
  content: string;
  userId: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  isLiked?: boolean;
  tokenSymbol?: string;
  tokenAddress?: string;
  profileImage?: string;
  username?: string;
  user: {
    username: string;
    profileImage?: string;
  };
  comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: {
      username: string;
      profileImage?: string;
    };
  }>;
}

interface TokenInfo {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  logo?: string;
}



export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sortMode, setSortMode] = useState<'new' | 'old' | 'liked'>('new');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load post on mount
  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    if (!id) return;
    setLoading(true);
    const result = await fetchPost(id);
    if (result.success && result.post) {
      setPost(result.post as PostData);
      // Fetch token info if post has a token
      if (result.post.tokenAddress) {
        fetchTokenInfo(result.post.tokenAddress);
      }
    }
    setLoading(false);
  };

  // Token info state
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  const fetchTokenInfo = async (mint: string) => {
    try {
      let symbol = '';
      let name = '';
      let logo = '';
      let price = 0;
      let change24h = 0;

      // Try Jupiter API for metadata
      try {
        const res = await fetch(`https://api.jup.ag/tokens/v1/token/${mint}`);
        if (res.ok) {
          const data = await res.json();
          symbol = data.symbol || '';
          name = data.name || '';
          logo = data.logoURI || '';
        }
      } catch { /* ignore */ }

      // Get price + fallback metadata from DexScreener
      try {
        const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const priceData = await priceRes.json();
        if (priceData.pairs && priceData.pairs.length > 0) {
          const pair = priceData.pairs[0];
          price = parseFloat(pair.priceUsd || '0');
          change24h = pair.priceChange?.h24 || 0;
          // Use DexScreener data as fallback for missing fields
          if (!symbol) symbol = pair.baseToken?.symbol || '';
          if (!name) name = pair.baseToken?.name || '';
          if (!logo && pair.info?.imageUrl) logo = pair.info.imageUrl;
        }
      } catch { /* ignore */ }

      // Last resort: use post's tokenSymbol
      if (!symbol && post?.tokenSymbol) symbol = post.tokenSymbol;
      if (!name) name = symbol;

      setTokenInfo({ symbol, name, price, change24h, logo });
    } catch { /* ignore */ }
  };

  // Get counts from post
  const likeCount = post?.likesCount || 0;
  const isLiked = post?.isLiked || false;
  const { showAlert } = useAlert();

  // Handlers
  const handleLike = async () => {
    if (!id) return;
    const result = await toggleLike(id);
    if (result.success) {
      await loadPost();
    }
  };

  const handleRepost = () => {
    showAlert('Coming Soon', 'Repost functionality will be available soon.');
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;
    setIsSubmitting(true);
    const result = await addComment(id, newComment.trim());
    if (result.success) {
      setNewComment('');
      await loadPost();
    }
    setIsSubmitting(false);
  };

  // Vote state
  const [voteData, setVoteData] = useState({
    agreeCount: 0,
    disagreeCount: 0,
    totalVotes: 0,
    agreePercent: 0,
    disagreePercent: 0,
    userVote: null as string | null,
  });
  const [isVoting, setIsVoting] = useState(false);

  // Load votes when post loads
  useEffect(() => {
    if (id) {
      loadVotes();
    }
  }, [id]);

  const loadVotes = async () => {
    const result = await getPostVotes(id);
    if (result.success) {
      setVoteData({
        agreeCount: result.agreeCount || 0,
        disagreeCount: result.disagreeCount || 0,
        totalVotes: result.totalVotes || 0,
        agreePercent: result.agreePercent || 0,
        disagreePercent: result.disagreePercent || 0,
        userVote: result.userVote || null,
      });
    }
  };

  const handleVote = async (choice: 'agree' | 'disagree') => {
    if (isVoting || voteData.userVote) return; // Already voted or voting in progress

    setIsVoting(true);
    const result = await voteOnPost(id, choice);
    if (result.success) {
      // Refresh vote data
      await loadVotes();
    } else if (result.error?.includes('already voted')) {
      showAlert('Already Voted', 'You can only vote once on this post.');
      // Refresh to get the actual vote
      await loadVotes();
    } else {
      showAlert('Error', result.error || 'Failed to vote');
    }
    setIsVoting(false);
  };

  // Format timestamp helper
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleShare = async () => {
    if (!id) return;
    const postLink = `soulwallet/post/${id}`;
    await Clipboard.setStringAsync(postLink);
    showAlert('Link Copied!', `Share this link:\n\n${postLink}\n\nPaste it in search or a post to share.`);
  };

  const formatContent = (text: string) => {
    return text.split(' ').map((word, index) => {
      if (word.startsWith('#')) {
        return (
          <Text key={index} style={styles.hashtag}>
            {word}{' '}
          </Text>
        );
      } else if (word.startsWith('@')) {
        return (
          <Text key={index} style={styles.mention}>
            {word}{' '}
          </Text>
        );
      } else if (word.startsWith('$')) {
        return (
          <Text key={index} style={styles.token}>
            {word}{' '}
          </Text>
        );
      } else if (word.includes('soulwallet/post/')) {
        // Clickable post link - extract postId from soulwallet/post/ID format
        const postIdMatch = word.match(/soulwallet\/post\/([a-zA-Z0-9_-]+)/);
        if (postIdMatch) {
          const postId = postIdMatch[1];
          return (
            <Text
              key={index}
              style={styles.postLink}
              onPress={() => router.push(`/post/${postId}`)}
            >
              {word}{' '}
            </Text>
          );
        }
      }
      return word + ' ';
    });
  };



  // Show loading fallback if no post data
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.solana} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use vote data from state
  const { agreePercent, disagreePercent } = voteData;
  const hasVotes = voteData.agreeCount + voteData.disagreeCount > 0;



  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Post */}
        <NeonCard style={styles.postContainer}>
          <View style={styles.postHeader}>
            <View style={styles.profileContainer}>
              {post.user?.profileImage || post.profileImage ? (
                <Image source={{ uri: post.user?.profileImage || post.profileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.defaultAvatar]}>
                  <Text style={styles.avatarText}>
                    {(post.username || post.user?.username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <View style={styles.userRow}>
                  <TouchableOpacity onPress={() => router.push(`/profile/${post.username || post.user?.username}`)}>
                    <Text style={styles.username}>
                      @{post.username || post.user?.username}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                  >
                    <X size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.timestamp}>{formatTimestamp(post.createdAt)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.postContent}>
            <Text style={styles.postText}>{formatContent(post.content)}</Text>
          </View>

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.action}
              onPress={handleLike}
              disabled={false}
            >
              <Heart
                size={20}
                color={isLiked ? COLORS.error : COLORS.textSecondary}
                fill={isLiked ? COLORS.error : 'none'}
              />
              <Text style={[styles.actionCount, isLiked && styles.likedText]}>
                {likeCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.action}
              onPress={handleRepost}
            >
              <Repeat size={20} color={COLORS.textSecondary} />
              <Text style={styles.actionCount}>0</Text>
            </TouchableOpacity>

            <View style={styles.action}>
              <MessageSquare size={20} color={COLORS.textSecondary} />
              <Text style={styles.actionCount}>{post.commentsCount || 0}</Text>
            </View>

            <TouchableOpacity style={styles.action} onPress={handleShare}>
              <Share2 size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </NeonCard>

        {/* Token Info Card - only if post has a token */}
        {post.tokenAddress && tokenInfo && (
          <TokenCard
            symbol={tokenInfo.symbol}
            name={tokenInfo.name}
            price={tokenInfo.price}
            change={tokenInfo.change24h}
            logo={tokenInfo.logo || ''}
            onPress={() => {
              router.push({
                pathname: `/coin/${tokenInfo.symbol.toLowerCase()}` as any,
                params: {
                  symbol: tokenInfo.symbol,
                  name: tokenInfo.name,
                  price: tokenInfo.price.toString(),
                  change: tokenInfo.change24h.toString(),
                  logo: tokenInfo.logo || '',
                  contractAddress: post.tokenAddress || '',
                },
              });
            }}
          />
        )}

        {/* Index: Agree / Disagree */}
        <NeonCard style={styles.indexCard}>
          <View style={styles.indexHeaderRow}>
            <Text style={styles.indexTitle}>Community Sentiment</Text>
            {voteData.totalVotes > 0 && (
              <Text style={styles.indexSubtitle}>{voteData.totalVotes} votes</Text>
            )}
          </View>
          <View style={styles.voteRow}>
            <TouchableOpacity
              style={[
                styles.voteChip,
                voteData.userVote === 'agree' && styles.voteChipSelectedAgree,
                voteData.userVote && voteData.userVote !== 'agree' && styles.voteChipDisabled
              ]}
              onPress={() => handleVote('agree')}
              disabled={isVoting || !!voteData.userVote}
            >
              <Text style={[
                styles.voteText,
                voteData.userVote === 'agree' && styles.voteTextSelected,
                voteData.userVote && voteData.userVote !== 'agree' && styles.voteTextDisabled
              ]}>
                {voteData.userVote === 'agree' ? '✓ Agree' : 'Agree'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.voteChip,
                voteData.userVote === 'disagree' && styles.voteChipSelectedDisagree,
                voteData.userVote && voteData.userVote !== 'disagree' && styles.voteChipDisabled
              ]}
              onPress={() => handleVote('disagree')}
              disabled={isVoting || !!voteData.userVote}
            >
              <Text style={[
                styles.voteText,
                voteData.userVote === 'disagree' && styles.voteTextSelected,
                voteData.userVote && voteData.userVote !== 'disagree' && styles.voteTextDisabled
              ]}>
                {voteData.userVote === 'disagree' ? '✓ Disagree' : 'Disagree'}
              </Text>
            </TouchableOpacity>
          </View>
          {hasVotes ? (
            <>
              <View style={styles.indexBarContainer}>
                <View
                  style={[
                    styles.indexBarAgree,
                    { flex: agreePercent || 1 }
                  ]}
                />
                <View
                  style={[
                    styles.indexBarDisagree,
                    { flex: disagreePercent || 1 }
                  ]}
                />
              </View>
              <View style={styles.indexBarLabels}>
                <Text style={styles.indexBarLabelAgree}>Agree {agreePercent}%</Text>
                <Text style={styles.indexBarLabelDisagree}>Disagree {disagreePercent}%</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noVotesText}>Be the first to vote!</Text>
          )}
        </NeonCard>

        {/* Add Comment */}
        <NeonCard style={styles.commentInputContainer}>
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor={COLORS.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !newComment.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleAddComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Send size={20} color={COLORS.textPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </NeonCard>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({post?.comments?.length || post?.commentsCount || 0})
          </Text>
          <View style={styles.sortRow}>
            <TouchableOpacity
              style={[styles.sortChip, sortMode === 'new' && styles.sortChipSelected]}
              onPress={() => setSortMode('new')}
            >
              <Text style={[styles.sortText, sortMode === 'new' && styles.sortTextSelected]}>New</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortChip, sortMode === 'old' && styles.sortChipSelected]}
              onPress={() => setSortMode('old')}
            >
              <Text style={[styles.sortText, sortMode === 'old' && styles.sortTextSelected]}>Old</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortChip, sortMode === 'liked' && styles.sortChipSelected]}
              onPress={() => setSortMode('liked')}
            >
              <Text style={[styles.sortText, sortMode === 'liked' && styles.sortTextSelected]}>Most liked</Text>
            </TouchableOpacity>
          </View>

          {/* Use comments from store */}
          {(() => {
            const comments = post?.comments || [];

            if (comments.length > 0) {
              return [...comments].sort((a: any, b: any) => {
                if (sortMode === 'liked') {
                  return ((b.likes || b._count?.likes) || 0) - ((a.likes || a._count?.likes) || 0);
                }
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return sortMode === 'new' ? tb - ta : ta - tb;
              }).map((comment: any) => (
                <NeonCard key={comment.id} style={styles.commentContainer}>
                  <View style={styles.commentHeader}>
                    <View style={styles.profileContainer}>
                      {comment.profileImage || comment.user?.profileImage ? (
                        <Image source={{ uri: comment.profileImage || comment.user?.profileImage }} style={styles.commentAvatar} />
                      ) : (
                        <View style={[styles.commentAvatar, styles.defaultAvatar]}>
                          <Text style={styles.commentAvatarText}>
                            {(comment.username || comment.user?.username || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.commentUserInfo}>
                        <TouchableOpacity onPress={() => router.push(`/profile/${comment.username || comment.user?.username}`)}>
                          <Text style={styles.commentUsername}>
                            @{comment.username || comment.user?.username}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.commentTimestamp}>
                          {comment.timestamp || (comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : '')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.commentContent}>{formatContent(comment.content)}</Text>
                  {typeof (comment.likes || comment._count?.likes) === 'number' && (
                    <View style={{ marginTop: SPACING.xs }}>
                      <Text style={{ ...FONTS.phantomRegular, color: COLORS.textSecondary, fontSize: 12 }}>
                        {comment.likes || comment._count?.likes || 0} likes
                      </Text>
                    </View>
                  )}
                </NeonCard>
              ));
            } else {
              return (
                <View style={styles.noCommentsContainer}>
                  <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
                </View>
              );
            }
          })()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.s, // Reduced for edge-to-edge layout
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...FONTS.phantomRegular,
    color: COLORS.error,
    fontSize: 16,
  },
  postContainer: {
    marginTop: SPACING.m,
    marginBottom: SPACING.m,
  },
  postHeader: {
    marginTop: -SPACING.m,
    marginLeft: -SPACING.m,
    marginBottom: SPACING.xs,
    paddingTop: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 33,
    height: 33,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.xs,
  },
  defaultAvatar: {
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 12,
  },
  userInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
    marginLeft: 8,
  },
  username: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  verified: {
    fontSize: 16,
  },
  timestamp: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  postContent: {
    marginBottom: SPACING.m,
  },
  postText: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  hashtag: {
    color: COLORS.solana,
  },
  mention: {
    color: COLORS.solana,
  },
  token: {
    color: COLORS.success,
  },
  postLink: {
    color: COLORS.solana,
    textDecorationLine: 'underline',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBackground,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
  },
  actionCount: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: SPACING.s,
  },
  likedText: {
    color: COLORS.error,
  },
  repostedText: {
    color: COLORS.success,
  },
  commentInputContainer: {
    marginBottom: SPACING.m,
  },
  indexCard: {
    marginTop: SPACING.m,
    marginBottom: SPACING.m,
  },
  indexHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  indexTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  indexSubtitle: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  voteRow: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
  },
  voteChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.cardBackground,
    marginRight: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  voteChipSelectedAgree: {
    backgroundColor: COLORS.success + '30',
    borderColor: COLORS.success,
  },
  voteChipSelectedDisagree: {
    backgroundColor: COLORS.error + '30',
    borderColor: COLORS.error,
  },
  voteChipDisabled: {
    opacity: 0.5,
  },
  voteText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  voteTextSelected: {
    color: COLORS.textPrimary,
  },
  voteTextDisabled: {
    color: COLORS.textSecondary + '80',
  },
  indexBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: BORDER_RADIUS.small,
    overflow: 'hidden',
    backgroundColor: COLORS.cardBackground,
  },
  indexBarAgree: {
    backgroundColor: COLORS.success,
  },
  indexBarDisagree: {
    backgroundColor: COLORS.error,
  },
  indexBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  indexBarLabelAgree: {
    ...FONTS.phantomMedium,
    color: COLORS.success,
    fontSize: 12,
  },
  indexBarLabelDisagree: {
    ...FONTS.phantomMedium,
    color: COLORS.error,
    fontSize: 12,
  },
  indexBarLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  noVotesText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.s,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  commentInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: SPACING.s,
    paddingRight: SPACING.m,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textSecondary + '50',
  },
  commentsSection: {
    marginBottom: SPACING.xl,
  },
  commentsTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.m,
  },
  sortRow: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
  },
  sortChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.small,
    backgroundColor: COLORS.cardBackground,
    marginRight: SPACING.s,
  },
  sortChipSelected: {
    backgroundColor: COLORS.solana + '30',
  },
  sortText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  sortTextSelected: {
    color: COLORS.textPrimary,
  },
  commentContainer: {
    marginBottom: SPACING.m,
  },
  commentHeader: {
    marginBottom: SPACING.s,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.s,
  },
  commentAvatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  commentUserInfo: {
    flex: 1,
  },
  commentUsername: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  commentTimestamp: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  commentContent: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  noCommentsContainer: {
    padding: SPACING.l,
    alignItems: 'center',
  },
  noCommentsText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});

