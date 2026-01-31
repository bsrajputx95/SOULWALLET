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
  Easing,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Search, X, Plus, Link, ShoppingBag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { SocialPost } from '../../components/SocialPost';
import { NeonButton } from '../../components/NeonButton';
import { TokenBagModal } from '../../components/TokenBagModal';
import { CopyTradingModal } from '../../components/CopyTradingModal';
import { SocialPostSkeleton } from '../../components/SkeletonLoader';
import { useRouter } from 'expo-router';

// Static dummy data for pure UI mode
const DUMMY_USER = { username: 'demo_user', profileImage: null as string | null };
const DUMMY_POSTS: { id: string; username: string; profileImage: string; content: string; timestamp: string; likes: number; comments: number; mentionedToken: string; isVerified: boolean; visibility: 'public' | 'vip' | 'followers' }[] = [
  { id: '1', username: 'crypto_trader', profileImage: '', content: 'Just made a great trade on $SOL! 🚀', timestamp: '2h ago', likes: 42, comments: 5, mentionedToken: 'SOL', isVerified: true, visibility: 'public' },
  { id: '2', username: 'defi_degen', profileImage: '', content: 'BONK looking bullish today! 🐕', timestamp: '4h ago', likes: 28, comments: 3, mentionedToken: 'BONK', isVerified: false, visibility: 'public' },
];
const DUMMY_FOLLOWED_USERS: string[] = [];

type FeedTab = 'forYou' | 'following';

