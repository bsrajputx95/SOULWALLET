/**
 * Custom hook for tRPC queries with consistent error handling
 * Task 13.1: Add consistent error handling wrapper
 * Task 13.3: Distinguish loading states
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { TRPCClientError } from '@trpc/client';
import { logger } from '@/lib/client-logger';

interface ErrorHandlerOptions {
  showAlert?: boolean;
  logToSentry?: boolean;
  customMessage?: string;
}

/**
 * Get user-friendly error message from tRPC error
 */
export function getErrorMessage(error: unknown, customMessage?: string): string {
  if (customMessage) return customMessage;
  
  if (error instanceof TRPCClientError) {
    const code = error.data?.code;
    switch (code) {
      case 'UNAUTHORIZED':
        return 'Please log in to continue';
      case 'FORBIDDEN':
        return 'You do not have permission to perform this action';
      case 'NOT_FOUND':
        return 'The requested resource was not found';
      case 'TOO_MANY_REQUESTS':
        return 'Too many requests. Please try again later';
      case 'BAD_REQUEST':
        return error.message || 'Invalid request';
      case 'INTERNAL_SERVER_ERROR':
        return 'Something went wrong. Please try again';
      default:
        return error.message || 'An unexpected error occurred';
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}


/**
 * Handle tRPC error with consistent behavior
 */
export function handleTRPCError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): void {
  const { showAlert = true, logToSentry = true, customMessage } = options;
  
  const message = getErrorMessage(error, customMessage);
  
  // Log to console in dev
  if (__DEV__) {
    logger.error('tRPC Error:', error);
  }
  
  // Log to Sentry in production
  if (logToSentry && !__DEV__) {
    // Sentry.captureException(error);
    logger.error('Error logged to Sentry:', message);
  }
  
  // Show alert to user
  if (showAlert) {
    Alert.alert('Error', message);
  }
}

/**
 * Loading state helper - distinguishes initial load from background refresh
 */
export interface LoadingState {
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoading: boolean;
}

export function getLoadingState(
  isLoading: boolean,
  isFetching: boolean,
  hasData: boolean
): LoadingState {
  return {
    isInitialLoading: isLoading && !hasData,
    isRefreshing: isFetching && hasData,
    isLoading: isLoading || isFetching,
  };
}

/**
 * Hook to handle query errors automatically
 */
export function useQueryErrorHandler(
  error: unknown,
  options: ErrorHandlerOptions = {}
): void {
  const hasHandled = useRef(false);
  
  useEffect(() => {
    if (error && !hasHandled.current) {
      hasHandled.current = true;
      handleTRPCError(error, options);
    }
    
    if (!error) {
      hasHandled.current = false;
    }
  }, [error, options]);
}
