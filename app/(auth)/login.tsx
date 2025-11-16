import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image } from 'react-native';
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

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    const success = await login(email, password, rememberMe);
    if (success) {
      router.replace('/(tabs)');
    } else {
      // Clear password on login error for security
      setPassword('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Image 
            source={{ uri: 'https://r2-pub.rork.com/attachments/q78x34dzrm35cfaz7pqli' }} 
            style={styles.logoImage}
          />
        </View>

        <View style={styles.formContainer}>
          <GlowingText 
            text="WELCOME BACK" 
            fontSize={24} 
            style={styles.title}
          />
          <Text style={styles.subtitle}>Log in to continue</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

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
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<Mail size={20} color={COLORS.textSecondary} />}
          />

          <NeonInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon={<Lock size={20} color={COLORS.textSecondary} />}
          />

          <View style={styles.rememberContainer}>
            <TouchableOpacity
              style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
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
            icon={<LogIn size={20} color={COLORS.textPrimary} />}
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
            />
            <SocialButton
              title="Apple"
              icon={<Text style={styles.socialIcon}>A</Text>}
              style={styles.socialButton}
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
    backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20 },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20 },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24 },
  formContainer: {
    paddingHorizontal: 24 },
  title: {
    textAlign: 'center',
    marginBottom: 8 },
  subtitle: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32 },
  errorText: {
    ...FONTS.sfProMedium,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 16 },
  rememberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24 },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center' },
  checkboxChecked: {
    backgroundColor: COLORS.solana,
    borderColor: COLORS.solana },
  checkmark: {
    color: COLORS.textPrimary,
    fontSize: 12 },
  rememberMeText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14 },
  forgotPasswordText: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 14 },
  loginButton: {
    marginBottom: 24 },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16 },
  socialButton: {
    flex: 1,
    marginHorizontal: 8 },
  socialIcon: {
    ...FONTS.sfProBold,
    fontSize: 16,
    color: COLORS.textPrimary },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16 },
  signupText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginRight: 4 },
  signupLink: {
    ...FONTS.sfProMedium,
    color: COLORS.solana,
    fontSize: 14 },
  devHintContainer: {
    backgroundColor: COLORS.warning + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.warning + '30' },
  devHintTitle: {
    ...FONTS.sfProMedium,
    color: COLORS.warning,
    fontSize: 12,
    marginBottom: 4 },
  devHintText: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 11 },
  bottomGlow: {
    height: 4,
    width: '100%',
    position: 'absolute',
    bottom: 0 } });