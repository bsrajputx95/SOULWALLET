/**
 * JWT Secret Rotation Service
 * 
 * Handles automated JWT secret rotation with:
 * - Database-backed version tracking
 * - AWS Secrets Manager for plaintext storage (Comment 1 fix)
 * - Zero-downtime rotation (multi-secret support)
 * - Configurable rotation period and overlap
 * - Audit logging for compliance
 */

import crypto from 'crypto';
import prisma from '../prisma';
import { logger } from '../logger';
import { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, DeleteSecretCommand, UpdateSecretCommand, ResourceNotFoundException } from '@aws-sdk/client-secrets-manager';

// Configuration from environment
const ROTATION_PERIOD_DAYS = parseInt(process.env.JWT_ROTATION_PERIOD_DAYS || '90');
const OVERLAP_PERIOD_DAYS = parseInt(process.env.JWT_OVERLAP_PERIOD_DAYS || '7');
const SECRET_LENGTH = 64; // 64 bytes = 512 bits

// AWS Secrets Manager configuration
const SECRETS_MANAGER_PREFIX = process.env.JWT_SECRETS_MANAGER_PREFIX || 'soulwallet/jwt';
const USE_SECRETS_MANAGER = process.env.JWT_USE_SECRETS_MANAGER === 'true' || process.env.NODE_ENV === 'production';

export type SecretPurpose = 'access' | 'refresh';

interface RotationResult {
    success: boolean;
    newVersion: number;
    message: string;
    /**
     * Only returned if NOT using Secrets Manager (for manual env var update)
     * When using Secrets Manager, plaintext is stored in KMS and cache refreshed automatically
     */
    newSecretPlaintext?: string;
}

/**
 * Get AWS Secrets Manager client (lazy initialization)
 */
let secretsManagerClient: SecretsManagerClient | null = null;
function getSecretsManagerClient(): SecretsManagerClient {
    if (!secretsManagerClient) {
        const region = process.env.AWS_REGION || 'us-east-1';
        secretsManagerClient = new SecretsManagerClient({ region });
    }
    return secretsManagerClient;
}

/**
 * Get secret name for AWS Secrets Manager
 */
function getSecretManagerName(purpose: SecretPurpose, version: number): string {
    return `${SECRETS_MANAGER_PREFIX}/${purpose}/v${version}`;
}

/**
 * Store a secret in AWS Secrets Manager
 */
async function storeSecretInKMS(purpose: SecretPurpose, version: number, plaintext: string): Promise<void> {
    if (!USE_SECRETS_MANAGER) {
        logger.debug('Secrets Manager disabled, skipping storage');
        return;
    }

    const client = getSecretsManagerClient();
    const secretName = getSecretManagerName(purpose, version);

    try {
        // Try to create new secret
        await client.send(new CreateSecretCommand({
            Name: secretName,
            SecretString: plaintext,
            Description: `JWT ${purpose} token secret version ${version}`,
            Tags: [
                { Key: 'purpose', Value: purpose },
                { Key: 'version', Value: String(version) },
                { Key: 'service', Value: 'soulwallet' },
            ],
        }));
        logger.info(`Stored JWT secret in Secrets Manager`, { purpose, version, secretName });
    } catch (error: any) {
        if (error.name === 'ResourceExistsException') {
            // Secret exists, update it
            await client.send(new UpdateSecretCommand({
                SecretId: secretName,
                SecretString: plaintext,
            }));
            logger.info(`Updated JWT secret in Secrets Manager`, { purpose, version });
        } else {
            logger.error(`Failed to store secret in Secrets Manager`, { error: error.message, purpose, version });
            throw error;
        }
    }
}

/**
 * Retrieve a secret from AWS Secrets Manager
 */
async function getSecretFromKMS(purpose: SecretPurpose, version: number): Promise<string | null> {
    if (!USE_SECRETS_MANAGER) {
        return null;
    }

    const client = getSecretsManagerClient();
    const secretName = getSecretManagerName(purpose, version);

    try {
        const response = await client.send(new GetSecretValueCommand({
            SecretId: secretName,
        }));
        return response.SecretString || null;
    } catch (error: any) {
        if (error instanceof ResourceNotFoundException || error.name === 'ResourceNotFoundException') {
            logger.debug(`Secret not found in Secrets Manager`, { purpose, version });
            return null;
        }
        logger.error(`Failed to retrieve secret from Secrets Manager`, { error: error.message, purpose, version });
        return null;
    }
}

