import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowLeft, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { COLORS } from '../../constants/colors';
import { FONTS, SPACING } from '../../constants/theme';
import { NeonInput } from '../../components/NeonInput';
import { NeonButton } from '../../components/NeonButton';
import { GlowingText } from '../../components/GlowingText';

// Local logo asset
const logoImage = require('../../assets/images/icon-rounded.png');

type Step = 'email' | 'otp' | 'password';

// Rate limit cooldown in seconds
const RATE_LIMIT_COOLDOWN = 60;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const otpInputRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  // Auto-focus OTP input when step changes to 'otp'
  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  // Rate limit cooldown timer
  useEffect(() => {
    if (rateLimitCooldown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCooldown(rateLimitCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [rateLimitCooldown]);

  // Check if rate limited
  const isRateLimited = rateLimitCooldown > 0;

  const handleRequestReset = async () => {
    try {
      // Check rate limit
      if (isRateLimited) {
        setError(`Please wait ${rateLimitCooldown} seconds before requesting another code`);
        return;
      }

      setIsLoading(true);
      setError(null);
      setMessage(null);

      // Email validation
      if (!email.trim()) {
        setError('Email is required');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }

      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Mock password reset request - simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Set rate limit cooldown
      setRateLimitCooldown(RATE_LIMIT_COOLDOWN);

      setMessage('If an account with this email exists, you will receive a verification code');
      setStep('otp');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset code';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // OTP validation
      if (!otp.trim()) {
        setError('Verification code is required');
        return;
      }

      if (otp.trim().length !== 6) {
        setError('Verification code must be 6 digits');
        return;
      }

      if (!/^\d{6}$/.test(otp.trim())) {
        setError('Verification code must contain only numbers');
        return;
      }

      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Mock OTP verification - accept any 6-digit code
      await new Promise(resolve => setTimeout(resolve, 800));

      setMessage('Code verified! Enter your new password');
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Password validation
      if (!newPassword.trim()) {
        setError('New password is required');
        return;
      }

      if (!confirmPassword.trim()) {
        setError('Please confirm your password');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }

      // Enhanced password validation
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumbers = /\d/.test(newPassword);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

      if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        setError('Password must contain uppercase, lowercase, number, and special character');
        return;
      }

      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Mock password reset - simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));

      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'email':
        return 'FORGOT PASSWORD';
      case 'otp':
        return 'VERIFY CODE';
      case 'password':
        return 'NEW PASSWORD';
      default:
        return 'FORGOT PASSWORD';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'email':
        return 'Enter your email to receive a reset code';
      case 'otp':
        return 'Enter the 6-digit code sent to your email';
      case 'password':
        return 'Create a new secure password';
      default:
        return '';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (Platform.OS !== 'web') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              if (step === 'email') {
                router.back();
              } else if (step === 'otp') {
                setStep('email');
                setError(null);
                setMessage(null);
              } else {
                setStep('otp');
                setError(null);
                setMessage(null);
              }
            }}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.logoContainer}>
          <Image
            source={logoImage}
            style={styles.logoImage}
            accessibilityLabel="Soul Wallet Logo"
          />
        </View>

        <View style={styles.formContainer}>
          <GlowingText
            text={getStepTitle()}
            fontSize={24}
            style={styles.title}
          />
          <Text style={styles.subtitle}>{getStepSubtitle()}</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}
          {message && <Text style={styles.messageText}>{message}</Text>}

          {step === 'email' && (
            <>
              <NeonInput
                label="Email"
                placeholder="Enter your email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon={<Mail size={20} color={COLORS.textSecondary} />}
              />
              <NeonButton
                title="Send Reset Code"
                icon={<Mail size={20} color={COLORS.textPrimary} />}
                onPress={handleRequestReset}
                loading={isLoading}
                fullWidth
              />
            </>
          )}

          {step === 'otp' && (
            <>
              <NeonInput
                label="Verification Code"
                placeholder="Enter 6-digit code"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                leftIcon={<Shield size={20} color={COLORS.textSecondary} />}
                accessibilityLabel="Verification code input"
                accessibilityHint="Enter the 6-digit code sent to your email"
              />
              <NeonButton
                title="Verify Code"
                icon={<Shield size={20} color={COLORS.textPrimary} />}
                onPress={handleVerifyOtp}
                loading={isLoading}
                fullWidth
              />
              <TouchableOpacity
                style={[styles.resendContainer, isRateLimited && styles.resendDisabled]}
                onPress={handleRequestReset}
                disabled={isLoading || isRateLimited}
              >
                <Text style={[styles.resendText, isRateLimited && styles.resendTextDisabled]}>
                  {isRateLimited
                    ? `Resend code in ${rateLimitCooldown}s`
                    : "Didn't receive the code? Resend"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'password' && (
            <>
              <NeonInput
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
                leftIcon={<Lock size={20} color={COLORS.textSecondary} />}
              />
              <NeonInput
                label="Confirm Password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                leftIcon={<Lock size={20} color={COLORS.textSecondary} />}
              />
              <NeonButton
                title="Reset Password"
                icon={<Lock size={20} color={COLORS.textPrimary} />}
                onPress={handleResetPassword}
                loading={isLoading}
                fullWidth
              />
            </>
          )}

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Remember your password?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.login}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.md
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: SPACING.xl
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md
  },
  title: {
    textAlign: 'center',
    marginBottom: SPACING.sm
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    fontFamily: FONTS.regular
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontFamily: FONTS.regular
  },
  messageText: {
    color: COLORS.success,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontFamily: FONTS.regular
  },
  resendContainer: {
    marginTop: SPACING.md,
    alignItems: 'center'
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 14,
    fontFamily: FONTS.medium
  },
  resendDisabled: {
    opacity: 0.5
  },
  resendTextDisabled: {
    color: COLORS.textSecondary
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
    gap: SPACING.xs
  },
  loginText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular
  },
  login: {
    color: COLORS.primary,
    fontSize: 14,
    fontFamily: FONTS.semiBold
  }
});
