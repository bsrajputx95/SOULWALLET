import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, Image, Pressable } from 'react-native';
import { MessageSquare, Repeat, Heart, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { SafeHtmlText } from './SafeHtml';
import { trpc } from '../lib/trpc';

interface SocialPostProps {
  id: string;
  username: string;
  profileImage?: string;
  content: string;
  images?: string[];
  comments: number;
  reposts: number;
  likes: number;
  timestamp: string;
  mentionedToken?: string;
  mentionedTokenMint?: string;
  isVerified?: boolean;
  onPress?: () => void;
  onBuyPress?: () => void;
  onUpdate?: () => void;
}

export const SocialPost: React.FC<SocialPostProps> = React.memo(({
  id,
  username,
  profileImage,
  content,
  images,
  comments,
  reposts,
  likes,
  timestamp,
  mentionedToken,
  isVerified = false,
  onPress,
  onBuyPress,
  onUpdate,
}) => {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [currentLikes, setCurrentLikes] = useState(likes);
  const [currentReposts, setCurrentReposts] = useState(reposts);
  const [isProcessing, setIsProcessing] = useState(false);

  // API mutations for like/repost
  const toggleLikeMutation = trpc.social.toggleLike.useMutation({
    onSuccess: (result) => {
      setIsLiked(result.liked);
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      console.error('[SocialPost] Like error:', error);
      // Revert optimistic update
      setIsLiked(!isLiked);
      setCurrentLikes(isLiked ? currentLikes + 1 : currentLikes - 1);
    },
  });

  const createRepostMutation = trpc.social.createRepost.useMutation({
    onSuccess: () => {
      setIsReposted(true);
      setCurrentReposts(currentReposts + 1);
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      console.error('[SocialPost] Repost error:', error);
      // Revert optimistic update
      setIsReposted(false);
      setCurrentReposts(currentReposts - 1);
    },
  });

  const deleteRepostMutation = trpc.social.deleteRepost.useMutation({
    onSuccess: () => {
      setIsReposted(false);
      setCurrentReposts(currentReposts - 1);
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      console.error('[SocialPost] Delete repost error:', error);
      // Revert optimistic update
      setIsReposted(true);
      setCurrentReposts(currentReposts + 1);
    },
  });

  const handleUsernamePress = useCallback(() => {
    router.push(`/profile/${username}`);
  }, [router, username]);

  const handleTokenPress = useCallback((token: string) => {
    // Remove $ and navigate to coin details
    const symbol = token.replace('$', '');
    router.push(`/coin/${symbol.toLowerCase()}`);
  }, [router]);

  const handlePostPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/post/${id}`);
    }
  };

  const handleLike = (e: any) => {
    e.stopPropagation();
    if (isProcessing || toggleLikeMutation.isPending) return;

    // Optimistic update
    setIsLiked(!isLiked);
    setCurrentLikes(isLiked ? currentLikes - 1 : currentLikes + 1);

    // Call API
    toggleLikeMutation.mutate({ postId: id });
  };

  const handleRepost = (e: any) => {
    e.stopPropagation();
    if (isProcessing || createRepostMutation.isPending || deleteRepostMutation.isPending) return;

    // Optimistic update
    const wasReposted = isReposted;
    setIsReposted(!isReposted);
    setCurrentReposts(wasReposted ? currentReposts - 1 : currentReposts + 1);

    // Call API
    if (wasReposted) {
      deleteRepostMutation.mutate({ postId: id });
    } else {
      createRepostMutation.mutate({ postId: id });
    }
  };

  const handleComment = (e: any) => {
    e.stopPropagation();
    router.push(`/post/${id}`);
  };

  const formattedContent = useMemo(() => {
    // Format hashtags, mentions, and tokens
    return content.split(' ').map((word, index) => {
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
          <Text
            key={index}
            style={styles.token}
            onPress={() => handleTokenPress(word)}
          >
            {word}{' '}
          </Text>
        );
      }
      return word + ' ';
    });
  }, [content, handleTokenPress]);

  return (
    <Pressable
      onPress={handlePostPress}
      accessibilityRole="button"
      accessibilityLabel={`Open post by ${username}`}
      accessibilityHint="Opens post details with comments"
    >
      <NeonCard style={styles.container}>
        <View style={styles.header}>
          <View style={styles.profileContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.defaultAvatar]}>
                <Text style={styles.avatarText}>
                  {username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Pressable onPress={(e) => { e.stopPropagation(); handleUsernamePress(); }}>
                <Text style={styles.username}>
                  @{username}
                  {isVerified && <Text style={styles.verified}> 🛡️</Text>}
                </Text>
              </Pressable>
              <Text style={styles.timestamp}>{timestamp}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handlePostPress}
          style={styles.contentContainer}
          accessibilityRole="button"
          accessibilityLabel={`Post by ${username}: ${content.substring(0, 100)}`}
          accessibilityHint="Double tap to view full post"
        >
          <SafeHtmlText
            html={content}
            style={styles.content}
            maxLength={500}
          />
          {images && images.length > 0 && (
            <View style={styles.imagesContainer}>
              {images.map((imageUrl, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUrl }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}
        </Pressable>

        <View style={styles.actionsContainer}>
          <View style={styles.actionGroup}>
            <Pressable
              style={styles.action}
              onPress={handleComment}
              accessibilityRole="button"
              accessibilityLabel={`${comments} comments`}
              accessibilityHint="Double tap to view comments"
            >
              <MessageSquare size={16} color={COLORS.textSecondary} />
              <Text style={styles.actionCount}>{comments}</Text>
            </Pressable>

            <Pressable
              style={styles.action}
              onPress={handleRepost}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel={`${isReposted ? 'Undo repost' : 'Repost'}: ${currentReposts} reposts`}
              accessibilityHint="Double tap to repost this"
            >
              <Repeat
                size={16}
                color={isReposted ? COLORS.success : COLORS.textSecondary}
              />
              <Text style={[
                styles.actionCount,
                isReposted && styles.repostedText
              ]}>
                {currentReposts}
              </Text>
            </Pressable>

            <Pressable
              style={styles.action}
              onPress={handleLike}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}: ${currentLikes} likes`}
              accessibilityHint="Double tap to like this post"
            >
              <Heart
                size={16}
                color={isLiked ? COLORS.error : COLORS.textSecondary}
                fill={isLiked ? COLORS.error : 'none'}
              />
              <Text style={[
                styles.actionCount,
                isLiked && styles.likedText
              ]}>
                {currentLikes}
              </Text>
            </Pressable>
          </View>

          {mentionedToken && (
            <Pressable
              style={styles.buyButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onBuyPress) {
                  onBuyPress();
                } else {
                  // Navigate to coin details page for quick buy
                  router.push(`/coin/${mentionedToken.toLowerCase()}`);
                }
              }}
            >
              <Zap size={16} color={COLORS.success} />
              <Text style={styles.buyText}>Ibuy</Text>
            </Pressable>
          )}
        </View>
      </NeonCard>
    </Pressable>
  );
});

// Display name for debugging
SocialPost.displayName = 'SocialPost';

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.m,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.s,
  },
  defaultAvatar: {
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontWeight: '600',
  },
  verified: {
    fontSize: 14,
  },
  timestamp: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  contentContainer: {
    marginBottom: SPACING.s,
  },
  content: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.s,
  },
  actionGroup: {
    flexDirection: 'row',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  actionCount: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: SPACING.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
  },
  buyText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.success,
    fontSize: 12,
    marginLeft: SPACING.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  likedText: {
    color: COLORS.error,
  },
  repostedText: {
    color: COLORS.success,
  },
  imagesContainer: {
    marginTop: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: 200,
    marginBottom: SPACING.xs,
    borderRadius: BORDER_RADIUS.medium,
  },
});