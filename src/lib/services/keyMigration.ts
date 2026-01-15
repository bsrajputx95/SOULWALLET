// Stub file - key migration disabled for beta
export const keyMigrationService = {
    migrateKey: async () => ({ success: true }),
    getMigrationStatus: async () => ({ status: 'NOT_REQUIRED' }),
    rollbackMigration: async () => ({ success: true }),
    migrateWallets: async () => ({ success: true, count: 0 }),
};

export class KeyMigrationService {
    static migrateKey = async () => ({ success: true });
    static getMigrationStatus = async () => ({ status: 'NOT_REQUIRED' });
    static rollbackMigration = async () => ({ success: true });
    static migrateWallets = async () => ({ success: true, count: 0 });
}
