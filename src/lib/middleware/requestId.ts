// Check if we're in React Native environment
const isReactNative = typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';

// Simple fallback for React Native
let fallbackContext: { requestId?: string; userId?: string } = {};

// Only import Node.js modules if not in React Native
let requestContext: any;
let randomUUID: any;

if (!isReactNative && typeof require !== 'undefined') {
  try {
    const { AsyncLocalStorage } = require('async_hooks');
    const crypto = require('crypto');
    randomUUID = crypto.randomUUID;
    requestContext = new AsyncLocalStorage();
  } catch {
    // Fallback for environments where these modules aren't available
    requestContext = {
      getStore: () => fallbackContext,
      run: (context: any, callback: any) => {
        fallbackContext = context;
        callback();
      }
    };
  }
} else {
  // React Native fallback
  requestContext = {
    getStore: () => fallbackContext,
    run: (context: any, callback: any) => {
      fallbackContext = context;
      callback();
    }
  };
}

export { requestContext };

export function getRequestId(): string | undefined {
  const context = requestContext.getStore();
  return context?.requestId;
}

export function getRequestContext() {
  return requestContext.getStore();
}

export function generateRequestId(): string {
  if (randomUUID) {
    return randomUUID();
  }
  // Fallback UUID generation for React Native
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Fastify plugin - only used in Node.js environment
export const fastifyRequestIdPlugin = !isReactNative ? 
  async (fastify: any) => {
    fastify.addHook('onRequest', (request: any, reply: any, done: any) => {
      // Check for existing X-Request-ID header
      let requestId = request.headers['x-request-id'] as string;
      if (!requestId) {
        requestId = generateRequestId();
      }

      // Store in request.id
      (request as any).id = requestId;

      // Get userId if authenticated
      const userId = (request as any).auth?.user?.id;

      // Add to response headers
      reply.header('X-Request-ID', requestId);

      // Run the rest of the request in the AsyncLocalStorage context
      requestContext.run({ requestId, userId }, done);
    });
  } : undefined;