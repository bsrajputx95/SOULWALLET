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
import { User, Mail, Lock, UserPlus, Eye, EyeOff, AlertCircle, Check } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants';
import { NeonButton, GlowingText } from '@/components';
import { api } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { persistAuthSession } from '@/utils/session';

const logoImage = require('../../assets/images/icon-rounded.png');
const USERNAME_REGEX = /^[a-z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation types
type ValidationError = {
    message: string;
    isError: boolean;
};

type FieldErrors = {
    username: ValidationError | null;
    email: ValidationError | null;
    password: ValidationError | null;
    confirmPassword: ValidationError | null;
    general: string | null;
};

export default function SignupNewScreen() {
    const router = useRouter();
    const { setToken } = useAuth();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({
        username: null,
        email: null,
        password: null,
        confirmPassword: null,
        general: null,
    });
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [tosAccepted, setTosAccepted] = useState(false);

    const emailInputRef = useRef<TextInput>(null);
    const passwordInputRef = useRef<TextInput>(null);
    const confirmPasswordInputRef = useRef<TextInput>(null);

    // Real-time validation functions
    const validateUsername = useCallback((value: string): ValidationError | null => {
        const trimmed = value.trim();

        if (!trimmed) {
            return { message: 'Username is required', isError: true };
        }

        if (trimmed.length < 3) {
            return { message: 'Username must be at least 3 characters', isError: true };
        }

        if (trimmed.length > 30) {
            return { message: 'Username must be at most 30 characters', isError: true };
        }

        // Check for uppercase letters
        if (/[A-Z]/.test(trimmed)) {
            return { message: 'Use lowercase letters only (no capitals)', isError: true };
        }

        // Check for spaces
        if (/\s/.test(trimmed)) {
            return { message: 'Username cannot contain spaces', isError: true };
        }

        if (!USERNAME_REGEX.test(trimmed)) {
            return { message: 'Only letters, numbers, and underscores allowed', isError: true };
        }

        return { message: 'Username looks good!', isError: false };
    }, []);

    const validateEmail = useCallback((value: string): ValidationError | null => {
        const trimmed = value.trim();

        if (!trimmed) {
            return { message: 'Email is required', isError: true };
        }

        if (!EMAIL_REGEX.test(trimmed)) {
            return { message: 'Please enter a valid email address', isError: true };
        }

        return { message: 'Email looks good!', isError: false };
    }, []);

    const validatePassword = useCallback((value: string): ValidationError | null => {
        if (!value) {
            return { message: 'Password is required', isError: true };
        }

        if (value.length < 6) {
            return { message: 'Password must be at least 6 characters', isError: true };
        }

        if (value.length > 100) {
            return { message: 'Password is too long', isError: true };
        }

        return { message: 'Password is strong', isError: false };
    }, []);

    const validateConfirmPassword = useCallback((value: string, pass: string): ValidationError | null => {
        if (!value) {
            return { message: 'Please confirm your password', isError: true };
        }

        if (value !== pass) {
            return { message: 'Passwords do not match', isError: true };
        }

        return { message: 'Passwords match', isError: false };
    }, []);

    // Handle input changes with real-time validation
    const handleUsernameChange = (text: string) => {
        setUsername(text);
        if (touched.username) {
            const validation = validateUsername(text);
            setErrors(prev => ({ ...prev, username: validation }));
        }
        // Clear general error when user starts typing
        if (errors.general) {
            setErrors(prev => ({ ...prev, general: null }));
        }
    };

    const handleEmailChange = (text: string) => {
        setEmail(text);
        if (touched.email) {
            const validation = validateEmail(text);
            setErrors(prev => ({ ...prev, email: validation }));
        }
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
        // Also validate confirm password if it has a value
        if (confirmPassword && touched.confirmPassword) {
            const confirmValidation = validateConfirmPassword(confirmPassword, text);
            setErrors(prev => ({ ...prev, confirmPassword: confirmValidation }));
        }
        if (errors.general) {
            setErrors(prev => ({ ...prev, general: null }));
        }
    };

    const handleConfirmPasswordChange = (text: string) => {
        setConfirmPassword(text);
        if (touched.confirmPassword) {
            const validation = validateConfirmPassword(text, password);
            setErrors(prev => ({ ...prev, confirmPassword: validation }));
        }
        if (errors.general) {
            setErrors(prev => ({ ...prev, general: null }));
        }
    };

    // Handle field blur (validation)
    const handleUsernameBlur = () => {
        setTouched(prev => ({ ...prev, username: true }));
        const validation = validateUsername(username);
        setErrors(prev => ({ ...prev, username: validation }));
    };

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

    const handleConfirmPasswordBlur = () => {
        setTouched(prev => ({ ...prev, confirmPassword: true }));
        const validation = validateConfirmPassword(confirmPassword, password);
        setErrors(prev => ({ ...prev, confirmPassword: validation }));
    };

    const getSignupErrorMessage = (error: unknown): string => {
        if (!(error instanceof Error)) {
            return 'Something went wrong. Please try again.';
        }

        if (error.message.includes('Network request failed')) {
            return 'Network error. Please check your connection.';
        }

        if (error.message.includes('Too many registration attempts')) {
            return 'Too many attempts. Please wait a bit and try again.';
        }

        if (error.message.includes('Username already exists')) {
            return 'This username is already taken. Please choose another.';
        }

        if (error.message.includes('Email already exists')) {
            return 'This email is already registered. Try logging in instead.';
        }

        if (error.message.includes('User already exists')) {
            return 'An account with this username or email already exists.';
        }

        return error.message || 'Signup failed. Please try again.';
    };

    const handleSignup = async () => {
        if (isLoading) {
            return;
        }
        Keyboard.dismiss();

        // Mark all fields as touched (including TOS visual feedback)
        setTouched({ username: true, email: true, password: true, confirmPassword: true });

        // Check TOS first for better UX
        if (!tosAccepted) {
            if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            return;
        }

        // Validate all fields
        const usernameValidation = validateUsername(username);
        const emailValidation = validateEmail(email);
        const passwordValidation = validatePassword(password);
        const confirmPasswordValidation = validateConfirmPassword(confirmPassword, password);

        setErrors({
            username: usernameValidation,
            email: emailValidation,
            password: passwordValidation,
            confirmPassword: confirmPasswordValidation,
            general: null,
        });

        // Check if any validation failed
        if (usernameValidation?.isError ||
            emailValidation?.isError ||
            passwordValidation?.isError ||
            confirmPasswordValidation?.isError) {
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
            }>('/register', {
                username: username.trim(),
                email: email.trim().toLowerCase(),
                password,
                confirmPassword,
            });
            if (!data.token) {
                throw new Error('Signup failed. Please try again.');
            }
            await persistAuthSession(data.token, data.user);
            setToken(data.token);

            // Navigate to main app on success
            router.replace('/(tabs)');
        } catch (error: unknown) {
            setErrors(prev => ({ ...prev, general: getSignupErrorMessage(error) }));
            if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to render validation indicator
    const renderValidationIndicator = (error: ValidationError | null, isTouched: boolean) => {
        if (!isTouched || !error) return null;

        return (
            <View style={styles.validationIndicator}>
                {error.isError ? (
                    <AlertCircle size={18} color={COLORS.error} />
                ) : (
                    <Check size={18} color={COLORS.success} />
                )}
            </View>
        );
    };

    // Helper to render helper text
    const renderHelperText = (error: ValidationError | null, isTouched: boolean) => {
        if (!isTouched || !error) {
            return null;
        }

        return (
            <Text style={[
                styles.helperText,
                error.isError ? styles.helperTextError : styles.helperTextSuccess
            ]}>
                {error.message}
            </Text>
        );
    };

    // Get input border color based on validation state
    const getInputBorderColor = (error: ValidationError | null, isTouched: boolean) => {
        if (!isTouched || !error) return COLORS.textSecondary + '50';
        return error.isError ? COLORS.error : COLORS.success;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
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
                            <GlowingText text="CREATE ACCOUNT" fontSize={24} style={styles.title} />
                            <Text style={styles.subtitle}>Join Soul Wallet today</Text>
                        </View>

                        {/* General Error Message */}
                        {errors.general && (
                            <View style={styles.errorContainer}>
                                <AlertCircle size={18} color={COLORS.error} style={styles.errorIcon} />
                                <Text style={styles.errorText}>{errors.general}</Text>
                            </View>
                        )}

                        {/* Username Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Username</Text>
                            <View style={[
                                styles.inputWrapper,
                                { borderColor: getInputBorderColor(errors.username, !!touched.username) }
                            ]}>
                                <User size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Choose a username"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={username}
                                    onChangeText={handleUsernameChange}
                                    onBlur={handleUsernameBlur}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    onSubmitEditing={() => emailInputRef.current?.focus()}
                                />
                                {renderValidationIndicator(errors.username, !!touched.username)}
                            </View>
                            {renderHelperText(errors.username, !!touched.username)}
                            {!touched.username && (
                                <Text style={styles.inputHint}>
                                    3-30 characters, lowercase letters, numbers, underscores only
                                </Text>
                            )}
                        </View>

                        {/* Email Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <View style={[
                                styles.inputWrapper,
                                { borderColor: getInputBorderColor(errors.email, !!touched.email) }
                            ]}>
                                <Mail size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    ref={emailInputRef}
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={email}
                                    onChangeText={handleEmailChange}
                                    onBlur={handleEmailBlur}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                                />
                                {renderValidationIndicator(errors.email, !!touched.email)}
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
                                    placeholder="Create a password"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={password}
                                    onChangeText={handlePasswordChange}
                                    onBlur={handlePasswordBlur}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="next"
                                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
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
                            {!touched.password && (
                                <Text style={styles.inputHint}>
                                    Minimum 6 characters
                                </Text>
                            )}
                        </View>

                        {/* Confirm Password Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <View style={[
                                styles.inputWrapper,
                                { borderColor: getInputBorderColor(errors.confirmPassword, !!touched.confirmPassword) }
                            ]}>
                                <Lock size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    ref={confirmPasswordInputRef}
                                    style={styles.input}
                                    placeholder="Confirm your password"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={confirmPassword}
                                    onChangeText={handleConfirmPasswordChange}
                                    onBlur={handleConfirmPasswordBlur}
                                    secureTextEntry={!showConfirmPassword}
                                    returnKeyType="done"
                                    onSubmitEditing={handleSignup}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={styles.eyeIcon}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff size={20} color={COLORS.textSecondary} />
                                    ) : (
                                        <Eye size={20} color={COLORS.textSecondary} />
                                    )}
                                </TouchableOpacity>
                            </View>
                            {renderHelperText(errors.confirmPassword, !!touched.confirmPassword)}
                        </View>

                        {/* Terms of Service Checkbox */}
                        <TouchableOpacity
                            style={styles.tosContainer}
                            onPress={() => setTosAccepted(!tosAccepted)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}>
                                {tosAccepted && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text style={styles.tosText}>
                                I agree to the{' '}
                                <Text style={styles.tosLink}>Terms of Service</Text>
                                {' '}and{' '}
                                <Text style={styles.tosLink}>Privacy Policy</Text>
                            </Text>
                        </TouchableOpacity>

                        {/* TOS Error Message */}
                        {!tosAccepted && touched.username && (
                            <View style={styles.tosErrorContainer}>
                                <AlertCircle size={16} color={COLORS.warning} />
                                <Text style={styles.tosErrorText}>
                                    Please accept the Terms of Service to continue
                                </Text>
                            </View>
                        )}

                        {/* Signup Button */}
                        <NeonButton
                            title="Create Account"
                            icon={<UserPlus size={20} color={COLORS.textPrimary} />}
                            onPress={handleSignup}
                            loading={isLoading}
                            disabled={!tosAccepted || isLoading}
                            fullWidth
                            style={styles.signupButton}
                        />

                        {/* Login Link */}
                        <View style={styles.loginContainer}>
                            <Text style={styles.loginText}>Already have an account?</Text>
                            <Link href="/(auth)/login" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.loginLink}>Sign In</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>

                    {/* Bottom Glow */}
                    <LinearGradient
                        colors={[COLORS.usdc + '20', 'transparent']}
                        style={styles.bottomGlow}
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
    validationIndicator: {
        marginLeft: 8,
    },
    helperText: {
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    helperTextError: {
        color: COLORS.error,
    },
    helperTextSuccess: {
        color: COLORS.success,
    },
    inputHint: {
        color: COLORS.textSecondary,
        fontSize: 11,
        marginTop: 4,
        marginLeft: 4,
    },
    signupButton: {
        marginBottom: 24,
        marginTop: 8,
    },
    tosContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.textSecondary + '80',
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    checkboxChecked: {
        borderColor: COLORS.usdc,
        backgroundColor: COLORS.usdc + '20',
    },
    checkmark: {
        color: COLORS.usdc,
        fontSize: 14,
        fontWeight: 'bold',
    },
    tosText: {
        flex: 1,
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    tosLink: {
        color: COLORS.usdc,
        fontWeight: '500',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 32,
    },
    loginText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    loginLink: {
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
    tosErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        gap: 6,
    },
    tosErrorText: {
        color: COLORS.warning,
        fontSize: 13,
    },
});
