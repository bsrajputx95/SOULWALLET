/**
 * Client-side logger for React Native
 * Simple console wrapper without Node.js dependencies
 */

const isDev = process.env.NODE_ENV === 'development' || __DEV__;

export const logger = {
  info: (...args: any[]) => {
    if (isDev) console.log('[INFO]', ...args);
  },
  
  warn: (...args: any[]) => {
    if (isDev) console.warn('[WARN]', ...args);
  },
  
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
  
  debug: (...args: any[]) => {
    if (isDev) console.log('[DEBUG]', ...args);
  },

  logCritical: (...args: any[]) => {
    console.error('[CRITICAL]', ...args);
  }
};
