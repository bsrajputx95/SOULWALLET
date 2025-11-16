import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  User, 
  Copy,
  Send,
  X,
  UserPlus,
  Users
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { trpc } from '../lib/trpc';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { SafeHtmlText } from '../components/SafeHtml';

interface Contact {
  id: string;
  name: string;
  address: string;
  notes?: string | null;
  createdAt: Date;
}

export default function AddressBookScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactAddress, setNewContactAddress] = useState('');
  const [newContactNotes, setNewContactNotes] = useState('');

  const { 
    data: contactsData, 
    isLoading, 
    refetch 
  } = trpc.contact.list.useQuery({ search: searchQuery });

  const { 
    data: frequentContactsData 
  } = trpc.contact.getFrequentlyUsed.useQuery({ limit: 5 });

  const createMutation = trpc.contact.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowAddModal(false);
      resetForm();
      Alert.alert('Success', 'Contact added successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const updateMutation = trpc.contact.update.useMutation({
    onSuccess: () => {
      refetch();
      setShowEditModal(false);
      resetForm();
      Alert.alert('Success', 'Contact updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      refetch();
      Alert.alert('Success', 'Contact deleted successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const contacts = contactsData?.contacts || [];
  const frequentContacts = frequentContactsData?.frequentContacts || [];

  const resetForm = useCallback(() => {
    setNewContactName('');
    setNewContactAddress('');
    setNewContactNotes('');
    setSelectedContact(null);
  }, []);

  const handleAddContact = useCallback(() => {
    if (!newContactName.trim() || !newContactAddress.trim()) {
      Alert.alert('Error', 'Name and address are required');
      return;
    }

    createMutation.mutate({
      name: newContactName.trim(),
      address: newContactAddress.trim(),
      notes: newContactNotes.trim() || undefined,
    });
  }, [newContactName, newContactAddress, newContactNotes, createMutation]);

  const handleEditContact = useCallback(() => {
    if (!selectedContact || !newContactName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    updateMutation.mutate({
      id: selectedContact.id,
      name: newContactName.trim(),
      notes: newContactNotes.trim() || undefined,
    });
  }, [selectedContact, newContactName, newContactNotes, updateMutation]);

  const handleDeleteContact = useCallback((contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete "${contact.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ id: contact.id }),
        },
      ]
    );
  }, [deleteMutation]);

  const handleCopyAddress = useCallback(async (address: string, name: string) => {
    await Clipboard.setStringAsync(address);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', `${name}'s address copied to clipboard`);
  }, []);

  const handleSendToContact = useCallback((contact: Contact) => {
    router.push({
      pathname: '/send-receive',
      params: { 
        tab: 'send',
        address: contact.address,
        contactName: contact.name 
      }
    });
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowAddModal(true);
  }, [resetForm]);

  const openEditModal = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setNewContactName(contact.name);
    setNewContactNotes(contact.notes || '');
    setShowEditModal(true);
  }, []);

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactIcon}>
        <User size={24} color={COLORS.solana} />
      </View>
      
      <View style={styles.contactDetails}>
        <SafeHtmlText 
          html={item.name} 
          style={styles.contactName}
          maxLength={50}
        />
        <Text style={styles.contactAddress}>
          {item.address.slice(0, 8)}...{item.address.slice(-8)}
        </Text>
        {item.notes && (
          <SafeHtmlText 
            html={item.notes} 
            style={styles.contactNotes}
            maxLength={100}
          />
        )}
        <Text style={styles.contactDate}>
          Added {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCopyAddress(item.address, item.name)}
        >
          <Copy size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSendToContact(item)}
        >
          <Send size={18} color={COLORS.solana} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Edit3 size={18} color={COLORS.warning} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteContact(item)}
        >
          <Trash2 size={18} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFrequentContact = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.frequentContactItem}
      onPress={() => item.contact && handleSendToContact(item.contact)}
    >
      <View style={styles.frequentContactIcon}>
        <User size={20} color={COLORS.solana} />
      </View>
      <View style={styles.frequentContactInfo}>
        <SafeHtmlText 
          html={item.contact?.name || `${item.address.slice(0, 8)}...${item.address.slice(-8)}`}
          style={styles.frequentContactName}
          maxLength={30}
        />
        <Text style={styles.frequentContactCount}>
          {item.frequency} transactions
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderAddContactModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAddModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Contact</Text>
          <TouchableOpacity
            onPress={() => setShowAddModal(false)}
            style={styles.modalCloseButton}
          >
            <X size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter contact name"
              placeholderTextColor={COLORS.textSecondary}
              value={newContactName}
              onChangeText={setNewContactName}
              maxLength={50}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Solana Address *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Solana address"
              placeholderTextColor={COLORS.textSecondary}
              value={newContactAddress}
              onChangeText={setNewContactAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add notes about this contact"
              placeholderTextColor={COLORS.textSecondary}
              value={newContactNotes}
              onChangeText={setNewContactNotes}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.submitButton, createMutation.isPending && styles.submitButtonDisabled]}
            onPress={handleAddContact}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <UserPlus size={20} color={COLORS.background} />
                <Text style={styles.submitButtonText}>Add Contact</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderEditContactModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEditModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Contact</Text>
          <TouchableOpacity
            onPress={() => setShowEditModal(false)}
            style={styles.modalCloseButton}
          >
            <X size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Address</Text>
            <View style={styles.addressDisplay}>
              <Text style={styles.addressText}>
                {selectedContact?.address}
              </Text>
              <TouchableOpacity
                onPress={() => selectedContact && handleCopyAddress(selectedContact.address, selectedContact.name)}
                style={styles.copyAddressButton}
              >
                <Copy size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter contact name"
              placeholderTextColor={COLORS.textSecondary}
              value={newContactName}
              onChangeText={setNewContactName}
              maxLength={50}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add notes about this contact"
              placeholderTextColor={COLORS.textSecondary}
              value={newContactNotes}
              onChangeText={setNewContactNotes}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.submitButton, updateMutation.isPending && styles.submitButtonDisabled]}
            onPress={handleEditContact}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <Edit3 size={20} color={COLORS.background} />
                <Text style={styles.submitButtonText}>Update Contact</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Users size={48} color={COLORS.textSecondary} />
      <Text style={styles.emptyStateTitle}>No Contacts Yet</Text>
      <Text style={styles.emptyStateText}>
        Add contacts to quickly send transactions to frequently used addresses.
      </Text>
      <TouchableOpacity style={styles.addFirstContactButton} onPress={openAddModal}>
        <UserPlus size={20} color={COLORS.solana} />
        <Text style={styles.addFirstContactText}>Add Your First Contact</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Address Book</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addButton}>
          <Plus size={24} color={COLORS.solana} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Frequent Contacts */}
      {frequentContacts.length > 0 && (
        <View style={styles.frequentSection}>
          <Text style={styles.sectionTitle}>Frequently Used</Text>
          <FlatList
            data={frequentContacts}
            renderItem={renderFrequentContact}
            keyExtractor={(item) => item.address}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.frequentList}
          />
        </View>
      )}

      {/* Contacts List */}
      <View style={styles.contactsSection}>
        <Text style={styles.sectionTitle}>
          All Contacts ({contacts.length})
        </Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.solana} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : contacts.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={contacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            style={styles.contactsList}
            contentContainerStyle={styles.contactsContent}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refetch}
                tintColor={COLORS.solana}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Modals */}
      {renderAddContactModal()}
      {renderEditContactModal()}
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.sm,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  addButton: {
    padding: SPACING.sm,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  frequentSection: {
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  frequentList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  frequentContactItem: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    minWidth: 120,
    marginRight: SPACING.sm,
  },
  frequentContactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.solana + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  frequentContactInfo: {
    alignItems: 'center',
  },
  frequentContactName: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  frequentContactCount: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  contactsSection: {
    flex: 1,
  },
  contactsList: {
    flex: 1,
  },
  contactsContent: {
    paddingHorizontal: SPACING.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.solana + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDetails: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  contactAddress: {
    fontSize: 14,
    fontFamily: FONTS.mono,
    color: COLORS.textSecondary,
  },
  contactNotes: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  contactDate: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  contactActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  addFirstContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  addFirstContactText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.solana,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  modalCloseButton: {
    padding: SPACING.sm,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  textInput: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addressDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.mono,
    color: COLORS.textSecondary,
  },
  copyAddressButton: {
    padding: SPACING.xs,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.solana,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.background,
  },
});