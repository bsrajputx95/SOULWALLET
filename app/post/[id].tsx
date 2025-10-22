import React, { useState } from 'react';
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

interface Comment {
  id: string;
  username: string;
  content: string;
  timestamp: string;
  isVerified: boolean;
  profileImage?: string;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);

  // @ts-ignore - Mock tRPC queries for development
  const postQuery = trpc.social.getPost.useQuery(
    { postId: id! },
    { enabled: !!id }
  );

  // @ts-ignore - Mock tRPC mutations for development
  const likePostMutation = trpc.social.likePost.useMutation({
    onSuccess: (data) => {
      setIsLiked(data.liked);
      postQuery.refetch();
    },
  });

  // @ts-ignore - Mock tRPC mutations for development
  const repostMutation = trpc.social.repost.useMutation({
    onSuccess: (data) => {
      setIsReposted(data.reposted);
      postQuery.refetch();
    },
  });

  // @ts-ignore - Mock tRPC mutations for development
  const addCommentMutation = trpc.social.addComment.useMutation({
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

  if (postQuery.error || !postQuery.data) {
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

  const post = postQuery.data;

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
                    {post.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <View style={styles.userRow}>
                  <TouchableOpacity onPress={() => router.push(`/profile/${post.username}`)}>
                    <Text style={styles.username}>
                      @{post.username}
                      {post.isVerified && <Text style={styles.verified}> 🛡️</Text>}
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
          
          {post.commentsList && post.commentsList.length > 0 ? (
            post.commentsList.map((comment: Comment) => (
              <NeonCard key={comment.id} style={styles.commentContainer}>
                <View style={styles.commentHeader}>
                  <View style={styles.profileContainer}>
                    {comment.profileImage ? (
                      <Image source={{ uri: comment.profileImage }} style={styles.commentAvatar} />
                    ) : (
                      <View style={[styles.commentAvatar, styles.defaultAvatar]}>
                        <Text style={styles.commentAvatarText}>
                          {comment.username.charAt(0).toUpperCase()}
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