import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Image, Pressable, Animated } from 'react-native';
import { MessageSquare, Heart, Zap, Copy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';
import { NeonCard } from './NeonCard';

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
  isLiked?: boolean;
  onPress?: () => void;
  onBuyPress?: () => void;
  onCopyPress?: () => void;
  onLike?: () => void;
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
  isVerified: _isVerified = false,
  isLiked: initialIsLiked = false,
  onPress,
  onBuyPress,
  onCopyPress,
  onLike,
  onUpdate,
}) => {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [currentLikes, setCurrentLikes] = useState(likes);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  useEffect(() => {
    setCurrentLikes(likes);
  }, [likes]);

  // Calculate post age in minutes for iBuy button coloring
  const postAgeMinutes = useMemo(() => {
    try {
      // Handle various timestamp formats
      if (!timestamp || timestamp.trim() === '') return 0; // Empty = just created = green

      const lowerTs = timestamp.toLowerCase().trim();

      // Handle "Just now" or "just now" - treat as 0 minutes
      if (lowerTs === 'just now' || lowerTs === 'now') {
        return 0;
      }

      // Handle relative time like "2m ago", "1h ago", "0m ago"
      if (lowerTs.includes('ago')) {
        const match = timestamp.match(/(\d+)\s*(m|h|d)/i);
        if (match && match[1] && match[2]) {
          const value = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();
          if (unit === 'm') return value;
          if (unit === 'h') return value * 60;
          if (unit === 'd') return value * 60 * 24;
        }
        // "ago" but no number match - could be "a few seconds ago"
        if (lowerTs.includes('second') || lowerTs.includes('moment')) {
          return 0;
        }
        return 999; // Unknown "ago" format, treat as old
      }

      // Handle ISO date strings
      const postDate = new Date(timestamp);
      if (isNaN(postDate.getTime())) return 999;
      return Math.floor((Date.now() - postDate.getTime()) / 60000);
    } catch {
      return 0; // Default to GREEN if parsing fails (benefit of the doubt for new posts)
    }
  }, [timestamp]);

  // Determine iBuy button color based on age
  const ibuyColorState: 'green' | 'yellow' | 'red' = useMemo(() => {
    if (postAgeMinutes < 1) return 'green';
    if (postAgeMinutes < 10) return 'yellow';
    return 'red';
  }, [postAgeMinutes]);

  // Animated glow effect for yellow/red states
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (ibuyColorState === 'green') {
      glowAnim.setValue(0);
      return;
    }

    // Create pulsing glow animation for yellow/red
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );

    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [ibuyColorState, glowAnim]);

  // Get dynamic iBuy button styles based on age
  const getIbuyButtonStyle = useMemo(() => {
    const baseStyle = styles.buyButton;

    if (ibuyColorState === 'green') {
      return baseStyle; // Default green style
    }

    if (ibuyColorState === 'yellow') {
      return {
        ...baseStyle,
        backgroundColor: COLORS.warning + '20',
      };
    }

    // Red for 10+ minutes
    return {
      ...baseStyle,
      backgroundColor: COLORS.error + '20',
    };
  }, [ibuyColorState]);

  const getIbuyColor = () => {
    if (ibuyColorState === 'green') return COLORS.success;
    if (ibuyColorState === 'yellow') return COLORS.warning;
    return COLORS.error;
  };

  // Truncate content if too long
  const MAX_CONTENT_LENGTH = 200;
  const shouldTruncate = content.length > MAX_CONTENT_LENGTH && !isExpanded;
  const displayContent = shouldTruncate
    ? content.substring(0, MAX_CONTENT_LENGTH) + '...'
    : content;

  // Render content with highlighted hashtags and @mentions
  const renderFormattedContent = useCallback((text: string) => {
    // Split by #hashtags and @mentions, keeping the delimiters
    const parts = text.split(/(#[\w]+|@[\w]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <Text key={index} style={styles.hashtag}>
            {part}
          </Text>
        );
      }
      if (part.startsWith('@')) {
        return (
          <Text
            key={index}
            style={styles.mention}
            onPress={() => router.push(`/profile/${part.slice(1)}`)}
          >
            {part}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  }, [router]);





  const handleUsernamePress = useCallback(() => {
    router.push(`/profile/${username}`);
  }, [router, username]);

  const handlePostPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/post/${id}`);
    }
  };

  const handleLike = async (e: any) => {
    e.stopPropagation();
    if (isProcessing || !onLike) return;

    setIsProcessing(true);

    // Optimistic update
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setCurrentLikes(newLikedState ? currentLikes + 1 : currentLikes - 1);

    try {
      // Call the API via onLike prop
      await onLike();
      if (onUpdate) onUpdate();
    } catch {
      // Revert on error
      setIsLiked(!newLikedState);
      setCurrentLikes(newLikedState ? currentLikes - 1 : currentLikes + 1);
    } finally {
      setIsProcessing(false);
    }
  };



  const handleComment = (e: any) => {
    e.stopPropagation();
    router.push(`/post/${id}`);
  };

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
            {renderFormattedContent(displayContent)}
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
            <Animated.View
              style={[
                getIbuyButtonStyle,
                ibuyColorState !== 'green' && {
                  shadowColor: ibuyColorState === 'yellow' ? COLORS.warning : COLORS.error,
                  shadowOpacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.8],
                  }),
                  shadowRadius: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, 12],
                  }),
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 8,
                },
              ]}
            >
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={(e) => {
                  e.stopPropagation();
                  if (onBuyPress) {
                    onBuyPress();
                  } else {
                    router.push(`/coin/${mentionedToken.toLowerCase()}`);
                  }
                }}
              >
                <Zap size={16} color={getIbuyColor()} />
                <Text style={[styles.buyText, { color: getIbuyColor() }]}>Ibuy</Text>
              </Pressable>
            </Animated.View>
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
    marginBottom: SPACING.xs,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
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
  username: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 11,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontWeight: '600',
    flexShrink: 0,
  },
  verified: {
    fontSize: 14,
  },
  timestamp: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 10,
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
