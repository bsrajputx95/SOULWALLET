import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/theme';

interface NotificationTabBadgeProps {
    count: number;
}

export const NotificationTabBadge: React.FC<NotificationTabBadgeProps> = ({ count }) => {
    if (count <= 0) return null;

    return (
        <View style={styles.badge}>
            <Text style={styles.badgeText}>
                {count > 99 ? '99+' : count}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: COLORS.error || '#FF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        ...FONTS.sfProMedium,
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});
