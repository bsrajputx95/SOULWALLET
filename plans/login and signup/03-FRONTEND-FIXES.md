# Frontend Fixes - Login & Signup Screens

## Overview

This document covers all frontend fixes needed for the login and signup functionality.

---

## 1. Login Screen Fixes (`app/(auth)/login.tsx`)

### Issue 1.1: Social Buttons Have No Functionality

**Current Code** (Lines 113-124):
```typescript
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
```

**Problem**: Buttons render but do nothing when pressed.

**Solution**: Either implement OAuth or hide the buttons for now.

```typescript
// Option A: Hide social buttons until implemented
{/* Social login - Coming Soon
<NeonDivider text="OR CONTINUE WITH" />
<View style={styles.socialButtonsContainer}>
  ...
</View>
*/}

// Option B: Show "Coming Soon" message
<SocialButton
  title="Google"
  icon={<Text style={styles.socialIcon}>G</Text>}
  style={styles.socialButton}
  onPress={() => Alert.alert('Coming Soon', 'Google sign-in will be available in a future update.')}
/>
```

### Issue 1.2: No Input Validation Before Submit

**Current Code**:
```typescript
const handleLogin = async () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
  
  const success = await login(email, password, rememberMe);
  // ...
};
```

**Problem**: No validation before API call, wastes network request.

**Solution**:
```typescript
const handleLogin = async () => {
  // Validate inputs before API call
  if (!email.trim()) {
    setLocalError('Email is required');
    return;
  }
  
  if (!password) {
    setLocalError('Password is required');
    return;
  }
  
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailRegex.test(email.trim());
  const isUsername = /^[a-zA-Z0-9_]{3,30}$/.test(email.trim());
  
  if (!isEmail && !isUsername) {
    setLocalError('Please enter a valid email or username');
    return;
  }
  
  setLocalError(null);
  
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
  
  const success = await login(email.trim(), password, rememberMe);
  if (success) {
    router.replace('/(tabs)');
  } else {
    setPassword('');
  }
};
```

### Issue 1.3: Hardcoded Logo URL

**Current Code**:
```typescript
<Image 
  source={{ uri: 'https://r2-pub.rork.com/attachments/q78x34dzrm35cfaz7pqli' }} 
  style={styles.logoImage}
/>
```

**Problem**: External URL dependency, slow loading, potential failure.

**Solution**:
```typescript
// Import local asset
import LogoImage from '../../assets/images/icon.png';

// Use local image
<Image 
  source={LogoImage} 
  style={styles.logoImage}
  resizeMode="contain"
/>
```

### Issue 1.4: Missing Accessibility Labels

**Solution**: Add accessibility props to all interactive elements:
```typescript
<NeonInput
  label="Username/Email"
  placeholder="Enter your username or email"
  value={email}
  onChangeText={setEmail}
  autoCapitalize="none"
  keyboardType="email-address"
  leftIcon={<Mail size={20} color={COLORS.textSecondary} />}
  accessibilityLabel="Email or username input"
  accessibilityHint="Enter your email address or username to log in"
/>

<NeonButton
  title="Login"
  icon={<LogIn size={20} color={COLORS.textPrimary} />}
  onPress={handleLogin}
  loading={isLoading}
  fullWidth
  style={styles.loginButton}
  accessibilityLabel="Login button"
  accessibilityHint="Tap to log in to your account"
/>
```

### Issue 1.5: Dev Hint Should Not Show in Production

**Current Code**:
```typescript
{__DEV__ && (
  <View style={styles.devHintContainer}>
    <Text style={styles.devHintTitle}>🧪 Dev Test Account</Text>
    <Text style={styles.devHintText}>test@soulwallet.dev / Test123!@#</Text>
  </View>
)}
```

**Status**: ✅ Already correct - only shows in development.

---

## 2. Signup Screen Fixes (`app/(auth)/signup.tsx`)

### Issue 2.1: Password Regex Mismatch with Backend

**Current Frontend Code**:
```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
```

**Backend Code** (`src/lib/validations/auth.ts`):
```typescript
.regex(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  ...
)
```

**Problem**: Both regexes are missing the end anchor `$`, allowing trailing invalid characters.

**Solution**:
```typescript
// Correct regex with proper anchoring
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
```

### Issue 2.2: Social Buttons (Same as Login)

Apply the same fix as login screen.

### Issue 2.3: Missing Username Validation

**Current Code**:
```typescript
if (!username || !email || !password || !confirmPassword) {
  setValidationError('All fields are required');
  return false;
}
```

**Problem**: No format validation for username.

