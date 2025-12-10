/**
 * Environment Variable Validation
 * 
 * Validates all required environment variables at app startup
 * with helpful error messages for developers
 */

interface EnvConfig {
  EXPO_PUBLIC_API_URL: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [
  {
    key: 'EXPO_PUBLIC_API_URL',
    description: 'Backend API base URL',
    example: 'https://api.example.com or http://localhost:3001',
    required: true,
  },
] as const;

const OPTIONAL_ENV_VARS = [
  {
    key: 'EXPO_PUBLIC_SENTRY_DSN',
    description: 'Sentry DSN for crash reporting',
    example: 'https://xxx@xxx.ingest.sentry.io/xxx',
    required: false,
  },
  {
    key: 'EXPO_PUBLIC_ANALYTICS_ID',
    description: 'Analytics tracking ID',
    example: 'UA-XXXXXXXXX-X',
    required: false,
  },
] as const;

/**
 * Validates all environment variables
 * @returns Validation result with errors and warnings
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    // eslint-disable-next-line expo/no-dynamic-env-var
    const value = process.env[envVar.key];

    if (!value || value.trim() === '') {
      errors.push(
        `❌ Missing required environment variable: ${envVar.key}\n` +
        `   Description: ${envVar.description}\n` +
        `   Example: ${envVar.example}\n` +
        `   Add this to your .env file`
      );
    } else if (envVar.key.includes('URL')) {
      // Validate URL format
      try {
        new URL(value);
      } catch {
        errors.push(
          `❌ Invalid URL format for ${envVar.key}: ${value}\n` +
          `   Expected format: ${envVar.example}`
        );
      }
    }
  }

  // Check optional environment variables
  // Only warn if the key is missing or not set to a valid value
  for (const envVar of OPTIONAL_ENV_VARS) {
    // eslint-disable-next-line expo/no-dynamic-env-var
    const value = process.env[envVar.key];

    // Only show warning if the env var is not defined or empty
    // If it's set to 'disabled' or has a real value, don't warn
    if (!value || value.trim() === '') {
      warnings.push(
        `⚠️  Optional environment variable not set: ${envVar.key}\n` +
        `   Description: ${envVar.description}\n` +
        `   Example: ${envVar.example}\n` +
        `   Set to 'disabled' in .env file to disable this warning`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and logs errors but doesn't throw in production
 * This prevents the app from crashing on startup
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    const errorMessage = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🚨 ENVIRONMENT CONFIGURATION ERROR',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      ...result.errors,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📝 How to fix:',
      '1. Create a .env file in your project root if it doesn\'t exist',
      '2. Add the missing environment variables shown above',
      '3. Restart your development server (npx expo start)',
      '',
      'Example .env file:',
      'EXPO_PUBLIC_API_URL=http://localhost:3001',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    console.error(errorMessage);

    // In development, throw to alert developer
    // In production, log but don't crash - let app show error UI
    if (__DEV__) {
      throw new Error('Environment validation failed. Check console for details.');
    }
  }

  // Log warnings in development
  if (__DEV__ && result.warnings.length > 0) {
    console.warn(
      '\n⚠️  Environment Warnings:\n' + result.warnings.join('\n\n')
    );
  }

  // Success message in development
  if (__DEV__) {
    console.log('✅ Environment variables validated successfully');
  }
}

/**
 * Gets a required environment variable or throws
 */
export function getRequiredEnv(key: string): string {
  // eslint-disable-next-line expo/no-dynamic-env-var
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `Required environment variable ${key} is not set. ` +
      `Check your .env file and restart the development server.`
    );
  }
  return value;
}

/**
 * Gets an optional environment variable with fallback
 */
export function getOptionalEnv(key: string, fallback: string = ''): string {
  // eslint-disable-next-line expo/no-dynamic-env-var
  return process.env[key] || fallback;
}

/**
 * Type-safe environment configuration
 * Uses lazy getters to avoid throwing at module load time
 */
export const env: EnvConfig = {
  get EXPO_PUBLIC_API_URL(): string {
    try {
      return getRequiredEnv('EXPO_PUBLIC_API_URL');
    } catch {
      // Fallback for production builds where env might not be available at module load
      // This allows the app to at least start and show an error UI
      console.warn('EXPO_PUBLIC_API_URL not available, using fallback');
      return process.env.EXPO_PUBLIC_API_URL || 'https://soulwallet-production.up.railway.app';
    }
  },
};
