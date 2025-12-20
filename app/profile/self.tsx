import React from 'react';
import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Settings, Shield, Plus, X, DollarSign } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { NeonCard } from '../../components/NeonCard';
import { SocialPost } from '../../components/SocialPost';
import { useAuth } from '../../hooks/auth-store';
import { trpc } from '../../lib/trpc';

export default function SelfProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'public' | 'vip'>('public');
  const [showVipSetup, setShowVipSetup] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [vipPrice, setVipPrice] = useState('');
  const [vipDuration, setVipDuration] = useState<'monthly' | 'lifetime'>('monthly');

  // Responsive padding logic like Home screen
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const responsivePadding = isSmallScreen ? 8 : isLargeScreen ? 16 : 12;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Fetch real profile data from API
  const profileQuery = trpc.user.getProfile.useQuery(undefined);

  // Use real data from API or fallback to defaults
  const stats = {
    followers: profileQuery.data?.stats?.followersCount || 0,
    following: profileQuery.data?.stats?.followingCount || 0,
    copyTraders: profileQuery.data?.stats?.copyTradersCount || 0,
    roi30d: profileQuery.data?.stats?.roi || 0,
    vipSubs: profileQuery.data?.stats?.vipSubscribersCount || 0,
  };

  const tradingSummary = {
    pnl24h: profileQuery.data?.tradingStats?.pnl24h || 0,
    winRate: profileQuery.data?.tradingStats?.winRate || 0,
    maxDrawdown: profileQuery.data?.tradingStats?.maxDrawdown || 0,
    followerEquity: profileQuery.data?.tradingStats?.followerEquity || 0,
  };

  // VIP info from API or defaults
  const vipInfo = {
    price: (profileQuery.data as any)?.vipPrice || 0,
    subscribers: stats.vipSubs,
  };



  // TODO: Fetch real posts from API
  // const postsQuery = trpc.social.getUserPosts.useQuery({ userId: user?.id });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'public':
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        );
      case 'vip':
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No VIP posts yet</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: responsivePadding }]}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {user?.username ? (user.username.length > 12 ? user.username.slice(0, 12) + '...' : user.username) : 'user'}
              </Text>
            </View>
            <Text style={styles.username}>@{user?.username || 'user'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/account')}
        >
          <Settings size={18} color={COLORS.solana} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingHorizontal: responsivePadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.followers.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.binance }]}>{stats.vipSubs}</Text>
              <Text style={styles.statLabel}>VIP Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.copyTraders}</Text>
              <Text style={styles.statLabel}>Copy Traders</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItemCenter}>
              <Text style={[styles.statValue, { color: COLORS.success }]}>+{stats.roi30d}%</Text>
              <Text style={styles.statLabel}>ROI (30d)</Text>
            </View>
          </View>
        </View>

        {/* Trading Summary */}
        <NeonCard style={styles.tradingSummaryCard}>
          <Text style={styles.sectionTitle}>Trading Summary</Text>
          <View style={styles.tradingStats}>
            <View style={styles.tradingStatRow}>
              <Text style={styles.tradingStatLabel}>24h PnL:</Text>
              <Text style={[styles.tradingStatValue, { color: COLORS.success }]}>
                +${tradingSummary.pnl24h.toLocaleString()}
              </Text>
            </View>
            <View style={styles.tradingStatRow}>
              <Text style={styles.tradingStatLabel}>Win Rate:</Text>
              <Text style={styles.tradingStatValue}>{tradingSummary.winRate}%</Text>
            </View>
            <View style={styles.tradingStatRow}>
              <Text style={styles.tradingStatLabel}>Max Drawdown:</Text>
              <Text style={[styles.tradingStatValue, { color: COLORS.error }]}>
                {tradingSummary.maxDrawdown}%
              </Text>
            </View>
            <View style={styles.tradingStatRow}>
              <Text style={styles.tradingStatLabel}>Follower Equity:</Text>
              <Text style={styles.tradingStatValue}>
                ${tradingSummary.followerEquity.toLocaleString()}
              </Text>
            </View>
          </View>
        </NeonCard>



        {/* VIP Section */}
        <NeonCard style={styles.vipCard}>
          <Text style={styles.sectionTitle}>VIP Section</Text>
          <View style={styles.vipInfo}>
            <Text style={styles.vipText}>
              Price: ${vipInfo.price}/month | Subs: {vipInfo.subscribers}
            </Text>
            <View style={styles.vipButtons}>
              <TouchableOpacity style={styles.vipButton}>
                <Text style={styles.vipButtonText}>View Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.vipButton}>
                <Text style={styles.vipButtonText}>Edit Price</Text>
              </TouchableOpacity>
            </View>
          </View>
        </NeonCard>

        {/* VIP Setup and Get Verified */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowVipSetup(true)}
          >
            <DollarSign size={20} color={COLORS.binance} />
            <Text style={styles.actionButtonText}>Enable VIP</Text>
          </TouchableOpacity>

          {/* Get Verified - Coming Soon */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Verification feature will be available soon!')}
          >
            <Shield size={20} color={COLORS.solana} />
            <Text style={styles.actionButtonText}>Get Verified</Text>
          </TouchableOpacity>
        </View>

        {/* Posts Tabs */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsHeader}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'public' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('public')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'public' && styles.activeTabText,
              ]}>
                Public
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'vip' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('vip')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'vip' && styles.activeTabText,
              ]}>
                VIP
              </Text>
            </TouchableOpacity>


          </View>

          <View style={styles.tabContent}>
            {renderTabContent()}
          </View>
        </View>
      </ScrollView>

      {/* Floating Fire Button */}
      <TouchableOpacity style={styles.newPostButton}>
        <LinearGradient
          colors={COLORS.gradientPurple as any}
          style={styles.newPostGradient}
        >
          <Plus size={24} color={COLORS.textPrimary} />
        </LinearGradient>
      </TouchableOpacity>

      {/* VIP Setup Modal */}
      <Modal
        visible={showVipSetup}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVipSetup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.9, maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enable VIP Posting</Text>
              <TouchableOpacity onPress={() => setShowVipSetup(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Enable VIP to post private, premium-only content that subscribers pay to access.
              </Text>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>VIP Price (USDC)</Text>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="49"
                    placeholderTextColor={COLORS.textSecondary}
                    value={vipPrice}
                    onChangeText={setVipPrice}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.inputHint}>Min: $5, Max: $999</Text>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Duration</Text>
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setVipDuration('monthly')}
                  >
                    <View style={[
                      styles.radioButton,
                      vipDuration === 'monthly' && styles.radioButtonSelected,
                    ]}>
                      {vipDuration === 'monthly' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioText}>Monthly</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setVipDuration('lifetime')}
                  >
                    <View style={[
                      styles.radioButton,
                      vipDuration === 'lifetime' && styles.radioButtonSelected,
                    ]}>
                      {vipDuration === 'lifetime' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioText}>Lifetime</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.warningText}>
                ⚠️ VIP content is hidden unless users pay for access. This helps you monetize your trading insights.
              </Text>

              <TouchableOpacity
                style={styles.enableButton}
                onPress={() => {
                  setShowVipSetup(false);
                  Alert.alert('Coming Soon', 'VIP Mode feature will be available soon!');
                }}
              >
                <Text style={styles.enableButtonText}>Enable VIP Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verification Modal */}
      <Modal
        visible={showVerification}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVerification(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.9, maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Get Verified on Sosio</Text>
              <TouchableOpacity onPress={() => setShowVerification(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.verificationOption}>
                <Text style={styles.optionTitle}>✅ Option 1: Pay 10 SOL instantly</Text>
                <Text style={styles.optionDescription}>
                  Get verified immediately by paying 10 SOL (~$1,500)
                </Text>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => {
                    if (__DEV__) console.log('Instant verification selected');
                    setShowVerification(false);
                  }}
                >
                  <Text style={styles.optionButtonText}>Choose This Option</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.verificationOption}>
                <Text style={styles.optionTitle}>🔥 Option 2: Organic Growth</Text>
                <Text style={styles.optionDescription}>
                  Meet these requirements:
                  • 10,000+ followers
                  • 200+ VIP subscribers
                  • Active trading history
                </Text>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => {
                    if (__DEV__) console.log('Organic verification selected');
                    setShowVerification(false);
                  }}
                >
                  <Text style={styles.optionButtonText}>Submit Request</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.verificationNote}>
                💡 Verified profiles appear higher in feeds and gain more trust from the community.
              </Text>
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.s,
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s,
  },
  avatarText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
  },
  userDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  displayName: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  verifiedIcon: {
    marginRight: SPACING.xs,
  },
  badge: {
    backgroundColor: COLORS.binance,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.small,
  },
  badgeText: {
    ...FONTS.phantomBold,
    color: COLORS.background,
    fontSize: 9,
  },
  username: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.l,
    paddingBottom: 100,
  },
  statsGrid: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.l,
    marginBottom: SPACING.l,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statItemCenter: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  tradingSummaryCard: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.m,
  },
  tradingStats: {
    gap: SPACING.s,
  },
  tradingStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradingStatLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  tradingStatValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
  },

  vipCard: {
    marginBottom: SPACING.l,
  },
  vipInfo: {
    gap: SPACING.m,
  },
  vipText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  vipButtons: {
    flexDirection: 'row',
    gap: SPACING.s,
  },
  vipButton: {
    backgroundColor: COLORS.solana + '20',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.small,
  },
  vipButtonText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: SPACING.m,
    marginBottom: SPACING.l,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
  },
  actionButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.large,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
  },
  modalContent: {
    padding: SPACING.l,
  },
  modalDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: SPACING.l,
    lineHeight: 24,
  },
  inputSection: {
    marginBottom: SPACING.l,
  },
  inputLabel: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  currencySymbol: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 18,
    marginRight: SPACING.s,
  },
  priceInput: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    paddingVertical: SPACING.m,
  },
  inputHint: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  radioContainer: {
    flexDirection: 'row',
    gap: SPACING.l,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s,
  },
  radioButtonSelected: {
    borderColor: COLORS.solana,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.solana,
  },
  radioText: {
    ...FONTS.phantomRegular,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  warningText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.l,
    lineHeight: 20,
  },
  enableButton: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    alignItems: 'center',
  },
  enableButtonText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  verificationOption: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  optionTitle: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  optionDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.m,
    lineHeight: 20,
  },
  optionButton: {
    backgroundColor: COLORS.solana + '20',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.small,
    alignItems: 'center',
  },
  optionButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 14,
  },
  verificationNote: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  tabsContainer: {
    marginBottom: SPACING.l,
  },
  tabsHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.m,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small,
  },
  activeTab: {
    backgroundColor: COLORS.solana + '20',
  },
  tabText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  activeTabText: {
    color: COLORS.solana,
  },
  tabContent: {
    marginBottom: SPACING.l,
  },
  emptyContainer: {
    padding: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  emptyText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  newPostButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  newPostGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});