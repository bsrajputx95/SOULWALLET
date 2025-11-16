import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Pressable, 
  ScrollView, 
  RefreshControl,
  TextInput,
  Modal,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Search, X, Plus, Link, ShoppingBag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { SocialPost } from '../../components/SocialPost';
import { NeonButton } from '../../components/NeonButton';
import { NeonInput } from '../../components/NeonInput';
import { TokenBagModal } from '../../components/TokenBagModal';

import { useAuth } from '../../hooks/auth-store';
import { useSocial } from '../../hooks/social-store';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc'
import { useSolanaWallet } from '../../hooks/solana-wallet-store'

type FeedTab = 'feed' | 'following' | 'groups' | 'vip';

export default function SosioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { posts: allPosts, followedUsers } = useSocial();
  const profileQuery = trpc.user.getProfile.useQuery(undefined)
  const ibuyMutation = trpc.social.ibuyToken.useMutation()
  const { executeSwap } = useSolanaWallet()
  const [activeFeed, setActiveFeed] = useState<'all' | 'following' | 'vip'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchBar, setShowSearchBar] = useState(false);

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
  const [activeTab, setActiveTab] = useState<FeedTab>('feed');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showTokenBagModal, setShowTokenBagModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [mentionToken, setMentionToken] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [postVisibility, setPostVisibility] = useState<'public' | 'vip' | 'followers'>('public');
  
  // Header height for content offset
  const HEADER_HEIGHT = 60;
  // Tabs smooth hide/show on scroll
  const TABS_HEIGHT = 44;
  const tabsHeight = useRef(new Animated.Value(TABS_HEIGHT)).current;
  const scrollEventValue = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const tabsHidden = useRef(false);
  


  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

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

  const handleCreatePost = async () => {
    if (!postContent.trim()) return;
    
    // In a real app, this would send to backend via tRPC
    // For now, just close the modal
    if (__DEV__) {
      console.log('Creating post:', {
        content: postContent,
        mentionedToken: mentionToken ? tokenName : undefined,
        visibility: postVisibility });
    }
    
    setShowNewPostModal(false);
    setPostContent('');
    setMentionToken(false);
    setTokenName('');
    setTokenAddress('');
  };
  

  
  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(decimals);
  };

  const handleTabChange = (tab: FeedTab) => {
    setActiveTab(tab);
    
    // Map tabs to feed types
    if (tab === 'feed') {
      setActiveFeed('all');
    } else if (tab === 'following') {
      setActiveFeed('following');
    } else if (tab === 'vip') {
      setActiveFeed('vip');
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.username}>@{user?.username || 'user'}</Text>
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
              activeTab === 'groups' && styles.activeTab,
            ]}
            onPress={() => handleTabChange('groups')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'groups' && styles.activeTabText,
            ]}>
              Groups
            </Text>
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
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer, 
          { 
            paddingHorizontal: responsivePadding,
            paddingBottom: bottomPadding
          }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={handleTabsScroll}
        scrollEventThrottle={16}
      >
        {profileQuery.data && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}><Text style={styles.statLabel}>Followers</Text><Text style={styles.statValue}>{profileQuery.data.stats.followersCount}</Text></View>
            <View style={styles.statBox}><Text style={styles.statLabel}>Following</Text><Text style={styles.statValue}>{profileQuery.data.stats.followingCount}</Text></View>
            <View style={styles.statBox}><Text style={styles.statLabel}>Copy</Text><Text style={styles.statValue}>{profileQuery.data.stats.copyTradersCount}</Text></View>
            <View style={styles.statBox}><Text style={styles.statLabel}>ROI</Text><Text style={styles.statValue}>{profileQuery.data.stats.roi}%</Text></View>
          </View>
        )}
        {activeTab === 'groups' ? (
          <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonTitle}>Groups Coming Soon</Text>
            <Text style={styles.comingSoonDescription}>
              Join trading groups with like-minded traders and share insights.
            </Text>
          </View>
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map(post => (
            <SocialPost
              key={post.id}
              id={post.id}
              username={post.username}
              profileImage={post.profileImage}
              content={post.content}
              images={[]}
              comments={post.comments}
              reposts={post.reposts}
              likes={post.likes}
              timestamp={post.timestamp}
              mentionedToken={post.mentionedToken}
              mentionedTokenMint={undefined}
              isVerified={post.isVerified}
              onUpdate={() => { if (__DEV__) console.log('Post updated'); }}
              onBuyPress={async () => {
                if (!post.mentionedTokenMint) return
                try {
                  const res = await ibuyMutation.mutateAsync({ postId: post.id, tokenMint: post.mentionedTokenMint })
                  await executeSwap(res.swapTransaction)
                } catch (e: any) {}
              }}
            />
          ))
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
        )}
      </ScrollView>
      
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
                  <NeonInput
                    label="Token Name"
                    placeholder="e.g. SOL, ETH, BONK"
                    value={tokenName}
                    onChangeText={setTokenName}
                  />
                  
                  <NeonInput
                    label="Token Address (optional)"
                    placeholder="Enter token contract address"
                    value={tokenAddress}
                    onChangeText={setTokenAddress}
                  />
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
    flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3 },
  username: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3 },
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
    marginBottom: SPACING.m },
  searchIcon: {
    marginRight: SPACING.s },
  searchInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.m,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2 },
  tabsContainer: {
    marginBottom: SPACING.m },
  tabsScroll: {
    minHeight: 44 },
  tab: {
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    marginRight: SPACING.s,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.cardBackground,
    minHeight: 36,
    justifyContent: 'center' },
  activeTab: {
    backgroundColor: COLORS.solana + '20' },
  tabText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2 },
  activeTabText: {
    color: COLORS.solana },
  content: {
    flex: 1 },
  contentContainer: {
    minHeight: 200 },
  comingSoonContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200 },
  comingSoonTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
    marginBottom: SPACING.m,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3 },
  comingSoonDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center' },
  emptyContainer: {
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200 },
  emptyText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center' },
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
    alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center' },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.large,
    paddingBottom: 20,
    maxHeight: '80%',
    width: '92%',
    maxWidth: 720,
    alignSelf: 'center' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18 },
  modalContent: {
    padding: SPACING.l },
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
    marginBottom: SPACING.m },
  tokenMentionContainer: {
    marginBottom: SPACING.m },
  tokenMentionLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center' },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.l },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs },
  radioButtonSelected: {
    borderColor: COLORS.solana },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.solana },
  radioText: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 16 },
  tokenInputsContainer: {
    marginBottom: SPACING.m },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.m },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.solana + '20',
    justifyContent: 'center',
    alignItems: 'center' },
  postButton: {
    flex: 1,
    marginLeft: SPACING.m },
  visibilityContainer: {
    marginBottom: SPACING.m },
  visibilityLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s },
  visibilityOptions: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4 },
  visibilityOption: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small },
  visibilityOptionActive: {
    backgroundColor: COLORS.solana + '20' },
  visibilityOptionText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14 },
  visibilityOptionTextActive: {
    color: COLORS.solana },
  loadingContainer: {
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200 },
  loadingText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16 },
  errorContainer: {
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200 },
  errorText: {
    ...FONTS.phantomRegular,
    color: COLORS.error,
    fontSize: 16,
    marginBottom: SPACING.m,
    textAlign: 'center' },
  retryButton: {
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.medium },
  retryText: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 14 },
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
});
