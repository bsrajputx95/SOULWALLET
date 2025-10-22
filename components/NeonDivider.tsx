import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING } from '../constants/theme';

interface NeonDividerProps {
  text?: string;
}

export const NeonDivider: React.FC<NeonDividerProps> = ({ text }) => {
  if (!text) {
    return <View style={styles.divider} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: COLORS.textSecondary + '30',
    marginVertical: SPACING.m,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.m,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.textSecondary + '30',
  },
  text: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.m,
    fontSize: 12,
  },
});