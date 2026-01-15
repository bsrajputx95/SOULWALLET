/**
 * JWT Rotation Service - STUB FOR BETA
 * 
 * This is a simplified stub. Full JWT rotation with scheduled key changes
 * will be implemented post-beta. Currently uses static secrets from env.
 */

import { logger } from '../logger';

export interface JWTSecretEntry {
    kid: string;
    secret: string;
    createdAt: Date;
    expiresAt: Date | null;
    isActive: boolean;
}

class JWTSecretCache {
    private secret: string;
    private refreshSecret: string;

    constructor() {
        this.secret = process.env.JWT_SECRET || 'default-jwt-secret-change-me';
        this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me';
    }

    getCurrentSecret(): string {
        return this.secret;
    }

    getRefreshSecret(): string {
        return this.refreshSecret;
    }

    getSecretByKid(_kid: string): string | null {
        // Single secret for beta - no rotation
        return this.secret;
    }

    getCurrentKid(): string {
        return 'beta-key-1';
    }

    // Methods needed by AuthService
    getVerificationSecrets(type: 'access' | 'refresh'): string[] {
        // Return single secret as array - no multi-secret rotation for beta
        return [type === 'access' ? this.secret : this.refreshSecret];
    }

    getSigningSecret(type: 'access' | 'refresh'): string {
        return type === 'access' ? this.secret : this.refreshSecret;
    }

    async initialize(): Promise<void> {
        logger.info('[JWT-STUB] JWT secret cache initialized (no rotation for beta)');
    }
}

export const jwtSecretCache = new JWTSecretCache();

export class JWTRotationService {
    private static initialized = false;

    static async initializeFromEnv(): Promise<void> {
        await jwtSecretCache.initialize();
        this.initialized = true;
        logger.info('[JWT-STUB] JWT rotation service initialized from env');
    }

    static isInitialized(): boolean {
        return this.initialized;
    }

    static async checkAndRotate(_rotatedBy?: string): Promise<{
        accessRotated: boolean;
        refreshRotated: boolean;
        message: string;
    }> {
        // No-op for beta - no rotation
        logger.debug('[JWT-STUB] checkAndRotate skipped for beta');
        return {
            accessRotated: false,
            refreshRotated: false,
            message: 'JWT rotation disabled for beta'
        };
    }

    static async rotateSecrets(): Promise<void> {
        // No-op for beta
        logger.info('[JWT-STUB] JWT rotation skipped for beta');
    }

    static async getRotationStatus(): Promise<{
        currentKid: string;
        nextRotation: Date | null;
        secretCount: number;
    }> {
        return {
            currentKid: 'beta-key-1',
            nextRotation: null,
            secretCount: 1,
        };
    }

    static async cleanupExpiredSecrets(): Promise<{
        deactivated: number;
        deleted: number;
    }> {
        return { deactivated: 0, deleted: 0 };
    }
}