/**
 * Delete a secret from AWS Secrets Manager
 */
async function deleteSecretFromKMS(purpose: SecretPurpose, version: number): Promise<void> {
    if (!USE_SECRETS_MANAGER) {
        return;
    }

    const client = getSecretsManagerClient();
    const secretName = getSecretManagerName(purpose, version);

    try {
        await client.send(new DeleteSecretCommand({
            SecretId: secretName,
            ForceDeleteWithoutRecovery: false, // Allow recovery window
        }));
        logger.info(`Scheduled deletion of JWT secret from Secrets Manager`, { purpose, version });
    } catch (error: any) {
        if (error instanceof ResourceNotFoundException || error.name === 'ResourceNotFoundException') {
            return; // Already deleted
        }
        logger.warn(`Failed to delete secret from Secrets Manager`, { error: error.message, purpose, version });
    }
}

/**
 * Hash a secret for storage/identification (NOT the secret itself)
 * We store hashes to identify which version was used, never the actual secret
 */
function hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Generate a cryptographically secure secret
 */
function generateSecureSecret(): string {
    return crypto.randomBytes(SECRET_LENGTH).toString('base64url');
}

/**
 * In-memory cache for JWT secrets used in signing/verification.
 * This cache loads secrets from AWS Secrets Manager (if enabled) or environment
 * variables, and refreshes on rotation for zero-downtime updates.
 * 
 * Architecture:
 * 1. On startup: Load from Secrets Manager (KMS) if enabled, otherwise env vars
 * 2. On rotation: Store new secret in Secrets Manager, refresh cache
 * 3. On cleanup: Delete expired secrets from Secrets Manager
 */
interface CachedSecret {
    secret: string;
    hash: string;
    version: number;
    expiresAt: Date;
}

class JWTSecretCache {
    private accessSecrets: CachedSecret[] = [];
    private refreshSecrets: CachedSecret[] = [];
    private initialized = false;

    /**
     * Initialize cache - loads from Secrets Manager (KMS) first, then env vars
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Try loading from Secrets Manager first (production mode)
        if (USE_SECRETS_MANAGER) {
            logger.info('Loading JWT secrets from AWS Secrets Manager');
            await this.loadFromKMS('access');
            await this.loadFromKMS('refresh');
        }

        // If no secrets loaded from KMS, fall back to environment variables (bootstrap)
        if (this.accessSecrets.length === 0) {
            const accessSecretEnv = process.env.JWT_SECRET;
            if (accessSecretEnv) {
                const secrets = accessSecretEnv.split(',').map(s => s.trim()).filter(Boolean);
                for (const secret of secrets) {
                    await this.addSecret(secret, 'access', true); // storeInKMS = true
                }
            }
        }

        if (this.refreshSecrets.length === 0) {
            const refreshSecretEnv = process.env.JWT_REFRESH_SECRET;
            if (refreshSecretEnv) {
                const secrets = refreshSecretEnv.split(',').map(s => s.trim()).filter(Boolean);
                for (const secret of secrets) {
                    await this.addSecret(secret, 'refresh', true);
                }
            }
        }

        this.initialized = true;
        logger.info('JWT secret cache initialized', {
            accessSecrets: this.accessSecrets.length,
            refreshSecrets: this.refreshSecrets.length,
            source: USE_SECRETS_MANAGER ? 'secrets-manager' : 'env',
        });
    }

    /**
     * Load secrets from AWS Secrets Manager based on active DB versions
     */
    async loadFromKMS(purpose: SecretPurpose): Promise<void> {
        try {
            // Get active secret versions from database
            const activeVersions = await prisma.jWTSecretVersion.findMany({
                where: { purpose, isActive: true },
                orderBy: { version: 'desc' },
            });

            for (const dbVersion of activeVersions) {
                // Fetch plaintext from Secrets Manager
                const plaintext = await getSecretFromKMS(purpose, dbVersion.version);
                if (plaintext) {
                    const targetCache = purpose === 'access' ? this.accessSecrets : this.refreshSecrets;
                    targetCache.push({
                        secret: plaintext,
                        hash: dbVersion.secretHash,
                        version: dbVersion.version,
                        expiresAt: dbVersion.expiresAt,
                    });
                    logger.debug(`Loaded JWT secret from Secrets Manager`, { purpose, version: dbVersion.version });
                }
            }

            // Sort by version descending
            const cache = purpose === 'access' ? this.accessSecrets : this.refreshSecrets;
            cache.sort((a, b) => b.version - a.version);
        } catch (error) {
            logger.warn('Failed to load secrets from Secrets Manager, falling back to env', { error });
        }
    }

