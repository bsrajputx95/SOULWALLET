import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, SPACING } from '../constants/theme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = BORDER_RADIUS.small,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[COLORS.cardBackground, COLORS.cardBackground + 'AA', COLORS.cardBackground]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

// Skeleton for Token Card
export const TokenCardSkeleton: React.FC = () => (
  <View style={styles.tokenCard}>
    <View style={styles.tokenCardLeft}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={styles.tokenCardInfo}>
        <SkeletonLoader width={80} height={16} />
        <SkeletonLoader width={120} height={12} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
    <View style={styles.tokenCardRight}>
      <SkeletonLoader width={60} height={16} />
      <SkeletonLoader width={50} height={12} style={{ marginTop: SPACING.xs }} />
    </View>
  </View>
);

// Skeleton for Social Post
export const SocialPostSkeleton: React.FC = () => (
  <View style={styles.postCard}>
    <View style={styles.postHeader}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={styles.postHeaderInfo}>
        <SkeletonLoader width={100} height={16} />
        <SkeletonLoader width={60} height={12} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
    <SkeletonLoader width="100%" height={16} style={{ marginTop: SPACING.m }} />
    <SkeletonLoader width="90%" height={16} style={{ marginTop: SPACING.xs }} />
    <SkeletonLoader width="70%" height={16} style={{ marginTop: SPACING.xs }} />
    <View style={styles.postActions}>
      <SkeletonLoader width={60} height={12} />
      <SkeletonLoader width={60} height={12} />
      <SkeletonLoader width={60} height={12} />
    </View>
  </View>
);

// Skeleton for Quick Action Buttons
export const QuickActionsSkeleton: React.FC = () => (
  <View style={styles.quickActions}>
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={styles.quickAction}>
        <SkeletonLoader width={60} height={60} borderRadius={BORDER_RADIUS.medium} />
        <SkeletonLoader width={50} height={12} style={{ marginTop: SPACING.xs }} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    overflow: 'hidden',
  },
  tokenCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.m,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.s,
  },
  tokenCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenCardInfo: {
    marginLeft: SPACING.m,
    flex: 1,
  },
  tokenCardRight: {
    alignItems: 'flex-end',
  },
  postCard: {
    padding: SPACING.m,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.m,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postHeaderInfo: {
    marginLeft: SPACING.m,
    flex: 1,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.m,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.m,
  },
  quickAction: {
    alignItems: 'center',
  },
});
