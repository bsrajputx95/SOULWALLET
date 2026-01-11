/**
 * JSON Schema Validation for UserSettings
 * Plan2 Step 5: Validate all JSON metadata fields to prevent malicious data storage
 */

import { z } from 'zod';
import { VALIDATION_LIMITS, validateDateOfBirth, validatePhoneNumber } from '../validation';

/**
 * Notifications settings schema
 */
export const notificationsSchema = z.object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    transactions: z.boolean().optional(),
    marketing: z.boolean().optional(),
    social: z.boolean().optional(),
}).strict();

/**
 * Privacy settings schema
 */
export const privacySchema = z.object({
    showBalance: z.boolean().optional(),
    showTransactions: z.boolean().optional(),
    showPortfolio: z.boolean().optional(),
    showActivity: z.boolean().optional(),
}).strict();

/**
 * Security settings schema
 */
export const securitySchema = z.object({
    twoFactorEnabled: z.boolean().optional(),
    biometricEnabled: z.boolean().optional(),
    totpSecret: z.string().optional(),
    totpEnabled: z.boolean().optional(),
    totpEnabledAt: z.string().optional(),
    backupCodes: z.array(z.string()).optional(),
    backupCodesGeneratedAt: z.string().optional(),
    passwordChangedAt: z.string().optional(),
    recoveryEmail: z.string().email().optional(),
    pendingTotpSecret: z.string().optional(),
    pendingBackupCodes: z.array(z.string()).optional(),
}).strict();

/**
 * Preferences settings schema
 */
export const preferencesSchema = z.object({
    currency: z.string().max(10).optional(),
    language: z.string().max(10).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    phone: z.string().max(20).optional().refine((val) => {
        if (!val) return true;
        return validatePhoneNumber(val).isValid;
    }, { message: 'Invalid phone number format' }),
    dateOfBirth: z.string().optional().refine((val) => {
        return validateDateOfBirth(val).isValid;
    }, { message: 'Invalid date of birth (must be 13+ years old)' }),
    walletBackedUp: z.boolean().optional(),
}).strict();

/**
 * Complete UserSettings schema
 */
export const userSettingsSchema = z.object({
    notifications: notificationsSchema.optional(),
    privacy: privacySchema.optional(),
    security: securitySchema.optional(),
    preferences: preferencesSchema.optional(),
});

/**
 * Post images validation schema
 */
export const postImagesSchema = z.array(
    z.string().url('Each image must be a valid URL')
).max(VALIDATION_LIMITS.IMAGES_PER_POST_MAX, `Maximum ${VALIDATION_LIMITS.IMAGES_PER_POST_MAX} images allowed`);

/**
 * Transaction metadata schema
 */
export const transactionMetadataSchema = z.object({
    type: z.enum(['send', 'receive', 'swap', 'stake', 'unstake']).optional(),
    tokenSymbol: z.string().max(20).optional(),
    tokenName: z.string().max(100).optional(),
    tokenMint: z.string().optional(),
    memo: z.string().max(200).optional(),
    fee: z.number().optional(),
    slippage: z.number().min(0).max(100).optional(),
}).strict();

/**
 * Validate and parse user settings safely
 * @param data Raw settings data
 * @returns Validated settings or throws ZodError
 */
export function validateUserSettings(data: unknown) {
    return userSettingsSchema.parse(data);
}

/**
 * Safe validation that returns result object
 * @param data Raw settings data
 * @returns SafeParseResult with success flag and data or error
 */
export function safeValidateUserSettings(data: unknown) {
    return userSettingsSchema.safeParse(data);
}

// Export types
export type NotificationsSettings = z.infer<typeof notificationsSchema>;
export type PrivacySettings = z.infer<typeof privacySchema>;
export type SecuritySettings = z.infer<typeof securitySchema>;
export type PreferencesSettings = z.infer<typeof preferencesSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;
export type TransactionMetadata = z.infer<typeof transactionMetadataSchema>;
