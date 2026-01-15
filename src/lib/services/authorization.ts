// Stub file - authorization service disabled for beta
export type AppRole = 'USER' | 'PREMIUM' | 'ADMIN';

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
        _reason?: string
    ): Promise<void> {
        // No-op for beta - authorization auditing disabled
    }

    static async checkAdminIpWhitelist(_ipAddress: string): Promise<boolean> {
        // No-op for beta - all IPs allowed for admin access
        return true;
    }

    static hasRole(_user: { role?: string } | undefined, _role: string): boolean {
        // No-op for beta - everyone has access
        return true;
    }
}

export const authorizationService = new AuthorizationService();
