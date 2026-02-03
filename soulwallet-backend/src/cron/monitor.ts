import prisma from '../db';
import { checkOrderStatus, cancelLimitOrder } from '../services/jupiterLimitOrder';
import { cleanExpiredQueue } from '../services/copyEngine';

/**
 * Monitor trader exits and queue sell transactions
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
                    inputMint: position.inputMint, // Trader is selling what we bought
                    timestamp: { gte: fiveMinutesAgo }
                }
            });

            if (!traderExit) continue;

            console.log(`Trader ${position.config.traderAddress} exited ${position.inputSymbol}, queuing sell for user ${position.userId}`);

            // Cancel SL/TP orders
            if (position.slOrderId) await cancelLimitOrder(position.slOrderId);
            if (position.tpOrderId) await cancelLimitOrder(position.tpOrderId);

            // Create queue item for sell (in a real implementation, you'd create a sell queue)
            // For now, mark position as pending close
            await prisma.copyPosition.update({
                where: { id: position.id },
                data: { 
                    status: 'closed',
                    closedAt: new Date()
                }
            });

            // TODO: Send push notification to user
        }
    } catch (error) {
        console.error('Monitor trader exits error:', error);
    }
}

/**
 * Monitor SL/TP limit orders and update position status
 * Runs every minute
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

                    // Update position
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

                    // Update position
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
 * Runs every minute
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
