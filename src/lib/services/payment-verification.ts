/**
 * ✅ PRODUCTION-READY PAYMENT VERIFICATION
 * Verifies Solana transactions on-chain before activating subscriptions
 */
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { logger } from '../logger';
import prisma from '../prisma';
import { TRPCError } from '@trpc/server';

const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || '';
const MIN_CONFIRMATION = 15; // Wait for 15 confirmations (finalized)

export class PaymentVerificationService {
  private connection: Connection;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Verify VIP subscription payment
   */
  async verifyVIPPayment(
    transactionSignature: string,
    expectedAmount: number,
    recipientAddress: string
  ): Promise<{
    valid: boolean;
    actualAmount: number;
    fromAddress: string;
    timestamp: Date;
  }> {
    try {
      // Get transaction details
      const tx = await this.connection.getTransaction(transactionSignature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction not found on-chain',
        });
      }

      // Check transaction status
      if (tx.meta?.err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction failed on-chain',
        });
      }

      // Verify confirmations (finality)
      const slot = tx.slot;
      const currentSlot = await this.connection.getSlot('finalized');
      const confirmations = currentSlot - slot;

      if (confirmations < MIN_CONFIRMATION) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Transaction needs ${MIN_CONFIRMATION} confirmations (current: ${confirmations})`,
        });
      }

      // Extract transaction details
      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];
      const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys;

      // Find recipient's address index
      const recipientPubkey = new PublicKey(recipientAddress);
      const recipientIndex = accountKeys.findIndex(
        (key) => key.toString() === recipientPubkey.toString()
      );

      if (recipientIndex === -1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Recipient address not found in transaction',
        });
      }

      // Calculate amount transferred (in lamports)
      const recipientPreBalance = preBalances[recipientIndex] || 0;
      const recipientPostBalance = postBalances[recipientIndex] || 0;
      const amountReceived = recipientPostBalance - recipientPreBalance;
      const amountReceivedSOL = amountReceived / 1_000_000_000;

      // Verify amount (allow 1% tolerance for fees)
      const minAcceptable = expectedAmount * 0.99;
      if (amountReceivedSOL < minAcceptable) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient payment. Expected: ${expectedAmount} SOL, Received: ${amountReceivedSOL} SOL`,
        });
      }

      // Get sender address
      const senderPubkey = accountKeys[0]; // First signer is usually sender
      const fromAddress = senderPubkey.toString();

      // Get block time
      const timestamp = tx.blockTime
        ? new Date(tx.blockTime * 1000)
        : new Date();

      logger.info('Payment verified', {
        signature: transactionSignature,
        amount: amountReceivedSOL,
        from: fromAddress,
        to: recipientAddress,
        confirmations,
      });

      return {
        valid: true,
        actualAmount: amountReceivedSOL,
        fromAddress,
        timestamp,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      
      logger.error('Payment verification failed:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify payment on-chain',
      });
    }
  }

  /**
   * Verify copy trading profit share payment
   */
  async verifyCopyTradingPayment(
    transactionSignature: string,
    expectedAmount: number,
    traderId: string
  ): Promise<boolean> {
    // Get trader's wallet address
    const trader = await prisma.traderProfile.findUnique({
      where: { id: traderId },
      select: { walletAddress: true },
    });

    if (!trader) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Trader not found',
      });
    }

    const result = await this.verifyVIPPayment(
      transactionSignature,
      expectedAmount,
      trader.walletAddress
    );

    return result.valid;
  }

  /**
   * Check if transaction was already used
   */
  async isTransactionUsed(signature: string): Promise<boolean> {
    // Check VIP subscriptions
    const vipSub = await prisma.vIPSubscription.findFirst({
      where: { transactionSignature: signature },
    });

    if (vipSub) return true;

    // Check transactions table
    const tx = await prisma.transaction.findUnique({
      where: { signature },
    });

    return !!tx;
  }

  /**
   * Verify SPL token payment (e.g., USDC, USDT)
   */
  async verifySPLTokenPayment(
    transactionSignature: string,
    expectedAmount: number,
    tokenMint: string,
    recipientAddress: string
  ): Promise<{
    valid: boolean;
    actualAmount: number;
    fromAddress: string;
    timestamp: Date;
  }> {
    try {
      const tx = await this.connection.getParsedTransaction(transactionSignature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction not found on-chain',
        });
      }

      if (tx.meta?.err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction failed on-chain',
        });
      }

      // Find SPL token transfer instruction
      const tokenTransfers = tx.meta?.postTokenBalances?.filter(
        balance => balance.mint === tokenMint
      ) || [];

      if (tokenTransfers.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No token transfer found in transaction',
        });
      }

      // Find transfer to recipient
      const recipientTransfer = tokenTransfers.find(
        balance => balance.owner === recipientAddress
      );

      if (!recipientTransfer) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Recipient not found in token transfers',
        });
      }

      const actualAmount = recipientTransfer.uiTokenAmount.uiAmount || 0;

      // Verify amount (allow 1% tolerance)
      const minAcceptable = expectedAmount * 0.99;
      if (actualAmount < minAcceptable) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient payment. Expected: ${expectedAmount}, Received: ${actualAmount}`,
        });
      }

      // Get sender address
      const senderKey = tx.transaction.message.accountKeys[0];
      const fromAddress = senderKey.pubkey.toString();

      const timestamp = tx.blockTime
        ? new Date(tx.blockTime * 1000)
        : new Date();

      logger.info('SPL token payment verified', {
        signature: transactionSignature,
        amount: actualAmount,
        token: tokenMint,
        from: fromAddress,
        to: recipientAddress,
      });

      return {
        valid: true,
        actualAmount,
        fromAddress,
        timestamp,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      
      logger.error('SPL token payment verification failed:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify SPL token payment on-chain',
      });
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    signature: string,
    commitment: 'confirmed' | 'finalized' = 'finalized'
  ): Promise<boolean> {
    try {
      const result = await this.connection.confirmTransaction(
        signature,
        commitment
      );

      if (result.value.err) {
        logger.error('Transaction failed:', result.value.err);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error waiting for confirmation:', error);
      return false;
    }
  }

  /**
   * Get transaction fee payer
   */
  async getTransactionFeePayer(signature: string): Promise<string | null> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) return null;

      // Fee payer is always the first account
      const feePayer = tx.transaction.message.getAccountKeys().staticAccountKeys[0];
      return feePayer.toString();
    } catch (error) {
      logger.error('Error getting fee payer:', error);
      return null;
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateTransactionFee(): Promise<number> {
    try {
      const recentBlockhash = await this.connection.getLatestBlockhash('confirmed');
      const tx = new Transaction();
      tx.recentBlockhash = recentBlockhash.blockhash;
      // Use a dummy fee payer if none configured
      tx.feePayer = new PublicKey(PLATFORM_WALLET || '11111111111111111111111111111111');
      const feeCalculator = await this.connection.getFeeForMessage(tx.compileMessage());

      if (!feeCalculator.value) {
        return 5000; // Default to 5000 lamports
      }

      return feeCalculator.value;
    } catch (error) {
      logger.error('Error estimating fee:', error);
      return 5000; // Default to 5000 lamports
    }
  }

  /**
   * Verify platform fee was paid
   */
  async verifyPlatformFee(
    transactionSignature: string,
    expectedFeeSOL: number
  ): Promise<boolean> {
    if (!PLATFORM_WALLET) {
      logger.warn('Platform wallet not configured, skipping fee verification');
      return true;
    }

    try {
      const result = await this.verifyVIPPayment(
        transactionSignature,
        expectedFeeSOL,
        PLATFORM_WALLET
      );

      return result.valid;
    } catch (error) {
      logger.error('Platform fee verification failed:', error);
      return false;
    }
  }
}

// Export singleton
export const paymentVerificationService = new PaymentVerificationService();
