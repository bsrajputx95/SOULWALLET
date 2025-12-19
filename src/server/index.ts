import { router } from './trpc';
import { authRouter } from './routers/auth';
import { walletRouter } from './routers/wallet';
import { swapRouter } from './routers/swap';
import { transactionRouter } from './routers/transaction';
import { contactRouter } from './routers/contact';
import { portfolioRouter } from './routers/portfolio';
import { systemRouter } from './routers/system';
import { copyTradingRouter } from './routers/copyTrading';
import { marketRouter } from './routers/market';
import { userRouter } from './routers/user';
import { socialRouter } from './routers/social';
import { tradersRouter } from './routers/traders';
import { accountRouter } from './routers/account';
import { logger } from '../lib/logger';
import { disconnectDatabase, connectDatabase } from '../lib/prisma';
import { createCleanupService } from '../lib/services/cleanup';
import { AuthService } from '../lib/services/auth';
import { createEmailService } from '../lib/services/email';
import prisma from '../lib/prisma';
import { startTransactionMonitor } from '../services/transactionMonitor';
import Redis from 'ioredis';
import { Connection } from '@solana/web3.js';
import { custodialWalletService } from '../lib/services/custodialWallet';
import { transactionMonitor } from '../lib/services/transactionMonitor';
import { priceMonitor } from '../lib/services/priceMonitor';
import { executionQueue } from '../lib/services/executionQueue';

// Global cleanup service instance
let cleanupService: ReturnType<typeof createCleanupService> | null = null;

// API Version to verify deployment
const API_VERSION = '2.0.1-searchUsers';
console.log(`[API] Starting SoulWallet API v${API_VERSION}`);

/**
 * Main application router
 * This is where all sub-routers are combined
 */
