import { z } from 'zod'

export const BirdeyePnLSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      // Birdeye actual field names from their API
      total_usd: z.number().finite().default(0), // Total PnL in USD
      realized_profit_usd: z.number().finite().default(0), // Realized profit USD
      unrealized_usd: z.number().finite().default(0), // Unrealized profit USD
      total_percent: z.number().finite().default(0), // ROI percentage (this is the key field!)
      realized_profit_percent: z.number().finite().default(0), // Realized profit %
      unrealized_percent: z.number().finite().default(0), // Unrealized profit %
      counts: z.object({
        total_trade: z.number().int().nonnegative().default(0),
      }).optional(),
    })
    .optional(),
}).passthrough() // Allow extra fields from API


export const JupiterPriceSchema = z
  .object({
    data: z.record(
      z.string(),
      z.object({
        price: z.number().positive().finite(),
      })
    ),
  })
  .strict()

export const BirdeyePriceSchema = z
  .object({
    success: z.boolean().optional(),
    data: z
      .object({
        value: z.number().finite().nonnegative().optional(),
        price: z.number().finite().nonnegative().optional(),
      })
      .optional(),
  })
  .passthrough()

export const BirdeyeTokenSchema = z
  .object({
    address: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    symbol: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    decimals: z.number().int().min(0).max(18),
    logoURI: z.string().url().optional(),
  })
  .strict()