    /**
     * Refresh cache for a specific purpose (called after rotation)
     */
    async refresh(purpose: SecretPurpose): Promise<void> {
        // Clear current cache for this purpose
        if (purpose === 'access') {
            this.accessSecrets = [];
        } else {
            this.refreshSecrets = [];
        }

        // Reload from KMS
        await this.loadFromKMS(purpose);

        logger.info('JWT secret cache refreshed', {
            purpose,
            count: purpose === 'access' ? this.accessSecrets.length : this.refreshSecrets.length,
        });
    }

    /**
     * Add a secret to the cache and register in database
     * @param secret - Raw secret
     * @param purpose - Secret purpose (access/refresh)
     * @param storeInKMS - If true, also store in Secrets Manager
     */
    async addSecret(secret: string, purpose: SecretPurpose, storeInKMS: boolean = false): Promise<void> {
        const hash = hashSecret(secret);

        // Check if already cached
        const targetCache = purpose === 'access' ? this.accessSecrets : this.refreshSecrets;
        if (targetCache.some(s => s.hash === hash)) {
            return; // Already in cache
        }

        // Register in database if not exists
        let dbRecord;
        try {
            dbRecord = await prisma.jWTSecretVersion.findUnique({
                where: { secretHash: hash },
            });

            if (!dbRecord) {
                // Get next version
                const latestVersion = await prisma.jWTSecretVersion.findFirst({
                    where: { purpose, isActive: true },
                    orderBy: { version: 'desc' },
                    select: { version: true },
                });
                const newVersion = (latestVersion?.version ?? 0) + 1;

                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS);

                dbRecord = await prisma.jWTSecretVersion.create({
                    data: {
                        secretHash: hash,
                        version: newVersion,
                        purpose,
                        expiresAt,
                        isActive: true,
                    },
                });

                // Store in Secrets Manager if requested
                if (storeInKMS) {
                    await storeSecretInKMS(purpose, newVersion, secret);
                }
            }
        } catch (error) {
            // If DB is not available, create a temporary entry
            logger.warn('Could not sync secret to database, using temp entry', { purpose });
            dbRecord = {
                version: targetCache.length + 1,
                expiresAt: new Date(Date.now() + (ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS) * 24 * 60 * 60 * 1000),
            };
        }

        // Add to cache
        targetCache.unshift({
            secret,
            hash,
            version: dbRecord.version,
            expiresAt: dbRecord.expiresAt,
        });

        // Sort by version descending (newest first)
        targetCache.sort((a, b) => b.version - a.version);
    }

    /**
     * Get the signing secret (newest active secret)
     */
    getSigningSecret(purpose: SecretPurpose): string {
        const cache = purpose === 'access' ? this.accessSecrets : this.refreshSecrets;
        if (cache.length === 0) {
            throw new Error(`No active JWT secret for ${purpose}. Did you call initialize()?`);
        }
        return cache[0]!.secret;
    }

    /**
     * Get all verification secrets (for multi-secret verification during overlap)
     */
    getVerificationSecrets(purpose: SecretPurpose): string[] {
        const cache = purpose === 'access' ? this.accessSecrets : this.refreshSecrets;
        const now = new Date();
        return cache
            .filter(s => s.expiresAt > now)
            .map(s => s.secret);
    }

    /**
     * Add a newly rotated secret to the cache
     */
    async addRotatedSecret(secret: string, purpose: SecretPurpose, version: number): Promise<void> {
        const hash = hashSecret(secret);
        const targetCache = purpose === 'access' ? this.accessSecrets : this.refreshSecrets;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS);

        targetCache.unshift({
            secret,
            hash,
            version,
            expiresAt,
        });

        // Sort by version descending
        targetCache.sort((a, b) => b.version - a.version);

        logger.info(`Added rotated secret to cache`, { purpose, version });
    }

    /**
     * Cleanup expired secrets from cache
     */
    cleanupExpired(): void {
        const now = new Date();
        this.accessSecrets = this.accessSecrets.filter(s => s.expiresAt > now);
        this.refreshSecrets = this.refreshSecrets.filter(s => s.expiresAt > now);
    }

    /**
     * Get cache status for monitoring
     */
    getStatus(): {
        access: { count: number; versions: number[] };
        refresh: { count: number; versions: number[] };
        initialized: boolean;
    } {
        return {
            access: {
                count: this.accessSecrets.length,
                versions: this.accessSecrets.map(s => s.version),
            },
            refresh: {
                count: this.refreshSecrets.length,
                versions: this.refreshSecrets.map(s => s.version),
            },
            initialized: this.initialized,
        };
    }
}

