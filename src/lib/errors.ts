import { TRPCError } from '@trpc/server';
import { logger } from './logger';

/**
 * Sanitize error messages for production
 * Removes file paths, secrets, wallet addresses, and emails
 * Plan7 Step 8 implementation
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An error occurred';

  let sanitized = message;

  // Remove file paths (Windows and Unix)
  sanitized = sanitized.replace(/[A-Za-z]:\\[^\s]+\.(ts|js|tsx|jsx|json)/gi, '[file]');
  sanitized = sanitized.replace(/\/[^\s]+\.(ts|js|tsx|jsx|json)/g, '[file]');

  // Remove potential secrets/tokens (32+ alphanumeric)
  sanitized = sanitized.replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '[redacted]');

  // Remove wallet addresses (base58 32-44 chars)
  sanitized = sanitized.replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, '[address]');

  // Remove email addresses
  sanitized = sanitized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');

  // Remove IP addresses
  sanitized = sanitized.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[ip]');

  // Remove potential private keys (hex format)
  sanitized = sanitized.replace(/0x[a-fA-F0-9]{64}/g, '[key]');

  return sanitized;
}

/**
 * Standardized error codes for the application
 */
export const ErrorCode = {
  // Authentication & Authorization
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',

  // Wallet & Blockchain
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  PRIVATE_KEY_INVALID: 'PRIVATE_KEY_INVALID',

  // Data Validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // System & Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Error metadata interface
 */
export interface ErrorMetadata {
  userId?: string | undefined;
  sessionId?: string | undefined;
  requestId?: string | undefined;
  endpoint?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  timestamp?: string | undefined;
  details?: Record<string, any> | undefined;
  originalError?: {
    name: string;
    message: string;
    stack?: string;
  } | string | undefined;
}

/**
 * Enhanced error class with structured logging
 */
export class AppError extends Error {
  public readonly code: TRPCError['code'];
  public readonly errorCode: ErrorCodeType;
  public metadata: ErrorMetadata;
  public readonly isOperational: boolean;

  constructor(
    code: TRPCError['code'],
    message: string,
    errorCode: ErrorCodeType = ErrorCode.UNKNOWN_ERROR,
    metadata: ErrorMetadata = {},
    isOperational: boolean = true
  ) {
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.errorCode = errorCode;
    this.metadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
    };
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, AppError);
  }

  /**
   * Convert to tRPC error
   */
  toTRPCError(): TRPCError {
    return new TRPCError({
      code: this.code,
      message: this.message,
      cause: {
        errorCode: this.errorCode,
        metadata: this.metadata,
      },
    });
  }

  /**
   * Log the error with structured data
   */
  log(): void {
    logger.error('Application error occurred', {
      name: this.name,
      message: this.message,
      code: this.code,
      errorCode: this.errorCode,
      metadata: this.metadata,
      stack: this.stack,
      isOperational: this.isOperational,
    });
  }
}

/**
 * Create a standardized application error
 */
export function createError(
  code: TRPCError['code'],
  message: string,
  errorCode?: ErrorCodeType,
  metadata?: ErrorMetadata
): AppError {
  const error = new AppError(code, message, errorCode, metadata);
  error.log();
  return error;
}

/**
 * Create authentication error
 */
export function createAuthError(
  message: string = 'Authentication failed',
  errorCode: ErrorCodeType = ErrorCode.INVALID_CREDENTIALS,
  metadata?: ErrorMetadata
): AppError {
  return createError('UNAUTHORIZED', message, errorCode, metadata);
}

/**
 * Create validation error
 */
export function createValidationError(
  message: string = 'Validation failed',
  errorCode: ErrorCodeType = ErrorCode.INVALID_INPUT,
  metadata?: ErrorMetadata
): AppError {
  return createError('BAD_REQUEST', message, errorCode, metadata);
}

/**
 * Create not found error
 */
export function createNotFoundError(
  resource: string = 'Resource',
  errorCode: ErrorCodeType = ErrorCode.RESOURCE_NOT_FOUND,
  metadata?: ErrorMetadata
): AppError {
  return createError('NOT_FOUND', `${resource} not found`, errorCode, metadata);
}

/**
 * Create rate limit error
 */
