/**
 * HashiCorp Vault Client Integration
 *
 * Provides secure secret management for SoulWallet using Vault.
 * Supports multiple auth methods and secret engines.
 */

import * as https from 'https';
import * as http from 'http';
import { logger } from '../logger';

interface VaultConfig {
    address: string;
    token?: string | undefined;
    roleId?: string | undefined;
    secretId?: string | undefined;
    namespace?: string | undefined;
    caCert?: string | undefined;
}

interface VaultSecret {
    data: Record<string, unknown>;
    metadata?: {
        created_time: string;
        version: number;
    };
}

interface DatabaseCredentials {
    username: string;
    password: string;
    lease_id: string;
    lease_duration: number;
}

class VaultClient {
    private config: VaultConfig;
    private token: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(config?: Partial<VaultConfig>) {
        this.config = {
            address: config?.address || process.env.VAULT_ADDR || 'http://localhost:8200',
            token: config?.token || process.env.VAULT_TOKEN,
            roleId: config?.roleId || process.env.VAULT_ROLE_ID,
            secretId: config?.secretId || process.env.VAULT_SECRET_ID,
            namespace: config?.namespace || process.env.VAULT_NAMESPACE,
            caCert: config?.caCert || process.env.VAULT_CA_CERT,
        };

        if (this.config.token) {
            this.token = this.config.token;
        }
    }

    /**
     * Make an authenticated request to Vault
     */
    private async request<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        const token = await this.getToken();
        const url = new URL(path, this.config.address);

        const headers: Record<string, string> = {
            'X-Vault-Token': token,
            'Content-Type': 'application/json',
        };

        if (this.config.namespace) {
            headers['X-Vault-Namespace'] = this.config.namespace;
        }

        return new Promise((resolve, reject) => {
            const protocol = url.protocol === 'https:' ? https : http;
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers,
            };

            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(parsed.errors?.join(', ') || 'Vault request failed'));
                        } else {
                            resolve(parsed as T);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse Vault response: ${e}`));
                    }
                });
            });

            req.on('error', reject);

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    /**
     * Get or refresh authentication token
     */
    private async getToken(): Promise<string> {
        // Use static token if provided
        if (this.token && (!this.tokenExpiry || this.tokenExpiry > new Date())) {
            return this.token;
        }

        // Authenticate with AppRole if configured
        if (this.config.roleId && this.config.secretId) {
            await this.authenticateAppRole();
            return this.token!;
        }

        throw new Error('No Vault authentication method configured');
    }

    /**
     * Authenticate using AppRole
     */
    private async authenticateAppRole(): Promise<void> {
        const response = await this.requestWithoutAuth<{
            auth: { client_token: string; lease_duration: number };
        }>('POST', '/v1/auth/approle/login', {
            role_id: this.config.roleId,
            secret_id: this.config.secretId,
        });

        this.token = response.auth.client_token;
        this.tokenExpiry = new Date(Date.now() + response.auth.lease_duration * 1000 * 0.9);
        logger.info('Authenticated with Vault via AppRole');
    }

    /**
     * Make unauthenticated request (for login)
     */
    private async requestWithoutAuth<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        const url = new URL(path, this.config.address);

        return new Promise((resolve, reject) => {
            const protocol = url.protocol === 'https:' ? https : http;
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method,
                headers: { 'Content-Type': 'application/json' },
            };

            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(parsed.errors?.join(', ') || 'Vault request failed'));
                        } else {
                            resolve(parsed as T);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse Vault response: ${e}`));
                    }
                });
            });

            req.on('error', reject);

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    /**
     * Read a secret from KV v2 secrets engine
     */
    async readSecret(path: string): Promise<VaultSecret> {
        const response = await this.request<{ data: VaultSecret }>('GET', `/v1/secret/data/${path}`);
        return response.data;
    }

    /**
     * Write a secret to KV v2 secrets engine
     */
    async writeSecret(path: string, data: Record<string, unknown>): Promise<void> {
        await this.request('POST', `/v1/secret/data/${path}`, { data });
        logger.info(`Wrote secret to ${path}`);
    }

    /**
     * Delete a secret from KV v2 secrets engine
     */
    async deleteSecret(path: string): Promise<void> {
        await this.request('DELETE', `/v1/secret/data/${path}`);
        logger.info(`Deleted secret at ${path}`);
    }

    /**
     * Get dynamic database credentials
     */
    async getDatabaseCredentials(role: string = 'soulwallet-app'): Promise<DatabaseCredentials> {
        const response = await this.request<{
            data: { username: string; password: string };
            lease_id: string;
            lease_duration: number;
        }>('GET', `/v1/database/creds/${role}`);

        return {
            username: response.data.username,
            password: response.data.password,
            lease_id: response.lease_id,
            lease_duration: response.lease_duration,
        };
    }

    /**
     * Encrypt data using Transit secrets engine
     */
    async encrypt(plaintext: string, key: string = 'soulwallet'): Promise<string> {
        const response = await this.request<{ data: { ciphertext: string } }>(
            'POST',
            `/v1/transit/encrypt/${key}`,
            { plaintext: Buffer.from(plaintext).toString('base64') }
        );
        return response.data.ciphertext;
    }

    /**
     * Decrypt data using Transit secrets engine
     */
    async decrypt(ciphertext: string, key: string = 'soulwallet'): Promise<string> {
        const response = await this.request<{ data: { plaintext: string } }>(
            'POST',
            `/v1/transit/decrypt/${key}`,
            { ciphertext }
        );
        return Buffer.from(response.data.plaintext, 'base64').toString();
    }

    /**
     * Get temporary AWS credentials
     */
    async getAwsCredentials(role: string = 'soulwallet-app'): Promise<{
        access_key: string;
        secret_key: string;
        security_token?: string;
    }> {
        const response = await this.request<{
            data: {
                access_key: string;
                secret_key: string;
                security_token?: string;
            };
        }>('GET', `/v1/aws/creds/${role}`);
        return response.data;
    }

    /**
     * Renew the current token's lease
     */
    async renewToken(): Promise<void> {
        const response = await this.request<{
            auth: { lease_duration: number };
        }>('POST', '/v1/auth/token/renew-self');

        this.tokenExpiry = new Date(Date.now() + response.auth.lease_duration * 1000 * 0.9);
        logger.info('Renewed Vault token');
    }

    /**
     * Revoke the current token
     */
    async revokeToken(): Promise<void> {
        await this.request('POST', '/v1/auth/token/revoke-self');
        this.token = null;
        this.tokenExpiry = null;
        logger.info('Revoked Vault token');
    }

    /**
     * Check if Vault is healthy
     */
    async isHealthy(): Promise<boolean> {
        try {
            await this.requestWithoutAuth('GET', '/v1/sys/health');
            return true;
        } catch {
            return false;
        }
    }
}

// Singleton instance
let vaultClient: VaultClient | null = null;

/**
 * Get or create Vault client instance
 */
export function getVaultClient(config?: Partial<VaultConfig>): VaultClient {
    if (!vaultClient) {
        vaultClient = new VaultClient(config);
    }
    return vaultClient;
}

/**
 * Initialize Vault client and verify connection
 */
export async function initializeVault(): Promise<VaultClient> {
    const client = getVaultClient();
    const healthy = await client.isHealthy();
    if (!healthy) {
        throw new Error('Vault is not healthy or unreachable');
    }
    logger.info('Vault client initialized successfully');
    return client;
}

export { VaultClient };
export type { VaultConfig, VaultSecret, DatabaseCredentials };
