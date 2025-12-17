import React, { useState, memo, useCallback, useRef } from 'react';
import type {
  TextInputProps,
  TextStyle,
  TextInput as RNTextInput
} from 'react-native';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  Platform
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { BORDER_RADIUS, FONTS, SPACING } from '../constants/theme';

interface NeonInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
  style?: TextStyle;
}

// Memoized to prevent re-renders when parent state changes
export const NeonInput: React.FC<NeonInputProps> = memo(({
  label,
  error,
  leftIcon,
  isPassword = false,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<RNTextInput>(null);

  // Stable callbacks to prevent re-render loops
  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  const togglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
    // Re-focus input after toggling password visibility on Android
    if (Platform.OS === 'android') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, []);

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
          ref={inputRef}
          style={[
            styles.input,
            leftIcon ? styles.inputWithIcon : undefined,
            isPassword ? styles.inputWithPassword : undefined,
            style,
          ]}
          placeholderTextColor={COLORS.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !showPassword}
          // Android-specific fixes for keyboard flickering
          autoCorrect={false}
          spellCheck={false}
          textContentType="none"
          importantForAutofill="no"
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={togglePassword}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
});

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