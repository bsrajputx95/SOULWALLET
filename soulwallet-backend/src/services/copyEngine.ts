import prisma from '../db';
import { getTokenPrice, getTokenPrices } from './priceService';
import { calculateSLTPPrices } from './jupiterLimitOrder';

interface QueueCopyTradeParams {
    userId: string;
    configId: string;
    traderAddress: string;
    traderTxSignature: string;
    inputMint: string;      // Token being bought
    inputSymbol: string;
    outputMint: string;     // Token used to buy (e.g., USDC, SOL)
    outputSymbol: string;
    inputAmount: number;    // Amount of tokens bought
    outputAmount: number;   // Amount spent
}

/**
 * Queue a copy trade for user execution
 * Validates budget, calculates SL/TP, creates queue item
 */
export async function queueCopyTrade(params: QueueCopyTradeParams): Promise<boolean> {
    try {
        // Get config with current positions
        const config = await prisma.copyTradingConfig.findUnique({
            where: { id: params.configId },
            include: {
                positions: {
                    where: { status: 'open' }
                }
            }
        });

        if (!config || !config.isActive) {
            console.log(`Config ${params.configId} not found or inactive`);
            return false;
        }

        // Check budget: open positions * perTradeAmount <= totalInvestment
        const usedBudget = config.positions.length * config.perTradeAmount;
        const availableBudget = config.totalInvestment - usedBudget;

        if (availableBudget < config.perTradeAmount) {
            console.log(`Budget exceeded for user ${params.userId}: used ${usedBudget}/${config.totalInvestment}`);
            return false;
        }

        // Check if this trade was already queued (duplicate check)
        const existingQueue = await prisma.copyTradeQueue.findUnique({
            where: { traderTxSignature: params.traderTxSignature }
        });

        if (existingQueue) {
            console.log(`Trade ${params.traderTxSignature} already queued`);
            return false;
        }

        // Get current prices for both tokens
        const prices = await getTokenPrices([params.inputMint, params.outputMint]);
        const inputPrice = prices[params.inputMint] || 0;
        const outputPrice = prices[params.outputMint] || 0;

        // Calculate entry price in USDC terms
        // If buying token X with USDC, entry price = USDC amount / token amount
        let entryPrice = 0;
        if (params.inputAmount > 0) {
            const outputValueUsd = params.outputAmount * outputPrice;
            entryPrice = outputValueUsd / params.inputAmount;
        }

        // Calculate SL/TP prices
        const { slPrice, tpPrice } = calculateSLTPPrices(
            entryPrice,
            config.stopLossPercent,
            config.takeProfitPercent
        );

        // Create queue item with 5-minute expiry
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await prisma.copyTradeQueue.create({
            data: {
                configId: params.configId,
                userId: params.userId,
                traderTxSignature: params.traderTxSignature,
                traderAddress: params.traderAddress,
                inputMint: params.inputMint,
                inputSymbol: params.inputSymbol,
                outputMint: params.outputMint,
                outputSymbol: params.outputSymbol,
                inputAmount: params.inputAmount,
                entryPrice,
                slPrice,
                tpPrice,
                status: 'pending',
                expiresAt
            }
        });

        console.log(`Queued copy trade for user ${params.userId}: ${params.inputSymbol} at $${entryPrice}`);
        return true;

    } catch (error) {
        console.error('Failed to queue copy trade:', error);
        return false;
    }
}

/**
 * Check if user has enough budget for another copy trade
 */
export async function checkBudget(configId: string): Promise<{ available: number; total: number; used: number }> {
    try {
        const config = await prisma.copyTradingConfig.findUnique({
            where: { id: configId },
            include: {
                positions: {
                    where: { status: 'open' }
                }
            }
        });

        if (!config) {
            return { available: 0, total: 0, used: 0 };
        }

        const used = config.positions.length * config.perTradeAmount;
        const available = config.totalInvestment - used;

        return { available, total: config.totalInvestment, used };
    } catch (error) {
        console.error('Failed to check budget:', error);
        return { available: 0, total: 0, used: 0 };
    }
}

/**
 * Mark queue item as completed and create position
 */
export async function markTradeExecuted(
    queueId: string,
    slOrderId?: string,
    tpOrderId?: string
): Promise<boolean> {
    try {
        const queueItem = await prisma.copyTradeQueue.findUnique({
            where: { id: queueId }
        });

        if (!queueItem || queueItem.status !== 'pending') {
            return false;
        }

        // Update queue status
        await prisma.copyTradeQueue.update({
            where: { id: queueId },
            data: { status: 'completed' }
        });

        // Create position record
        await prisma.copyPosition.create({
            data: {
                configId: queueItem.configId,
                userId: queueItem.userId,
                traderTxSignature: queueItem.traderTxSignature,
                inputMint: queueItem.inputMint,
                inputSymbol: queueItem.inputSymbol,
                outputMint: queueItem.outputMint,
                outputSymbol: queueItem.outputSymbol,
                entryAmount: queueItem.inputAmount,
                entryPrice: queueItem.entryPrice,
                tokenAmount: queueItem.inputAmount,
                slPrice: queueItem.slPrice,
                tpPrice: queueItem.tpPrice,
                slOrderId,
                tpOrderId,
                status: 'open'
            }
        });

        return true;
    } catch (error) {
        console.error('Failed to mark trade executed:', error);
        return false;
    }
}

/**
 * Get pending queue items for a user
 */
export async function getPendingQueueItems(userId: string) {
    const now = new Date();
    
    return await prisma.copyTradeQueue.findMany({
        where: {
            userId,
            status: 'pending',
            expiresAt: { gt: now }
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Clean expired queue items
 */
export async function cleanExpiredQueue(): Promise<number> {
    try {
        const result = await prisma.copyTradeQueue.updateMany({
            where: {
                status: 'pending',
                expiresAt: { lt: new Date() }
            },
            data: { status: 'expired' }
        });

        if (result.count > 0) {
            console.log(`Cleaned ${result.count} expired queue items`);
        }

        return result.count;
    } catch (error) {
        console.error('Failed to clean expired queue:', error);
        return 0;
    }
}
