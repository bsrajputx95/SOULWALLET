import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Wallet,
  Key,
  Eye,
  EyeOff,
  Copy,
  Share2,
  Trash2,
  Shield,
  ExternalLink,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants';
import { NeonCard, ErrorBoundary, NeonButton } from '@/components';
import { 
  getLocalPublicKey, 
  clearWalletData, 
  api,
} from '@/services';
import { validateSession } from '@/utils';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
}

export default function SettingsScreen() {
  const router = useRouter();

  // State for user profile and wallet
  const [user, setUser] = useState<UserProfile | null>(null);
  const [solanaPublicKey, setSolanaPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);

  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Fetch user profile from backend
  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const data = await api.get<{ user: UserProfile }>('/me');
      setUser(data.user || data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  // Load local wallet public key
  const loadWalletKey = async () => {
    const pubKey = await getLocalPublicKey();
    setSolanaPublicKey(pubKey);
  };

  // Delete wallet function
  const deleteWallet = async () => {
    setWalletLoading(true);
    try {
      await clearWalletData();
      setSolanaPublicKey(null);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    void validateSession();
    fetchProfile();
    loadWalletKey();
  }, []);

  // Get wallet address from either Solana wallet store or user auth store
  const walletAddress = solanaPublicKey || null;
  const hasWallet = !!walletAddress;

  // Detect if wallet needs reconnection (has backend wallet but no local key)
  const needsReconnect = false; // Simplified - we rely on local wallet only now
  const isWalletUnlocked = !!solanaPublicKey;

  // Get wallet data from user or use fallback
  const walletData = {
    publicKey: walletAddress || 'No wallet connected',
    privateKey: isWalletUnlocked ? 'Encrypted - unlock to view' : 'Import required',
    mnemonic: 'Not available - created without mnemonic',
  };

  const handleRemoveWallet = () => {
    Alert.alert(
      '⚠️ Remove Wallet',
      'Are you sure you want to remove this wallet? Make sure you have backed up your private key. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet();
              Alert.alert('Success', 'Wallet removed successfully.');
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to remove wallet.');
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', `${label} copied to clipboard`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const shareWallet = async () => {
    try {
      const shareData = {
        title: 'My Wallet Address',
        text: `My Solana wallet address: ${walletData.publicKey}`,
        url: `solana:${walletData.publicKey}`,
      };

      // Use Web Share API if available, otherwise fallback to clipboard
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard and show alert
        await Clipboard.setStringAsync(shareData.text);
        Alert.alert(
          'Wallet Address Copied',
          'Your wallet address has been copied to clipboard',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error sharing:', error);
      // Fallback: copy to clipboard
      try {
        await Clipboard.setStringAsync(walletData.publicKey);
        Alert.alert(
          'Wallet Address Copied',
          'Your wallet address has been copied to clipboard',
          [{ text: 'OK' }]
        );
      } catch (clipboardError) {
        if (__DEV__) console.error('Failed to copy to clipboard:', clipboardError);
      }
    }
  };



  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: {
            ...FONTS.phantomBold,
            fontSize: 18,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ArrowLeft size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ),
          headerBackVisible: false,
        }}
      />

      <ErrorBoundary>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
        {/* User Info */}
        <NeonCard style={styles.userCard}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>@{user?.username || 'user'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          </View>
        </NeonCard>

        {/* Gating: prompt to create/import if no wallet */}
        {!hasWallet && (
          <NeonCard style={styles.warningCard}>
            <Text style={styles.warningTitle}>Wallet Not Connected</Text>
            <Text style={styles.warningText}>
              Add or import a wallet to access wallet settings and support.
            </Text>
            <View style={{ marginTop: SPACING.s }}>
              <NeonButton
                title="Create Wallet"
                onPress={() => router.push('/solana-setup')}
                icon={<Wallet size={20} color={COLORS.textPrimary} />}
              />
              <NeonButton
                title="Import Wallet"
                onPress={() => router.push('/solana-setup')}
                style={{ marginTop: SPACING.s }}
                icon={<Key size={20} color={COLORS.textPrimary} />}
              />
            </View>
          </NeonCard>
        )}

        {/* Wallet Needs Reconnection */}
        {needsReconnect && (
          <NeonCard style={[styles.warningCard, { backgroundColor: COLORS.warning + '10', borderColor: COLORS.warning + '30' }]}>
            <Text style={[styles.warningTitle, { color: COLORS.warning }]}>⚠️ Wallet Needs Reconnection</Text>
            <Text style={styles.warningText}>
              Your wallet address is saved, but you need to import your private key to access transactions.
            </Text>
            <View style={{ marginTop: SPACING.s }}>
              <NeonButton
                title="Import Private Key"
                onPress={() => router.push('/solana-setup')}
                icon={<Key size={20} color={COLORS.textPrimary} />}
              />
            </View>
          </NeonCard>
        )}

        {/* Wallet Section */}
        {hasWallet && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wallet Information</Text>

            <NeonCard style={styles.walletCard}>
              <View style={styles.walletItem}>
                <View style={styles.walletItemHeader}>
                  <Wallet size={20} color={COLORS.solana} />
                  <Text style={styles.walletItemTitle}>Public Key</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(walletData.publicKey, 'Public key')}
                    style={styles.copyButton}
                  >
                    <Copy size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.walletAddress}>
                  {walletData.publicKey.length > 16
                    ? `${walletData.publicKey.slice(0, 8)}...${walletData.publicKey.slice(-8)}`
                    : walletData.publicKey}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.walletItem}>
                <View style={styles.walletItemHeader}>
                  <Key size={20} color={COLORS.error} />
                  <Text style={styles.walletItemTitle}>Private Key</Text>
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
                    {showPrivateKey && (
                      <TouchableOpacity
                        onPress={() => copyToClipboard(walletData.privateKey, 'Private key')}
                        style={styles.copyButton}
                      >
                        <Copy size={16} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.walletAddress}>
                  {showPrivateKey
                    ? (walletData.privateKey.length > 16
                      ? `${walletData.privateKey.slice(0, 8)}...${walletData.privateKey.slice(-8)}`
                      : walletData.privateKey)
                    : '•••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.walletItem}>
                <View style={styles.walletItemHeader}>
                  <Key size={20} color={COLORS.binance} />
                  <Text style={styles.walletItemTitle}>Recovery Phrase</Text>
                  <View style={styles.walletActions}>
                    <TouchableOpacity
                      onPress={() => setShowMnemonic(!showMnemonic)}
                      style={styles.eyeButton}
                    >
                      {showMnemonic ? (
                        <EyeOff size={16} color={COLORS.textSecondary} />
                      ) : (
                        <Eye size={16} color={COLORS.textSecondary} />
                      )}
                    </TouchableOpacity>
                    {showMnemonic && (
                      <TouchableOpacity
                        onPress={() => copyToClipboard(walletData.mnemonic, 'Recovery phrase')}
                        style={styles.copyButton}
                      >
                        <Copy size={16} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.walletAddress}>
                  {showMnemonic
                    ? walletData.mnemonic
                    : '•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••'}
                </Text>
              </View>
            </NeonCard>

            <NeonButton
              title="Share Wallet Address"
              onPress={shareWallet}
              style={styles.shareButton}
              icon={<Share2 size={20} color={COLORS.textPrimary} />}
            />
            <TouchableOpacity
              style={[styles.supportItem, { borderColor: COLORS.error + '30', borderWidth: 1, marginTop: SPACING.s }]}
              onPress={handleRemoveWallet}
              disabled={walletLoading}
            >
              <Trash2 size={20} color={COLORS.error} />
              <Text style={[styles.supportText, { color: COLORS.error }]}>Remove Wallet</Text>
            </TouchableOpacity>
          </View>
        )}



        {/* Privacy & Data Section - Available to all authenticated users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Data</Text>
          <TouchableOpacity
            style={styles.supportItem}
            onPress={() => router.push('/account')}
          >
            <Shield size={20} color={COLORS.textSecondary} />
            <Text style={styles.supportText}>Account & Privacy Settings</Text>
            <ExternalLink size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>



        {/* Warning */}
        {hasWallet && (
          <NeonCard style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Security Warning</Text>
            <Text style={styles.warningText}>
              Never share your private key or recovery phrase with anyone. Soul Wallet will never ask for this information.
            </Text>
          </NeonCard>
        )}
      </ScrollView>
      </ErrorBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.s,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.m,
    paddingBottom: 20,
  },
  userCard: {
    marginBottom: SPACING.l,
  },
  userInfo: {
    padding: SPACING.m,
    alignItems: 'center',
  },
  userName: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 20,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.m,
  },
  walletCard: {
    marginBottom: SPACING.m,
  },
  walletItem: {
    padding: SPACING.m,
  },
  walletItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  walletItemTitle: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: SPACING.s,
    flex: 1,
  },
  walletActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeButton: {
    padding: SPACING.xs,
    marginRight: SPACING.xs,
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
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBackground,
    marginVertical: SPACING.xs,
  },
  shareButton: {
    marginTop: SPACING.s,
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  supportText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  warningCard: {
    backgroundColor: COLORS.error + '10',
    borderColor: COLORS.error + '30',
    borderWidth: 1,
  },
  warningTitle: {
    ...FONTS.phantomBold,
    color: COLORS.error,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  warningText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});

