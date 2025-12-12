import React, { useState, useMemo, useCallback } from 'react';
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
import { Mail, Lock, LogIn } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/theme';
import { NeonInput } from '../../components/NeonInput';
import { NeonButton } from '../../components/NeonButton';
import { NeonDivider } from '../../components/NeonDivider';
import { SocialButton } from '../../components/SocialButton';
import { GlowingText } from '../../components/GlowingText';
import { useAuth } from '../../hooks/auth-store';

// Local logo asset
const logoImage = require('../../assets/images/icon-rounded.png');

// Memoized icons to prevent re-renders
const EmailIcon = <Mail size={20} color={COLORS.textSecondary} />;
const LockIcon = <Lock size={20} color={COLORS.textSecondary} />;
const LoginIcon = <LogIn size={20} color={COLORS.textPrimary} />;

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Memoized callbacks to prevent re-renders
  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    setValidationError(null);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setValidationError(null);
  }, []);

  const toggleRememberMe = useCallback(() => {
    setRememberMe(prev => !prev);
  }, []);

  // Validate form before submission
  const validateForm = useCallback((): boolean => {
    if (!email.trim()) {
      setValidationError('Email or username is required');
      return false;
    }

    if (!password) {
      setValidationError('Password is required');
      return false;
    }

    // Basic email validation if it looks like an email
    if (email.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setValidationError('Please enter a valid email address');
        return false;
      }
    }

    return true;
  }, [email, password]);

  // Handle social button press - show "Coming Soon"
  const handleSocialPress = useCallback((provider: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      'Coming Soon',
      `${provider} login will be available in a future update.`,
      [{ text: 'OK' }]
    );
  }, []);

  const handleLogin = useCallback(async () => {
    // Validate form first
    if (!validateForm()) {
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const success = await login(email.trim(), password, rememberMe);
      if (success) {
        router.replace('/(tabs)');
      } else {
        // Clear password on login error for security
        setPassword('');
      }
    } catch (err) {
      // Handle network errors with user-friendly message
      const errorMessage = err instanceof Error ? err.message.toLowerCase() : '';
      if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
        setValidationError('No internet connection. Please check your network and try again.');
      } else {
        setValidationError('Login failed. Please try again.');
      }
      setPassword('');
    }
  }, [email, password, rememberMe, validateForm, login, router]);

  // Memoize error display to prevent unnecessary re-renders
  const errorMessage = error || validationError;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            text="WELCOME BACK"
            fontSize={24}
            style={styles.title}
          />
          <Text style={styles.subtitle}>Log in to continue</Text>

          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          {__DEV__ && (
            <View style={styles.devHintContainer}>
              <Text style={styles.devHintTitle}>🧪 Dev Test Account</Text>
              <Text style={styles.devHintText}>test@soulwallet.dev / Test123!@#</Text>
            </View>
          )}

          <NeonInput
            label="Username/Email"
            placeholder="Enter your username or email"
            value={email}
            onChangeText={handleEmailChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            leftIcon={EmailIcon}
            blurOnSubmit={false}
            accessibilityLabel="Email or username input"
            accessibilityHint="Enter your email address or username"
          />

          <NeonInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={handlePasswordChange}
            isPassword
            leftIcon={LockIcon}
            blurOnSubmit={false}
            accessibilityLabel="Password input"
            accessibilityHint="Enter your password"
          />

          <View style={styles.rememberContainer}>
            <TouchableOpacity
              style={styles.rememberMeContainer}
              onPress={toggleRememberMe}
            >
              <View style={[
                styles.checkbox,
                rememberMe && styles.checkboxChecked,
              ]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberMeText}>Remember Me</Text>
            </TouchableOpacity>

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <NeonButton
            title="Login"
            icon={LoginIcon}
            onPress={handleLogin}
            loading={isLoading}
            fullWidth
            style={styles.loginButton}
          />

          <NeonDivider text="OR CONTINUE WITH" />

          <View style={styles.socialButtonsContainer}>
            <SocialButton
              title="Google"
              icon={<Text style={styles.socialIcon}>G</Text>}
              style={styles.socialButton}
              onPress={() => handleSocialPress('Google')}
              accessibilityLabel="Sign in with Google"
              accessibilityHint="Google login coming soon"
            />
            <SocialButton
              title="Apple"
              icon={<Text style={styles.socialIcon}>A</Text>}
              style={styles.socialButton}
              onPress={() => handleSocialPress('Apple')}
              accessibilityLabel="Sign in with Apple"
              accessibilityHint="Apple login coming soon"
            />
          </View>


          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account?</Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.signupLink}>Create Account</Text>
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
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  formContainer: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 14,
  },
  errorText: {
    ...FONTS.sfProMedium,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    padding: 12,
    backgroundColor: COLORS.error + '20',
    borderRadius: 8,
  },
  devHintContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.solana + '50',
  },
  devHintTitle: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 12,
    marginBottom: 4,
  },
  devHintText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  rememberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.solana,
    borderColor: COLORS.solana,
  },
  checkmark: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberMeText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  forgotPasswordText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 14,
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
  },
  socialIcon: {
    ...FONTS.sfProBold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  signupText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  signupLink: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 14,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    opacity: 0.1,
  },
});