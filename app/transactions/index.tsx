import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Search, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink } from 'lucide-react-native';
import { trpc } from '../../lib/trpc';
import { COLORS } from '../../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

type TransactionType = 'SEND' | 'RECEIVE' | 'SWAP' | undefined;

export default function TransactionsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionType>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const {
    data: transactionData,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.transaction.list.useInfiniteQuery(
    {
      limit: 20,
      type: selectedType,
      search: searchQuery || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const syncMutation = trpc.transaction.sync.useMutation({
    onSuccess: () => {
      refetch();
      Alert.alert('Success', 'Transactions synced successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const transactions = transactionData?.pages.flatMap(page => page.transactions) || [];

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleTypeFilter = useCallback((type: TransactionType) => {
    setSelectedType(selectedType === type ? undefined : type);
    setShowFilters(false);
  }, [selectedType]);

  const handleTransactionPress = useCallback((signature: string) => {
    router.push(`/transactions/${signature}`);
  }, []);

  const handleSync = useCallback(() => {
    syncMutation.mutate();
  }, [syncMutation]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'SEND':
        return <ArrowUpRight size={20} color={COLORS.error} />;
      case 'RECEIVE':
        return <ArrowDownLeft size={20} color={COLORS.success} />;
      case 'SWAP':
        return <RefreshCw size={20} color={COLORS.warning} />;
      default:
        return <ArrowUpRight size={20} color={COLORS.textSecondary} />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'SEND':
        return COLORS.error;
      case 'RECEIVE':
        return COLORS.success;
      case 'SWAP':
        return COLORS.warning;
      default:
        return COLORS.textSecondary;
    }
  };

  const formatAmount = (amount: number, type: string) => {
    const prefix = type === 'RECEIVE' ? '+' : type === 'SEND' ? '-' : '';
    return `${prefix}${amount.toFixed(6)}`;
  };

  const renderTransaction = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.transactionItem}
      onPress={() => handleTransactionPress(item.signature)}
    >
      <View style={styles.transactionIcon}>
        {getTransactionIcon(item.type)}
      </View>
      
      <View style={styles.transactionDetails}>
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionType}>{item.type}</Text>
          <Text style={[styles.transactionAmount, { color: getTransactionColor(item.type) }]}>
            {formatAmount(item.amount, item.type)} {item.tokenSymbol || 'SOL'}
          </Text>
        </View>
        
        <View style={styles.transactionMeta}>
          <Text style={styles.transactionAddress}>
            {item.type === 'SEND' ? `To: ${item.to?.slice(0, 8)}...${item.to?.slice(-8)}` : 
             item.type === 'RECEIVE' ? `From: ${item.from?.slice(0, 8)}...${item.from?.slice(-8)}` :
             'Token Swap'}
          </Text>
          <Text style={styles.transactionTime}>
            {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
          </Text>
        </View>
        
        <View style={styles.transactionFooter}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          <Text style={styles.transactionFee}>
            Fee: {item.fee.toFixed(6)} SOL
          </Text>
        </View>
      </View>
      
      <ExternalLink size={16} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return COLORS.success + '20';
      case 'PENDING':
        return COLORS.warning + '20';
      case 'FAILED':
        return COLORS.error + '20';
      default:
        return COLORS.textSecondary + '20';
    }
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <TouchableOpacity
        style={[styles.filterButton, selectedType === 'SEND' && styles.filterButtonActive]}
        onPress={() => handleTypeFilter('SEND')}
      >
        <ArrowUpRight size={16} color={selectedType === 'SEND' ? COLORS.background : COLORS.error} />
        <Text style={[styles.filterButtonText, selectedType === 'SEND' && styles.filterButtonTextActive]}>
          Send
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.filterButton, selectedType === 'RECEIVE' && styles.filterButtonActive]}
        onPress={() => handleTypeFilter('RECEIVE')}
      >
        <ArrowDownLeft size={16} color={selectedType === 'RECEIVE' ? COLORS.background : COLORS.success} />
        <Text style={[styles.filterButtonText, selectedType === 'RECEIVE' && styles.filterButtonTextActive]}>
          Receive
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.filterButton, selectedType === 'SWAP' && styles.filterButtonActive]}
        onPress={() => handleTypeFilter('SWAP')}
      >
        <RefreshCw size={16} color={selectedType === 'SWAP' ? COLORS.background : COLORS.warning} />
        <Text style={[styles.filterButtonText, selectedType === 'SWAP' && styles.filterButtonTextActive]}>
          Swap
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.filterButton, !selectedType && styles.filterButtonActive]}
        onPress={() => handleTypeFilter(undefined)}
      >
        <Text style={[styles.filterButtonText, !selectedType && styles.filterButtonTextActive]}>
          All
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadMoreButton = () => {
    if (!hasNextPage) return null;
    
    return (
      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={() => fetchNextPage()}
        disabled={isFetchingNextPage}
      >
        {isFetchingNextPage ? (
          <ActivityIndicator size="small" color={COLORS.solana} />
        ) : (
          <Text style={styles.loadMoreText}>Load More</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Transactions Found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery || selectedType 
          ? 'Try adjusting your search or filters'
          : 'Your transaction history will appear here'}
      </Text>
      <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
        <RefreshCw size={16} color={COLORS.solana} />
        <Text style={styles.syncButtonText}>Sync Transactions</Text>
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
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity 
          onPress={handleSync} 
          style={styles.syncHeaderButton}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <ActivityIndicator size="small" color={COLORS.solana} />
          ) : (
            <RefreshCw size={20} color={COLORS.solana} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by signature..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color={showFilters ? COLORS.background : COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && renderFilters()}

      {/* Transaction List */}
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        style={styles.transactionsList}
        contentContainerStyle={styles.transactionsContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={COLORS.solana}
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        ListFooterComponent={renderLoadMoreButton}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && transactions.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.solana} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'CONFIRMED':
      return COLORS.success + '20';
    case 'PENDING':
      return COLORS.warning + '20';
    case 'FAILED':
      return COLORS.error + '20';
    default:
      return COLORS.textSecondary + '20';
  }
};

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
  syncHeaderButton: {
    padding: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  searchInputContainer: {
    flex: 1,
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
  filterToggle: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
  },
  filterToggleActive: {
    backgroundColor: COLORS.solana,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  filterButtonActive: {
    backgroundColor: COLORS.solana,
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  filterButtonTextActive: {
    color: COLORS.background,
  },
  transactionsList: {
    flex: 1,
  },
  transactionsContent: {
    paddingHorizontal: SPACING.lg,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
    gap: SPACING.xs,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionType: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  transactionAmount: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  transactionMeta: {
    gap: 2,
  },
  transactionAddress: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  transactionTime: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.small,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    textTransform: 'uppercase' as const,
  },
  transactionFee: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  loadMoreButton: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  loadMoreText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.solana,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
    paddingHorizontal: SPACING.lg,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.solana + '20',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  syncButtonText: {
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
});