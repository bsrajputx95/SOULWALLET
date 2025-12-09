# Best Practices & Industry Standards

## Overview

This document outlines industry best practices for authentication systems and how to align the SoulWallet implementation with these standards.

---

## Authentication Standards

### OWASP Authentication Guidelines

The Open Web Application Security Project (OWASP) provides comprehensive guidelines for authentication. Here's how SoulWallet aligns:

| Guideline | Status | Notes |
|-----------|--------|-------|
| Implement proper password strength controls | ✅ | 8+ chars, mixed case, numbers, special chars |
| Implement secure password recovery | ✅ | OTP-based, time-limited |
| Store passwords securely | ✅ | bcrypt with 12 rounds |
| Transmit passwords securely | ✅ | HTTPS required |
| Implement account lockout | ✅ | 5 attempts, 30-min lockout |
| Prevent username enumeration | ✅ | Same error for invalid user/password |
| Implement multi-factor authentication | ❌ | Not yet implemented |
| Log authentication events | ✅ | Session activity logging |

### NIST Digital Identity Guidelines (SP 800-63B)

| Guideline | Status | Notes |
|-----------|--------|-------|
| Minimum 8 character passwords | ✅ | Enforced |
| No composition rules beyond length | ⚠️ | We require complexity (acceptable) |
| Check against breached password lists | ❌ | Not implemented |
| Allow paste in password fields | ✅ | Not blocked |
| Offer password strength meter | ❌ | Not implemented |
| Rate limit authentication attempts | ✅ | Implemented |

---

## Recommended Improvements

### 1. Password Strength Meter

**Why**: Helps users create stronger passwords.

**Implementation**:

```typescript
// components/PasswordStrengthMeter.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface Props {
  password: string;
}

export function PasswordStrengthMeter({ password }: Props) {
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z\d]/.test(pwd)) score++;
    
    if (score <= 2) return { score, label: 'Weak', color: COLORS.error };
    if (score <= 4) return { score, label: 'Fair', color: COLORS.warning };
    if (score <= 5) return { score, label: 'Good', color: COLORS.success };
    return { score, label: 'Strong', color: COLORS.success };
  };

  const strength = getStrength(password);
  const percentage = (strength.score / 6) * 100;

  if (!password) return null;

  return (
    <View style={styles.container}>
      <View style={styles.barContainer}>
        <View 
          style={[
            styles.bar, 
            { width: `${percentage}%`, backgroundColor: strength.color }
          ]} 
        />
      </View>
      <Text style={[styles.label, { color: strength.color }]}>
        {strength.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 16,
  },
  barContainer: {
    height: 4,
    backgroundColor: '#333',
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
  },
});
```

### 2. Breached Password Check

**Why**: Prevents use of known compromised passwords.

**Implementation** (using Have I Been Pwned API):

```typescript
// lib/password-check.ts
import * as Crypto from 'expo-crypto';

export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    // Hash the password with SHA-1
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA1,
      password
    );
    
    const prefix = hash.substring(0, 5).toUpperCase();
    const suffix = hash.substring(5).toUpperCase();
    
    // Query HIBP API with k-anonymity
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'Add-Padding': 'true', // Prevents response size analysis
        },
      }
    );
    
    if (!response.ok) {
      // Don't block signup if API is unavailable
      console.warn('HIBP API unavailable');
      return false;
    }
    
    const text = await response.text();
    const hashes = text.split('\n');
    
    for (const line of hashes) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return true; // Password found in breach database
      }
    }
    
    return false;
  } catch (error) {
    console.error('Password breach check failed:', error);
    return false; // Don't block on error
  }
}

// Usage in signup
const handleSignup = async () => {
  // ... validation ...
  
  const isBreached = await isPasswordBreached(password);
  if (isBreached) {
    setValidationError(
      'This password has been found in a data breach. Please choose a different password.'
    );
    return;
  }
  
  // ... continue signup ...
};
```

### 3. Biometric Authentication

**Why**: Faster, more secure login for returning users.

**Implementation**:

