import prisma from '../db';
import { checkOrderStatus, cancelLimitOrder } from '../services/jupiterLimitOrder';
import { cleanExpiredQueue } from '../services/copyEngine';

/**
 * Monitor trader exits and create sell queue entries
 * Runs every minute
 */
export async function monitorTraderExits(): Promise<void> {
    try {
        // Find open positions where config has exitWithTrader = true
        const positions = await prisma.copyPosition.findMany({
            where: {
                status: 'open'
            },
            include: {
                config: true
            }
        });

        // Filter positions where exitWithTrader is enabled
        const positionsToCheck = positions.filter(p => p.config.exitWithTrader);

        for (const position of positionsToCheck) {
            // Check if trader has sold this token recently (last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            const traderExit = await prisma.traderActivity.findFirst({
                where: {
                    traderAddress: position.config.traderAddress,
                    swapType: 'sell',
                    outputMint: position.inputMint, // Trader receives stable/SOL (selling the token we copied)
                    timestamp: { gte: fiveMinutesAgo }
                }
            });

            if (!traderExit) continue;

            console.log(`Trader ${position.config.traderAddress} exited ${position.inputSymbol}, creating sell queue for user ${position.userId}`);

            // Cancel SL/TP orders first
            const cancelTransactions = [];
            if (position.slOrderId) {
                const cancelTx = await cancelLimitOrder(position.slOrderId);
                if (cancelTx) cancelTransactions.push({ orderId: position.slOrderId, transaction: cancelTx });
            }
            if (position.tpOrderId) {
                const cancelTx = await cancelLimitOrder(position.tpOrderId);
                if (cancelTx) cancelTransactions.push({ orderId: position.tpOrderId, transaction: cancelTx });
            }

            // Create a sell queue entry for the user to execute
            // This represents the exit trade that mirrors the trader's exit
            // Include positionId to ensure uniqueness per position
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            
            try {
                await prisma.copyTradeQueue.create({
                    data: {
                        configId: position.configId,
                        userId: position.userId,
                        positionId: position.id,    // Unique per position
                        traderTxSignature: traderExit.txSignature,
                        traderAddress: position.config.traderAddress,
                        inputMint: position.outputMint,    // We receive back what we spent (USDC/SOL)
                        inputSymbol: position.outputSymbol,
                        outputMint: position.inputMint,    // We sell what we bought
                        outputSymbol: position.inputSymbol,
                        inputAmount: position.entryAmount, // Approximate amount we'd receive
                        outputAmount: position.tokenAmount, // Amount to sell
                        entryPrice: position.entryPrice,
                        slPrice: null, // No SL/TP for exit trades
                        tpPrice: null,
                        status: 'pending',
                        expiresAt
                    }
                });

                // Only mark position as pending exit after successful queue insert
                await prisma.copyPosition.update({
                    where: { id: position.id },
                    data: { 
                        status: 'pending_exit',
                    }
                });

                console.log(`Created exit queue item for position ${position.id}`);
            } catch (error: any) {
                // Check if it's a unique constraint violation (already queued)
                if (error.code === 'P2002') {
                    console.log(`Exit queue item already exists for position ${position.id}`);
                } else {
                    console.error(`Failed to create exit queue for position ${position.id}:`, error);
                }
            }

            // TODO: Send push notification to user about exit opportunity
            console.log(`Created sell queue entry for position ${position.id}, cancel transactions:`, cancelTransactions);
        }
    } catch (error) {
        console.error('Monitor trader exits error:', error);
    }
}

/**
 * Monitor SL/TP limit orders and update position status
 * When SL/TP hits, we need to cancel the other order and mark position
 * The actual sell happens via the limit order on-chain
 */
export async function monitorLimitOrders(): Promise<void> {
    try {
        // Find open positions with SL or TP orders
        const positions = await prisma.copyPosition.findMany({
            where: {
                status: 'open',
                OR: [
                    { slOrderId: { not: null } },
                    { tpOrderId: { not: null } }
                ]
            }
        });

        for (const position of positions) {
            // Check SL order
            if (position.slOrderId) {
                const slStatus = await checkOrderStatus(position.slOrderId);
                
                if (slStatus?.status === 'completed') {
                    console.log(`SL hit for position ${position.id}`);
                    
                    // Cancel TP order if exists
                    if (position.tpOrderId) {
                        await cancelLimitOrder(position.tpOrderId);
                    }

                    // Update position - the sell already happened via limit order
                    await prisma.copyPosition.update({
                        where: { id: position.id },
                        data: { 
                            status: 'sl_hit',
                            closedAt: new Date()
                        }
                    });
                    continue;
                }
            }

            // Check TP order
            if (position.tpOrderId) {
                const tpStatus = await checkOrderStatus(position.tpOrderId);
                
                if (tpStatus?.status === 'completed') {
                    console.log(`TP hit for position ${position.id}`);
                    
                    // Cancel SL order if exists
                    if (position.slOrderId) {
                        await cancelLimitOrder(position.slOrderId);
                    }

                    // Update position - the sell already happened via limit order
                    await prisma.copyPosition.update({
                        where: { id: position.id },
                        data: { 
                            status: 'tp_hit',
                            closedAt: new Date()
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('Monitor limit orders error:', error);
    }
}

/**
 * Clean expired queue items
 */
export async function cleanExpiredQueueItems(): Promise<void> {
    try {
        const count = await cleanExpiredQueue();
        if (count > 0) {
            console.log(`Cleaned ${count} expired queue items`);
        }
    } catch (error) {
        console.error('Clean expired queue error:', error);
    }
}
