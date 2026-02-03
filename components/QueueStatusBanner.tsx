import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, Animated } from 'react-native';
import { AlertCircle, RefreshCw, X, Clock, ChevronRight } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { checkCopyTradeQueue, CopyTradeQueueItem } from '../services/copyTrading';
import { useAuth } from '../contexts/AuthContext';

type QueueHealth = 'healthy' | 'degraded' | 'down';

interface QueueStatus {
    pendingCount: number;
    health: QueueHealth;
    items: CopyTradeQueueItem[];
}

interface QueueStatusBannerProps {
    /**
     * Threshold for pending items to show "high load" warning
     * @default 5
     */
    highLoadThreshold?: number;
    /**
     * Callback when user taps to view/execute pending trades
     */
    onViewQueue?: () => void;
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
    /**
     * Poll interval in milliseconds
     * @default 30000 (30 seconds)
     */
    pollInterval?: number;
}

/**
 * Banner that displays copy trade queue status.
 * Shows pending copy trades and allows navigation to execution.
 */
export const QueueStatusBanner: React.FC<QueueStatusBannerProps> = ({
    highLoadThreshold = 5,
    onViewQueue,
    dismissible = true,
    style,
    testID = 'queue-status-banner',
    pollInterval = 30000,
}) => {
    const { token } = useAuth();
    const [isDismissed, setIsDismissed] = useState(false);
    const [pulseAnim] = useState(new Animated.Value(1));
    const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchQueueStatus = useCallback(async () => {
        if (!token) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const result = await checkCopyTradeQueue(token);
            
            if (result.success && result.queue) {
                const pendingItems = result.queue.filter(item => item.status === 'pending');
                const pendingCount = pendingItems.length;
                
                // Determine health based on pending count and expiration
                let health: QueueHealth = 'healthy';
                const now = Date.now();
                const hasExpired = pendingItems.some(item => 
                    new Date(item.expiresAt).getTime() < now
                );
                
                if (hasExpired) {
                    health = 'degraded';
                } else if (pendingCount === 0) {
                    health = 'healthy';
                } else if (pendingCount > highLoadThreshold) {
                    health = 'degraded';
                }
                
                setQueueStatus({
                    pendingCount,
                    health,
                    items: pendingItems
                });
            } else {
                setError(result.error || 'Failed to fetch queue');
                setQueueStatus({ pendingCount: 0, health: 'down', items: [] });
            }
        } catch (err: any) {
            setError(err.message);
            setQueueStatus({ pendingCount: 0, health: 'down', items: [] });
        } finally {
            setIsLoading(false);
        }
    }, [token, highLoadThreshold]);

    // Initial fetch and polling
    useEffect(() => {
        fetchQueueStatus();
        
        const interval = setInterval(fetchQueueStatus, pollInterval);
        return () => clearInterval(interval);
    }, [fetchQueueStatus, pollInterval]);

    // Determine if banner should show
    const shouldShow = React.useMemo(() => {
        if (isDismissed) return false;
        if (!queueStatus) return false;
        
        const hasPending = queueStatus.pendingCount > 0;
        const isDegraded = queueStatus.health === 'degraded';
        const isDown = queueStatus.health === 'down';
        
        return hasPending || isDegraded || isDown;
    }, [queueStatus, isDismissed]);

    // Pulse animation for attention when pending
    useEffect(() => {
        if (shouldShow && queueStatus && queueStatus.pendingCount > 0) {
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
        return undefined;
    }, [shouldShow, queueStatus?.pendingCount, pulseAnim]);

    if (!shouldShow) {
        return null;
    }

    const getMessage = (): { title: string; message: string; color: string; icon: React.ReactNode } => {
        if (queueStatus?.health === 'down' || error) {
            return {
                title: 'Queue Unavailable',
                message: 'Unable to check copy trade queue. Please try again later.',
                color: COLORS.error,
                icon: <AlertCircle size={20} color={COLORS.error} />
            };
        }
        if (queueStatus?.health === 'degraded') {
            return {
                title: 'Queue Degraded',
                message: 'Some copy trades may be delayed. Tap to review.',
                color: COLORS.warning,
                icon: <Clock size={20} color={COLORS.warning} />
            };
        }
        if (queueStatus && queueStatus.pendingCount > 0) {
            const count = queueStatus.pendingCount;
            return {
                title: `${count} Pending Copy Trade${count > 1 ? 's' : ''}`,
                message: 'Trades waiting for your approval. Tap to execute.',
                color: COLORS.solana,
                icon: <Clock size={20} color={COLORS.solana} />
            };
        }
        return {
            title: 'Queue Status',
            message: 'Checking queue status...',
            color: COLORS.textSecondary,
            icon: <Clock size={20} color={COLORS.textSecondary} />
        };
    };

    const { title, message, color, icon } = getMessage();

    const handlePress = () => {
        if (onViewQueue && queueStatus && queueStatus.pendingCount > 0) {
            onViewQueue();
        }
    };

    const handleRefresh = (e: any) => {
        e.stopPropagation();
        fetchQueueStatus();
    };

    return (
        <Animated.View
            testID={testID}
            accessibilityLabel={testID}
            style={[styles.container, { borderLeftColor: color, opacity: pulseAnim }, style]}
        >
            <Pressable style={styles.contentWrapper} onPress={handlePress}>
                <View style={styles.iconContainer}>
                    {icon}
                </View>

                <View style={styles.content}>
                    <Text style={[styles.title, { color }]}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                </View>

                <View style={styles.actions}>
                    {queueStatus && queueStatus.pendingCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{queueStatus.pendingCount}</Text>
                        </View>
                    )}
                    
                    <Pressable 
                        style={styles.refreshButton} 
                        onPress={handleRefresh}
                        disabled={isLoading}
                    >
                        <RefreshCw 
                            size={16} 
                            color={COLORS.textSecondary} 
                            style={isLoading ? styles.spinning : undefined}
                        />
                    </Pressable>

                    {queueStatus && queueStatus.pendingCount > 0 && onViewQueue && (
                        <ChevronRight size={20} color={COLORS.textSecondary} />
                    )}

                    {dismissible && (
                        <Pressable
                            style={styles.closeButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                setIsDismissed(true);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <X size={16} color={COLORS.textSecondary} />
                        </Pressable>
                    )}
                </View>
            </Pressable>
        </Animated.View>
    );
};

