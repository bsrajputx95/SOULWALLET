import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';
import { NotificationTabBadge } from './NotificationBadge';
import { useTabBar } from '../contexts/TabBarContext';

type TabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
  insets?: any;
};

export const TabBar: React.FC<TabBarProps> = (props) => {
  const { state, descriptors, navigation } = props;
  const { isTabBarVisible } = useTabBar();

  // Hide tab bar when not visible
  if (!isTabBarVisible) {
    return null;
  }

  // Static dummy data - pure UI mode (no hooks)
  const badgeCount = 0;

  // Create animated values for each tab
  const animatedValues = useRef(
    state?.routes?.map(() => new Animated.Value(0)) || []
  ).current;

  if (!state || !descriptors || !navigation) {
    return null;
  }

  return (
    <LinearGradient
      colors={[COLORS.background + '00', COLORS.background]}
      style={styles.container}
    >
      <View style={styles.tabContainer}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            // Start spin animation
            const animatedValue = animatedValues[index];

            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }).start(() => {
              // Reset animation value after completion
              animatedValue.setValue(0);
            });

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.tab}
            >
              <View style={styles.tabContent}>
                <View style={styles.iconContainer}>
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: animatedValues[index]?.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }) || '0deg',
                        },
                      ],
                    }}
                  >
                    {options.tabBarIcon &&
                      options.tabBarIcon({
                        focused: isFocused,
                        color: isFocused ? COLORS.solana : COLORS.textSecondary,
                        size: 24,
                      })}
                  </Animated.View>
                  {/* Show notification badge on Home tab (index 0) */}
                  {index === 0 && badgeCount > 0 && (
                    <NotificationTabBadge count={badgeCount} />
                  )}
                </View>
                <Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? COLORS.solana : COLORS.textSecondary,
                    },
                  ]}
                >
                  {label as string}
                </Text>
                {isFocused && <View style={styles.indicator} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.solana + '30',
    paddingBottom: SPACING.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.s,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...FONTS.sfProRegular,
    fontSize: 10,
    marginTop: SPACING.xs,
  },
  indicator: {
    position: 'absolute',
    bottom: -SPACING.s - 2,
    width: 4,
    height: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.solana,
  },
});