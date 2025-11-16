import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import theme from '../constants/theme';

const { COLORS, SPACING } = theme;

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  style?: any;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'large', 
  style 
}) => {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator 
        size={size} 
        color={COLORS.solana} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
});