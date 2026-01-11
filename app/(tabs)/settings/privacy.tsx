import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Shield } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';

import { COLORS } from '../../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../../constants/theme';
import { NeonCard } from '../../../components/NeonCard';
import { NeonButton } from '../../../components/NeonButton';
import { trpc } from '../../../lib/trpc';

export default function PrivacyScreen() {
  const router = useRouter();
  const consentsQuery = trpc.compliance.getMyConsents.useQuery();
  const exportRequestsQuery = trpc.compliance.listMyExportRequests.useQuery({ limit: 10 });
  const deletionRequestsQuery = trpc.compliance.listMyDeletionRequests.useQuery({ limit: 10 });

  const requestExportMutation = trpc.compliance.requestDataExport.useMutation();
  const requestDeletionMutation = trpc.compliance.requestDataDeletion.useMutation();

  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');

  const consentItems = useMemo(() => {
    const consents = consentsQuery.data?.consents ?? {};
    return Object.entries(consents).map(([consentType, v]) => ({
      consentType,
      granted: v.granted,
      version: v.version,
      createdAt: v.createdAt,
    }));
  }, [consentsQuery.data?.consents]);

  const latestDeletionRequest = useMemo(() => {
    const requests = deletionRequestsQuery.data?.requests ?? [];
    return requests[0] ?? null;
  }, [deletionRequestsQuery.data?.requests]);

  const openUrl = async (url: string) => {
    if (!url) return;
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(url);
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const handleRequestExport = async () => {
    try {
      const res = await requestExportMutation.mutateAsync({ format: 'JSON' });
      if (res?.requestId) {
        Alert.alert('Requested', 'Your data export request has been submitted.');
        await exportRequestsQuery.refetch();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to request data export');
    }
  };

  const handleOpenDeletionModal = () => {
    setDeletionReason('');
    setShowDeletionModal(true);
  };

  const handleConfirmDeletion = async () => {
    const reason = deletionReason.trim();
    if (!reason) {
      Alert.alert('Reason required', 'Please provide a reason for deletion.');
      return;
    }

    Alert.alert(
      'Confirm Account Deletion',
      'This action is irreversible. A 30-day grace period applies.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              await requestDeletionMutation.mutateAsync({ reason });
              setShowDeletionModal(false);
              await deletionRequestsQuery.refetch();
              Alert.alert('Requested', 'Your account deletion request has been submitted.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to request deletion');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Privacy & Data',
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: {
            ...FONTS.phantomBold,
            fontSize: 18,
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ),
          headerBackVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <NeonCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Shield size={22} color={COLORS.usdc} />
            <Text style={styles.headerTitle}>Manage your privacy and data</Text>
          </View>
          <Text style={styles.headerText}>
            Request a copy of your data or request account deletion.
          </Text>
        </NeonCard>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Consents</Text>
          <NeonCard>
            {consentItems.length === 0 ? (
              <Text style={styles.emptyText}>No consent records found.</Text>
            ) : (
              consentItems.map((c) => (
                <View key={c.consentType} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemTitle}>{c.consentType}</Text>
                    <Text style={styles.itemMeta}>
                      v{c.version} • {new Date(c.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.badge, c.granted ? styles.badgeGranted : styles.badgeDenied]}>
                    {c.granted ? 'GRANTED' : 'DENIED'}
                  </Text>
                </View>
              ))
            )}
          </NeonCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Export</Text>
          <NeonCard style={styles.cardBody}>
            <Text style={styles.bodyText}>
              Request a copy of your data in JSON format.
            </Text>
            <View style={{ marginTop: SPACING.s }}>
              <NeonButton
                title="Request Data Export (JSON)"
                onPress={handleRequestExport}
                loading={requestExportMutation.isPending}
              />
            </View>
          </NeonCard>

          <NeonCard style={[styles.cardBody, { marginTop: SPACING.m }]}>
            <Text style={styles.subTitle}>Recent requests</Text>
            {(exportRequestsQuery.data?.requests ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No export requests yet.</Text>
            ) : (
              (exportRequestsQuery.data?.requests ?? []).map((r) => (
                <View key={r.id} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemTitle}>{r.status}</Text>
                    <Text style={styles.itemMeta}>
                      {r.format} • {new Date(r.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {r.status === 'COMPLETED' && r.fileUrl ? (
                    <TouchableOpacity onPress={() => openUrl(r.fileUrl)}>
                      <Text style={styles.linkText}>Download</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.mutedText}>—</Text>
                  )}
                </View>
              ))
            )}
          </NeonCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Deletion</Text>
          <NeonCard style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Irreversible action</Text>
            <Text style={styles.warningText}>A 30-day grace period applies.</Text>
          </NeonCard>

          <View style={{ marginTop: SPACING.m }}>
            <NeonButton
              title="Request Account Deletion"
              onPress={handleOpenDeletionModal}
              loading={requestDeletionMutation.isPending}
            />
          </View>

          <NeonCard style={[styles.cardBody, { marginTop: SPACING.m }]}>
            <Text style={styles.subTitle}>Latest request</Text>
            {!latestDeletionRequest ? (
              <Text style={styles.emptyText}>No deletion request submitted.</Text>
            ) : (
              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemTitle}>{latestDeletionRequest.status}</Text>
                  <Text style={styles.itemMeta}>
                    {new Date(latestDeletionRequest.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.mutedText}>—</Text>
              </View>
            )}
          </NeonCard>
        </View>
      </ScrollView>

      <Modal
        visible={showDeletionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeletionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request account deletion</Text>
            <Text style={styles.modalText}>Provide a reason for deletion.</Text>
            <TextInput
              value={deletionReason}
              onChangeText={setDeletionReason}
              placeholder="Reason"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.modalInput}
              multiline
            />
            <View style={styles.modalActions}>
              <NeonButton title="Cancel" onPress={() => setShowDeletionModal(false)} />
              <NeonButton title="Confirm" onPress={handleConfirmDeletion} />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: SPACING.l,
    paddingBottom: 20,
  },
  headerCard: {
    marginBottom: SPACING.l,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.m,
    paddingBottom: SPACING.s,
  },
  headerTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    flex: 1,
  },
  headerText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 13,
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.m,
    lineHeight: 18,
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
  cardBody: {
    padding: SPACING.m,
  },
  bodyText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  subTitle: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.s,
  },
  emptyText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '30',
  },
  itemLeft: {
    flex: 1,
    marginRight: SPACING.s,
  },
  itemTitle: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  itemMeta: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    ...FONTS.phantomBold,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
    overflow: 'hidden',
  },
  badgeGranted: {
    backgroundColor: COLORS.success + '20',
    color: COLORS.success,
  },
  badgeDenied: {
    backgroundColor: COLORS.error + '20',
    color: COLORS.error,
  },
  linkText: {
    ...FONTS.phantomMedium,
    color: COLORS.usdc,
    fontSize: 13,
  },
  mutedText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  warningCard: {
    backgroundColor: COLORS.warning + '10',
    borderColor: COLORS.warning + '30',
  },
  warningTitle: {
    ...FONTS.phantomBold,
    color: COLORS.warning,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  warningText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.l,
  },
  modalCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border + '30',
  },
  modalTitle: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  modalText: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.m,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border + '50',
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    minHeight: 90,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  modalActions: {
    marginTop: SPACING.m,
    gap: SPACING.s,
  },
});

