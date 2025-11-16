import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  ArrowLeft, 
  ExternalLink, 
  Copy, 
  Share as ShareIcon,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Clock,
  Hash,
  DollarSign,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Coins,
  FileText
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { trpc } from '../../lib/trpc';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function TransactionDetailsScreen() {
  const { signature } = useLocalSearchParams<{ signature: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = trpc.transaction.getBySignature.useQuery(
    { signature: signature! },
    { enabled: !!signature }
  );

  const transaction = data?.transaction;
  const blockchainData = data?.blockchainData;

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const handleShare = async () => {
    if (!transaction) return;
    
    try {
      const shareData = {
        title: 'Transaction Details',
        text: `Transaction: ${transaction.signature}\nAmount: ${transaction.amount} ${transaction.tokenSymbol || 'SOL'}\nStatus: ${transaction.status}\n\nView on Solana Explorer: https://explorer.solana.com/tx/${transaction.signature}`,
        url: `https://explorer.solana.com/tx/${transaction.signature}`,
      };

      // Use Web Share API if available, otherwise fallback to clipboard
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard and show alert
        await Clipboard.setStringAsync(shareData.text);
        Alert.alert(
          'Transaction Details Copied',
          'Transaction details have been copied to clipboard',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback: copy to clipboard
      try {
        const fallbackText = `Transaction: ${transaction.signature}\nAmount: ${transaction.amount} ${transaction.tokenSymbol || 'SOL'}\nStatus: ${transaction.status}`;
        await Clipboard.setStringAsync(fallbackText);
        Alert.alert(
          'Transaction Details Copied',
          'Transaction details have been copied to clipboard',
          [{ text: 'OK' }]
        );
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
      }
    }
  };

  const handleOpenExplorer = () => {
    if (!transaction) return;
    const url = `https://explorer.solana.com/tx/${transaction.signature}`;
    Linking.openURL(url);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'SEND':
        return <ArrowUpRight size={24} color={COLORS.error} />;
      case 'RECEIVE':
        return <ArrowDownLeft size={24} color={COLORS.success} />;
      case 'SWAP':
        return <RefreshCw size={24} color={COLORS.warning} />;
      default:
        return <ArrowUpRight size={24} color={COLORS.textSecondary} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <CheckCircle size={20} color={COLORS.success} />;
      case 'PENDING':
        return <Clock size={20} color={COLORS.warning} />;
      case 'FAILED':
        return <XCircle size={20} color={COLORS.error} />;
      default:
        return <AlertCircle size={20} color={COLORS.textSecondary} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return COLORS.success;
      case 'PENDING':
        return COLORS.warning;
      case 'FAILED':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const formatAmount = (amount: number, type: string) => {
    const prefix = type === 'RECEIVE' ? '+' : type === 'SEND' ? '-' : '';
    return `${prefix}${amount.toFixed(6)}`;
  };

  const renderDetailRow = (icon: React.ReactNode, label: string, value: string | undefined, copyable = false) => {
    if (!value) return null;
    
    return (
      <View style={styles.detailRow}>
        <View style={styles.detailLabel}>
          {icon}
          <Text style={styles.detailLabelText}>{label}</Text>
        </View>
        <View style={styles.detailValue}>
          <Text style={styles.detailValueText} numberOfLines={1}>
            {value}
          </Text>
          {copyable && (
            <TouchableOpacity
              onPress={() => handleCopy(value, label)}
              style={styles.copyButton}
            >
              <Copy size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Transaction Details</Text>
          <View style={styles.headerActions} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.solana} />
          <Text style={styles.loadingText}>Loading transaction...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Transaction Details</Text>
          <View style={styles.headerActions} />
        </View>
        <View style={styles.errorContainer}>
          <XCircle size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Transaction Not Found</Text>
          <Text style={styles.errorText}>
            The transaction with signature {signature} could not be found.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Transaction Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <ShareIcon size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenExplorer} style={styles.headerButton}>
            <ExternalLink size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Transaction Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.transactionIcon}>
              {getTransactionIcon(transaction.type)}
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.transactionType}>{transaction.type}</Text>
              <View style={styles.statusContainer}>
                {getStatusIcon(transaction.status)}
                <Text style={[styles.statusText, { color: getStatusColor(transaction.status) }]}>
                  {transaction.status}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.amountContainer}>
            <Text style={[styles.amount, { color: getStatusColor(transaction.type) }]}>
              {formatAmount(transaction.amount, transaction.type)}
            </Text>
            <Text style={styles.tokenSymbol}>
              {transaction.tokenSymbol || 'SOL'}
            </Text>
          </View>
        </View>

        {/* Transaction Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Transaction Details</Text>
          
          {renderDetailRow(
            <Hash size={20} color={COLORS.textSecondary} />,
            'Signature',
            transaction.signature
          )}
          
          {renderDetailRow(
            <Clock size={20} color={COLORS.textSecondary} />,
            'Time',
            new Date(transaction.createdAt).toLocaleString()
          )}
          
          {renderDetailRow(
            <DollarSign size={20} color={COLORS.textSecondary} />,
            'Fee',
            `${transaction.fee} SOL`
          )}
          
          {renderDetailRow(
            <Activity size={20} color={COLORS.textSecondary} />,
            'Status',
            transaction.status
          )}
          
          {transaction.token && renderDetailRow(
            <Coins size={20} color={COLORS.textSecondary} />,
            'Token',
            transaction.token
          )}
          
          {transaction.notes && renderDetailRow(
            <FileText size={20} color={COLORS.textSecondary} />,
            'Notes',
            transaction.notes
          )}
        </View>

        {/* Address Information */}
        {(transaction.from || transaction.to) && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Address Information</Text>
            
            {transaction.from && renderDetailRow(
              <User size={20} color={COLORS.textSecondary} />,
              'From',
              transaction.from,
              true
            )}
            
            {transaction.to && renderDetailRow(
              <User size={20} color={COLORS.textSecondary} />,
              'To',
              transaction.to,
              true
            )}
          </View>
        )}

        {/* Token Information */}
        {transaction?.token && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Token Information</Text>
            
            {renderDetailRow(
              <Hash size={20} color={COLORS.textSecondary} />,
              'Token',
              transaction.token,
              true
            )}
            
            {transaction.tokenSymbol && renderDetailRow(
              <DollarSign size={20} color={COLORS.textSecondary} />,
              'Symbol',
              transaction.tokenSymbol
            )}
          </View>
        )}

        {/* Blockchain Data */}
        {blockchainData && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Blockchain Data</Text>
            <View style={styles.blockchainDataContainer}>
              <Text style={styles.blockchainDataText}>
                {JSON.stringify(blockchainData, null, 2)}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenExplorer}>
            <ExternalLink size={20} color={COLORS.solana} />
            <Text style={styles.actionButtonText}>View on Explorer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleCopy(transaction.signature, 'Transaction signature')}
          >
            <Copy size={20} color={COLORS.solana} />
            <Text style={styles.actionButtonText}>Copy Signature</Text>
          </TouchableOpacity>
        </View>

        {/* Refresh Button */}
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={COLORS.solana} />
          ) : (
            <RefreshCw size={20} color={COLORS.solana} />
          )}
          <Text style={styles.refreshButtonText}>
            {refreshing ? 'Refreshing...' : 'Refresh Transaction'}
          </Text>
        </TouchableOpacity>
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
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerButton: {
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  summaryCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
    alignItems: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryInfo: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  transactionType: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    textTransform: 'uppercase',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  amount: {
    fontSize: 32,
    fontFamily: FONTS.bold,
  },
  tokenSymbol: {
    fontSize: 18,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  usdValue: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  detailsCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  detailLabelText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 2,
    justifyContent: 'flex-end',
  },
  detailValueText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  copyButton: {
    padding: SPACING.xs,
  },
  blockchainDataContainer: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  blockchainDataText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: COLORS.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.solana,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  refreshButtonText: {
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.solana,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.background,
  },
});