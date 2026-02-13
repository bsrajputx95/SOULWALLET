import React, { useState, useRef } from 'react';
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
import { User, Mail, Lock, UserPlus, Eye, EyeOff } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants';
import { NeonButton, GlowingText } from '@/components';
import { api } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { persistAuthSession } from '@/utils/session';

const logoImage = require('../../assets/images/icon-rounded.png');
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [tosAccepted, setTosAccepted] = useState(false);

    const emailInputRef = useRef<TextInput>(null);
    const passwordInputRef = useRef<TextInput>(null);
    const confirmPasswordInputRef = useRef<TextInput>(null);

    const getSignupErrorMessage = (error: unknown): string => {
        if (!(error instanceof Error)) {
            return 'Something went wrong. Please try again.';
        }

        if (error.message.includes('Network request failed')) {
            return 'Network error. Please check your connection.';
        }

        if (error.message.includes('Too many authentication attempts')) {
            return 'Too many attempts. Please wait a bit and try again.';
        }

        return error.message || 'Signup failed. Please try again.';
    };

    const handleSignup = async () => {
        if (isLoading) {
            return;
        }
        Keyboard.dismiss();
        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedUsername) {
            setErrorMessage('Username is required');
            return;
        }
        if (normalizedUsername.length < 3 || normalizedUsername.length > 30 || !USERNAME_REGEX.test(normalizedUsername)) {
            setErrorMessage('Username must be 3-30 chars and use letters, numbers, or underscores');
            return;
        }
        if (!normalizedEmail) {
            setErrorMessage('Email is required');
            return;
        }
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            setErrorMessage('Please enter a valid email address');
            return;
        }
        if (!password || password.length < 6) {
            setErrorMessage('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match');
            return;
        }
        if (!tosAccepted) {
            setErrorMessage('Please accept Terms of Service to continue');
            return;
        }

        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const data = await api.post<{
                token: string;
                user: unknown;
                error?: string;
            }>('/register', {
                username: normalizedUsername,
                email: normalizedEmail,
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
            setErrorMessage(getSignupErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
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
                    keyboardShouldPersistTaps="handled"
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

                        {/* Error Message */}
                        {errorMessage && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{errorMessage}</Text>
                            </View>
                        )}

                        {/* Username Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Username</Text>
                            <View style={styles.inputWrapper}>
                                <User size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Choose a username"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    onSubmitEditing={() => emailInputRef.current?.focus()}
                                />
                            </View>
                        </View>

                        {/* Email Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <View style={styles.inputWrapper}>
                                <Mail size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    ref={emailInputRef}
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputWrapper}>
                                <Lock size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    ref={passwordInputRef}
                                    style={styles.input}
                                    placeholder="Create a password"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={password}
                                    onChangeText={setPassword}
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
                            <Text style={styles.passwordHint}>
                                Minimum 6 characters
                            </Text>
                        </View>

                        {/* Confirm Password Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <View style={styles.inputWrapper}>
                                <Lock size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    ref={confirmPasswordInputRef}
                                    style={styles.input}
                                    placeholder="Confirm your password"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
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

                        {/* Signup Button */}
                        <NeonButton
                            title="Create Account"
                            icon={<UserPlus size={20} color={COLORS.textPrimary} />}
                            onPress={handleSignup}
                            loading={isLoading}
                            disabled={!tosAccepted || isLoading}
                            fullWidth
                            style={[styles.signupButton, !tosAccepted && { opacity: 0.5 }]}
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
        backgroundColor: COLORS.error + '20',
        borderWidth: 1,
        borderColor: COLORS.error,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 14,
    },
    inputContainer: {
        marginBottom: 16,
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
        borderColor: COLORS.textSecondary + '50',
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
    signupButton: {
        marginBottom: 24,
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
    passwordHint: {
        color: COLORS.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    bottomGlow: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        opacity: 0.1,
    },
});

