import prisma from '../db';
import axios from 'axios';
import { getConnection } from '../utils/solana';
import { PublicKey } from '@solana/web3.js';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_ULTRA_API = 'https://api.jup.ag/ultra/v1';

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
  swapTransaction?: string;
}

// Add item to queue
export async function enqueueIBuy(
  userId: string,
  postId: string,
  amount: number
): Promise<{ success: boolean; queueId?: string; position?: number; error?: string }> {
  try {
    // Check if already in queue
    const existing = await prisma.iBuyQueue.findFirst({
      where: {
        userId,
        postId,
        status: { in: ['pending', 'processing'] }
      }
    });

    if (existing) {
      return { success: false, error: 'Already in queue' };
    }

    // Get queue position
    const pendingCount = await prisma.iBuyQueue.count({
      where: { status: 'pending' }
    });

    // Create queue item
    const queueItem = await prisma.iBuyQueue.create({
      data: {
        userId,
        postId,
        amount,
        status: 'pending'
      }
    });

    return {
      success: true,
      queueId: queueItem.id,
      position: pendingCount + 1
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get queue status for user
export async function getQueueStatus(userId: string): Promise<{
  pending: number;
  processing: number;
  userQueue: any[];
}> {
  const [pending, processing, userQueue] = await Promise.all([
    prisma.iBuyQueue.count({ where: { status: 'pending' } }),
    prisma.iBuyQueue.count({ where: { status: 'processing' } }),
    prisma.iBuyQueue.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  return { pending, processing, userQueue };
}

// Process queue items (called by worker)
export async function processIBuyQueue(batchSize = 10): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  // Get pending items
  const items = await prisma.iBuyQueue.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: batchSize
  });

  let successful = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await processIBuyItem(item.id);
      successful++;
    } catch {
      failed++;
    }
  }

  return {
    processed: items.length,
    successful,
    failed
  };
}

// Process single item
async function processIBuyItem(queueId: string): Promise<void> {
  const item = await prisma.iBuyQueue.findUnique({
    where: { id: queueId }
  });

  if (!item || item.status !== 'pending') return;

  // Mark as processing
  await prisma.iBuyQueue.update({
    where: { id: queueId },
    data: {
      status: 'processing',
      processingStartedAt: new Date()
    }
  });

  try {
    // Get post details
    const post = await prisma.post.findUnique({
      where: { id: item.postId },
      include: { user: true }
    });

    if (!post || !post.tokenAddress) {
      throw new Error('Post not found or no token');
    }

    // Get Jupiter quote
    const swapAmount = item.amount * 0.95;
    const creatorFee = item.amount * 0.05;
    const amountLamports = Math.floor(swapAmount * 1e9);

    const quoteParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: post.tokenAddress,
      amount: amountLamports.toString(),
      slippageBps: '50',
    });

    const quoteResponse = await fetch(`${JUPITER_ULTRA_API}/order?${quoteParams}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!quoteResponse.ok) {
      throw new Error('Jupiter quote failed');
    }

    const quoteData = await quoteResponse.json();

    if (quoteData.errorCode) {
      throw new Error(quoteData.errorMessage || 'Jupiter error');
    }

    const quote: JupiterQuote = {
      inputMint: quoteData.inputMint || SOL_MINT,
      outputMint: quoteData.outputMint || post.tokenAddress,
      inAmount: quoteData.inAmount || amountLamports.toString(),
      outAmount: quoteData.outAmount,
      otherAmountThreshold: quoteData.otherAmountThreshold || quoteData.outAmount,
      slippageBps: 50,
      priceImpactPct: quoteData.priceImpactPct || '0',
      routePlan: quoteData.routePlan || [],
      swapTransaction: quoteData.transaction || quoteData.swapTransaction,
    };

    // Store quote and return to client for signing
    await prisma.iBuyQueue.update({
      where: { id: queueId },
      data: {
        quote: JSON.stringify(quote),
        creatorFee,
        status: 'pending' // Wait for client to sign
      }
    });

  } catch (error: any) {
    // Increment retry count
    const newRetryCount = item.retryCount + 1;
    const shouldFail = newRetryCount >= item.maxRetries;

    await prisma.iBuyQueue.update({
      where: { id: queueId },
      data: {
        retryCount: newRetryCount,
        errorMessage: error.message,
        status: shouldFail ? 'failed' : 'pending',
        processingStartedAt: null
      }
    });

    if (shouldFail) {
      throw error;
    }
  }
}

// Complete iBuy after client signs transaction
export async function completeIBuy(
  queueId: string,
  signature: string,
  userId: string
): Promise<{ success: boolean; positionId?: string; error?: string }> {
  try {
    const item = await prisma.iBuyQueue.findFirst({
      where: {
        id: queueId,
        userId,
        status: { in: ['pending', 'processing'] }
      }
    });

    if (!item) {
      return { success: false, error: 'Queue item not found' };
    }

    if (!item.quote) {
      return { success: false, error: 'Quote not ready' };
    }

    const quote: JupiterQuote = JSON.parse(item.quote);

    // Get post details
    const post = await prisma.post.findUnique({
      where: { id: item.postId },
      include: { user: true }
    });

    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    // Get token decimals
    const decimals = await getTokenDecimals(post.tokenAddress!);

    // Calculate token amount and price
    const tokenAmount = parseInt(quote.outAmount) / Math.pow(10, decimals);
    const solSpent = item.amount * 0.95;
    const price = tokenAmount > 0 ? solSpent / tokenAmount : 0;

    // Create position
    const position = await prisma.iBuyPosition.create({
      data: {
        userId,
        postId: item.postId,
        creatorId: post.userId,
        tokenAddress: post.tokenAddress!,
        tokenSymbol: post.tokenSymbol || 'Unknown',
        entryPrice: price,
        solAmount: item.amount,
        tokenAmount,
        creatorFee: item.creatorFee || 0,
        remainingAmount: tokenAmount,
        realizedPnl: 0,
        creatorSharePaid: 0,
        status: 'open'
      }
    });

    // Update post stats
    await prisma.post.update({
      where: { id: item.postId },
      data: {
        ibuyCount: { increment: 1 },
        ibuyVolume: { increment: item.amount }
      }
    });

    // Mark queue item as completed
    await prisma.iBuyQueue.update({
      where: { id: queueId },
      data: {
        status: 'completed',
        positionId: position.id,
        tokenAmount,
        creatorFee: item.creatorFee || 0,
        completedAt: new Date()
      }
    });

    return { success: true, positionId: position.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get token decimals helper
async function getTokenDecimals(mintAddress: string): Promise<number> {
  try {
    const response = await axios.get(`https://api.jup.ag/tokens/v1/token/${mintAddress}`, {
      timeout: 5000
    });
    return response.data.decimals || 9;
  } catch {
    return 9;
  }
}

// Cleanup old completed items (call periodically)
export async function cleanupOldQueueItems(days = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await prisma.iBuyQueue.deleteMany({
    where: {
      status: { in: ['completed', 'failed'] },
      createdAt: { lt: cutoff }
    }
  });

  return result.count;
}