**Solution**:
```typescript
const validateForm = () => {
  // Check required fields
  if (!username.trim() || !email.trim() || !password || !confirmPassword) {
    setValidationError('All fields are required');
    return false;
  }
  
  // Validate username format (must match backend)
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (username.trim().length < 3) {
    setValidationError('Username must be at least 3 characters');
    return false;
  }
  if (username.trim().length > 30) {
    setValidationError('Username must be less than 30 characters');
    return false;
  }
  if (!usernameRegex.test(username.trim())) {
    setValidationError('Username can only contain letters, numbers, and underscores');
    return false;
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    setValidationError('Please enter a valid email address');
    return false;
  }
  
  // Validate password match
  if (password !== confirmPassword) {
    setValidationError('Passwords do not match');
    return false;
  }
  
  // Validate password length
  if (password.length < 8) {
    setValidationError('Password must be at least 8 characters');
    return false;
  }

  // Validate password complexity
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
  if (!passwordRegex.test(password)) {
    setValidationError('Password must contain uppercase, lowercase, number, and special character');
    return false;
  }
  
  setValidationError(null);
  return true;
};
```

### Issue 2.4: Hardcoded Logo URL

Same fix as login screen.

---

## 3. Forgot Password Screen Fixes (`app/(auth)/forgot-password.tsx`)

### Issue 3.1: Direct tRPC Client Usage

**Current Code**:
```typescript
import { trpcClient } from '../../lib/trpc';

// Direct mutation call
await trpcClient.auth.requestPasswordReset.mutate({ email: email.trim() });
```

**Problem**: Bypasses React Query caching and error handling.

**Better Approach** (but current approach works):
The current approach is acceptable for one-off mutations. No change needed.

### Issue 3.2: OTP Input Should Auto-Focus

**Solution**:
```typescript
const otpInputRef = useRef<TextInput>(null);

// When moving to OTP step
setStep('otp');
setTimeout(() => otpInputRef.current?.focus(), 100);

// In render
<NeonInput
  ref={otpInputRef}
  label="Verification Code"
  ...
/>
```

### Issue 3.3: Missing Rate Limit Feedback

**Problem**: User doesn't know if they're rate limited.

**Solution**: Handle rate limit errors specifically:
```typescript
} catch (err) {
  if (err instanceof Error) {
    if (err.message.includes('Too many requests') || err.message.includes('rate limit')) {
      setError('Too many attempts. Please wait a few minutes before trying again.');
    } else {
      setError(err.message);
    }
  } else {
    setError('Failed to send reset code');
  }
}
```

---

## 4. Auth Store Fixes (`hooks/auth-store.ts`)

### Issue 4.1: Remember Me Not Implemented

**Current Code**:
```typescript
await SecureStorage.setRememberMe(rememberMe);
```

**Problem**: Value is stored but never used.

**Solution**: Use it to control session behavior:
```typescript
const loadUser = async () => {
  try {
    setIsLoading(true);
    
    const rememberMe = await SecureStorage.getRememberMe();
    const token = await SecureStorage.getToken();
    const storedUser = await SecureStorage.getUserData();
    
    if (token && storedUser) {
      // If remember me is false, check if session is still valid
      if (!rememberMe) {
        // Could add session expiry check here
        // For now, just restore the session
      }
      
      setUser(storedUser);
      setSentryUser({ id: storedUser.id, username: storedUser.username, email: storedUser.email });
      addBreadcrumb('Session restored', { userId: storedUser.id });
    } else {
      await SecureStorage.clearAll();
      clearSentryUser();
    }
  } catch (err) {
    // ...
  }
};
```

### Issue 4.2: No Token Refresh on App Resume

**Problem**: Token might expire while app is backgrounded.

**Solution**: Add token refresh logic:
```typescript
import { AppState, AppStateStatus } from 'react-native';

// In the auth store
useEffect(() => {
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}, []);

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active' && user) {
    // Check if token needs refresh
    try {
      const token = await SecureStorage.getToken();
      if (token) {
        // Token refresh is handled automatically by tRPC client
        // But we can trigger a user data refresh here
        const result = await trpcClient.auth.getCurrentUser.query();
        if (result.user) {
          setUser(prev => prev ? { ...prev, ...result.user } : null);
        }
      }
    } catch (err) {
      // Token invalid, log out
      await logout();
    }
  }
};
```

### Issue 4.3: Missing Loading State Export

**Problem**: Components can't show loading during initial auth check.

**Solution**: Already exported `isLoading`, but ensure it's used:
```typescript
// In login.tsx, show loading if auth is initializing
const { login, isLoading: authLoading, error } = useAuth();

// Combine with local loading state
const isSubmitting = isLoading || authLoading;
```

