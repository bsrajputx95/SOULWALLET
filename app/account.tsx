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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  Users,
  Camera,
  Globe,
  Languages,
  ShieldCheck,
  DollarSign,
  X,
  Check,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../hooks/auth-store';

import { useAccount } from '../hooks/account-store';

export default function AccountScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { 
    profile, 
    securitySettings, 
    walletInfo, 
    isLoading: isAccountLoading, 
    isUpdating: isAccountUpdating,
    updateProfile,
    updateSecurity,
    resetPassword: resetUserPassword,
    getWalletPrivateKey,
    getWalletRecoveryPhrase,
    generateBackupCodes,
    uploadProfileImage,
    profileError,
    securityError,
    walletError
  } = useAccount();
  
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

  // Two-Factor Authentication Modal States
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState(1); // 1: current verification, 2: new method setup, 3: confirmation
  const [currentVerificationMethod, setCurrentVerificationMethod] = useState('email'); // 'email' or 'phone'
  const [currentVerificationValue, setCurrentVerificationValue] = useState('');
  const [currentVerificationOtp, setCurrentVerificationOtp] = useState('');
  const [newTwoFactorMethod, setNewTwoFactorMethod] = useState('email'); // 'email' or 'phone'
  const [newTwoFactorValue, setNewTwoFactorValue] = useState('');
  const [newTwoFactorOtp, setNewTwoFactorOtp] = useState('');

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
      listener: (event) => {
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
      Alert.alert(
        'Disable 2FA',
        'Are you sure you want to disable two-factor authentication?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Disable', 
            onPress: async () => {
              try {
                await updateSecurity({ twoFactorEnabled: false });
                setTwoFactorEnabled(false);
                Alert.alert('Success', '2FA disabled successfully!');
              } catch (error) {
                Alert.alert('Error', 'Failed to disable 2FA.');
              }
            }
          },
        ]
      );
    } else {
      setShowTwoFactorModal(true);
      setTwoFactorStep(1);
      setCurrentVerificationValue('');
      setCurrentVerificationOtp('');
      setNewTwoFactorValue('');
      setNewTwoFactorOtp('');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (__DEV__) console.log(`Copied ${label}:`, text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  // Password Reset Modal Handlers
  const handlePasswordResetNext = () => {
    if (passwordResetStep === 1) {
      if (!resetContactValue.trim()) {
        Alert.alert('Error', `Please enter your ${resetContactMethod}`);
        return;
      }
      // Simulate sending OTP
      Alert.alert('OTP Sent', `Verification code sent to your ${resetContactMethod}`);
      setPasswordResetStep(2);
    } else if (passwordResetStep === 2) {
      if (!resetOtp.trim() || resetOtp.length !== 6) {
        Alert.alert('Error', 'Please enter a valid 6-digit OTP');
        return;
      }
      setPasswordResetStep(3);
    } else if (passwordResetStep === 3) {
      if (!newPassword.trim() || newPassword.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      // Simulate password reset
      Alert.alert('Success', 'Password reset successfully!');
      setShowPasswordResetModal(false);
    }
  };

  const handlePasswordResetBack = () => {
    if (passwordResetStep > 1) {
      setPasswordResetStep(passwordResetStep - 1);
    }
  };

  // Two-Factor Authentication Modal Handlers
  const handleTwoFactorNext = () => {
    if (twoFactorStep === 1) {
      if (!currentVerificationValue.trim()) {
        Alert.alert('Error', `Please enter your ${currentVerificationMethod}`);
        return;
      }
      // Simulate sending OTP
      Alert.alert('OTP Sent', `Verification code sent to your ${currentVerificationMethod}`);
      setTwoFactorStep(2);
    } else if (twoFactorStep === 2) {
      if (!currentVerificationOtp.trim() || currentVerificationOtp.length !== 6) {
        Alert.alert('Error', 'Please enter a valid 6-digit OTP');
        return;
      }
      setTwoFactorStep(3);
    } else if (twoFactorStep === 3) {
      if (!newTwoFactorValue.trim()) {
        Alert.alert('Error', `Please enter your ${newTwoFactorMethod} for 2FA`);
        return;
      }
      // Simulate sending OTP for new method
      Alert.alert('OTP Sent', `Verification code sent to your new ${newTwoFactorMethod}`);
      setTwoFactorStep(4);
    } else if (twoFactorStep === 4) {
      if (!newTwoFactorOtp.trim() || newTwoFactorOtp.length !== 6) {
        Alert.alert('Error', 'Please enter a valid 6-digit OTP');
        return;
      }
      // Simulate enabling 2FA
      setTwoFactorEnabled(true);
      Alert.alert('Success', 'Two-Factor Authentication activated successfully!');
      setShowTwoFactorModal(false);
    }
  };

  const handleTwoFactorBack = () => {
    if (twoFactorStep > 1) {
      setTwoFactorStep(twoFactorStep - 1);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View 
        style={[
          styles.header, 
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            transform: [{ translateY: headerTranslateY }],
          }
        ]}
      >
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
      </Animated.View>

      <ScrollView 
        style={[styles.scrollView, { paddingTop: HEADER_HEIGHT }]} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
            {passwordResetStep > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={handlePasswordResetBack}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.nextButton} onPress={handlePasswordResetNext}>
              <Text style={styles.nextButtonText}>
                {passwordResetStep === 1 ? 'Send Code' : passwordResetStep === 2 ? 'Verify' : 'Reset Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Two-Factor Authentication Modal */}
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
            <Text style={styles.modalTitle}>Setup 2FA</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            {twoFactorStep === 1 && (
              <>
                <Text style={styles.modalDescription}>
                  First, verify your current email or phone number
                </Text>
                
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[styles.methodButton, currentVerificationMethod === 'email' && styles.methodButtonActive]}
                    onPress={() => setCurrentVerificationMethod('email')}
                  >
                    <Mail size={20} color={currentVerificationMethod === 'email' ? COLORS.textPrimary : COLORS.textSecondary} />
                    <Text style={[styles.methodText, currentVerificationMethod === 'email' && styles.methodTextActive]}>Email</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.methodButton, currentVerificationMethod === 'phone' && styles.methodButtonActive]}
                    onPress={() => setCurrentVerificationMethod('phone')}
                  >
                    <Phone size={20} color={currentVerificationMethod === 'phone' ? COLORS.textPrimary : COLORS.textSecondary} />
                    <Text style={[styles.methodText, currentVerificationMethod === 'phone' && styles.methodTextActive]}>Phone</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {currentVerificationMethod === 'email' ? 'Email Address' : 'Phone Number'}
                  </Text>
                  <View style={styles.inputContainer}>
                    {currentVerificationMethod === 'email' ? (
                      <Mail size={20} color={COLORS.textSecondary} />
                    ) : (
                      <Phone size={20} color={COLORS.textSecondary} />
                    )}
                    <TextInput
                      style={styles.input}
                      value={currentVerificationValue}
                      onChangeText={setCurrentVerificationValue}
                      placeholder={currentVerificationMethod === 'email' ? 'Enter your email' : 'Enter your phone number'}
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType={currentVerificationMethod === 'email' ? 'email-address' : 'phone-pad'}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </>
            )}

            {twoFactorStep === 2 && (
              <>
                <Text style={styles.modalDescription}>
                  Enter the verification code sent to your {currentVerificationMethod}
                </Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={currentVerificationOtp}
                      onChangeText={setCurrentVerificationOtp}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
              </>
            )}

            {twoFactorStep === 3 && (
              <>
                <Text style={styles.modalDescription}>
                  Choose your preferred method for two-factor authentication
                </Text>
                
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[styles.methodButton, newTwoFactorMethod === 'email' && styles.methodButtonActive]}
                    onPress={() => setNewTwoFactorMethod('email')}
                  >
                    <Mail size={20} color={newTwoFactorMethod === 'email' ? COLORS.textPrimary : COLORS.textSecondary} />
                    <Text style={[styles.methodText, newTwoFactorMethod === 'email' && styles.methodTextActive]}>Email</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.methodButton, newTwoFactorMethod === 'phone' && styles.methodButtonActive]}
                    onPress={() => setNewTwoFactorMethod('phone')}
                  >
                    <Phone size={20} color={newTwoFactorMethod === 'phone' ? COLORS.textPrimary : COLORS.textSecondary} />
                    <Text style={[styles.methodText, newTwoFactorMethod === 'phone' && styles.methodTextActive]}>Phone</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {newTwoFactorMethod === 'email' ? 'Email for 2FA' : 'Phone for 2FA'}
                  </Text>
                  <View style={styles.inputContainer}>
                    {newTwoFactorMethod === 'email' ? (
                      <Mail size={20} color={COLORS.textSecondary} />
                    ) : (
                      <Phone size={20} color={COLORS.textSecondary} />
                    )}
                    <TextInput
                      style={styles.input}
                      value={newTwoFactorValue}
                      onChangeText={setNewTwoFactorValue}
                      placeholder={newTwoFactorMethod === 'email' ? 'Enter email for 2FA' : 'Enter phone for 2FA'}
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType={newTwoFactorMethod === 'email' ? 'email-address' : 'phone-pad'}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </>
            )}

            {twoFactorStep === 4 && (
              <>
                <Text style={styles.modalDescription}>
                  Enter the verification code sent to your new {newTwoFactorMethod}
                </Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={newTwoFactorOtp}
                      onChangeText={setNewTwoFactorOtp}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                <View style={styles.successMessage}>
                  <Check size={24} color={COLORS.solana} />
                  <Text style={styles.successText}>
                    Almost done! Verify this code to activate 2FA
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.modalFooter}>
            {twoFactorStep > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={handleTwoFactorBack}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.nextButton} onPress={handleTwoFactorNext}>
              <Text style={styles.nextButtonText}>
                {twoFactorStep === 1 ? 'Send Code' : 
                 twoFactorStep === 2 ? 'Verify' : 
                 twoFactorStep === 3 ? 'Send Code' : 'Activate 2FA'}
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
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.solana,
    borderRadius: BORDER_RADIUS.small,
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
});