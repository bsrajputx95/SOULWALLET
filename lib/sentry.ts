/**
 * Sentry Crash Reporting Configuration
 * 
 * Provides production crash tracking and error monitoring
 * 
 * Setup instructions:
 * 1. Install: npm install @sentry/react-native
 * 2. Get DSN from: https://sentry.io
 * 3. Add EXPO_PUBLIC_SENTRY_DSN to your .env file
 * 4. Un comment the initialization code below
 */

// Uncomment when ready to add Sentry:
// import * as Sentry from '@sentry/react-native';
import { getOptionalEnv } from './validate-env';

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
  if (!dsn || dsn === 'disabled' || dsn.trim() === '') {
    if (__DEV__) {
      console.log('ℹ️  Sentry not initialized (disabled or not configured)');
    }
    return;
  }

  try {
    // Uncomment when you install @sentry/react-native:
    /*
    Sentry.init({
      dsn,
      debug: __DEV__, // Enable debug mode in development
      enableInExpoDevelopment: false, // Disable in Expo development
      tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
      
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
    */

    sentryInitialized = true;
    
    if (__DEV__) {
      console.log('✅ Sentry initialized successfully');
    }
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (!sentryInitialized) {
    // Fallback to console in development or if Sentry not initialized
    console.error('Error captured:', error, context);
    return;
  }

  try {
    // Uncomment when you install @sentry/react-native:
    /*
    Sentry.captureException(error, {
      extra: context,
    });
    */
    
    // Temporary fallback
    console.error('Error captured:', error, context);
  } catch (err) {
    console.error('Failed to capture exception:', err);
  }
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!sentryInitialized) {
    console.log(`[${level}] ${message}`);
    return;
  }

  try {
    // Uncomment when you install @sentry/react-native:
    /*
    Sentry.captureMessage(message, level);
    */
    
    // Temporary fallback
    console.log(`[${level}] ${message}`);
  } catch (err) {
    console.error('Failed to capture message:', err);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, any>): void {
  if (!sentryInitialized) {
    if (__DEV__) {
      console.log('[Breadcrumb]', message, data);
    }
    return;
  }

  try {
    // Uncomment when you install @sentry/react-native:
    /*
    Sentry.addBreadcrumb({
      message,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
    */
    
    // Temporary fallback
    if (__DEV__) {
      console.log('[Breadcrumb]', message, data);
    }
  } catch (err) {
    console.error('Failed to add breadcrumb:', err);
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
    // Uncomment when you install @sentry/react-native:
    /*
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
    });
    */
  } catch (err) {
    console.error('Failed to set user context:', err);
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
    // Uncomment when you install @sentry/react-native:
    /*
    Sentry.setUser(null);
    */
  } catch (err) {
    console.error('Failed to clear user context:', err);
  }
}

// Example usage in ErrorBoundary component:
// 
// import { captureException } from '@/lib/sentry';
// 
// componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
//   captureException(error, { errorInfo });
// }
