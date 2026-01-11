import { z } from 'zod'
import { ApiKeyScope } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { ApiKeyService } from '../../lib/services/apiKey'

export const apiKeyRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        scope: z.nativeEnum(ApiKeyScope).default(ApiKeyScope.READ_ONLY),
        permissions: z.any().optional(),
        ipWhitelist: z.array(z.string().min(1)).max(50).optional(),
        expiresAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
      const { key, keyPrefix, apiKeyId } = await ApiKeyService.createApiKey({
        userId: ctx.user.id,
        name: input.name,
        scope: input.scope,
        permissions: input.permissions,
        ipWhitelist: input.ipWhitelist,
        expiresAt,
      })
      return { success: true, apiKeyId, keyPrefix, key }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await ApiKeyService.listApiKeys(ctx.user.id)
    return { success: true, keys }
  }),

  revoke: protectedProcedure
    .input(z.object({ keyPrefix: z.string().min(6).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await ApiKeyService.revokeApiKey({ userId: ctx.user.id, keyPrefix: input.keyPrefix })
      return { success: true }
    }),
})

