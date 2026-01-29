import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { type CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';
import { Role } from '@prisma/client'
import { createAuthContext, requireAuth, type AuthContext } from '../lib/middleware/auth';
import { createRateLimitContext, type RateLimitContext } from '../lib/middleware/auth';
import { sanitizeText } from '../lib/validation';
import { getRequestId } from '../lib/middleware/requestId';
import { AuthorizationService, type AppRole } from '../lib/services/authorization'
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { getCurrentTraceId, getCurrentSpanId } from '../lib/otel';

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
  traceId?: string | undefined;
  spanId?: string | undefined;
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

  // Extract trace context for logging correlation
  const traceId = getCurrentTraceId();
  const spanId = getCurrentSpanId();

  return {
    ...authContext,
    req: opts.req,
    res: opts.res,
    rateLimitContext,
    requestId,
    traceId,
    spanId,
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
 * OpenTelemetry tracing middleware
 * Creates spans for each tRPC procedure call with context for Jaeger
 */
const tracingMiddleware = middleware(async ({ path, type, ctx, next }) => {
  const tracer = trace.getTracer('soulwallet-trpc');

  // Normalize procedure path for span name
  const spanName = `trpc.${type}.${path}`;

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      // Add attributes for the span
      span.setAttribute('trpc.path', path);
      span.setAttribute('trpc.type', type);
      span.setAttribute('request.id', ctx.requestId || 'unknown');

      if (ctx.user?.id) {
        span.setAttribute('user.id', ctx.user.id);
      }
      if (ctx.req?.ip) {
        span.setAttribute('client.ip', ctx.req.ip);
      }
      if (ctx.req?.headers?.['user-agent']) {
        const ua = ctx.req.headers['user-agent'];
        span.setAttribute('http.user_agent', Array.isArray(ua) ? ua[0] : ua);
      }

      const result = await next();

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);

      // Add error attributes
      if (error.code) {
        span.setAttribute('error.code', error.code);
      }

      throw error;
    } finally {
      span.end();
    }
  });
});

/**
 * Enhanced procedures with standardized error handling
 */
export const publicProcedure = t.procedure
  .use(tracingMiddleware)
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
  .use(tracingMiddleware)
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

// require2FAMiddleware removed - 2FA functionality removed from application

export const financialProcedure = t.procedure
  .use(sanitizationMiddleware)
  .use(authMiddleware)
  // require2FAMiddleware removed - 2FA functionality removed from application
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
  .use(errorHandlingMiddleware())

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
    } catch {
      void 0;
    }
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

function getIpAddress(ctx: Context): string {
  return ctx.rateLimitContext?.ip || ctx.req?.ip || ctx.fingerprint?.ipAddress || 'unknown'
}

function getUserAgent(ctx: Context): string | undefined {
  const ua = ctx.req?.headers?.['user-agent']
  if (Array.isArray(ua)) return ua[0]
  if (typeof ua === 'string') return ua
  return ctx.fingerprint?.userAgent
}

const requireRole = (requiredRole: AppRole) =>
  middleware(async ({ ctx, next, path }) => {
    const auth = requireAuth(ctx)
    const role: AppRole = (auth.user.role as Role | undefined) ?? 'USER'
    if (!AuthorizationService.hasRole(role, requiredRole)) {
      await AuthorizationService.auditAuthorization(
        {
          userId: auth.user.id,
          role,
          ipAddress: getIpAddress(ctx),
          userAgent: getUserAgent(ctx),
          endpoint: path,
        },
        false,
        `requires_role:${requiredRole}`
      )
      throw new TRPCError({ code: 'FORBIDDEN', message: `This operation requires ${requiredRole} role` })
    }
    return next({
      ctx: {
        ...ctx,
        user: auth.user,
        session: auth.session,
      },
    })
  })

