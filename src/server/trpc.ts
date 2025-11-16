import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { type CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';
import { createAuthContext, requireAuth, type AuthContext } from '../lib/middleware/auth';
import { createRateLimitContext, type RateLimitContext } from '../lib/middleware/auth';
import { sanitizeText } from '../lib/validation';
import { getRequestId } from '../lib/middleware/requestId';

import {
  ErrorCode,
  createError,
  createAuthError,
  createValidationError,
  withErrorHandling,
  errorHandlingMiddleware,
  createSuccessResponse as createStandardSuccessResponse,
  isAppError,
  isTRPCError,
  type ErrorMetadata
} from '../lib/errors';

/**
 * Context for tRPC procedures
 */
export interface Context extends AuthContext {
  req: any;
  res?: any;
  rateLimitContext: RateLimitContext;
  requestId?: string | undefined;
}

/**
 * Create context for tRPC
 */
export async function createTRPCContext(
  opts: CreateNextContextOptions | CreateFastifyContextOptions
): Promise<Context> {
  // Create auth context
  const authContext = await createAuthContext(opts);

  // Create rate limit context
  const rateLimitContext = createRateLimitContext(opts, authContext.user?.id);

  // Retrieve request ID
  const requestId = getRequestId();

  return {
    ...authContext,
    req: opts.req,
    res: opts.res,
    rateLimitContext,
    requestId,
  };
}

/**
 * Initialize tRPC with enhanced error formatting
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Enhanced error formatting with standardized error codes
    const baseShape = {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };

    // If it's an AppError, include additional metadata
    if (error.cause && typeof error.cause === 'object' && 'errorCode' in error.cause) {
      return {
        ...baseShape,
        data: {
          ...baseShape.data,
          errorCode: (error.cause as any).errorCode,
          metadata: (error.cause as any).metadata,
        },
      };
    }

    return baseShape;
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const middleware = t.middleware;

/**
 * Enhanced sanitization middleware with error handling
 */
const sanitizationMiddleware = middleware(async ({ ctx, next, input }) => {
  try {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeText(obj);
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      
      return obj;
    };
    
    const sanitizedInput = sanitizeObject(input);
    
    return next({
      ctx,
      input: sanitizedInput,
    });
  } catch (error) {
    throw createValidationError(
      'Input sanitization failed',
      ErrorCode.INVALID_INPUT,
      {
        userId: ctx.user?.id,
        endpoint: ctx.req?.url,
        ipAddress: ctx.req?.ip,
        details: { originalInput: input },
      }
    ).toTRPCError();
  }
});

/**
 * Enhanced procedures with standardized error handling
 */
export const publicProcedure = t.procedure
  .use(sanitizationMiddleware)
  .use(errorHandlingMiddleware());

/**
 * Enhanced authentication middleware with standardized errors
 */
const authMiddleware = middleware(async ({ ctx, next }) => {
  try {
    const auth = requireAuth(ctx);
    return next({
      ctx: {
        ...ctx,
        user: auth.user,
        session: auth.session,
      },
    });
  } catch (error) {
    if (isAppError(error) || isTRPCError(error)) {
      throw error;
    }
    
    throw createAuthError(
      'Authentication failed',
      ErrorCode.INVALID_CREDENTIALS,
      {
        endpoint: ctx.req?.url,
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
      }
    ).toTRPCError();
  }
});

export const protectedProcedure = t.procedure
  .use(sanitizationMiddleware)
  .use(authMiddleware)
  .use(middleware(async ({ ctx, next }) => {
    const enabled = process.env.CSRF_ENABLED === 'true';
    if (enabled) {
      const tokenHeader = ctx.req?.headers?.['x-csrf-token'];
      const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
      if (!token || typeof token !== 'string' || token.length < 16) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'CSRF token missing or invalid' });
      }
    }
    return next();
  }))
  .use(errorHandlingMiddleware());

/**
 * Admin middleware (future enhancement)
 */
const adminMiddleware = middleware(async ({ ctx, next }) => {
  const auth = requireAuth(ctx);

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = ctx.req?.headers?.['x-admin-key'];

  const userEmail = auth.user.email?.toLowerCase();
  let isAdmin = !!(userEmail && adminEmails.includes(userEmail));

  // Best-effort DB role check (optional). If schema lacks 'role', this will be ignored.
  if (!isAdmin) {
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: auth.user.id } });
      const role = (dbUser as any)?.role as string | undefined;
      if (role === 'ADMIN') isAdmin = true;
    } catch {}
  }

  if (!isAdmin && adminKey && providedKey === adminKey) {
    isAdmin = true;
  }

  if (!isAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin privileges required' });
  }

  return next({
    ctx: {
      ...ctx,
      user: auth.user,
      session: auth.session,
    },
  });
});

