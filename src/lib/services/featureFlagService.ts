/**
 * Feature Flag Service
 *
 * Provides feature flag management for SoulWallet using Unleash protocol.
 * Supports local evaluation, remote provider integration, and graceful fallbacks.
 */

import { logger } from '../logger';

// Redis client - conditionally import
let redis: { get: (key: string) => Promise<string | null>; setex: (key: string, ttl: number, value: string) => Promise<void>; } | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const redisModule = require('../redis');
    redis = redisModule.redis || redisModule.default;
} catch {
    // Redis not available, caching will be disabled
}

interface FeatureFlag {
    name: string;
    enabled: boolean;
    description?: string;
    strategies?: FeatureStrategy[];
    variants?: FeatureVariant[];
    createdAt?: Date;
    updatedAt?: Date;
}

interface FeatureStrategy {
    name: string;
    parameters: Record<string, string>;
    constraints?: FeatureConstraint[];
}

interface FeatureConstraint {
    contextName: string;
    operator: 'IN' | 'NOT_IN' | 'STR_CONTAINS' | 'STR_STARTS_WITH' | 'STR_ENDS_WITH' | 'NUM_EQ' | 'NUM_GT' | 'NUM_LT';
    values: string[];
}

interface FeatureVariant {
    name: string;
    weight: number;
    payload?: {
        type: 'string' | 'json' | 'number';
        value: string;
    };
}

interface FeatureContext {
    userId?: string;
    sessionId?: string;
    environment?: string;
    appVersion?: string;
    platform?: 'ios' | 'android' | 'web';
    customProperties?: Record<string, string>;
}

interface FeatureFlagConfig {
    provider: 'local' | 'unleash' | 'launchdarkly';
    apiUrl?: string | undefined;
    apiKey?: string | undefined;
    environment?: string | undefined;
    refreshIntervalMs?: number | undefined;
    cacheEnabled?: boolean | undefined;
    cacheTtlSeconds?: number | undefined;
}

// Default feature flags (fallback when provider unavailable)
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
    'copy-trading-v2': {
        name: 'copy-trading-v2',
        enabled: false,
        description: 'Enable copy trading v2 with improved performance',
    },
    'social-feed-algorithm': {
        name: 'social-feed-algorithm',
        enabled: true,
        description: 'Use algorithmic feed ranking',
    },
    'vault-secrets': {
        name: 'vault-secrets',
        enabled: false,
        description: 'Use Vault for secret management (REMOVED FOR BETA)',
    },
    'canary-features': {
        name: 'canary-features',
        enabled: false,
        description: 'Enable features in canary deployment only',
    },
    'advanced-analytics': {
        name: 'advanced-analytics',
        enabled: true,
        description: 'Enable advanced portfolio analytics',
    },
    'dark-mode': {
        name: 'dark-mode',
        enabled: true,
        description: 'Enable dark mode UI',
    },
    'push-notifications': {
        name: 'push-notifications',
        enabled: true,
        description: 'Enable push notifications',
    },
    'biometric-auth': {
        name: 'biometric-auth',
        enabled: true,
        description: 'Enable biometric authentication',
    },
};

class FeatureFlagService {
    private config: FeatureFlagConfig;
    private flags: Map<string, FeatureFlag> = new Map();
    private refreshInterval: ReturnType<typeof setInterval> | null = null;
    private initialized: boolean = false;

    constructor(config?: Partial<FeatureFlagConfig>) {
        this.config = {
            provider: config?.provider || (process.env.FEATURE_FLAG_PROVIDER as 'local' | 'unleash' | 'launchdarkly') || 'local',
            apiUrl: config?.apiUrl || process.env.UNLEASH_API_URL || process.env.LAUNCHDARKLY_API_URL,
            apiKey: config?.apiKey || process.env.UNLEASH_API_KEY || process.env.LAUNCHDARKLY_SDK_KEY,
            environment: config?.environment || process.env.NODE_ENV || 'development',
            refreshIntervalMs: config?.refreshIntervalMs || 60000, // 1 minute
            cacheEnabled: config?.cacheEnabled ?? true,
            cacheTtlSeconds: config?.cacheTtlSeconds || 300, // 5 minutes
        };

        // Initialize with default flags
        Object.entries(DEFAULT_FLAGS).forEach(([name, flag]) => {
            this.flags.set(name, flag);
        });
    }

