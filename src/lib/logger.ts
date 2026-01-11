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
let net: any;

if (!isReactNative && typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    pino = require('pino');
    // pino-pretty returns a function directly
    const prettyModule = require('pino-pretty');
    pretty = typeof prettyModule === 'function' ? prettyModule : null;
    const rfs = require('rotating-file-stream');
    createStream = typeof rfs?.createStream === 'function' ? rfs.createStream : null;
    os = require('os');
    net = require('net');
  } catch (error) {
    // Fallback if modules aren't available
    console.warn('Node.js logging modules not available, using fallback logger');
    pino = null;
    pretty = null;
    createStream = null;
    os = null;
    net = null;
  }
}

/**
 * PII Masking Patterns
 * Masks sensitive personal information at the value level
 */
const PII_PATTERNS = {
  // Email: user@domain.com -> u***@d***.com
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // IPv4: 192.168.1.1 -> 192.168.***.***
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  // IPv6 (simplified)
  ipv6: /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/,
  // Solana wallet address (base58, 32-44 chars)
  walletAddress: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  // Document numbers (passport, ID - alphanumeric 6-20 chars)
  documentNumber: /^[A-Z0-9]{6,20}$/i,
  // Phone numbers (various formats)
  phoneNumber: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,14}$/,
}

/**
 * Mask a single PII value based on its detected type
 */
function maskPIIValue(value: string): string {
  if (typeof value !== 'string' || value.length < 3) return value

  // Check for email pattern
  if (PII_PATTERNS.email.test(value)) {
    const parts = value.split('@')
    if (parts.length === 2 && parts[0] && parts[1]) {
      const domainParts = parts[1].split('.')
      if (domainParts.length >= 2 && domainParts[0]) {
        return `${parts[0][0]}***@${domainParts[0][0]}***.${domainParts.slice(1).join('.')}`
      }
    }
    return value // Return original if parsing fails
  }

  // Check for IPv4 pattern
  if (PII_PATTERNS.ipv4.test(value)) {
    const parts = value.split('.')
    return `${parts[0]}.${parts[1]}.***.***`
  }

  // Check for IPv6 pattern
  if (PII_PATTERNS.ipv6.test(value)) {
    const parts = value.split(':')
    return `${parts[0]}:${parts[1]}:****:****:****:****:****:****`.slice(0, value.length)
  }

  // Check for wallet address pattern (base58)
  if (PII_PATTERNS.walletAddress.test(value)) {
    return `${value.slice(0, 4)}...${value.slice(-4)}`
  }

  // Check for document number pattern
  if (PII_PATTERNS.documentNumber.test(value) && value.length >= 6) {
    return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`
  }

  // Check for phone number pattern
  if (PII_PATTERNS.phoneNumber.test(value)) {
    // Keep first 3 and last 2 digits
    const digits = value.replace(/\D/g, '')
    if (digits.length >= 7) {
      return `${digits.slice(0, 3)}****${digits.slice(-2)}`
    }
  }

  return value
}

/**
 * Recursively mask PII values in an object
 */
function maskPII(obj: any): any {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    return maskPIIValue(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskPII(item))
  }

  if (typeof obj === 'object') {
    const masked: any = {}
    for (const key in obj) {
      // Also mask values in keys that commonly contain PII
      const piiKeys = ['email', 'ip', 'ipaddress', 'walletaddress', 'address', 'phone', 'documentnumber', 'passport', 'recipient', 'sender', 'from', 'to']
      const lowerKey = key.toLowerCase()
      if (piiKeys.some(pk => lowerKey.includes(pk))) {
        masked[key] = typeof obj[key] === 'string' ? maskPIIValue(obj[key]) : maskPII(obj[key])
      } else {
        masked[key] = maskPII(obj[key])
      }
    }
    return masked
  }

  return obj
}

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return maskPII(obj);
  const sensitive = ['password', 'token', 'secret', 'apikey', 'privatekey', 'encryptedkey', 'mnemonic', 'seed'];
  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key in sanitized) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    } else if (typeof sanitized[key] === 'string') {
      sanitized[key] = maskPIIValue(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Create Logstash TCP transport for ELK stack
 * Sends JSON logs over TCP to Logstash
 */
function createLogstashTransport(host: string, port: number) {
  if (!net) return null;

  let socket: any = null;
  let reconnecting = false;
  let buffer: string[] = [];
  const MAX_BUFFER_SIZE = 1000;

  const connect = () => {
    if (reconnecting) return;
    reconnecting = true;

    try {
      socket = net.createConnection({ host, port }, () => {
        reconnecting = false;
        console.log(`[Logger] Connected to Logstash at ${host}:${port}`);
        // Flush buffered logs
        while (buffer.length > 0) {
          const log = buffer.shift();
          if (log && socket && !socket.destroyed) {
            socket.write(log + '\n');
          }
        }
      });

      socket.on('error', (err: Error) => {
        console.error('[Logger] Logstash connection error:', err.message);
        socket = null;
        reconnecting = false;
      });

      socket.on('close', () => {
        socket = null;
        reconnecting = false;
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      });
    } catch (err) {
      reconnecting = false;
      console.error('[Logger] Failed to connect to Logstash:', err);
    }
  };

  // Initial connection
  connect();

  return {
    write: (data: string) => {
      if (socket && !socket.destroyed) {
        socket.write(data + '\n');
      } else {
        // Buffer logs while reconnecting
        if (buffer.length < MAX_BUFFER_SIZE) {
          buffer.push(data);
        }
      }
    }
  };
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

  // Add Logstash TCP transport for ELK stack
  // Enabled in production OR when LOGSTASH_ENABLED=true
  const logstashEnabled = process.env.LOGSTASH_ENABLED === 'true' ||
    (isProduction && process.env.LOGSTASH_ENABLED !== 'false');

  if (logstashEnabled) {
    const logstashHost = process.env.LOGSTASH_HOST || 'logstash';
    const logstashPort = parseInt(process.env.LOGSTASH_PORT || '5044', 10);

    const logstashTransport = createLogstashTransport(logstashHost, logstashPort);
    if (logstashTransport) {
      streams.push({
        level: logLevel,
        stream: logstashTransport,
      });
      console.log(`[Logger] Logstash transport enabled: ${logstashHost}:${logstashPort}`);
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

// Export sanitize for use in other modules
export { sanitize };
