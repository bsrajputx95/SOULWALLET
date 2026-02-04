import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, Key, ArrowLeft, Eye, EyeOff, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import bs58 from 'bs58';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { VALIDATION } from '../constants/validation';
import { createWallet, importWallet, decryptWalletSecret } from '../services/wallet';
import { showSuccessToast, showErrorToast } from '../utils/toast';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isSmallScreen = screenWidth < 375;
const isWeb = Platform.OS === 'web';

// Responsive dimensions
const getResponsiveSize = (base: number) => {
  if (isTablet) return base * 1.2;
  if (isSmallScreen) return base * 0.9;
  return base;
};

const getResponsiveSpacing = (spacing: number) => {
  if (isTablet) return spacing * 1.3;
  if (isSmallScreen) return spacing * 0.8;
  return spacing;
};

const getResponsiveFontSize = (size: number) => {
  if (isTablet) return size * 1.15;
  if (isSmallScreen) return size * 0.95;
  return size;
};

export default function SolanaSetupScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'import' | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [generatedWallet, setGeneratedWallet] = useState<any>(null);
  const [walletPassword, setWalletPassword] = useState('');
  const [confirmWalletPassword, setConfirmWalletPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleCreateWallet = async () => {
    try {
      if (!walletPassword || walletPassword !== confirmWalletPassword) {
        Alert.alert('Error', 'Please enter and confirm your wallet PIN (4-6 digits)');
        return;
      }
      // Numeric-only check
      if (!VALIDATION.PIN.PATTERN.test(walletPassword)) {
        Alert.alert('Error', 'PIN must contain only digits (0-9)');
        return;
      }
      if (walletPassword.length < VALIDATION.PIN.MIN_LENGTH) {
        Alert.alert('Error', `PIN must be at least ${VALIDATION.PIN.MIN_LENGTH} digits`);
        return;
      }
      if (walletPassword.length > VALIDATION.PIN.MAX_LENGTH) {
        Alert.alert('Error', `PIN must not exceed ${VALIDATION.PIN.MAX_LENGTH} digits`);
        return;
      }

      setIsLoading(true);

      // Get auth token from SecureStore
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        Alert.alert('Error', 'Please log in first');
        setIsLoading(false);
        return;
      }

      // Call real createWallet from wallet service
      const result = await createWallet(token, walletPassword);

      setIsLoading(false);

      if (result.success && result.publicKey) {
        // Decrypt the stored secret key with PIN for display
        const secretKey = await decryptWalletSecret(walletPassword);

        if (secretKey) {
          setGeneratedWallet({
            publicKey: result.publicKey,
            secretKey: secretKey,
          });
          setMode('create');
          showSuccessToast('Wallet created successfully!');
          Alert.alert('✅ Wallet Created!', 'Save your private key in a secure location.');
        } else {
          // Could not decrypt - show success but hide copy controls
          setGeneratedWallet({
            publicKey: result.publicKey,
            secretKey: null, // Will hide private key display
          });
          setMode('create');
          showSuccessToast('Wallet created successfully!');
          Alert.alert('✅ Wallet Created!', 'Wallet created. Private key is securely stored.');
        }
      } else {
        showErrorToast(result.error || 'Failed to create wallet');
        Alert.alert('Error', result.error || 'Failed to create wallet');
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Failed to create wallet');
      if (__DEV__) console.error('Create wallet error:', error);
    }
  };

  const handleImportWallet = async () => {
    const trimmedKey = privateKey.trim();
    if (!trimmedKey) {
      Alert.alert('Error', 'Please enter a private key');
      return;
    }
    // Base58 format validation
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(trimmedKey)) {
      Alert.alert('Error', '❌ Invalid private key format (must be base58)');
      return;
    }
    // Length check (Solana private keys are typically 64-88 chars in base58)
    if (trimmedKey.length < 64 || trimmedKey.length > 88) {
      Alert.alert('Error', 'Invalid private key length');
      return;
    }
    if (!walletPassword || walletPassword !== confirmWalletPassword) {
      Alert.alert('Error', 'Please enter and confirm your wallet PIN (4-6 digits)');
      return;
    }
    // Numeric-only check
    if (!/^\d+$/.test(walletPassword)) {
      Alert.alert('Error', 'PIN must contain only digits (0-9)');
      return;
    }
    if (walletPassword.length < 4 || walletPassword.length > 6) {
      Alert.alert('Error', 'PIN must be 4-6 digits');
      return;
    }

    setIsLoading(true);

    try {
      // Get auth token from SecureStore
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        Alert.alert('Error', 'Please log in first');
        setIsLoading(false);
        return;
      }

      // Call real importWallet from wallet service
      const result = await importWallet(token, privateKey.trim(), walletPassword);

      setIsLoading(false);

      if (result.success) {
        showSuccessToast('Wallet imported!');
        Alert.alert('✅ Wallet Imported', 'Wallet imported and linked successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        showErrorToast(result.error || 'Import failed');
        Alert.alert('Error', result.error || 'Failed to import wallet');
      }
    } catch (error: any) {
      setIsLoading(false);
      showErrorToast('Invalid private key');
      Alert.alert('Error', 'Invalid private key. Please check and try again.');

    }
  };

  const handleCopyPrivateKey = async () => {
    if (generatedWallet && generatedWallet.secretKey) {
      const privateKeyString = bs58.encode(generatedWallet.secretKey);
      await Clipboard.setStringAsync(privateKeyString);
      Alert.alert('Copied!', 'Private key copied to clipboard');
    } else {
      Alert.alert('Error', 'Private key not available');
    }
  };

  const handleFinishSetup = () => {
    Alert.alert(
      'Wallet Created!',
      'Your Solana wallet has been created successfully. Make sure to save your private key in a secure location.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  if (mode === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Solana Wallet Setup</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.welcomeSection}>
            <View style={styles.iconContainer}>
              <Wallet size={60} color={COLORS.solana} />
            </View>
            <Text style={styles.welcomeTitle}>Set up your Solana Wallet</Text>
            <Text style={styles.welcomeDescription}>
              Create a new wallet or import an existing one to start using Solana features
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Wallet Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter a strong password"
                placeholderTextColor={COLORS.textSecondary}
                value={walletPassword}
                onChangeText={setWalletPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color={COLORS.textSecondary} />
                ) : (
                  <Eye size={20} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Re-enter password"
                placeholderTextColor={COLORS.textSecondary}
                value={confirmWalletPassword}
                onChangeText={setConfirmWalletPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={handleCreateWallet}
              disabled={isLoading || !walletPassword || walletPassword !== confirmWalletPassword}
            >
              <LinearGradient
                colors={[COLORS.solana + '20', COLORS.solana + '10']}
                style={styles.optionGradient}
              >
                <View style={styles.optionIcon}>
                  <Wallet size={32} color={COLORS.solana} />
                </View>
                <Text style={styles.optionTitle}>Create New Wallet</Text>
                <Text style={styles.optionDescription}>
                  Generate a new Solana wallet with a secure private key
                </Text>
                {isLoading && (
                  <ActivityIndicator size="small" color={COLORS.solana} style={styles.loader} />
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => setMode('import')}
              disabled={isLoading}
            >
              <LinearGradient
                colors={[COLORS.cardBackground, COLORS.cardBackground + '80']}
                style={styles.optionGradient}
              >
                <View style={styles.optionIcon}>
                  <Key size={32} color={COLORS.textSecondary} />
                </View>
                <Text style={styles.optionTitle}>Import Existing Wallet</Text>
                <Text style={styles.optionDescription}>
                  Import your wallet using your private key
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.warningContainer}>
            <Text style={styles.warningTitle}>⚠️ Important Security Notice</Text>
            <Text style={styles.warningText}>
              • Never share your private key with anyone{'\n'}
              • Store your private key in a secure location{'\n'}
              • You are responsible for keeping your wallet safe{'\n'}
              • Lost private keys cannot be recovered
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'create' && generatedWallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode(null)}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wallet Created</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.successSection}>
            <View style={styles.successIcon}>
              <Wallet size={60} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>Wallet Created Successfully!</Text>
            <Text style={styles.successDescription}>
              Your new Solana wallet has been generated. Please save your private key securely.
            </Text>
          </View>

          <View style={styles.walletInfoContainer}>
            <Text style={styles.infoLabel}>Public Address</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{generatedWallet.publicKey.toString()}</Text>
            </View>

            <Text style={styles.infoLabel}>Private Key</Text>
            {generatedWallet.secretKey ? (
              <View style={styles.privateKeyContainer}>
                <View style={styles.privateKeyBox}>
                  <Text style={styles.privateKeyText}>
                    {showPrivateKey
                      ? bs58.encode(generatedWallet.secretKey)
                      : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
                    }
                  </Text>
                </View>
                <View style={styles.privateKeyActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? (
                      <EyeOff size={20} color={COLORS.textSecondary} />
                    ) : (
                      <Eye size={20} color={COLORS.textSecondary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleCopyPrivateKey}
                  >
                    <Copy size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.privateKeyContainer}>
                <View style={styles.privateKeyBox}>
                  <Text style={[styles.privateKeyText, { color: COLORS.textSecondary }]}>
                    Private key securely stored. Re-enter your PIN to access it.
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.warningContainer}>
            <Text style={styles.warningTitle}>🔐 Save Your Private Key</Text>
            <Text style={styles.warningText}>
              This is your only chance to save your private key. Write it down and store it in a secure location. If you lose this key, you will lose access to your wallet forever.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinishSetup}
          >
            <LinearGradient
              colors={[COLORS.success, COLORS.success + '80']}
              style={styles.finishGradient}
            >
              <Text style={styles.finishText}>I've Saved My Private Key</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'import') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode(null)}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Wallet</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.importSection}>
            <View style={styles.iconContainer}>
              <Key size={60} color={COLORS.solana} />
            </View>
            <Text style={styles.importTitle}>Import Your Wallet</Text>
            <Text style={styles.importDescription}>
              Enter your private key and set a password to encrypt it on this device
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Private Key</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your private key (Base58)"
                placeholderTextColor={COLORS.textSecondary}
                value={privateKey}
                onChangeText={setPrivateKey}
                multiline
                secureTextEntry={!showPrivateKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPrivateKey(!showPrivateKey)}
              >
                {showPrivateKey ? (
                  <EyeOff size={20} color={COLORS.textSecondary} />
                ) : (
                  <Eye size={20} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Wallet Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter a strong password"
                placeholderTextColor={COLORS.textSecondary}
                value={walletPassword}
                onChangeText={setWalletPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color={COLORS.textSecondary} />
                ) : (
                  <Eye size={20} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Re-enter password"
                placeholderTextColor={COLORS.textSecondary}
                value={confirmWalletPassword}
                onChangeText={setConfirmWalletPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.importButton}
            onPress={handleImportWallet}
            disabled={isLoading || !privateKey.trim() || !walletPassword || walletPassword !== confirmWalletPassword}
          >
            <LinearGradient
              colors={[
                (privateKey.trim() && walletPassword && walletPassword === confirmWalletPassword) ? COLORS.solana : COLORS.textSecondary,
                (privateKey.trim() && walletPassword && walletPassword === confirmWalletPassword) ? COLORS.solana + '80' : COLORS.textSecondary + '80'
              ]}
              style={styles.importGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.importText}>Import Wallet</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.warningContainer}>
            <Text style={styles.warningTitle}>🔒 Security Tips</Text>
            <Text style={styles.warningText}>
              • Make sure you're in a private location{'\n'}
              • Never enter your private key on untrusted devices{'\n'}
              • Double-check the private key before importing{'\n'}
              • Your private key will be stored securely on this device
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    maxWidth: isWeb ? 600 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSpacing(SPACING.l),
    paddingVertical: getResponsiveSpacing(SPACING.m),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBackground,
    minHeight: getResponsiveSize(60),
  },
  backButton: {
    width: getResponsiveSize(40),
    height: getResponsiveSize(40),
    borderRadius: getResponsiveSize(20),
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: getResponsiveSpacing(SPACING.m),
  },
  headerTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(20),
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: getResponsiveSpacing(SPACING.l),
    paddingBottom: getResponsiveSpacing(SPACING.l),
  },
  welcomeSection: {
    alignItems: 'center',
    paddingVertical: getResponsiveSpacing(SPACING.xl),
    paddingHorizontal: isSmallScreen ? getResponsiveSpacing(SPACING.s) : 0,
  },
  iconContainer: {
    width: getResponsiveSize(120),
    height: getResponsiveSize(120),
    borderRadius: getResponsiveSize(60),
    backgroundColor: COLORS.solana + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: getResponsiveSpacing(SPACING.l),
  },
  welcomeTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(24),
    textAlign: 'center',
    marginBottom: getResponsiveSpacing(SPACING.m),
    paddingHorizontal: getResponsiveSpacing(SPACING.s),
  },
  welcomeDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: getResponsiveFontSize(16),
    textAlign: 'center',
    lineHeight: getResponsiveFontSize(24),
    paddingHorizontal: getResponsiveSpacing(SPACING.m),
    maxWidth: isTablet ? 500 : '100%',
  },
  optionsContainer: {
    marginBottom: getResponsiveSpacing(SPACING.xl),
    flexDirection: isTablet ? 'row' : 'column',
    gap: getResponsiveSpacing(SPACING.l),
  },
  optionCard: {
    marginBottom: isTablet ? 0 : getResponsiveSpacing(SPACING.l),
    borderRadius: BORDER_RADIUS.large,
    overflow: 'hidden',
    flex: isTablet ? 1 : undefined,
  },
  optionGradient: {
    padding: getResponsiveSpacing(SPACING.l),
    alignItems: 'center',
    minHeight: getResponsiveSize(180),
    justifyContent: 'center',
  },
  optionIcon: {
    width: getResponsiveSize(60),
    height: getResponsiveSize(60),
    borderRadius: getResponsiveSize(30),
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: getResponsiveSpacing(SPACING.m),
  },
  optionTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(18),
    marginBottom: getResponsiveSpacing(SPACING.s),
    textAlign: 'center',
  },
  optionDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: getResponsiveFontSize(14),
    textAlign: 'center',
    lineHeight: getResponsiveFontSize(20),
    paddingHorizontal: getResponsiveSpacing(SPACING.s),
  },
  loader: {
    marginTop: getResponsiveSpacing(SPACING.s),
  },
  warningContainer: {
    backgroundColor: COLORS.warning + '20',
    borderRadius: BORDER_RADIUS.medium,
    padding: getResponsiveSpacing(SPACING.l),
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
    marginBottom: getResponsiveSpacing(SPACING.l),
    marginHorizontal: isSmallScreen ? getResponsiveSpacing(SPACING.s) : 0,
  },
  warningTitle: {
    ...FONTS.phantomBold,
    color: COLORS.warning,
    fontSize: getResponsiveFontSize(16),
    marginBottom: getResponsiveSpacing(SPACING.s),
  },
  warningText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: getResponsiveFontSize(14),
    lineHeight: getResponsiveFontSize(20),
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: getResponsiveSpacing(SPACING.xl),
    paddingHorizontal: isSmallScreen ? getResponsiveSpacing(SPACING.s) : 0,
  },
  successIcon: {
    width: getResponsiveSize(120),
    height: getResponsiveSize(120),
    borderRadius: getResponsiveSize(60),
    backgroundColor: COLORS.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: getResponsiveSpacing(SPACING.l),
  },
  successTitle: {
    ...FONTS.phantomBold,
    color: COLORS.success,
    fontSize: getResponsiveFontSize(24),
    textAlign: 'center',
    marginBottom: getResponsiveSpacing(SPACING.m),
    paddingHorizontal: getResponsiveSpacing(SPACING.s),
  },
  successDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: getResponsiveFontSize(16),
    textAlign: 'center',
    lineHeight: getResponsiveFontSize(24),
    paddingHorizontal: getResponsiveSpacing(SPACING.m),
    maxWidth: isTablet ? 500 : '100%',
  },
  walletInfoContainer: {
    marginBottom: getResponsiveSpacing(SPACING.xl),
  },
  infoLabel: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(16),
    marginBottom: getResponsiveSpacing(SPACING.s),
    marginTop: getResponsiveSpacing(SPACING.l),
  },
  infoBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: getResponsiveSpacing(SPACING.m),
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  infoText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(12),
    lineHeight: getResponsiveFontSize(16),
  },
  privateKeyContainer: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    alignItems: isSmallScreen ? 'stretch' : 'flex-start',
  },
  privateKeyBox: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: getResponsiveSpacing(SPACING.m),
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    marginRight: isSmallScreen ? 0 : getResponsiveSpacing(SPACING.s),
    marginBottom: isSmallScreen ? getResponsiveSpacing(SPACING.s) : 0,
  },
  privateKeyText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(10),
    lineHeight: getResponsiveFontSize(14),
  },
  privateKeyActions: {
    flexDirection: isSmallScreen ? 'row' : 'column',
    justifyContent: isSmallScreen ? 'center' : 'flex-start',
    gap: getResponsiveSpacing(SPACING.s),
  },
  actionButton: {
    width: getResponsiveSize(40),
    height: getResponsiveSize(40),
    borderRadius: getResponsiveSize(20),
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginBottom: getResponsiveSpacing(SPACING.xl),
    marginHorizontal: isSmallScreen ? getResponsiveSpacing(SPACING.s) : 0,
  },
  finishGradient: {
    paddingVertical: getResponsiveSpacing(SPACING.l),
    alignItems: 'center',
    minHeight: getResponsiveSize(50),
    justifyContent: 'center',
  },
  finishText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(16),
  },
  importSection: {
    alignItems: 'center',
    paddingVertical: getResponsiveSpacing(SPACING.xl),
    paddingHorizontal: isSmallScreen ? getResponsiveSpacing(SPACING.s) : 0,
  },
  importTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(24),
    textAlign: 'center',
    marginBottom: getResponsiveSpacing(SPACING.m),
    paddingHorizontal: getResponsiveSpacing(SPACING.s),
  },
  importDescription: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: getResponsiveFontSize(16),
    textAlign: 'center',
    lineHeight: getResponsiveFontSize(24),
    paddingHorizontal: getResponsiveSpacing(SPACING.m),
    maxWidth: isTablet ? 500 : '100%',
  },
  inputSection: {
    marginBottom: getResponsiveSpacing(SPACING.xl),
  },
  inputLabel: {
    ...FONTS.phantomSemiBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(16),
    marginBottom: getResponsiveSpacing(SPACING.s),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
  },
  textInput: {
    ...FONTS.monospace,
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(14),
    padding: getResponsiveSpacing(SPACING.m),
    minHeight: getResponsiveSize(100),
    textAlignVertical: 'top',
  },
  eyeButton: {
    width: getResponsiveSize(40),
    height: getResponsiveSize(40),
    justifyContent: 'center',
    alignItems: 'center',
    margin: getResponsiveSpacing(SPACING.s),
  },
  importButton: {
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    marginBottom: getResponsiveSpacing(SPACING.xl),
    marginHorizontal: isSmallScreen ? getResponsiveSpacing(SPACING.s) : 0,
  },
  importGradient: {
    paddingVertical: getResponsiveSpacing(SPACING.l),
    alignItems: 'center',
    minHeight: getResponsiveSize(50),
    justifyContent: 'center',
  },
  importText: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: getResponsiveFontSize(16),
  },
});
