/**
 * Request Size Validation Middleware
 * Plan2 Step 4: Explicit request size limits with proper error messages
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../logger';

/**
 * Default request size limits (in bytes)
 */
export const REQUEST_SIZE_LIMITS = {
    DEFAULT: 1 * 1024 * 1024,        // 1MB for most endpoints
    IMAGE_UPLOAD: 5 * 1024 * 1024,   // 5MB for profile image uploads
    MAX_BODY: 10 * 1024 * 1024,      // 10MB absolute maximum (matches Fastify config)
} as const;

/**
 * Create a request size validation middleware
 * Checks Content-Length header before body parsing
 * @param maxSize Maximum allowed request size in bytes
 * @returns Fastify preHandler function
 */
export function createRequestSizeValidator(maxSize: number = REQUEST_SIZE_LIMITS.DEFAULT) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const contentLength = request.headers['content-length'];

        if (contentLength) {
            const size = parseInt(contentLength, 10);

            if (isNaN(size)) {
                logger.warn('Invalid Content-Length header', {
                    contentLength,
                    ip: request.ip
                });
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'Invalid Content-Length header',
                });
            }

            if (size > maxSize) {
                logger.warn('Request payload too large', {
                    size,
                    maxSize,
                    ip: request.ip,
                    path: request.url
                });
                return reply.code(413).send({
                    error: 'Payload Too Large',
                    message: `Request body exceeds maximum size of ${formatBytes(maxSize)}. Current size: ${formatBytes(size)}`,
                    maxSize,
                    currentSize: size,
                });
            }
        }
    };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Pre-configured validators for common use cases
 */
export const requestSizeValidators = {
    /** Standard 1MB limit for most API endpoints */
    standard: createRequestSizeValidator(REQUEST_SIZE_LIMITS.DEFAULT),

    /** 5MB limit for image upload endpoints */
    imageUpload: createRequestSizeValidator(REQUEST_SIZE_LIMITS.IMAGE_UPLOAD),
} as const;
