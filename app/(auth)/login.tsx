import React, { useState, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Platform,
    Image,
    StatusBar,
    Keyboard,
    ScrollView,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants';
import { NeonButton, GlowingText } from '@/components';
import { api } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { persistAuthSession } from '@/utils/session';

const logoImage = require('../../assets/images/icon-rounded.png');

// Validation types
type ValidationError = {
    message: string;
    isError: boolean;
};

type FieldErrors = {
    email: ValidationError | null;
    password: ValidationError | null;
    general: string | null;
};

export default function LoginNewScreen() {
    const router = useRouter();
    const { setToken } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({
        email: null,
        password: null,
        general: null,
    });
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [betaAcknowledged, setBetaAcknowledged] = useState(false);

    const passwordInputRef = useRef<TextInput>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // Real-time validation functions
    const validateEmail = useCallback((value: string): ValidationError | null => {
        const trimmed = value.trim();

        if (!trimmed) {
            return { message: 'Email or username is required', isError: true };
        }

        // Check if it looks like an email
        if (trimmed.includes('@')) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmed)) {
                return { message: 'Please enter a valid email address', isError: true };
            }
        } else {
            // It's a username - check for valid characters
            if (trimmed.length < 3) {
                return { message: 'Username must be at least 3 characters', isError: true };
            }
            if (/[A-Z]/.test(trimmed)) {
                return { message: 'Use lowercase letters only (no capitals)', isError: true };
            }
            if (/\s/.test(trimmed)) {
                return { message: 'Username cannot contain spaces', isError: true };
            }
            if (!/^[a-z0-9_]+$/.test(trimmed)) {
                return { message: 'Only letters, numbers, and underscores allowed', isError: true };
            }
        }

        return null; // No validation message for valid input
    }, []);

    const validatePassword = useCallback((value: string): ValidationError | null => {
        if (!value) {
            return { message: 'Password is required', isError: true };
        }

        if (value.length < 6) {
            return { message: 'Password must be at least 6 characters', isError: true };
        }

        return null;
    }, []);

    // Handle input changes with real-time validation
    const handleEmailChange = (text: string) => {
        setEmail(text);
        if (touched.email) {
            const validation = validateEmail(text);
            setErrors(prev => ({ ...prev, email: validation }));
        }
        // Clear general error when user starts typing
        if (errors.general) {
            setErrors(prev => ({ ...prev, general: null }));
        }
    };

    const handlePasswordChange = (text: string) => {
        setPassword(text);
        if (touched.password) {
            const validation = validatePassword(text);
            setErrors(prev => ({ ...prev, password: validation }));
        }
        if (errors.general) {
            setErrors(prev => ({ ...prev, general: null }));
        }
    };

    // Handle field blur (validation)
    const handleEmailBlur = () => {
        setTouched(prev => ({ ...prev, email: true }));
        const validation = validateEmail(email);
        setErrors(prev => ({ ...prev, email: validation }));
    };

    const handlePasswordBlur = () => {
        setTouched(prev => ({ ...prev, password: true }));
        const validation = validatePassword(password);
        setErrors(prev => ({ ...prev, password: validation }));
    };

    const getLoginErrorMessage = (error: unknown): string => {
        if (!(error instanceof Error)) {
            return 'Something went wrong. Please try again.';
        }

        if (error.message.includes('Network request failed')) {
            return 'Network error. Please check your connection.';
        }

        if (error.message.includes('Too many authentication attempts')) {
            return 'Too many attempts. Please wait a bit and try again.';
        }

        if (error.message.includes('Invalid credentials')) {
            return 'Invalid email/username or password. Please try again.';
        }

        return error.message || 'Login failed. Please try again.';
    };

    const handleLogin = async () => {
        if (isLoading) {
            return;
        }
        Keyboard.dismiss();

        // Mark all fields as touched
        setTouched({ email: true, password: true });

        // Validate all fields
        const emailValidation = validateEmail(email);
        const passwordValidation = validatePassword(password);

        setErrors({
            email: emailValidation,
            password: passwordValidation,
            general: null,
        });

        // Check if any validation failed
        if (emailValidation?.isError || passwordValidation?.isError) {
            if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            return;
        }

        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setIsLoading(true);
        setErrors(prev => ({ ...prev, general: null }));

        try {
            const data = await api.post<{
                token: string;
                user: unknown;
                error?: string;
            }>('/login', {
                emailOrUsername: email.trim(),
                password,
            });

            if (!data.token) {
                throw new Error('Login failed. Please try again.');
            }
            await persistAuthSession(data.token, data.user);
            setToken(data.token);

            // Navigate to main app on success
            router.replace('/(tabs)');
        } catch (error: unknown) {
            setErrors(prev => ({ ...prev, general: getLoginErrorMessage(error) }));
            // Scroll to top so user can see the error message
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Get input border color based on validation state
    const getInputBorderColor = (error: ValidationError | null, isTouched: boolean) => {
        if (!isTouched || !error) return COLORS.textSecondary + '50';
        return error.isError ? COLORS.error : COLORS.textSecondary + '50';
    };

    // Helper to render helper text
    const renderHelperText = (error: ValidationError | null, isTouched: boolean) => {
        if (!isTouched || !error || !error.isError) {
            return null;
        }

        return (
            <Text style={styles.helperTextError}>
                {error.message}
            </Text>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.container}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    <View style={styles.inner}>
                        {/* Logo */}
                        <View style={styles.logoContainer}>
                            <Image source={logoImage} style={styles.logoImage} />
                        </View>

                        {/* Header */}
                        <View style={styles.headerContainer}>
                            <GlowingText text="WELCOME BACK" fontSize={24} style={styles.title} />
                            <Text style={styles.subtitle}>Log in to continue</Text>
                        </View>

                        {/* General Error Message */}
                        {errors.general && (
                            <View style={styles.errorContainer}>
                                <AlertCircle size={18} color={COLORS.error} style={styles.errorIcon} />
                                <Text style={styles.errorText}>{errors.general}</Text>
                            </View>
                        )}

                        {/* Email Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Username/Email</Text>
                            <View style={[
                                styles.inputWrapper,
                                { borderColor: getInputBorderColor(errors.email, !!touched.email) }
                            ]}>
                                <Mail size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your username or email"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={email}
                                    onChangeText={handleEmailChange}
                                    onBlur={handleEmailBlur}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="default"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                                />
                            </View>
                            {renderHelperText(errors.email, !!touched.email)}
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <View style={[
                                styles.inputWrapper,
                                { borderColor: getInputBorderColor(errors.password, !!touched.password) }
                            ]}>
                                <Lock size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    ref={passwordInputRef}
                                    style={styles.input}
                                    placeholder="Enter your password"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={password}
                                    onChangeText={handlePasswordChange}
                                    onBlur={handlePasswordBlur}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="done"
                                    onSubmitEditing={handleLogin}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    {showPassword ? (
                                        <EyeOff size={20} color={COLORS.textSecondary} />
                                    ) : (
                                        <Eye size={20} color={COLORS.textSecondary} />
                                    )}
                                </TouchableOpacity>
                            </View>
                            {renderHelperText(errors.password, !!touched.password)}
                        </View>

                        {/* Forgot Password Link */}
                        <View style={styles.forgotPasswordContainer}>
                            <Link href="/(auth)/forgot-password" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>

                        {/* Beta Warning Checkbox */}
                        <TouchableOpacity
                            style={styles.betaContainer}
                            onPress={() => setBetaAcknowledged(!betaAcknowledged)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.betaCheckbox, betaAcknowledged && styles.betaCheckboxChecked]}>
                                {betaAcknowledged && <Text style={styles.betaCheckmark}>✓</Text>}
                            </View>
                            <Text style={styles.betaText}>
                                <Text style={styles.betaWarning}>⚠️ Beta Notice:</Text> Please don't add huge funds, this is a beta test version
                            </Text>
                        </TouchableOpacity>

                        {/* Login Button */}
                        <NeonButton
                            title="Login"
                            icon={<LogIn size={20} color={COLORS.textPrimary} />}
                            onPress={handleLogin}
                            loading={isLoading}
                            disabled={isLoading || !betaAcknowledged}
                            fullWidth
                            style={[styles.loginButton, !betaAcknowledged && { opacity: 0.5 }]}
                        />

                        {/* Sign Up Link */}
                        <View style={styles.signupContainer}>
                            <Text style={styles.signupText}>Don't have an account?</Text>
                            <Link href="/(auth)/signup" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.signupLink}>Create Account</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>

                    {/* Bottom Glow */}
                    <LinearGradient
                        colors={[COLORS.usdc + '20', 'transparent']}
                        style={styles.bottomGlow}
                        pointerEvents="none"
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    keyboardAvoid: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    inner: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoImage: {
        width: 80,
        height: 80,
        borderRadius: 20,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.error + '20',
        borderWidth: 1,
        borderColor: COLORS.error,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorIcon: {
        marginRight: 8,
    },
    errorText: {
        flex: 1,
        color: COLORS.error,
        fontSize: 14,
    },
    inputContainer: {
        marginBottom: 12,
    },
    label: {
        color: COLORS.textPrimary,
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '500',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: 16,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        paddingVertical: 14,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 8,
    },
    helperTextError: {
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
        color: COLORS.error,
    },
    forgotPasswordContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: COLORS.usdc,
        fontSize: 14,
    },
    loginButton: {
        marginBottom: 24,
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 32,
    },
    signupText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    signupLink: {
        color: COLORS.usdc,
        fontSize: 14,
        fontWeight: '600',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        opacity: 0.1,
    },
    betaContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.warning + '15',
        borderRadius: 12,
        padding: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: COLORS.warning + '40',
    },
    betaCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.warning,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    betaCheckboxChecked: {
        borderColor: COLORS.warning,
        backgroundColor: COLORS.warning + '30',
    },
    betaCheckmark: {
        color: COLORS.warning,
        fontSize: 14,
        fontWeight: 'bold',
    },
    betaText: {
        flex: 1,
        ...FONTS.phantomRegular,
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    betaWarning: {
        color: COLORS.warning,
        fontWeight: '600',
    },
});
