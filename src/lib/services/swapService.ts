import { TIMEOUTS } from '../../../constants/timeouts';
import { redisCache } from '../redis';
// BigInt sanitization removed - SuperJSON handles serialization
import { jupiterSwap } from './jupiterSwap';
import prisma from '../prisma';
import logger from '../logger';

// Define quote cache TTL (seconds)
const QUOTE_CACHE_TTL = 30;

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number; // human-readable (e.g. 1.23 SOL)
  slippageBps: number;
}

export interface SwapPrepareParams extends QuoteParams {
  userId: string;
  walletAddress: string;
}

export type SwapStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export class SwapService {

  private quoteCacheKey(p: QuoteParams): string {
    return `swap:quote:${p.inputMint}:${p.outputMint}:${p.amount}`;
  }

  async getQuote(p: QuoteParams) {
    const cacheKey = this.quoteCacheKey(p);
    const cached = await redisCache.get<string>(cacheKey as any);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore json error, fallthrough
      }
    }

    try {
      const params = new URLSearchParams({
        inputMint: p.inputMint,
        outputMint: p.outputMint,
        amount: Math.floor(p.amount * 1_000_000).toString(),
        slippageBps: p.slippageBps.toString(),
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUTS.EXTERNAL_API);
      const resp = await fetch(`${process.env.EXPO_PUBLIC_JUPITER_API_URL || 'https://quote-api.jup.ag'}/v6/quote?${params}`,
        { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`Jupiter quote error: ${resp.status}`);
      const quote = await resp.json();
      await redisCache.set(cacheKey as any, JSON.stringify(quote), QUOTE_CACHE_TTL);
      return quote;
    } catch (err) {
      logger.error('getQuote failed', err);
      throw mapSwapError(err);
    }
  }

  async prepareSwap(p: SwapPrepareParams) {
    try {
      const quote = await this.getQuote(p);
      const swapTx = await jupiterSwap.getSwapTransaction({
        quoteResponse: quote,
        userPublicKey: p.walletAddress,
        wrapAndUnwrapSol: true,
        asLegacyTransaction: true,
      });
      if (!swapTx?.swapTransaction) throw new Error('Failed to get swap transaction');

      // Save DB transaction record
      const txn = await prisma.transaction.create({
        data: {
          userId: p.userId,
          signature: `pending_${Date.now()}`,
          type: 'SWAP',
          amount: p.amount,
          token: p.inputMint,
          status: 'PENDING',
          metadata: {
            quote,
          },
        },
      });

      return {
        swapTransaction: swapTx.swapTransaction,
        lastValidBlockHeight: swapTx.lastValidBlockHeight,
        transactionId: txn.id,
        quote,
      };
    } catch (err) {
      logger.error('prepareSwap error', err);
      throw mapSwapError(err);
    }
  }

  async updateSwapStatus(txId: string, status: SwapStatus, signature?: string, errorMsg?: string) {
    await prisma.transaction.update({
      where: { id: txId },
      data: {
        status,
        signature: signature || undefined,
        metadata: errorMsg ? { ...(signature ? { signature } : {}), errorMsg } : undefined,
      },
    });
  }

  async getSwapStatus(txId: string) {
    const tx = await prisma.transaction.findUnique({ where: { id: txId } });
    if (!tx) throw new Error('Transaction not found');
    return { status: tx.status as SwapStatus, signature: tx.signature };
  }
}

export const swapService = new SwapService();

// Error mapper util
export function mapSwapError(error: any): Error {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  let userMsg = 'Swap failed. Please try again.';
  if (msg.includes('no routes')) userMsg = 'No liquidity available for this swap';
  else if (msg.includes('slippage')) userMsg = 'Price moved too much. Try increasing slippage.';
  else if (msg.includes('timeout')) userMsg = 'Request timed out. Please try again.';
  else if (msg.includes('429') || msg.includes('rate limit')) userMsg = 'Too many requests. Please wait a moment.';
  return new Error(userMsg);
}
