/**
 * React Native compatible version of requestId middleware
 * This file replaces async_hooks which is not available in React Native
 */

// Simple in-memory store for React Native
let currentContext: { requestId?: string; userId?: string } = {};

export const requestContext = {
  getStore: () => currentContext,
  run: (context: { requestId?: string; userId?: string }, callback: () => void) => {
    currentContext = context;
    callback();
  }
};

export function getRequestId(): string | undefined {
  return currentContext?.requestId;
}

export function getRequestContext() {
  return currentContext;
}

export function generateRequestId(): string {
  // Generate a random UUID without using crypto module
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Fastify plugin is not used in React Native, but we keep the export for compatibility
export const fastifyRequestIdPlugin = undefined;
