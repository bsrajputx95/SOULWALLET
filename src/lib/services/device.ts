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
}
