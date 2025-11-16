import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Wallet, Copy, Eye, EyeOff, Trash2, Edit3, ExternalLink } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonButton } from './NeonButton';
import { NeonInput } from './NeonInput';
import { NeonCard } from './NeonCard';

interface Wallet {
  id: string;
  name: string;
  address: string;
  balance: number;
  isConnected: boolean;
  type: 'imported' | 'generated' | 'hardware';
}

interface WalletManagerProps {
  wallets?: Wallet[];
  onAddWallet?: () => void;
  onImportWallet?: (privateKey: string, name: string) => void;
  onDeleteWallet?: (walletId: string) => void;
  onRenameWallet?: (walletId: string, newName: string) => void;
  onConnectWallet?: (walletId: string) => void;
}

export default function WalletManager({
  wallets = [],
  onAddWallet,
  onImportWallet,
  onDeleteWallet,
  onRenameWallet,
  onConnectWallet,
}: WalletManagerProps) {
  const [showImportForm, setShowImportForm] = useState(false);
  const [importKey, setImportKey] = useState('');
  const [walletName, setWalletName] = useState('');
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [showPrivateKeys, setShowPrivateKeys] = useState<Record<string, boolean>>({});

  const handleImportWallet = () => {
    if (!importKey.trim() || !walletName.trim()) {
      Alert.alert('Error', 'Please enter both private key and wallet name');
      return;
    }

    onImportWallet?.(importKey.trim(), walletName.trim());
    setImportKey('');
    setWalletName('');
    setShowImportForm(false);
  };

  const handleDeleteWallet = (wallet: Wallet) => {
    Alert.alert(
      'Delete Wallet',
      `Are you sure you want to delete "${wallet.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteWallet?.(wallet.id),
        },
      ]
    );
  };

  const handleRenameWallet = (walletId: string) => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }

    onRenameWallet?.(walletId, newName.trim());
    setEditingWallet(null);
    setNewName('');
  };

  const togglePrivateKeyVisibility = (walletId: string) => {
    setShowPrivateKeys(prev => ({
      ...prev,
      [walletId]: !prev[walletId],
    }));
  };

  const copyToClipboard = (text: string) => {
    // In a real app, you'd use Clipboard.setString(text)
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Wallet Manager</Text>
          <NeonButton
            title="Add Wallet"
            onPress={onAddWallet}
            icon={<Plus size={16} color={COLORS.text} />}
            variant="primary"
            size="small"
          />
        </View>

        {/* Import Wallet Form */}
        {showImportForm && (
          <NeonCard style={styles.importForm}>
            <Text style={styles.formTitle}>Import Wallet</Text>
            <NeonInput
              label="Private Key"
              placeholder="Enter private key"
              value={importKey}
              onChangeText={setImportKey}
              secureTextEntry={true}
              style={styles.input}
            />
            <NeonInput
              label="Wallet Name"
              placeholder="Wallet name"
              value={walletName}
              onChangeText={setWalletName}
              style={styles.input}
            />
            <View style={styles.formButtons}>
              <NeonButton
                title="Cancel"
                onPress={() => setShowImportForm(false)}
                variant="outline"
                style={styles.formButton}
              />
              <NeonButton
                title="Import"
                onPress={handleImportWallet}
                variant="primary"
                style={styles.formButton}
              />
            </View>
          </NeonCard>
        )}

        {/* Import Button */}
        {!showImportForm && (
          <NeonButton
            title="Import Existing Wallet"
            onPress={() => setShowImportForm(true)}
            variant="outline"
            style={styles.importButton}
          />
        )}

        {/* Wallets List */}
        <View style={styles.walletsList}>
          {wallets.map((wallet) => (
            <NeonCard key={wallet.id} style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <View style={styles.walletInfo}>
                  <View style={styles.walletNameRow}>
                    {editingWallet === wallet.id ? (
                      <View style={styles.editNameContainer}>
                        <NeonInput
                          label="New Name"
                          value={newName}
                          onChangeText={setNewName}
                          style={styles.editNameInput}
                          placeholder="Enter new name"
                        />
                        <Pressable
                          onPress={() => handleRenameWallet(wallet.id)}
                          style={styles.saveButton}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.walletName}>{wallet.name}</Text>
                        <Pressable
                          onPress={() => {
                            setEditingWallet(wallet.id);
                            setNewName(wallet.name);
                          }}
                          style={styles.editButton}
                        >
                          <Edit3 size={16} color={COLORS.primary} />
                        </Pressable>
                      </>
                    )}
                  </View>
                  <View style={styles.walletDetails}>
                    <Text style={styles.walletAddress}>
                      {formatAddress(wallet.address)}
                    </Text>
                    <View style={styles.walletBadges}>
                      <View style={[styles.badge, wallet.isConnected && styles.connectedBadge]}>
                        <Text style={[styles.badgeText, wallet.isConnected && styles.connectedBadgeText]}>
                          {wallet.isConnected ? 'Connected' : 'Disconnected'}
                        </Text>
                      </View>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{wallet.type}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.walletBalance}>
                  <Text style={styles.balanceAmount}>
                    ${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <View style={styles.walletActions}>
                <Pressable
                  onPress={() => copyToClipboard(wallet.address)}
                  style={styles.actionButton}
                >
                  <Copy size={16} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Copy</Text>
                </Pressable>

                <Pressable
                  onPress={() => togglePrivateKeyVisibility(wallet.id)}
                  style={styles.actionButton}
                >
                  {showPrivateKeys[wallet.id] ? (
                    <EyeOff size={16} color={COLORS.primary} />
                  ) : (
                    <Eye size={16} color={COLORS.primary} />
                  )}
                  <Text style={styles.actionButtonText}>
                    {showPrivateKeys[wallet.id] ? 'Hide' : 'Show'} Key
                  </Text>
                </Pressable>

                {!wallet.isConnected && (
                  <Pressable
                    onPress={() => onConnectWallet?.(wallet.id)}
                    style={styles.actionButton}
                  >
                    <Wallet size={16} color={COLORS.success} />
                    <Text style={[styles.actionButtonText, { color: COLORS.success }]}>
                      Connect
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleDeleteWallet(wallet)}
                  style={styles.actionButton}
                >
                  <Trash2 size={16} color={COLORS.error} />
                  <Text style={[styles.actionButtonText, { color: COLORS.error }]}>
                    Delete
                  </Text>
                </Pressable>
              </View>

              {showPrivateKeys[wallet.id] && (
                <View style={styles.privateKeyContainer}>
                  <Text style={styles.privateKeyLabel}>Private Key:</Text>
                  <Text style={styles.privateKeyText} selectable>
                    {wallet.address} {/* In real app, this would be the actual private key */}
                  </Text>
                </View>
              )}
            </NeonCard>
          ))}
        </View>

        {wallets.length === 0 && (
          <View style={styles.emptyState}>
            <Wallet size={48} color={COLORS.text} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyStateText}>No wallets found</Text>
            <Text style={styles.emptyStateSubtext}>
              Add or import a wallet to get started
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.m,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  importForm: {
    marginBottom: SPACING.m,
  },
  formTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  input: {
    marginBottom: SPACING.s,
  },
  formButtons: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginTop: SPACING.s,
  },
  formButton: {
    flex: 1,
  },
  importButton: {
    marginBottom: SPACING.l,
  },
  walletsList: {
    gap: SPACING.m,
  },
  walletCard: {
    padding: SPACING.m,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.m,
  },
  walletInfo: {
    flex: 1,
  },
  walletNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  walletName: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginRight: SPACING.s,
  },
  editButton: {
    padding: SPACING.xs,
  },
  editNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editNameInput: {
    flex: 1,
    marginRight: SPACING.s,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
  },
  saveButtonText: {
    color: COLORS.text,
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  walletDetails: {
    gap: SPACING.xs,
  },
  walletAddress: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    opacity: 0.7,
  },
  walletBadges: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.small,
  },
  connectedBadge: {
    backgroundColor: COLORS.success,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    opacity: 0.8,
  },
  connectedBadgeText: {
    opacity: 1,
  },
  walletBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  walletActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.xs,
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  privateKeyContainer: {
    marginTop: SPACING.s,
    padding: SPACING.s,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.medium,
  },
  privateKeyLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  privateKeyText: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    opacity: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyStateText: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginTop: SPACING.m,
    marginBottom: SPACING.xs,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
  },
});