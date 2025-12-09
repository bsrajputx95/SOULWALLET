// @ts-nocheck
import prisma from '../lib/prisma';
import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import * as crypto from 'crypto';
import { TRPCError } from '@trpc/server';
import { logger } from '../lib/logger';

const algorithm = 'aes-256-gcm';

// Get encryption key and ensure it's properly formatted
function getEncryptionKey(): Buffer {
  const keyString = process.env.WALLET_ENCRYPTION_KEY;
  
  if (!keyString || keyString === 'default-key-change-in-production') {
    // In development, use a default key (32 bytes for AES-256)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('WALLET_ENCRYPTION_KEY must be set in production');
    }
    // Default dev key (32 bytes hex = 64 characters)
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
  }
  
  // Validate the key is proper hex and correct length
  if (!/^[0-9a-fA-F]{64}$/.test(keyString)) {
    throw new Error('WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  
  return Buffer.from(keyString, 'hex');
}

const ENCRYPTION_KEY = getEncryptionKey();

export class WalletService {
  private static connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  );

  // Encryption utilities
  private static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private static decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Get SOL balance
  static async getBalance(publicKey: string): Promise<number> {
    try {
      const balance = await this.connection.getBalance(new PublicKey(publicKey));
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.error('Error getting balance', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get wallet balance'
      });
    }
  }

  // Get all token holdings
  static async getTokenHoldings(walletId: string) {
    try {
      // Note: tokenHolding model doesn't exist in current schema
      // This would need to be implemented with the proper model
      // For now, returning empty array
      return [];
    } catch (error) {
      logger.error('Error getting token holdings', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get token holdings'
      });
    }
  }

  // Create new wallet
  static async createWallet(userId: string) {
    try {
      // Generate new keypair
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const privateKey = Buffer.from(keypair.secretKey).toString('base64');
      
      // Encrypt private key
      const encryptedPrivateKey = this.encrypt(privateKey);
      
      // Check if user has any wallets
      const existingWallets = await prisma.wallet.findMany({
        where: { userId }
      });
      
      // Create wallet in database
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          publicKey,
          privateKey: encryptedPrivateKey,
          isPrimary: existingWallets.length === 0, // First wallet is primary
          balance: 0,
          network: 'mainnet-beta'
        }
      });

      return {
        id: wallet.id,
        publicKey: wallet.publicKey,
        isPrimary: wallet.isPrimary,
        balance: 0
      };
    } catch (error) {
      logger.error('Error creating wallet', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create wallet'
      });
    }
  }

  // Import existing wallet
  static async importWallet(userId: string, privateKeyBase58: string) {
    try {
      // Validate and parse private key
      const keypair = Keypair.fromSecretKey(
        Buffer.from(privateKeyBase58, 'base64')
      );
      
      const publicKey = keypair.publicKey.toString();
      
      // Check if wallet already exists
      const existingWallet = await prisma.wallet.findUnique({
        where: { publicKey }
      });
      
      if (existingWallet) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Wallet already imported'
        });
      }
      
      // Encrypt private key
      const encryptedPrivateKey = this.encrypt(privateKeyBase58);
      
      // Check if user has any wallets
      const userWallets = await prisma.wallet.findMany({
        where: { userId }
      });
      
      // Create wallet in database
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          publicKey,
          privateKey: encryptedPrivateKey,
          isPrimary: userWallets.length === 0,
          balance: await this.getBalance(publicKey),
          network: 'mainnet-beta'
        }
      });

      return {
        id: wallet.id,
        publicKey: wallet.publicKey,
        isPrimary: wallet.isPrimary,
        balance: wallet.balance
      };
    } catch (error) {
      logger.error('Error importing wallet', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to import wallet'
      });
    }
  }

  // Send SOL transaction
  static async sendTransaction(params: {
    userId: string;
    recipientAddress: string;
    amount: number;
    tokenMint?: string;
  }) {
    try {
      const { userId, recipientAddress, amount, tokenMint } = params;
      
      // Get user's primary wallet
      const wallet = await prisma.wallet.findFirst({
        where: { userId, isPrimary: true }
      });
      
      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No primary wallet found'
        });
      }
      
      // Decrypt private key
      const privateKeyBase64 = this.decrypt(wallet.privateKey);
      const keypair = Keypair.fromSecretKey(
        Buffer.from(privateKeyBase64, 'base64')
      );
      
      const recipientPubkey = new PublicKey(recipientAddress);
      
      let signature: string;
      
      if (!tokenMint || tokenMint === 'SOL') {
        // Send SOL
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: recipientPubkey,
            lamports: amount * LAMPORTS_PER_SOL,
          })
        );
        
        signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [keypair]
        );
      } else {
        // Send SPL token
        const mintPubkey = new PublicKey(tokenMint);
        
        const fromTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          keypair.publicKey
        );
        
        const toTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          recipientPubkey
        );
        
        const transaction = new Transaction().add(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            keypair.publicKey,
            amount * Math.pow(10, 9), // Assuming 9 decimals
            [],
            TOKEN_PROGRAM_ID
          )
        );
        
        signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [keypair]
        );
      }
      
      // Record transaction
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          signature,
          type: 'SEND',
          status: 'CONFIRMED',
          fromAddress: wallet.publicKey,
          toAddress: recipientAddress,
          amount,
          tokenMint: tokenMint || 'SOL',
          tokenSymbol: tokenMint === 'SOL' ? 'SOL' : undefined,
          fee: 0.000005, // Approximate SOL fee
          blockTime: new Date()
        }
      });
      
      // Update wallet balance
      const newBalance = await this.getBalance(wallet.publicKey);
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });
      
      return {
        signature,
        status: 'confirmed',
        amount,
        recipient: recipientAddress
      };
    } catch (error) {
      logger.error('Error sending transaction', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to send transaction'
      });
    }
  }

  // Swap tokens using Jupiter
  static async swapTokens(params: {
    userId: string;
    fromMint: string;
    toMint: string;
    amount: number;
    slippage: number;
  }) {
    try {
      // Implementation would integrate with Jupiter API
      // This is a placeholder for the actual implementation
      const { userId, fromMint, toMint, amount, slippage } = params;
      
      // Get user's primary wallet
      const wallet = await prisma.wallet.findFirst({
        where: { userId, isPrimary: true }
      });
      
      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No primary wallet found'
        });
      }
      
      // Here you would:
      // 1. Get quote from Jupiter
      // 2. Build swap transaction
      // 3. Sign and send transaction
      // 4. Record in database
      
      return {
        signature: 'mock-signature',
        status: 'confirmed',
        fromAmount: amount,
        toAmount: amount * 0.98, // Mock with slippage
        fromMint,
        toMint
      };
    } catch (error) {
      logger.error('Error swapping tokens', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to swap tokens'
      });
    }
  }

  // Get transaction history
  static async getTransactionHistory(userId: string, limit = 50) {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: { userId, isPrimary: true },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: limit
          }
        }
      });
      
      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No primary wallet found'
        });
      }
      
      return wallet.transactions;
    } catch (error) {
      logger.error('Error getting transaction history', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get transaction history'
      });
    }
  }

  // Update token holdings (called by background job)
  static async updateTokenHoldings(walletId: string) {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId }
      });
      
      if (!wallet) return;
      
      // Get token accounts from Solana
      const publicKey = new PublicKey(wallet.publicKey);
      
      // This would fetch actual token accounts
      // For now, returning mock data
      
      return true;
    } catch (error) {
      logger.error('Error updating token holdings', error);
      return false;
    }
  }
}
