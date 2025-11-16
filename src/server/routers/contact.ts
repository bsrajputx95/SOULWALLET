import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { 
  sanitizeText, 
  isValidSolanaAddress, 
  solanaAddressSchema 
} from '../../lib/validation';

export const contactRouter = router({
  /**
   * Create a new contact
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string()
        .min(1, 'Name is required')
        .max(50, 'Name too long')
        .transform(sanitizeText),
      address: solanaAddressSchema,
      notes: z.string()
        .max(200, 'Notes too long')
        .optional()
        .transform(val => val ? sanitizeText(val) : val),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Additional validation for Solana address
        if (!isValidSolanaAddress(input.address)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid Solana address format',
          });
        }

        // Check if contact already exists for this user
        const existingContact = await prisma.contact.findFirst({
          where: {
            userId: ctx.user.id,
            address: input.address,
          },
        });

        if (existingContact) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Contact with this address already exists',
          });
        }

        // Create the contact
        const contact = await prisma.contact.create({
          data: {
            userId: ctx.user.id,
            name: input.name,
            address: input.address,
            notes: input.notes || null,
          },
        });

        return {
          success: true,
          contact,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Create contact error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create contact',
        });
      }
    }),

  /**
   * Get all contacts for the user
   */
  list: protectedProcedure
    .input(z.object({
      search: z.string()
        .optional()
        .transform(val => val ? sanitizeText(val) : val),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const where: any = {
          userId: ctx.user.id,
        };

        if (input.search) {
          where.OR = [
            { name: { contains: input.search, mode: 'insensitive' } },
            { address: { contains: input.search } },
            { notes: { contains: input.search, mode: 'insensitive' } },
          ];
        }

        const contacts = await prisma.contact.findMany({
          where,
          orderBy: { name: 'asc' },
        });

        return { contacts };
      } catch (error) {
        logger.error('List contacts error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get contacts',
        });
      }
    }),

  /**
   * Update a contact
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string()
        .min(1, 'Name is required')
        .max(50, 'Name too long')
        .optional()
        .transform(val => val ? sanitizeText(val) : val),
      notes: z.string()
        .max(200, 'Notes too long')
        .optional()
        .transform(val => val ? sanitizeText(val) : val),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify the contact belongs to the user
        const existingContact = await prisma.contact.findFirst({
          where: {
            id: input.id,
            userId: ctx.user.id,
          },
        });

        if (!existingContact) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Contact not found',
          });
        }

        // Update the contact
        const contact = await prisma.contact.update({
          where: { id: input.id },
          data: {
            ...(input.name && { name: input.name }),
            ...(input.notes !== undefined && { notes: input.notes }),
          },
        });

        return {
          success: true,
          contact,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Update contact error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update contact',
        });
      }
    }),

  /**
   * Delete a contact
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify the contact belongs to the user and delete it
        const deletedContact = await prisma.contact.deleteMany({
          where: {
            id: input.id,
            userId: ctx.user.id,
          },
        });

        if (deletedContact.count === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Contact not found',
          });
        }

        return {
          success: true,
          message: 'Contact deleted successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Delete contact error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete contact',
        });
      }
    }),

  /**
   * Get a single contact by ID
   */
  getById: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const contact = await prisma.contact.findFirst({
          where: {
            id: input.id,
            userId: ctx.user.id,
          },
        });

        if (!contact) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Contact not found',
          });
        }

        return { contact };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error('Get contact by ID error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get contact',
        });
      }
    }),

  /**
   * Get frequently used contacts (based on transaction history)
   */
  getFrequentlyUsed: protectedProcedure
    .input(z.object({
      limit: z.number().max(20).default(5),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Get addresses that the user has sent to most frequently
        const frequentAddresses = await prisma.transaction.groupBy({
          by: ['to'],
          where: {
            userId: ctx.user.id,
            type: 'SEND',
          },
          _count: {
            to: true,
          },
          orderBy: {
            _count: {
              to: 'desc',
            },
          },
          take: input.limit,
        });

        // Get contact details for these addresses
        const contacts = await prisma.contact.findMany({
          where: {
            userId: ctx.user.id,
            address: {
              in: frequentAddresses.map(addr => addr.to),
            },
          },
        });

        // Combine with frequency data
        const frequentContacts = frequentAddresses.map(addr => {
          const contact = contacts.find(c => c.address === addr.to);
          return {
            address: addr.to,
            frequency: addr._count.to,
            contact,
          };
        });

        return { frequentContacts };
      } catch (error) {
        logger.error('Get frequently used contacts error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get frequently used contacts',
        });
      }
    }),
});