```typescript
// lib/biometric-auth.ts
import * as LocalAuthentication from 'expo-local-authentication';
import { SecureStorage } from './secure-storage';

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access SoulWallet',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    
    return result.success;
  } catch (error) {
    console.error('Biometric auth failed:', error);
    return false;
  }
}

export async function enableBiometricLogin(userId: string): Promise<void> {
  // Store a flag that biometric is enabled for this user
  await SecureStorage.setBiometricEnabled(userId, true);
}

// Usage in login screen
const LoginScreen = () => {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  
  useEffect(() => {
    checkBiometric();
  }, []);
  
  const checkBiometric = async () => {
    const available = await isBiometricAvailable();
    const enabled = await SecureStorage.getBiometricEnabled();
    setBiometricAvailable(available && enabled);
  };
  
  const handleBiometricLogin = async () => {
    const success = await authenticateWithBiometric();
    if (success) {
      // Get stored credentials and login
      const token = await SecureStorage.getToken();
      if (token) {
        // Verify token is still valid
        try {
          await trpcClient.auth.getCurrentUser.query();
          router.replace('/(tabs)');
        } catch {
          // Token expired, need password login
          setError('Session expired. Please login with password.');
        }
      }
    }
  };
  
  return (
    <>
      {/* ... existing login form ... */}
      
      {biometricAvailable && (
        <TouchableOpacity onPress={handleBiometricLogin}>
          <Text>Login with Face ID / Touch ID</Text>
        </TouchableOpacity>
      )}
    </>
  );
};
```

### 4. Session Management UI

**Why**: Users should be able to see and manage their active sessions.

**Implementation**:

```typescript
// screens/SessionsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { trpc } from '../lib/trpc';

interface Session {
  id: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActivityAt: string;
  current: boolean;
}

export function SessionsScreen() {
  const { data, refetch } = trpc.auth.getSessions.useQuery();
  const revokeSession = trpc.auth.revokeSession.useMutation();
  
  const handleRevoke = (sessionId: string) => {
    Alert.alert(
      'Revoke Session',
      'Are you sure you want to log out this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            await revokeSession.mutateAsync({ sessionId });
            refetch();
          },
        },
      ]
    );
  };
  
  const renderSession = ({ item }: { item: Session }) => (
    <View style={styles.sessionCard}>
      <View>
        <Text style={styles.device}>
          {parseUserAgent(item.userAgent)}
        </Text>
        <Text style={styles.ip}>IP: {item.ipAddress}</Text>
        <Text style={styles.time}>
          Last active: {formatDate(item.lastActivityAt)}
        </Text>
        {item.current && (
          <Text style={styles.current}>Current Session</Text>
        )}
      </View>
      {!item.current && (
        <TouchableOpacity 
          onPress={() => handleRevoke(item.id)}
          style={styles.revokeButton}
        >
          <Text style={styles.revokeText}>Revoke</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  
  return (
    <FlatList
      data={data?.sessions}
      renderItem={renderSession}
      keyExtractor={(item) => item.id}
    />
  );
}
```

### 5. Security Notifications

**Why**: Alert users to suspicious activity.

**Backend Implementation**:

```typescript
// src/lib/services/security-notifications.ts
import { createEmailService } from './email';

const emailService = createEmailService();

export async function notifyNewLogin(
  email: string,
  ipAddress: string,
  userAgent: string,
  location?: string
) {
  await emailService.sendEmail({
    to: email,
    subject: 'New Login to Your SoulWallet Account',
    html: `
      <h2>New Login Detected</h2>
      <p>A new login to your SoulWallet account was detected:</p>
      <ul>
        <li><strong>Time:</strong> ${new Date().toISOString()}</li>
        <li><strong>IP Address:</strong> ${ipAddress}</li>
        <li><strong>Device:</strong> ${parseUserAgent(userAgent)}</li>
        ${location ? `<li><strong>Location:</strong> ${location}</li>` : ''}
      </ul>
      <p>If this wasn't you, please secure your account immediately.</p>
    `,
  });
}

export async function notifyPasswordChanged(email: string) {
  await emailService.sendEmail({
    to: email,
    subject: 'Your SoulWallet Password Was Changed',
    html: `
      <h2>Password Changed</h2>
      <p>Your SoulWallet password was recently changed.</p>
      <p>If you didn't make this change, please contact support immediately.</p>
    `,
  });
}

export async function notifySuspiciousActivity(
  email: string,
  activity: string,
  details: Record<string, any>
) {
  await emailService.sendEmail({
    to: email,
    subject: 'Suspicious Activity on Your SoulWallet Account',
    html: `
      <h2>Suspicious Activity Detected</h2>
      <p>We detected unusual activity on your account:</p>
      <p><strong>${activity}</strong></p>
      <p>Details: ${JSON.stringify(details)}</p>
      <p>If this wasn't you, please secure your account immediately.</p>
    `,
  });
}
```

