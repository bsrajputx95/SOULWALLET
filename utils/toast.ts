import { Platform, ToastAndroid, Alert } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

/**
 * Cross-platform toast notification utility
 * Uses ToastAndroid on Android, Alert on iOS (with auto-dismiss timing)
 */
export const showToast = (message: string, type: ToastType = 'info', duration: 'short' | 'long' = 'short') => {
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const fullMessage = `${emoji} ${message}`;

    if (Platform.OS === 'android') {
        ToastAndroid.show(fullMessage, duration === 'short' ? ToastAndroid.SHORT : ToastAndroid.LONG);
    } else {
        // iOS doesn't have native toast, use subtle Alert
        // For true toast behavior on iOS, consider a library like react-native-toast-message
        Alert.alert('', fullMessage);
    }
};

/**
 * Success toast
 */
export const showSuccessToast = (message: string) => {
    showToast(message, 'success', 'short');
};

/**
 * Error toast
 */
export const showErrorToast = (message: string) => {
    showToast(message, 'error', 'long');
};

/**
 * Info toast
 */
export const showInfoToast = (message: string) => {
    showToast(message, 'info', 'short');
};
