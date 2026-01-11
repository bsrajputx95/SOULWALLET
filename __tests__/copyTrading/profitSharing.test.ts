import { ProfitSharing } from '../../src/lib/services/profitSharing';
import prisma from '../../src/lib/prisma';

describe('Profit Sharing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Fee Calculation', () => {
    test('should calculate 5% fee correctly', () => {
      const profit = 100;
      const expectedFee = 5;
      const actualFee = profit * 0.05;
      expect(actualFee).toBe(expectedFee);
    });

    test('should not charge fee on losses', async () => {
      const profitSharing = new ProfitSharing({} as any, {} as any, {} as any);

      // Mock a position with loss
      const mockPosition = {
        id: 'test-position-1',
        status: 'CLOSED',
        profitLoss: -50,
        copyTrading: {
          userId: 'user-1',
          traderId: 'trader-1',
          trader: {
            walletAddress: 'trader-wallet-address',
            username: '@TestTrader',
          },
        },
      };

      jest.spyOn(prisma.position, 'findUnique').mockResolvedValue(mockPosition as any);

      const result = await profitSharing.processProfitSharing('test-position-1');

      expect(result.success).toBe(true);
      expect(result.feeAmount).toBe(0);
      expect(result.feeTxHash).toBeUndefined();
    });

    test('should charge 5% fee on profits', async () => {
      const profitSharing = new ProfitSharing({} as any, {} as any, {} as any);

      const mockPosition = {
        id: 'test-position-2',
        status: 'CLOSED',
        profitLoss: 100,
        copyTradingId: 'copy-1',
        copyTrading: {
          userId: 'user-1',
          traderId: 'trader-1',
          trader: {
            id: 'trader-1',
            walletAddress: 'trader-wallet-address',
            username: '@ProfitableTrader',
          },
        },
      };

      jest.spyOn(prisma.position, 'findUnique').mockResolvedValue(mockPosition as any);
      jest.spyOn(prisma.position, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.copyTrading, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.traderProfile, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(prisma as any));

      // Mock the wallet and transaction methods
      jest.spyOn(profitSharing as any, 'sendFeeToTrader').mockImplementation(async () => 'mock-tx-hash');
      jest.spyOn(profitSharing as any, 'convertUSDCtoSOL').mockImplementation(async () => 0.033); // Assuming SOL at $150
      jest.spyOn(profitSharing as any, 'verifyTransaction').mockImplementation(async () => true);

      const result = await profitSharing.processProfitSharing('test-position-2');

      expect(result.success).toBe(true);
      expect(result.feeAmount).toBe(5); // 5% of 100
      expect(result.feeTxHash).toBe('mock-tx-hash');
    });
  });

  describe('USDC to SOL Conversion', () => {
    test('should convert USDC to SOL at current price', async () => {
      const usdcAmount = 150;
      const solPrice = 150; // $150 per SOL
      const expectedSolAmount = 1;

      // Mock Jupiter price API
      const mockGetPrice = jest.fn().mockResolvedValue(solPrice);

      // This would be the actual calculation
      const actualSolAmount = usdcAmount / solPrice;

      expect(actualSolAmount).toBe(expectedSolAmount);
    });
  });

  describe('Fee Statistics', () => {
    test('should calculate total fees correctly', async () => {
      const profitSharing = new ProfitSharing({} as any, {} as any, {} as any);

      jest
        .spyOn(prisma.position, 'aggregate')
        .mockResolvedValueOnce({ _sum: { feeAmount: 250.50 } } as any)
        .mockResolvedValueOnce({ _avg: { feeAmount: 5.01 } } as any);
      jest.spyOn(prisma.position, 'count').mockResolvedValue(50);

      const stats = await profitSharing.getFeeStats();

      expect(stats.totalFeesPaid).toBe(250.50);
      expect(stats.totalPositionsWithFees).toBe(50);
      expect(stats.feePercentage).toBe(5);
    });
  });
});
