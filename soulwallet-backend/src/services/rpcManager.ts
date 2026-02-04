/**
 * RPC Connection Manager with Load Balancing & Fallback Support
 * Distributes requests across multiple Helius API keys to avoid rate limits
 */

import { Connection } from '@solana/web3.js';

interface RpcEndpoint {
    url: string;
    name: string;
    isHealthy: boolean;
    lastError?: number;
    priority: number;
    requestCount: number;
    rateLimitResetTime?: number;
}

// Build RPC endpoints from environment variables
// Supports up to 4 Helius API keys for load balancing
function buildRpcEndpoints(): RpcEndpoint[] {
    const endpoints: RpcEndpoint[] = [];
    
    // Primary Helius endpoints (round-robin load balanced)
    const heliusUrls = [
        process.env.HELIUS_RPC_URL?.trim(),
        process.env.HELIUS_RPC_URL_2?.trim(),
        process.env.HELIUS_RPC_URL_3?.trim(),
        process.env.HELIUS_RPC_URL_4?.trim(),
    ].filter((url): url is string => !!url && url.length > 0);
    
    // Add Helius endpoints with round-robin priority (all same priority = round robin)
    heliusUrls.forEach((url, index) => {
        endpoints.push({
            url,
            name: `helius-${index + 1}`,
            isHealthy: true,
            priority: 1, // Same priority for round-robin
            requestCount: 0,
        });
    });
    
    // Fallback public endpoints (only used if all Helius fail)
    const fallbackUrls = [
        { url: 'https://api.mainnet-beta.solana.com', name: 'solana-public' },
        { url: 'https://solana-api.instantnodes.io', name: 'instantnodes' },
        { url: 'https://free.rpcpool.com', name: 'rpcpool-free' },
    ];
    
    fallbackUrls.forEach((fallback, index) => {
        endpoints.push({
            url: fallback.url,
            name: fallback.name,
            isHealthy: true,
            priority: 2 + index, // Lower priority than Helius
            requestCount: 0,
        });
    });
    
    return endpoints;
}

// Initialize endpoints
let RPC_ENDPOINTS: RpcEndpoint[] = buildRpcEndpoints();

// Rebuild endpoints periodically to pick up env changes
setInterval(() => {
    const newEndpoints = buildRpcEndpoints();
    // Preserve health status for existing endpoints
    RPC_ENDPOINTS = newEndpoints.map(newEp => {
        const existing = RPC_ENDPOINTS.find(ep => ep.url === newEp.url);
        return existing ? { ...newEp, isHealthy: existing.isHealthy, requestCount: existing.requestCount } : newEp;
    });
}, 60000); // Check every minute

// Connection cache per endpoint
const connectionCache = new Map<string, Connection>();

// Error tracking
const endpointErrors = new Map<string, number[]>();
const ERROR_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ERRORS = 5; // Mark unhealthy after 5 errors in window

// Round-robin index for load balancing
let roundRobinIndex = 0;

/**
 * Get connection for a specific endpoint
 */
function getConnectionForEndpoint(endpoint: RpcEndpoint): Connection {
    let conn = connectionCache.get(endpoint.url);
    if (!conn) {
        conn = new Connection(endpoint.url, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000,
            disableRetryOnRateLimit: false, // Let @solana/web3.js handle retries too
        });
        connectionCache.set(endpoint.url, conn);
    }
    return conn;
}

/**
 * Track error for an endpoint
 */
function trackEndpointError(endpointName: string): void {
    const now = Date.now();
    const errors = endpointErrors.get(endpointName) || [];
    
    // Keep only recent errors
    const recentErrors = errors.filter(e => now - e < ERROR_WINDOW_MS);
    recentErrors.push(now);
    endpointErrors.set(endpointName, recentErrors);
    
    // Mark unhealthy if too many errors
    const endpoint = RPC_ENDPOINTS.find(ep => ep.name === endpointName);
    if (endpoint && recentErrors.length >= MAX_ERRORS) {
        console.warn(`[RPC Manager] Endpoint ${endpointName} marked unhealthy (${recentErrors.length} errors in 5min)`);
        endpoint.isHealthy = false;
        endpoint.lastError = now;
    }
}

/**
 * Mark endpoint as rate limited and track cooldown
 */
function markRateLimited(endpoint: RpcEndpoint): void {
    console.warn(`[RPC Manager] Endpoint ${endpoint.name} rate limited, cooling down for 30s`);
    endpoint.rateLimitResetTime = Date.now() + 30000; // 30 second cooldown
    trackEndpointError(endpoint.name);
}

/**
 * Check if endpoint is in cooldown
 */
function isInCooldown(endpoint: RpcEndpoint): boolean {
    if (!endpoint.rateLimitResetTime) return false;
    const now = Date.now();
    if (now >= endpoint.rateLimitResetTime) {
        endpoint.rateLimitResetTime = undefined;
        return false;
    }
    return true;
}

/**
 * Get the best available RPC endpoint using round-robin for same-priority endpoints
 */
