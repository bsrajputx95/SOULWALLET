import React, { memo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';

interface PortfolioChartsProps {
  selectedPeriod: string;
  portfolioData: any[];
  totalValue: number;
  change24h: number;
}

const { width } = Dimensions.get('window');

const PortfolioCharts = memo<PortfolioChartsProps>(({
  selectedPeriod,
  portfolioData,
  totalValue,
  change24h,
}) => {
  // Mock chart data - in real app this would be actual chart implementation
  const chartData = portfolioData.map((_, index) => ({
    x: index,
    y: 50 + ((index * 37 + selectedPeriod.length * 17) % 100),
  }));

  return (
    <View style={styles.container}>
      {/* Portfolio Value Header */}
      <View style={styles.valueContainer}>
        <Text style={styles.totalValue}>
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={[
          styles.change,
          { color: change24h >= 0 ? COLORS.success : COLORS.error }
        ]}>
          {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
        </Text>
      </View>

      {/* Chart Placeholder */}
      <View style={styles.chartContainer}>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartText}>Portfolio Chart</Text>
          <Text style={styles.chartSubtext}>Period: {selectedPeriod}</Text>
          
          {/* Simple line representation */}
          <View style={styles.lineChart}>
            {chartData.map((point, index) => (
              <View
                key={index}
                style={[
                  styles.chartPoint,
                  {
                    left: (point.x / chartData.length) * (width - 80),
                    bottom: (point.y / 150) * 100,
                  }
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Chart Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>High</Text>
          <Text style={styles.statValue}>
            ${(totalValue * 1.15).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Low</Text>
          <Text style={styles.statValue}>
            ${(totalValue * 0.85).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Volume</Text>
          <Text style={styles.statValue}>
            ${(totalValue * 0.1).toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  change: {
    fontSize: 16,
    fontWeight: '600',
  },
  chartContainer: {
    marginBottom: 24,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  chartText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  chartSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  lineChart: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  chartPoint: {
    position: 'absolute',
    width: 3,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});

// ✅ React.memo for performance optimization
PortfolioCharts.displayName = 'PortfolioCharts';

export default PortfolioCharts;