export default function SosioScreen() {
  const router = useRouter();

  // Static dummy data - pure UI mode (no hooks)
  const user = DUMMY_USER;
  const allPosts = DUMMY_POSTS;
  const followedUsers = DUMMY_FOLLOWED_USERS;

  // Mock profile query - use local user data
  const profileQuery = { data: { profileImage: null }, isLoading: false };

  // Mock iBuy mutation - coming soon
  const ibuyMutation = {
    mutateAsync: async (_params: any): Promise<{ swapTransaction: string }> => {
      Alert.alert('🚧 Coming Soon', 'iBuy feature is not available yet.');
      throw new Error('iBuy feature not available');
    },
    isPending: false,
  };

  // Mock iBuy settings - uses default values
  const ibuySettingsQuery = { data: { buyAmount: 10, slippage: 'medium' }, isLoading: false };

  // Mock record purchase mutation
  const recordPurchaseMutation = {
    mutateAsync: async (_params: any) => {
      throw new Error('Feature not available');
    },
    isPending: false,
  };

  // Static dummy data - pure UI mode (no hooks)
  const executeSwap = async (_params: any) => { Alert.alert('🚧 Demo Mode', 'Swap simulated.'); return { success: true, signature: 'demo_sig_' + Date.now(), outputAmount: 0 }; };
  const publicKey = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const balance = 10.5;
  const tokenBalances: any[] = [];

  const [activeFeed, setActiveFeed] = useState<'all' | 'following' | 'vip' | 'forYou'>('forYou');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchBar, setShowSearchBar] = useState(false);



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

  // Filter posts based on active feed and search query
  const filteredPosts = React.useMemo(() => {
    let filtered = allPosts;

    // Filter by feed type
    if (activeFeed === 'following') {
      filtered = filtered.filter(post => followedUsers.includes(post.username));
    } else if (activeFeed === 'vip') {
      filtered = filtered.filter(post => post.visibility === 'vip');
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post =>
        post.content.toLowerCase().includes(query) ||
        post.username.toLowerCase().includes(query) ||
        (post.mentionedToken && post.mentionedToken.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [allPosts, activeFeed, searchQuery, followedUsers]);

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>('forYou');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showTokenBagModal, setShowTokenBagModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [mentionToken, setMentionToken] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [postVisibility, setPostVisibility] = useState<'public' | 'vip' | 'followers'>('public');

  // Copy trading state
  const [showCopyTradingModal, setShowCopyTradingModal] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<{
    username: string;
    walletAddress: string;
    profileImage?: string;
  } | null>(null);

  // Tabs smooth hide/show on scroll
  const TABS_HEIGHT = 44;
  const tabsHeight = useRef(new Animated.Value(TABS_HEIGHT)).current;
  const scrollEventValue = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const tabsHidden = useRef(false);

  // Mock feed query - uses local posts from social store
  const feedQuery = {
    data: { posts: filteredPosts, nextCursor: null },
    isLoading: false,
    isFetching: false,
    refetch: async () => ({}),
  };



  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await feedQuery.refetch();
    } catch (error) {
      console.error('[Sosio] Refresh error:', error);
    }
    setRefreshing(false);
  }, [feedQuery, activeTab]);

  // Removed auto-hide header behavior on scroll; only tabs hide/show smoothly
  const handleTabsScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollEventValue } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const diff = currentScrollY - lastScrollY.current;
        const direction = diff > 0 ? 'down' : 'up';

        if (direction === 'down' && currentScrollY > 20 && !tabsHidden.current) {
          Animated.timing(tabsHeight, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => { tabsHidden.current = true; });
        } else if (direction === 'up' && diff < -15 && tabsHidden.current) {
          Animated.timing(tabsHeight, {
            toValue: TABS_HEIGHT,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => { tabsHidden.current = false; });
        }

        lastScrollY.current = currentScrollY;
      },
    }
  );

  // Mock create post mutation - coming soon
  const createPostMutation = {
    mutateAsync: async (_params: any) => {
      Alert.alert('🚧 Coming Soon', 'Creating posts is not available yet.');
      throw new Error('Feature not available');
    },
    isPending: false,
  };



  const handleCreatePost = async () => {
    if (!postContent.trim()) return;

    // Validate token address if mentionToken is true
    if (mentionToken && !tokenAddress.trim()) {
      Alert.alert('Token Address Required', 'Please enter the token contract address when mentioning a token.');
      return;
    }

    try {
      // Map visibility to PostVisibility enum
      const visibilityMap = {
        'public': 'PUBLIC' as const,
        'vip': 'VIP' as const,
        'followers': 'FOLLOWERS' as const,
      };

      await createPostMutation.mutateAsync({
        content: postContent.trim(),
        visibility: visibilityMap[postVisibility],
        mentionedTokenName: mentionToken && tokenName ? tokenName : undefined,
        mentionedTokenMint: mentionToken && tokenAddress ? tokenAddress : undefined,
      });

      console.log('[Sosio] Post created successfully');

      setShowNewPostModal(false);
      setPostContent('');
      setMentionToken(false);
      setTokenName('');
      setTokenAddress('');
    } catch (error) {
      console.error('[Sosio] Failed to create post:', error);
      // Could add an alert here
    }
  };

  const handleTabChange = (tab: FeedTab) => {
    setActiveTab(tab);

    // Map tabs to feed types
    if (tab === 'forYou') {
      setActiveFeed('forYou');
    } else if (tab === 'following') {
      setActiveFeed('following');
    }
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

      <Animated.View style={[styles.tabsContainer, { height: tabsHeight, overflow: 'hidden' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsScroll, { paddingHorizontal: responsivePadding }]}
        >
          <Pressable
            style={[
              styles.tab,
              activeTab === 'forYou' && styles.activeTab,
            ]}
            onPress={() => handleTabChange('forYou')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'forYou' && styles.activeTabText,
            ]}>
              For You
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tab,
              activeTab === 'following' && styles.activeTab,
            ]}
            onPress={() => handleTabChange('following')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'following' && styles.activeTabText,
            ]}>
              Following
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>

      {/* Main Content - FlatList for infinite scroll */}
      <FlatList
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingHorizontal: responsivePadding,
            paddingBottom: bottomPadding
          }
        ]}
        data={feedQuery.data?.posts || filteredPosts}
        keyExtractor={(item: any) => item.id}
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

          return (
            <SocialPost
              key={post.id}
              id={post.id}
              username={post.username || post.user?.username}
              profileImage={post.profileImage || post.user?.profileImage}
              content={post.content}
              images={post.images || []}
              comments={post.comments || post._count?.comments || 0}
              likes={post.likes || post._count?.likes || 0}
              timestamp={formattedTimestamp}
              mentionedToken={post.mentionedToken || post.mentionedTokenName}
              mentionedTokenMint={post.mentionedTokenMint}
              walletAddress={post.walletAddress || post.user?.walletAddress}
              isVerified={post.isVerified || post.user?.isVerified}
              onUpdate={() => { if (__DEV__) console.log('Post updated'); }}
              onCopyPress={() => {
                const walletAddr = post.walletAddress || post.user?.walletAddress;
                if (walletAddr) {
                  setSelectedTrader({
                    username: post.username || post.user?.username,
                    walletAddress: walletAddr,
                    profileImage: post.profileImage || post.user?.profileImage,
                  });
                  setShowCopyTradingModal(true);
                } else {
                  router.push(`/profile/${post.username || post.user?.username}`);
                }
              }}
              onBuyPress={async () => {
                const tokenMint = post.mentionedTokenMint;
                if (!tokenMint) return;

                if (!publicKey) {
                  Alert.alert('Connect Wallet', 'Please connect your wallet to use iBuy.', [{ text: 'OK' }]);
                  return;
                }

                const buyAmount = ibuySettingsQuery.data?.buyAmount || 10;

                if ((balance || 0) < 0.01) {
                  Alert.alert('Low SOL Balance', 'You need at least 0.01 SOL for transaction fees.', [{ text: 'OK' }]);
                  return;
                }

                const usdcToken = tokenBalances?.find((t: { symbol: string }) => t.symbol === 'USDC');
                const usdcBalance = usdcToken?.uiAmount || 0;
                if (usdcBalance < buyAmount) {
                  Alert.alert('Insufficient USDC', `Your USDC balance (${usdcBalance.toFixed(2)}) is less than your iBuy amount (${buyAmount} USDC).`, [{ text: 'OK' }]);
                  return;
                }

                try {
                  const res = await ibuyMutation.mutateAsync({ postId: post.id, tokenMint });
                  const swapResult = await executeSwap(res.swapTransaction);
                  if (swapResult?.signature) {
                    await recordPurchaseMutation.mutateAsync({
                      postId: post.id,
                      tokenMint,
                      tokenSymbol: post.mentionedToken || post.mentionedTokenName,
                      tokenName: post.mentionedToken || post.mentionedTokenName,
                      amountBought: swapResult.outputAmount || 0,
                      priceInUsdc: buyAmount,
                      transactionSig: swapResult.signature,
                    });
                    const amountText = swapResult.outputAmount ? ` (${swapResult.outputAmount.toFixed(4)} tokens)` : '';
                    Alert.alert('iBuy Success', `Successfully bought ${post.mentionedToken || post.mentionedTokenName || 'token'}!${amountText}`);
                  }
                } catch (e: any) {
                  console.error('iBuy error:', e);
                  Alert.alert('iBuy Failed', e.message || 'Failed to complete purchase');
                }
              }}
            />
          );
        }}
        ListEmptyComponent={
          feedQuery.isLoading ? (
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
          if (feedQuery.data?.nextCursor && !feedQuery.isFetching) {
            // Note: Would need to implement fetchNextPage with useInfiniteQuery
            console.log('[Sosio] Load more posts - cursor:', feedQuery.data.nextCursor);
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={handleTabsScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
      />

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
                    <Text style={styles.tokenInputLabel}>Token Name</Text>
                    <View style={styles.tokenInputField}>
                      <TextInput
                        style={styles.tokenTextInput}
                        placeholder="e.g. SOL, ETH, BONK"
                        placeholderTextColor={COLORS.textSecondary}
                        value={tokenName}
                        onChangeText={setTokenName}
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <View style={styles.tokenInputWrapper}>
                    <Text style={styles.tokenInputLabel}>Token Address *</Text>
                    <View style={styles.tokenInputField}>
                      <TextInput
                        style={styles.tokenTextInput}
                        placeholder="Enter token contract address"
                        placeholderTextColor={COLORS.textSecondary}
                        value={tokenAddress}
                        onChangeText={setTokenAddress}
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

      <TokenBagModal
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
});

