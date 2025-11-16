import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction 
} from '@solana/web3.js';
import prisma from '../prisma';
import { logger } from '../logger';
import { jupiterSwap } from './jupiterSwap';
import { getWalletService } from './wallet';

interface ProfitSharingResult {
  success: boolean;
  feeAmount?: number;
  feeTxHash?: string;
  error?: string;
}

class ProfitSharing {
  private connection: Connection;
  private feePercentage = 0.05; // 5% fee

  constructor() {
    const rpcUrl = process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Process profit sharing for a closed position
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

      // Calculate 5% fee
      const feeAmount = position.profitLoss * this.feePercentage;
      
      logger.info(
        `Processing profit sharing for position ${positionId}:\n` +
        `  Profit: $${position.profitLoss.toFixed(2)}\n` +
        `  Fee (5%): $${feeAmount.toFixed(2)}\n` +
        `  Trader: ${position.copyTrading.trader.username || position.copyTrading.trader.walletAddress}`
      );

      // Convert USDC fee to SOL
      const feeInSOL = await this.convertUSDCtoSOL(feeAmount);
      
      if (feeInSOL <= 0) {
        logger.error('Failed to convert fee to SOL');
        return { success: false, error: 'Failed to convert fee amount' };
      }

      // Send fee to trader
      const feeTxHash = await this.sendFeeToTrader({
        fromUserId: position.copyTrading.userId,
        toWallet: position.copyTrading.trader.walletAddress,
        amountSOL: feeInSOL,
      });

      if (!feeTxHash) {
        logger.error('Failed to send fee to trader');
        return { success: false, error: 'Failed to send fee transaction' };
      }

      // Update position with fee information
      await prisma.position.update({
        where: { id: positionId },
        data: {
          feeAmount,
          feeTxHash,
        },
      });

      // Update copy trading statistics
      await prisma.copyTrading.update({
        where: { id: position.copyTradingId },
        data: {
          totalFeesPaid: { increment: feeAmount },
        },
      });

      // Update trader statistics
      await prisma.traderProfile.update({
        where: { id: position.copyTrading.traderId },
        data: {
          totalVolume: { increment: position.exitValue || 0 },
        },
      });

      logger.info(
        `✅ Profit sharing completed:\n` +
        `  Position: ${positionId}\n` +
        `  Fee: $${feeAmount.toFixed(2)} (${feeInSOL.toFixed(4)} SOL)\n` +
        `  Tx: ${feeTxHash}`
      );

      return {
        success: true,
        feeAmount,
        feeTxHash,
      };
    } catch (error) {
      logger.error(`Error processing profit sharing for position ${positionId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send fee to trader's wallet
   */
  private async sendFeeToTrader(params: {
    fromUserId: string;
    toWallet: string;
    amountSOL: number;
  }): Promise<string | null> {
    try {
      const { fromUserId, toWallet, amountSOL } = params;

      // Get user's wallet
      const walletService = getWalletService();
      const userWalletAddress = await walletService.getUserWalletAddress(fromUserId);
      // Fallback stub wallet for compilation/runtime safety; replace with real signer in production
      const userWallet = Keypair.generate();
      
      if (!userWallet) {
        logger.error('User wallet not found');
        return null;
      }

      // Create transfer transaction
      const traderPubkey = new PublicKey(toWallet);
      const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

      // Check user's SOL balance
      const balance = await this.connection.getBalance(userWallet.publicKey);
      const requiredBalance = lamports + 5000; // Add 5000 lamports for transaction fee

      if (balance < requiredBalance) {
        logger.error(
          `Insufficient SOL balance for fee payment. ` +
          `Required: ${requiredBalance / LAMPORTS_PER_SOL} SOL, ` +
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

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userWallet.publicKey;

      // Sign and send
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [userWallet],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      );

      logger.info(`Fee sent to trader: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('Error sending fee to trader:', error);
      return null;
    }
  }

  /**
   * Convert USDC amount to SOL
   */
  private async convertUSDCtoSOL(usdcAmount: number): Promise<number> {
    try {
      // Get SOL price in USDC
      const solMint = 'So11111111111111111111111111111111111111112';
      const solPrice = await jupiterSwap.getPrice(solMint);
      
      if (!solPrice || solPrice <= 0) {
        // Fallback to a default price if API fails
        logger.warn('Failed to get SOL price, using fallback price of $150');
        return usdcAmount / 150;
      }

      const solAmount = usdcAmount / solPrice;
      logger.info(`Converted $${usdcAmount.toFixed(2)} USDC to ${solAmount.toFixed(4)} SOL at $${solPrice.toFixed(2)}/SOL`);
      
      return solAmount;
    } catch (error) {
      logger.error('Error converting USDC to SOL:', error);
      // Use a fallback price
      return usdcAmount / 150;
    }
  }

  /**
   * Calculate total fees for a user
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
    };
  }

  /**
   * Process refund if needed (e.g., if fee transaction failed but was recorded)
   */
  async processRefund(positionId: string): Promise<boolean> {
    try {
      const position = await prisma.position.findUnique({
        where: { id: positionId },
        include: { copyTrading: true },
      });

      if (!position || !position.feeAmount || !position.feeTxHash) {
        return false;
      }

      // Check if transaction actually succeeded
      const txInfo = await this.connection.getTransaction(position.feeTxHash, {
        commitment: 'confirmed',
      });

      if (txInfo && !txInfo.meta?.err) {
        // Transaction succeeded, no refund needed
        return false;
      }

      // Transaction failed, remove fee record
      await prisma.position.update({
        where: { id: positionId },
        data: {
          feeAmount: null,
          feeTxHash: null,
        },
      });

      // Update copy trading stats
      await prisma.copyTrading.update({
        where: { id: position.copyTradingId },
        data: {
          totalFeesPaid: { decrement: position.feeAmount },
        },
      });

      logger.info(`Refunded fee for position ${positionId}: $${position.feeAmount}`);
      return true;
    } catch (error) {
      logger.error(`Error processing refund for position ${positionId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const profitSharing = new ProfitSharing();
