import { z } from 'zod'

export const BirdeyePnLSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      total_pnl_usd: z.number().finite().default(0),
      total_realized_profit_usd: z.number().finite().default(0),
      total_unrealized_profit_usd: z.number().finite().default(0),
      roi_percentage: z.number().finite().min(-100).max(10000).default(0),
      total_trades: z.number().int().nonnegative().default(0),
    })
    .optional(),
}).strict()

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

export const BirdeyeTokenSchema = z
  .object({
    address: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    symbol: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    decimals: z.number().int().min(0).max(18),
    logoURI: z.string().url().optional(),
  })
  .strict()