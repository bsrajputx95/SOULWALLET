import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    Animated,
    TextInput,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

export interface AlertButton {
    text: string;
    onPress?: (value?: string) => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons: AlertButton[];
    onDismiss: () => void;
    /** If true, shows a secure text input (for PIN/password entry) */
    isPrompt?: boolean;
    /** Placeholder text for the input field */
    inputPlaceholder?: string;
    /** Whether the input should be secure (masked) */
    secureTextEntry?: boolean;
}



export const CustomAlert: React.FC<CustomAlertProps> = ({
    visible,
    title,
    message,
    buttons,
    onDismiss,
    isPrompt = false,
    inputPlaceholder = '',
    secureTextEntry = true,
}) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
    const [inputValue, setInputValue] = useState('');

    // Reset input when modal opens/closes
    useEffect(() => {
        if (!visible) {
            setInputValue('');
        }
    }, [visible]);

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.9);
        }
    }, [visible]);

    // Determine accent color from title
    const getAccentColor = () => {
        const t = title.toLowerCase();
        if (t.includes('error') || t.includes('failed') || t.includes('invalid')) return COLORS.error;
        if (t.includes('success') || t.includes('✅') || t.includes('copied') || t.includes('sold') || t.includes('bought')) return COLORS.success;
        if (t.includes('warning') || t.includes('caution') || t.includes('insufficient')) return COLORS.warning;
        return COLORS.solana;
    };

    const accentColor = getAccentColor();

    const getButtonStyle = (btn: AlertButton) => {
        if (btn.style === 'destructive') return { bg: COLORS.error + '20', text: COLORS.error };
        if (btn.style === 'cancel') return { bg: COLORS.background, text: COLORS.textSecondary };
        return { bg: accentColor + '20', text: accentColor };
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onDismiss}
            statusBarTranslucent
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onDismiss}
                />
                <Animated.View
                    style={[
                        styles.alertCard,
                        { transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    {/* Accent bar */}
                    <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

                    {/* Content */}
                    <View style={styles.contentContainer}>
                        {title ? (
                            <Text style={[styles.title, { color: accentColor }]}>
                                {title}
                            </Text>
                        ) : null}
                        {message ? (
                            <Text style={styles.message}>{message}</Text>
                        ) : null}

                        {/* Text Input for prompt mode */}
                        {isPrompt && (
                            <TextInput
                                style={styles.promptInput}
                                value={inputValue}
                                onChangeText={setInputValue}
                                placeholder={inputPlaceholder || 'Enter here...'}
                                placeholderTextColor={COLORS.textSecondary + '80'}
                                secureTextEntry={secureTextEntry}
                                autoFocus
                                keyboardType={secureTextEntry ? 'number-pad' : 'default'}
                                selectionColor={accentColor}
                            />
                        )}
                    </View>

                    {/* Buttons */}
                    <View style={[
                        styles.buttonContainer,
                        buttons.length === 1 && styles.buttonContainerSingle,
                    ]}>
                        {buttons.map((btn, index) => {
                            const btnStyle = getButtonStyle(btn);
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.button,
                                        { backgroundColor: btnStyle.bg },
                                        buttons.length === 1 && styles.buttonSingle,
                                    ]}
                                    onPress={() => {
                                        const val = inputValue;
                                        onDismiss();
                                        if (isPrompt) {
                                            btn.onPress?.(val);
                                        } else {
                                            btn.onPress?.();
                                        }
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.buttonText, { color: btnStyle.text }]}>
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    alertCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.large,
        width: '100%',
        maxWidth: 340,
        overflow: 'hidden',
    },
    accentBar: {
        height: 3,
        width: '100%',
    },
    contentContainer: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        paddingBottom: SPACING.m,
    },
    title: {
        ...FONTS.phantomBold,
        fontSize: 18,
        marginBottom: SPACING.s,
    },
    message: {
        ...FONTS.phantomRegular,
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    promptInput: {
        ...FONTS.monospace,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.medium,
        borderWidth: 1,
        borderColor: COLORS.solana + '40',
        paddingVertical: SPACING.s + 2,
        paddingHorizontal: SPACING.m,
        fontSize: 18,
        marginTop: SPACING.m,
        letterSpacing: 4,
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: COLORS.background,
        padding: SPACING.m,
        gap: SPACING.s,
    },
    buttonContainerSingle: {
        justifyContent: 'flex-end',
    },
    button: {
        flex: 1,
        paddingVertical: SPACING.s + 2,
        borderRadius: BORDER_RADIUS.medium,
        alignItems: 'center',
    },
    buttonSingle: {
        flex: 0,
        paddingHorizontal: SPACING.l,
    },
    buttonText: {
        ...FONTS.phantomBold,
        fontSize: 14,
    },
});

export default CustomAlert;
