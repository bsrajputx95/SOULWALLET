import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  RefreshCw,
  Camera,
  ArrowLeft,
  Activity
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonCard } from '../components/NeonCard';
import { NeonButton } from '../components/NeonButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { trpc } from '../lib/trpc';

type Period = '1D' | '7D' | '30D' | '90D' | '1Y';
type ChartType = 'value' | 'performance' | 'breakdown';

interface PortfolioSnapshot {
  id: string;
  totalValueUSD: number;
  tokens: any;
  timestamp: string;
}

interface PerformanceMetrics {
  period: string;
  totalReturn: number;
  totalReturnPercentage: number;
  highestValue: number;
  lowestValue: number;
  averageValue: number;
  snapshotCount?: number;
}

export default function PortfolioTrackingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 375;
  const responsivePadding = isSmallScreen ? SPACING.xs : SPACING.s;

  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('7D');
  const [chartType, setChartType] = useState<ChartType>('value');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // tRPC queries
  const portfolioOverview = trpc.portfolio.getOverview.useQuery();
  const portfolioHistory = trpc.portfolio.getHistory.useQuery({
    period: selectedPeriod,
    limit: 100,
  });
  const portfolioPerformance = trpc.portfolio.getPerformance.useQuery({
    period: selectedPeriod,
  });
  const assetBreakdown = trpc.portfolio.getAssetBreakdown.useQuery();

  // tRPC mutations
  const createSnapshot = trpc.portfolio.createSnapshot.useMutation({
    onSuccess: () => {
      Alert.alert('Success', 'Portfolio snapshot created successfully');
      void portfolioHistory.refetch();
      void portfolioOverview.refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      portfolioOverview.refetch(),
      portfolioHistory.refetch(),
      portfolioPerformance.refetch(),
      assetBreakdown.refetch(),
    ]);
    setRefreshing(false);
  };

  const handleCreateSnapshot = () => {
    Alert.alert(
      'Create Snapshot',
      'This will capture your current portfolio value for tracking purposes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create', onPress: () => createSnapshot.mutate() },
      ]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const renderPortfolioOverview = () => {
    if (portfolioOverview.isLoading) {
      return (
        <NeonCard style={styles.overviewCard}>
          <LoadingSpinner />
        </NeonCard>
      );
    }

    const data = portfolioOverview.data;
    if (!data) return null;

    const isPositive = data.change24h >= 0;

    return (
      <NeonCard style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>Portfolio Value</Text>
          <Pressable
            style={styles.snapshotButton}
            onPress={handleCreateSnapshot}
            disabled={createSnapshot.isPending}
          >
            <Camera size={16} color={COLORS.solana} />
          </Pressable>
        </View>
        
        <Text style={styles.totalValue}>
                  {formatCurrency(data.totalValue)}
        </Text>
        
        <View style={styles.changeContainer}>
          {isPositive ? (
            <TrendingUp size={16} color={COLORS.success} />
          ) : (
            <TrendingDown size={16} color={COLORS.error} />
          )}
          <Text style={[
            styles.changeText,
            { color: isPositive ? COLORS.success : COLORS.error }
          ]}>
            {formatPercentage(data.change24h)} (24h)
          </Text>
        </View>

        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>SOL Balance</Text>
          <Text style={styles.balanceValue}>
            {data.solBalance.toFixed(4)} SOL
          </Text>
          <Text style={styles.balanceUsd}>
            ≈ {formatCurrency(data.solBalance * data.solPrice)}
          </Text>
        </View>
      </NeonCard>
    );
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodContainer}>
      <Text style={styles.sectionTitle}>Time Period</Text>
      <View style={styles.periodSelector}>
        {(['1D', '7D', '30D', '90D', '1Y'] as Period[]).map((period) => (
          <Pressable
            key={period}
            style={[
              styles.periodOption,
              selectedPeriod === period && styles.activePeriodOption,
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.periodOptionText,
              selectedPeriod === period && styles.activePeriodOptionText,
            ]}>
              {period}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderChartTypeSelector = () => (
    <View style={styles.chartTypeContainer}>
      <Text style={styles.sectionTitle}>Chart Type</Text>
      <View style={styles.chartTypeSelector}>
        <Pressable
          style={[
            styles.chartTypeOption,
            chartType === 'value' && styles.activeChartTypeOption,
          ]}
          onPress={() => setChartType('value')}
        >
          <BarChart3 size={16} color={chartType === 'value' ? COLORS.solana : COLORS.textSecondary} />
          <Text style={[
            styles.chartTypeText,
            chartType === 'value' && styles.activeChartTypeText,
          ]}>
            Value
          </Text>
        </Pressable>
        
        <Pressable
          style={[
            styles.chartTypeOption,
            chartType === 'performance' && styles.activeChartTypeOption,
          ]}
          onPress={() => setChartType('performance')}
        >
          <Activity size={16} color={chartType === 'performance' ? COLORS.solana : COLORS.textSecondary} />
          <Text style={[
            styles.chartTypeText,
            chartType === 'performance' && styles.activeChartTypeText,
          ]}>
            Performance
          </Text>
        </Pressable>
        
        <Pressable
          style={[
            styles.chartTypeOption,
            chartType === 'breakdown' && styles.activeChartTypeOption,
          ]}
          onPress={() => setChartType('breakdown')}
        >
          <PieChart size={16} color={chartType === 'breakdown' ? COLORS.solana : COLORS.textSecondary} />
          <Text style={[
            styles.chartTypeText,
            chartType === 'breakdown' && styles.activeChartTypeText,
          ]}>
            Assets
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderValueChart = () => {
    if (portfolioHistory.isLoading) {
      return (
        <View style={styles.chartPlaceholder}>
          <LoadingSpinner />
          <Text style={styles.chartPlaceholderText}>Loading chart data...</Text>
        </View>
      );
    }

    const snapshots = portfolioHistory.data?.snapshots || [];
    
    if (snapshots.length === 0) {
      return (
        <View style={styles.chartPlaceholder}>
          <BarChart3 size={48} color={COLORS.textSecondary} />
          <Text style={styles.chartPlaceholderText}>No data available</Text>
          <Text style={styles.chartPlaceholderSubtext}>
            Create a snapshot to start tracking
          </Text>
        </View>
      );
    }

    // Simple line chart representation
    const maxValue = Math.max(...snapshots.map(s => s.totalValueUSD));
    const minValue = Math.min(...snapshots.map(s => s.totalValueUSD));
    const range = maxValue - minValue || 1;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartArea}>
          {snapshots.map((snapshot, index) => {
            const x = (index / (snapshots.length - 1 || 1)) * (width - 80);
            const y = ((snapshot.totalValueUSD - minValue) / range) * 120;
            
            return (
              <View
                key={snapshot.id}
                style={[
                  styles.chartPoint,
                  {
                    left: x,
                    bottom: y + 20,
                  }
                ]}
              />
            );
          })}
          
          {/* Connect points with lines */}
          {snapshots.map((_, index) => {
            if (index === snapshots.length - 1) return null;
            
            const x1 = (index / (snapshots.length - 1)) * (width - 80);
            const x2 = ((index + 1) / (snapshots.length - 1)) * (width - 80);
            const y1 = ((snapshots[index].totalValueUSD - minValue) / range) * 120;
            const y2 = ((snapshots[index + 1].totalValueUSD - minValue) / range) * 120;
            
            const lineWidth = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
            
            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.chartLine,
                  {
                    left: x1,
                    bottom: y1 + 20,
                    width: lineWidth,
                    transform: [{ rotate: `${angle}deg` }],
                  }
                ]}
              />
            );
          })}
        </View>
        
        <View style={styles.chartLabels}>
          <Text style={styles.chartLabel}>{formatCurrency(minValue)}</Text>
          <Text style={styles.chartLabel}>{formatCurrency(maxValue)}</Text>
        </View>
      </View>
    );
  };

  const renderPerformanceMetrics = () => {
    if (portfolioPerformance.isLoading) {
      return (
        <NeonCard style={styles.metricsCard}>
          <LoadingSpinner />
        </NeonCard>
      );
    }

    const metrics = portfolioPerformance.data;
    if (!metrics) return null;

    return (
      <NeonCard style={styles.metricsCard}>
        <Text style={styles.metricsTitle}>Performance Metrics</Text>
        
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Return</Text>
            <Text style={[
              styles.metricValue,
              { color: metrics.totalReturn >= 0 ? COLORS.success : COLORS.error }
            ]}>
              {formatCurrency(metrics.totalReturn)}
            </Text>
            <Text style={[
              styles.metricPercentage,
              { color: metrics.totalReturn >= 0 ? COLORS.success : COLORS.error }
            ]}>
              {formatPercentage(metrics.totalReturnPercentage)}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Highest Value</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(metrics.highestValue)}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Lowest Value</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(metrics.lowestValue)}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Average Value</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(metrics.averageValue)}
            </Text>
          </View>
        </View>
        
        {metrics.snapshotCount && (
          <Text style={styles.snapshotCount}>
            Based on {metrics.snapshotCount} snapshots
          </Text>
        )}
      </NeonCard>
    );
  };

  const renderAssetBreakdown = () => {
    if (assetBreakdown.isLoading) {
      return (
        <NeonCard style={styles.breakdownCard}>
          <LoadingSpinner />
        </NeonCard>
      );
    }

    const assets = assetBreakdown.data?.assets || [];
    
    return (
      <NeonCard style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Asset Breakdown</Text>
        
        {assets.length === 0 ? (
          <View style={styles.emptyBreakdown}>
            <PieChart size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyBreakdownText}>No assets found</Text>
          </View>
        ) : (
          <View style={styles.assetsList}>
            {assets.map((asset: any, index: number) => (
              <View key={index} style={styles.assetItem}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                  <Text style={styles.assetBalance}>
                    {asset.balance.toFixed(4)} {asset.symbol}
                  </Text>
                </View>
                <View style={styles.assetValue}>
                  <Text style={styles.assetValueText}>
                    {formatCurrency(asset.value)}
                  </Text>
                  <Text style={styles.assetPercentage}>
                    {asset.percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </NeonCard>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: responsivePadding }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Portfolio Tracking</Text>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <RefreshCw size={24} color={COLORS.solana} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingHorizontal: responsivePadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderPortfolioOverview()}
        
        {renderPeriodSelector()}
        
        {renderChartTypeSelector()}
        
        <NeonCard style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              {chartType === 'value' && 'Portfolio Value Chart'}
              {chartType === 'performance' && 'Performance Chart'}
              {chartType === 'breakdown' && 'Asset Breakdown'}
            </Text>
          </View>
          
          {chartType === 'value' && renderValueChart()}
          {chartType === 'performance' && renderPerformanceMetrics()}
          {chartType === 'breakdown' && renderAssetBreakdown()}
        </NeonCard>
        
        {chartType === 'value' && renderPerformanceMetrics()}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.m,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  overviewCard: {
    marginBottom: SPACING.l,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  overviewTitle: {
    ...FONTS.orbitronMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  snapshotButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.solana + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: SPACING.s,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  changeText: {
    ...FONTS.monospace,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  balanceInfo: {
    alignItems: 'center',
  },
  balanceLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  balanceValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  balanceUsd: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  periodContainer: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.s,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
  },
  periodOption: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.small,
  },
  activePeriodOption: {
    backgroundColor: COLORS.solana + '30',
  },
  periodOptionText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  activePeriodOptionText: {
    color: COLORS.solana,
  },
  chartTypeContainer: {
    marginBottom: SPACING.l,
  },
  chartTypeSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
  },
  chartTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
  },
  activeChartTypeOption: {
    backgroundColor: COLORS.solana + '30',
  },
  chartTypeText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: SPACING.xs,
  },
  activeChartTypeText: {
    color: COLORS.solana,
  },
  chartCard: {
    marginBottom: SPACING.l,
  },
  chartHeader: {
    marginBottom: SPACING.m,
  },
  chartTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  chartContainer: {
    height: 200,
    position: 'relative',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  chartPoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.solana,
  },
  chartLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: COLORS.solana + '80',
    transformOrigin: 'left center',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.s,
  },
  chartLabel: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  chartPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
  },
  chartPlaceholderText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: SPACING.s,
  },
  chartPlaceholderSubtext: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  metricsCard: {
    marginBottom: SPACING.l,
  },
  metricsTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.m,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  metricLabel: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  metricValue: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  metricPercentage: {
    ...FONTS.monospace,
    fontSize: 14,
    fontWeight: '600',
  },
  snapshotCount: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.s,
  },
  breakdownCard: {
    marginBottom: SPACING.l,
  },
  breakdownTitle: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.m,
  },
  emptyBreakdown: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyBreakdownText: {
    ...FONTS.sfProMedium,
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: SPACING.s,
  },
  assetsList: {
    gap: SPACING.s,
  },
  assetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.m,
  },
  assetInfo: {
    flex: 1,
  },
  assetSymbol: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  assetBalance: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  assetValue: {
    alignItems: 'flex-end',
  },
  assetValueText: {
    ...FONTS.monospace,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  assetPercentage: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});