---

## 5. Component Fixes

### Issue 5.1: NeonInput Missing Error State Styling

**File**: `components/NeonInput.tsx`

**Current**: Error border is applied but no shake animation.

**Enhancement** (optional):
```typescript
import { Animated } from 'react-native';

// Add shake animation on error
const shakeAnimation = useRef(new Animated.Value(0)).current;

useEffect(() => {
  if (error) {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }
}, [error]);

// Wrap container in Animated.View
<Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
  <View style={[styles.inputContainer, ...]}>
    ...
  </View>
</Animated.View>
```

### Issue 5.2: NeonButton Disabled State

**File**: `components/NeonButton.tsx`

**Current Code**:
```typescript
<TouchableOpacity
  activeOpacity={0.8}
  disabled={loading}
  ...
>
```

**Problem**: No visual disabled state.

**Solution**:
```typescript
<TouchableOpacity
  activeOpacity={0.8}
  disabled={loading || props.disabled}
  style={[
    styles.button,
    fullWidth && styles.fullWidth,
    (loading || props.disabled) && styles.disabled,
    style,
  ]}
  ...
>

// Add to styles
disabled: {
  opacity: 0.5,
},
```

---

## 6. Complete Login Screen Code

Here's the complete fixed login screen:

```typescript
import React, { useState } from 'react';
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

// Use local logo
const LogoImage = require('../../assets/images/icon.png');

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateInputs = (): boolean => {
    if (!email.trim()) {
      setLocalError('Email or username is required');
      return false;
    }
    
    if (!password) {
      setLocalError('Password is required');
      return false;
    }
    
    // Check if it's a valid email or username format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    const trimmedEmail = email.trim();
    
    if (!emailRegex.test(trimmedEmail) && !usernameRegex.test(trimmedEmail)) {
      setLocalError('Please enter a valid email or username');
      return false;
    }
    
    setLocalError(null);
    return true;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    const success = await login(email.trim(), password, rememberMe);
    if (success) {
      router.replace('/(tabs)');
    } else {
      setPassword('');
    }
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert(
      'Coming Soon',
      `${provider} sign-in will be available in a future update.`,
      [{ text: 'OK' }]
    );
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image 
            source={LogoImage} 
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="SoulWallet logo"
          />
        </View>

        <View style={styles.formContainer}>
          <GlowingText 
            text="WELCOME BACK" 
            fontSize={24} 
            style={styles.title}
          />
          <Text style={styles.subtitle}>Log in to continue</Text>

          {displayError && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {displayError}
            </Text>
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
            onChangeText={(text) => {
              setEmail(text);
              setLocalError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            leftIcon={<Mail size={20} color={COLORS.textSecondary} />}
            accessibilityLabel="Email or username input"
            accessibilityHint="Enter your email address or username to log in"
          />

          <NeonInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setLocalError(null);
            }}
            isPassword
            autoComplete="password"
            textContentType="password"
            leftIcon={<Lock size={20} color={COLORS.textSecondary} />}
            accessibilityLabel="Password input"
            accessibilityHint="Enter your password"
          />

          <View style={styles.rememberContainer}>
            <TouchableOpacity
              style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              accessibilityLabel="Remember me checkbox"
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
              <TouchableOpacity accessibilityRole="link">
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
            accessibilityLabel="Login button"
            accessibilityHint="Tap to log in to your account"
          />

          <NeonDivider text="OR CONTINUE WITH" />

          <View style={styles.socialButtonsContainer}>
            <SocialButton
              title="Google"
              icon={<Text style={styles.socialIcon}>G</Text>}
              style={styles.socialButton}
              onPress={() => handleSocialLogin('Google')}
              accessibilityLabel="Sign in with Google"
            />
            <SocialButton
              title="Apple"
              icon={<Text style={styles.socialIcon}>A</Text>}
              style={styles.socialButton}
              onPress={() => handleSocialLogin('Apple')}
              accessibilityLabel="Sign in with Apple"
            />
          </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account?</Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity accessibilityRole="link">
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

// ... styles remain the same
```

---

## Testing Checklist

- [ ] Login with valid email and password
- [ ] Login with valid username and password
- [ ] Login with invalid credentials shows error
- [ ] Login with empty fields shows validation error
- [ ] Remember me checkbox toggles correctly
- [ ] Forgot password link navigates correctly
- [ ] Signup link navigates correctly
- [ ] Social buttons show "Coming Soon" alert
- [ ] Loading state shows during API call
- [ ] Error clears when user starts typing
- [ ] Keyboard dismisses on scroll
- [ ] Screen reader can navigate all elements
