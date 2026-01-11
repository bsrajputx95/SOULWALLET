import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, Platform, Linking } from 'react-native';
import { X, Smartphone, AlertTriangle } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface WebPreviewBannerProps {
  onDismiss?: () => void;
  showAppStoreLinks?: boolean;
}

/**
 * Banner displayed on web builds to inform users about limited functionality
 * and recommend using the mobile app for full features.
 */
export const WebPreviewBanner: React.FC<WebPreviewBannerProps> = ({
  onDismiss,
  showAppStoreLinks = true,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Only show on web platform
  if (Platform.OS !== 'web' || !isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const openAppStore = () => {
    // Replace with actual app store links
    void Linking.openURL('https://apps.apple.com/app/soulwallet');
  };

  const openPlayStore = () => {
    // Replace with actual play store links
    void Linking.openURL('https://play.google.com/store/apps/details?id=io.soulwallet.app');
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <AlertTriangle size={20} color={COLORS.warning} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Web Preview Mode</Text>
        <Text style={styles.message}>
          Some wallet features (send, swap, tokens) are disabled on web.
          Download the mobile app for full functionality.
        </Text>

        {showAppStoreLinks && (
          <View style={styles.linksContainer}>
            <Pressable style={styles.storeButton} onPress={openAppStore}>
              <Smartphone size={14} color={COLORS.textPrimary} />
              <Text style={styles.storeButtonText}>iOS App</Text>
            </Pressable>
            <Pressable style={styles.storeButton} onPress={openPlayStore}>
              <Smartphone size={14} color={COLORS.textPrimary} />
              <Text style={styles.storeButtonText}>Android App</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Pressable style={styles.closeButton} onPress={handleDismiss}>
        <X size={16} color={COLORS.textSecondary} />
      </Pressable>
    </View>
  );
};

/**
 * Hook to check if running on web platform
 */
export const useIsWebPlatform = (): boolean => {
  return Platform.OS === 'web';
};

/**
 * Wrapper component that disables children on web with tooltip
 */
export const WebDisabledWrapper: React.FC<{
  children: React.ReactNode;
  tooltipText?: string;
}> = ({ children, tooltipText = 'This feature requires the mobile app' }) => {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View style={styles.disabledWrapper}>
      <View style={styles.disabledOverlay} />
      <View pointerEvents="none" style={styles.disabledChildren}>
        {children}
      </View>
      <View style={styles.tooltipContainer}>
        <Text style={styles.tooltipText}>{tooltipText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warning + '15',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    padding: SPACING.m,
    marginHorizontal: SPACING.m,
    marginVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
  },
  iconContainer: {
    marginRight: SPACING.s,
    paddingTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    ...FONTS.phantomBold,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  message: {
    ...FONTS.phantomRegular,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  linksContainer: {
    flexDirection: 'row',
    marginTop: SPACING.s,
    gap: SPACING.s,
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    gap: SPACING.xs,
  },
  storeButtonText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 11,
  },
  closeButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.s,
  },
  disabledWrapper: {
    position: 'relative',
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: BORDER_RADIUS.medium,
    zIndex: 1,
  },
  disabledChildren: {
    opacity: 0.5,
  },
  tooltipContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -15 }],
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.small,
    zIndex: 2,
  },
  tooltipText: {
    ...FONTS.phantomMedium,
    color: COLORS.textPrimary,
    fontSize: 11,
    textAlign: 'center',
  },
});
