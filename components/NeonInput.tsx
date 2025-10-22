import React, { useState } from 'react';
import { 
  StyleSheet, 
  TextInput, 
  View, 
  Text, 
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';

interface NeonInputProps extends TextInputProps {
  label: string;
  error?: string;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
}

export const NeonInput: React.FC<NeonInputProps> = ({
  label,
  error,
  leftIcon,
  isPassword = false,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focusedInput,
          error && styles.errorInput,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithIcon,
            isPassword && styles.inputWithPassword,
            style,
          ]}
          placeholderTextColor={COLORS.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff size={20} color={COLORS.textSecondary} />
            ) : (
              <Eye size={20} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.m,
    width: '100%',
  },
  label: {
    ...FONTS.sfProMedium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '50',
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.cardBackground,
  },
  focusedInput: {
    borderColor: COLORS.usdc,
    shadowColor: COLORS.usdc,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  errorInput: {
    borderColor: COLORS.error,
  },
  input: {
    ...FONTS.sfProRegular,
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputWithPassword: {
    paddingRight: 0,
  },
  leftIcon: {
    paddingLeft: SPACING.m,
  },
  passwordToggle: {
    paddingRight: SPACING.m,
  },
  errorText: {
    ...FONTS.sfProRegular,
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
});