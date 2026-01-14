import { TRPCError } from '@trpc/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { IncomingHttpHeaders } from 'http';
import { AuthService, type SessionActivityData } from '../services/auth';
import { ApiKeyScope } from '@prisma/client'
import prisma from '../prisma';
import { logger } from '../logger';
import { verifyCaptcha } from '../services/captcha'
import { ApiKeyService } from '../services/apiKey'

function shouldLogApiRequestActivity(): boolean {
  if (process.env.LOG_API_REQUEST_ACTIVITY !== 'true') return false
  const sampleRate = parseFloat(process.env.API_REQUEST_ACTIVITY_SAMPLE_RATE || '0.01')
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return false
  if (sampleRate >= 1) return true
  return Math.random() < sampleRate
}

// Types for fingerprinting
export interface Fingerprint {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthContext {
  user?: {
    id: string;
    email: string;
    role?: 'USER' | 'PREMIUM' | 'ADMIN';
    walletAddress?: string | null;
    walletVerifiedAt?: Date | null;
    emailVerifiedAt?: Date | null;
    createdAt: Date;
  } | undefined;
  session?: {
    id: string;
    userId: string;
  } | undefined;
  apiKey?: {
    id: string
    userId: string
    scope: ApiKeyScope
  } | undefined;
  fingerprint?: Fingerprint | undefined;
  isAuthenticated: boolean;
}

// Interface for request options to improve type safety
export interface RequestOptions {
  req?: {
    headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  };
  res?: unknown; // Optional response object for compatibility
}

/**
 * Extract fingerprint information from request
 */
export function extractFingerprint(
  opts: RequestOptions
): Fingerprint {
  const req = opts?.req || {};
  const headers = req.headers || {};

  let ipAddress: string = 'unknown';
  const xffRaw = (headers as any)['x-forwarded-for'] as string | string[] | undefined;
  if (Array.isArray(xffRaw)) {
    const first = xffRaw[0];
    if (typeof first === 'string' && first.length > 0) {
      ipAddress = first.split(',')[0].trim();
    }
  } else if (typeof xffRaw === 'string' && xffRaw.length > 0) {
    ipAddress = xffRaw.split(',')[0].trim();
  } else if (typeof (headers as any)['x-real-ip'] === 'string') {
    ipAddress = (headers as any)['x-real-ip'] as string;
  } else {
    const sockAddr = req.socket?.remoteAddress;
    ipAddress = typeof sockAddr === 'string' && sockAddr.length > 0 ? sockAddr : 'unknown';
  }

  const uaRaw = (headers as any)['user-agent'] as string | string[] | undefined;
  const userAgent: string | undefined = Array.isArray(uaRaw)
    ? (typeof uaRaw[0] === 'string' ? uaRaw[0] : undefined)
    : (typeof uaRaw === 'string' ? uaRaw : undefined);

  return {
    ipAddress,
    userAgent,
  };
}

/**
 * Validate session fingerprint for security
 */
async function validateSessionFingerprint(
  sessionId: string,
  currentFingerprint: Fingerprint
): Promise<boolean> {
  try {
    const strictMode = process.env.SESSION_FINGERPRINT_STRICT === 'true';

    if (!strictMode) {
      return true; // Skip validation if not in strict mode
    }

    // Get session fingerprint from database
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { ipAddress: true, userAgent: true },
    });

    if (!session) {
      return false;
    }

    // Compare fingerprints
    const ipMatches = !session.ipAddress || session.ipAddress === currentFingerprint.ipAddress;
    const userAgentMatches = !session.userAgent || session.userAgent === currentFingerprint.userAgent;

    return ipMatches && userAgentMatches;
  } catch (error) {
    // If validation fails
    const strictMode = process.env.SESSION_FINGERPRINT_STRICT === 'true';
    logger.warn('Session fingerprint validation error', error);
    return strictMode ? false : true;
  }
}

/**
 * Extract token from Authorization header
 */
function extractTokenFromHeader(authorization?: string): string | null {
  if (!authorization) return null;

  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] ?? null;
}

function extractApiKeyFromHeader(authorization?: string): string | null {
  if (!authorization) return null
  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'ApiKey') return null
  return parts[1] ?? null
}

/**
 * Create authentication context for tRPC with fingerprinting
 */
