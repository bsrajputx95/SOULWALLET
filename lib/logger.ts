/**
 * React Native Compatible Logger
 * 
 * Simple logger for React Native environment that doesn't rely on Node.js modules
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  meta?: any;
}

class SimpleLogger {
  private isDevelopment = __DEV__;
  private logLevel: LogLevel = 'info';

  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    // In production, only log warnings and errors
    this.logLevel = this.isDevelopment ? 'debug' : 'warn';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    let fullMessage = `${prefix} ${message}`;
    if (meta) {
      try {
        const metaStr = typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
        fullMessage += ` ${metaStr}`;
      } catch (error) {
        fullMessage += ' [Metadata serialization failed]';
      }
    }
    
    return fullMessage;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    let meta: any;
    let error: Error | undefined;

    // Handle error objects
    if (level === 'error' && args.length > 0 && args[0] instanceof Error) {
      error = args.shift();
    }

    // Handle metadata object
    if (args.length > 0 && typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1])) {
      meta = args.pop();
    }

    // Combine remaining args with message
    const extra = args.join(' ');
    const fullMessage = extra ? `${message} ${extra}` : message;

    // Format and output
    const formattedMessage = this.formatMessage(level, fullMessage, meta);

    switch (level) {
      case 'debug':
        console.log(formattedMessage);
        if (error) console.log(error);
        break;
      case 'info':
        console.info(formattedMessage);
        if (error) console.info(error);
        break;
      case 'warn':
        console.warn(formattedMessage);
        if (error) console.warn(error);
        break;
      case 'error':
        console.error(formattedMessage);
        if (error) console.error(error);
        break;
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, error?: any, ...args: any[]): void {
    this.log('error', message, error, ...args);
  }

  child(bindings: any): SimpleLogger {
    // For React Native, we return the same instance
    // In a more complex implementation, we could store bindings
    return this;
  }
}

export const logger = new SimpleLogger();