---

## UI/UX Best Practices

### 1. Clear Error Messages

```typescript
// Map backend errors to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  'Invalid email/username or password': 'The email/username or password you entered is incorrect.',
  'User with this email already exists': 'An account with this email already exists. Try logging in instead.',
  'Username is already taken': 'This username is taken. Please choose another.',
  'Account is locked': 'Your account has been temporarily locked due to too many failed attempts. Please try again later.',
  'Invalid or expired OTP': 'The verification code is invalid or has expired. Please request a new one.',
};

const getErrorMessage = (error: string): string => {
  return ERROR_MESSAGES[error] || error;
};
```

### 2. Loading States

```typescript
// Show meaningful loading states
{isLoading && (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color={COLORS.solana} />
    <Text style={styles.loadingText}>
      {loadingMessage || 'Please wait...'}
    </Text>
  </View>
)}
```

### 3. Form Validation Feedback

```typescript
// Real-time validation feedback
const [emailError, setEmailError] = useState<string | null>(null);

const validateEmail = (email: string) => {
  if (!email) {
    setEmailError(null);
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    setEmailError('Please enter a valid email address');
  } else {
    setEmailError(null);
  }
};

<NeonInput
  label="Email"
  value={email}
  onChangeText={(text) => {
    setEmail(text);
    validateEmail(text);
  }}
  error={emailError}
/>
```

### 4. Keyboard Handling

```typescript
// Proper keyboard handling
<KeyboardAvoidingView
  style={styles.container}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
>
  <ScrollView
    contentContainerStyle={styles.scrollContent}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
  >
    {/* Form content */}
  </ScrollView>
</KeyboardAvoidingView>
```

### 5. Accessibility

```typescript
// Ensure all interactive elements are accessible
<TouchableOpacity
  onPress={handleLogin}
  accessibilityRole="button"
  accessibilityLabel="Login"
  accessibilityHint="Double tap to log in to your account"
  accessibilityState={{ disabled: isLoading }}
>
  <Text>Login</Text>
</TouchableOpacity>

// Form inputs
<TextInput
  accessibilityLabel="Email input"
  accessibilityHint="Enter your email address"
  accessibilityValue={{ text: email }}
/>
```

---

## Security Checklist for Production

### Frontend
- [ ] No sensitive data in console.log
- [ ] No hardcoded credentials
- [ ] Secure storage for tokens
- [ ] HTTPS only for API calls
- [ ] Input validation before API calls
- [ ] Proper error handling (no stack traces)
- [ ] Session timeout handling
- [ ] Biometric authentication (optional)

### Backend
- [ ] Strong JWT secrets (32+ chars, high entropy)
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] CSRF protection enabled
- [ ] Rate limiting on all auth endpoints
- [ ] Account lockout implemented
- [ ] Password hashing with bcrypt (12+ rounds)
- [ ] No sensitive data in logs
- [ ] Session management with expiry
- [ ] Input validation with Zod
- [ ] SQL injection prevention (Prisma)
- [ ] XSS prevention (input sanitization)

### Infrastructure
- [ ] Database encrypted at rest
- [ ] Database connections encrypted (SSL)
- [ ] Environment variables secured
- [ ] Secrets rotated regularly
- [ ] Monitoring and alerting
- [ ] Backup and recovery tested
- [ ] DDoS protection

---

## Resources

### Documentation
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
- [Expo Security Best Practices](https://docs.expo.dev/guides/security/)

### Libraries
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [expo-local-authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)

### Testing Tools
- [OWASP ZAP](https://www.zaproxy.org/) - Security testing
- [Burp Suite](https://portswigger.net/burp) - Security testing
- [Have I Been Pwned API](https://haveibeenpwned.com/API/v3) - Password breach checking
