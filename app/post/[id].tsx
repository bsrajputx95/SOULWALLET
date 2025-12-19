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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MessageSquare, Repeat, Heart, Send, X } from 'lucide-react-native';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { NeonCard } from '../../components/NeonCard';
import { trpc } from '../../lib/trpc';
import { useSocial } from '../../hooks/social-store';

interface Comment {
  id: string;
  username: string;
  content: string;
  timestamp: string;
  isVerified: boolean;
  profileImage?: string;
  likes?: number;
  createdAt?: string | number | Date;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const { posts } = useSocial();
  const [userVote, setUserVote] = useState<null | 'agree' | 'disagree'>(null);
  const [agreeCount, setAgreeCount] = useState<number>(80);
  const [disagreeCount, setDisagreeCount] = useState<number>(20);
  const [sortMode, setSortMode] = useState<'new' | 'old' | 'liked'>('new');

  // Mock tRPC queries for development - using any to bypass type checking
  const postQuery = (trpc as any).social.getPost.useQuery(
    { postId: id! },
    { enabled: !!id }
  );

  // Use correct API endpoint names
  const likePostMutation = trpc.social.toggleLike.useMutation({
    onSuccess: (data: any) => {
      setIsLiked(data.liked);
      postQuery.refetch();
    },
  });

  const repostMutation = trpc.social.createRepost.useMutation({
    onSuccess: () => {
      setIsReposted(true);
      postQuery.refetch();
    },
  });

  const addCommentMutation = trpc.social.createComment.useMutation({
    onSuccess: () => {
      setNewComment('');
      postQuery.refetch();
    },
  });

  const handleLike = () => {
    if (id) {
      likePostMutation.mutate({ postId: id });
    }
  };

  const handleRepost = () => {
    if (id) {
      repostMutation.mutate({ postId: id });
    }
  };

