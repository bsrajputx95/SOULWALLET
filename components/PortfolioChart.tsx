import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface PortfolioChartProps {
  data?: { timestamp: number; value: number }[];
  period?: '24h' | '7d' | '30d' | 'all';
  type?: 'line' | 'candle';
  totalValue?: number;
  change?: number;
  changePercent?: number;
}

const { width } = Dimensions.get('window');

export default function PortfolioChart({
  data = [],
  period = '24h',
  type = 'line',
  totalValue = 0,
  change = 0,
  changePercent = 0,
}: PortfolioChartProps) {
  const isPositive = change >= 0;
  
  // Generate mock chart points for visual representation
  const chartPoints = data.length > 0 ? data : generateMockData(period);
  const chartWidth = width - (SPACING.m * 2);
  const chartHeight = 200;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.cardBackground, COLORS.background]}
        style={styles.gradient}
      >
        {/* Portfolio Value Header */}
        <View style={styles.header}>
          <Text style={styles.totalValue}>
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.changeContainer}>
            {isPositive ? (
              <TrendingUp size={16} color={COLORS.success} />
            ) : (
              <TrendingDown size={16} color={COLORS.error} />
            )}
            <Text style={[styles.changeText, { color: isPositive ? COLORS.success : COLORS.error }]}>
              ${Math.abs(change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({Math.abs(changePercent).toFixed(2)}%)
            </Text>
          </View>
        </View>

        {/* Chart Area */}
        <View style={styles.chartContainer}>
          <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
            {/* Simple line chart representation */}
            <View style={styles.chartGrid}>
              {/* Grid lines */}
              {[...Array(5)].map((_, i) => (
                <View key={i} style={[styles.gridLine, { top: (chartHeight / 4) * i }]} />
              ))}
            </View>
            
            {/* Chart line */}
            <View style={styles.chartLine}>
              {chartPoints.map((point, index) => {
                const x = (index / (chartPoints.length - 1)) * chartWidth;
                const y = chartHeight - ((point.value - Math.min(...chartPoints.map(p => p.value))) / 
                  (Math.max(...chartPoints.map(p => p.value)) - Math.min(...chartPoints.map(p => p.value)))) * chartHeight;
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.chartPoint,
                      {
                        left: x - 2,
                        top: y - 2,
                        backgroundColor: isPositive ? COLORS.success : COLORS.error,
                      }
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['24h', '7d', '30d', 'all'] as const).map((p) => (
            <View
              key={p}
              style={[
                styles.periodButton,
                period === p && styles.periodButtonActive
              ]}
            >
              <Text style={[
                styles.periodText,
                period === p && styles.periodTextActive
              ]}>
                {p}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

function generateMockData(period: string) {
  const points = period === '24h' ? 24 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const baseValue = 1000;
  
  return Array.from({ length: points }, (_, i) => ({
    timestamp: Date.now() - (points - i) * (period === '24h' ? 3600000 : 86400000),
    value: baseValue + Math.random() * 200 - 100 + Math.sin(i / 5) * 50,
  }));
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.m,
    marginVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.large,
    overflow: 'hidden',
  },
  gradient: {
    padding: SPACING.m,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  totalValue: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  changeText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  chart: {
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.s,
  },
  chartGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  chartLine: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  chartPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.xs,
  },
  periodButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    opacity: 0.7,
  },
  periodTextActive: {
    opacity: 1,
    color: COLORS.text,
  },
});