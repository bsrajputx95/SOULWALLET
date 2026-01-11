import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Lock, Check, Mail, Phone, ShieldCheck } from 'lucide-react-native';

import { COLORS } from '../../constants/colors';
import { SPACING } from '../../constants/theme';

export function SecurityModal(props: {
  styles: any;
  showPasswordResetModal: boolean;
  setShowPasswordResetModal: (value: boolean) => void;
  passwordResetStep: number;
  resetContactMethod: string;
  setResetContactMethod: (value: string) => void;
  resetContactValue: string;
  setResetContactValue: (value: string) => void;
  resetOtp: string;
  setResetOtp: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  isPasswordResetLoading: boolean;
  handlePasswordResetBack: () => void;
  handlePasswordResetNext: () => void;

  showTwoFactorModal: boolean;
  setShowTwoFactorModal: (value: boolean) => void;
  twoFactorStep: number;
  totpPassword: string;
  setTotpPassword: (value: string) => void;
  totpQrCode: string;
  totpBackupCodes: string[];
  totpVerifyCode: string;
  setTotpVerifyCode: (value: string) => void;
  isTwoFactorLoading: boolean;
  handleTwoFactorBack: () => void;
  handleTwoFactorNext: () => void;
}) {
  const {
    styles,
    showPasswordResetModal,
    setShowPasswordResetModal,
    passwordResetStep,
    resetContactMethod,
    setResetContactMethod,
    resetContactValue,
    setResetContactValue,
    resetOtp,
    setResetOtp,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isPasswordResetLoading,
    handlePasswordResetBack,
    handlePasswordResetNext,
    showTwoFactorModal,
    setShowTwoFactorModal,
    twoFactorStep,
    totpPassword,
    setTotpPassword,
    totpQrCode,
    totpBackupCodes,
    totpVerifyCode,
    setTotpVerifyCode,
    isTwoFactorLoading,
    handleTwoFactorBack,
    handleTwoFactorNext,
  } = props;

  return (
    <>
      <Modal
        visible={showPasswordResetModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasswordResetModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 48 : 0}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPasswordResetModal(false)}>
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              {passwordResetStep === 1 && (
                <>
                  <Text style={styles.modalDescription}>
                    Enter your email address to receive a verification code
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
                    <Text style={styles.inputLabel}>{resetContactMethod === 'email' ? 'Email Address' : 'Phone Number'}</Text>
                    <View style={styles.inputContainer}>
                      {resetContactMethod === 'email' ? (
                        <Mail size={20} color={COLORS.textSecondary} />
                      ) : (
                        <Phone size={20} color={COLORS.textSecondary} />
                      )}
                      <TextInput
                        testID="password-reset-contact-input"
                        style={styles.input}
                        value={resetContactValue}
                        onChangeText={setResetContactValue}
                        placeholder={resetContactMethod === 'email' ? 'Enter your email' : 'Enter your phone'}
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
                        testID="password-reset-otp-input"
                        style={styles.input}
                        value={resetOtp}
                        onChangeText={setResetOtp}
                        placeholder="Enter OTP"
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
                        testID="password-reset-new-password-input"
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
                        testID="password-reset-confirm-password-input"
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
            </ScrollView>

            <View style={styles.modalFooter}>
              {passwordResetStep > 1 && !isPasswordResetLoading && (
                <TouchableOpacity style={styles.backButton} onPress={handlePasswordResetBack}>
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                testID="password-reset-next-button"
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showTwoFactorModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTwoFactorModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 48 : 0}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTwoFactorModal(false)}>
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Setup Authenticator App</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
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
                        testID="totp-password-input"
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
                    <View testID="totp-qr-code" style={styles.qrCodeContainer}>
                      <Image source={{ uri: totpQrCode }} style={styles.qrCode} />
                    </View>
                  ) : null}
                </>
              )}

              {twoFactorStep === 3 && (
                <>
                  <Text style={styles.modalDescription}>
                    Enter the 6-digit code from your authenticator app to enable 2FA
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Verification Code</Text>
                    <View style={styles.inputContainer}>
                      <ShieldCheck size={20} color={COLORS.textSecondary} />
                      <TextInput
                        testID="totp-verify-code-input"
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
                    <Text style={styles.successText}>2FA is now enabled!</Text>
                  </View>

                  <Text style={styles.modalDescription}>
                    Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                  </Text>

                  <View testID="backup-codes-container" style={styles.backupCodesContainer}>
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
                testID={twoFactorStep === 4 ? "totp-finish-button" : "totp-next-button"}
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
