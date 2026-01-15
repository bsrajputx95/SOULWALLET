// Stub file - authorization service simplified for beta
export type AppRole = 'USER' | 'PREMIUM' | 'ADMIN';
export type OwnershipResult = 'owned' | 'not_owned' | 'not_found';

interface AuditContext {
    userId?: string;
    role?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
}

export class AuthorizationService {
    constructor() { }
    async authorize() { return { allowed: true }; }
    async checkPermission() { return true; }

    static async auditAuthorization(
        _context: AuditContext,
        _allowed: boolean,
        _reason?: string,
        _extra?: any
    ): Promise<void> {
        // No-op for beta - authorization auditing disabled
    }

    static async checkAdminIpWhitelist(_userId: string, _ipAddress?: string): Promise<boolean> {
        // No-op for beta - all IPs allowed for admin access
        return true;
    }

    static hasRole(_role: AppRole, _requiredRole?: AppRole): boolean {
        // No-op for beta - everyone has access
        return true;
    }

    static async verifyOwnership(_userId: string, _resourceType: string, _resourceId: string): Promise<OwnershipResult> {
        // No-op for beta - always return owned
        return 'owned';
    }
}

export const authorizationService = new AuthorizationService();
