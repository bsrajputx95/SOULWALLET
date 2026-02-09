import prisma from '../db';

/**
 * Distribute creator revenues to their wallets
 * This is a batch job that runs periodically (e.g., daily)
 * For beta: logs payouts only (manual payout)
 * For production: would execute SOL transfers
 */
export async function distributeCreatorRevenues(): Promise<void> {
    try {
        // Get all unpaid creator revenues (grouped by creator)
        const unpaidRevenues = await prisma.creatorRevenue.findMany({
            where: {
                // In future, add paidAt: null filter when we track payouts
            },
            include: {
                creator: {
                    include: {
                        wallet: true
                    }
                }
            }
        });

        // Group by creator
        const groupedByCreator = unpaidRevenues.reduce((acc, revenue) => {
            const creatorId = revenue.creatorId;
            if (!acc[creatorId]) {
                acc[creatorId] = {
                    creator: revenue.creator,
                    totalAmount: 0,
                    revenues: []
                };
            }
            acc[creatorId].totalAmount += revenue.amount;
            acc[creatorId].revenues.push(revenue);
            return acc;
        }, {} as Record<string, {
            creator: typeof unpaidRevenues[0]['creator'];
            totalAmount: number;
            revenues: typeof unpaidRevenues;
        }>);

        // Process each creator
        for (const [creatorId, data] of Object.entries(groupedByCreator)) {
            const { creator, totalAmount, revenues } = data;

            // Skip if no wallet or amount too small
            if (!creator.wallet?.publicKey) {
                console.log(`[RevenueDistribution] Creator ${creatorId} has no wallet, skipping`);
                continue;
            }

            if (totalAmount < 0.01) {
                console.log(`[RevenueDistribution] Creator ${creatorId} amount ${totalAmount} SOL too small, skipping`);
                continue;
            }

            // For beta: log only (manual payout)
            // In production: execute SOL transfer here
            console.log(`[RevenueDistribution] Would pay ${totalAmount.toFixed(6)} SOL to ${creator.wallet.publicKey} (${revenues.length} revenues)`);

            // TODO: In production:
            // 1. Create and sign SOL transfer transaction
            // 2. Send transaction
            // 3. Mark revenues as paid (add paidAt timestamp)
        }

        console.log(`[RevenueDistribution] Processed ${unpaidRevenues.length} unpaid revenues for ${Object.keys(groupedByCreator).length} creators`);
    } catch (error) {
        console.error('[RevenueDistribution] Error:', error);
    }
}
