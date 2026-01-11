import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { User, Mail, Phone, Calendar, Camera } from 'lucide-react-native';

import { COLORS } from '../../constants/colors';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import { SkeletonLoader } from '../SkeletonLoader';

type ProfileLike = {
  username?: string | null;
  profileImage?: string | null;
} | null;

export function ProfileForm(props: {
  styles: any;
  profile: ProfileLike;
  isLoading: boolean;
  isUploadingImage: boolean;
  isProcessingImage: boolean;
  onPickImage: () => void;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setEmail: (value: string) => void;
  setPhone: (value: string) => void;
  setDateOfBirth: (value: string) => void;
}) {
  const {
    styles,
    profile,
    isLoading,
    isUploadingImage,
    isProcessingImage,
    onPickImage,
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setDateOfBirth,
  } = props;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Profile Information</Text>

      {isLoading ? (
        <>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImageWrapper}>
              <SkeletonLoader width={100} height={100} borderRadius={50} />
            </View>
            <SkeletonLoader width={80} height={12} style={{ marginTop: SPACING.xs }} />
          </View>

          <View style={styles.inputGroup}>
            <SkeletonLoader width={90} height={12} style={{ marginBottom: SPACING.xs }} />
            <SkeletonLoader width="100%" height={48} borderRadius={BORDER_RADIUS.medium} />
          </View>

          <View style={styles.inputGroup}>
            <SkeletonLoader width={90} height={12} style={{ marginBottom: SPACING.xs }} />
            <SkeletonLoader width="100%" height={48} borderRadius={BORDER_RADIUS.medium} />
          </View>

          <View style={styles.inputGroup}>
            <SkeletonLoader width={60} height={12} style={{ marginBottom: SPACING.xs }} />
            <SkeletonLoader width="100%" height={48} borderRadius={BORDER_RADIUS.medium} />
          </View>

          <View style={styles.inputGroup}>
            <SkeletonLoader width={110} height={12} style={{ marginBottom: SPACING.xs }} />
            <SkeletonLoader width="100%" height={48} borderRadius={BORDER_RADIUS.medium} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.profileImageContainer}>
            <TouchableOpacity
              testID="account-profile-image-button"
              style={styles.profileImageWrapper}
              onPress={onPickImage}
              disabled={isUploadingImage || isProcessingImage}
            >
              {isUploadingImage || isProcessingImage ? (
                <View style={styles.defaultProfileImage}>
                  <ActivityIndicator size="large" color={COLORS.solana} />
                </View>
              ) : profile?.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.defaultProfileImage}>
                  <Text style={styles.profileImageText}>
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <View style={styles.cameraButton}>
                <Camera size={16} color={COLORS.textPrimary} />
              </View>
            </TouchableOpacity>
            <Text style={styles.profileImageLabel}>Tap to change</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <View style={styles.inputContainer}>
              <User size={20} color={COLORS.textSecondary} />
              <TextInput
                testID="account-first-name-input"
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
                testID="account-last-name-input"
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
                testID="account-email-input"
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
                testID="account-phone-input"
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
                testID="account-dob-input"
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textSecondary}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

