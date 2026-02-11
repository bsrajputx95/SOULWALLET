import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, UserPlus, UserMinus, X, Zap, Copy } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { SocialPost, NeonCard, GlowingText } from '@/components';
import { fetchUserProfile, toggleFollow, fetchUserPosts, Post } from '@/services/social';
import { useAlert } from '@/contexts/AlertContext';

// Mock hooks for local-only mode
const useMockMutation = <T,>(alertFn: (title: string, message: string) => void, _options: { onSuccess?: () => void; onError?: (e: any) => void }) => ({
  mutate: (_params: any) => {
    // Simulate success for demo
    alertFn('Coming Soon', 'This feature is not available yet.');
  },
  mutateAsync: async (_params: any) => {
    alertFn('Coming Soon', 'This feature is not available yet.');
    return {} as T;
  },
  isPending: false,
});

// Profile data type
interface ProfileData {
  id: string;
  username: string;
  profileImage?: string;
  walletAddress?: string;
  followers: number;
  following: number;
  copyTraderCount: number;
  isFollowing: boolean;
  isCopying: boolean;
  roi30d: number;
  winRate: number;
  maxDrawdown?: number;
}


type TimeFilter = '24h' | '7d' | '30d' | '90d';

type PostVisibility = 'public' | 'followers' | 'vip';





