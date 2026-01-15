// Stub file - device fingerprinting disabled for beta
export const deviceService = {
    getDeviceInfo: async () => null,
    registerDevice: async (_userId: string, _deviceInfo: any) => ({
        success: true,
        isNewDevice: false,
        isTrusted: true,
        deviceId: 'beta-device'
    }),
    verifyDevice: async () => true,
    listDevices: async (_userId: string) => [],
    trustDevice: async (_userId: string, _deviceId: string) => ({ success: true }),
    revokeDevice: async (_userId: string, _deviceId: string) => ({ success: true }),
    renameDevice: async (_userId: string, _deviceId: string, _name: string) => ({ success: true }),
};

export class DeviceService {
    static getDeviceInfo = async () => null;
    static registerDevice = async (_userId: string, _deviceInfo: any) => ({
        success: true,
        isNewDevice: false,
        isTrusted: true,
        deviceId: 'beta-device'
    });
    static verifyDevice = async () => true;
    static sendNewDeviceAlert = async (_email: string, _deviceInfo: any, _deviceId: string) => { };
    static listDevices = async (_userId: string) => [];
    static trustDevice = async (_userId: string, _deviceId: string) => ({ success: true });
    static revokeDevice = async (_userId: string, _deviceId: string) => ({ success: true });
    static renameDevice = async (_userId: string, _deviceId: string, _name: string) => ({ success: true });
}
