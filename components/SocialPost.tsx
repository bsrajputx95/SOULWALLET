import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, Image, Pressable, Alert } from 'react-native';
import { MessageSquare, Heart, Zap, Copy } from 'lucide-react-native';
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
  likes: number;
  timestamp: string;
  mentionedToken?: string;
  mentionedTokenMint?: string;
  walletAddress?: string;
  isVerified?: boolean;
  onPress?: () => void;
  onBuyPress?: () => void;
  onCopyPress?: () => void;
  onUpdate?: () => void;
}

export const SocialPost: React.FC<SocialPostProps> = React.memo(({
  id,
  username,
  profileImage,
  content,
  images,
  comments,
  likes,
  timestamp,
  mentionedToken,
  walletAddress,
  isVerified = false,
  onPress,
  onBuyPress,
  onCopyPress,
  onUpdate,
}) => {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(false);
  const [currentLikes, setCurrentLikes] = useState(likes);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Truncate content if too long
  const MAX_CONTENT_LENGTH = 200;
  const shouldTruncate = content.length > MAX_CONTENT_LENGTH && !isExpanded;
  const displayContent = shouldTruncate
    ? content.substring(0, MAX_CONTENT_LENGTH) + '...'
    : content;

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



  const handleComment = (e: any) => {
    e.stopPropagation();
    router.push(`/post/${id}`);
  };

  const formattedContent = useMemo(() => {
    // Format hashtags, mentions, tokens, and post links
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
      } else if (word.includes('soulwallet/post/')) {
        // Clickable post link
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
  }, [content, handleTokenPress, router]);

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
                  {(username || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Pressable onPress={(e) => { e.stopPropagation(); handleUsernamePress(); }}>
                <Text style={styles.username}>
                  @{username || 'unknown'}
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
          <Text style={styles.content} numberOfLines={isExpanded ? undefined : 6}>
            {displayContent}
          </Text>
          {shouldTruncate && (
            <Pressable onPress={() => setIsExpanded(true)}>
              <Text style={styles.seeMore}>See more</Text>
            </Pressable>
          )}
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

          {walletAddress && onCopyPress && (
            <Pressable
              style={styles.copyButton}
              onPress={(e) => {
                e.stopPropagation();
                onCopyPress();
              }}
            >
              <Copy size={16} color={COLORS.solana} />
              <Text style={styles.copyText}>Copy</Text>
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
    alignItems: 'center',
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
    flexShrink: 0, // Prevent username from being hidden
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
  seeMore: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 14,
    marginTop: SPACING.xs,
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
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana + '20',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
    marginLeft: SPACING.xs,
  },
  copyText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.solana,
    fontSize: 12,
    marginLeft: SPACING.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});