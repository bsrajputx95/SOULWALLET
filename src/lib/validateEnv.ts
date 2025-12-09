import { logger } from '../lib/logger';

interface EnvConfig {
    required: string[];
    optional: string[];
}

const envConfig: EnvConfig = {
    // Required environment variables for production
    required: [
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
    ],

    // Optional but recommended environment variables
    optional: [
        'BIRDEYE_API_KEY',
        'HELIUS_API_KEY',
        'HELIUS_RPC_URL',
        'REDIS_URL',
        'ALLOWED_ORIGINS',
        'EMAIL_FROM',
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASS',
        // Custodial wallet (required for copy trading)
        'CUSTODIAL_WALLET_MASTER_SECRET',
        'CUSTODIAL_WALLET_SALT',
    ],
};

/**
 * Validate environment variables on server startup
 */
export function validateEnvironment(): void {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const key of envConfig.required) {
        if (!process.env[key]) {
            missing.push(key);
        } else if (key.includes('SECRET') && process.env[key]!.length < 32) {
            warnings.push(`${key} should be at least 32 characters for security`);
        }
    }

    // Check optional variables and warn if missing
    for (const key of envConfig.optional) {
        if (!process.env[key]) {
            warnings.push(`Optional variable ${key} is not set - some features may be limited`);
        }
    }

    // Log results
    if (missing.length > 0) {
        logger.error('❌ Missing required environment variables:', missing);
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Please set these in your .env file or deployment environment.'
        );
    }

    if (warnings.length > 0) {
        logger.warn('⚠️  Environment warnings:');
        warnings.forEach(warning => logger.warn(`   - ${warning}`));
    }

    logger.info('✅ Environment variable validation passed');

    // Log configuration summary (redact secrets)
    const summary = {
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseConfigured: !!process.env.DATABASE_URL,
        jwtConfigured: !!process.env.JWT_SECRET && !!process.env.JWT_REFRESH_SECRET,
        redisConfigured: !!process.env.REDIS_URL,
        emailConfigured: !!process.env.SMTP_HOST,
        custodialWalletConfigured: !!process.env.CUSTODIAL_WALLET_MASTER_SECRET,
        externalAPIs: {
            birdeye: !!process.env.BIRDEYE_API_KEY,
            helius: !!process.env.HELIUS_API_KEY,
        },
    };

    logger.info('Configuration summary:', summary);
}

/**
 * Get a required environment variable or throw error
 */
export function getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

/**
 * Get an optional environment variable with default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}