export const appRouter = router({
  auth: authRouter,
  wallet: walletRouter,
  swap: swapRouter,
  transaction: transactionRouter,
  contact: contactRouter,
  portfolio: portfolioRouter,
  system: systemRouter,
  copyTrading: copyTradingRouter,
  market: marketRouter,
  user: userRouter,
  social: socialRouter,
  traders: tradersRouter,
  account: accountRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter;

/**
 * Export the router for use in API handlers
 */
export { appRouter as default };

/**
 * Health check endpoint
 */
export const healthCheck = {
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
};

/**
 * API metadata
 */
export const apiMetadata = {
  name: 'SoulWallet API',
  description: 'Backend API for SoulWallet application',
  version: '1.0.0',
  endpoints: {
    auth: {
      signup: 'POST /api/trpc/auth.signup',
      login: 'POST /api/trpc/auth.login',
      logout: 'POST /api/trpc/auth.logout',
      requestPasswordReset: 'POST /api/trpc/auth.requestPasswordReset',
      resetPassword: 'POST /api/trpc/auth.resetPassword',
      verifyOTP: 'POST /api/trpc/auth.verifyOTP',
      getCurrentUser: 'GET /api/trpc/auth.getCurrentUser',
      refreshToken: 'POST /api/trpc/auth.refreshToken',
      getSessions: 'GET /api/trpc/auth.getSessions',
      revokeSession: 'POST /api/trpc/auth.revokeSession',
      health: 'GET /api/trpc/auth.health',
    },
  },
  documentation: {
    swagger: '/api/docs',
    postman: '/api/postman',
  },
};

/**
 * Router configuration
 */
export const routerConfig = {
  // Enable CORS for development
  cors: {
    origin: process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:8081']
      : process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
  },

  // Request size limits
  limits: {
    bodySize: '10mb',
    parameterLimit: 1000,
  },

  // Security headers
  security: {
    helmet: true,
    rateLimit: true,
    csrf: process.env.NODE_ENV === 'production',
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  },
};

/**
 * Enhanced environment validation with comprehensive checks
 * Supported NODE_ENV values: 'development', 'production', 'test'
 * Note: 'staging' is treated as production-like but with relaxed email requirements
 */
export const validateEnvironment = async () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  // Staging is treated as production-like environment
  const isStaging = (process.env.NODE_ENV as string) === 'staging';

  // Tracking variables for validation status
  let redisAvailable = false;
  let solanaAvailable = false;
  let sentryConfigured = false;
  let sendEnabled = false;
  let swapEnabled = false;
  let simulationMode = false;

  // Startup banner (uses logger for consistency)
  printStartupBanner();

  // Common validations for all environments
  const commonStatus = await validateCommon();
  redisAvailable = commonStatus.redisAvailable;
  sentryConfigured = commonStatus.sentryConfigured;
  sendEnabled = commonStatus.sendEnabled;
  swapEnabled = commonStatus.swapEnabled;
  simulationMode = commonStatus.simulationMode;

  // Environment-specific validations
  if (isProduction || isStaging) {
    // Both production and staging use production-level validation
    const prodStatus = await validateProduction();
    solanaAvailable = prodStatus.solanaAvailable;
  } else {
    await validateDevelopment();
  }

  // Log validation success with detailed summary
  logger.info('Environment validation completed', {
    environment: process.env.NODE_ENV,
    database: 'ok',
    redis: redisAvailable ? 'ok' : 'not configured',
    solana: solanaAvailable ? 'ok' : 'degraded',
    email: process.env.EMAIL_PROVIDER,
    monitoring: sentryConfigured ? 'enabled' : 'disabled',
    features: { send: sendEnabled, swap: swapEnabled, simulation: simulationMode }
  });
};

/**
 * Common validations for all environments
 */
const validateCommon = async () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  // Status tracking variables  
  let redisAvailable = false;
  let sentryConfigured = false;
  let sendEnabled = false;
  let swapEnabled = false;
  let simulationMode = false;
  // Check for placeholder JWT secrets
  const dangerousSecrets = [
    'your-super-secret-jwt-key-at-least-32-characters-long',
    'your-super-secret-refresh-key-at-least-32-characters-long',
    'your-super-secret-jwt-key-at-least-32-characters-long-for-development',
    'your-super-secret-refresh-key-at-least-32-characters-long-for-development',
  ];

  if (dangerousSecrets.includes(process.env.JWT_SECRET || '')) {
    throw new Error(
      '🚨 SECURITY: JWT_SECRET is using placeholder value!\n' +
      'Generate real secret: openssl rand -base64 32'
    );
  }

  if (dangerousSecrets.includes(process.env.JWT_REFRESH_SECRET || '')) {
    throw new Error(
      '🚨 SECURITY: JWT_REFRESH_SECRET is using placeholder value!\n' +
      'Generate real secret: openssl rand -base64 32'
    );
  }

  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }

  // Normalize feature flags to explicit booleans (as strings)
  const parseBool = (v: string | undefined, d: boolean) => {
    if (v === undefined) return d;
    const s = v.toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  };

  const defaultEnabled = process.env.NODE_ENV !== 'production';
  sendEnabled = parseBool(process.env.FEATURE_SEND_ENABLED, defaultEnabled);
  swapEnabled = parseBool(process.env.FEATURE_SWAP_ENABLED, defaultEnabled);
  simulationMode = parseBool(process.env.FEATURE_SIMULATION_MODE, true);

  process.env.FEATURE_SEND_ENABLED = String(sendEnabled);
  process.env.FEATURE_SWAP_ENABLED = String(swapEnabled);
  process.env.FEATURE_SIMULATION_MODE = String(simulationMode);

  // Validate JWT secrets are strong enough
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long\nGenerate strong secret: openssl rand -base64 32');
  }

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long\nGenerate strong secret: openssl rand -base64 32');
  }

  // Enhanced secret strength validation
  const secretsToCheck = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'WALLET_ENCRYPTION_KEY', 'ADMIN_KEY'];
  for (const secretName of secretsToCheck) {
    const secret = process.env[secretName];
    if (secret) {
      // Check for common patterns
      const commonPatterns = ['password', '12345', 'admin', 'secret', 'key'];
      for (const pattern of commonPatterns) {
        if (secret.toLowerCase().includes(pattern)) {
          logger.warn(`⚠️  ${secretName} contains common pattern '${pattern}' - consider using a stronger secret`);
        }
      }
      // Basic entropy check
      const hasLower = /[a-z]/.test(secret);
      const hasUpper = /[A-Z]/.test(secret);
      const hasDigit = /\d/.test(secret);
      const hasSpecial = /[^a-zA-Z\d]/.test(secret);
      const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
      if (variety < 3) {
        logger.warn(`⚠️  ${secretName} has low entropy - consider using a mix of uppercase, lowercase, digits, and special characters`);
      }

      // Additional checks for JWT secrets
      if (secretName.includes('JWT')) {
        // Calculate entropy: count unique characters
        const uniqueChars = new Set(secret).size;
        if (uniqueChars < 20) {
          logger.warn(`⚠️  ${secretName} has low entropy (${uniqueChars} unique characters) - require at least 20`);
        }
        // Check randomness (basic)
        const entropy = Math.log2(uniqueChars) * secret.length;
        if (entropy < 100) {
          logger.warn(`⚠️  ${secretName} has low entropy score (${entropy.toFixed(1)}) - consider using a stronger secret`);
        }
      }

      // Additional checks for ADMIN_KEY
      if (secretName === 'ADMIN_KEY') {
        if (secret === 'your-admin-key-change-this') {
          throw new Error('ADMIN_KEY is using placeholder value! Generate a secure key.');
        }
        if (secret.length < 32) {
          throw new Error('ADMIN_KEY must be at least 32 characters long');
        }
        // Entropy check
        const uniqueChars = new Set(secret).size;
        if (uniqueChars < 20) {
          logger.warn(`⚠️  ADMIN_KEY has low entropy (${uniqueChars} unique characters) - require at least 20`);
        }
      }
    }
  }

  // Validate numeric environment variables with ranges
  const numericVars = {
    MAX_LOGIN_ATTEMPTS: { min: 1, max: 20, default: 5 },
    LOCKOUT_DURATION_MINUTES: { min: 1, max: 1440, default: 15 }, // Max 24 hours
    SESSION_TIMEOUT_HOURS: { min: 1, max: 168, default: 24 }, // Max 7 days
    PORT: { min: 1000, max: 65535, default: 3001 },
    OTP_EXPIRES_IN_MINUTES: { min: 1, max: 60, default: 10 },
    RATE_LIMIT_MAX: { min: 10, max: 10000, default: 100 },
  };

  for (const [name, config] of Object.entries(numericVars)) {
    const envValue = process.env[name];
    const value = envValue ? parseInt(envValue, 10) : config.default;

    if (isNaN(value) || value < config.min || value > config.max) {
      throw new Error(
        `${name} must be a number between ${config.min} and ${config.max}. ` +
        `Current value: ${envValue || 'undefined'}\n` +
        `Please check your .env file and set a valid value.`
      );
    }

    // Set default if not provided
    if (!envValue) {
      process.env[name] = config.default.toString();
    }
  }

  // Validate URL formats
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.match(/^(file:|postgresql:|mysql:|sqlite:)/)) {
    throw new Error('DATABASE_URL must be a valid database connection string\nExample: postgresql://user:pass@localhost:5432/db or file:./dev.db');
  }

  // Validate ALLOWED_ORIGINS format
  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',');
    for (const origin of origins) {
      const trimmed = origin.trim();
      if (trimmed && !trimmed.match(/^https?:\/\/[^\s]+$/)) {
        throw new Error(`Invalid origin format in ALLOWED_ORIGINS: ${trimmed}\nMust be a valid URL starting with http:// or https://`);
      }
    }
  }

  // Validate email configuration if provided
  if (process.env.SMTP_HOST && !process.env.SMTP_PORT) {
    throw new Error('SMTP_PORT is required when SMTP_HOST is provided\nExample: 587 for Gmail');
  }

  if (process.env.SMTP_PORT) {
    const port = parseInt(process.env.SMTP_PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT must be a valid port number (1-65535)\nCommon ports: 587 (TLS), 465 (SSL)');
    }
  }

  // Validate REDIS_URL format if provided
  if (process.env.REDIS_URL && !process.env.REDIS_URL.match(/^redis:\/\/.+/)) {
    throw new Error('REDIS_URL must be a valid Redis connection string (e.g., redis://host:port)\nExample: redis://localhost:6379');
  }

  // Validate SENTRY_DSN format if provided (allow placeholder in dev)
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    const isPlaceholder = process.env.EXPO_PUBLIC_SENTRY_DSN.includes('example');
    if (!isPlaceholder && !process.env.EXPO_PUBLIC_SENTRY_DSN.match(/^https:\/\/[a-zA-Z0-9]+@[a-z0-9-]+\.(sentry\.io|ingest\.sentry\.io)\/\d+$/)) {
      if (nodeEnv === 'production') {
        throw new Error('EXPO_PUBLIC_SENTRY_DSN must be a valid Sentry DSN URL\nExample: https://abc123@sentry.io/123456');
      } else {
        logger.warn('⚠️  EXPO_PUBLIC_SENTRY_DSN format looks invalid - error tracking may not work');
      }
    }
  }

  // Validate Solana RPC URL format
  if (process.env.EXPO_PUBLIC_SOLANA_RPC_URL && !process.env.EXPO_PUBLIC_SOLANA_RPC_URL.match(/^https?:\/\/[^\s]+$/)) {
    throw new Error('EXPO_PUBLIC_SOLANA_RPC_URL must be a valid URL\nExample: https://api.mainnet-beta.solana.com');
  }

  // Check WALLET_ENCRYPTION_KEY is not default
  if (process.env.WALLET_ENCRYPTION_KEY === 'your-wallet-encryption-key-at-least-32-characters-long') {
    throw new Error('WALLET_ENCRYPTION_KEY is using placeholder value! Generate a secure key.\nUse: openssl rand -base64 32');
  }

  // Warnings for recommended variables
  if (!process.env.REDIS_URL) {
    logger.warn('⚠️  REDIS_URL not configured - rate limiting will use memory store (not recommended for production)');
  }
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
    logger.warn('⚠️  EXPO_PUBLIC_SENTRY_DSN not configured - error tracking disabled');
  }

  // Validate Redis configuration
  if (process.env.REDIS_URL) {
    try {
      const start = Date.now();
      const redis = new Redis(process.env.REDIS_URL, { connectTimeout: 5000 });
      await redis.ping();
      redis.disconnect();
      redisAvailable = true;
      logger.info('Redis validation', { available: true, latency: Date.now() - start });
    } catch (error: any) {
      logger.warn('Redis connection failed', { error: error.message });
    }
  }

  // Validate Sentry configuration
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    if (process.env.EXPO_PUBLIC_SENTRY_DSN.match(/^https:\/\/[a-f0-9]+@[a-z0-9-]+\.ingest\.sentry\.io\/[0-9]+$/)) {
      sentryConfigured = true;
      logger.info('Monitoring', { sentry: true });
    } else {
      logger.warn('Sentry DSN format invalid');
    }
  } else if (nodeEnv === 'production') {
    logger.warn('Sentry DSN not configured - error tracking disabled');
  }

  // Return status flags
  return { redisAvailable, sentryConfigured, sendEnabled, swapEnabled, simulationMode };
};

