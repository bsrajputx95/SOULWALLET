import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Search, X, Plus, Link, ShoppingBag, Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { SocialPost } from '../../components/SocialPost';
import { NeonButton } from '../../components/NeonButton';
import { TokenBagModal } from '../../components/TokenBagModal';
import { CopyTradingModal } from '../../components/CopyTradingModal';
import { SocialPostSkeleton } from '../../components/SkeletonLoader';

import { useAuth } from '../../hooks/auth-store';
import { useSocial } from '../../hooks/social-store';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc'
import { useSolanaWallet } from '../../hooks/solana-wallet-store'

type FeedTab = 'forYou' | 'feed' | 'following' | 'notifications' | 'vip';

export default function SosioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { posts: allPosts, followedUsers } = useSocial();
  const profileQuery = trpc.user.getProfile.useQuery(undefined)
  const ibuyMutation = trpc.social.ibuyToken.useMutation()
  const ibuySettingsQuery = trpc.user.getIBuySettings.useQuery()
  const recordPurchaseMutation = trpc.social.recordIBuyPurchase.useMutation()
  const { executeSwap, publicKey, balance, tokenBalances } = useSolanaWallet()
  const [activeFeed, setActiveFeed] = useState<'all' | 'following' | 'vip' | 'forYou'>('forYou');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchBar, setShowSearchBar] = useState(false);



  // User search query - only run when search has 2+ characters
  // Strip @ prefix if user types it (usernames stored without @)
  const cleanedSearchQuery = searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery;
  // Use social.searchUsers (already exists in Railway deployment)
  const userSearchQuery = trpc.social.searchUsers.useQuery(
    { query: cleanedSearchQuery, limit: 5 },
    { enabled: cleanedSearchQuery.length >= 2 }
  );

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

  // Get feed query from social store or directly query
  const feedQuery = trpc.social.getFeed.useQuery({
    feedType: activeFeed as 'all' | 'following' | 'vip' | 'forYou',
    limit: 20,
  }, {
    refetchInterval: 30000,
  });

  // ✅ Notifications query
  const notificationsQuery = trpc.social.getNotifications.useQuery(
    { limit: 20 },
    { 
      enabled: activeTab === 'notifications',
      refetchInterval: 30000,
    }
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await feedQuery.refetch();
      if (activeTab === 'notifications') {
        await notificationsQuery.refetch();
      }
    } catch (error) {
      console.error('[Sosio] Refresh error:', error);
    }
    setRefreshing(false);
  }, [feedQuery, notificationsQuery, activeTab]);

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

  // Create post mutation
  const createPostMutation = trpc.social.createPost.useMutation({
    onSuccess: () => {
      // Refetch the feed after posting
      void feedQuery?.refetch();
    },
  });

  // Unread notifications count for badge
  const unreadCount = useMemo(() => {
    return notificationsQuery.data?.filter((n: any) => !n.isRead).length || 0;
  }, [notificationsQuery.data]);

  const handleCreatePost = async () => {
    if (!postContent.trim()) return;

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
    } else if (tab === 'feed') {
      setActiveFeed('all');
    } else if (tab === 'following') {
      setActiveFeed('following');
    } else if (tab === 'vip') {
      setActiveFeed('vip');
    }
    // notifications tab doesn't change activeFeed
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
              activeTab === 'feed' && styles.activeTab,
            ]}
            onPress={() => handleTabChange('feed')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'feed' && styles.activeTabText,
            ]}>
              Feed
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

          <Pressable
            style={[
              styles.tab,
              activeTab === 'notifications' && styles.activeTab,
            ]}
            onPress={() => handleTabChange('notifications')}
          >
            <View style={styles.notificationTabContent}>
              <Bell size={16} color={activeTab === 'notifications' ? COLORS.solana : COLORS.textSecondary} />
              <Text style={[
                styles.tabText,
                activeTab === 'notifications' && styles.activeTabText,
                { marginLeft: 4 }
              ]}>
                Notifications
              </Text>
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.tab,
              activeTab === 'vip' && styles.activeTab,
            ]}
            onPress={() => handleTabChange('vip')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'vip' && styles.activeTabText,
            ]}>
              VIP
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>

      {/* Main Content - FlatList for infinite scroll */}
      {activeTab === 'notifications' ? (
        // Notifications Tab Content
        <FlatList
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            {
              paddingHorizontal: responsivePadding,
              paddingBottom: bottomPadding
            }
          ]}
          data={notificationsQuery.data || []}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item: notification }: { item: any }) => (
            <Pressable
              style={[
                styles.notificationItem,
                !notification.isRead && styles.notificationUnread
              ]}
              onPress={() => {
                // Navigate based on notification type
                if (notification.postId) {
                  router.push(`/post/${notification.postId}`);
                } else if (notification.actorUsername) {
                  router.push(`/profile/${notification.actorUsername}`);
                }
              }}
            >
              <View style={styles.notificationIcon}>
                <Bell size={20} color={COLORS.solana} />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationText}>
                  {notification.message || `${notification.actorUsername || 'Someone'} ${notification.type === 'LIKE' ? 'liked your post' : notification.type === 'COMMENT' ? 'commented on your post' : notification.type === 'FOLLOW' ? 'started following you' : notification.type === 'REPOST' ? 'reposted your post' : 'interacted with you'}`}
                </Text>
                <Text style={styles.notificationTime}>
                  {new Date(notification.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            notificationsQuery.isLoading ? (
              <View style={styles.skeletonContainer}>
                <SocialPostSkeleton />
                <SocialPostSkeleton />
                <SocialPostSkeleton />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Bell size={48} color={COLORS.textSecondary} />
                <Text style={[styles.emptyText, { marginTop: 16 }]}>
                  No notifications yet
                </Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        // Feed/Following/VIP Tab Content
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
          renderItem={({ item: post }: { item: any }) => (
            <SocialPost
              key={post.id}
              id={post.id}
              username={post.username || post.user?.username}
              profileImage={post.profileImage || post.user?.profileImage}
              content={post.content}
              images={post.images || []}
              comments={post.comments || post._count?.comments || 0}
              reposts={post.reposts || post._count?.reposts || 0}
              likes={post.likes || post._count?.likes || 0}
              timestamp={post.timestamp || post.createdAt}
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
          )}
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
                      : activeTab === 'vip'
                        ? 'Subscribe to VIP content to see exclusive posts.'
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
      )}

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
                    <Text style={styles.tokenInputLabel}>Token Address (optional)</Text>
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
