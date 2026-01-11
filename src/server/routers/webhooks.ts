/**
 * Webhook Router
 * CRUD operations for user webhook management
 * Plan: Phase 5 - Webhook System Implementation
 */
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import prisma from '../../lib/prisma';
import { ALL_WEBHOOK_EVENTS, WEBHOOK_CONFIG } from '../../../constants/webhookEvents';
import { TRPCError } from '@trpc/server';

/**
 * Webhook management router
 * Allows users to register, list, update, and delete webhooks
 */
export const webhookRouter = router({
    /**
     * Register a new webhook endpoint
     */
    register: protectedProcedure
        .input(
            z.object({
                url: z.string().url('Must be a valid URL'),
                events: z
                    .array(z.string())
                    .min(1, 'At least one event type required')
                    .refine(
                        (events) => events.every((e) => ALL_WEBHOOK_EVENTS.includes(e as typeof ALL_WEBHOOK_EVENTS[number])),
                        'Invalid event type'
                    ),
                secret: z
                    .string()
                    .min(
                        WEBHOOK_CONFIG.SECRET_MIN_LENGTH,
                        `Secret must be at least ${WEBHOOK_CONFIG.SECRET_MIN_LENGTH} characters`
                    ),
            })
        )
        .mutation(async ({ input, ctx }) => {
            if (!ctx.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }

            // Limit webhooks per user
            const existingCount = await prisma.webhook.count({
                where: { userId: ctx.user.id },
            });

            if (existingCount >= 10) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Maximum of 10 webhooks per user',
                });
            }

            // Check for duplicate URL
            const existing = await prisma.webhook.findFirst({
                where: {
                    userId: ctx.user.id,
                    url: input.url,
                },
            });

            if (existing) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'Webhook with this URL already exists',
                });
            }

            const webhook = await prisma.webhook.create({
                data: {
                    userId: ctx.user.id,
                    url: input.url,
                    events: input.events,
                    secret: input.secret,
                },
                select: {
                    id: true,
                    url: true,
                    events: true,
                    active: true,
                    createdAt: true,
                },
            });

            return { webhook };
        }),

    /**
     * List all webhooks for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.user) {
            throw new TRPCError({ code: 'UNAUTHORIZED' });
        }

        const webhooks = await prisma.webhook.findMany({
            where: { userId: ctx.user.id },
            select: {
                id: true,
                url: true,
                events: true,
                active: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: { deliveries: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            webhooks: webhooks.map((w: typeof webhooks[number]) => ({
                id: w.id,
                url: w.url,
                events: w.events,
                active: w.active,
                createdAt: w.createdAt,
                updatedAt: w.updatedAt,
                deliveryCount: w._count.deliveries,
            })),
        };
    }),

    /**
     * Get webhook details including recent deliveries
     */
    get: protectedProcedure
        .input(z.object({ webhookId: z.string() }))
        .query(async ({ input, ctx }) => {
            if (!ctx.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }

            const webhook = await prisma.webhook.findFirst({
                where: {
                    id: input.webhookId,
                    userId: ctx.user.id,
                },
                include: {
                    deliveries: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                        select: {
                            id: true,
                            event: true,
                            status: true,
                            responseCode: true,
                            error: true,
                            attempt: true,
                            createdAt: true,
                        },
                    },
                },
            });

            if (!webhook) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Webhook not found',
                });
            }

            return { webhook };
        }),

    /**
     * Update webhook settings
     */
    update: protectedProcedure
        .input(
            z.object({
                webhookId: z.string(),
                url: z.string().url().optional(),
                events: z
                    .array(z.string())
                    .min(1)
                    .refine(
                        (events) => events.every((e) => ALL_WEBHOOK_EVENTS.includes(e as typeof ALL_WEBHOOK_EVENTS[number])),
                        'Invalid event type'
                    )
                    .optional(),
                secret: z.string().min(WEBHOOK_CONFIG.SECRET_MIN_LENGTH).optional(),
                active: z.boolean().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            if (!ctx.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }

            const { webhookId, ...updateData } = input;

            // Verify ownership
            const existing = await prisma.webhook.findFirst({
                where: {
                    id: webhookId,
                    userId: ctx.user.id,
                },
            });

            if (!existing) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Webhook not found',
                });
            }

            const webhook = await prisma.webhook.update({
                where: { id: webhookId },
                data: updateData,
                select: {
                    id: true,
                    url: true,
                    events: true,
                    active: true,
                    updatedAt: true,
                },
            });

            return { webhook };
        }),

    /**
     * Delete a webhook
     */
    delete: protectedProcedure
        .input(z.object({ webhookId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (!ctx.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }

            // Verify ownership and delete
            const result = await prisma.webhook.deleteMany({
                where: {
                    id: input.webhookId,
                    userId: ctx.user.id,
                },
            });

            if (result.count === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Webhook not found',
                });
            }

            return { success: true };
        }),

    /**
     * Test a webhook by sending a test event
     */
    test: protectedProcedure
        .input(z.object({ webhookId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (!ctx.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }

            const webhook = await prisma.webhook.findFirst({
                where: {
                    id: input.webhookId,
                    userId: ctx.user.id,
                },
            });

            if (!webhook) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Webhook not found',
                });
            }

            // Import dynamically to avoid circular deps
            const { sendWebhookNotification } = await import(
                '../../lib/services/webhookDelivery'
            );

            // Send a test event
            await sendWebhookNotification(ctx.user.id, 'test.ping', {
                message: 'This is a test webhook from SoulWallet',
                webhookId: webhook.id,
                timestamp: new Date().toISOString(),
            });

            return { success: true, message: 'Test webhook queued for delivery' };
        }),

    /**
     * Get available webhook event types
     */
    eventTypes: protectedProcedure.query(() => {
        return {
            events: ALL_WEBHOOK_EVENTS,
        };
    }),
});

export default webhookRouter;