  const handleAddComment = () => {
    if (newComment.trim() && id) {
      addCommentMutation.mutate({
        postId: id,
        content: newComment.trim(),
      });
    }
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
      }
      return word + ' ';
    });
  };

  // Determine post data up front (server or offline), keeping hooks stable
  const offlinePost = posts.find(p => p.id === String(id));
  const post: any = postQuery.data ?? (offlinePost ? {
    ...offlinePost,
    commentsList: [
      {
        id: 'c1',
        username: 'ghostxsol',
        content: 'Solid take! Agree on the targets. 🚀',
        timestamp: '1h ago',
        isVerified: true,
        profileImage: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61',
        likes: 24,
        createdAt: Date.now() - 60 * 60 * 1000,
      },
      {
        id: 'c2',
        username: 'alphaWolf',
        content: 'Watching this closely. Entry looks clean.',
        timestamp: '45m ago',
        isVerified: true,
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
        likes: 15,
        createdAt: Date.now() - 45 * 60 * 1000,
      },
    ],
    agreeCount: 80,
    disagreeCount: 20,
  } : null);

  // Sync vote counts from server/offline post if available
  useEffect(() => {
    if (!post) return;
    if (typeof (post as any)?.agreeCount === 'number') {
      setAgreeCount((post as any).agreeCount);
    }
    if (typeof (post as any)?.disagreeCount === 'number') {
      setDisagreeCount((post as any).disagreeCount);
    }
  }, [post]);

  // Early returns AFTER hooks to keep hook order stable
  if (postQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.solana} />
        </View>
      </SafeAreaView>
    );
  }

  if (postQuery.error && !offlinePost) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalVotes = Math.max(agreeCount + disagreeCount, 0.0001);
  const agreePercent = Math.round((agreeCount / totalVotes) * 100);
  const disagreePercent = 100 - agreePercent;

  const handleVote = (choice: 'agree' | 'disagree') => {
    setUserVote(prev => {
      if (prev === choice) return prev;
      if (prev === null) {
        if (choice === 'agree') setAgreeCount(c => c + 1);
        else setDisagreeCount(c => c + 1);
      } else {
        if (choice === 'agree') {
          setAgreeCount(c => c + 1);
          setDisagreeCount(c => Math.max(c - 1, 0));
        } else {
          setDisagreeCount(c => c + 1);
          setAgreeCount(c => Math.max(c - 1, 0));
        }
      }
      return choice;
    });
  };

  // Helpers for sorting
  const parseRelativeTime = (text?: string) => {
    if (!text) return 0;
    const m = text.match(/(\d+)\s*([smhdw])\s*ago/i);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const msMap: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };
    return Date.now() - n * (msMap[unit] || 0);
  };

  const getTime = (c: Comment, idx: number) => {
    if (c.createdAt) return new Date(c.createdAt).getTime();
    const rel = parseRelativeTime(c.timestamp);
    return rel || idx; // fallback
  };

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
              {post.profileImage ? (
                <Image source={{ uri: post.profileImage }} style={styles.avatar} />
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
                      {(post.isVerified || post.user?.isVerified) && <Text style={styles.verified}> 🛡️</Text>}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                  >
                    <X size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.timestamp}>{post.timestamp}</Text>
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
              disabled={likePostMutation.isPending}
            >
              <Heart
                size={20}
                color={isLiked ? COLORS.error : COLORS.textSecondary}
                fill={isLiked ? COLORS.error : 'none'}
              />
              <Text style={[styles.actionCount, isLiked && styles.likedText]}>
                {post.likes}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.action}
              onPress={handleRepost}
              disabled={repostMutation.isPending}
            >
              <Repeat
                size={20}
                color={isReposted ? COLORS.success : COLORS.textSecondary}
              />
              <Text style={[styles.actionCount, isReposted && styles.repostedText]}>
                {post.reposts}
              </Text>
            </TouchableOpacity>

            <View style={styles.action}>
              <MessageSquare size={20} color={COLORS.textSecondary} />
              <Text style={styles.actionCount}>{post.comments}</Text>
            </View>
          </View>
        </NeonCard>
        {/* Index: Agree / Disagree (moved above comment input) */}
        <NeonCard style={styles.indexCard}>
          <View style={styles.indexHeaderRow}>
            <Text style={styles.indexTitle}>Index</Text>
          </View>
          <View style={styles.voteRow}>
            <TouchableOpacity
              style={[styles.voteChip, userVote === 'agree' && styles.voteChipSelected]}
              onPress={() => handleVote('agree')}
            >
              <Text style={[styles.voteText, userVote === 'agree' && styles.voteTextSelected]}>Agree</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteChip, userVote === 'disagree' && styles.voteChipSelected]}
              onPress={() => handleVote('disagree')}
            >
              <Text style={[styles.voteText, userVote === 'disagree' && styles.voteTextSelected]}>Disagree</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.indexBarContainer}>
            <View style={[styles.indexBarAgree, { flex: Math.max(agreeCount, 0) }]} />
            <View style={[styles.indexBarDisagree, { flex: Math.max(disagreeCount, 0) }]} />
          </View>
          <View style={styles.indexBarLabels}>
            <Text style={styles.indexBarLabel}>Agree {agreePercent}%</Text>
            <Text style={styles.indexBarLabel}>Disagree {disagreePercent}%</Text>
          </View>
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
              disabled={!newComment.trim() || addCommentMutation.isPending}
            >
              {addCommentMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Send size={20} color={COLORS.textPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </NeonCard>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments ({post.commentsList?.length || 0})</Text>
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

          {post.commentsList && post.commentsList.length > 0 ? (
            [...post.commentsList].sort((a: Comment, b: Comment) => {
              if (sortMode === 'liked') {
                return (b.likes || 0) - (a.likes || 0);
              }
              const ta = getTime(a, 0);
              const tb = getTime(b, 0);
              return sortMode === 'new' ? tb - ta : ta - tb;
            }).map((comment: Comment) => (
              <NeonCard key={comment.id} style={styles.commentContainer}>
                <View style={styles.commentHeader}>
                  <View style={styles.profileContainer}>
                    {comment.profileImage ? (
                      <Image source={{ uri: comment.profileImage }} style={styles.commentAvatar} />
                    ) : (
                      <View style={[styles.commentAvatar, styles.defaultAvatar]}>
                        <Text style={styles.commentAvatarText}>
                          {(comment.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentUserInfo}>
                      <TouchableOpacity onPress={() => router.push(`/profile/${comment.username}`)}>
                        <Text style={styles.commentUsername}>
                          @{comment.username}
                          {comment.isVerified && <Text style={styles.verified}> 🛡️</Text>}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.commentTimestamp}>{comment.timestamp}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.commentContent}>{formatContent(comment.content)}</Text>
                {typeof comment.likes === 'number' && (
                  <View style={{ marginTop: SPACING.xs }}>
                    <Text style={{ ...FONTS.phantomRegular, color: COLORS.textSecondary, fontSize: 12 }}>
                      {comment.likes} likes
                    </Text>
                  </View>
                )}
              </NeonCard>
            ))
          ) : (
            <View style={styles.noCommentsContainer}>
              <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
            </View>
          )}
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
    paddingHorizontal: SPACING.l,
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
    marginBottom: SPACING.m,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.m,
  },
  defaultAvatar: {
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
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
    fontSize: 16,
    fontWeight: '600',
  },
  verified: {
    fontSize: 16,
  },
  timestamp: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
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
  voteRow: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
  },
  voteChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.small,
    backgroundColor: COLORS.cardBackground,
    marginRight: SPACING.s,
  },
  voteChipSelected: {
    backgroundColor: COLORS.solana + '30',
  },
  voteText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  voteTextSelected: {
    color: COLORS.textPrimary,
  },
  indexBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: BORDER_RADIUS.small,
    overflow: 'hidden',
    backgroundColor: COLORS.cardBackground,
  },
  indexBarAgree: {
    backgroundColor: COLORS.success + '70',
  },
  indexBarDisagree: {
    backgroundColor: COLORS.error + '70',
  },
  indexBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  indexBarLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
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