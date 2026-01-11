import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
import { SkeletonLoader } from '../components/SkeletonLoader';
import { ProfileForm } from '../components/account/ProfileForm';
import { SecurityModal } from '../components/account/SecurityModal';

export default function AccountScreen() {
  const {
    profile,
    isLoading,
    isUpdating: isAccountUpdating,
    updateProfile,
    updateSecurity,
    uploadProfileImage,
    isUploadingImage,
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

  const [showDisableTwoFactorModal, setShowDisableTwoFactorModal] = useState(false);
  const [disableTotpPassword, setDisableTotpPassword] = useState('');
  const [disableTotpCode, setDisableTotpCode] = useState('');
  const [isDisablingTwoFactor, setIsDisablingTwoFactor] = useState(false);

  // Delete Account Modal States
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Sync form state when profile data loads
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setDateOfBirth(profile.dateOfBirth || '');
      setDefaultCurrency(profile.defaultCurrency || 'USD');
      setLanguage(profile.language || 'English');
      setTwoFactorEnabled(profile.twoFactorEnabled || false);
    }
  }, [profile]);

  // Image picker handler
  const handlePickImage = async () => {
    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please grant camera access in Settings');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
              base64: false,
            });
            if (!result.canceled && result.assets[0]) {
              await uploadImageFromAsset(result.assets[0]);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please grant photo library access in Settings');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
              base64: false,
            });
            if (!result.canceled && result.assets[0]) {
              await uploadImageFromAsset(result.assets[0]);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadImageFromAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsProcessingImage(true);
    try {
      const processed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800, height: 800 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!processed.base64) {
        throw new Error('Failed to process image');
      }

      await uploadImage(processed.base64, 'image/jpeg');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to process image');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const uploadImage = async (base64: string, mimeType: string) => {
    try {
      const result = await uploadProfileImage(base64, mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif');
      if (result?.success) {
        Alert.alert('Success', 'Profile picture updated!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload image');
    }
  };



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
        { text: 'OK' },
      ]
    );
  };

  const handleSetupTwoFactor = async (nextValue: boolean) => {
    if (!nextValue && twoFactorEnabled) {
      setShowDisableTwoFactorModal(true);
      setDisableTotpPassword('');
      setDisableTotpCode('');
      return;
    }

    if (nextValue && !twoFactorEnabled) {
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

  const handleConfirmDisableTwoFactor = async () => {
    if (!disableTotpPassword.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    if (!disableTotpCode.trim() || disableTotpCode.trim().length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsDisablingTwoFactor(true);
      await disableTOTPMutation.mutateAsync({ password: disableTotpPassword.trim(), code: disableTotpCode.trim() });
      setTwoFactorEnabled(false);
      setShowDisableTwoFactorModal(false);
      setDisableTotpPassword('');
      setDisableTotpCode('');
      Alert.alert('Success', '2FA disabled successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to disable 2FA.');
    } finally {
      setIsDisablingTwoFactor(false);
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
              void sessionsQuery.refetch();
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
          testID="account-save-button"
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
        testID="account-scroll-view"
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <ProfileForm
          styles={styles}
          profile={profile}
          isLoading={isLoading}
          isUploadingImage={isUploadingImage}
          isProcessingImage={isProcessingImage}
          onPickImage={handlePickImage}
          firstName={firstName}
          lastName={lastName}
          email={email}
          phone={phone}
          dateOfBirth={dateOfBirth}
          setFirstName={setFirstName}
          setLastName={setLastName}
          setEmail={setEmail}
          setPhone={setPhone}
          setDateOfBirth={setDateOfBirth}
        />



        {/* Security & Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security & Privacy</Text>

          {isLoading ? (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <SkeletonLoader width={20} height={20} borderRadius={10} />
                  <SkeletonLoader width={130} height={14} style={{ marginLeft: SPACING.m }} />
                </View>
                <SkeletonLoader width={20} height={14} />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <SkeletonLoader width={20} height={20} borderRadius={10} />
                  <SkeletonLoader width={180} height={14} style={{ marginLeft: SPACING.m }} />
                </View>
                <SkeletonLoader width={44} height={24} borderRadius={12} />
              </View>
            </>
          ) : (
            <>
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
                  testID="account-twofactor-switch"
                  value={twoFactorEnabled}
                  onValueChange={(value) => handleSetupTwoFactor(value)}
                  trackColor={{ false: COLORS.cardBackground, true: COLORS.solana + '50' }}
                  thumbColor={twoFactorEnabled ? COLORS.solana : COLORS.textSecondary}
                />
              </View>
            </>
          )}
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

          {isLoading || sessionsQuery.isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.sessionItem}>
                  <View style={styles.sessionInfo}>
                    <View style={styles.sessionHeader}>
                      <SkeletonLoader width={18} height={18} borderRadius={9} />
                      <SkeletonLoader width={120} height={14} style={{ marginLeft: SPACING.s }} />
                    </View>
                    <SkeletonLoader width="85%" height={12} style={{ marginTop: SPACING.xs }} />
                  </View>
                  <SkeletonLoader width={64} height={30} borderRadius={BORDER_RADIUS.small} />
                </View>
              ))}
            </>
          ) : sessionsQuery.data?.sessions && sessionsQuery.data.sessions.length > 0 ? (
            <View testID="session-list">
              {sessionsQuery.data.sessions.map((session: { id: string; ipAddress: string | null; userAgent: string | null; createdAt: Date; lastActivityAt: Date; current: boolean }) => (
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
                      testID="revoke-session-button"
                      style={styles.revokeButton}
                      onPress={() => handleRevokeSession(session.id)}
                      disabled={revokeSessionMutation.isPending}
                    >
                      <Text style={styles.revokeButtonText}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
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

          <TouchableOpacity testID="account-delete-account-open-button" style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Trash2 size={20} color={COLORS.error} />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.deleteAccountWarning}>
            This action is permanent and cannot be undone.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
      <SecurityModal
        styles={styles}
        showPasswordResetModal={showPasswordResetModal}
        setShowPasswordResetModal={setShowPasswordResetModal}
        passwordResetStep={passwordResetStep}
        resetContactMethod={resetContactMethod}
        setResetContactMethod={setResetContactMethod}
        resetContactValue={resetContactValue}
        setResetContactValue={setResetContactValue}
        resetOtp={resetOtp}
        setResetOtp={setResetOtp}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        isPasswordResetLoading={isPasswordResetLoading}
        handlePasswordResetBack={handlePasswordResetBack}
        handlePasswordResetNext={handlePasswordResetNext}
        showTwoFactorModal={showTwoFactorModal}
        setShowTwoFactorModal={setShowTwoFactorModal}
        twoFactorStep={twoFactorStep}
        totpPassword={totpPassword}
        setTotpPassword={setTotpPassword}
        totpQrCode={totpQrCode}
        totpBackupCodes={totpBackupCodes}
        totpVerifyCode={totpVerifyCode}
        setTotpVerifyCode={setTotpVerifyCode}
        isTwoFactorLoading={isTwoFactorLoading}
        handleTwoFactorBack={handleTwoFactorBack}
        handleTwoFactorNext={handleTwoFactorNext}
      />

      <Modal
        visible={showDisableTwoFactorModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDisableTwoFactorModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 48 : 0}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDisableTwoFactorModal(false)}>
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Disable Two-Factor Authentication</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalDescription}>
                Enter your password and a code from your authenticator app to disable 2FA.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputContainer}>
                  <Lock size={20} color={COLORS.textSecondary} />
                  <TextInput
                    testID="totp-disable-password-input"
                    style={styles.input}
                    value={disableTotpPassword}
                    onChangeText={setDisableTotpPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={COLORS.textSecondary}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <View style={styles.inputContainer}>
                  <ShieldCheck size={20} color={COLORS.textSecondary} />
                  <TextInput
                    testID="totp-disable-code-input"
                    style={styles.input}
                    value={disableTotpCode}
                    onChangeText={setDisableTotpCode}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowDisableTwoFactorModal(false)}
                disabled={isDisablingTwoFactor}
              >
                <Text style={styles.backButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="totp-disable-confirm-button"
                style={[styles.deleteButton, isDisablingTwoFactor && styles.nextButtonDisabled]}
                onPress={handleConfirmDisableTwoFactor}
                disabled={isDisablingTwoFactor}
              >
                <Text style={styles.deleteButtonText}>
                  {isDisablingTwoFactor ? 'Disabling...' : 'Disable 2FA'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 48 : 0}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDeleteAccountModal(false)}>
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
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
                    testID="delete-password-input"
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
                    testID="delete-confirm-input"
                    style={styles.input}
                    value={deleteConfirmText}
                    onChangeText={setDeleteConfirmText}
                    placeholder="DELETE MY ACCOUNT"
                    placeholderTextColor={COLORS.textSecondary}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowDeleteAccountModal(false)}
              >
                <Text style={styles.backButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="delete-account-confirm-button"
                style={[styles.deleteButton, isDeleting && styles.nextButtonDisabled]}
                onPress={handleConfirmDeleteAccount}
                disabled={isDeleting}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.solana,
    borderRadius: BORDER_RADIUS.small,
    minWidth: 60,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