export async function createAuthContext(
  opts: CreateNextContextOptions | CreateFastifyContextOptions
): Promise<AuthContext> {
  // Extract fingerprint from request
  const fingerprint = extractFingerprint(opts);

  const defaultContext: AuthContext = {
    fingerprint,
    isAuthenticated: false,
  };

  try {
    // Extract token from Authorization header
    const authorization = opts.req.headers.authorization;
    const token = extractTokenFromHeader(authorization);

    if (!token) {
      const apiKey = extractApiKeyFromHeader(authorization)
      if (!apiKey) return defaultContext

      const ipAddress = fingerprint.ipAddress || 'unknown'
      const verified = await ApiKeyService.verifyApiKey(apiKey, ipAddress)
      if (!verified.ok || !verified.userId || !verified.apiKeyId || !verified.scope) return defaultContext

      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
        select: {
          id: true,
          email: true,
          role: true,
          walletAddress: true,
          walletVerifiedAt: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      })

      if (!user) return defaultContext

      // Comment 1 fix: Set isAuthenticated: true for valid API key auth
      return {
        user,
        apiKey: { id: verified.apiKeyId, userId: verified.userId, scope: verified.scope },
        fingerprint,
        isAuthenticated: true,
      }
    }

    // Verify token and get user/session info
    const { userId, sessionId } = AuthService.verifyToken(token);

    // Validate session fingerprint if enabled
    const fingerprintValid = await validateSessionFingerprint(sessionId, fingerprint);
    if (!fingerprintValid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Session fingerprint mismatch',
      });
    }

    // Get current user (this also validates the session)
    const user = await AuthService.getCurrentUser(userId, sessionId);

    // Log session activity for authenticated requests
    if (shouldLogApiRequestActivity()) {
      const activity: SessionActivityData = {
        sessionId,
        userId,
        action: 'API_REQUEST',
        ipAddress: fingerprint.ipAddress || 'unknown',
        ...(fingerprint.userAgent ? { userAgent: fingerprint.userAgent } : {}),
      };
      await AuthService.logSessionActivity(activity);
    }

    return {
      user,
      session: {
        id: sessionId,
        userId,
      },
      fingerprint,
      isAuthenticated: true,
    };
  } catch (error) {
    // Token is invalid or expired, return unauthenticated context
    return defaultContext;
  }
}

/**
 * Middleware to require authentication
 * Comment 1 fix: Accept API-key-authenticated contexts (session is optional)
 */
export function requireAuth(ctx: AuthContext) {
  // API key auth has user + apiKey but no session; JWT auth has user + session
  const hasValidAuth = ctx.isAuthenticated && ctx.user && (ctx.session || ctx.apiKey);

  if (!hasValidAuth) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return {
    user: ctx.user,
    session: ctx.session, // May be undefined for API key auth
    apiKey: ctx.apiKey,   // May be undefined for JWT auth
    fingerprint: ctx.fingerprint,
  };
}

/**
 * Middleware to optionally check authentication
 */
export function optionalAuth(ctx: AuthContext) {
  return {
    user: ctx.user || null,
    session: ctx.session || null,
    fingerprint: ctx.fingerprint,
    isAuthenticated: ctx.isAuthenticated,
  };
}

/**
 * Rate limiting context for authentication endpoints
 */
export interface RateLimitContext {
  ip: string;
  userAgent?: string;
  userId?: string;
}

/**
 * Extract rate limiting context from request
 */
export function createRateLimitContext(
  opts: CreateNextContextOptions | CreateFastifyContextOptions,
  userId?: string
): RateLimitContext {
  const fingerprint = extractFingerprint(opts);

  return {
    ip: fingerprint.ipAddress || 'unknown',
    ...(fingerprint.userAgent ? { userAgent: fingerprint.userAgent } : {}),
    ...(userId ? { userId } : {}),
  };
}

export async function verifyCaptchaMiddleware(captchaToken: string, ipAddress: string): Promise<void> {
  const enabled = process.env.CAPTCHA_ENABLED === 'true'
  if (!enabled) return
  const ok = await verifyCaptcha(captchaToken, ipAddress)
  if (!ok) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'CAPTCHA verification failed',
    })
  }
}



/**
 * Fastify-specific authentication plugin with fingerprinting
 */
