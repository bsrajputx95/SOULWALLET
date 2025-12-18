import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Switch,
  Alert,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  Users,
  Camera,
  Languages,
  ShieldCheck,
  DollarSign,
  X,
  Check,
  Smartphone,
  Trash2,
} from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { trpc } from '../lib/trpc';

import { useAccount } from '../hooks/account-store';

export default function AccountScreen() {
  const {
    profile,
    isUpdating: isAccountUpdating,
    updateProfile,
    updateSecurity,
  } = useAccount();

  // Session management
  const sessionsQuery = trpc.auth.getSessions.useQuery();
  const revokeSessionMutation = trpc.auth.revokeSession.useMutation();
  const deleteAccountMutation = trpc.account.deleteAccount.useMutation();

  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '');
  const [defaultCurrency, setDefaultCurrency] = useState(profile?.defaultCurrency || 'USD');
  const [language, setLanguage] = useState(profile?.language || 'English');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(profile?.twoFactorEnabled || false);

  // Password Reset Modal States
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetStep, setPasswordResetStep] = useState(1); // 1: email/phone, 2: OTP, 3: new password
  const [resetContactMethod, setResetContactMethod] = useState('email'); // 'email' or 'phone'
  const [resetContactValue, setResetContactValue] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordResetLoading, setIsPasswordResetLoading] = useState(false);

  // Password Reset Mutations
  const requestPasswordResetMutation = trpc.auth.requestPasswordReset.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();

  // 2FA TOTP Mutations
  const setupTOTPMutation = trpc.account.setupTOTP.useMutation();
  const enableTOTPMutation = trpc.account.enableTOTP.useMutation();
  const disableTOTPMutation = trpc.account.disableTOTP.useMutation();

  // Two-Factor Authentication Modal States
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState(1); // 1: password, 2: QR code, 3: verify code, 4: backup codes
  const [totpPassword, setTotpPassword] = useState('');
  const [totpQrCode, setTotpQrCode] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[]>([]);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false);

  // Delete Account Modal States
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);



  // Scroll tracking for header animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = 60; // Approximate header height

  const handleSave = async () => {
    try {
      // Update user profile
      await updateProfile({
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        defaultCurrency,
        language,
      });

      // Update security settings if 2FA changed
      if (twoFactorEnabled !== profile?.twoFactorEnabled) {
        await updateSecurity({
          twoFactorEnabled,
        });
      }

      // IBuy settings would be updated here if implemented

      Alert.alert('Success', 'Account settings updated successfully!');
    } catch (error) {
      if (__DEV__) console.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to update settings. Please try again.');
    }
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up';

        // Only animate if scroll direction changed or significant scroll distance
        if (Math.abs(currentScrollY - lastScrollY.current) > 5) {
          if (scrollDirection === 'down' && currentScrollY > HEADER_HEIGHT) {
            // Hide header when scrolling down
            Animated.timing(headerTranslateY, {
              toValue: -HEADER_HEIGHT,
              duration: 200,
              useNativeDriver: true,
            }).start();
          } else if (scrollDirection === 'up') {
            // Show header when scrolling up
            Animated.timing(headerTranslateY, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start();
          }
        }

        lastScrollY.current = currentScrollY;
      },
    }
  );

  const handleResetPassword = () => {
    setShowPasswordResetModal(true);
    setPasswordResetStep(1);
    setResetContactValue('');
    setResetOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleInviteFriends = () => {
    Alert.alert(
      'Invite Friends',
      'Share your referral code: GHOST2024',
      [
        { text: 'Copy Code', onPress: () => { if (__DEV__) console.log('Code copied'); } },
        { text: 'Share', onPress: () => { if (__DEV__) console.log('Share referral'); } },
      ]
    );
  };

  const handleSetupTwoFactor = async () => {
    if (twoFactorEnabled) {
      // Show disable 2FA modal - will need password and TOTP code
      Alert.alert(
        'Disable 2FA',
        'To disable two-factor authentication, you will need to enter your password and a verification code from your authenticator app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              // For now, show a prompt for password and code
              // In a full implementation, this would be a proper modal
              Alert.prompt(
                'Enter Password',
                'Enter your account password:',
                async (password) => {
                  if (!password) return;
                  Alert.prompt(
                    'Enter 2FA Code',
                    'Enter the 6-digit code from your authenticator app:',
                    async (code) => {
                      if (!code) return;
                      try {
                        await disableTOTPMutation.mutateAsync({ password, code });
                        setTwoFactorEnabled(false);
                        Alert.alert('Success', '2FA disabled successfully!');
                      } catch (error: any) {
                        Alert.alert('Error', error?.message || 'Failed to disable 2FA.');
                      }
                    },
                    'plain-text'
                  );
                },
                'secure-text'
              );
            }
          },
        ]
      );
    } else {
      // Start 2FA setup flow
      setShowTwoFactorModal(true);
      setTwoFactorStep(1);
      setTotpPassword('');
      setTotpQrCode('');
      setTotpBackupCodes([]);
      setTotpVerifyCode('');
    }
  };



  // Password Reset Modal Handlers
  const handlePasswordResetNext = async () => {
    if (passwordResetStep === 1) {
      if (!resetContactValue.trim()) {
        Alert.alert('Error', `Please enter your ${resetContactMethod}`);
        return;
      }

      // Only email is supported for now
      if (resetContactMethod === 'phone') {
        Alert.alert('Not Available', 'Phone verification is not yet available. Please use email.');
        return;
      }

      try {
        setIsPasswordResetLoading(true);
        await requestPasswordResetMutation.mutateAsync({ email: resetContactValue.trim().toLowerCase() });
        Alert.alert('OTP Sent', 'A verification code has been sent to your email');
        setPasswordResetStep(2);
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to send verification code');
      } finally {
        setIsPasswordResetLoading(false);
      }
    } else if (passwordResetStep === 2) {
      if (!resetOtp.trim() || resetOtp.length !== 6) {
        Alert.alert('Error', 'Please enter a valid 6-digit OTP');
        return;
      }

      try {
        setIsPasswordResetLoading(true);
        const result = await verifyOtpMutation.mutateAsync({
          email: resetContactValue.trim().toLowerCase(),
          otp: resetOtp.trim()
        });
        if (result.isValid) {
          setPasswordResetStep(3);
        } else {
          Alert.alert('Error', 'Invalid verification code');
        }
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Invalid or expired verification code');
      } finally {
        setIsPasswordResetLoading(false);
      }
    } else if (passwordResetStep === 3) {
      if (!newPassword.trim() || newPassword.length < 8) {
        Alert.alert('Error', 'Password must be at least 8 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      try {
        setIsPasswordResetLoading(true);
        await resetPasswordMutation.mutateAsync({
          email: resetContactValue.trim().toLowerCase(),
          otp: resetOtp.trim(),
          newPassword: newPassword,
          confirmPassword: confirmPassword,
        });
        Alert.alert('Success', 'Password reset successfully! Please log in with your new password.');
        setShowPasswordResetModal(false);
        // Reset form state
        setPasswordResetStep(1);
        setResetContactValue('');
        setResetOtp('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to reset password');
      } finally {
        setIsPasswordResetLoading(false);
      }
    }
  };

  const handlePasswordResetBack = () => {
    if (passwordResetStep > 1) {
      setPasswordResetStep(passwordResetStep - 1);
    }
  };

  // Two-Factor Authentication Modal Handlers (TOTP)
  const handleTwoFactorNext = async () => {
    if (twoFactorStep === 1) {
      // Step 1: Verify password and get QR code
      if (!totpPassword.trim()) {
        Alert.alert('Error', 'Please enter your password');
        return;
      }

      try {
        setIsTwoFactorLoading(true);
        const result = await setupTOTPMutation.mutateAsync({ password: totpPassword });
        setTotpQrCode(result.qrCodeUrl);
        setTotpBackupCodes(result.backupCodes);
        setTwoFactorStep(2);
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to setup 2FA');
      } finally {
        setIsTwoFactorLoading(false);
      }
    } else if (twoFactorStep === 2) {
      // Step 2: User has scanned QR code, move to verification
      setTwoFactorStep(3);
    } else if (twoFactorStep === 3) {
      // Step 3: Verify the TOTP code
      if (!totpVerifyCode.trim() || totpVerifyCode.length !== 6) {
        Alert.alert('Error', 'Please enter a valid 6-digit code from your authenticator app');
        return;
      }

      try {
        setIsTwoFactorLoading(true);
        await enableTOTPMutation.mutateAsync({ code: totpVerifyCode });
        setTwoFactorStep(4);
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Invalid verification code');
      } finally {
        setIsTwoFactorLoading(false);
      }
    } else if (twoFactorStep === 4) {
      // Step 4: Show backup codes and finish
      setTwoFactorEnabled(true);
      setShowTwoFactorModal(false);
      Alert.alert('Success', 'Two-Factor Authentication is now enabled!');
      // Reset state
      setTotpPassword('');
      setTotpQrCode('');
      setTotpBackupCodes([]);
      setTotpVerifyCode('');
      setTwoFactorStep(1);
    }
  };

  const handleTwoFactorBack = () => {
    if (twoFactorStep > 1 && twoFactorStep < 4) {
      setTwoFactorStep(twoFactorStep - 1);
    }
  };

  // Session Management Handlers
  const handleRevokeSession = async (sessionId: string) => {
    Alert.alert(
      'Revoke Session',
      'Are you sure you want to end this session? The device will be logged out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeSessionMutation.mutateAsync({ sessionId });
              sessionsQuery.refetch();
              Alert.alert('Success', 'Session revoked successfully');
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to revoke session');
            }
          },
        },
      ]
    );
  };

  // Delete Account Handlers
  const handleDeleteAccount = () => {
    setShowDeleteAccountModal(true);
    setDeletePassword('');
    setDeleteConfirmText('');
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      Alert.alert('Error', 'Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAccountMutation.mutateAsync({
        password: deletePassword,
        confirmText: deleteConfirmText,
      });
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
      setShowDeleteAccountModal(false);
      // The user will be logged out automatically since their session is invalidated
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format session info for display
  const formatSessionInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown Device';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS Device';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Unknown Device';
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, isAccountUpdating && styles.saveButtonDisabled]}
          disabled={isAccountUpdating}
        >
          <Text style={styles.saveButtonText}>
            {isAccountUpdating ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>

          <View style={styles.profileImageContainer}>
            <View style={styles.profileImageWrapper}>
              {profile?.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.defaultProfileImage}>
                  <Text style={styles.profileImageText}>
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.cameraButton}>
                <Camera size={16} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileImageLabel}>Profile Picture</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <View style={styles.inputContainer}>
              <User size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter first name"
                placeholderTextColor={COLORS.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <View style={styles.inputContainer}>
              <User size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter last name"
                placeholderTextColor={COLORS.textSecondary}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <View style={styles.inputContainer}>
              <Calendar size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={COLORS.textSecondary}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
              />
            </View>
          </View>
        </View>



        {/* Security & Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security & Privacy</Text>

          <TouchableOpacity style={styles.settingRow} onPress={handleResetPassword}>
            <View style={styles.settingLeft}>
              <Lock size={20} color={COLORS.textSecondary} />
              <Text style={styles.settingText}>Reset Password</Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <ShieldCheck size={20} color={COLORS.textSecondary} />
              <Text style={styles.settingText}>Two-Factor Authentication</Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={handleSetupTwoFactor}
              trackColor={{ false: COLORS.cardBackground, true: COLORS.solana + '50' }}
              thumbColor={twoFactorEnabled ? COLORS.solana : COLORS.textSecondary}
            />
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Default Currency</Text>
            <View style={styles.inputContainer}>
              <DollarSign size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="USD"
                placeholderTextColor={COLORS.textSecondary}
                value={defaultCurrency}
                onChangeText={setDefaultCurrency}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Language</Text>
            <View style={styles.inputContainer}>
              <Languages size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="English"
                placeholderTextColor={COLORS.textSecondary}
                value={language}
                onChangeText={setLanguage}
              />
            </View>
          </View>
        </View>



        {/* Active Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          <Text style={styles.sectionDescription}>
            Manage devices where you're currently logged in
          </Text>

          {sessionsQuery.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.solana} />
              <Text style={styles.loadingText}>Loading sessions...</Text>
            </View>
          ) : sessionsQuery.data?.sessions && sessionsQuery.data.sessions.length > 0 ? (
            sessionsQuery.data.sessions.map((session: { id: string; ipAddress: string | null; userAgent: string | null; createdAt: Date; lastActivityAt: Date; current: boolean }) => (
              <View key={session.id} style={styles.sessionItem}>
                <View style={styles.sessionInfo}>
                  <View style={styles.sessionHeader}>
                    <Smartphone size={18} color={COLORS.textSecondary} />
                    <Text style={styles.sessionDevice}>
                      {formatSessionInfo(session.userAgent)}
                    </Text>
                    {session.current && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sessionDetails}>
                    {session.ipAddress || 'Unknown IP'} • Last active: {formatDate(session.lastActivityAt)}
                  </Text>
                </View>
                {!session.current && (
                  <TouchableOpacity
                    style={styles.revokeButton}
                    onPress={() => handleRevokeSession(session.id)}
                    disabled={revokeSessionMutation.isPending}
                  >
                    <Text style={styles.revokeButtonText}>Revoke</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noSessionsText}>No active sessions found</Text>
          )}
        </View>

        {/* Social */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>

          <TouchableOpacity style={styles.settingRow} onPress={handleInviteFriends}>
            <View style={styles.settingLeft}>
              <Users size={20} color={COLORS.textSecondary} />
              <Text style={styles.settingText}>Invite Friends</Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={[styles.sectionTitle, { color: COLORS.error }]}>Danger Zone</Text>

          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Trash2 size={20} color={COLORS.error} />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.deleteAccountWarning}>
            This action is permanent and cannot be undone.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Password Reset Modal */}
      <Modal
        visible={showPasswordResetModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasswordResetModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPasswordResetModal(false)}>
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            {passwordResetStep === 1 && (
              <>
                <Text style={styles.modalDescription}>
                  Enter your email or mobile number to receive a verification code
                </Text>

                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[styles.methodButton, resetContactMethod === 'email' && styles.methodButtonActive]}
                    onPress={() => setResetContactMethod('email')}
                  >
                    <Mail size={20} color={resetContactMethod === 'email' ? COLORS.textPrimary : COLORS.textSecondary} />
                    <Text style={[styles.methodText, resetContactMethod === 'email' && styles.methodTextActive]}>Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.methodButton, resetContactMethod === 'phone' && styles.methodButtonActive]}
                    onPress={() => setResetContactMethod('phone')}
                  >
                    <Phone size={20} color={resetContactMethod === 'phone' ? COLORS.textPrimary : COLORS.textSecondary} />
                    <Text style={[styles.methodText, resetContactMethod === 'phone' && styles.methodTextActive]}>Phone</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {resetContactMethod === 'email' ? 'Email Address' : 'Phone Number'}
                  </Text>
                  <View style={styles.inputContainer}>
                    {resetContactMethod === 'email' ? (
                      <Mail size={20} color={COLORS.textSecondary} />
                    ) : (
                      <Phone size={20} color={COLORS.textSecondary} />
                    )}
                    <TextInput
                      style={styles.input}
                      value={resetContactValue}
                      onChangeText={setResetContactValue}
                      placeholder={resetContactMethod === 'email' ? 'Enter your email' : 'Enter your phone number'}
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType={resetContactMethod === 'email' ? 'email-address' : 'phone-pad'}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </>
            )}

            {passwordResetStep === 2 && (
              <>
                <Text style={styles.modalDescription}>
                  Enter the 6-digit verification code sent to your {resetContactMethod}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={resetOtp}
                      onChangeText={setResetOtp}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
              </>
            )}

            {passwordResetStep === 3 && (
              <>
                <Text style={styles.modalDescription}>
                  Create a new password for your account
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={COLORS.textSecondary}
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={COLORS.textSecondary}
                      secureTextEntry
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.modalFooter}>
            {passwordResetStep > 1 && !isPasswordResetLoading && (
              <TouchableOpacity style={styles.backButton} onPress={handlePasswordResetBack}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextButton, isPasswordResetLoading && styles.nextButtonDisabled]}
              onPress={handlePasswordResetNext}
              disabled={isPasswordResetLoading}
            >
              <Text style={styles.nextButtonText}>
                {isPasswordResetLoading
                  ? 'Please wait...'
                  : passwordResetStep === 1
                    ? 'Send Code'
                    : passwordResetStep === 2
                      ? 'Verify'
                      : 'Reset Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Two-Factor Authentication Modal (TOTP) */}
      <Modal
        visible={showTwoFactorModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTwoFactorModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTwoFactorModal(false)}>
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Setup Authenticator App</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {twoFactorStep === 1 && (
              <>
                <Text style={styles.modalDescription}>
                  Enter your password to begin setting up two-factor authentication with an authenticator app.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={totpPassword}
                      onChangeText={setTotpPassword}
                      placeholder="Enter your password"
                      placeholderTextColor={COLORS.textSecondary}
                      secureTextEntry
                    />
                  </View>
                </View>
              </>
            )}

            {twoFactorStep === 2 && (
              <>
                <Text style={styles.modalDescription}>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </Text>

                {totpQrCode ? (
                  <View style={styles.qrCodeContainer}>
                    <Image
                      source={{ uri: totpQrCode }}
                      style={styles.qrCode}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.qrCodeContainer}>
                    <Text style={styles.qrCodePlaceholder}>Loading QR Code...</Text>
                  </View>
                )}

                <Text style={[styles.modalDescription, { marginTop: SPACING.m }]}>
                  After scanning, tap "Next" to verify the setup.
                </Text>
              </>
            )}

            {twoFactorStep === 3 && (
              <>
                <Text style={styles.modalDescription}>
                  Enter the 6-digit code from your authenticator app to verify the setup.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <ShieldCheck size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={totpVerifyCode}
                      onChangeText={setTotpVerifyCode}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
              </>
            )}

            {twoFactorStep === 4 && (
              <>
                <View style={styles.successMessage}>
                  <Check size={24} color={COLORS.solana} />
                  <Text style={styles.successText}>
                    2FA is now enabled!
                  </Text>
                </View>

                <Text style={styles.modalDescription}>
                  Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </Text>

                <View style={styles.backupCodesContainer}>
                  {totpBackupCodes.map((code, index) => (
                    <View key={index} style={styles.backupCodeItem}>
                      <Text style={styles.backupCodeText}>{code}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.modalDescription, { color: COLORS.error, marginTop: SPACING.m }]}>
                  ⚠️ These codes will only be shown once. Save them now!
                </Text>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            {twoFactorStep > 1 && twoFactorStep < 4 && !isTwoFactorLoading && (
              <TouchableOpacity style={styles.backButton} onPress={handleTwoFactorBack}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextButton, isTwoFactorLoading && styles.nextButtonDisabled]}
              onPress={handleTwoFactorNext}
              disabled={isTwoFactorLoading}
            >
              <Text style={styles.nextButtonText}>
                {isTwoFactorLoading
                  ? 'Please wait...'
                  : twoFactorStep === 1
                    ? 'Continue'
                    : twoFactorStep === 2
                      ? 'Next'
                      : twoFactorStep === 3
                        ? 'Verify & Enable'
                        : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccountModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDeleteAccountModal(false)}>
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.dangerWarning}>
              <Trash2 size={32} color={COLORS.error} />
              <Text style={styles.dangerWarningTitle}>This action is permanent</Text>
              <Text style={styles.dangerWarningText}>
                Deleting your account will permanently remove all your data, including your wallet, transaction history, and settings. This cannot be undone.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={20} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Type "DELETE MY ACCOUNT" to confirm</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder="DELETE MY ACCOUNT"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowDeleteAccountModal(false)}
            >
              <Text style={styles.backButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, isDeleting && styles.nextButtonDisabled]}
              onPress={handleConfirmDeleteAccount}
              disabled={isDeleting}
            >
              <Text style={styles.deleteButtonText}>
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
    backgroundColor: COLORS.background,
    height: 60,
  },

  headerTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
  },
  saveButton: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.solana,
    borderRadius: BORDER_RADIUS.small,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  sectionTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.s,
  },
  sectionDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: SPACING.m,
    lineHeight: 20,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  profileImageWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.solana + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 32,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.solana,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageLabel: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.s,
  },
  inputGroup: {
    marginBottom: SPACING.m,
  },
  inputLabel: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  input: {
    ...FONTS.phantomRegular,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    paddingVertical: SPACING.m,
    marginLeft: SPACING.s,
  },
  percentSymbol: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  settingArrow: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 24,
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
  },
  modalDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: SPACING.l,
    textAlign: 'center',
  },
  methodSelector: {
    flexDirection: 'row',
    marginBottom: SPACING.l,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
  },
  methodButtonActive: {
    backgroundColor: COLORS.solana + '20',
  },
  methodText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
  methodTextActive: {
    color: COLORS.textPrimary,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBackground,
    gap: SPACING.m,
  },
  backButton: {
    flex: 1,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '40',
    alignItems: 'center',
  },
  backButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  nextButton: {
    flex: 2,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.solana,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana + '10',
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    marginTop: SPACING.m,
  },
  successText: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 14,
    marginLeft: SPACING.s,
    flex: 1,
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginVertical: SPACING.l,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  qrCodePlaceholder: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  backupCodesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SPACING.m,
  },
  backupCodeItem: {
    width: '48%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.small,
    padding: SPACING.m,
    marginBottom: SPACING.s,
    alignItems: 'center',
  },
  backupCodeText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 14,
    letterSpacing: 2,
  },
  // Session Management Styles
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.l,
  },
  loadingText: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: SPACING.s,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  sessionDevice: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.s,
  },
  currentBadge: {
    backgroundColor: COLORS.solana + '20',
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.small,
    marginLeft: SPACING.s,
  },
  currentBadgeText: {
    ...FONTS.phantomMedium,
    color: COLORS.solana,
    fontSize: 10,
  },
  sessionDetails: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 26,
  },
  revokeButton: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  revokeButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.error,
    fontSize: 12,
  },
  noSessionsText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: SPACING.l,
  },
  // Danger Zone Styles
  dangerSection: {
    borderBottomWidth: 0,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    backgroundColor: COLORS.error + '10',
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  deleteAccountText: {
    ...FONTS.phantomMedium,
    color: COLORS.error,
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  deleteAccountWarning: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.s,
    textAlign: 'center',
  },
  dangerWarning: {
    alignItems: 'center',
    backgroundColor: COLORS.error + '10',
    padding: SPACING.l,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.l,
  },
  dangerWarningTitle: {
    ...FONTS.phantomBold,
    color: COLORS.error,
    fontSize: 18,
    marginTop: SPACING.m,
    marginBottom: SPACING.s,
  },
  dangerWarningText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteButton: {
    flex: 2,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: COLORS.error,
    alignItems: 'center',
  },
  deleteButtonText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
});