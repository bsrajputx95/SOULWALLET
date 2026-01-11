import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Animated } from 'react-native';
import { AlertCircle, RefreshCw, X, Clock } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { trpc } from '../lib/trpc';

type QueueHealth = 'healthy' | 'degraded' | 'down';

interface QueueStatus {
    activeJobs: number;
    health: QueueHealth;
}

interface QueueStatusBannerProps {
    /**
     * Threshold for active jobs to show "high load" warning
     * @default 50
     */
    highLoadThreshold?: number;
    /**
     * Callback when user requests retry of failed transactions
     */
    onRetry?: () => void;
    /**
     * Whether to allow dismissing the banner
     * @default true
     */
    dismissible?: boolean;
    /**
     * Custom placement styles
     */
    style?: any;
    /**
     * Test ID for E2E testing
     * @default 'queue-status-banner'
     */
    testID?: string;
}

/**
 * Banner that displays queue status for transparency about transaction processing.
 * Shows warnings when queue is busy or degraded.
 */
export const QueueStatusBanner: React.FC<QueueStatusBannerProps> = ({
    highLoadThreshold = 50,
    onRetry,
    dismissible = true,
    style,
    testID = 'queue-status-banner',
}) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const [pulseAnim] = useState(new Animated.Value(1));

    // Query queue status - polls every 30 seconds
    const { data: queueStatus, refetch } = trpc.queue.getStatus.useQuery(undefined, {
        refetchInterval: 30000,
        enabled: true,
        retry: false,
        onSuccess: (data: QueueStatus) => {
            if (data.health === 'healthy' && data.activeJobs <= highLoadThreshold) {
                setIsDismissed(false);
            }
        },
    });

    // Determine if banner should show
    const shouldShow = React.useMemo(() => {
        if (isDismissed) return false;
        if (!queueStatus) return false;

        const isHighLoad = queueStatus.activeJobs > highLoadThreshold;
        const isDegraded = queueStatus.health === 'degraded';
        const isDown = queueStatus.health === 'down';

        return isHighLoad || isDegraded || isDown;
    }, [queueStatus, highLoadThreshold, isDismissed]);

    // Pulse animation for attention
    useEffect(() => {
        if (shouldShow && queueStatus?.health !== 'healthy') {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.7,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
            return () => animation.stop();
        }
    }, [shouldShow, queueStatus?.health, pulseAnim]);

    if (!shouldShow) {
        return null;
    }

    const getMessage = (): { title: string; message: string; color: string } => {
        if (queueStatus?.health === 'down') {
            return {
                title: 'Service Unavailable',
                message: 'Transaction processing is temporarily unavailable. Please try again later.',
                color: COLORS.error,
            };
        }
        if (queueStatus?.health === 'degraded') {
            return {
                title: 'Service Degraded',
                message: 'Some transactions may be delayed. We\'re working to resolve this.',
                color: COLORS.warning,
            };
        }
        return {
            title: 'High Transaction Volume',
            message: `${queueStatus?.activeJobs || 0} transactions queued. Your transaction may take longer than usual.`,
            color: COLORS.solana,
        };
    };

    const { title, message, color } = getMessage();

    return (
        <Animated.View
            testID={testID}
            accessibilityLabel={testID}
            style={[styles.container, { borderLeftColor: color, opacity: pulseAnim }, style]}
        >
            <View style={styles.iconContainer}>
                {queueStatus?.health === 'down' ? (
                    <AlertCircle size={20} color={color} />
                ) : (
                    <Clock size={20} color={color} />
                )}
            </View>

            <View style={styles.content}>
                <Text style={[styles.title, { color }]}>{title}</Text>
                <Text style={styles.message}>{message}</Text>

                {onRetry && queueStatus?.health !== 'down' && (
                    <Pressable style={styles.retryButton} onPress={onRetry}>
                        <RefreshCw size={12} color={COLORS.textPrimary} />
                        <Text style={styles.retryText}>Retry Failed Transactions</Text>
                    </Pressable>
                )}
            </View>

            {dismissible && (
                <Pressable
                    style={styles.closeButton}
                    onPress={() => setIsDismissed(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={16} color={COLORS.textSecondary} />
                </Pressable>
            )}
        </Animated.View>
    );
};

/**
 * Hook to get queue status for custom implementations
 */
export const useQueueStatus = () => {
    const { data, isLoading, error, refetch } = trpc.queue.getStatus.useQuery(undefined, {
        refetchInterval: 30000,
        retry: false,
    });

    return {
        status: data,
        isLoading,
        error,
        refetch,
        isHealthy: data?.health === 'healthy',
        isDegraded: data?.health === 'degraded',
        isDown: data?.health === 'down',
        activeJobs: data?.activeJobs ?? 0,
    };
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.cardBackground,
        borderLeftWidth: 4,
        padding: SPACING.m,
        marginHorizontal: SPACING.m,
        marginVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.small,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        fontSize: 14,
        marginBottom: SPACING.xs,
    },
    message: {
        ...FONTS.phantomRegular,
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.s,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.small,
        marginTop: SPACING.s,
        alignSelf: 'flex-start',
        gap: SPACING.xs,
    },
    retryText: {
        ...FONTS.phantomMedium,
        color: COLORS.textPrimary,
        fontSize: 11,
    },
    closeButton: {
        padding: SPACING.xs,
        marginLeft: SPACING.s,
    },
});
