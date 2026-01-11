import 'reflect-metadata';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { injectable, inject } from 'tsyringe';
import prisma from '../prisma';
import type { Prisma } from '@prisma/client';
import { logger } from '../logger';
import type { JupiterSwap } from './jupiterSwap';
import type { CustodialWalletService } from './custodialWallet';
import type { RpcManager } from './rpcManager';

// Minimum fee threshold in SOL - below this, skip transfer to avoid tx fees exceeding fee amount
const MIN_FEE_SOL = 0.001;

interface ProfitSharingResult {
  success: boolean;
  feeAmount?: number;
  feeTxHash?: string;
  skipped?: boolean;
  reason?: string; // Why fee was skipped (e.g., 'below_threshold', 'min_fee')
  error?: string;
}

/**
 * Profit Sharing Service
 * Handles fee distribution to traders for profitable copy trades
 */
@injectable()
export class ProfitSharing {
  private feePercentage = 0.05; // 5% fee

  constructor(
    @inject('RpcManager') private readonly rpcManager: RpcManager,
    @inject('JupiterSwap') private readonly jupiterSwap: JupiterSwap,
    @inject('CustodialWallet') private readonly custodialWalletService: CustodialWalletService,
  ) { }

  /**
   * Process profit sharing for a closed position
   * Uses database transaction for atomicity - only records fee after successful transfer
   */
  async processProfitSharing(positionId: string): Promise<ProfitSharingResult> {
    try {
      // Get position with all related data
      const position = await prisma.position.findUnique({
        where: { id: positionId },
        include: {
          copyTrading: {
            include: {
              trader: true,
              user: true,
            },
          },
        },
      });

      if (!position) {
        return { success: false, error: 'Position not found' };
      }

      if (position.status !== 'CLOSED') {
        return { success: false, error: 'Position is not closed' };
      }

      // Only charge fee if profit > 0
      if (!position.profitLoss || position.profitLoss <= 0) {
        logger.info(`No profit for position ${positionId}, no fee charged`);
        return { success: true, feeAmount: 0 };
      }

      // Check if profit meets user's minimum threshold for sharing
      const minProfit = position.copyTrading.minProfitForSharing || 0;
      if (position.profitLoss < minProfit) {
        logger.info(`Profit ${position.profitLoss.toFixed(2)} below user threshold ${minProfit}, no fee charged`);
        return { success: true, feeAmount: 0, skipped: true, reason: 'below_threshold' };
      }


      // Calculate 5% fee
      const feeAmount = position.profitLoss * this.feePercentage;

      logger.info(
        `Processing profit sharing for position ${positionId}:\n` +
        `  Profit: ${position.profitLoss.toFixed(2)}\n` +
        `  Fee (5%): ${feeAmount.toFixed(2)}\n` +
        `  Trader: ${position.copyTrading.trader.username || position.copyTrading.trader.walletAddress}`
      );

      // Convert USDC fee to SOL
      const feeInSOL = await this.convertUSDCtoSOL(feeAmount);

      if (feeInSOL <= 0) {
        logger.error('Failed to convert fee to SOL');
        return { success: false, error: 'Failed to convert fee amount' };
      }

      // Check minimum fee threshold - skip if too small
      if (feeInSOL < MIN_FEE_SOL) {
        logger.info(`Fee too small (${feeInSOL.toFixed(6)} SOL < ${MIN_FEE_SOL} SOL), skipping transfer`);
        return { success: true, feeAmount: 0, skipped: true };
      }

      // Send fee to trader using real wallet
      const feeTxHash = await this.sendFeeToTrader({
        fromUserId: position.copyTrading.userId,
        toWallet: position.copyTrading.trader.walletAddress,
        amountSOL: feeInSOL,
      });

      if (!feeTxHash) {
        logger.error('Failed to send fee to trader');
        return { success: false, error: 'Failed to send fee transaction' };
      }

      // Verify transaction on-chain before recording
      const verified = await this.verifyTransaction(feeTxHash);
      if (!verified) {
        logger.error(`Fee transaction ${feeTxHash} failed verification`);
        return { success: false, error: 'Fee transaction failed on-chain verification' };
      }

      // Only update database after successful, verified transfer
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.position.update({
          where: { id: positionId },
          data: { feeAmount, feeTxHash },
        });

        await tx.copyTrading.update({
          where: { id: position.copyTradingId },
          data: { totalFeesPaid: { increment: feeAmount } },
        });

        await tx.traderProfile.update({
          where: { id: position.copyTrading.traderId },
          data: { totalVolume: { increment: position.exitValue || 0 } },
        });
      });

