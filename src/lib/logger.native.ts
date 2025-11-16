/**
 * React Native compatible logger
 * This replaces pino and other Node.js specific logging modules
 */

import { getRequestContext } from './middleware/requestId';

// Simple console-based logger for React Native
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
      ...(data && { data: this.sanitize(data) })
    };
    
    if (__DEV__) {
      // In development, use formatted console output
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      const contextStr = requestId ? ` [${requestId}]` : '';
      console.log(`${prefix}${contextStr} ${message}`, data || '');
    } else {
      // In production, log as JSON
      console.log(JSON.stringify(logData));
    }
  }
  
  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitive = ['password', 'token', 'secret', 'apikey', 'privatekey'];
    const sanitized = { ...obj };
    for (const key in sanitized) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }
    return sanitized;
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
    if (__DEV__) {
      this.formatMessage('debug', message, data);
    }
  }
  
  fatal(message: string, data?: any) {
    this.formatMessage('fatal', message, data);
  }
  
  trace(message: string, data?: any) {
    if (__DEV__) {
      this.formatMessage('trace', message, data);
    }
  }
  
  child(context: any) {
    const childLogger = new ReactNativeLogger();
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }
}

// Export singleton instance
export const logger = new ReactNativeLogger();
export default logger;
