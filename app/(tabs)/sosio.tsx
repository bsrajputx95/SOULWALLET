import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  TextInput,
  Modal,
  useWindowDimensions,
  Animated,
  Image,
  ScrollView,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Search, X, Plus, Link, ShoppingBag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { SocialPost, NeonButton, IBuyBagModal, CopyTradingModal, SocialPostSkeleton } from '@/components';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fetchFeed, createPost, toggleLike, Post, TokenMetadata } from '@/services/social';
import { executeIBuy, getIBuySettings, verifyTokenForPost } from '@/services/ibuy';
import { getStoredPin } from '@/services/wallet';
import { useAlert } from '@/contexts/AlertContext';

type FeedTab = 'forYou' | 'following';

export default function SosioScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  // Real posts from API
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>('forYou');
  const activeTabRef = useRef<FeedTab>('forYou'); // Ref for PanResponder to avoid stale closure

  // Real user state - fetched from backend
  const [user, setUser] = useState<{ username: string; profileImage: string | null } | null>(null);

  // Fetch user profile from backend
  const fetchUserProfile = useCallback(async () => {
    try {
      const SecureStore = await import('expo-secure-store');
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      const { api } = await import('@/services/api');
      const data = await api.get<{ user: any }>('/me');
      const userData = data.user || data;
      setUser({
        username: userData.username || userData.email?.split('@')[0] || 'user',
        profileImage: userData.profileImage || null,
      });
    } catch (error) {
      // Fallback to 'user' if fetch fails
    }
  }, []);

  // Profile query uses local user data
  const profileQuery = { data: { profileImage: user?.profileImage || null }, isLoading: false };

  // Remove unused variables
  void profileQuery;

  // Load feed and user profile from API
  useEffect(() => {
    loadFeed();
    loadFollowingList();
    fetchUserProfile();
  }, []);

  // Reload feed when active tab changes
  useEffect(() => {
    loadFeed(true);
  }, [activeTab]);

  const loadFollowingList = async () => {
    // TODO: Implement API endpoint to get following list
    // For now, we'll extract from feed posts
  };

  const loadFeed = async (reset = false) => {
    setLoading(true);
    const mode = activeTab === 'following' ? 'following' : undefined;
    const result = await fetchFeed(reset ? undefined : (nextCursor || undefined), mode);
    if (result.success && result.posts) {
      if (reset) {
        setPosts(result.posts);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = (result.posts || []).filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
      setNextCursor(result.nextCursor || null);
    }
    setLoading(false);
  };

  const loadMorePosts = async () => {
    if (!nextCursor || loading) return;
    const mode = activeTab === 'following' ? 'following' : undefined;
    const result = await fetchFeed(nextCursor, mode);
    if (result.success && result.posts && result.posts.length > 0) {
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = (result.posts ?? []).filter(p => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setNextCursor(result.nextCursor || null);
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Handle hashtag navigation params
  const { search: searchParam } = useLocalSearchParams<{ search?: string }>();
  useEffect(() => {
    if (searchParam) {
      setSearchQuery(searchParam);
      setShowSearchBar(true);
    }
  }, [searchParam]);


  // User search - mock implementation returning empty results
  const userSearchQuery = { data: [] as any[], isLoading: false };

  // Detect soulwallet/post/id links in search and navigate directly
  useEffect(() => {
    const postLinkMatch = searchQuery.match(/soulwallet\/post\/([a-zA-Z0-9_-]+)/);
    if (postLinkMatch) {
      const postId = postLinkMatch[1];
      setSearchQuery(''); // Clear search
      router.push(`/post/${postId}`);
    }
  }, [searchQuery]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive padding logic like Home screen
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? SPACING.xs : isLargeScreen ? SPACING.m : SPACING.s;

  // Calculate proper bottom padding: TabBar height (85px) + bottom safe area + extra spacing
  const bottomPadding = 85 + insets.bottom + 20;

  // Filter posts based on search query only (feed filtering is done server-side)
  const filteredPosts = React.useMemo(() => {
    let filtered = posts;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post =>
        post.content.toLowerCase().includes(query) ||
        post.user.username.toLowerCase().includes(query) ||
        (post.tokenSymbol && post.tokenSymbol.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [posts, searchQuery]);

  const [refreshing, setRefreshing] = useState(false);
  // activeTab and activeTabRef are now declared near the top of the component
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showTokenBagModal, setShowTokenBagModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [mentionToken, setMentionToken] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenVerified, setTokenVerified] = useState(false);
  const [tokenVerifyLoading, setTokenVerifyLoading] = useState(false);
  const [tokenVerifyError, setTokenVerifyError] = useState('');
  const [verifiedTokenPrice, setVerifiedTokenPrice] = useState<number>(0);
  const [postVisibility, setPostVisibility] = useState<'public' | 'vip' | 'followers'>('public');

  // Copy trading state
  const [showCopyTradingModal, setShowCopyTradingModal] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<{
    username: string;
    walletAddress: string;
    profileImage?: string;
  } | null>(null);

  // IBUY state
  const [isBuying, setIsBuying] = useState(false);

  // Fade indicator for swipe navigation
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const [showIndicator, setShowIndicator] = useState(false);
  const indicatorText = useRef('For You');

  // Show swipe hint on first entry to Sosio tab
  useEffect(() => {
    // Show hint after a short delay
    const timer = setTimeout(() => {
      indicatorText.current = '← swipe →';
      setShowIndicator(true);
      indicatorOpacity.setValue(0);

      Animated.timing(indicatorOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(indicatorOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => setShowIndicator(false));
        }, 2000);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Show fade indicator when tab changes
  const showFadeIndicator = (text: string) => {
    indicatorText.current = text;
    setShowIndicator(true);
    indicatorOpacity.setValue(0);

    // Fade in
    Animated.timing(indicatorOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Wait then fade out
      setTimeout(() => {
        Animated.timing(indicatorOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setShowIndicator(false));
      }, 1200);
    });
  };

  // Swipe gesture handling for tab switching
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes (not vertical scrolling)
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderRelease: (_, gestureState) => {
        const SWIPE_THRESHOLD = 50;
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left -> go to Following
          if (activeTabRef.current !== 'following') {
            handleTabChange('following');
          }
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right -> go to For You
          if (activeTabRef.current !== 'forYou') {
            handleTabChange('forYou');
          }
        }
      },
    })
  ).current;

  // Legacy tab animation refs (kept for compatibility)
  const scrollEventValue = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed(true);
    setRefreshing(false);
  }, []);

  // Simple scroll tracking (tabs removed - using swipe gestures now)
  const handleFeedScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollEventValue } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        lastScrollY.current = event.nativeEvent.contentOffset.y;
      },
    }
  );

  const handleCreatePost = async () => {
    if (!postContent.trim()) return;

    // Validate token address if mentionToken is true
    if (mentionToken && !tokenAddress.trim()) {
      showAlert('Token Address Required', 'Please enter the token contract address when mentioning a token.');
      return;
    }

    // Build token metadata if mentioning a token
    let tokenMetadata: TokenMetadata | undefined;
    if (mentionToken && tokenAddress.trim()) {
      tokenMetadata = {
        tokenAddress: tokenAddress.trim(),
        tokenSymbol: tokenName.trim() || '',
        tokenName: tokenName.trim() || '',
        tokenVerified: tokenVerified,
        tokenPrice: verifiedTokenPrice || 0,
      };
    }

    const result = await createPost(
      postContent.trim(),
      postVisibility,
      tokenMetadata
    );

    if (result.success) {
      setPostContent('');
      setMentionToken(false);
      setTokenName('');
      setTokenAddress('');
      setTokenVerified(false);
      setTokenVerifyError('');
      setVerifiedTokenPrice(0);
      setShowNewPostModal(false);
      await loadFeed();
    } else {
      showAlert('Error', result.error || 'Failed to create post');
    }
  };

  // Abort controller for token verification
  const tokenVerifyAbortRef = useRef<AbortController | null>(null);

  // Verify token when address changes
  const handleTokenAddressChange = async (address: string) => {
    setTokenAddress(address);
    setTokenVerified(false);
    setTokenVerifyError('');
    setVerifiedTokenPrice(0);

    if (address.length < 32) return; // Solana addresses are 32-44 chars

    // Cancel previous verification
    if (tokenVerifyAbortRef.current) {
      tokenVerifyAbortRef.current.abort();
    }

    const controller = new AbortController();
    tokenVerifyAbortRef.current = controller;

    setTokenVerifyLoading(true);
    try {
      const result = await verifyTokenForPost(address);
      
      if (controller.signal.aborted) return;
      
      if (result.valid) {
        setTokenVerified(true);
        setTokenName(result.symbol || '');
        setVerifiedTokenPrice(result.price || 0);
      } else {
        setTokenVerified(false);
        setTokenVerifyError(result.error || 'Invalid token');
      }
    } catch {
      if (!controller.signal.aborted) {
        setTokenVerifyError('Verification failed');
      }
    } finally {
      if (!controller.signal.aborted) {
        setTokenVerifyLoading(false);
      }
    }
  };

  const handleTabChange = (tab: FeedTab) => {
    setActiveTab(tab);
    activeTabRef.current = tab; // Update ref for PanResponder
    // Show fade indicator
    showFadeIndicator(tab === 'forYou' ? 'For You' : 'Following');
    // Feed will be reloaded via useEffect when activeTab changes
  };



  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: responsivePadding
          }
        ]}
      >
        <View style={styles.profileButton}>
          {profileQuery.data?.profileImage ? (
            <Image source={{ uri: profileQuery.data.profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
            @{user?.username ? (user.username.length > 15 ? user.username.slice(0, 15) + '...' : user.username) : 'user'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.searchButton}
            onPress={() => setShowSearchBar(!showSearchBar)}
          >
            <Search size={24} color={COLORS.solana} />
          </Pressable>

          <Pressable
            style={styles.settingsButton}
            onPress={() => router.push('/profile/self')}
          >
            <Settings size={24} color={COLORS.solana} />
          </Pressable>
        </View>
      </View>

      {showSearchBar && (
        <View style={[styles.searchContainer, { marginHorizontal: responsivePadding }]}>
          <Search size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts, users, tokens..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={20} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Fade indicator for swipe navigation */}
      {showIndicator && (
        <Animated.View style={[styles.fadeIndicator, { opacity: indicatorOpacity }]}>
          <Text style={styles.fadeIndicatorText}>{indicatorText.current}</Text>
        </Animated.View>
      )}

      {/* Main Content - FlatList with swipe gesture for tab switching */}
      <View style={styles.content} {...panResponder.panHandlers}>
        <FlatList
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            {
              paddingHorizontal: responsivePadding,
              paddingBottom: bottomPadding
            }
          ]}
          data={filteredPosts}
          keyExtractor={(item: any, index: number) => item.id ? `${item.id}` : `post-${index}`}
          ListHeaderComponent={
            // User Search Results - shown when searching
            searchQuery.length >= 2 && userSearchQuery.data && userSearchQuery.data.length > 0 ? (
              <View style={styles.userSearchResults}>
                <Text style={styles.searchResultsTitle}>Users</Text>
                {userSearchQuery.data.map((searchUser: any) => (
                  <Pressable
                    key={searchUser.id}
                    style={styles.userResultItem}
                    onPress={() => router.push(`/profile/${searchUser.username}`)}
                  >
                    <View style={styles.userResultAvatar}>
                      <Text style={styles.userResultAvatarText}>
                        {searchUser.username?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                    <View style={styles.userResultInfo}>
                      <View style={styles.userResultNameRow}>
                        <Text style={styles.userResultUsername}>@{searchUser.username}</Text>
                      </View>
                      <Text style={styles.userResultFollowers}>
                        {searchUser.followersCount} followers
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item: post }: { item: any }) => {
            // Format timestamp - handle Date objects, strings, or ISO strings
            let formattedTimestamp = '';
            try {
              const timestampValue = post.timestamp || post.createdAt;
              if (timestampValue) {
                const date = timestampValue instanceof Date
                  ? timestampValue
                  : new Date(timestampValue);
                if (!isNaN(date.getTime())) {
                  // Format as relative time
                  const now = new Date();
                  const diffMs = now.getTime() - date.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);

                  if (diffMins < 1) formattedTimestamp = 'Just now';
                  else if (diffMins < 60) formattedTimestamp = `${diffMins}m ago`;
                  else if (diffHours < 24) formattedTimestamp = `${diffHours}h ago`;
                  else if (diffDays < 7) formattedTimestamp = `${diffDays}d ago`;
                  else formattedTimestamp = date.toLocaleDateString();
                }
              }
            } catch (e) {
              formattedTimestamp = '';
            }

            const handleLike = async () => {
              // Optimistic update - don't reload entire feed
              setPosts(prev => prev.map(p => {
                if (p.id === post.id) {
                  return {
                    ...p,
                    isLiked: !p.isLiked,
                    likesCount: p.isLiked ? (p.likesCount - 1) : (p.likesCount + 1)
                  };
                }
                return p;
              }));
              
              // API call in background
              const result = await toggleLike(post.id);
              if (!result.success) {
                // Revert on error
                setPosts(prev => prev.map(p => {
                  if (p.id === post.id) {
                    return {
                      ...p,
                      isLiked: post.isLiked,
                      likesCount: post.likesCount
                    };
                  }
                  return p;
                }));
              }
            };

            return (
              <SocialPost
                key={post.id}
                id={post.id}
                username={post.user?.username}
                profileImage={post.user?.profileImage}
                content={post.content}
                images={[]}
                comments={post.commentsCount || 0}
                likes={post.likesCount || 0}
                isLiked={post.isLiked}
                timestamp={formattedTimestamp}
                mentionedToken={post.tokenSymbol || post.tokenName}
                mentionedTokenMint={post.tokenAddress}
                isVerified={false}
                onLike={handleLike}
                onUpdate={() => { }}
                onCopyPress={() => {
                  router.push(`/profile/${post.user?.username}`);
                }}
                onBuyPress={async () => {
                  const tokenMint = post.tokenAddress;
                  if (!tokenMint) return;
                  if (isBuying) return;

                  const settings = await getIBuySettings();
                  showAlert(
                    'Confirm IBUY',
                    `Buy ${post.tokenSymbol || 'token'} for ${settings.ibuyDefaultSol} SOL?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Buy',
                        onPress: async () => {
                          const storedPin = await getStoredPin();
                          if (!storedPin) {
                            showAlert('Error', 'No PIN found. Please re-login.');
                            return;
                          }
                          setIsBuying(true);
                          try {
                            const result = await executeIBuy(post.id, settings.ibuyDefaultSol, storedPin);
                            if (result.success) {
                              showAlert('Success!', `Bought ${post.tokenSymbol || 'token'}`);
                              loadFeed();
                            } else {
                              showAlert('Buy Failed', result.error || 'IBUY failed');
                            }
                          } catch (e: any) {
                            showAlert('Buy Failed', e.message || 'IBUY failed');
                          } finally {
                            setIsBuying(false);
                          }
                        },
                      },
                    ]
                  );
                }}
              />
            );
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.skeletonContainer}>
                <SocialPostSkeleton />
                <SocialPostSkeleton />
                <SocialPostSkeleton />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'No posts found matching your search.'
                    : activeTab === 'following'
                      ? 'Follow some traders to see their posts here.'
                      : 'No posts yet. Be the first to post!'}
                </Text>
              </View>
            )
          }
          onEndReached={() => {
            // Infinite scroll - fetch more when reaching end
            if (nextCursor && !loading) {
              loadMorePosts();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={handleFeedScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>

      {/* Token Bag Button */}
      <Pressable
        style={styles.bagButton}
        onPress={() => setShowTokenBagModal(true)}
      >
        <LinearGradient
          colors={COLORS.gradientBlue as any}
          style={styles.newPostGradient}
        >
          <ShoppingBag size={19} color={COLORS.textPrimary} />
        </LinearGradient>
      </Pressable>

      {/* New Post Button */}
      <Pressable
        style={styles.newPostButton}
        onPress={() => setShowNewPostModal(true)}
      >
        <LinearGradient
          colors={COLORS.gradientPurple as any}
          style={styles.newPostGradient}
        >
          <Plus size={19} color={COLORS.textPrimary} />
        </LinearGradient>
      </Pressable>





      {/* New Post Modal */}
      <Modal
        visible={showNewPostModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNewPostModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Post</Text>
              <Pressable onPress={() => setShowNewPostModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={styles.postInput}
                placeholder="What's happening in crypto?"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={postContent}
                onChangeText={setPostContent}
              />

              <View style={styles.tokenMentionContainer}>
                <Text style={styles.tokenMentionLabel}>Mention Token?</Text>
                <View style={styles.radioContainer}>
                  <Pressable
                    style={styles.radioOption}
                    onPress={() => setMentionToken(true)}
                  >
                    <View style={[
                      styles.radioButton,
                      mentionToken && styles.radioButtonSelected,
                    ]}>
                      {mentionToken && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioText}>Yes</Text>
                  </Pressable>

                  <Pressable
                    style={styles.radioOption}
                    onPress={() => setMentionToken(false)}
                  >
                    <View style={[
                      styles.radioButton,
                      !mentionToken && styles.radioButtonSelected,
                    ]}>
                      {!mentionToken && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioText}>No</Text>
                  </Pressable>
                </View>
              </View>

              {mentionToken && (
                <View style={styles.tokenInputsContainer}>
                  <View style={styles.tokenInputWrapper}>
                    <Text style={styles.tokenInputLabel}>Token Address *</Text>
                    <View style={styles.tokenInputField}>
                      <TextInput
                        style={[
                          styles.tokenTextInput,
                          tokenVerified && styles.tokenInputVerified,
                          tokenVerifyError && styles.tokenInputError,
                        ]}
                        placeholder="Enter token contract address"
                        placeholderTextColor={COLORS.textSecondary}
                        value={tokenAddress}
                        onChangeText={handleTokenAddressChange}
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      {tokenVerifyLoading && (
                        <Text style={styles.tokenVerifyStatus}>Verifying...</Text>
                      )}
                      {!tokenVerifyLoading && tokenVerified && (
                        <Text style={styles.tokenVerifySuccess}>
                          ✓ Verified
                          {verifiedTokenPrice > 0 && ` ($${verifiedTokenPrice.toFixed(4)})`}
                        </Text>
                      )}
                      {!tokenVerifyLoading && tokenVerifyError && (
                        <Text style={styles.tokenVerifyError}>✗ {tokenVerifyError}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.tokenInputWrapper}>
                    <Text style={styles.tokenInputLabel}>Token Name (auto-fetched)</Text>
                    <View style={[styles.tokenInputField, { opacity: tokenVerified ? 1 : 0.5 }]}>
                      <TextInput
                        style={[styles.tokenTextInput, { color: COLORS.textPrimary }]}
                        placeholder={tokenVerifyLoading ? 'Fetching...' : 'Will auto-load from address'}
                        placeholderTextColor={COLORS.textSecondary}
                        value={tokenName}
                        editable={false}
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.visibilityContainer}>
                <Text style={styles.visibilityLabel}>Visibility</Text>
                <View style={styles.visibilityOptions}>
                  <Pressable
                    style={[
                      styles.visibilityOption,
                      postVisibility === 'public' && styles.visibilityOptionActive,
                    ]}
                    onPress={() => setPostVisibility('public')}
                  >
                    <Text style={[
                      styles.visibilityOptionText,
                      postVisibility === 'public' && styles.visibilityOptionTextActive,
                    ]}>Public</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.visibilityOption,
                      postVisibility === 'vip' && styles.visibilityOptionActive,
                    ]}
                    onPress={() => setPostVisibility('vip')}
                  >
                    <Text style={[
                      styles.visibilityOptionText,
                      postVisibility === 'vip' && styles.visibilityOptionTextActive,
                    ]}>VIP</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.visibilityOption,
                      postVisibility === 'followers' && styles.visibilityOptionActive,
                    ]}
                    onPress={() => setPostVisibility('followers')}
                  >
                    <Text style={[
                      styles.visibilityOptionText,
                      postVisibility === 'followers' && styles.visibilityOptionTextActive,
                    ]}>Followers</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.postActions}>
                <Pressable style={styles.photoButton}>
                  <Link size={20} color={COLORS.solana} />
                </Pressable>

                <NeonButton
                  title="Post"
                  icon={<Plus size={20} color={COLORS.textPrimary} />}
                  onPress={handleCreatePost}
                  disabled={!postContent.trim()}
                  style={styles.postButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <IBuyBagModal
        visible={showTokenBagModal}
        onClose={() => setShowTokenBagModal(false)}
      />

      <CopyTradingModal
        visible={showCopyTradingModal}
        onClose={() => {
          setShowCopyTradingModal(false);
          setSelectedTrader(null);
        }}
        trader={selectedTrader}
      />


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.background,
    height: 60,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  username: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m
  },
  searchIcon: {
    marginRight: SPACING.s
  },
  searchInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.m,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  tabsContainer: {
    marginBottom: SPACING.m
  },
  tabsScroll: {
    minHeight: 44
  },
  tab: {
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    marginRight: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.cardBackground,
    minHeight: 36,
    justifyContent: 'center'
  },
  activeTab: {
    backgroundColor: COLORS.solana + '20'
  },
  tabText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  activeTabText: {
    color: COLORS.solana
  },
  content: {
    flex: 1
  },
  contentContainer: {
    minHeight: 200
  },
  comingSoonContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200
  },
  comingSoonTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
    marginBottom: SPACING.m,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  comingSoonDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center'
  },
  emptyContainer: {
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200
  },
  emptyText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center'
  },
  newPostButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bagButton: {
    position: 'absolute',
    bottom: 78,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },

  newPostGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.large,
    paddingBottom: 20,
    maxHeight: '80%',
    width: '92%',
    maxWidth: 720,
    alignSelf: 'center'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground
  },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18
  },
  modalContent: {
    padding: SPACING.l
  },
  modalScroll: {
    maxHeight: '100%',
  },
  postInput: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m
  },
  tokenMentionContainer: {
    marginBottom: SPACING.m
  },
  tokenMentionLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.l
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs
  },
  radioButtonSelected: {
    borderColor: COLORS.solana
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.solana
  },
  radioText: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 16
  },
  tokenInputsContainer: {
    marginBottom: SPACING.m
  },
  tokenInputWrapper: {
    marginBottom: SPACING.m,
  },
  tokenInputLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  tokenInputField: {
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '50',
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.background,
  },
  tokenTextInput: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    fontSize: 16,
  },
  tokenInputVerified: {
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: BORDER_RADIUS.medium,
  },
  tokenInputError: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: BORDER_RADIUS.medium,
  },
  tokenVerifyStatus: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  tokenVerifySuccess: {
    ...FONTS.phantomMedium,
    color: COLORS.success,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  tokenVerifyError: {
    ...FONTS.phantomMedium,
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.m
  },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.solana + '20',
    justifyContent: 'center',
    alignItems: 'center'
  },
  postButton: {
    flex: 1,
    marginLeft: SPACING.m
  },
  visibilityContainer: {
    marginBottom: SPACING.m
  },
  visibilityLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s
  },
  visibilityOptions: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4
  },
  visibilityOption: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small
  },
  visibilityOptionActive: {
    backgroundColor: COLORS.solana + '20'
  },
  visibilityOptionText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14
  },
  visibilityOptionTextActive: {
    color: COLORS.solana
  },
  loadingContainer: {
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200
  },
  loadingText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16
  },
  errorContainer: {
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200
  },
  errorText: {
    ...FONTS.phantomRegular,
    color: COLORS.error,
    fontSize: 16,
    marginBottom: SPACING.m,
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium
  },
  retryText: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 14
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m
  },
  statBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.s,
    minWidth: 70,
    alignItems: 'center'
  },
  statLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12
  },
  statValue: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 14
  },
  // User search results styles
  userSearchResults: {
    marginBottom: SPACING.m,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
  },
  searchResultsTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.s,
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  userResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  userResultAvatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  userResultInfo: {
    flex: 1,
  },
  userResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userResultUsername: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  verifiedBadge: {
    backgroundColor: COLORS.solana,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  verifiedBadgeText: {
    ...FONTS.phantomBold,
    color: COLORS.background,
    fontSize: 8,
  },
  userResultFollowers: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  // Notification tab styles
  notificationTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  notificationUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.solana,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  notificationTime: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  skeletonContainer: {
    paddingTop: SPACING.m,
  },
  // Swipe navigation fade indicator - positioned top-right below header
  fadeIndicator: {
    position: 'absolute',
    top: 90, // Below header row
    right: SPACING.s,
    zIndex: 100,
  },
  fadeIndicatorText: {
    ...FONTS.orbitronBold,
    color: COLORS.solana,
    fontSize: 14,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.solana + '50',
  },
});

