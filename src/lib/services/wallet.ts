/**
 * ⚠️ SECURITY NOTICE: This service ONLY handles wallet verification.
 * Wallet creation and key management MUST happen client-side.
 * Backend should NEVER see or store private keys.
 */

import { PublicKey } from '@solana/web3.js';
import prisma from '../prisma';
import { logger } from '../logger';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

class WalletService {
  constructor() {
    // No encryption key needed - backend never handles private keys
  }

  /**
   * Get user's wallet public address
   */
  async getUserWalletAddress(userId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true,
          walletAddress: true,
        },
      });

      if (!user || !user.walletAddress) {
        logger.info(`User ${userId} has no wallet registered`);
        return null;
      }

      return user.walletAddress;
    } catch (error) {
      logger.error(`Failed to get wallet address for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Register a wallet address for a user (CLIENT provides public key only)
   */
  async registerWallet(userId: string, walletAddress: string): Promise<boolean> {
    try {
      // Validate wallet address
      try {
        new PublicKey(walletAddress);
      } catch {
        throw new Error('Invalid Solana wallet address');
      }

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      })

      // Store only the public wallet address
      await prisma.user.update({
        where: { id: userId },
        data: {
          walletAddress,
          walletVerifiedAt: null, // Will be verified separately
        },
      });

      const { AuthService } = await import('./auth')
      await AuthService.invalidateUserCache(userId)

      const { birdeyeData } = await import('./birdeyeData')
      if (existingUser?.walletAddress) {
        birdeyeData.clearCache(existingUser.walletAddress)
      }
      birdeyeData.clearCache(walletAddress)

      logger.info(`Registered wallet address for user ${userId}: ${walletAddress}`);
      return true;
    } catch (error) {
      logger.error(`Failed to register wallet for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Verify wallet ownership through message signing
   */
  async verifyWalletOwnership(
    userId: string,
    message: string,
    signature: string,
    publicKey: string
  ): Promise<boolean> {
    try {
      // Get user's registered wallet
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });

      if (!user || user.walletAddress !== publicKey) {
        logger.warn(`Wallet verification failed: address mismatch for user ${userId}`);
        return false;
      }

      // Verify signature
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(publicKey);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );

      if (isValid) {
        // Mark wallet as verified
        await prisma.user.update({
          where: { id: userId },
          data: {
            walletVerifiedAt: new Date(),
          },
        });

        const { AuthService } = await import('./auth')
        await AuthService.invalidateUserCache(userId)
        
        logger.info(`Wallet ownership verified for user ${userId}`);
      }

      return isValid;
    } catch (error) {
      logger.error(`Failed to verify wallet ownership for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if a user has a registered wallet
   */
  async hasWallet(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });

      return !!user?.walletAddress;
    } catch (error) {
      logger.error(`Failed to check wallet for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if wallet is verified
   */
  async isWalletVerified(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletVerifiedAt: true },
      });

      return !!user?.walletVerifiedAt;
    } catch (error) {
      logger.error(`Failed to check wallet verification for user ${userId}:`, error);
      return false;
    }
  }
}

// Export singleton instance and getter
const walletService = new WalletService();

export function getWalletService(): WalletService {
  return walletService;
}

export default walletService;