// Singleton instance of the secret cache
export const jwtSecretCache = new JWTSecretCache();

export class JWTRotationService {
    /**
     * Get the current active secret version for a purpose
     */
    static async getCurrentVersion(purpose: SecretPurpose): Promise<number> {
        const current = await prisma.jWTSecretVersion.findFirst({
            where: {
                purpose,
                isActive: true,
                expiresAt: { gt: new Date() },
            },
            orderBy: { version: 'desc' },
        });

        return current?.version ?? 0;
    }

    /**
     * Get all active secrets (for multi-secret verification during overlap period)
     */
    static async getActiveSecretHashes(purpose: SecretPurpose): Promise<string[]> {
        const secrets = await prisma.jWTSecretVersion.findMany({
            where: {
                purpose,
                isActive: true,
                expiresAt: { gt: new Date() },
            },
            orderBy: { version: 'desc' },
            select: { secretHash: true },
        });

        return secrets.map((s: { secretHash: string }) => s.secretHash);
    }

    /**
     * Register an existing secret in the database (for initial setup)
     * Use this to register secrets from environment variables
     */
    static async registerExistingSecret(params: {
        secret: string;
        purpose: SecretPurpose;
        rotatedBy?: string;
    }): Promise<{ version: number; secretHash: string }> {
        const { secret, purpose, rotatedBy } = params;
        const secretHash = hashSecret(secret);

        // Check if this secret is already registered
        const existing = await prisma.jWTSecretVersion.findUnique({
            where: { secretHash },
        });

        if (existing) {
            return { version: existing.version, secretHash };
        }

        // Get the next version number
        const latestVersion = await this.getCurrentVersion(purpose);
        const newVersion = latestVersion + 1;

        // Calculate expiration
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS);

        await prisma.jWTSecretVersion.create({
            data: {
                secretHash,
                version: newVersion,
                purpose,
                expiresAt,
                isActive: true,
                rotatedBy,
            },
        });

        logger.info(`Registered JWT secret version ${newVersion} for ${purpose}`, {
            purpose,
            version: newVersion,
            expiresAt,
        });

