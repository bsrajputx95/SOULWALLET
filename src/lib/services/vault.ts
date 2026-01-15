// Stub file - Vault disabled for beta (using env-based secrets)
export interface VaultClientOptions {
    address: string;
    roleId: string;
    secretId: string;
}

export class VaultClient {
    constructor(_options: VaultClientOptions) { }

    async readSecret(path: string): Promise<{ data: Record<string, string> }> {
        // Return empty data - secrets come from env in beta
        return { data: {} };
    }

    async renewToken(): Promise<void> { }
}

export const vaultService = {
    getSecret: async (key: string) => process.env[key],
    setSecret: async () => { },
    deleteSecret: async () => { },
    isInitialized: () => false,
};

export async function initializeVault() {
    // No-op for beta
}
