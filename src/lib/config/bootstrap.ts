/**
 * Configuration Bootstrap Module
 * 
 * Initializes application secrets from environment variables and feature flags.
 * For beta, secrets are read directly from environment variables (no Vault).
 */

import { logger } from '../logger';
import { initializeFeatureFlags, isFeatureEnabled } from '../services/featureFlagService';

// Cached configuration
let appConfig: AppConfig | null = null;
let initialized = false;

export interface AppConfig {
    // JWT Secrets
    jwtSecret: string;
    jwtRefreshSecret: string;

    // Database
    databaseUrl: string;
    databaseReadReplicaUrl?: string | undefined;

    // Redis
    redisUrl: string;

    // Encryption
    pgcryptoKey: string;
    walletEncryptionKey: string;

    // Feature Flags
    maintenanceMode: boolean;
    copyTradingV2Enabled: boolean;
    swapEnabled: boolean;

    // Source of secrets
    secretsSource: 'vault' | 'env';
}

/**
 * Initialize configuration from environment variables
 * Must be called before server starts
 */
export async function initializeConfig(): Promise<AppConfig> {
    if (initialized && appConfig) {
        return appConfig;
    }

    // For beta, always use environment variables
    appConfig = initializeFromEnv();
    logger.info('📋 Configuration loaded from environment variables');

    // Initialize feature flags
    try {
        await initializeFeatureFlags();

        // Load feature flag values into config
        appConfig.maintenanceMode = await isFeatureEnabled('maintenance-mode', undefined, false);
        appConfig.copyTradingV2Enabled = await isFeatureEnabled('copy-trading-v2', undefined, false);
        appConfig.swapEnabled = await isFeatureEnabled('swap-enabled', undefined, true);

        logger.info('✅ Feature flags initialized', {
            maintenanceMode: appConfig.maintenanceMode,
            copyTradingV2: appConfig.copyTradingV2Enabled,
            swapEnabled: appConfig.swapEnabled,
        });
    } catch (error) {
        logger.warn('⚠️ Feature flags initialization failed, using defaults', { error });
    }

    initialized = true;
    return appConfig;
}

/**
 * Initialize configuration from environment variables
 */
function initializeFromEnv(): AppConfig {
    const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
    const missing = requiredEnvVars.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
        jwtSecret: process.env.JWT_SECRET!,
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
        databaseUrl: process.env.DATABASE_URL!,
        databaseReadReplicaUrl: process.env.DATABASE_READ_REPLICA_URL,
        redisUrl: process.env.REDIS_URL || '',
        pgcryptoKey: process.env.PGCRYPTO_KEY || '',
        walletEncryptionKey: process.env.WALLET_ENCRYPTION_KEY || '',
        maintenanceMode: false,
        copyTradingV2Enabled: false,
        swapEnabled: true,
        secretsSource: 'env',
    };
}

/**
 * Get current application configuration
 * Throws if not initialized
 */
export function getConfig(): AppConfig {
    if (!appConfig) {
        throw new Error('Configuration not initialized. Call initializeConfig() first.');
    }
    return appConfig;
}

/**
 * Check if a feature is enabled (convenience method)
 */
export async function checkFeatureFlag(
    flagName: string,
    userId?: string
): Promise<boolean> {
    return isFeatureEnabled(flagName, userId ? { userId } : undefined, false);
}

/**
 * Shutdown configuration (cleanup)
 */
export async function shutdownConfig(): Promise<void> {
    appConfig = null;
    initialized = false;
    logger.info('Configuration shutdown complete');
}
