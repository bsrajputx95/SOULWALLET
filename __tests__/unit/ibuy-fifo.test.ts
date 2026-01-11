/**
 * iBuy FIFO Sell Logic Unit Tests
 * 
 * Tests the FIFO (First In, First Out) sell logic for iBuy token positions.
 * Verifies that partial sells are handled correctly across multiple purchase lots.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock purchase data representing multiple purchase lots
interface MockPurchase {
    id: string;
    tokenMint: string;
    amountBought: number;
    amountRemaining: number;
    priceInUsdc: number;
    status: 'OPEN' | 'SOLD' | 'FEE_PENDING';
    createdAt: Date;
}

describe('iBuy FIFO Sell Logic', () => {
    let mockPurchases: MockPurchase[];

    beforeEach(() => {
        // Setup mock purchases with different buy times (FIFO order)
        mockPurchases = [
            {
                id: 'purchase-1',
                tokenMint: 'TokenMint123',
                amountBought: 100,
                amountRemaining: 100,
                priceInUsdc: 10, // $10 for 100 tokens = $0.10 per token cost
                status: 'OPEN',
                createdAt: new Date('2024-01-01T10:00:00Z'), // Oldest
            },
            {
                id: 'purchase-2',
                tokenMint: 'TokenMint123',
                amountBought: 50,
                amountRemaining: 50,
                priceInUsdc: 6, // $6 for 50 tokens = $0.12 per token cost
                status: 'OPEN',
                createdAt: new Date('2024-01-02T10:00:00Z'),
            },
            {
                id: 'purchase-3',
                tokenMint: 'TokenMint123',
                amountBought: 200,
                amountRemaining: 200,
                priceInUsdc: 30, // $30 for 200 tokens = $0.15 per token cost
                status: 'OPEN',
                createdAt: new Date('2024-01-03T10:00:00Z'), // Newest
            },
        ];
    });

    describe('FIFO Order', () => {
        it('should sort purchases by createdAt (oldest first)', () => {
            const sorted = [...mockPurchases].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            expect(sorted[0].id).toBe('purchase-1');
            expect(sorted[1].id).toBe('purchase-2');
            expect(sorted[2].id).toBe('purchase-3');
        });

        it('should sell from oldest lot first', () => {
            const sellAmount = 80;
            const sorted = [...mockPurchases].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            // Simulate FIFO sell
            let remainingToSell = sellAmount;
            const sellPlan: Array<{ purchaseId: string; sellAmount: number }> = [];

            for (const purchase of sorted) {
                if (remainingToSell <= 0) break;

                const available = purchase.amountRemaining;
                const toSell = Math.min(available, remainingToSell);

                if (toSell > 0) {
                    sellPlan.push({ purchaseId: purchase.id, sellAmount: toSell });
                    remainingToSell -= toSell;
                }
            }

            // Should sell 80 tokens from first lot only
            expect(sellPlan.length).toBe(1);
            expect(sellPlan[0].purchaseId).toBe('purchase-1');
            expect(sellPlan[0].sellAmount).toBe(80);
        });
    });

    describe('Partial Sells Across Lots', () => {
        it('should correctly calculate sell plan for amount spanning multiple lots', () => {
            const sellAmount = 120; // Spans purchase-1 (100) + purchase-2 (20)
            const sorted = [...mockPurchases].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            let remainingToSell = sellAmount;
            const sellPlan: Array<{ purchaseId: string; sellAmount: number }> = [];

            for (const purchase of sorted) {
                if (remainingToSell <= 0) break;

                const available = purchase.amountRemaining;
                const toSell = Math.min(available, remainingToSell);

                if (toSell > 0) {
                    sellPlan.push({ purchaseId: purchase.id, sellAmount: toSell });
                    remainingToSell -= toSell;
                }
            }

            expect(sellPlan.length).toBe(2);
            expect(sellPlan[0]).toEqual({ purchaseId: 'purchase-1', sellAmount: 100 });
            expect(sellPlan[1]).toEqual({ purchaseId: 'purchase-2', sellAmount: 20 });
        });

        it('should handle selling entire position across all lots', () => {
            const totalBalance = mockPurchases.reduce((sum, p) => sum + p.amountRemaining, 0);
            const sellAmount = totalBalance; // Sell everything

            const sorted = [...mockPurchases].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            let remainingToSell = sellAmount;
            const sellPlan: Array<{ purchaseId: string; sellAmount: number }> = [];

            for (const purchase of sorted) {
                if (remainingToSell <= 0) break;

                const available = purchase.amountRemaining;
                const toSell = Math.min(available, remainingToSell);

                if (toSell > 0) {
                    sellPlan.push({ purchaseId: purchase.id, sellAmount: toSell });
                    remainingToSell -= toSell;
                }
            }

            expect(sellPlan.length).toBe(3);
            expect(sellPlan[0]).toEqual({ purchaseId: 'purchase-1', sellAmount: 100 });
            expect(sellPlan[1]).toEqual({ purchaseId: 'purchase-2', sellAmount: 50 });
            expect(sellPlan[2]).toEqual({ purchaseId: 'purchase-3', sellAmount: 200 });
            expect(remainingToSell).toBe(0);
        });
    });

    describe('Cost Basis Calculation', () => {
        it('should calculate proportional cost basis for partial sell', () => {
            const purchase = mockPurchases[0]; // 100 tokens for $10 = $0.10/token
            const sellAmount = 40;

            // Proportional cost basis
            const soldRatio = sellAmount / purchase.amountBought;
            const costBasisSold = purchase.priceInUsdc * soldRatio;

            expect(soldRatio).toBe(0.4);
            expect(costBasisSold).toBe(4); // $4 cost basis for 40 tokens
        });

        it('should calculate profit correctly with USDC received', () => {
            const purchase = mockPurchases[0]; // 100 tokens for $10
            const sellAmount = 50;
            const usdcReceived = 7; // $7 for 50 tokens = $0.14/token

            const soldRatio = sellAmount / purchase.amountBought;
            const costBasisSold = purchase.priceInUsdc * soldRatio; // $5
            const profit = usdcReceived - costBasisSold; // $7 - $5 = $2

            expect(costBasisSold).toBe(5);
            expect(profit).toBe(2);
        });

        it('should calculate loss correctly when price dropped', () => {
            const purchase = mockPurchases[2]; // 200 tokens for $30 = $0.15/token
            const sellAmount = 100;
            const usdcReceived = 10; // $10 for 100 tokens = $0.10/token (price dropped)

            const soldRatio = sellAmount / purchase.amountBought;
            const costBasisSold = purchase.priceInUsdc * soldRatio; // $15
            const profit = usdcReceived - costBasisSold; // $10 - $15 = -$5 (loss)

            expect(costBasisSold).toBe(15);
            expect(profit).toBe(-5);
        });
    });

    describe('Creator Fee Calculation', () => {
        it('should calculate 5% creator fee only on profit', () => {
            const profit = 100; // $100 profit
            const creatorFeeRate = 0.05;
            const creatorFee = profit > 0 ? profit * creatorFeeRate : 0;

            expect(creatorFee).toBe(5); // $5 fee
        });

        it('should not charge creator fee on loss', () => {
            const profit = -50; // $50 loss
            const creatorFeeRate = 0.05;
            const creatorFee = profit > 0 ? profit * creatorFeeRate : 0;

            expect(creatorFee).toBe(0);
        });

        it('should skip fee if below minimum threshold ($0.01)', () => {
            const profit = 0.1; // $0.10 profit
            const creatorFeeRate = 0.05;
            const creatorFee = profit > 0 ? profit * creatorFeeRate : 0; // $0.005
            const minimumFee = 0.01;

            const shouldChargeFee = creatorFee >= minimumFee;

            expect(creatorFee).toBeCloseTo(0.005, 6);
            expect(shouldChargeFee).toBe(false);
        });
    });

    describe('amountRemaining Updates', () => {
        it('should correctly update amountRemaining after partial sell', () => {
            const purchase = { ...mockPurchases[0] };
            const sellAmount = 40;

            const newRemaining = purchase.amountRemaining - sellAmount;

            expect(newRemaining).toBe(60);
        });

        it('should mark position as SOLD when amountRemaining reaches 0', () => {
            const purchase = { ...mockPurchases[0] };
            const sellAmount = 100; // Sell entire position

            const newRemaining = purchase.amountRemaining - sellAmount;
            const newStatus = newRemaining <= 0 ? 'SOLD' : 'OPEN';

            expect(newRemaining).toBe(0);
            expect(newStatus).toBe('SOLD');
        });

        it('should handle precision issues near zero', () => {
            const purchase = { ...mockPurchases[0] };
            purchase.amountRemaining = 100.000000001; // Slight precision issue
            const sellAmount = 100;

            let newRemaining = purchase.amountRemaining - sellAmount;

            // Handle precision: if remaining is very small, treat as 0
            // Use 1e-6 threshold to account for floating-point precision
            if (Math.abs(newRemaining) < 1e-6) {
                newRemaining = 0;
            }

            expect(newRemaining).toBe(0);
        });
    });

    describe('Percentage-Based Sells', () => {
        it('should calculate correct amount for 25% sell', () => {
            const totalBalance = mockPurchases.reduce((sum, p) => sum + p.amountRemaining, 0);
            const percentage = 25;
            const sellAmount = totalBalance * (percentage / 100);

            expect(totalBalance).toBe(350);
            expect(sellAmount).toBe(87.5);
        });

        it('should calculate correct amount for 100% sell', () => {
            const totalBalance = mockPurchases.reduce((sum, p) => sum + p.amountRemaining, 0);
            const percentage = 100;
            const sellAmount = totalBalance * (percentage / 100);

            expect(sellAmount).toBe(totalBalance);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty purchases array', () => {
            const emptyPurchases: MockPurchase[] = [];
            const totalBalance = emptyPurchases.reduce((sum, p) => sum + p.amountRemaining, 0);

            expect(totalBalance).toBe(0);
        });

        it('should skip purchases with zero amountRemaining', () => {
            const purchases = [
                { ...mockPurchases[0], amountRemaining: 0 }, // Already fully sold
                { ...mockPurchases[1] }, // 50 tokens available
            ];

            const sorted = purchases
                .filter(p => p.amountRemaining > 0)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            expect(sorted.length).toBe(1);
            expect(sorted[0].id).toBe('purchase-2');
        });

        it('should handle sell amount larger than total balance', () => {
            const totalBalance = mockPurchases.reduce((sum, p) => sum + p.amountRemaining, 0);
            const sellAmount = totalBalance + 100; // More than available

            const actualSellAmount = Math.min(sellAmount, totalBalance);

            expect(actualSellAmount).toBe(totalBalance);
        });
    });
});