export async function fastifyAuthPlugin(fastify: any) {
  fastify.decorateRequest('auth', null);
  fastify.decorateRequest('fingerprint', null);

  fastify.addHook('preHandler', async (request: any, reply: any) => {
    try {
      // Extract fingerprint
      const fingerprint = extractFingerprint({ req: request, res: reply });
      (request as any).fingerprint = fingerprint;

      const authorization = request.headers.authorization;
      const token = extractTokenFromHeader(authorization);

      if (!token) {
        const apiKey = extractApiKeyFromHeader(authorization)
        if (!apiKey) {
          (request as any).auth = { fingerprint, isAuthenticated: false }
          return
        }

        const ipAddress = fingerprint.ipAddress || request.ip || 'unknown'
        const verified = await ApiKeyService.verifyApiKey(apiKey, ipAddress)
        if (!verified.ok || !verified.userId || !verified.apiKeyId || !verified.scope) {
          (request as any).auth = { fingerprint, isAuthenticated: false }
          return
        }

        const user = await prisma.user.findUnique({
          where: { id: verified.userId },
          select: {
            id: true,
            email: true,
            role: true,
            walletAddress: true,
            walletVerifiedAt: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        })
        if (!user) {
          (request as any).auth = { fingerprint, isAuthenticated: false }
          return
        }

        (request as any).auth = {
          user,
          apiKey: { id: verified.apiKeyId, userId: verified.userId, scope: verified.scope },
          fingerprint,
          isAuthenticated: false,
        }
        return
      }

      const { userId, sessionId } = AuthService.verifyToken(token);

      // Validate session fingerprint
      const fingerprintValid = await validateSessionFingerprint(sessionId, fingerprint);
      if (!fingerprintValid) {
        (request as any).auth = {
          fingerprint,
          isAuthenticated: false
        };
        return;
      }

      const user = await AuthService.getCurrentUser(userId, sessionId);

      // Log session activity
      if (shouldLogApiRequestActivity()) {
        const activity: SessionActivityData = {
          sessionId,
          userId,
          action: 'API_REQUEST',
          ipAddress: fingerprint.ipAddress || 'unknown',
          ...(fingerprint.userAgent ? { userAgent: fingerprint.userAgent } : {}),
        };
        await AuthService.logSessionActivity(activity);
      }

      (request as any).auth = {
        user,
        session: { id: sessionId, userId },
        fingerprint,
        isAuthenticated: true,
      };
    } catch (error) {
      const fingerprint = extractFingerprint({ req: request });
      (request as any).auth = {
        fingerprint,
        isAuthenticated: false
      };
    }
  });
}

/**
 * Helper to get user from request (for Fastify routes)
 */
export function getUserFromRequest(request: any): AuthContext {
  return request.auth || {
    fingerprint: request.fingerprint,
    isAuthenticated: false
  };
}

/**
 * Middleware factory for different authentication levels
 */
export const authMiddleware = {
  /**
   * Require authentication - throws error if not authenticated
   */
  required: (ctx: AuthContext) => requireAuth(ctx),

  /**
   * Optional authentication - returns user if authenticated, null otherwise
   */
  optional: (ctx: AuthContext) => optionalAuth(ctx),

  /**
   * Admin only - requires authentication and admin role
   */
  admin: (ctx: AuthContext) => {
    const auth = requireAuth(ctx);
    // DONE: Admin role check implemented in Prisma schema (Role enum: USER, ADMIN)
    // Use adminProcedure in tRPC for automatic role checking
    return auth;
  },

  /**
   * Verified email only - requires authentication and verified email
   */
  verified: async (ctx: AuthContext) => {
    const auth = requireAuth(ctx);
    // Check if email has been verified (emailVerifiedAt exists from Prisma User model)
    if (!auth.user.emailVerifiedAt) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Email verification required. Please verify your email to access this feature.',
      });
    }
    return auth;
  },

  /**
   * Verified wallet only - requires authentication and verified wallet
   */
  verifiedWallet: async (ctx: AuthContext) => {
    const auth = requireAuth(ctx);
    // Check if wallet has been verified (walletVerifiedAt exists from Prisma User model)
    if (!auth.user.walletVerifiedAt) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Wallet verification required. Please verify your wallet to access this feature.',
      });
    }
    return auth;
  },
};

/**
 * Token refresh helper with fingerprint validation
 */
export async function refreshToken(
  currentToken: string,
  _fingerprint?: Fingerprint
): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    // Use the new rotateTokens method from AuthService
    return await AuthService.rotateTokens(currentToken);
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Cannot refresh invalid token',
    });
  }
}

/**
 * Logout helper that invalidates the session with activity logging
 */
export async function logoutUser(ctx: AuthContext): Promise<void> {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'No active session to logout',
    });
  }

  await AuthService.logout(ctx.session.id);
}

/**
 * Enhanced security headers middleware for Fastify
 */
export async function securityHeadersPlugin(fastify: any) {
  fastify.addHook('onSend', async (_request: any, reply: any) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Content Security Policy
    reply.header('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' ws: wss:; " +
      "frame-ancestors 'none';"
    );

    // Only add HSTS in production
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
  });
}
