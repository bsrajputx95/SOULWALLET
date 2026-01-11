/**
 * Configuration Bootstrap Module
 * 
 * Initializes application secrets from Vault and feature flags before server starts.
 * In production, secrets are fetched from Vault. In development, falls back to env vars.
 */

import { logger } from '../logger';
import { VaultClient } from '../services/vault';
import { initializeFeatureFlags, isFeatureEnabled } from '../services/featureFlagService';

// Cached configuration
let appConfig: AppConfig | null = null;
let vaultClient: VaultClient | null = null;
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
 * Initialize configuration from Vault or environment
 * Must be called before server starts
 */
export async function initializeConfig(): Promise<AppConfig> {
    if (initialized && appConfig) {
        return appConfig;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const vaultAddr = process.env.VAULT_ADDR;
    const vaultRoleId = process.env.VAULT_ROLE_ID;
    const vaultSecretId = process.env.VAULT_SECRET_ID;

    // In production, Vault is required
    if (isProduction && vaultAddr && vaultRoleId && vaultSecretId) {
        try {
            appConfig = await initializeFromVault(vaultAddr, vaultRoleId, vaultSecretId);
            logger.info('✅ Configuration loaded from Vault');
        } catch (error) {
            logger.error('❌ Failed to load configuration from Vault', { error });
            // In production, fail hard if Vault is unreachable
            throw new Error(`FATAL: Vault is unreachable in production. Server cannot start. Error: ${error}`);
        }
    } else {
        // Development/staging: use environment variables with warning
        if (isProduction) {
            logger.warn('⚠️ Production mode but Vault not configured. Using environment variables (NOT RECOMMENDED)');
        }
        appConfig = initializeFromEnv();
        logger.info('📋 Configuration loaded from environment variables');
    }

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
 * Initialize configuration from Vault
 */
async function initializeFromVault(
    vaultAddr: string,
    roleId: string,
    secretId: string
): Promise<AppConfig> {
    vaultClient = new VaultClient({
        address: vaultAddr,
        roleId,
        secretId,
    });

    // Fetch secrets from Vault KV store using readSecret method
    const jwtSecrets = await vaultClient.readSecret('soulwallet/jwt');
    const dbSecrets = await vaultClient.readSecret('soulwallet/database');
    const encryptionSecrets = await vaultClient.readSecret('soulwallet/encryption');

    // Extract data from Vault response
    const jwtData = jwtSecrets.data as Record<string, string>;
    const dbData = dbSecrets.data as Record<string, string>;
    const encData = encryptionSecrets?.data as Record<string, string> || {};

    // Validate required secrets
    if (!jwtData?.jwt_secret || !jwtData?.jwt_refresh_secret) {
        throw new Error('Missing JWT secrets in Vault');
    }

    if (!dbData?.database_url) {
        throw new Error('Missing database URL in Vault');
    }

    // Schedule secret renewal in background
    scheduleSecretRenewal();

    return {
        jwtSecret: jwtData.jwt_secret,
        jwtRefreshSecret: jwtData.jwt_refresh_secret,
        databaseUrl: dbData.database_url,
        databaseReadReplicaUrl: dbData.database_read_replica_url,
        redisUrl: dbData.redis_url || process.env.REDIS_URL || '',
        pgcryptoKey: encData.pgcrypto_key || '',
        walletEncryptionKey: encData.wallet_encryption_key || '',
        maintenanceMode: false,
        copyTradingV2Enabled: false,
        swapEnabled: true,
        secretsSource: 'vault',
    };
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
 * Schedule automatic secret renewal from Vault
 */
function scheduleSecretRenewal(): void {
    // Renew secrets every 6 hours
    const RENEWAL_INTERVAL = 6 * 60 * 60 * 1000;

    setInterval(async () => {
        if (!vaultClient) return;

        try {
            logger.info('🔄 Renewing secrets from Vault...');

            // Re-fetch fresh secrets using readSecret - token renewal happens automatically
            const jwtSecrets = await vaultClient.readSecret('soulwallet/jwt');
            const dbSecrets = await vaultClient.readSecret('soulwallet/database');
            const jwtData = jwtSecrets.data as Record<string, string>;
            const dbData = dbSecrets.data as Record<string, string>;

            // Update cached config
            if (appConfig && jwtData && dbData) {
                appConfig.jwtSecret = jwtData.jwt_secret || appConfig.jwtSecret;
                appConfig.jwtRefreshSecret = jwtData.jwt_refresh_secret || appConfig.jwtRefreshSecret;
                appConfig.databaseUrl = dbData.database_url || appConfig.databaseUrl;
            }

            logger.info('✅ Secrets renewed successfully');
        } catch (error) {
            logger.error('❌ Failed to renew secrets from Vault', { error });
            // Don't crash - continue using cached secrets
        }
    }, RENEWAL_INTERVAL);
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
 * Shutdown configuration (cleanup Vault client)
 */
export async function shutdownConfig(): Promise<void> {
    vaultClient = null;
    appConfig = null;
    initialized = false;
    logger.info('Configuration shutdown complete');
}

export { vaultClient };
