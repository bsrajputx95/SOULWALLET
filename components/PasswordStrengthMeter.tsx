import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface Props {
  password: string;
}

interface StrengthResult {
  score: number;
  label: string;
  color: string;
}

/**
 * Password Strength Meter Component
 * Provides visual feedback on password strength during signup
 * 
 * Scoring:
 * - Length >= 8: +1
 * - Length >= 12: +1
 * - Has lowercase: +1
 * - Has uppercase: +1
 * - Has number: +1
 * - Has special char: +1
 * 
 * Labels:
 * - 0-2: Weak (red)
 * - 3-4: Fair (yellow)
 * - 5: Good (green)
 * - 6: Strong (green)
 * 
 * Memoized to prevent parent re-renders during typing
 */
const PasswordStrengthMeterComponent = ({ password }: Props) => {
  // Memoize strength calculation to prevent recalculating on every parent render
  const strength = useMemo((): StrengthResult => {
    let score = 0;

    // Length checks
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character type checks
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;

    // Determine label and color based on score
    if (score <= 2) return { score, label: 'Weak', color: COLORS.error };
    if (score <= 4) return { score, label: 'Fair', color: COLORS.warning };
    if (score <= 5) return { score, label: 'Good', color: COLORS.success };
    return { score, label: 'Strong', color: COLORS.success };
  }, [password]);

  const percentage = (strength.score / 6) * 100;

  // Don't render if no password entered
  if (!password) return null;

  return (
    <View style={styles.container}>
      <View style={styles.barContainer}>
        <View
          style={[
            styles.bar,
            {
              width: `${percentage}%`,
              backgroundColor: strength.color
            }
          ]}
        />
      </View>
      <Text style={[styles.label, { color: strength.color }]}>
        {strength.label}
      </Text>
    </View>
  );
};

// Memoize component to prevent re-renders when props haven't changed
export const PasswordStrengthMeter = React.memo(PasswordStrengthMeterComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
  },
  barContainer: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default PasswordStrengthMeter;
