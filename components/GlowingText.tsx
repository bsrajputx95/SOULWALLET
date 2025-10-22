import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/theme';

interface GlowingTextProps extends TextProps {
  text: string;
  color?: string;
  fontSize?: number;
  fontFamily?: 'orbitron' | 'system' | 'monospace';
  intensity?: 'low' | 'medium' | 'high';
}

export const GlowingText: React.FC<GlowingTextProps> = ({
  text,
  color = COLORS.solana,
  fontSize = 24,
  fontFamily = 'orbitron',
  intensity = 'medium',
  style,
  ...props
}) => {
  const getFontFamily = () => {
    switch (fontFamily) {
      case 'orbitron':
        return FONTS.orbitronBold;
      case 'system':
        return FONTS.sfProBold;
      case 'monospace':
        return FONTS.monospace;
      default:
        return FONTS.orbitronBold;
    }
  };

  const getTextShadow = () => {
    const shadowOpacity = {
      low: 0.5,
      medium: 0.7,
      high: 0.9,
    };

    const shadowRadius = {
      low: 2,
      medium: 4,
      high: 8,
    };

    return {
      textShadowColor: color,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: shadowRadius[intensity],
    };
  };

  return (
    <Text
      style={[
        styles.text,
        getFontFamily(),
        getTextShadow(),
        { color, fontSize },
        style,
      ]}
      {...props}
    >
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    letterSpacing: 0.5,
  },
});