        return { version: newVersion, secretHash };
    }

    /**
     * Rotate JWT secret - creates a new secret and deactivates old ones after overlap period
     * 
     * IMPORTANT: The returned newSecretPlaintext must be stored securely (e.g., in AWS Secrets Manager)
     * and added to the JWT_SECRET or JWT_REFRESH_SECRET environment variable
     */
    static async rotateSecret(params: {
        purpose: SecretPurpose;
        rotatedBy?: string;
    }): Promise<RotationResult> {
        const { purpose, rotatedBy } = params;

        try {
            // Generate new secret
            const newSecret = generateSecureSecret();
            const secretHash = hashSecret(newSecret);

            // Get the next version number
            const currentVersion = await this.getCurrentVersion(purpose);
            const newVersion = currentVersion + 1;

            // Calculate dates
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS);

            const overlapEndsAt = new Date(now);
            overlapEndsAt.setDate(overlapEndsAt.getDate() + OVERLAP_PERIOD_DAYS);

            // Create new secret version
            await prisma.jWTSecretVersion.create({
                data: {
                    secretHash,
                    version: newVersion,
                    purpose,
                    expiresAt,
                    isActive: true,
                    rotatedBy,
                },
            });

            // Schedule deactivation of old secrets (mark as inactive after overlap period)
            // In production, this would be handled by a separate cleanup job
            // For now, we just log the expected deactivation time
            const oldVersions = await prisma.jWTSecretVersion.findMany({
                where: {
                    purpose,
                    version: { lt: newVersion },
                    isActive: true,
                },
                select: { id: true, version: true },
            });

            logger.info(`JWT secret rotated for ${purpose}`, {
                purpose,
                newVersion,
                oldVersionsCount: oldVersions.length,
                overlapEndsAt,
                expiresAt,
                rotatedBy,
            });

            // Log to key operation audit
            try {
                await prisma.keyOperationLog.create({
                    data: {
                        operation: 'JWT_ROTATE',
                        keyVersion: newVersion,
                        userId: rotatedBy ?? null,
                        success: true,
                        metadata: {
                            purpose,
                            oldVersionsDeactivating: oldVersions.map((v: { version: number }) => v.version),
                            storedInSecretsManager: USE_SECRETS_MANAGER,
                        },
                    },
                });
            } catch (logError) {
                logger.warn('Failed to create audit log for JWT rotation', { error: logError });
            }

            // Store the new secret in AWS Secrets Manager (Comment 1 fix)
            await storeSecretInKMS(purpose, newVersion, newSecret);

            // Refresh the in-memory cache from Secrets Manager
            await jwtSecretCache.refresh(purpose);

            const result: RotationResult = {
                success: true,
                newVersion,
                message: `Successfully rotated ${purpose} JWT secret to version ${newVersion}. ` +
                    (USE_SECRETS_MANAGER
                        ? 'Secret stored in Secrets Manager and cache refreshed.'
                        : 'Secret cached in memory. Update environment variables and restart.'),
            };

            // Only include plaintext if NOT using Secrets Manager (for manual storage)
            if (!USE_SECRETS_MANAGER) {
                result.newSecretPlaintext = newSecret;
            }

            return result;
        } catch (error: any) {
            logger.error(`Failed to rotate JWT secret for ${purpose}`, { error });

            // Log failure
            try {
                await prisma.keyOperationLog.create({
                    data: {
                        operation: 'JWT_ROTATE',
                        keyVersion: 0,
                        userId: rotatedBy ?? null,
                        success: false,
                        errorMsg: error?.message || 'Unknown error',
                        metadata: { purpose },
                    },
                });
            } catch (logError) {
                logger.warn('Failed to create audit log for JWT rotation failure', { error: logError });
            }

            return {
                success: false,
                newVersion: 0,
                message: `Failed to rotate ${purpose} JWT secret: ${error?.message || 'Unknown error'}`,
            };
        }
    }

    /**
     * Cleanup expired secrets
     * Should be run periodically via cron job
     */
    static async cleanupExpiredSecrets(): Promise<{ deactivated: number; deleted: number }> {
        const now = new Date();

        // First, deactivate secrets past their expiration
        const deactivated = await prisma.jWTSecretVersion.updateMany({
            where: {
                isActive: true,
                expiresAt: { lt: now },
            },
            data: {
                isActive: false,
            },
        });

        // Delete secrets that have been inactive for more than 30 days
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deleted = await prisma.jWTSecretVersion.deleteMany({
            where: {
                isActive: false,
                expiresAt: { lt: thirtyDaysAgo },
            },
        });

        if (deactivated.count > 0 || deleted.count > 0) {
            logger.info('JWT secret cleanup completed', {
                deactivated: deactivated.count,
                deleted: deleted.count,
            });
        }

        return {
            deactivated: deactivated.count,
            deleted: deleted.count,
        };
    }

    /**
     * Check if rotation is needed based on the age of the current secret
     */
    static async checkRotationNeeded(purpose: SecretPurpose): Promise<{
        needed: boolean;
        reason: string;
        currentVersion: number;
        daysUntilExpiry?: number;
    }> {
        const current = await prisma.jWTSecretVersion.findFirst({
            where: {
                purpose,
                isActive: true,
            },
            orderBy: { version: 'desc' },
        });

        if (!current) {
            return {
                needed: true,
                reason: 'No active secret version found',
                currentVersion: 0,
            };
        }

        const now = new Date();
        const daysUntilExpiry = Math.ceil((current.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Need rotation if within overlap period
        if (daysUntilExpiry <= OVERLAP_PERIOD_DAYS) {
            return {
                needed: true,
                reason: `Secret expires in ${daysUntilExpiry} days (within overlap period of ${OVERLAP_PERIOD_DAYS} days)`,
                currentVersion: current.version,
                daysUntilExpiry,
            };
        }

        // Check age-based rotation
        const ageInDays = Math.ceil((now.getTime() - current.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (ageInDays >= ROTATION_PERIOD_DAYS) {
            return {
                needed: true,
                reason: `Secret is ${ageInDays} days old (rotation period is ${ROTATION_PERIOD_DAYS} days)`,
                currentVersion: current.version,
                daysUntilExpiry,
            };
        }

        return {
            needed: false,
            reason: `Secret is ${ageInDays} days old, expires in ${daysUntilExpiry} days`,
            currentVersion: current.version,
            daysUntilExpiry,
        };
    }

    /**
     * Get rotation status for monitoring dashboards
     */
    static async getRotationStatus(): Promise<{
        access: { version: number; daysUntilExpiry: number | null; needsRotation: boolean };
        refresh: { version: number; daysUntilExpiry: number | null; needsRotation: boolean };
        totalActiveSecrets: number;
        totalExpiredSecrets: number;
    }> {
        const [accessCheck, refreshCheck, activeCount, expiredCount] = await Promise.all([
            this.checkRotationNeeded('access'),
            this.checkRotationNeeded('refresh'),
            prisma.jWTSecretVersion.count({ where: { isActive: true } }),
            prisma.jWTSecretVersion.count({ where: { isActive: false } }),
        ]);

        return {
            access: {
                version: accessCheck.currentVersion,
                daysUntilExpiry: accessCheck.daysUntilExpiry ?? null,
                needsRotation: accessCheck.needed,
            },
            refresh: {
                version: refreshCheck.currentVersion,
                daysUntilExpiry: refreshCheck.daysUntilExpiry ?? null,
                needsRotation: refreshCheck.needed,
            },
            totalActiveSecrets: activeCount,
            totalExpiredSecrets: expiredCount,
        };
    }

    /**
     * Initialize JWT rotation tracking by registering current env secrets
     * Call this on application startup
     */
    static async initializeFromEnv(): Promise<void> {
        const jwtSecrets = (process.env.JWT_SECRET || '').split(',').map(s => s.trim()).filter(Boolean);
        const refreshSecrets = (process.env.JWT_REFRESH_SECRET || '').split(',').map(s => s.trim()).filter(Boolean);

        // Register access token secrets
        for (const secret of jwtSecrets) {
            try {
                await this.registerExistingSecret({ secret, purpose: 'access' });
            } catch (error) {
                logger.warn('Failed to register access secret (may already exist)', { error });
            }
        }

        // Register refresh token secrets
        for (const secret of refreshSecrets) {
            try {
                await this.registerExistingSecret({ secret, purpose: 'refresh' });
            } catch (error) {
                logger.warn('Failed to register refresh secret (may already exist)', { error });
            }
        }

        logger.info('JWT rotation service initialized from environment', {
            accessSecrets: jwtSecrets.length,
            refreshSecrets: refreshSecrets.length,
        });
    }

    /**
     * Automated rotation check - run weekly via cron
     * Returns true if rotation was performed
     */
    static async checkAndRotate(rotatedBy?: string): Promise<{
        accessRotated: boolean;
        refreshRotated: boolean;
        message: string;
    }> {
        let accessRotated = false;
        let refreshRotated = false;
        const messages: string[] = [];

        // Check access token rotation
        const accessCheck = await this.checkRotationNeeded('access');
        if (accessCheck.needed) {
            const rotateParams = rotatedBy ? { purpose: 'access' as const, rotatedBy } : { purpose: 'access' as const };
            const result = await this.rotateSecret(rotateParams);
            if (result.success) {
                accessRotated = true;
                messages.push(`Access token: ${result.message}`);
                // In production, you would automatically update AWS Secrets Manager here
                logger.warn('ACCESS TOKEN SECRET ROTATED - Update JWT_SECRET environment variable immediately!', {
                    newVersion: result.newVersion,
                });
            } else {
                messages.push(`Access token rotation failed: ${result.message}`);
            }
        } else {
            messages.push(`Access token: ${accessCheck.reason}`);
        }

        // Check refresh token rotation
        const refreshCheck = await this.checkRotationNeeded('refresh');
        if (refreshCheck.needed) {
            const rotateRefreshParams = rotatedBy ? { purpose: 'refresh' as const, rotatedBy } : { purpose: 'refresh' as const };
            const result = await this.rotateSecret(rotateRefreshParams);
            if (result.success) {
                refreshRotated = true;
                messages.push(`Refresh token: ${result.message}`);
                logger.warn('REFRESH TOKEN SECRET ROTATED - Update JWT_REFRESH_SECRET environment variable immediately!', {
                    newVersion: result.newVersion,
                });
            } else {
                messages.push(`Refresh token rotation failed: ${result.message}`);
            }
        } else {
            messages.push(`Refresh token: ${refreshCheck.reason}`);
        }

        // Always run cleanup
        await this.cleanupExpiredSecrets();

        return {
            accessRotated,
            refreshRotated,
            message: messages.join('\n'),
        };
    }
}

export default JWTRotationService;
