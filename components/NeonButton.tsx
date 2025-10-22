import React from 'react';
import { 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  TouchableOpacityProps,
  ActivityIndicator,
  View 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';

interface NeonButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  icon,
  loading = false,
  fullWidth = false,
  style,
  ...props
}) => {
  const getGradientColors = () => {
    switch (variant) {
      case 'primary':
        return COLORS.gradientPurple;
      case 'secondary':
        return COLORS.gradientBlue;
      case 'danger':
        return COLORS.gradientPink;
      case 'outline':
        return [COLORS.background, COLORS.background];
      default:
        return COLORS.gradientPurple;
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.m };
      case 'medium':
        return { paddingVertical: SPACING.s, paddingHorizontal: SPACING.l };
      case 'large':
        return { paddingVertical: SPACING.m, paddingHorizontal: SPACING.xl };
      default:
        return { paddingVertical: SPACING.s, paddingHorizontal: SPACING.l };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'medium':
        return 14;
      case 'large':
        return 16;
      default:
        return 14;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={loading}
      style={[
        styles.button,
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...props}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          getButtonSize(),
          variant === 'outline' && styles.outline,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.textPrimary} />
        ) : (
          <View style={styles.contentContainer}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
              style={[
                styles.text,
                { fontSize: getFontSize() },
                variant === 'outline' && styles.outlineText,
              ]}
            >
              {title.toUpperCase()}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 1,
    borderColor: COLORS.solana,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: SPACING.xs,
  },
  text: {
    color: COLORS.textPrimary,
    ...FONTS.orbitronBold,
    textAlign: 'center',
  },
  outlineText: {
    color: COLORS.solana,
  },
});