import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Activity } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING } from '../constants/theme';

interface TokenChartProps {
  symbol?: string;
  data?: number[];
  height?: number;
  showGrid?: boolean;
  color?: string;
}

const { width: screenWidth } = Dimensions.get('window');

export const TokenChart: React.FC<TokenChartProps> = ({
  symbol = 'SOL',
  data = [],
  height = 200,
  showGrid = true,
  color = COLORS.solana,
}) => {
  // Mock chart data if none provided
  const chartData = data.length > 0 ? data : generateMockData();

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{symbol} Price Chart</Text>
        <Text style={styles.subtitle}>24h Performance</Text>
      </View>
      
      <View style={styles.chartContainer}>
        {/* Placeholder for actual chart implementation */}
        <View style={styles.chartPlaceholder}>
          <Activity color={color} size={48} />
          <Text style={styles.placeholderText}>Chart Visualization</Text>
          <Text style={styles.placeholderSubtext}>
            TradingView or Chart.js integration would go here
          </Text>
        </View>
        
        {/* Mock price points */}
        <View style={styles.pricePoints}>
          {chartData.slice(0, 5).map((price, index) => (
            <View key={index} style={styles.pricePoint}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.priceText}>${price.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Real-time price data • Last updated: {new Date().toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );
};

// Generate mock price data
function generateMockData(): number[] {
  const basePrice = 100 + Math.random() * 900;
  const data: number[] = [];
  
  for (let i = 0; i < 24; i++) {
    const variation = (Math.random() - 0.5) * 20;
    data.push(Math.max(0.01, basePrice + variation));
  }
  
  return data;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.solana + '30',
  },
  header: {
    marginBottom: SPACING.m,
  },
  title: {
    ...FONTS.orbitronBold,
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  chartContainer: {
    flex: 1,
    position: 'relative',
  },
  chartPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background + '50',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.solana + '20',
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...FONTS.orbitronMedium,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginTop: SPACING.s,
  },
  placeholderSubtext: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  pricePoints: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.s,
  },
  pricePoint: {
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: SPACING.xs,
  },
  priceText: {
    ...FONTS.monospace,
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  footer: {
    marginTop: SPACING.m,
    paddingTop: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: COLORS.solana + '20',
  },
  footerText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});

export default TokenChart;