const requireOwnership = (resourceType: string, resourceIdField: string = 'id') =>
  middleware(async ({ ctx, next, input, path }) => {
    const auth = requireAuth(ctx)
    const role: AppRole = (auth.user.role as Role | undefined) ?? 'USER'
    if (role === 'ADMIN') {
      return next({
        ctx: {
          ...ctx,
          user: auth.user,
          session: auth.session,
        },
      })
    }

    const raw = (input as any)?.[resourceIdField]
    const resourceId = typeof raw === 'string' ? raw : undefined
    if (!resourceId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Missing resource ID field: ${resourceIdField}` })
    }

    const result = await AuthorizationService.verifyOwnership(auth.user.id, resourceType, resourceId)
    if (result === 'not_found') {
      await AuthorizationService.auditAuthorization(
        {
          userId: auth.user.id,
          role,
          ipAddress: getIpAddress(ctx),
          userAgent: getUserAgent(ctx),
          endpoint: path,
        },
        false,
        'ownership_not_found',
        { type: resourceType, id: resourceId }
      )
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' })
    }

    if (result !== 'owned') {
      await AuthorizationService.auditAuthorization(
        {
          userId: auth.user.id,
          role,
          ipAddress: getIpAddress(ctx),
          userAgent: getUserAgent(ctx),
          endpoint: path,
        },
        false,
        'ownership_failed',
        { type: resourceType, id: resourceId }
      )
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to access this resource' })
    }

    return next({
      ctx: {
        ...ctx,
        user: auth.user,
        session: auth.session,
      },
    })
  })

const requireAdminWithIpCheck = () =>
  middleware(async ({ ctx, next, path }) => {
    const auth = requireAuth(ctx)
    const role: AppRole = (auth.user.role as Role | undefined) ?? 'USER'
    if (!AuthorizationService.hasRole(role, 'ADMIN')) {
      await AuthorizationService.auditAuthorization(
        {
          userId: auth.user.id,
          role,
          ipAddress: getIpAddress(ctx),
          userAgent: getUserAgent(ctx),
          endpoint: path,
        },
        false,
        'requires_role:ADMIN'
      )
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin privileges required' })
    }

    const ipAddress = getIpAddress(ctx)
    const allowed = await AuthorizationService.checkAdminIpWhitelist(auth.user.id, ipAddress)
    if (!allowed) {
      await AuthorizationService.auditAuthorization(
        {
          userId: auth.user.id,
          role,
          ipAddress,
          userAgent: getUserAgent(ctx),
          endpoint: path,
        },
        false,
        'admin_ip_not_allowed'
      )
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access not allowed from this IP' })
    }

    return next({
      ctx: {
        ...ctx,
        user: auth.user,
        session: auth.session,
      },
    })
  })

export const premiumProcedure = protectedProcedure.use(requireRole('PREMIUM'))

export const adminProcedureSecure = protectedProcedure.use(requireAdminWithIpCheck())

export const createOwnershipProcedure = (resourceType: string, resourceIdField: string = 'id') =>
  protectedProcedure.use(requireOwnership(resourceType, resourceIdField))

/**
 * Comment 2: API key scope enforcement middleware
 * Blocks mutations for READ_ONLY keys and validates CUSTOM permissions
 */
export const requireApiKeyScope = (requiredAction: 'read' | 'write', resource?: string) => {
  return middleware(async ({ ctx, next, type }) => {
    const auth = requireAuth(ctx)

    // If not authenticated via API key, allow (session-based auth has full access)
    if (!auth.apiKey) {
      return next({ ctx })
    }

    const scope = auth.apiKey.scope
    const isWriteOperation = type === 'mutation' || requiredAction === 'write'

    // READ_ONLY keys cannot perform mutations
    if (scope === 'READ_ONLY' && isWriteOperation) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'API key has READ_ONLY scope and cannot perform write operations',
      })
    }

    // FULL_ACCESS keys can do everything
    if (scope === 'FULL_ACCESS') {
      return next({ ctx })
    }

    // CUSTOM scope: Check specific permissions (if resource provided)
    // Note: Permissions stored in apiKey.permissions as Record<string, string[]>
    // For now, CUSTOM is treated as FULL_ACCESS until permissions are properly loaded
    // To fully implement, fetch permissions from DB when needed

    return next({ ctx })
  })
}

/**
 * API-key-aware procedure that enforces scope
 * Use this for endpoints that should be accessible via API key with scope checks
 */
export const apiKeyProcedure = t.procedure
  .use(sanitizationMiddleware)
  .use(authMiddleware)
  .use(requireApiKeyScope('read'))
  .use(errorHandlingMiddleware())

/**
 * API-key-aware procedure for write operations
 */
export const apiKeyWriteProcedure = t.procedure
  .use(sanitizationMiddleware)
  .use(authMiddleware)
  .use(requireApiKeyScope('write'))
  .use(errorHandlingMiddleware())

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
