import { useState, useEffect } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { trpc } from '../lib/trpc';
import { logger } from '../lib/client-logger';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  profileImage?: string;
  defaultCurrency?: string;
  language?: string;
  twoFactorEnabled?: boolean;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SecuritySettings {
  userId: string;
  twoFactorEnabled: boolean;
  lastPasswordChange: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  recoveryEmail?: string;
  backupCodes?: string[];
}

interface WalletInfo {
  publicKey: string;
  walletType: 'solana' | 'ethereum';
  isBackedUp: boolean;
  createdAt: Date;
}

export const [AccountProvider, useAccount] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // @ts-ignore - Mock tRPC queries for development
  const profileQuery = trpc.account.getUserProfile.useQuery();
  // @ts-ignore - Mock tRPC queries for development
  const securityQuery = trpc.account.getSecuritySettings.useQuery();
  // @ts-ignore - Mock tRPC queries for development
  const walletQuery = trpc.account.getWalletInfo.useQuery();

  // @ts-ignore - Mock tRPC mutations for development
  const updateProfileMutation = trpc.account.updateUserProfile.useMutation();
  // @ts-ignore - Mock tRPC mutations for development
  const updateSecurityMutation = trpc.account.updateSecuritySettings.useMutation();
  // @ts-ignore - Mock tRPC mutations for development
  const resetPasswordMutation = trpc.account.resetPassword.useMutation();
  // @ts-ignore - Mock tRPC mutations for development
  const getPrivateKeyMutation = trpc.account.getWalletPrivateKey.useMutation();
  // @ts-ignore - Mock tRPC mutations for development
  const getRecoveryPhraseMutation = trpc.account.getWalletRecoveryPhrase.useMutation();
  // @ts-ignore - Mock tRPC mutations for development
  const generateBackupCodesMutation = trpc.account.generateBackupCodes.useMutation();
  // @ts-ignore - Mock tRPC mutations for development
  const uploadImageMutation = trpc.account.uploadProfileImage.useMutation();
  // @ts-ignore - Mock tRPC mutations for development
  const deleteAccountMutation = trpc.account.deleteAccount.useMutation();

  // Update local state when queries complete
  useEffect(() => {
    if (profileQuery.data) {
      setProfile({
        ...profileQuery.data,
        createdAt: new Date(profileQuery.data.createdAt),
        updatedAt: new Date(profileQuery.data.updatedAt),
      });
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (securityQuery.data) {
      setSecuritySettings({
        ...securityQuery.data,
        lastPasswordChange: new Date(securityQuery.data.lastPasswordChange),
        lockedUntil: securityQuery.data.lockedUntil ? new Date(securityQuery.data.lockedUntil) : undefined,
      });
    }
  }, [securityQuery.data]);

  useEffect(() => {
    if (walletQuery.data) {
      setWalletInfo({
        ...walletQuery.data,
        createdAt: new Date(walletQuery.data.createdAt),
      });
    }
  }, [walletQuery.data]);

  useEffect(() => {
    const loading = profileQuery.isLoading || securityQuery.isLoading || walletQuery.isLoading;
    setIsLoading(loading);
  }, [profileQuery.isLoading, securityQuery.isLoading, walletQuery.isLoading]);

  useEffect(() => {
    const updating = updateProfileMutation.isPending || 
                    updateSecurityMutation.isPending || 
                    resetPasswordMutation.isPending ||
                    uploadImageMutation.isPending ||
                    deleteAccountMutation.isPending;
    setIsUpdating(updating);
  }, [
    updateProfileMutation.isPending,
    updateSecurityMutation.isPending,
    resetPasswordMutation.isPending,
    uploadImageMutation.isPending,
    deleteAccountMutation.isPending
  ]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      const result = await updateProfileMutation.mutateAsync(data);
      if (result.success && result.profile) {
        setProfile({
          ...result.profile,
          createdAt: new Date(result.profile.createdAt),
          updatedAt: new Date(result.profile.updatedAt),
        });
        // Refetch to ensure consistency
        profileQuery.refetch();
      }
      return result;
    } catch (error) {
      logger.error('Failed to update profile:', error);
      throw error;
    }
  };

  const updateSecurity = async (data: { twoFactorEnabled?: boolean; recoveryEmail?: string }) => {
    try {
      const result = await updateSecurityMutation.mutateAsync(data);
      if (result.success && result.settings) {
        setSecuritySettings({
          ...result.settings,
          lastPasswordChange: new Date(result.settings.lastPasswordChange),
          lockedUntil: result.settings.lockedUntil ? new Date(result.settings.lockedUntil) : undefined,
        });
        // Also update profile if 2FA status changed
        if (data.twoFactorEnabled !== undefined && profile) {
          setProfile({
            ...profile,
            twoFactorEnabled: data.twoFactorEnabled,
            updatedAt: new Date(),
          });
        }
        securityQuery.refetch();
      }
      return result;
    } catch (error) {
      logger.error('Failed to update security settings:', error);
      throw error;
    }
  };

  const resetPassword = async (currentPassword: string, newPassword: string) => {
    try {
      const result = await resetPasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
      securityQuery.refetch();
      return result;
    } catch (error) {
      logger.error('Failed to reset password:', error);
      throw error;
    }
  };

  const getWalletPrivateKey = async (password: string) => {
    try {
      const result = await getPrivateKeyMutation.mutateAsync({ password });
      return result;
    } catch (error) {
      logger.error('Failed to get private key:', error);
      throw error;
    }
  };

  const getWalletRecoveryPhrase = async (password: string) => {
    try {
      const result = await getRecoveryPhraseMutation.mutateAsync({ password });
      return result;
    } catch (error) {
      logger.error('Failed to get recovery phrase:', error);
      throw error;
    }
  };

  const generateBackupCodes = async () => {
    try {
      const result = await generateBackupCodesMutation.mutateAsync();
      securityQuery.refetch();
      return result;
    } catch (error) {
      logger.error('Failed to generate backup codes:', error);
      throw error;
    }
  };

  const uploadProfileImage = async (imageBase64: string, mimeType: string) => {
    try {
      const result = await uploadImageMutation.mutateAsync({
        imageBase64,
        mimeType,
      });
      if (result.success && profile) {
        setProfile({
          ...profile,
          profileImage: result.imageUrl,
          updatedAt: new Date(),
        });
        profileQuery.refetch();
      }
      return result;
    } catch (error) {
      logger.error('Failed to upload profile image:', error);
      throw error;
    }
  };

  const deleteAccount = async (password: string, confirmText: string) => {
    try {
      const result = await deleteAccountMutation.mutateAsync({
        password,
        confirmText,
      });
      if (result.success) {
        // Clear all local state
        setProfile(null);
        setSecuritySettings(null);
        setWalletInfo(null);
      }
      return result;
    } catch (error) {
      logger.error('Failed to delete account:', error);
      throw error;
    }
  };

  const refreshData = () => {
    profileQuery.refetch();
    securityQuery.refetch();
    walletQuery.refetch();
  };

  return {
    // State
    profile,
    securitySettings,
    walletInfo,
    isLoading,
    isUpdating,
    
    // Actions
    updateProfile,
    updateSecurity,
    resetPassword,
    getWalletPrivateKey,
    getWalletRecoveryPhrase,
    generateBackupCodes,
    uploadProfileImage,
    deleteAccount,
    refreshData,
    
    // Query states for individual operations
    isUpdatingProfile: updateProfileMutation.isPending,
    isUpdatingSecurity: updateSecurityMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
    isGettingPrivateKey: getPrivateKeyMutation.isPending,
    isGettingRecoveryPhrase: getRecoveryPhraseMutation.isPending,
    isGeneratingBackupCodes: generateBackupCodesMutation.isPending,
    isUploadingImage: uploadImageMutation.isPending,
    isDeletingAccount: deleteAccountMutation.isPending,
    
    // Errors
    profileError: profileQuery.error,
    securityError: securityQuery.error,
    walletError: walletQuery.error,
    updateProfileError: updateProfileMutation.error,
    updateSecurityError: updateSecurityMutation.error,
    resetPasswordError: resetPasswordMutation.error,
    privateKeyError: getPrivateKeyMutation.error,
    recoveryPhraseError: getRecoveryPhraseMutation.error,
    backupCodesError: generateBackupCodesMutation.error,
    uploadImageError: uploadImageMutation.error,
    deleteAccountError: deleteAccountMutation.error,
  };
});
