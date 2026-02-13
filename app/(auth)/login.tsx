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
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants';
import { NeonButton, GlowingText } from '@/components';
import { api } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { persistAuthSession } from '@/utils/session';

const logoImage = require('../../assets/images/icon-rounded.png');

export default function LoginNewScreen() {
    const router = useRouter();
    const { setToken } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const passwordInputRef = useRef<TextInput>(null);

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

        return error.message || 'Login failed. Please try again.';
    };

    const handleLogin = async () => {
        if (isLoading) {
            return;
        }
        Keyboard.dismiss();
        const emailOrUsername = email.trim();

        if (!emailOrUsername) {
            setErrorMessage('Email or username is required');
            return;
        }
        if (!password) {
            setErrorMessage('Password is required');
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
            }>('/login', {
                emailOrUsername,
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
            setErrorMessage(getLoginErrorMessage(error));
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
                            <GlowingText text="WELCOME BACK" fontSize={24} style={styles.title} />
                            <Text style={styles.subtitle}>Log in to continue</Text>
                        </View>

                        {/* Error Message */}
                        {errorMessage && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{errorMessage}</Text>
                            </View>
                        )}

                        {/* Email Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Username/Email</Text>
                            <View style={styles.inputWrapper}>
                                <Mail size={20} color={COLORS.textSecondary} style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your username or email"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="default"
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
                                    placeholder="Enter your password"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={password}
                                    onChangeText={setPassword}
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
                        </View>

                        {/* Forgot Password Link */}
                        <View style={styles.forgotPasswordContainer}>
                            <Link href="/(auth)/forgot-password" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>


                        {/* Login Button */}
                        <NeonButton
                            title="Login"
                            icon={<LogIn size={20} color={COLORS.textPrimary} />}
                            onPress={handleLogin}
                            loading={isLoading}
                            disabled={isLoading}
                            fullWidth
                            style={styles.loginButton}
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
});

