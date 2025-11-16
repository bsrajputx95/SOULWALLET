import React from 'react';
import type { TouchableOpacityProps} from 'react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';

interface QuickActionButtonProps extends TouchableOpacityProps {
  title: string;
  icon: React.ReactNode;
  color?: readonly string[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  title,
  icon,
  color = COLORS.gradientPurple,
  style,
  accessibilityLabel,
  accessibilityHint,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint || `Double tap to ${title.toLowerCase()}`}
      {...props}
    >
      <LinearGradient
        colors={color as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <Text style={styles.title}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.medium,
  },

  iconContainer: {
    marginBottom: SPACING.xs,
  },
  title: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 12,
  },
});