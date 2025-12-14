import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Mail, Lock, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/theme';
import { NeonInput } from '../../components/NeonInput';
import { NeonButton } from '../../components/NeonButton';
import { NeonDivider } from '../../components/NeonDivider';
import { SocialButton } from '../../components/SocialButton';
import { GlowingText } from '../../components/GlowingText';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';
import { isPasswordBreached } from '../../lib/password-check';
import { useAuth } from '../../hooks/auth-store';

// Local logo asset
const logoImage = require('../../assets/images/icon-rounded.png');

// Memoized icons to prevent re-renders - defined outside component
const UserIcon = <User size={20} color={COLORS.textSecondary} />;
const EmailIcon = <Mail size={20} color={COLORS.textSecondary} />;
const LockIcon = <Lock size={20} color={COLORS.textSecondary} />;
const SignupIcon = <UserPlus size={20} color={COLORS.textPrimary} />;

export default function SignupScreen() {
  const router = useRouter();
  const { signup, isLoading, error } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Memoized callbacks to prevent re-renders
  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
    setValidationError(null);
  }, []);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    setValidationError(null);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setValidationError(null);
  }, []);

  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPassword(text);
    setValidationError(null);
  }, []);

  const validateForm = useCallback(() => {
    if (!username || !email || !password || !confirmPassword) {
      setValidationError('All fields are required');
      return false;
    }

    // Username validation: 3-30 chars, alphanumeric and underscores only (matches backend)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username.trim())) {
      setValidationError('Username must be 3-30 characters (letters, numbers, underscores only)');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError('Please enter a valid email address');
      return false;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return false;
    }

    // Fixed password complexity check - added end anchor ($) to ensure full string match
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setValidationError('Password must contain uppercase, lowercase, number, and special character');
      return false;
    }

    setValidationError(null);
    return true;
  }, [username, email, password, confirmPassword]);

  // Handle social button press - show "Coming Soon"
  const handleSocialPress = useCallback((provider: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      'Coming Soon',
      `${provider} signup will be available in a future update.`,
      [{ text: 'OK' }]
    );
  }, []);

  // Helper to handle network errors
  const handleNetworkError = useCallback((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message.toLowerCase() : '';
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      setValidationError('No internet connection. Please check your network and try again.');
    } else {
      setValidationError('Signup failed. Please try again.');
    }
  }, []);

  const handleSignup = useCallback(async () => {
    if (!validateForm()) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Check if password has been breached (non-blocking)
    try {
      const breached = await isPasswordBreached(password);
      if (breached) {
        Alert.alert(
          'Password Warning',
          'This password has been found in a data breach. We strongly recommend choosing a different password for your security.',
          [
            { text: 'Change Password', style: 'cancel' },
            {
              text: 'Use Anyway',
              style: 'destructive',
              onPress: async () => {
                try {
                  const success = await signup(username.trim(), email.trim(), password, confirmPassword);
                  if (success) {
                    router.replace('/(tabs)');
                  }
                } catch (err) {
                  handleNetworkError(err);
                }
              }
            },
          ]
        );
        return;
      }
    } catch (e) {
      // Don't block signup if breach check fails
      console.warn('Breach check failed, continuing with signup');
    }

    try {
      const success = await signup(username.trim(), email.trim(), password, confirmPassword);
      if (success) {
        router.replace('/(tabs)');
      }
    } catch (err) {
      handleNetworkError(err);
    }
  }, [username, email, password, confirmPassword, validateForm, signup, router, handleNetworkError]);

  // Memoize error display
  const errorMessage = error || validationError;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        <View style={styles.logoContainer}>
          <Image
            source={logoImage}
            style={styles.logoImage}
            accessibilityLabel="Soul Wallet Logo"
          />
        </View>

        <View style={styles.formContainer}>
          <GlowingText
            text="CREATE YOUR ACCOUNT"
            fontSize={24}
            style={styles.title}
          />
          <Text style={styles.subtitle}>Join the trading revolution</Text>

          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          <NeonInput
            label="Username"
            placeholder="Choose a username"
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={UserIcon}
            blurOnSubmit={false}
            accessibilityLabel="Username input"
            accessibilityHint="Choose a username with 3-20 characters"
          />

          <NeonInput
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={handleEmailChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            leftIcon={EmailIcon}
            blurOnSubmit={false}
            accessibilityLabel="Email input"
            accessibilityHint="Enter your email address"
          />

          <NeonInput
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={handlePasswordChange}
            isPassword
            leftIcon={LockIcon}
            blurOnSubmit={false}
            accessibilityLabel="Password input"
            accessibilityHint="Create a secure password"
          />

          <PasswordStrengthMeter password={password} />

          <Text style={styles.passwordHint}>
            • At least 8 characters{'\n'}
            • Uppercase & lowercase letters{'\n'}
            • At least one number{'\n'}
            • At least one special character (@$!%*?&)
          </Text>

          <NeonInput
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            isPassword
            leftIcon={LockIcon}
            blurOnSubmit={false}
            accessibilityLabel="Confirm password input"
            accessibilityHint="Re-enter your password to confirm"
          />

          <NeonButton
            title="Sign Up"
            icon={SignupIcon}
            onPress={handleSignup}
            loading={isLoading}
            fullWidth
            style={styles.signupButton}
          />

          <NeonDivider text="OR CONTINUE WITH" />

          <View style={styles.socialButtonsContainer}>
            <SocialButton
              title="Google"
              icon={<Text style={styles.socialIcon}>G</Text>}
              style={styles.socialButton}
              onPress={() => handleSocialPress('Google')}
              accessibilityLabel="Sign up with Google"
              accessibilityHint="Google signup coming soon"
            />
            <SocialButton
              title="Apple"
              icon={<Text style={styles.socialIcon}>A</Text>}
              style={styles.socialButton}
              onPress={() => handleSocialPress('Apple')}
              accessibilityLabel="Sign up with Apple"
              accessibilityHint="Apple signup coming soon"
            />
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        <LinearGradient
          colors={[COLORS.solana + '00', COLORS.solana]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomGlow}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 30
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    resizeMode: 'contain'
  },
  formContainer: {
    flex: 1
  },
  title: {
    textAlign: 'center',
    marginBottom: 8
  },
  subtitle: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24
  },
  errorText: {
    ...FONTS.sfProMedium,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    padding: 12,
    backgroundColor: COLORS.error + '20',
    borderRadius: 8
  },
  passwordHint: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 18
  },
  signupButton: {
    marginTop: 8,
    marginBottom: 24
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24
  },
  socialButton: {
    flex: 1
  },
  socialIcon: {
    ...FONTS.sfProBold,
    fontSize: 18,
    color: COLORS.textPrimary
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  loginText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14
  },
  loginLink: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 14
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    opacity: 0.1
  }
});
