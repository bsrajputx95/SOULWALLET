import { TIMEOUTS } from '../../../constants/timeouts';
import { redisCache } from '../redis';
// BigInt sanitization removed - SuperJSON handles serialization
import { jupiterSwap } from './jupiterSwap';
import prisma from '../prisma';
import logger from '../logger';
import { fromBaseUnits, getTokenDecimals } from '../../../constants';

// Define quote cache TTL (seconds)
const QUOTE_CACHE_TTL = 30;

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number; // Amount in base units (lamports for SOL, smallest units for tokens)
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
      // Amount is already in base units (pre-converted by caller)
      const params = new URLSearchParams({
        inputMint: p.inputMint,
        outputMint: p.outputMint,
        amount: Math.floor(p.amount).toString(),
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

      // Save DB transaction record - convert base units to human-readable for storage
      const humanReadableAmount = fromBaseUnits(p.amount, p.inputMint);
      const txn = await prisma.transaction.create({
        data: {
          userId: p.userId,
          signature: `pending_${Date.now()}`,
          type: 'SWAP',
          amount: humanReadableAmount,
          token: p.inputMint,
          status: 'PENDING',
          metadata: {
            quote,
          },
        },
      });

      // Log response types for debugging
      logger.info('SwapService prepareSwap response types:', {
        swapTransaction: typeof swapTx.swapTransaction,
        swapTransactionLength: swapTx.swapTransaction?.length,
        lastValidBlockHeight: typeof swapTx.lastValidBlockHeight,
        lastValidBlockHeightValue: swapTx.lastValidBlockHeight,
        transactionId: typeof txn.id,
        quoteType: typeof quote,
        quoteOutAmount: typeof quote.outAmount,
        quotePriceImpact: typeof quote.priceImpactPct
      });

      // Check for problematic values
      const problematicValues: string[] = [];
      if (typeof swapTx.lastValidBlockHeight === 'bigint') {
        problematicValues.push('lastValidBlockHeight is BigInt');
      }
      if (swapTx.lastValidBlockHeight === Infinity || swapTx.lastValidBlockHeight === -Infinity) {
        problematicValues.push('lastValidBlockHeight is Infinity');
      }
      if (Number.isNaN(swapTx.lastValidBlockHeight)) {
        problematicValues.push('lastValidBlockHeight is NaN');
      }
      if (problematicValues.length > 0) {
        logger.warn('SwapService detected problematic values:', problematicValues);
      }

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
