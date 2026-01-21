/**
 * Auth hydration state utility
 * 
 * This module breaks the circular dependency between auth-store.ts and trpc.ts
 * by providing a standalone mechanism to track auth hydration state.
 */

// Track hydration state globally so trpc can check it without importing auth-store
let authHydrationComplete = false;

/**
 * Check if auth hydration has completed
 * Used by trpc.ts to determine if token refresh should be attempted
 */
export const isAuthHydrated = (): boolean => authHydrationComplete;

/**
 * Set auth hydration state
 * Called by auth-store.ts when initial user loading completes
 */
export const setAuthHydrated = (value: boolean): void => {
    authHydrationComplete = value;
};
