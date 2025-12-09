import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { logger } from '../logger';

// Configure authenticator
authenticator.options = {
  window: 1, // Allow 1 step before/after for time drift
  step: 30,  // 30 second time step
};

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';

export class TwoFactorService {
  /**
   * Generate a new TOTP secret for a user
   */
  static generateSecret(): string {
    return authenticator.generateSecret();
  }

  /**
   * Generate the otpauth URL for QR code
   */
  static generateOtpauthUrl(email: string, secret: string): string {
    return authenticator.keyuri(email, 'Soul Wallet', secret);
  }

  /**
   * Generate QR code as data URL
   */
  static async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(otpauthUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify a TOTP token against a secret
   */
  static verifyToken(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch (error) {
      logger.error('TOTP verification error:', error);
      return false;
    }
  }

  /**
   * Encrypt a TOTP secret for storage
   */
  static encryptSecret(secret: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Failed to encrypt TOTP secret:', error);
      throw new Error('Failed to encrypt secret');
    }
  }

  /**
   * Decrypt a stored TOTP secret
   */
  static decryptSecret(encryptedData: string): string {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      
      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt TOTP secret:', error);
      throw new Error('Failed to decrypt secret');
    }
  }

  /**
   * Generate backup codes
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash a backup code for storage
   */
  static async hashBackupCode(code: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(code.toUpperCase(), 10);
  }

  /**
   * Verify a backup code against hashed codes
   */
  static async verifyBackupCode(code: string, hashedCodes: string[]): Promise<{ valid: boolean; index: number }> {
    const bcrypt = await import('bcryptjs');
    const normalizedCode = code.toUpperCase().replace(/\s/g, '');
    
    for (let i = 0; i < hashedCodes.length; i++) {
      const hashedCode = hashedCodes[i];
      if (!hashedCode) continue;
      const isValid = await bcrypt.compare(normalizedCode, hashedCode);
      if (isValid) {
        return { valid: true, index: i };
      }
    }
    
    return { valid: false, index: -1 };
  }

  /**
   * Setup TOTP for a user - returns secret, QR code, and backup codes
   */
  static async setupTOTP(email: string): Promise<{
    secret: string;
    encryptedSecret: string;
    qrCodeUrl: string;
    backupCodes: string[];
    hashedBackupCodes: string[];
  }> {
    const secret = this.generateSecret();
    const otpauthUrl = this.generateOtpauthUrl(email, secret);
    const qrCodeUrl = await this.generateQRCode(otpauthUrl);
    const encryptedSecret = this.encryptSecret(secret);
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => this.hashBackupCode(code))
    );

    return {
      secret,
      encryptedSecret,
      qrCodeUrl,
      backupCodes,
      hashedBackupCodes,
    };
  }
}