    /**
     * Initialize the feature flag service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.fetchFlags();
            this.startRefreshInterval();
            this.initialized = true;
            logger.info(`Feature flag service initialized with provider: ${this.config.provider}`);
        } catch (error) {
            logger.warn('Failed to initialize feature flags from provider, using defaults', { error });
            this.initialized = true; // Continue with defaults
        }
    }

    /**
     * Check if a feature is enabled
     */
    async isEnabled(
        flagName: string,
        context?: FeatureContext,
        defaultValue: boolean = false
    ): Promise<boolean> {
        // Check cache first
        if (this.config.cacheEnabled) {
            const cached = await this.getCachedFlag(flagName);
            if (cached !== null) {
                return this.evaluateFlag(cached, context);
            }
        }

        // Get from memory
        const flag = this.flags.get(flagName);
        if (!flag) {
            return defaultValue;
        }

        const result = this.evaluateFlag(flag, context);

        // Cache result
        if (this.config.cacheEnabled) {
            await this.cacheFlag(flagName, flag);
        }

        return result;
    }

    /**
     * Get variant for a feature flag
     */
    async getVariant(
        flagName: string,
        context?: FeatureContext
    ): Promise<FeatureVariant | null> {
        const flag = this.flags.get(flagName);
        if (!flag || !flag.variants || flag.variants.length === 0) {
            return null;
        }

        // Select variant based on context (consistent hashing)
        const hash = this.hashContext(flagName, context);
        const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
        let cumulative = 0;

        for (const variant of flag.variants) {
            cumulative += variant.weight;
            if (hash <= (cumulative / totalWeight) * 100) {
                return variant;
            }
        }

        return flag.variants[flag.variants.length - 1] ?? null;
    }

    /**
     * Get all feature flags (for debugging)
     */
    getAllFlags(): Record<string, FeatureFlag> {
        const result: Record<string, FeatureFlag> = {};
        this.flags.forEach((flag, name) => {
            result[name] = flag;
        });
        return result;
    }

    /**
     * Override a flag locally (for testing)
     */
    setOverride(flagName: string, enabled: boolean): void {
        const existing = this.flags.get(flagName) || { name: flagName, enabled: false };
        this.flags.set(flagName, { ...existing, enabled });
        logger.info(`Feature flag override set: ${flagName} = ${enabled}`);
    }

    /**
     * Clear a local override
     */
    clearOverride(flagName: string): void {
        const defaultFlag = DEFAULT_FLAGS[flagName];
        if (defaultFlag) {
            this.flags.set(flagName, defaultFlag);
        }
    }

    /**
     * Stop the service
     */
    shutdown(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.initialized = false;
        logger.info('Feature flag service shut down');
    }

    // Private methods

    private evaluateFlag(flag: FeatureFlag, context?: FeatureContext): boolean {
        if (!flag.enabled) return false;
        if (!flag.strategies || flag.strategies.length === 0) return flag.enabled;

        // Evaluate strategies
        return flag.strategies.some(strategy => this.evaluateStrategy(strategy, context));
    }

    private evaluateStrategy(strategy: FeatureStrategy, context?: FeatureContext): boolean {
        switch (strategy.name) {
            case 'default':
                return true;

            case 'userWithId':
                {
                    if (!context?.userId) return false;
                    const userIds = strategy.parameters.userIds?.split(',') || [];
                    return userIds.includes(context.userId);
                }

            case 'gradualRolloutUserId':
                {
                    if (!context?.userId) return false;
                    const percentage = parseInt(strategy.parameters.percentage || '0', 10);
                    const hash = this.simpleHash(context.userId);
                    return hash % 100 < percentage;
                }

            case 'remoteAddress':
                // Not implemented for mobile
                return true;

            case 'applicationHostname':
                return true;

            case 'flexibleRollout':
                {
                    const rollout = parseInt(strategy.parameters.rollout || '0', 10);
                    const stickiness = strategy.parameters.stickiness || 'default';
                    const value = context?.userId || context?.sessionId || 'anonymous';
                    const bucket = this.simpleHash(value + stickiness) % 100;
                    return bucket < rollout;
                }

            default:
                return true;
        }
    }

