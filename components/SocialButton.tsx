import React from 'react';
import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';

interface SocialButtonProps extends TouchableOpacityProps {
  title: string;
  icon: React.ReactNode;
}

export const SocialButton: React.FC<SocialButtonProps> = ({
  title,
  icon,
  style,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      activeOpacity={0.8}
      {...props}
    >
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '30',
  },
  iconContainer: {
    marginRight: SPACING.s,
  },
  text: {
    ...FONTS.sfProMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
});