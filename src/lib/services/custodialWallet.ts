import 'reflect-metadata';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';
import { injectable, inject } from 'tsyringe';
import prisma from '../prisma';
import { logger } from '../logger';
import type { KeyManagementService } from './keyManagement';
import type { RpcManager } from './rpcManager';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM

// Solana BIP44 derivation path for consistent wallet generation
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

// PBKDF2 configuration - named constants for maintainability (Audit Issue #19)
export const PBKDF2_CONFIG = {
  ITERATIONS: 310000,
  KEY_LENGTH: 32, // 256 bits
  DIGEST: 'sha256',
  SALT_LENGTH: 32,
} as const;

// Transaction limits (Property 19: Transaction Amount Limits)
export const TRANSACTION_LIMITS = {
  maxSingleTransaction: parseFloat(process.env.MAX_SINGLE_TRANSACTION_SOL || '100'), // 100 SOL
  maxDailyTransaction: parseFloat(process.env.MAX_DAILY_TRANSACTION_SOL || '1000'), // 1000 SOL
  maxCopyBudget: parseFloat(process.env.MAX_COPY_BUDGET_USDC || '10000'), // 10000 USDC
  maxPerTrade: parseFloat(process.env.MAX_PER_TRADE_USDC || '1000'), // 1000 USDC
};

/**
 * Generate a Solana keypair from BIP39 mnemonic using proper derivation
 * This ensures all custodial wallets have recoverable mnemonic backup
 */
function keypairFromMnemonic(mnemonic: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedSeed = derivePath(SOLANA_DERIVATION_PATH, seed.toString('hex')).key;
  return Keypair.fromSeed(derivedSeed);
}

/**
 * CustodialWalletService handles secure server-side wallet management
 * for copy trading execution. Uses AES-256-GCM encryption for private keys.
 */
@injectable()
export class CustodialWalletService {
  private legacyMasterKey: Buffer | null = null

  constructor(
    @inject('RpcManager') private readonly rpcManager: RpcManager,
    @inject('KeyManagementService') private readonly kms: KeyManagementService,
  ) { }

  private secureWipe(buffer: Uint8Array | Buffer | null | undefined): void {
    if (!buffer) return
    try {
      (buffer as any).fill(0)
    } catch {
      void 0
    }
  }

  /**
   * Log key operation for audit trail (Step 9: Audit Logging)
   */
  private async logKeyOperation(params: {
    operation: string;
    userId: string;
    keyVersion?: number;
    success: boolean;
    errorMsg?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    if (process.env.ENABLE_KEY_AUDIT_LOGGING !== 'true') return;

    try {
      await prisma.keyOperationLog.create({
        data: {
          operation: params.operation,
          keyVersion: params.keyVersion ?? 0,
          userId: params.userId,
          success: params.success,
          errorMsg: params.errorMsg ?? null,
          metadata: params.metadata ?? undefined,
        },
      });
    } catch (error) {
      logger.warn('Failed to log key operation:', { error, params });
    }
  }

  private getLegacyMasterKey(): Buffer {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY ERROR: Legacy env-based encryption is disabled in production. Set KMS_PROVIDER to "aws" or "vault".'
      )
    }
    if (this.legacyMasterKey) return this.legacyMasterKey

    const masterSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET
    const salt = process.env.CUSTODIAL_WALLET_SALT
    if (!masterSecret || !salt) {
      throw new Error('CUSTODIAL_WALLET_MASTER_SECRET and CUSTODIAL_WALLET_SALT required for development')
    }

    logger.warn('Using legacy env-based encryption (development only)')

