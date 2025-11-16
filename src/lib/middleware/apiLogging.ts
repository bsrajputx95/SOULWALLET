import type { FastifyPluginAsync } from 'fastify';
import { logger } from '../logger';
import { getRequestId } from './requestId';

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const sensitive = ['password', 'token', 'secret', 'apikey', 'privatekey'];
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
}

function truncateBody(body: any, maxLength: number = 1024): string {
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

export const apiLoggingPlugin: FastifyPluginAsync = async (fastify) => {
  const enableLogging = process.env.ENABLE_API_LOGGING !== 'false';
  const sampleRate = parseFloat(process.env.API_LOG_SAMPLE_RATE || '1.0');
  const logBody = process.env.API_LOG_BODY === 'true' || (process.env.NODE_ENV === 'development' && process.env.API_LOG_BODY !== 'false');

  if (!enableLogging) return;

  fastify.addHook('onRequest', async (request, _reply) => {
    if (request.url.startsWith('/health')) return;

    if (sampleRate < 1.0 && Math.random() > sampleRate) return;

    const requestId = getRequestId();
    const xForwardedFor = request.headers['x-forwarded-for'];
    const ip = (typeof xForwardedFor === 'string' ? xForwardedFor.split(',')[0]?.trim() : xForwardedFor?.[0]) || request.ip;
    const userAgent = request.headers['user-agent'];
    const userId = (request as any).auth?.user?.id;
    const timestamp = new Date().toISOString();

    const logData: any = {
      requestId,
      method: request.method,
      url: request.url,
      ip,
      userAgent,
      userId,
      timestamp,
    };

    if (['POST', 'PUT', 'PATCH'].includes(request.method) && logBody && request.body) {
      logData.body = truncateBody(sanitize(request.body));
    }

    logger.info('API Request', logData);

    // Store start time for duration calculation
    (request as any).startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/health')) return;

    if (sampleRate < 1.0 && Math.random() > sampleRate) return;

    const requestId = getRequestId();
    const startTime = (request as any).startTime || Date.now();
    const duration = Date.now() - startTime;
    const statusCode = reply.statusCode;
    const contentLength = reply.getHeader('content-length');
    const userId = (request as any).auth?.user?.id;

    const logData = {
      requestId,
      statusCode,
      duration,
      contentLength,
      userId,
    };

    if (statusCode >= 500) {
      logger.error('API Response', logData);
    } else if (statusCode >= 400) {
      logger.warn('API Response', logData);
    } else {
      logger.info('API Response', logData);
    }
  });
};