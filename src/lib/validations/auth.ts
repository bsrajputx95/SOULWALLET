import { z } from 'zod';

// Base email validation
const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(255, 'Email must be less than 255 characters');

// Base password validation
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one special character'
  );

// Username validation
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  );

// OTP validation
const otpSchema = z
  .string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only numbers');

// Signup validation schema
export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  captchaToken: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Login validation schema
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().optional(),
});

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().optional(),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Verify OTP schema
export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

// Change password schema (for authenticated users)
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// JWT token validation
export const tokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Session validation
export const sessionSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  sessionId: z.string().uuid('Invalid session ID'),
});

// Refresh token validation schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Unlock account validation schema
export const unlockAccountSchema = z.object({
  email: emailSchema,
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Session activity filter schema
export const sessionActivityFilterSchema = paginationSchema.extend({
  suspiciousOnly: z.boolean().optional(),
  action: z.string().optional(),
});

// Login history filter schema
export const loginHistoryFilterSchema = paginationSchema.extend({
  successfulOnly: z.boolean().optional(),
  ipAddress: z.string().optional(),
});

// Session management schema
export const sessionManagementSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

// Type exports for TypeScript
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type UnlockAccountInput = z.infer<typeof unlockAccountSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SessionActivityFilterInput = z.infer<typeof sessionActivityFilterSchema>;
export type LoginHistoryFilterInput = z.infer<typeof loginHistoryFilterSchema>;
export type SessionManagementInput = z.infer<typeof sessionManagementSchema>;

