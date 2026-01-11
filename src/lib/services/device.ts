import * as crypto from 'crypto';
import prisma from '../prisma';
import { logger } from '../logger';
import { createEmailService } from './email';

/**
 * Device Service for tracking and detecting new devices
 * Implements "new device" detection from plan1/fixed.md Comment 2
 */

interface DeviceFingerprint {
    ipAddress?: string;
    userAgent?: string;
}

interface DeviceInfo {
    deviceType?: string;
    browser?: string;
    os?: string;
}

const emailService = createEmailService();

/**
 * Parse user agent to extract device info
 */
function parseUserAgent(userAgent?: string): DeviceInfo {
    if (!userAgent) return { deviceType: 'unknown' };

    const ua = userAgent.toLowerCase();

    // Detect device type
    let deviceType = 'desktop';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        deviceType = 'phone';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
        deviceType = 'tablet';
    }

    // Detect browser
    let browser = 'unknown';
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';

    // Detect OS
    let os = 'unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('linux')) os = 'Linux';

    return { deviceType, browser, os };
}

/**
 * Generate device fingerprint hash
 */
function generateFingerprint(fp: DeviceFingerprint): string {
    const data = `${fp.ipAddress || 'unknown'}::${fp.userAgent || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

export class DeviceService {
    /**
     * Register or update a device during login
     * Returns whether this is a new/untrusted device
     */
    static async registerDevice(userId: string, fingerprint: DeviceFingerprint): Promise<{
        isNewDevice: boolean;
        isTrusted: boolean;
        deviceId: string;
    }> {
        const fp = generateFingerprint(fingerprint);
        const deviceInfo = parseUserAgent(fingerprint.userAgent);

        // Check if device already exists
        const existingDevice = await prisma.device.findUnique({
            where: {
                userId_fingerprint: {
                    userId,
                    fingerprint: fp,
                },
            },
        });

        if (existingDevice) {
            // Update last seen and increment login count
            await prisma.device.update({
                where: { id: existingDevice.id },
                data: {
                    lastSeenAt: new Date(),
                    loginCount: { increment: 1 },
                    ipAddress: fingerprint.ipAddress,
                },
            });

            return {
                isNewDevice: false,
                isTrusted: existingDevice.isTrusted,
                deviceId: existingDevice.id,
            };
        }

        // Create new device
        const newDevice = await prisma.device.create({
            data: {
                userId,
                fingerprint: fp,
                ipAddress: fingerprint.ipAddress,
                userAgent: fingerprint.userAgent,
                ...deviceInfo,
                loginCount: 1,
            },
        });

        logger.info('New device registered', {
            userId,
            deviceId: newDevice.id,
            deviceType: deviceInfo.deviceType,
        });

        return {
            isNewDevice: true,
            isTrusted: false,
            deviceId: newDevice.id,
        };
    }

    /**
     * Send new device login alert email
     */
    static async sendNewDeviceAlert(
        userId: string,
        deviceId: string,
        fingerprint: DeviceFingerprint
    ): Promise<void> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, name: true },
            });

            if (!user?.email) return;

            // Use the suspiciousLoginAlert method which handles new device notifications
            await emailService.sendSuspiciousLoginAlert(
                user.email,
                fingerprint.ipAddress || 'Unknown',
                fingerprint.userAgent || 'Unknown device',
                undefined,
                new Date()
            );

            logger.info('New device alert email sent', { userId, deviceId });
        } catch (error) {
            logger.error('Failed to send new device alert', { error, userId });
        }
    }

    /**
     * Get all devices for a user
     */
    static async listDevices(userId: string) {
        return prisma.device.findMany({
            where: { userId },
            orderBy: { lastSeenAt: 'desc' },
            select: {
                id: true,
                name: true,
                deviceType: true,
                browser: true,
                os: true,
                ipAddress: true,
                isTrusted: true,
                trustedAt: true,
                lastSeenAt: true,
                loginCount: true,
                createdAt: true,
            },
        });
    }

    /**
     * Trust a device
     */
    static async trustDevice(userId: string, deviceId: string): Promise<boolean> {
        const device = await prisma.device.findFirst({
            where: { id: deviceId, userId },
        });

        if (!device) return false;

        await prisma.device.update({
            where: { id: deviceId },
            data: {
                isTrusted: true,
                trustedAt: new Date(),
            },
        });

        logger.info('Device trusted', { userId, deviceId });
        return true;
    }

    /**
     * Revoke/remove a device
     */
    static async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
        const device = await prisma.device.findFirst({
            where: { id: deviceId, userId },
        });

        if (!device) return false;

        await prisma.device.delete({
            where: { id: deviceId },
        });

        logger.info('Device revoked', { userId, deviceId });
        return true;
    }

    /**
     * Rename a device
     */
    static async renameDevice(userId: string, deviceId: string, name: string): Promise<boolean> {
        const device = await prisma.device.findFirst({
            where: { id: deviceId, userId },
        });

        if (!device) return false;

        await prisma.device.update({
            where: { id: deviceId },
            data: { name },
        });

        return true;
    }

    /**
     * Check if device is trusted
     */
    static async isDeviceTrusted(userId: string, fingerprint: DeviceFingerprint): Promise<boolean> {
        const fp = generateFingerprint(fingerprint);

        const device = await prisma.device.findUnique({
            where: {
                userId_fingerprint: {
                    userId,
                    fingerprint: fp,
                },
            },
            select: { isTrusted: true },
        });

        return device?.isTrusted ?? false;
    }
}
