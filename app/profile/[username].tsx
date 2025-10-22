import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, ChevronDown, UserPlus, UserMinus } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { SocialPost } from '../../components/SocialPost';


import { useSocial, TraderProfile } from '../../hooks/social-store';

type TimeFilter = '24h' | '7d' | '30d' | '90d';





export default function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { getTraderProfile, toggleFollow, isFollowing } = useSocial();
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');

  const [showTimeFilterModal, setShowTimeFilterModal] = useState(false);

  const userProfile: TraderProfile | null = username ? (getTraderProfile(username) || null) : null;
  const isUserFollowed = username ? isFollowing(username) : false;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Not Found</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User profile not found</Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userProfile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.userDetails}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>@{userProfile.username}</Text>
              {userProfile.isVerified && (
                <Shield size={16} color={COLORS.solana} style={styles.verifiedIcon} />
              )}
              {userProfile.badge && (
                <Text style={styles.badge}>
                  {userProfile.badge === 'elite' ? '🏆' : 
                   userProfile.badge === 'pro' ? '⭐' : 
                   userProfile.badge === 'vip' ? '👑' : '🥉'}
                </Text>
              )}
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
          <Text style={styles.sectionTitle}>📈 Trading Summary</Text>
          
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
        
        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.followButton,
              isUserFollowed && styles.followButtonActive,
            ]}
            onPress={() => username && toggleFollow(username)}
          >
            {isUserFollowed ? (
              <UserMinus size={20} color={COLORS.textPrimary} />
            ) : (
              <UserPlus size={20} color={COLORS.textPrimary} />
            )}
            <Text style={[
              styles.followButtonText,
              isUserFollowed && styles.followButtonTextActive,
            ]}>
              {isUserFollowed ? 'Unfollow' : 'Follow'}
            </Text>
          </TouchableOpacity>
          

        </View>
        

        
        {/* VIP */}
        {userProfile.vipPrice && (
          <View style={styles.vipContainer}>
            <Text style={styles.sectionTitle}>🔥 VIP</Text>
            <View style={styles.vipContent}>
              <Text style={styles.vipPrice}>Price: ${userProfile.vipPrice}/month</Text>
              <TouchableOpacity style={styles.joinVipButton}>
                <Text style={styles.joinVipText}>Join VIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Posts */}
        <View style={styles.postsContainer}>
          <Text style={styles.sectionTitle}>📣 Posts</Text>
          {/* Mock posts for the user */}
          <SocialPost
            id={`${userProfile.username}-post-1`}
            username={userProfile.username}
            profileImage={userProfile.profileImage}
            content={`SOL ready to breakout above $160. Loading up on calls here 🚀`}
            comments={12}
            reposts={8}
            likes={211}
            timestamp="2h"
            mentionedToken="SOL"
            isVerified={userProfile.isVerified}
            onPress={() => { if (__DEV__) console.log('Post pressed'); }}
            onBuyPress={() => { if (__DEV__) console.log('Buy pressed: SOL'); }}
          />
          <SocialPost
            id={`${userProfile.username}-post-2`}
            username={userProfile.username}
            profileImage={userProfile.profileImage}
            content={`BONK showing strong accumulation. This could be the next 10x meme play`}
            comments={23}
            reposts={15}
            likes={156}
            timestamp="4h"
            mentionedToken="BONK"
            isVerified={userProfile.isVerified}
            onPress={() => { if (__DEV__) console.log('Post pressed'); }}
            onBuyPress={() => { if (__DEV__) console.log('Buy pressed: BONK'); }}
          />
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
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
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
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xl,
  },
  statsContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    marginVertical: SPACING.m,
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
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.m,
  },
  pnlContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
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
    flexDirection: 'row',
    marginVertical: SPACING.m,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  errorText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
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
});