import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { X, Filter, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { NeonCard } from './NeonCard';
import { NeonButton } from './NeonButton';

interface AdvancedFiltersProps {
  onApplyFilters: (filters: any) => void;
  onClose: () => void;
}

export default function AdvancedFilters({ onApplyFilters, onClose }: AdvancedFiltersProps) {
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [volumeRange, setVolumeRange] = useState({ min: '', max: '' });
  const [marketCapRange, setMarketCapRange] = useState({ min: '', max: '' });
  const [showGainersOnly, setShowGainersOnly] = useState(false);
  const [showLosersOnly, setShowLosersOnly] = useState(false);
  const [minLiquidity, setMinLiquidity] = useState('');

  const handleApplyFilters = () => {
    const filters = {
      priceRange,
      volumeRange,
      marketCapRange,
      showGainersOnly,
      showLosersOnly,
      minLiquidity,
    };
    onApplyFilters(filters);
    onClose();
  };

  const handleResetFilters = () => {
    setPriceRange({ min: '', max: '' });
    setVolumeRange({ min: '', max: '' });
    setMarketCapRange({ min: '', max: '' });
    setShowGainersOnly(false);
    setShowLosersOnly(false);
    setMinLiquidity('');
  };

  return (
    <View style={styles.container}>
      <NeonCard style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Filter size={24} color={COLORS.primary} />
            <Text style={styles.title}>Advanced Filters</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={COLORS.text} />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Price Range */}
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Price Range</Text>
            <View style={styles.rangeContainer}>
              <View style={styles.rangeInput}>
                <DollarSign size={16} color={COLORS.textSecondary} />
                <Text style={styles.rangeLabel}>Min</Text>
              </View>
              <View style={styles.rangeInput}>
                <DollarSign size={16} color={COLORS.textSecondary} />
                <Text style={styles.rangeLabel}>Max</Text>
              </View>
            </View>
          </View>

          {/* Volume Range */}
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>24h Volume</Text>
            <View style={styles.rangeContainer}>
              <View style={styles.rangeInput}>
                <Activity size={16} color={COLORS.textSecondary} />
                <Text style={styles.rangeLabel}>Min Volume</Text>
              </View>
              <View style={styles.rangeInput}>
                <Activity size={16} color={COLORS.textSecondary} />
                <Text style={styles.rangeLabel}>Max Volume</Text>
              </View>
            </View>
          </View>

          {/* Market Cap Range */}
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Market Cap</Text>
            <View style={styles.rangeContainer}>
              <View style={styles.rangeInput}>
                <TrendingUp size={16} color={COLORS.textSecondary} />
                <Text style={styles.rangeLabel}>Min Cap</Text>
              </View>
              <View style={styles.rangeInput}>
                <TrendingUp size={16} color={COLORS.textSecondary} />
                <Text style={styles.rangeLabel}>Max Cap</Text>
              </View>
            </View>
          </View>

          {/* Performance Filters */}
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Performance</Text>
            <View style={styles.switchContainer}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <TrendingUp size={16} color={COLORS.success} />
                  <Text style={styles.switchText}>Gainers Only</Text>
                </View>
                <Switch
                  value={showGainersOnly}
                  onValueChange={setShowGainersOnly}
                  trackColor={{ false: COLORS.cardBackground, true: COLORS.success }}
                  thumbColor={showGainersOnly ? COLORS.background : COLORS.textSecondary}
                />
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <TrendingDown size={16} color={COLORS.error} />
                  <Text style={styles.switchText}>Losers Only</Text>
                </View>
                <Switch
                  value={showLosersOnly}
                  onValueChange={setShowLosersOnly}
                  trackColor={{ false: COLORS.cardBackground, true: COLORS.error }}
                  thumbColor={showLosersOnly ? COLORS.background : COLORS.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Liquidity Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Minimum Liquidity</Text>
            <View style={styles.rangeInput}>
              <DollarSign size={16} color={COLORS.textSecondary} />
              <Text style={styles.rangeLabel}>Min Liquidity</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <NeonButton
            title="Reset"
            onPress={handleResetFilters}
            variant="secondary"
            style={styles.resetButton}
          />
          <NeonButton
            title="Apply Filters"
            onPress={handleApplyFilters}
            style={styles.applyButton}
          />
        </View>
      </NeonCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  scrollView: {
    flex: 1,
  },
  filterSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  rangeContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rangeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rangeLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  switchContainer: {
    gap: SPACING.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  switchText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  resetButton: {
    flex: 1,
  },
  applyButton: {
    flex: 2,
  },
});