/**
 * Hook to get queue status for custom implementations
 */
export const useQueueStatus = (pollInterval = 30000) => {
    const { token } = useAuth();
    const [status, setStatus] = useState<QueueStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        if (!token) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const result = await checkCopyTradeQueue(token);
            
            if (result.success && result.queue) {
                const pendingItems = result.queue.filter(item => item.status === 'pending');
                const pendingCount = pendingItems.length;
                
                let health: QueueHealth = 'healthy';
                const now = Date.now();
                const hasExpired = pendingItems.some(item => 
                    new Date(item.expiresAt).getTime() < now
                );
                
                if (hasExpired) {
                    health = 'degraded';
                } else if (pendingCount === 0) {
                    health = 'healthy';
                }
                
                setStatus({
                    pendingCount,
                    health,
                    items: pendingItems
                });
            } else {
                setError(result.error || 'Failed to fetch');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, pollInterval);
        return () => clearInterval(interval);
    }, [fetchStatus, pollInterval]);

    return {
        status,
        isLoading,
        error,
        refetch: fetchStatus,
        isHealthy: status?.health === 'healthy',
        isDegraded: status?.health === 'degraded',
        isDown: status?.health === 'down' || !!error,
        pendingCount: status?.pendingCount ?? 0,
    };
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderLeftWidth: 4,
        marginHorizontal: SPACING.m,
        marginVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.small,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    contentWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
    },
    iconContainer: {
        marginRight: SPACING.s,
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
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    badge: {
        backgroundColor: COLORS.solana,
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xs,
    },
    badgeText: {
        ...FONTS.phantomBold,
        color: '#000',
        fontSize: 12,
    },
    refreshButton: {
        padding: SPACING.xs,
    },
    spinning: {
        transform: [{ rotate: '45deg' }],
    },
    closeButton: {
        padding: SPACING.xs,
    },
});