/**
 * Validations specific to development environment
 */
const validateDevelopment = () => {
  logger.info('🔧 Running development-specific validations');
  // Relaxed checks for development - allow console email provider, etc.
  if (process.env.EMAIL_PROVIDER !== 'console' && !process.env.SMTP_HOST) {
    logger.warn('⚠️  EMAIL_PROVIDER is not "console" but SMTP not configured - emails will fail');
  }
};

// Note: Staging validation is now handled by validateProduction() with the same rigor
// The staging environment is treated as production-like for security purposes

/**
 * Validations specific to production environment
 */
const validateProduction = async () => {
  logger.info('🚀 Running production-specific validations');
  let solanaAvailable = false;

  // 1. Redis Validation
  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 5000,
        commandTimeout: 3000,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      redis.disconnect();
      logger.info('✅ Redis connection validated');
    } catch (error: any) {
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  } else {
    throw new Error('REDIS_URL is required in production for distributed rate limiting\nInstall Redis or set REDIS_URL environment variable');
  }

  // 2. Sentry Validation (optional for beta)
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    logger.info('✅ Sentry DSN configured');
  } else {
    logger.warn('⚠️  EXPO_PUBLIC_SENTRY_DSN not configured - error tracking disabled (recommended for production)');
  }

  // 3. Production-Only Checks
  if (!process.env.ALLOWED_ORIGINS) {
    throw new Error('ALLOWED_ORIGINS is required in production');
  }
  if (process.env.EMAIL_PROVIDER === 'console') {
    logger.warn('⚠️  EMAIL_PROVIDER is "console" in production - emails will only log to console (not recommended)');
  }
  if (process.env.FEATURE_SIMULATION_MODE !== 'false') {
    throw new Error('FEATURE_SIMULATION_MODE must be false in production');
  }
  if (process.env.SESSION_FINGERPRINT_STRICT !== 'true') {
    logger.warn('⚠️  SESSION_FINGERPRINT_STRICT is not true - consider enabling for better security');
  }
  if (process.env.ENABLE_PLAYGROUND === 'true') {
    logger.warn('⚠️  ENABLE_PLAYGROUND is true in production - consider disabling');
  }
  if (process.env.ENABLE_INTROSPECTION === 'true') {
    logger.warn('⚠️  ENABLE_INTROSPECTION is true in production - consider disabling');
  }

  // 3.1 CSRF Protection Check (CRITICAL for production)
  if (process.env.CSRF_ENABLED !== 'true') {
    logger.warn('⚠️  CSRF_ENABLED is not "true" in production - CSRF protection is disabled!');
    logger.warn('⚠️  Set CSRF_ENABLED=true to protect against cross-site request forgery attacks');
  } else {
    logger.info('✅ CSRF protection enabled');
  }

  // 4. Solana RPC Validation
  if (process.env.EXPO_PUBLIC_SOLANA_RPC_URL) {
    try {
      const connection = new Connection(process.env.EXPO_PUBLIC_SOLANA_RPC_URL, 'confirmed');
      const slot = await Promise.race([
        connection.getSlot(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      solanaAvailable = true;
      logger.info(`✅ Solana RPC validated (slot: ${slot}`);
      if (process.env.EXPO_PUBLIC_SOLANA_RPC_URL.includes('api.mainnet-beta.solana.com')) {
        logger.warn('⚠️  Using public Solana RPC in production - consider using premium provider (Helius, QuickNode)');
      }
    } catch (error: any) {
      logger.warn(`⚠️  Solana RPC connection failed: ${error.message} - will be validated via health checks`);
    }
  } else {
    throw new Error('EXPO_PUBLIC_SOLANA_RPC_URL is required\nExample: https://api.mainnet-beta.solana.com or premium provider');
  }

  // 5. Enhanced Email Configuration Validation
  if (process.env.EMAIL_PROVIDER === 'smtp') {
    const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missingSmtpVars = requiredSmtpVars.filter(varName => !process.env[varName]);
    if (missingSmtpVars.length > 0) {
      throw new Error(`SMTP email provider requires: ${missingSmtpVars.join(', ')}`);
    }
    const port = parseInt(process.env.SMTP_PORT!, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT must be a valid port number (1-65535)');
    }
    // Optional: Test SMTP connection with timeout
  } else if (process.env.EMAIL_PROVIDER === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is required when EMAIL_PROVIDER is "sendgrid"');
    }
    if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      throw new Error('SENDGRID_API_KEY must start with "SG."');
    }
  } else if (process.env.EMAIL_PROVIDER === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER is "resend"');
    }
    if (!process.env.RESEND_API_KEY.startsWith('re_')) {
      throw new Error('RESEND_API_KEY must start with "re_"');
    }
  }
  // Email provider validation moved to line 495

  // Ensure WALLET_ENCRYPTION_KEY is configured and strong
  if (!process.env.WALLET_ENCRYPTION_KEY || process.env.WALLET_ENCRYPTION_KEY.length < 32) {
    throw new Error('WALLET_ENCRYPTION_KEY must be at least 32 characters long in production');
  }

  // Validate LOG_LEVEL is appropriate for production
  if (process.env.LOG_LEVEL !== 'info' && process.env.LOG_LEVEL !== 'warn' && process.env.LOG_LEVEL !== 'error') {
    logger.warn('LOG_LEVEL should be info, warn, or error in production');
  }

  // Return status flags
  return { solanaAvailable };
};