    this.legacyMasterKey = pbkdf2Sync(
      masterSecret,
      salt,
      PBKDF2_CONFIG.ITERATIONS,
      PBKDF2_CONFIG.KEY_LENGTH,
      PBKDF2_CONFIG.DIGEST
    )
    return this.legacyMasterKey
  }

  /**
   * Encrypt a private key using AES-256-GCM with unique salt (Audit Issue #1)
   */
  private encryptPrivateKeyWithSalt(privateKey: Uint8Array, salt: Buffer): {
    encryptedKey: string;
    iv: string;
    tag: string;
  } {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Legacy encryption method disabled in production. Use KMS.')
    }
    const masterSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET;
    if (!masterSecret) {
      throw new Error('CUSTODIAL_WALLET_MASTER_SECRET environment variable is required');
    }

    // Derive key using unique salt per wallet
    const derivedKey = pbkdf2Sync(
      masterSecret,
      salt,
      PBKDF2_CONFIG.ITERATIONS,
      PBKDF2_CONFIG.KEY_LENGTH,
      PBKDF2_CONFIG.DIGEST
    );

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

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
   * Encrypt a private key using AES-256-GCM (legacy - uses master key)
   */
  private encryptPrivateKey(privateKey: Uint8Array): {
    encryptedKey: string;
    iv: string;
    tag: string;
  } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.getLegacyMasterKey(), iv);

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
   * Decrypt a private key using AES-256-GCM with stored salt (Audit Issue #1)
   */
  private decryptPrivateKeyWithSalt(
    encryptedKey: string,
    iv: string,
    tag: string,
    salt: string
  ): Uint8Array {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Legacy decryption method disabled in production. Use KMS.')
    }
    const masterSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET;
    if (!masterSecret) {
      throw new Error('CUSTODIAL_WALLET_MASTER_SECRET environment variable is required');
    }

    // Derive key using stored salt
    const derivedKey = pbkdf2Sync(
      masterSecret,
      Buffer.from(salt, 'base64'),
      PBKDF2_CONFIG.ITERATIONS,
      PBKDF2_CONFIG.KEY_LENGTH,
      PBKDF2_CONFIG.DIGEST
    );

    const decipher = createDecipheriv(
      ALGORITHM,
      derivedKey,
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
   * Decrypt a private key using AES-256-GCM
   */
  private decryptPrivateKey(
    encryptedKey: string,
    iv: string,
    tag: string
  ): Uint8Array {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.getLegacyMasterKey(),
      Buffer.from(iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'base64')),
      decipher.final(),
    ]);

    return new Uint8Array(decrypted);
  }

  private deriveWalletKey(dataKey: Buffer, salt: Buffer): Buffer {
    return pbkdf2Sync(
      dataKey,
      salt,
      PBKDF2_CONFIG.ITERATIONS,
      PBKDF2_CONFIG.KEY_LENGTH,
      PBKDF2_CONFIG.DIGEST
    )
  }

  private async encryptPrivateKeyWithKms(privateKey: Uint8Array, salt: Buffer): Promise<{
    encryptedKey: string
    iv: string
    tag: string
    dataKeyCiphertext: string
    dataKeyKeyId: string
    keyVersion: number
  }> {
    const { plaintext: dataKey, ciphertext: dataKeyCiphertext, keyId: dataKeyKeyId } =
      await this.kms.generateDataKey()

    const derivedKey = this.deriveWalletKey(dataKey, salt)
    try {
      const iv = randomBytes(IV_LENGTH)
      const cipher = createCipheriv(ALGORITHM, derivedKey, iv)

      const encrypted = Buffer.concat([
        cipher.update(Buffer.from(privateKey)),
        cipher.final(),
      ])

      const tag = cipher.getAuthTag()
      const keyVersion = await this.kms.getCurrentKeyVersion()

      return {
        encryptedKey: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        dataKeyCiphertext,
        dataKeyKeyId,
        keyVersion,
      }
    } finally {
      this.secureWipe(derivedKey)
      this.secureWipe(dataKey)
    }
  }

  private async decryptPrivateKeyWithKms(params: {
    encryptedKey: string
    iv: string
    tag: string
    keySalt: string
    dataKeyCiphertext: string
    dataKeyKeyId: string
  }): Promise<Uint8Array> {
    const dataKey = await this.kms.decryptDataKey(params.dataKeyCiphertext, params.dataKeyKeyId)
    const salt = Buffer.from(params.keySalt, 'base64')
    const derivedKey = this.deriveWalletKey(dataKey, salt)
    try {
      const decipher = createDecipheriv(ALGORITHM, derivedKey, Buffer.from(params.iv, 'base64'))
      decipher.setAuthTag(Buffer.from(params.tag, 'base64'))

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(params.encryptedKey, 'base64')),
        decipher.final(),
      ])

      return new Uint8Array(decrypted)
    } finally {
      this.secureWipe(derivedKey)
      this.secureWipe(dataKey)
      this.secureWipe(salt)
    }
  }

  /**
   * Create a new custodial wallet for a user with BIP39 mnemonic backup
   * (Audit Issue #1: Unique salt per wallet)
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

    // Generate BIP39 mnemonic for recovery capability
    const mnemonic = bip39.generateMnemonic(128); // 12 words
    
    // Derive keypair from mnemonic using proper Solana derivation path
    const keypair = keypairFromMnemonic(mnemonic);
    const publicKey = keypair.publicKey.toBase58();

    // Generate unique salt for this wallet (Audit Issue #1)
    const salt = randomBytes(PBKDF2_CONFIG.SALT_LENGTH);

    // Encrypt the private key with unique salt
    const { encryptedKey, iv, tag, dataKeyCiphertext, dataKeyKeyId, keyVersion } =
      await this.encryptPrivateKeyWithKms(keypair.secretKey, salt)

    // Encrypt mnemonic for recovery (stored separately with KMS)
    const mnemonicBuffer = Buffer.from(mnemonic, 'utf8');
    const { encryptedKey: encryptedMnemonic, iv: mnemonicIv, tag: mnemonicTag } =
      await this.encryptPrivateKeyWithKms(mnemonicBuffer, salt);

    // Store in database with unique salt and encrypted mnemonic
    await prisma.custodialWallet.create({
      data: {
        userId,
        publicKey,
        encryptedKey,
        keyIv: iv,
        keyTag: tag,
        keySalt: salt.toString('base64'), // Store unique salt
        keyVersion,
        dataKeyCiphertext,
        dataKeyKeyId,
        encryptedMnemonic, // BIP39 backup for recovery
        mnemonicIv,
        mnemonicTag,
        isActive: true,
      },
    });

    logger.info(`Created BIP39-backed custodial wallet for user ${userId}: ${publicKey}`);

    // Audit log the wallet creation
    await this.logKeyOperation({
      operation: 'WALLET_CREATE',
      userId,
      keyVersion,
      success: true,
      metadata: { publicKey, hasMnemonicBackup: true },
    });

    return { publicKey };
  }


  /**
   * Get the keypair for a user's custodial wallet (Audit Issue #1: Use stored salt)
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

    let privateKey: Uint8Array | null = null
    try {
      if (wallet.dataKeyCiphertext && wallet.dataKeyKeyId && wallet.keySalt) {
        privateKey = await this.decryptPrivateKeyWithKms({
          encryptedKey: wallet.encryptedKey,
          iv: wallet.keyIv,
          tag: wallet.keyTag,
          keySalt: wallet.keySalt,
          dataKeyCiphertext: wallet.dataKeyCiphertext,
          dataKeyKeyId: wallet.dataKeyKeyId,
        })
      } else if (wallet.keySalt) {
        privateKey = this.decryptPrivateKeyWithSalt(wallet.encryptedKey, wallet.keyIv, wallet.keyTag, wallet.keySalt)
      } else {
        privateKey = this.decryptPrivateKey(wallet.encryptedKey, wallet.keyIv, wallet.keyTag)
      }

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
    } finally {
      this.secureWipe(privateKey)
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
      const connection = await this.rpcManager.getConnection()
      const balance = await connection.getBalance(new PublicKey(publicKey));
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.error(`Failed to get balance for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get the token balance of a user's custodial wallet for a specific SPL token
   * @param userId - The user's ID
   * @param tokenMint - The token mint address
   * @returns The balance in token units or 0 if wallet/token account not found
   */
  async getTokenBalance(userId: string, tokenMint: string): Promise<number> {
    const publicKey = await this.getPublicKey(userId);
    if (!publicKey) {
      return 0;
    }

    try {
      const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
      const connection = await this.rpcManager.getConnection();
      const walletPubkey = new PublicKey(publicKey);
      const mintPubkey = new PublicKey(tokenMint);
      
      const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
      const account = await getAccount(connection, ata);
      
      // USDC has 6 decimals, most SPL tokens have 9
      const decimals = tokenMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 6 : 9;
      return Number(account.amount) / Math.pow(10, decimals);
    } catch (error) {
      // Token account doesn't exist or other error
      logger.debug(`Token balance check failed for user ${userId}, mint ${tokenMint}:`, error);
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

  async validateCopyTradeExecutionAmount(
    amountPerTradeUsdc: number,
    userId: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!Number.isFinite(amountPerTradeUsdc) || amountPerTradeUsdc <= 0) {
      return { valid: false, error: 'Invalid trade amount' }
    }

    if (amountPerTradeUsdc > TRANSACTION_LIMITS.maxPerTrade) {
      return {
        valid: false,
        error: `Amount per trade ${amountPerTradeUsdc} USDC exceeds maximum of ${TRANSACTION_LIMITS.maxPerTrade} USDC`,
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailyTotal = await prisma.executionQueue.aggregate({
      where: {
        userId,
        type: 'BUY',
        createdAt: { gte: today },
        status: { in: ['COMPLETED', 'PENDING', 'PROCESSING', 'SUCCESS'] },
      },
      _sum: { amount: true },
    })

    const currentDailyTotal = dailyTotal._sum.amount || 0
    if (currentDailyTotal + amountPerTradeUsdc > TRANSACTION_LIMITS.maxCopyBudget) {
      return {
        valid: false,
        error: `Trade would exceed daily copy budget of ${TRANSACTION_LIMITS.maxCopyBudget} USDC. Current daily total: ${currentDailyTotal} USDC`,
      }
    }

    return { valid: true }
  }
}

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<CustodialWalletService>('CustodialWallet') 
 */
let _custodialWalletInstance: CustodialWalletService | null = null;

function getCustodialWalletInstance(): CustodialWalletService {
  if (!_custodialWalletInstance) {
    try {
      _custodialWalletInstance = container.resolve<CustodialWalletService>('CustodialWallet');
    } catch {
      throw new Error(
        'CustodialWalletService requires DI container. Call setupContainer() first or use container.resolve().'
      );
    }
  }
  return _custodialWalletInstance;
}

export const custodialWalletService: CustodialWalletService = new Proxy({} as CustodialWalletService, {
  get(_target, prop) {
    const value = (getCustodialWalletInstance() as any)[prop];
    if (typeof value === 'function') return value.bind(getCustodialWalletInstance());
    return value;
  }
});

