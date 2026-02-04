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

        // Check if this trade was already queued for this user (duplicate check)
        const existingQueue = await prisma.copyTradeQueue.findFirst({
            where: { 
                userId: params.userId,
                traderTxSignature: params.traderTxSignature
            }
        });

        if (existingQueue) {
            console.log(`Trade ${params.traderTxSignature} already queued for user ${params.userId}`);
            return false;
        }

        // Count pending queue items for budget calculation
        const pendingQueueCount = await prisma.copyTradeQueue.count({
            where: {
                userId: params.userId,
                status: 'pending',
                expiresAt: { gt: new Date() }
            }
        });

        // Check budget: (open positions + pending queue) * perTradeAmount <= totalInvestment
        const usedBudget = (config.positions.length + pendingQueueCount) * config.perTradeAmount;
        const availableBudget = config.totalInvestment - usedBudget;

        // Cap the output amount to available budget
        const cappedOutputAmount = Math.min(params.outputAmount, availableBudget);
        
        if (cappedOutputAmount <= 0) {
            console.log(`Budget exceeded for user ${params.userId}: used ${usedBudget}/${config.totalInvestment}`);
            return false;
        }

        // Adjust input amount proportionally if we capped the output
        let adjustedInputAmount = params.inputAmount;
        if (cappedOutputAmount < params.outputAmount && params.outputAmount > 0) {
            const ratio = cappedOutputAmount / params.outputAmount;
            adjustedInputAmount = params.inputAmount * ratio;
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
                type: 'entry',  // Mark as entry trade (buy flow)
                inputMint: params.inputMint,
                inputSymbol: params.inputSymbol,
                outputMint: params.outputMint,
                outputSymbol: params.outputSymbol,
                inputAmount: adjustedInputAmount,   // Adjusted proportional amount
                outputAmount: cappedOutputAmount,   // Capped to budget/perTradeAmount
                entryPrice,
                slPrice,
                tpPrice,
                status: 'pending',
                expiresAt
            }
        });

        console.log(`Queued copy trade for user ${params.userId}: ${params.inputSymbol} at $${entryPrice}, spend: ${cappedOutputAmount}`);
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

interface ExecutedTradeData {
    actualInputAmount?: number;  // Actual amount spent (for buy) or sold (for sell)
    actualOutputAmount?: number; // Actual amount received
    actualEntryPrice?: number;   // Actual executed price
}

/**
 * Mark queue item as completed and create/update position
 * For entry trades: creates a new position
 * For exit trades: updates existing position status to closed
 */
export async function markTradeExecuted(
    queueId: string,
    slOrderId?: string,
    tpOrderId?: string,
    executedData?: ExecutedTradeData
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

        // Use actual executed amounts if provided, otherwise fall back to queued estimates
        const entryAmount = executedData?.actualInputAmount ?? queueItem.outputAmount;
        const tokenAmount = executedData?.actualOutputAmount ?? queueItem.inputAmount;
        const entryPrice = executedData?.actualEntryPrice ?? queueItem.entryPrice;

        if (queueItem.type === 'exit') {
            // For exit trades: update the existing position to closed
            if (!queueItem.positionId) {
                console.error('Exit trade queue item missing positionId:', queueId);
                return false;
            }

            await prisma.copyPosition.update({
                where: { id: queueItem.positionId },
                data: {
                    status: 'closed',
                    closedAt: new Date()
                }
            });
        } else {
            // For entry trades: create a new position
            // entryAmount = what we spent (outputAmount)
            // tokenAmount = what we received (inputAmount)
            await prisma.copyPosition.create({
                data: {
                    configId: queueItem.configId,
                    userId: queueItem.userId,
                    traderTxSignature: queueItem.traderTxSignature,
                    inputMint: queueItem.inputMint,
                    inputSymbol: queueItem.inputSymbol,
                    outputMint: queueItem.outputMint,
                    outputSymbol: queueItem.outputSymbol,
                    entryAmount: entryAmount,  // Actual amount spent
                    tokenAmount: tokenAmount,  // Actual amount received
                    entryPrice: entryPrice,    // Actual executed price
                    slPrice: queueItem.slPrice,
                    tpPrice: queueItem.tpPrice,
                    slOrderId,
                    tpOrderId,
                    status: 'open'
                }
            });
        }

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
