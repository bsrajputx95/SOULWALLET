// React Native compatible logger
// This file checks the environment and uses the appropriate logger implementation

import { getRequestContext } from './middleware/requestId';

// Check if we're in React Native
const isReactNative = typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';

// Only import Node modules if not in React Native
let pino: any;
let pretty: any;
let createStream: any;
let os: any;

if (!isReactNative && typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    pino = require('pino');
    // pino-pretty returns a function directly
    const prettyModule = require('pino-pretty');
    pretty = typeof prettyModule === 'function' ? prettyModule : null;
    const rfs = require('rotating-file-stream');
    createStream = typeof rfs?.createStream === 'function' ? rfs.createStream : null;
    os = require('os');
  } catch (error) {
    // Fallback if modules aren't available
    console.warn('Node.js logging modules not available, using fallback logger');
    pino = null;
    pretty = null;
    createStream = null;
    os = null;
  }
}

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const sensitive = ['password', 'token', 'secret', 'apikey', 'privatekey'];
  const sanitized = { ...obj };
  for (const key in sanitized) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
}

// Create appropriate logger based on environment
let logger: any;

// Force React Native logger in React Native environment or when pino is not available
if (isReactNative || !pino) {
  // Use React Native compatible logger
  class ReactNativeLogger {
    private context: any = {};
    
    private formatMessage(level: string, message: string, data?: any) {
      const timestamp = new Date().toISOString();
      const reqContext = getRequestContext();
      const requestId = reqContext?.requestId;
      const userId = reqContext?.userId;
      
      const logData = {
        timestamp,
        level,
        message,
        ...(requestId && { requestId }),
        ...(userId && { userId }),
        ...(data && { data: sanitize(data) })
      };
      
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : false;
      if (isDev) {
        // In development, use formatted console output
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        const contextStr = requestId ? ` [${requestId}]` : '';
        console.log(`${prefix}${contextStr} ${message}`, data || '');
      } else {
        // In production, log as JSON
        console.log(JSON.stringify(logData));
      }
    }
    
    info(message: string, data?: any) {
      this.formatMessage('info', message, data);
    }
    
    error(message: string, error?: any) {
      const errorData = error instanceof Error ? {
        errorMessage: error.message,
        stack: error.stack,
        name: error.name
      } : error;
      this.formatMessage('error', message, errorData);
    }
    
    warn(message: string, data?: any) {
      this.formatMessage('warn', message, data);
    }
    
    debug(message: string, data?: any) {
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : false;
      if (isDev) {
        this.formatMessage('debug', message, data);
      }
    }
    
    fatal(message: string, data?: any) {
      this.formatMessage('fatal', message, data);
    }
    
    trace(message: string, data?: any) {
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : false;
      if (isDev) {
        this.formatMessage('trace', message, data);
      }
    }
    
    child(context: any) {
      const childLogger = new ReactNativeLogger();
      childLogger.context = { ...this.context, ...context };
      return childLogger;
    }
  }
  
  logger = new ReactNativeLogger();
} else if (pino && typeof pino === 'function') {
  // Use pino for Node.js
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const streams: any[] = [];

  if (!isProduction && pretty && typeof pretty === 'function') {
    streams.push({
      level: logLevel,
      stream: pretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      }),
    });
  } else {
    // Console JSON
    streams.push({
      level: logLevel,
      stream: process.stdout,
    });
    // Rotating file if available
    if (createStream && typeof createStream === 'function') {
      const fileStream = createStream('app.log', {
        path: 'logs',
        size: '10M',
        interval: '1d',
        compress: 'gzip',
        maxFiles: 7,
      });
      streams.push({
        level: logLevel,
        stream: fileStream,
      });
    }
  }

  const pinoLogger = pino({
    level: logLevel,
    base: {
      pid: process.pid,
      hostname: os?.hostname?.() || 'unknown',
      environment: process.env.NODE_ENV,
    },
  }, pino.multistream(streams));

  // Wrap pino logger with our interface
  logger = {
    info: (message: string, data?: any) => pinoLogger.info(sanitize(data), message),
    error: (message: string, error?: any) => pinoLogger.error(sanitize(error), message),
    warn: (message: string, data?: any) => pinoLogger.warn(sanitize(data), message),
    debug: (message: string, data?: any) => pinoLogger.debug(sanitize(data), message),
    fatal: (message: string, data?: any) => pinoLogger.fatal(sanitize(data), message),
    trace: (message: string, data?: any) => pinoLogger.trace(sanitize(data), message),
    child: (context: any) => pinoLogger.child(sanitize(context))
  };
} else {
  // Fallback logger using console
  logger = {
    info: (message: string, data?: any) => console.log('[INFO]', message, data),
    error: (message: string, error?: any) => console.error('[ERROR]', message, error),
    warn: (message: string, data?: any) => console.warn('[WARN]', message, data),
    debug: (message: string, data?: any) => console.log('[DEBUG]', message, data),
    fatal: (message: string, data?: any) => console.error('[FATAL]', message, data),
    trace: (message: string, data?: any) => console.log('[TRACE]', message, data),
    child: (_context: any) => logger
  };
}

// Export the logger
export { logger };
export default logger;

// Export types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'trace';