export function createRateLimitError(
  message: string = 'Rate limit exceeded',
  metadata?: ErrorMetadata
): AppError {
  return createError('TOO_MANY_REQUESTS', message, ErrorCode.RATE_LIMIT_EXCEEDED, metadata);
}

/**
 * Create database error
 */
export function createDatabaseError(
  message: string = 'Database operation failed',
  metadata?: ErrorMetadata
): AppError {
  return createError('INTERNAL_SERVER_ERROR', message, ErrorCode.DATABASE_ERROR, metadata);
}

/**
 * Create wallet/blockchain error
 */
export function createWalletError(
  message: string,
  errorCode: ErrorCodeType = ErrorCode.WALLET_NOT_FOUND,
  metadata?: ErrorMetadata
): AppError {
  return createError('BAD_REQUEST', message, errorCode, metadata);
}

/**
 * Error handling wrapper for async functions
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: Partial<ErrorMetadata>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // If it's already an AppError, just re-throw
      if (error instanceof AppError) {
        throw error.toTRPCError();
      }

      // If it's a tRPC error, re-throw as is
      if (error instanceof TRPCError) {
        throw error;
      }

      // Handle known error types
      if (error instanceof Error) {
        // Plan7 Step 8: Sanitize error messages in production
        const sanitizedMessage = process.env.NODE_ENV === 'production'
          ? sanitizeErrorMessage(error.message)
          : error.message;

        // Build metadata - remove stack trace in production
        const errorMetadata: ErrorMetadata = {
          ...context,
          originalError: process.env.NODE_ENV === 'production'
            ? { name: error.name, message: sanitizeErrorMessage(error.message) }
            : {
              name: error.name,
              message: error.message,
              ...(error.stack ? { stack: error.stack } : {}),
            },
        };

        const appError = new AppError(
          'INTERNAL_SERVER_ERROR',
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : sanitizedMessage,
          ErrorCode.UNKNOWN_ERROR,
          errorMetadata,
          false // Not operational since it's unexpected
        );

        appError.log();
        throw appError.toTRPCError();
      }

      // Handle unknown error types
      const appError = new AppError(
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred',
        ErrorCode.UNKNOWN_ERROR,
        {
          ...context,
          originalError: String(error),
        },
        false
      );

      appError.log();
      throw appError.toTRPCError();
    }
  };
}

/**
 * Error handling middleware for tRPC procedures
 */
export const errorHandlingMiddleware = (context?: Partial<ErrorMetadata>) => {
  return async (opts: { next: () => Promise<any> }) => {
    try {
      return await opts.next();
    } catch (error) {
      // If it's already an AppError, enhance with context and re-throw
      if (error instanceof AppError) {
        error.metadata = { ...error.metadata, ...context };
        error.log();
        throw error.toTRPCError();
      }

      // If it's a tRPC error, re-throw as is
      if (error instanceof TRPCError) {
        throw error;
      }

      // Convert other errors to AppError
      const appError = new AppError(
        'INTERNAL_SERVER_ERROR',
        error instanceof Error ? error.message : 'An unexpected error occurred',
        ErrorCode.UNKNOWN_ERROR,
        context,
        false
      );

      appError.log();
      throw appError.toTRPCError();
    }
  };
};

/**
 * Success response helper
 */
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  metadata?: Record<string, any>
) => ({
  success: true as const,
  data,
  message,
  metadata: {
    timestamp: new Date().toISOString(),
    ...metadata,
  },
});

/**
 * Error response helper (for non-tRPC endpoints)
 */
export const createErrorResponse = (
  error: AppError | Error,
  includeStack: boolean = false
) => {
  if (error instanceof AppError) {
    return {
      success: false as const,
      error: {
        code: error.code,
        errorCode: error.errorCode,
        message: error.message,
        metadata: error.metadata,
        ...(includeStack && { stack: error.stack }),
      },
    };
  }

  return {
    success: false as const,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      errorCode: ErrorCode.UNKNOWN_ERROR,
      message: error.message || 'An unexpected error occurred',
      ...(includeStack && { stack: error.stack }),
    },
  };
};

/**
 * Type guards
 */
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

export const isTRPCError = (error: any): error is TRPCError => {
  return error instanceof TRPCError;
};

export const isOperationalError = (error: any): boolean => {
  return isAppError(error) && error.isOperational;
};