/**
 * Print startup banner with configuration summary
 * Uses logger for consistent logging across the service
 */
const printStartupBanner = () => {
  const version = process.env.npm_package_version || '1.0.0';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = process.env.PORT || '3001';

  logger.info('═'.repeat(60));
  logger.info('🚀 SoulWallet API Server Starting');
  logger.info(`Version: ${version}`);
  logger.info(`Environment: ${nodeEnv}`);
  logger.info(`Port: ${port}`);
  logger.info('Validating environment configuration...');
  logger.info('═'.repeat(60));
};

/**
 * Initialize the application
 */
export const initializeApp = async () => {
  try {
    // Validate environment variables
    await validateEnvironment();

    // Initialize database connection
    await connectDatabase();

    // Initialize rate limiting
    const { initializeRateLimiting } = await import('../lib/middleware/rateLimit');
    await initializeRateLimiting();

    // Initialize cleanup service
    const authService = new AuthService();
    const emailService = createEmailService();
    cleanupService = createCleanupService(prisma, authService, emailService);
    cleanupService.start();

    logger.info('✅ Application initialized successfully');
    logger.info('🧹 Session cleanup service started');

    // Start transaction monitor (if enabled)
    if (process.env.FEATURE_TRANSACTION_MONITORING !== 'false') {
      startTransactionMonitor().catch(err => {
        logger.error('Failed to start transaction monitor:', err);
      });

      // Also start transaction status updater
      const { startTransactionStatusUpdater } = await import('../services/transactionStatusUpdater');
      startTransactionStatusUpdater().catch(err => {
        logger.error('Failed to start transaction status updater:', err);
      });

      // Start portfolio snapshot service for accurate 24h changes
      const { startPortfolioSnapshotService } = await import('../services/portfolioSnapshotService');
      startPortfolioSnapshotService().catch(err => {
        logger.error('Failed to start portfolio snapshot service:', err);
      });

      // Start cron jobs for background tasks (trader performance snapshots, etc.)
      const { initializeCronJobs } = await import('./cronJobs');
      initializeCronJobs();
    }

    // Initialize copy trading services (if enabled)
    const copyTradingEnabled = process.env.COPY_TRADING_ENABLED === 'true';
    if (copyTradingEnabled) {
      try {
        // Initialize custodial wallet encryption service
        custodialWalletService.initialize();
        logger.info('✅ Custodial wallet service initialized');

        // Start transaction monitor (Helius WebSocket for trader detection)
        await transactionMonitor.start();
        logger.info('✅ Transaction monitor started (Helius WebSocket)');

        // Start price monitor (5-second SL/TP checking loop)
        await priceMonitor.start();
        logger.info('✅ Price monitor started (SL/TP checking)');

        logger.info('🚀 Copy trading services initialized successfully');
      } catch (error: any) {
        logger.error('Failed to initialize copy trading services:', error);
        // Don't throw - allow app to start without copy trading
        logger.warn('⚠️  Copy trading features will be unavailable');
      }
    } else {
      logger.info('ℹ️  Copy trading disabled (COPY_TRADING_ENABLED != true)');
    }

    return {
      success: true,
      message: 'Application initialized',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error('❌ Failed to initialize application:', {
      error: error.message || String(error),
      stack: error.stack,
      name: error.name
    });
    console.error('INITIALIZATION ERROR:', error.message || error);
    throw error;
  }
};

/**
 * Shutdown the application gracefully
 */
export const shutdownApp = async () => {
  try {
    // Stop cleanup service
    if (cleanupService) {
      cleanupService.stop();
      logger.info('🧹 Session cleanup service stopped');
    }

    // Disconnect database
    await disconnectDatabase();

    logger.info('✅ Application shutdown completed');
  } catch (error) {
    logger.error('❌ Failed to shutdown application:', error);
    throw error;
  }
};

/**
 * Get cleanup service instance
 */
export const getCleanupService = () => cleanupService;

/**
 * Graceful shutdown handler
 */
export const gracefulShutdown = async (signal: string) => {
  logger.info(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop copy trading services
    const copyTradingEnabled = process.env.COPY_TRADING_ENABLED === 'true';
    if (copyTradingEnabled) {
      try {
        await transactionMonitor.stop();
        logger.info('✅ Transaction monitor stopped');

        priceMonitor.stop();
        logger.info('✅ Price monitor stopped');

        await executionQueue.close();
        logger.info('✅ Execution queue closed');
      } catch (error) {
        logger.error('Error stopping copy trading services:', error);
      }
    }

    // Close database connections using singleton
    await disconnectDatabase();

    logger.info('✅ Database connections closed');
    logger.info('✅ Graceful shutdown completed');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle process signals for graceful shutdown
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
}