/**
 * Enhanced logging middleware with error context
 */
const loggingMiddleware = middleware(async ({ path, type, ctx, next }) => {
  const start = Date.now();
  const metadata: ErrorMetadata = {
    userId: ctx.user?.id,
    endpoint: path,
    ipAddress: ctx.req?.ip,
    userAgent: ctx.req?.headers?.['user-agent'],
    requestId: ctx.requestId,
  };
  
  try {
    const result = await next();
    const durationMs = Date.now() - start;
    
    // Log successful request
    logger.info(`${type} ${path} - ${durationMs}ms`, {
      ...metadata,
      durationMs,
      success: true,
    });
    
    return result;
  } catch (error) {
    const durationMs = Date.now() - start;
    
    // Log failed request with error details
    logger.error(`${type} ${path} - ${durationMs}ms - ERROR`, {
      ...metadata,
      durationMs,
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: isTRPCError(error) ? error.code : 'UNKNOWN',
        errorCode: isAppError(error) ? error.errorCode : ErrorCode.UNKNOWN_ERROR,
      },
    });
    
    throw error;
  }
});

export const loggedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(errorHandlingMiddleware());

export const protectedLoggedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(sanitizationMiddleware)
  .use(authMiddleware)
  .use(errorHandlingMiddleware());

export const adminProcedure = t.procedure
  .use(sanitizationMiddleware)
  .use(adminMiddleware)
  .use(errorHandlingMiddleware());

/**
 * Rate limiting middleware factory with enhanced error handling
 */
export const createRateLimitMiddleware = () => {
  return middleware(async ({ next }) => {
    // Rate limiting is handled in individual procedures via applyRateLimit
    // This middleware can be used for additional rate limiting logic
    return next();
  });
};

/**
 * Enhanced error handling utilities (deprecated - use standardized errors)
 * @deprecated Use createError, createAuthError, etc. from ../lib/errors instead
 */
export const createTRPCError = (code: TRPCError['code'], message: string, cause?: unknown) => {
  logger.warn('Using deprecated createTRPCError - consider using standardized error functions');
  return new TRPCError({ code, message, cause });
};

/**
 * Legacy error responses (deprecated - use standardized errors)
 * @deprecated Use createError, createAuthError, etc. from ../lib/errors instead
 */
export const errors = {
  unauthorized: () => createAuthError('Authentication required'),
  forbidden: () => createError('FORBIDDEN', 'Insufficient permissions', ErrorCode.INSUFFICIENT_PERMISSIONS),
  notFound: (resource = 'Resource') => createError('NOT_FOUND', `${resource} not found`, ErrorCode.RESOURCE_NOT_FOUND),
  badRequest: (message = 'Invalid request') => createValidationError(message),
  conflict: (message = 'Resource already exists') => createError('CONFLICT', message, ErrorCode.DUPLICATE_ENTRY),
  tooManyRequests: (message = 'Too many requests') => createError('TOO_MANY_REQUESTS', message, ErrorCode.RATE_LIMIT_EXCEEDED),
  internalError: (message = 'Internal server error') => createError('INTERNAL_SERVER_ERROR', message),
};

/**
 * Enhanced success response helper
 */
export const createSuccessResponse = createStandardSuccessResponse;

/**
 * Pagination helper with enhanced metadata
 */
export const createPaginationResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  metadata?: Record<string, any>
) => ({
  items,
  pagination: {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
  metadata: {
    timestamp: new Date().toISOString(),
    ...metadata,
  },
});

/**
 * Enhanced input validation helper
 */
export const validateInput = <T>(schema: any, input: unknown, context?: Partial<ErrorMetadata>): T => {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw createValidationError(
        'Input validation failed',
        ErrorCode.INVALID_INPUT,
        {
          ...context,
          details: { zodError: error.flatten() },
        }
      ).toTRPCError();
    }
    throw error;
  }
};

/**
 * Enhanced async error handler (deprecated - use withErrorHandling)
 * @deprecated Use withErrorHandling from ../lib/errors instead
 */
export const handleAsync = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  logger.warn('Using deprecated handleAsync - consider using withErrorHandling');
  return withErrorHandling(fn);
};

/**
 * Type helpers
 */
export type Router = ReturnType<typeof router>;
export type Procedure = typeof publicProcedure;
export type ProtectedProcedure = typeof protectedProcedure;
export type AdminProcedure = typeof adminProcedure;
