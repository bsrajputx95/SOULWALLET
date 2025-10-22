import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Lock,
  Users,
  Camera,
  Globe,
  Languages,
  ShieldCheck,
  DollarSign,
  Settings,
  Copy,
  Eye,
  EyeOff,
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
  const [ibuyAmount, setIbuyAmount] = useState('100');
  const [ibuySlippage, setIbuySlippage] = useState('1');

  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);

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

  const handleResetPassword = () => {
    Alert.alert(
      'Reset Password',
      'Enter your current password and new password.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          onPress: async () => {
            try {
              // In a real app, you'd show a modal to get current and new passwords
              await resetUserPassword('currentPassword', 'newPassword');
              Alert.alert('Success', 'Password updated successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset password.');
            }
          }
        },
      ]
    );
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
      Alert.alert(
        'Setup 2FA',
        'Two-factor authentication will be set up using your authenticator app.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Setup', 
            onPress: async () => {
              try {
                await updateSecurity({ twoFactorEnabled: true });
                setTwoFactorEnabled(true);
                Alert.alert('Success', '2FA enabled successfully!');
              } catch (error) {
                Alert.alert('Error', 'Failed to enable 2FA.');
              }
            }
          },
        ]
      );
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (__DEV__) console.log(`Copied ${label}:`, text);
    Alert.alert('Copied', `${label} copied to clipboard`);
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

        {/* Wallet Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet Information</Text>
          
          <View style={styles.walletInfoCard}>
            <View style={styles.walletInfoRow}>
              <View style={styles.walletInfoLabel}>
                <Shield size={20} color={COLORS.solana} />
                <Text style={styles.walletInfoText}>Public Key</Text>
              </View>
              <TouchableOpacity 
                onPress={() => copyToClipboard(profile?.walletAddress || walletInfo?.publicKey || '', 'Public Key')}
                style={styles.copyButton}
              >
                <Copy size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.walletAddress}>{profile?.walletAddress || walletInfo?.publicKey || 'Not connected'}</Text>
          </View>

          <View style={styles.walletInfoCard}>
            <View style={styles.walletInfoRow}>
              <View style={styles.walletInfoLabel}>
                <Lock size={20} color={COLORS.error} />
                <Text style={styles.walletInfoText}>Private Key</Text>
              </View>
              <View style={styles.walletActions}>
                <TouchableOpacity 
                  onPress={() => setShowPrivateKey(!showPrivateKey)}
                  style={styles.eyeButton}
                >
                  {showPrivateKey ? (
                    <EyeOff size={16} color={COLORS.textSecondary} />
                  ) : (
                    <Eye size={16} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => copyToClipboard('••••••••••••••••', 'Private Key')}
                  style={styles.copyButton}
                >
                  <Copy size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.walletAddress}>
              {showPrivateKey ? 'H97G48qL...HHE4YMFH' : '••••••••••••••••••••••••••••••••'}
            </Text>
          </View>

          <View style={styles.walletInfoCard}>
            <View style={styles.walletInfoRow}>
              <View style={styles.walletInfoLabel}>
                <Settings size={20} color={COLORS.warning} />
                <Text style={styles.walletInfoText}>Recovery Phrase</Text>
              </View>
              <View style={styles.walletActions}>
                <TouchableOpacity 
                  onPress={() => setShowRecoveryPhrase(!showRecoveryPhrase)}
                  style={styles.eyeButton}
                >
                  {showRecoveryPhrase ? (
                    <EyeOff size={16} color={COLORS.textSecondary} />
                  ) : (
                    <Eye size={16} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => copyToClipboard('word1 word2 word3...', 'Recovery Phrase')}
                  style={styles.copyButton}
                >
                  <Copy size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.recoveryPhrase}>
              {showRecoveryPhrase 
                ? 'abandon ability able about above absent absorb abstract absurd abuse access accident'
                : '••• ••• ••• ••• ••• ••• ••• ••• ••• ••• ••• •••'
              }
            </Text>
          </View>

          <TouchableOpacity style={styles.shareWalletButton}>
            <LinearGradient
              colors={[COLORS.solana, COLORS.solana + '80']}
              style={styles.shareWalletGradient}
            >
              <Text style={styles.shareWalletText}>SHARE WALLET ADDRESS</Text>
            </LinearGradient>
          </TouchableOpacity>
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

        {/* IBuy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IBuy Trade Settings</Text>
          <Text style={styles.sectionDescription}>
            Configure default settings for IBuy trades that appear below posts
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Default Amount (USDC)</Text>
            <View style={styles.inputContainer}>
              <DollarSign size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="100"
                placeholderTextColor={COLORS.textSecondary}
                value={ibuyAmount}
                onChangeText={setIbuyAmount}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Slippage (%)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.percentSymbol}>%</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                placeholderTextColor={COLORS.textSecondary}
                value={ibuySlippage}
                onChangeText={setIbuySlippage}
                keyboardType="numeric"
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
  walletInfoCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  walletInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  walletInfoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletInfoText: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  walletActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeButton: {
    padding: SPACING.xs,
    marginRight: SPACING.s,
  },
  copyButton: {
    padding: SPACING.xs,
  },
  walletAddress: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  recoveryPhrase: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  shareWalletButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginTop: SPACING.m,
  },
  shareWalletGradient: {
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  shareWalletText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
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
});