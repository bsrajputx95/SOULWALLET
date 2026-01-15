// Stub file - trusted IPs disabled for beta
export const trustedIpsService = {
    isTrustedIp: async (_ip: string) => false,
    addTrustedIp: async (_ip: string, _reason: string, _userId: string) => { },
    removeTrustedIp: async (_ip: string, _userId: string) => { },
    listTrustedIps: () => [] as { ip: string; reason: string; addedAt: Date }[],
    getStatus: () => ({ enabled: false, count: 0 }),
    getBypassLog: (_limit?: number) => [] as { ip: string; endpoint: string; timestamp: Date }[],
    logBypass: (_ip: string, _endpoint: string, _userId?: string) => { },
};
