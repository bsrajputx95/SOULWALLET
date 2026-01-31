import React from 'react';
import type { ViewProps } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS } from '../constants/colors';
import { BORDER_RADIUS, SPACING } from '../constants/theme';

interface NeonCardProps extends ViewProps {
  color?: readonly [string, string, ...string[]];
  intensity?: 'low' | 'medium' | 'high';
  borderWidth?: number;
}

export const NeonCard: React.FC<NeonCardProps> = ({
  children,
  color = COLORS.gradientPurple,
  intensity = 'medium',
  borderWidth = 1,
  style,
  ...props
}) => {
  const _intensityValues = {
    low: 0.3,
    medium: 0.5,
    high: 0.8,
  };

  const shadowIntensity = {
    low: SHADOWS.small,
    medium: SHADOWS.medium,
    high: SHADOWS.large,
  };

  return (
    <View
      style={[
        styles.container,
        shadowIntensity[intensity],
        style,
      ]}
      {...props}
    >
      <LinearGradient
        colors={color}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.border, { borderWidth }]}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS.medium,
    borderColor: COLORS.glowPurple,
  },
  content: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    margin: 1,
    padding: SPACING.m,
  },
});