      logger.info(
        `✅ Profit sharing completed:\n` +
        `  Position: ${positionId}\n` +
        `  Fee: ${feeAmount.toFixed(2)} (${feeInSOL.toFixed(4)} SOL)\n` +
        `  Tx: ${feeTxHash}`
      );

      return { success: true, feeAmount, feeTxHash };
    } catch (error) {
      logger.error(`Error processing profit sharing for position ${positionId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }


  /**
   * Verify a transaction succeeded on-chain
   */
  private async verifyTransaction(signature: string): Promise<boolean> {
    try {
      const connection = await this.rpcManager.getConnection();
      const txInfo = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!txInfo) {
        logger.warn(`Transaction ${signature} not found`);
        return false;
      }

      if (txInfo.meta?.err) {
        logger.error(`Transaction ${signature} failed:`, txInfo.meta.err);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error verifying transaction ${signature}:`, error);
      return false;
    }
  }

  /**
   * Send fee to trader's wallet using custodial wallet
   */
  private async sendFeeToTrader(params: {
    fromUserId: string;
    toWallet: string;
    amountSOL: number;
  }): Promise<string | null> {
    try {
      const { fromUserId, toWallet, amountSOL } = params;
      const connection = await this.rpcManager.getConnection();

      // Get user's custodial wallet - REAL WALLET, NOT STUB
      const userWallet = await this.custodialWalletService.getKeypair(fromUserId);
      if (!userWallet) {
        logger.error(`Custodial wallet not found for user ${fromUserId}`);
        return null;
      }

      const traderPubkey = new PublicKey(toWallet);
      const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

      // Check user's SOL balance
      const balance = await connection.getBalance(userWallet.publicKey);
      const requiredBalance = lamports + 5000; // Amount + tx fee

      if (balance < requiredBalance) {
        logger.error(
          `Insufficient SOL balance for fee. Required: ${requiredBalance / LAMPORTS_PER_SOL} SOL, ` +
          `Available: ${balance / LAMPORTS_PER_SOL} SOL`
        );
        return null;
      }

      // Create and send transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: userWallet.publicKey,
          toPubkey: traderPubkey,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userWallet.publicKey;

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [userWallet],
        { commitment: 'confirmed', preflightCommitment: 'confirmed' }
      );

      logger.info(`Fee sent to trader: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('Error sending fee to trader:', error);
      return null;
    }
  }

  /**
   * Convert USDC amount to SOL using Jupiter price
   */
  private async convertUSDCtoSOL(usdcAmount: number): Promise<number> {
    try {
      const solMint = 'So11111111111111111111111111111111111111112';
      const solPrice = await this.jupiterSwap.getPrice(solMint);

      if (!solPrice || solPrice <= 0) {
        logger.warn('Failed to get SOL price, using fallback price of $150');
        return usdcAmount / 150;
      }

      const solAmount = usdcAmount / solPrice;
      logger.info(`Converted ${usdcAmount.toFixed(2)} USDC to ${solAmount.toFixed(4)} SOL at $${solPrice.toFixed(2)}/SOL`);
      return solAmount;
    } catch (error) {
      logger.error('Error converting USDC to SOL:', error);
      return usdcAmount / 150;
    }
  }

  /**
   * Send iBuy creator fee (5% of profit) to post creator's wallet
   * Called when user sells iBuy token at profit
   */
  async sendIBuyCreatorFee(params: {
    fromUserId: string;       // User who made the profit
    creatorWallet: string;    // Post creator's wallet address
    feeAmountUsdc: number;    // Fee amount in USDC
    purchaseId: string;       // For logging
    creatorUsername?: string; // For logging
  }): Promise<string | null> {
    try {
      const { fromUserId, creatorWallet, feeAmountUsdc, purchaseId, creatorUsername } = params;

      // Skip if fee too small (< $0.10 to make transfer worthwhile)
      if (feeAmountUsdc < 0.10) {
        logger.info(`iBuy fee too small ($${feeAmountUsdc.toFixed(2)}), skipping transfer`);
        return null;
      }

      // Convert USDC fee to SOL
      const feeInSOL = await this.convertUSDCtoSOL(feeAmountUsdc);

      // Check minimum SOL threshold
      if (feeInSOL < MIN_FEE_SOL) {
        logger.info(`iBuy fee too small in SOL (${feeInSOL.toFixed(6)} < ${MIN_FEE_SOL}), skipping`);
        return null;
      }

      logger.info(
        `Sending iBuy creator fee:\n` +
        `  Purchase: ${purchaseId}\n` +
        `  Fee: $${feeAmountUsdc.toFixed(2)} (${feeInSOL.toFixed(4)} SOL)\n` +
        `  To: @${creatorUsername || 'unknown'} (${creatorWallet})`
      );

      // Send fee using custodial wallet
      const txSig = await this.sendFeeToTrader({
        fromUserId,
        toWallet: creatorWallet,
        amountSOL: feeInSOL,
      });

      if (txSig) {
        logger.info(`✅ iBuy creator fee sent: ${txSig}`);
      } else {
        logger.warn(`⚠️ iBuy creator fee transfer failed for ${purchaseId}`);
      }

      return txSig;
    } catch (error) {
      logger.error('Error sending iBuy creator fee:', error);
      return null;
    }
  }


  /**
   * Calculate total fees paid by a user
   */
  async getUserTotalFees(userId: string): Promise<number> {
    const result = await prisma.copyTrading.aggregate({
      where: { userId },
      _sum: { totalFeesPaid: true },
    });
    return result._sum.totalFeesPaid || 0;
  }

  /**
   * Calculate total fees earned by a trader
   */
  async getTraderEarnedFees(traderId: string): Promise<number> {
    const result = await prisma.position.aggregate({
      where: {
        copyTrading: { traderId },
        feeAmount: { not: null },
      },
      _sum: { feeAmount: true },
    });
    return result._sum.feeAmount || 0;
  }

  /**
   * Get fee statistics
   */
  async getFeeStats() {
    const [totalFeesPaid, totalPositions, avgFeePerPosition] = await Promise.all([
      prisma.position.aggregate({
        where: { feeAmount: { not: null } },
        _sum: { feeAmount: true },
      }),
      prisma.position.count({
        where: { feeAmount: { not: null } },
      }),
      prisma.position.aggregate({
        where: { feeAmount: { not: null } },
        _avg: { feeAmount: true },
      }),
    ]);

    return {
      totalFeesPaid: totalFeesPaid._sum.feeAmount || 0,
      totalPositionsWithFees: totalPositions,
      avgFeePerPosition: avgFeePerPosition._avg.feeAmount || 0,
      feePercentage: this.feePercentage * 100,
      minFeeThresholdSOL: MIN_FEE_SOL,
    };
  }

  /**
   * Get the fee percentage (for testing/display)
   */
  getFeePercentage(): number {
    return this.feePercentage;
  }

  /**
   * Comment 3: Enqueue profit sharing for async processing via Bull queue
   * Use this instead of direct processProfitSharing for better scalability
   */
  async enqueueProcessing(params: {
    positionId: string;
    userId: string;
    profitLoss: number;
    traderId: string;
  }): Promise<string> {
    // Dynamically import to avoid circular dependency
    const { executionQueue } = await import('./executionQueue');
    return executionQueue.addProfitSharing(params);
  }
}

// Import container for resolving
import { container } from '../di/container';

/** 
 * @deprecated Use dependency injection instead. 
 * Import via container.resolve<ProfitSharing>('ProfitSharing') 
 * 
 * Note: Lazy initialization to prevent container.resolve failures
 */
let _profitSharingInstance: ProfitSharing | null = null;

function getProfitSharingInstance(): ProfitSharing {
  if (!_profitSharingInstance) {
    try {
      _profitSharingInstance = container.resolve<ProfitSharing>('ProfitSharing');
    } catch {
      // In tests or when container not set up, we can't easily create ProfitSharing 
      // as it has constructor dependencies. Throw a more helpful error.
      throw new Error(
        'ProfitSharing requires DI container. Call setupContainer() first or use container.resolve().'
      );
    }
  }
  return _profitSharingInstance;
}

export const profitSharing = new Proxy({} as ProfitSharing, {
  get(_target, prop) {
    return (getProfitSharingInstance() as any)[prop];
  }
});

export { MIN_FEE_SOL };
