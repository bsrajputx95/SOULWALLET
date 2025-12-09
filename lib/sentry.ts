/**
 * Sentry Crash Reporting Configuration
 * 
 * Provides production crash tracking and error monitoring
 * 
 * Setup instructions:
 * 1. Install: npm install @sentry/react-native
 * 2. Get DSN from: https://sentry.io
 * 3. Add EXPO_PUBLIC_SENTRY_DSN to your .env file
 */

import * as Sentry from '@sentry/react-native';
import { getOptionalEnv } from './validate-env';
import { logger } from './client-logger';

let sentryInitialized = false;

/**
 * Initializes Sentry for crash reporting
 * Only runs in production or when DSN is explicitly provided
 */
export function initializeSentry(): void {
  if (sentryInitialized) {
    return; // Already initialized
  }

  const dsn = getOptionalEnv('EXPO_PUBLIC_SENTRY_DSN');

  // Don't initialize Sentry if disabled or not configured
  if (!dsn || dsn === 'disabled' || dsn.trim() === '' || dsn === 'your-sentry-dsn-here') {
    if (__DEV__) {
      logger.info('ℹ️  Sentry not initialized (disabled or not configured)');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      debug: __DEV__, // Enable debug mode in development
      enableInExpoDevelopment: false, // Disable in Expo development
      tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 100% in dev, 10% in production
      
      // Filter out sensitive data
      beforeSend(event) {
        // Remove sensitive data from events
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        
        // Filter out wallet-related data
        if (event.exception) {
          event.exception.values?.forEach(exception => {
            if (exception.stacktrace?.frames) {
              exception.stacktrace.frames.forEach(frame => {
                // Remove local variables that might contain sensitive data
                delete frame.vars;
              });
            }
          });
        }
        
        return event;
      },
      
      // Set environment
      environment: __DEV__ ? 'development' : 'production',
      
      // Enable native crash reporting
      enableNative: true,
      enableNativeCrashHandling: true,
      
      // Attach stack traces
      attachStacktrace: true,
    });

    sentryInitialized = true;
    
    logger.info('✅ Sentry initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (!sentryInitialized) {
    // Fallback to console in development or if Sentry not initialized
    logger.error('Error captured:', error, context);
    return;
  }

  try {
    Sentry.captureException(error, {
      extra: context,
    });
  } catch (err) {
    logger.error('Failed to capture exception:', err);
  }
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!sentryInitialized) {
    logger.log(`[${level}] ${message}`);
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (err) {
    logger.error('Failed to capture message:', err);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, any>): void {
  if (!sentryInitialized) {
    if (__DEV__) {
      logger.debug('[Breadcrumb]', message, data);
    }
    return;
  }

  try {
    Sentry.addBreadcrumb({
      message,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  } catch (err) {
    logger.error('Failed to add breadcrumb:', err);
  }
}

/**
 * Set user context
 */
export function setUser(user: { id: string; username?: string; email?: string }): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    logger.error('Failed to set user context:', err);
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.setUser(null);
  } catch (err) {
    logger.error('Failed to clear user context:', err);
  }
}

// Export Sentry for advanced usage
export { Sentry };
