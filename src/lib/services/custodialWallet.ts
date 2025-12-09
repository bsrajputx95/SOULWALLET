import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';
import prisma from '../prisma';
import { logger } from '../logger';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;

// Transaction limits (Property 19: Transaction Amount Limits)
export const TRANSACTION_LIMITS = {
  maxSingleTransaction: parseFloat(process.env.MAX_SINGLE_TRANSACTION_SOL || '100'), // 100 SOL
  maxDailyTransaction: parseFloat(process.env.MAX_DAILY_TRANSACTION_SOL || '1000'), // 1000 SOL
  maxCopyBudget: parseFloat(process.env.MAX_COPY_BUDGET_USDC || '10000'), // 10000 USDC
  maxPerTrade: parseFloat(process.env.MAX_PER_TRADE_USDC || '1000'), // 1000 USDC
};

/**
 * CustodialWalletService handles secure server-side wallet management
 * for copy trading execution. Uses AES-256-GCM encryption for private keys.
 */
class CustodialWalletService {
  private connection: Connection;
  private masterKey: Buffer | null = null;

  constructor() {
    const rpcUrl = process.env.HELIUS_RPC_URL || 
      `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Initialize the service with the master encryption key
   * Must be called before any encryption/decryption operations
   */
  initialize(): void {
    const masterSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET;
    if (!masterSecret) {
      throw new Error('CUSTODIAL_WALLET_MASTER_SECRET environment variable is required');
    }

    // Derive a key from the master secret using PBKDF2
    const salt = process.env.CUSTODIAL_WALLET_SALT || 'soulwallet-custodial-v1';
    this.masterKey = pbkdf2Sync(
      masterSecret,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    logger.info('CustodialWalletService initialized');
  }


  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.masterKey) {
      this.initialize();
    }
  }

  /**
   * Encrypt a private key using AES-256-GCM
   */
  private encryptPrivateKey(privateKey: Uint8Array): {
    encryptedKey: string;
    iv: string;
    tag: string;
  } {
    this.ensureInitialized();

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey!, iv);

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(privateKey)),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return {
      encryptedKey: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  /**
   * Decrypt a private key using AES-256-GCM
   */
  private decryptPrivateKey(
    encryptedKey: string,
    iv: string,
    tag: string
  ): Uint8Array {
    this.ensureInitialized();

    const decipher = createDecipheriv(
      ALGORITHM,
      this.masterKey!,
      Buffer.from(iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'base64')),
      decipher.final(),
    ]);

    return new Uint8Array(decrypted);
  }

  /**
   * Create a new custodial wallet for a user
   * @param userId - The user's ID
   * @returns The public key of the created wallet
   */
  async createWallet(userId: string): Promise<{ publicKey: string }> {
    // Check if user already has a custodial wallet
    const existing = await prisma.custodialWallet.findUnique({
      where: { userId },
    });

    if (existing) {
      logger.info(`User ${userId} already has a custodial wallet`);
      return { publicKey: existing.publicKey };
    }

    // Generate new keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();

    // Encrypt the private key
    const { encryptedKey, iv, tag } = this.encryptPrivateKey(keypair.secretKey);

    // Store in database
    await prisma.custodialWallet.create({
      data: {
        userId,
        publicKey,
        encryptedKey,
        keyIv: iv,
        keyTag: tag,
        keyVersion: 1,
        isActive: true,
      },
    });

    logger.info(`Created custodial wallet for user ${userId}: ${publicKey}`);
    return { publicKey };
  }


  /**
   * Get the keypair for a user's custodial wallet
   * @param userId - The user's ID
   * @returns The Keypair or null if not found
   */
  async getKeypair(userId: string): Promise<Keypair | null> {
    const wallet = await prisma.custodialWallet.findUnique({
      where: { userId },
    });

    if (!wallet || !wallet.isActive) {
      logger.warn(`No active custodial wallet found for user ${userId}`);
      return null;
    }

    try {
      const privateKey = this.decryptPrivateKey(
        wallet.encryptedKey,
        wallet.keyIv,
        wallet.keyTag
      );

      const keypair = Keypair.fromSecretKey(privateKey);

      // Verify the public key matches
      if (keypair.publicKey.toBase58() !== wallet.publicKey) {
        logger.error(`Public key mismatch for user ${userId} custodial wallet`);
        return null;
      }

      return keypair;
    } catch (error) {
      logger.error(`Failed to decrypt custodial wallet for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get the public key for a user's custodial wallet
   * @param userId - The user's ID
   * @returns The public key string or null if not found
   */
  async getPublicKey(userId: string): Promise<string | null> {
    const wallet = await prisma.custodialWallet.findUnique({
      where: { userId },
      select: { publicKey: true, isActive: true },
    });

    if (!wallet || !wallet.isActive) {
      return null;
    }

    return wallet.publicKey;
  }

  /**
   * Get the SOL balance of a user's custodial wallet
   * @param userId - The user's ID
   * @returns The balance in SOL or 0 if wallet not found
   */
  async getBalance(userId: string): Promise<number> {
    const publicKey = await this.getPublicKey(userId);
    if (!publicKey) {
      return 0;
    }

    try {
      const balance = await this.connection.getBalance(new PublicKey(publicKey));
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.error(`Failed to get balance for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Check if a user has a custodial wallet
   * @param userId - The user's ID
   * @returns True if the user has an active custodial wallet
   */
  async hasWallet(userId: string): Promise<boolean> {
    const wallet = await prisma.custodialWallet.findUnique({
      where: { userId },
      select: { isActive: true },
    });

    return wallet?.isActive ?? false;
  }

  /**
   * Deactivate a user's custodial wallet
   * @param userId - The user's ID
   */
  async deactivateWallet(userId: string): Promise<void> {
    await prisma.custodialWallet.update({
      where: { userId },
      data: { isActive: false },
    });

    logger.info(`Deactivated custodial wallet for user ${userId}`);
  }

  /**
   * Get or create a custodial wallet for a user
   * @param userId - The user's ID
   * @returns The public key of the wallet
   */
  async getOrCreateWallet(userId: string): Promise<string> {
    const existing = await this.getPublicKey(userId);
    if (existing) {
      return existing;
    }

    const { publicKey } = await this.createWallet(userId);
    return publicKey;
  }

  /**
   * Validate transaction amount against limits (Property 19)
   * @param amount - Amount in SOL
   * @param userId - User ID for daily limit tracking
   * @returns Validation result with error message if invalid
   */
  async validateTransactionAmount(
    amount: number,
    userId: string
  ): Promise<{ valid: boolean; error?: string }> {
    // Check single transaction limit
    if (amount > TRANSACTION_LIMITS.maxSingleTransaction) {
      return {
        valid: false,
        error: `Transaction amount ${amount} SOL exceeds maximum single transaction limit of ${TRANSACTION_LIMITS.maxSingleTransaction} SOL`,
      };
    }

    // Check daily transaction limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyTotal = await prisma.executionQueue.aggregate({
      where: {
        userId,
        createdAt: { gte: today },
        status: { in: ['COMPLETED', 'PENDING', 'PROCESSING'] },
      },
      _sum: { amount: true },
    });

    const currentDailyTotal = dailyTotal._sum.amount || 0;
    if (currentDailyTotal + amount > TRANSACTION_LIMITS.maxDailyTransaction) {
      return {
        valid: false,
        error: `Transaction would exceed daily limit of ${TRANSACTION_LIMITS.maxDailyTransaction} SOL. Current daily total: ${currentDailyTotal} SOL`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate copy trade budget against limits
   * @param totalBudget - Total budget in USDC
   * @param amountPerTrade - Amount per trade in USDC
   * @returns Validation result with error message if invalid
   */
  validateCopyTradeBudget(
    totalBudget: number,
    amountPerTrade: number
  ): { valid: boolean; error?: string } {
    if (totalBudget > TRANSACTION_LIMITS.maxCopyBudget) {
      return {
        valid: false,
        error: `Total budget ${totalBudget} USDC exceeds maximum of ${TRANSACTION_LIMITS.maxCopyBudget} USDC`,
      };
    }

    if (amountPerTrade > TRANSACTION_LIMITS.maxPerTrade) {
      return {
        valid: false,
        error: `Amount per trade ${amountPerTrade} USDC exceeds maximum of ${TRANSACTION_LIMITS.maxPerTrade} USDC`,
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const custodialWalletService = new CustodialWalletService();

// Export class for testing
export { CustodialWalletService };
