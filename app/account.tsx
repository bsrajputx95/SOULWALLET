import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import {
  Languages,
  DollarSign,
  X,
  Trash2,
  Lock,
  Users,
} from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

import { SkeletonLoader } from '../components/SkeletonLoader';
import { ProfileForm } from '../components/account/ProfileForm';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Profile type from backend
interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  profileImage: string | null;
  currency: string;
  language: string;
  createdAt: string;
}

export default function AccountScreen() {
  const router = useRouter();

  // Real profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountUpdating, setIsAccountUpdating] = useState(false);

  // Fetch profile from backend
  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (json.success) {
        setProfile(json.user);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Real update profile handler
  const updateProfile = async (data: any) => {
    try {
      setIsAccountUpdating(true);
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
          phone: data.phone || undefined,
          dateOfBirth: data.dateOfBirth || undefined,
          profileImage: data.profileImage || undefined,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to update profile');
      }

      setProfile(json.user);
      return json;
    } catch (error: any) {
      throw error;
    } finally {
      setIsAccountUpdating(false);
    }
  };

  const uploadProfileImage = async (_base64: string, _mimeType: string) => {
    Alert.alert('🚧 Coming Soon', 'Image upload to cloud storage is not configured yet. Store the URL directly for now.');
    return { success: false };
  };
  const isUploadingImage = false;

  // Real delete account handler
  const deleteAccountMutation = {
    mutateAsync: async (params: { password: string }) => {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/account/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: params.password }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to delete account');
      }

      // Clear local storage
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user_data');

      // Navigate to login
      router.replace('/(auth)/login');

      return json;
    },
    isPending: false,
  };

  // Password reset handler
  const handleResetPassword = () => {
    Alert.prompt(
      'Reset Password',
      'Enter your current password:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Next',
          onPress: (currentPassword: string | undefined) => {
            if (!currentPassword) {
              Alert.alert('Error', 'Please enter your current password');
              return;
            }
            Alert.prompt(
              'New Password',
              'Enter your new password (min 6 characters):',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Update',
                  onPress: async (newPassword: string | undefined) => {
                    if (!newPassword || newPassword.length < 6) {
                      Alert.alert('Error', 'Password must be at least 6 characters');
                      return;
                    }
                    try {
                      const token = await SecureStore.getItemAsync('token');
                      const response = await fetch(`${API_URL}/auth/reset-password`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          currentPassword,
                          newPassword,
                        }),
                      });
                      const json = await response.json();
                      if (response.ok) {
                        Alert.alert('✅ Password Changed', 'Your password has been updated successfully');
                      } else {
                        Alert.alert('Error', json.error || 'Failed to update password');
                      }
                    } catch (error: any) {
                      Alert.alert('Error', error.message || 'Failed to update password');
                    }
                  },
                },
              ],
              'secure-text'
            );
          },
        },
      ],
      'secure-text'
    );
  };

  // Initialize form fields with empty strings - useEffect will populate when profile loads
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [language, setLanguage] = useState('English');


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
      setDefaultCurrency(profile.currency || 'USD');
      setLanguage(profile.language || 'English');
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



  const handleSave = async () => {
    try {
      // Validate email format
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          Alert.alert('Invalid Email', 'Please enter a valid email address');
          return;
        }
      }

      // Validate phone (basic check - optional)
      if (phone && phone.length > 0) {
        const phoneRegex = /^[+]?[\d\s()-]{7,20}$/;
        if (!phoneRegex.test(phone)) {
          Alert.alert('Invalid Phone', 'Please enter a valid phone number');
          return;
        }
      }

      // Validate date of birth (YYYY-MM-DD, past date)
      if (dateOfBirth) {
        const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dobRegex.test(dateOfBirth)) {
          Alert.alert('Invalid Date', 'Date of birth must be YYYY-MM-DD format');
          return;
        }
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime()) || dob >= new Date()) {
          Alert.alert('Invalid Date', 'Date of birth must be a past date');
          return;
        }
      }

      // Validate name lengths (1-50 chars)
      if (firstName && (firstName.length < 1 || firstName.length > 50)) {
        Alert.alert('Invalid Name', 'First name must be 1-50 characters');
        return;
      }
      if (lastName && (lastName.length < 1 || lastName.length > 50)) {
        Alert.alert('Invalid Name', 'Last name must be 1-50 characters');
        return;
      }

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

      Alert.alert('✅ Profile Updated', 'Your account settings have been saved.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update settings. Please try again.');
    }
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



  // Render guard: Show loading state until profile is available
  if (isLoading || profile === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account Settings</Text>
          <View style={[styles.saveButton, styles.saveButtonDisabled]}>
            <Text style={styles.saveButtonText}>Save</Text>
          </View>
        </View>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Section Skeleton */}
          <View style={styles.section}>
            <View style={styles.profileImageContainer}>
              <SkeletonLoader width={80} height={80} borderRadius={40} />
              <SkeletonLoader width={100} height={14} style={{ marginTop: SPACING.s }} />
            </View>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.inputGroup}>
                <SkeletonLoader width={100} height={14} style={{ marginBottom: SPACING.s }} />
                <SkeletonLoader width="100%" height={48} borderRadius={BORDER_RADIUS.medium} />
              </View>
            ))}
          </View>
          {/* Security Section Skeleton */}
          <View style={styles.section}>
            <SkeletonLoader width={150} height={18} style={{ marginBottom: SPACING.s }} />
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
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          isLoading={false}
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

          <TouchableOpacity style={styles.settingRow} onPress={handleResetPassword}>
            <View style={styles.settingLeft}>
              <Lock size={20} color={COLORS.textSecondary} />
              <Text style={styles.settingText}>Reset Password</Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>


        </View>

        {/* App Settings - Fixed Dummy Values */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <DollarSign size={20} color={COLORS.textSecondary} />
              <Text style={styles.settingText}>Default Currency</Text>
            </View>
            <Text style={styles.settingValue}>USD</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Languages size={20} color={COLORS.textSecondary} />
              <Text style={styles.settingText}>Language</Text>
            </View>
            <Text style={styles.settingValue}>English</Text>
          </View>
        </View>



        {/* Social - Dummy for now */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>

          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Invite Friends', 'This feature is coming soon!')}>
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
    paddingHorizontal: SPACING.m,
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
    paddingHorizontal: SPACING.m,
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
  settingValue: {
    ...FONTS.phantomMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
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