    private async fetchFlags(): Promise<void> {
        if (this.config.provider === 'local') {
            return; // Use defaults
        }

        if (this.config.provider === 'unleash') {
            await this.fetchUnleashFlags();
        } else if (this.config.provider === 'launchdarkly') {
            await this.fetchLaunchDarklyFlags();
        }
    }

    private async fetchUnleashFlags(): Promise<void> {
        if (!this.config.apiUrl || !this.config.apiKey) {
            throw new Error('Unleash API URL and key required');
        }

        const response = await fetch(`${this.config.apiUrl}/client/features`, {
            headers: {
                'Authorization': this.config.apiKey,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Unleash API error: ${response.status}`);
        }

        const data = await response.json();

        for (const feature of data.features || []) {
            this.flags.set(feature.name, {
                name: feature.name,
                enabled: feature.enabled,
                description: feature.description,
                strategies: feature.strategies,
                variants: feature.variants,
            });
        }

        logger.debug(`Fetched ${data.features?.length || 0} flags from Unleash`);
    }

    private async fetchLaunchDarklyFlags(): Promise<void> {
        if (!this.config.apiUrl || !this.config.apiKey) {
            throw new Error('LaunchDarkly API URL and key required');
        }

        // LaunchDarkly has a different API structure
        const response = await fetch(`${this.config.apiUrl}/sdk/latest-all`, {
            headers: {
                'Authorization': this.config.apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`LaunchDarkly API error: ${response.status}`);
        }

        const data = await response.json();

        for (const [key, flag] of Object.entries<{ on: boolean }>(data.flags || {})) {
            this.flags.set(key, {
                name: key,
                enabled: flag.on,
            });
        }

        logger.debug(`Fetched ${Object.keys(data.flags || {}).length} flags from LaunchDarkly`);
    }

    private startRefreshInterval(): void {
        if (this.config.provider === 'local') return;

        this.refreshInterval = setInterval(async () => {
            try {
                await this.fetchFlags();
            } catch (error) {
                logger.warn('Failed to refresh feature flags', { error });
            }
        }, this.config.refreshIntervalMs);
    }

    private async getCachedFlag(flagName: string): Promise<FeatureFlag | null> {
        if (!redis) return null;
        try {
            const cached = await redis.get(`ff:${flagName}`);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch {
            // Cache miss or error
        }
        return null;
    }

    private async cacheFlag(flagName: string, flag: FeatureFlag): Promise<void> {
        if (!redis) return;
        try {
            await redis.setex(
                `ff:${flagName}`,
                this.config.cacheTtlSeconds || 300,
                JSON.stringify(flag)
            );
        } catch {
            // Cache write error
        }
    }

    private hashContext(flagName: string, context?: FeatureContext): number {
        const input = `${flagName}:${context?.userId || context?.sessionId || 'anonymous'}`;
        return this.simpleHash(input) % 100;
    }

    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

// Singleton instance
let featureFlagService: FeatureFlagService | null = null;

/**
 * Get or create feature flag service instance
 */
export function getFeatureFlagService(config?: Partial<FeatureFlagConfig>): FeatureFlagService {
    if (!featureFlagService) {
        featureFlagService = new FeatureFlagService(config);
    }
    return featureFlagService;
}

/**
 * Initialize feature flags (call at app startup)
 */
export async function initializeFeatureFlags(): Promise<FeatureFlagService> {
    const service = getFeatureFlagService();
    await service.initialize();
    return service;
}

/**
 * Convenience method to check if a feature is enabled
 */
export async function isFeatureEnabled(
    flagName: string,
    context?: FeatureContext,
    defaultValue: boolean = false
): Promise<boolean> {
    const service = getFeatureFlagService();
    return service.isEnabled(flagName, context, defaultValue);
}

export { FeatureFlagService };
export type { FeatureFlag, FeatureContext, FeatureVariant, FeatureFlagConfig };
