// Stub file - API key service disabled for beta
import type { ApiKeyScope } from '@prisma/client';

export class ApiKeyService {
    async validateApiKey(_keyHash: string): Promise<null> {
        return null;
    }

    static async verifyApiKey(_token: string, _ipAddress?: string): Promise<{
        ok: boolean;
        userId?: string;
        apiKeyId?: string;
        scope?: ApiKeyScope;
    } | null> {
        // API keys disabled for beta - return null to indicate no API key
        return null;
    }

    async createApiKey(_userId: string, _name: string, _scope: ApiKeyScope): Promise<{ key: string; id: string }> {
        return { key: '', id: '' };
    }

    async revokeApiKey(_keyId: string): Promise<void> { }

    async listApiKeys(_userId: string): Promise<never[]> {
        return [];
    }
}

export const apiKeyService = new ApiKeyService();