export default function UserProfileScreen() {
  useRouter(); // Keep router available for future navigation
  const { username } = useLocalSearchParams<{ username: string }>();
  const { showAlert } = useAlert();

  // Real profile data from API
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [activePostsTab, setActivePostsTab] = useState<PostVisibility>('public');
  const [isVipMember, setIsVipMember] = useState(false);

  const [showTimeFilterModal, setShowTimeFilterModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyAmount, setCopyAmount] = useState('1000');
  const [amountPerTrade, setAmountPerTrade] = useState('100');
  const [stopLoss, setStopLoss] = useState('10');
  const [takeProfit, setTakeProfit] = useState('30');
  const [maxSlippage, setMaxSlippage] = useState('0.5');
  const [exitWithTrader, setExitWithTrader] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, [username]);

  // Load posts when tab changes
  useEffect(() => {
    if (username) {
      loadPosts();
    }
  }, [username, activePostsTab]);

  const loadProfile = async () => {
    if (!username) return;
    setLoading(true);
    const result = await fetchUserProfile(username);
    if (result.success && result.user) {
      setProfile(result.user);
    }
    setLoading(false);
  };

  const loadPosts = async () => {
    if (!username) return;
    setPostsLoading(true);
    const result = await fetchUserPosts(username, activePostsTab);
    if (result.success && result.posts) {
      setPosts(result.posts);
    }
    setPostsLoading(false);
  };

  // Mock copy trading mutation - coming soon
  const startCopyingMutation = useMockMutation(showAlert, {
    onSuccess: () => {
      showAlert('Success', `Now copying @${username}! Check your copy trades in the Home tab.`);
      setShowCopyModal(false);
      setTotpCode('');
    },
    onError: (error: any) => {
      showAlert('Error', error.message || 'Failed to start copy trading.');
    },
  });

  const handleFollowPress = async () => {
    if (!profile) return;
    const result = await toggleFollow(profile.id);
    if (result.success) {
      await loadProfile();
    } else {
      showAlert('Error', result.error || 'Failed to follow user');
    }
  };

  // Create unified profile object from API data
  const userProfile = profile ? {
    username: profile.username,
    profileImage: profile.profileImage,
    walletAddress: profile.walletAddress,
    isVerified: false,
    followers: profile.followers || 0,
    following: profile.following || 0,
    copyTraders: profile.copyTraderCount || 0,
    vipFollowers: 0,
    roi30d: profile.roi30d || 0,
    pnl24h: 0,
    maxDrawdown: profile.maxDrawdown || 0,
    winRate: profile.winRate || 0,
    vipPrice: undefined,
  } : username ? {
    // Placeholder profile when loading
    username: username,
    profileImage: undefined,
    walletAddress: undefined,
    isVerified: false,
    followers: 0,
    following: 0,
    copyTraders: 0,
    vipFollowers: 0,
    roi30d: 0,
    pnl24h: 0,
    maxDrawdown: 0,
    winRate: 0,
    vipPrice: undefined,
  } : null;

  const walletAddress = userProfile?.walletAddress || (userProfile ? `${userProfile.username}...` : '');
  const trustScore = 0.9; // Mock trust score

  // Posts fetched from API based on active tab
  const visiblePosts = posts;

  // Derived state
  const isFollowingUser = profile?.isFollowing || false;
  const isFollowLoading = loading; // Use loading state for follow button

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadPosts()]);
    setRefreshing(false);
  }, []);

  // No loading state needed for local mock data

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile Not Found</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User @{username} not found</Text>
          <Text style={styles.errorSubtext}>This user may not exist or the profile is not available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getPnLForTimeFilter = (filter: TimeFilter): number => {
    switch (filter) {
      case '24h': return userProfile.pnl24h;
      case '7d': return userProfile.pnl24h * 4.2;
      case '30d': return userProfile.pnl24h * 18.5;
      case '90d': return userProfile.pnl24h * 45.2;
      default: return userProfile.pnl24h;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {userProfile.profileImage ? (
              <Image
                source={{ uri: userProfile.profileImage }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {userProfile.username.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <View style={styles.userDetails}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>@{userProfile.username}</Text>
            </View>
            <View style={styles.walletRow}>
              <Text style={styles.walletAddress} numberOfLines={1} ellipsizeMode="middle">
                {walletAddress}
              </Text>
              <TouchableOpacity
                style={styles.copyIconButton}
                onPress={async () => {
                  try {
                    await Clipboard.setStringAsync(walletAddress);
                    showAlert('Copied', 'Wallet address copied to clipboard');
                  } catch (e) {
                    // Clipboard copy failed silently
                  }
                }}
              >
                <Copy size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(userProfile.followers)}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(userProfile.following)}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(userProfile.copyTraders)}</Text>
              <Text style={styles.statLabel}>Copy Traders</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.success }]}>+{userProfile.roi30d}%</Text>
              <Text style={styles.statLabel}>ROI (30d)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(userProfile.vipFollowers)}</Text>
              <Text style={styles.statLabel}>VIP</Text>
            </View>
          </View>
        </View>

        {/* Trading Summary */}
        <View style={styles.tradingSummaryContainer}>
          <Text style={styles.sectionTitle}>Trading Summary</Text>

          <View style={styles.pnlContainer}>
            <TouchableOpacity
              style={styles.timeFilterButton}
              onPress={() => setShowTimeFilterModal(true)}
            >
              <Text style={styles.pnlLabel}>{timeFilter} PnL:</Text>
              <ChevronDown size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.pnlValue, { color: COLORS.success }]}>
              +{formatCurrency(getPnLForTimeFilter(timeFilter))}
            </Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Max Drawdown:</Text>
              <Text style={[styles.metricValue, { color: COLORS.error }]}>
                {userProfile.maxDrawdown}%
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Win Rate:</Text>
              <Text style={[styles.metricValue, { color: COLORS.success }]}>
                {userProfile.winRate}%
              </Text>
            </View>
          </View>
        </View>

        {/* Trust Score (Neon Bar) */}
        <NeonCard style={styles.trustScoreCard} color={COLORS.gradientPurple} intensity="medium">
          <View style={styles.trustHeader}>
            <Text style={styles.trustLabel}>Trust Score</Text>
            <GlowingText text={`${Math.round(trustScore * 100)}%`} color={COLORS.success} fontSize={16} intensity="high" />
          </View>
          <View style={styles.trustBarTrack}>
            <View style={[styles.trustBarFill, { width: `${trustScore * 100}%` }]} />
          </View>
        </NeonCard>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowingUser && styles.followButtonActive,
            ]}
            onPress={handleFollowPress}
            disabled={isFollowLoading}
          >
            {isFollowingUser ? (
              <UserMinus size={20} color={COLORS.textPrimary} />
            ) : (
              <UserPlus size={20} color={COLORS.textPrimary} />
            )}
            <Text style={[
              styles.followButtonText,
              isFollowingUser && styles.followButtonTextActive,
            ]}>
              {isFollowLoading ? 'Loading...' : (isFollowingUser ? 'Unfollow' : 'Follow')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => setShowCopyModal(true)}
          >
            <Zap size={20} color={COLORS.success} />
            <Text style={styles.copyButtonText}>Copy this trader</Text>
          </TouchableOpacity>

        </View>



        {/* VIP */}
        {userProfile.vipPrice && (
          <View style={styles.vipContainer}>
            <Text style={styles.sectionTitle}>VIP</Text>
            <View style={styles.vipContent}>
              <Text style={styles.vipPrice}>Price: ${userProfile.vipPrice}/month</Text>
              <TouchableOpacity
                style={styles.joinVipButton}
                onPress={() => {
                  setIsVipMember(true);
                  showAlert('Joined VIP', `You are now a VIP member of @${userProfile.username}`);
                }}
              >
                <Text style={styles.joinVipText}>{isVipMember ? 'VIP Active' : 'Join VIP'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Posts */}
        <View style={styles.postsContainer}>
          <Text style={styles.sectionTitle}>Posts</Text>
          <View style={styles.postsTabsHeader}>
            {(['public', 'followers', 'vip'] as PostVisibility[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.postsTab,
                  activePostsTab === tab && styles.postsActiveTab,
                ]}
                onPress={() => setActivePostsTab(tab)}
              >
                <Text style={[
                  styles.postsTabText,
                  activePostsTab === tab && styles.postsActiveTabText,
                ]}>
                  {tab === 'public' ? 'Public' : tab === 'followers' ? 'Followers' : 'VIP'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {postsLoading ? (
            <View style={styles.gatedContainer}>
              <Text style={styles.gatedText}>Loading posts...</Text>
            </View>
          ) : activePostsTab === 'followers' && !isFollowingUser ? (
            <View style={styles.gatedContainer}>
              <Text style={styles.gatedText}>Follow @{userProfile.username} to view followers-only posts.</Text>
              <TouchableOpacity
                style={[styles.followButton, styles.gatedActionButton]}
                onPress={handleFollowPress}
                disabled={isFollowLoading}
              >
                <UserPlus size={20} color={COLORS.textPrimary} />
                <Text style={styles.followButtonText}>{isFollowLoading ? 'Loading...' : 'Follow'}</Text>
              </TouchableOpacity>
            </View>
          ) : activePostsTab === 'vip' && !isVipMember ? (
            <View style={styles.gatedContainer}>
              <Text style={styles.gatedText}>Subscribe to VIP to see exclusive posts.</Text>
              <TouchableOpacity
                style={[styles.joinVipButton, styles.gatedVipButton]}
                onPress={() => {
                  setIsVipMember(true);
                  showAlert('Joined VIP', `You are now a VIP member of @${userProfile.username}`);
                }}
              >
                <Text style={styles.joinVipText}>Join VIP</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {visiblePosts.length > 0 ? (
                visiblePosts.map((post: any) => (
                  <SocialPost
                    key={post.id}
                    id={post.id}
                    username={post.user?.username || userProfile.username}
                    profileImage={post.user?.profileImage || userProfile.profileImage || ''}
                    content={post.content}
                    comments={post.commentsCount || 0}
                    likes={post.likesCount || 0}
                    timestamp={new Date(post.createdAt).toLocaleString()}
                    mentionedToken={post.tokenSymbol || post.tokenName || ''}
                    isVerified={userProfile.isVerified}
                  />
                ))
              ) : (
                <View style={styles.gatedContainer}>
                  <Text style={styles.gatedText}>No posts in this section yet.</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>



      {/* Time Filter Modal */}
      <Modal
        visible={showTimeFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimeFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTimeFilterModal(false)}
        >
          <View style={styles.timeFilterModal}>
            <Text style={styles.modalTitle}>Select Time Period</Text>
            {(['24h', '7d', '30d', '90d'] as TimeFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.timeFilterOption,
                  timeFilter === filter && styles.timeFilterOptionActive,
                ]}
                onPress={() => {
                  setTimeFilter(filter);
                  setShowTimeFilterModal(false);
                }}
              >
                <Text style={[
                  styles.timeFilterOptionText,
                  timeFilter === filter && styles.timeFilterOptionTextActive,
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Copy Trading Modal */}
      <Modal
        visible={showCopyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCopyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.copyModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Copy @{userProfile.username}</Text>
              <TouchableOpacity onPress={() => setShowCopyModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDescription}>
                Set up copy trading parameters for @{userProfile.username}
              </Text>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Total Amount (USDC)</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1000"
                    placeholderTextColor={COLORS.textSecondary}
                    value={copyAmount}
                    onChangeText={setCopyAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Amount per Trade (USDC)</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="100"
                    placeholderTextColor={COLORS.textSecondary}
                    value={amountPerTrade}
                    onChangeText={setAmountPerTrade}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Stop Loss (%)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="10"
                    placeholderTextColor={COLORS.textSecondary}
                    value={stopLoss}
                    onChangeText={setStopLoss}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Take Profit (%)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor={COLORS.textSecondary}
                    value={takeProfit}
                    onChangeText={setTakeProfit}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Max Slippage (%)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="0.5"
                    placeholderTextColor={COLORS.textSecondary}
                    value={maxSlippage}
                    onChangeText={setMaxSlippage}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.exitWithTraderButton, exitWithTrader && styles.exitWithTraderButtonActive]}
                onPress={() => setExitWithTrader(prev => !prev)}
              >
                <Text style={[styles.exitWithTraderText, exitWithTrader && styles.exitWithTraderTextActive]}>Exit with Trader</Text>
                <Text style={styles.exitWithTraderSubtext}>Automatically exit when trader exits</Text>
              </TouchableOpacity>

              {/* Fee disclosure */}
              <View style={styles.feeDisclosure}>
                <Text style={styles.feeDisclosureText}>
                  💡 5% of your profits will be shared with this trader when positions close in profit.
                </Text>
              </View>

              {/* 2FA Code Input - Required for copy trading */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>2FA Code (Required)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={COLORS.textSecondary}
                    value={totpCode}
                    onChangeText={setTotpCode}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.startCopyButton,
                  (startCopyingMutation.isPending || totpCode.length !== 6) && styles.startCopyButtonDisabled
                ]}
                disabled={startCopyingMutation.isPending || totpCode.length !== 6}
                onPress={async () => {
                  // Validate inputs
                  const totalBudget = parseFloat(copyAmount) || 1000;
                  const perTrade = parseFloat(amountPerTrade) || 100;

                  if (perTrade > totalBudget) {
                    showAlert('Error', 'Amount per trade cannot exceed total budget');
                    return;
                  }

                  // Get the actual wallet address
                  const traderWallet = (userProfile as any)?.walletAddress;
                  if (!traderWallet) {
                    showAlert('Error', 'Trader wallet address not found. This user may not have a wallet set up.');
                    return;
                  }

                  try {
                    await startCopyingMutation.mutateAsync({
                      walletAddress: traderWallet,
                      totalBudget,
                      amountPerTrade: perTrade,
                      stopLoss: stopLoss ? -Math.abs(parseFloat(stopLoss)) : undefined,
                      takeProfit: takeProfit ? Math.abs(parseFloat(takeProfit)) : undefined,
                      maxSlippage: maxSlippage ? Math.abs(parseFloat(maxSlippage)) : 0.5,
                      exitWithTrader,
                      totpCode,
                    });
                  } catch {
                  }
                }}
              >
                <Text style={styles.startCopyText}>
                  {startCopyingMutation.isPending ? 'Starting...' : 'Start Copying'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.m,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  errorText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  errorSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.s, // Reduced for edge-to-edge layout
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  headerTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userDetails: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginRight: SPACING.xs,
  },
  walletAddress: {
    flex: 1,
    flexShrink: 1,
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  copyIconButton: {
    marginLeft: SPACING.xs,
    padding: 4,
  },
  verifiedIcon: {
    marginRight: SPACING.xs,
  },
  badge: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.xs, // Small padding for slight margin
    paddingBottom: SPACING.xl,
  },
  statsContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0, // No border radius for edge-to-edge
    padding: SPACING.m,
    marginVertical: SPACING.s,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.m,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  tradingSummaryContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 0, // No border radius for edge-to-edge
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  sectionTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.m,
  },
  pnlContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  timeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pnlLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginRight: SPACING.xs,
  },
  pnlValue: {
    ...FONTS.phantomBold,
    fontSize: 18,
    marginLeft: SPACING.s,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  metricValue: {
    ...FONTS.phantomBold,
    fontSize: 16,
  },
  actionButtonsContainer: {
    flexDirection: 'column',
    marginVertical: SPACING.s,
    gap: SPACING.s,
  },
  trustScoreCard: {
    marginBottom: SPACING.s,
  },
  trustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  trustLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  trustBarTrack: {
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.glowGreen,
    overflow: 'hidden',
  },
  trustBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.full,
    shadowColor: COLORS.glowGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana,
  },
  followButtonActive: {
    backgroundColor: COLORS.solana + '20',
  },
  followButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 16,
    marginLeft: SPACING.xs,
  },
  followButtonTextActive: {
    color: COLORS.textPrimary,
  },


  vipContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  vipContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vipPrice: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  joinVipButton: {
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
  },
  joinVipText: {
    ...FONTS.phantomMedium,
    color: COLORS.warning,
    fontSize: 14,
  },
  postsContainer: {
    marginBottom: SPACING.m,
  },
  postsTabsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  postsTab: {
    flex: 1,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
    alignItems: 'center',
  },
  postsActiveTab: {
    backgroundColor: COLORS.solana + '20',
    borderColor: COLORS.solana,
  },
  postsTabText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  postsActiveTabText: {
    color: COLORS.solana,
  },
  gatedContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    alignItems: 'center',
  },
  gatedText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  gatedActionButton: {
    width: '100%',
  },
  gatedVipButton: {
    alignSelf: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeFilterModal: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    minWidth: 200,
  },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  timeFilterOption: {
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: BORDER_RADIUS.small,
    marginBottom: SPACING.xs,
  },
  timeFilterOptionActive: {
    backgroundColor: COLORS.solana + '20',
  },
  timeFilterOptionText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  timeFilterOptionTextActive: {
    color: COLORS.solana,
  },
  // Copy Trading styles
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  copyButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.success,
    fontSize: 16,
    marginLeft: SPACING.xs,
  },
  copyModalContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    width: '90%',
    maxWidth: 420,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
  },
  modalContent: {
    maxHeight: '80%',
  },
  modalDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.m,
  },
  inputSection: {
    marginBottom: SPACING.m,
  },
  inputLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  inputPrefix: {
    ...FONTS.phantomBold,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginRight: SPACING.s,
  },
  input: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  inputSuffix: {
    ...FONTS.phantomBold,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  exitWithTraderButton: {
    backgroundColor: COLORS.solana + '10',
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginBottom: SPACING.m,
  },
  exitWithTraderButtonActive: {
    backgroundColor: COLORS.solana + '20',
    borderColor: COLORS.solana + '30',
  },
  exitWithTraderText: {
    ...FONTS.phantomBold,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  exitWithTraderTextActive: {
    color: COLORS.solana,
  },
  exitWithTraderSubtext: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  startCopyButton: {
    backgroundColor: COLORS.success + '20',
    borderRadius: BORDER_RADIUS.medium,
    paddingVertical: SPACING.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
    marginBottom: SPACING.s,
  },
  startCopyButtonDisabled: {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.textSecondary + '30',
    opacity: 0.6,
  },
  startCopyText: {
    ...FONTS.phantomBold,
    color: COLORS.success,
    fontSize: 16,
  },
  feeDisclosure: {
    backgroundColor: COLORS.solana + '10',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  feeDisclosureText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