function getBestEndpoint(): RpcEndpoint {
    const now = Date.now();
    
    // Try to recover unhealthy endpoints after 5 minutes
    for (const ep of RPC_ENDPOINTS) {
        if (!ep.isHealthy && ep.lastError && now - ep.lastError > 5 * 60 * 1000) {
            console.log(`[RPC Manager] Attempting recovery of ${ep.name}`);
            ep.isHealthy = true;
            ep.lastError = undefined;
            endpointErrors.delete(ep.name);
        }
    }
    
    // Clear cooldowns
    for (const ep of RPC_ENDPOINTS) {
        if (ep.rateLimitResetTime && now >= ep.rateLimitResetTime) {
            ep.rateLimitResetTime = undefined;
        }
    }
    
    // Group by priority
    const priorityGroups = new Map<number, RpcEndpoint[]>();
    for (const ep of RPC_ENDPOINTS) {
        if (ep.isHealthy && !isInCooldown(ep)) {
            const group = priorityGroups.get(ep.priority) || [];
            group.push(ep);
            priorityGroups.set(ep.priority, group);
        }
    }
    
    // Get priorities sorted
    const priorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b);
    
    for (const priority of priorities) {
        const group = priorityGroups.get(priority)!;
        
        if (priority === 1) {
            // Round-robin for primary (Helius) endpoints
            if (group.length === 0) continue;
            
            // Find the endpoint with lowest request count
            const selected = group.reduce((min, ep) => 
                ep.requestCount < min.requestCount ? ep : min
            );
            
            selected.requestCount++;
            return selected;
        } else {
            // For fallbacks, use simple round-robin
            if (group.length > 0) {
                const selected = group[roundRobinIndex % group.length];
                roundRobinIndex++;
                selected.requestCount++;
                return selected;
            }
        }
    }
    
    // All endpoints unhealthy or in cooldown - reset and try again
    console.error('[RPC Manager] All RPC endpoints unhealthy! Resetting...');
    for (const ep of RPC_ENDPOINTS) {
        ep.isHealthy = true;
        ep.lastError = undefined;
        ep.rateLimitResetTime = undefined;
    }
    endpointErrors.clear();
    
    return RPC_ENDPOINTS[0];
}

/**
 * Get the current best connection
 */
export function getConnection(): Connection {
    const endpoint = getBestEndpoint();
    return getConnectionForEndpoint(endpoint);
}

/**
 * Execute RPC call with automatic failover and load balancing
 * This wraps any RPC call and automatically retries with fallback endpoints
 */
export async function executeRpcCall<T>(
    operation: (connection: Connection) => Promise<T>,
    operationName: string = 'RPC call'
): Promise<T> {
    // Sort endpoints: primary (priority 1) first, then by health, then fallbacks
    const endpoints = [...RPC_ENDPOINTS]
        .filter(ep => ep.isHealthy && !isInCooldown(ep))
        .sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.requestCount - b.requestCount; // Prefer less-used endpoints
        });
    
    // If no healthy endpoints, include all and reset
    if (endpoints.length === 0) {
        console.warn('[RPC Manager] No healthy endpoints, trying all...');
        endpoints.push(...RPC_ENDPOINTS);
    }
    
    const errors: string[] = [];
    
    for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        
        try {
            const connection = getConnectionForEndpoint(endpoint);
            const result = await operation(connection);
            
            // Success - mark as healthy and clear errors
            if (!endpoint.isHealthy) {
                console.log(`[RPC Manager] Endpoint ${endpoint.name} recovered`);
                endpoint.isHealthy = true;
                endpoint.lastError = undefined;
            }
            endpointErrors.delete(endpoint.name);
            
            return result;
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            
            // Check if it's a rate limit error
            if (errorMsg.includes('429') || 
                errorMsg.includes('rate limit') || 
                errorMsg.includes('Too Many Requests') ||
                errorMsg.includes('exceeded')) {
                
                console.warn(`[RPC Manager] Rate limit on ${endpoint.name}, trying next...`);
                markRateLimited(endpoint);
                errors.push(`${endpoint.name}: rate limited`);
                
                // Continue to next endpoint immediately
                continue;
            } 
            
            // Service unavailable
            if (errorMsg.includes('503') || errorMsg.includes('unavailable') || errorMsg.includes('timeout')) {
                console.warn(`[RPC Manager] Service unavailable on ${endpoint.name}, trying next...`);
                trackEndpointError(endpoint.name);
                errors.push(`${endpoint.name}: unavailable`);
                continue;
            }
            
            // Other errors - rethrow if it's the last endpoint
            if (i === endpoints.length - 1) {
                throw error;
            }
            
            errors.push(`${endpoint.name}: ${errorMsg.substring(0, 100)}`);
        }
    }
    
    // All endpoints failed
    throw new Error(`All RPC endpoints failed for ${operationName}: ${errors.join(', ')}`);
}

/**
 * Get current RPC status for health checks
 */
export function getRpcStatus(): { 
    endpoints: { name: string; healthy: boolean; priority: number; requests: number; inCooldown: boolean }[] 
} {
    return {
        endpoints: RPC_ENDPOINTS.map(ep => ({
            name: ep.name,
            healthy: ep.isHealthy,
            priority: ep.priority,
            requests: ep.requestCount,
            inCooldown: isInCooldown(ep)
        }))
    };
}

/**
 * Reset all endpoint stats (useful for testing)
 */
export function resetRpcStats(): void {
    for (const ep of RPC_ENDPOINTS) {
        ep.requestCount = 0;
        ep.isHealthy = true;
        ep.lastError = undefined;
        ep.rateLimitResetTime = undefined;
    }
    endpointErrors.clear();
    roundRobinIndex = 0;
}

// For backwards compatibility - export singleton connection
export const connection = getConnection();
