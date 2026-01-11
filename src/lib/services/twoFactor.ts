import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { logger } from '../logger';

// Configure authenticator
authenticator.options = {
  window: 1, // Allow 1 step before/after for time drift
  step: 30,  // 30 second time step
};

const ALGORITHM = 'aes-256-gcm';
let cachedDevKey: string | null = null

function getEncryptionKey(): string {
  const k = process.env.TOTP_ENCRYPTION_KEY
  if (k) return k

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SECURITY ERROR: TOTP_ENCRYPTION_KEY is required in production. Generate a secure 32-byte key: openssl rand -base64 32'
    )
  }

  logger.warn('TOTP using development fallback key')

  const jwt = process.env.JWT_SECRET
  if (jwt) return jwt.split(',')[0]!.trim()

  if (cachedDevKey) return cachedDevKey
  cachedDevKey = crypto.randomBytes(32).toString('base64')
  logger.warn('Generated ephemeral TOTP key; will not persist across restarts')
  return cachedDevKey
}

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
      const saltHex = crypto.randomBytes(16).toString('hex')
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(getEncryptionKey(), saltHex, 32);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `v2:${saltHex}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
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
      const parts = encryptedData.split(':')
      const isV2 = parts[0] === 'v2'

      let saltHex: string
      let ivHex: string
      let authTagHex: string
      let encrypted: string

      if (isV2) {
        saltHex = parts[1] || ''
        ivHex = parts[2] || ''
        authTagHex = parts[3] || ''
        encrypted = parts[4] || ''
      } else {
        saltHex = 'salt'
        ivHex = parts[0] || ''
        authTagHex = parts[1] || ''
        encrypted = parts[2] || ''
      }

      if (!ivHex || !authTagHex || !encrypted || !saltHex) {
        throw new Error('Invalid encrypted data format')
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = crypto.scryptSync(getEncryptionKey(), saltHex, 32);
      
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
