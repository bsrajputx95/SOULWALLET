/**
 * Input Validation and Sanitization Utilities
 * 
 * Provides validation functions for user inputs across the app
 */

import DOMPurify from 'isomorphic-dompurify';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { FEES, VALIDATION } from '@/constants';

/**
 * Centralized validation limits - Single source of truth for all input validation
 * Plan2 Step 1: Standardize Input Length Limits
 */
export const VALIDATION_LIMITS = {
  // Username
  USERNAME_MIN: VALIDATION.USERNAME_MIN,
  USERNAME_MAX: VALIDATION.USERNAME_MAX,

  // Content limits
  POST_CONTENT_MAX: VALIDATION.POST_CONTENT_MAX,
  COMMENT_CONTENT_MAX: VALIDATION.COMMENT_CONTENT_MAX,
  BIO_MAX: VALIDATION.BIO_MAX,
  NAME_MAX: VALIDATION.NAME_MAX,

  // Contact limits
  CONTACT_NAME_MAX: VALIDATION.CONTACT_NAME_MAX,
  CONTACT_NOTES_MAX: VALIDATION.CONTACT_NOTES_MAX,

  // Media limits
  PROFILE_IMAGE_MAX_SIZE: VALIDATION.PROFILE_IMAGE_MAX_SIZE,

  // Search
  SEARCH_QUERY_MAX: VALIDATION.SEARCH_QUERY_MAX,

  // VIP description
  VIP_DESCRIPTION_MAX: VALIDATION.VIP_DESCRIPTION_MAX,

  // Images per post
  IMAGES_PER_POST_MAX: VALIDATION.IMAGES_PER_POST_MAX,
} as const;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const MAX_SLIPPAGE_PERCENT = FEES.SWAP.SLIPPAGE_PERCENT.MAX;
export const MAX_SLIPPAGE_BPS = FEES.SWAP.SLIPPAGE_BPS.MAX;

export function validateSlippage(slippage: number): ValidationResult {
  if (!Number.isFinite(slippage)) return { isValid: false, error: 'Slippage must be a valid number' };
  if (slippage < 0) return { isValid: false, error: 'Slippage cannot be negative' };
  if (slippage > MAX_SLIPPAGE_PERCENT) {
    return { isValid: false, error: `Slippage cannot exceed ${MAX_SLIPPAGE_PERCENT}%` };
  }
  return { isValid: true };
}

/**
 * Validates a Solana wallet address
 * SAFE REGEX: Base58 character class only, no backtracking - ReDoS safe
 */
export function validateSolanaAddress(address: string): ValidationResult {
  if (!address || address.trim() === '') {
    return { isValid: false, error: 'Address is required' };
  }

  const trimmed = address.trim();

  // Solana addresses are base58 encoded and typically 32-44 characters
  if (trimmed.length < 32 || trimmed.length > 44) {
    return {
      isValid: false,
      error: 'Invalid Solana address length (must be 32-44 characters)'
    };
  }

  // SAFE REGEX: Character class only, no nested quantifiers - ReDoS safe
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid Solana address format (invalid characters)'
    };
  }

  return { isValid: true };
}

/**
 * Validates an amount (for transactions)
 */
export function validateAmount(
  amount: string,
  maxAmount: number,
  tokenSymbol: string = 'tokens'
): ValidationResult {
  if (!amount || amount.trim() === '') {
    return { isValid: false, error: 'Amount is required' };
  }

  const numericAmount = parseFloat(amount);

  if (isNaN(numericAmount)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }

  if (numericAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }

  if (numericAmount > maxAmount) {
    return {
      isValid: false,
      error: `Insufficient balance. Available: ${maxAmount.toFixed(6)} ${tokenSymbol}`
    };
  }

  return { isValid: true };
}

/**
 * Validates email address
 * SAFE REGEX: Simple pattern with no backtracking - ReDoS safe
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  // SAFE REGEX: Simple single-pass pattern - ReDoS safe
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}

/**
 * Validates phone number
 * SAFE REGEX: Simple pattern with no nesting - ReDoS safe
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const normalized = phone.replace(/[\s-]/g, '');
  const digits = normalized.replace(/^\+/, '');

  if (digits.length < 8) {
    return {
      isValid: false,
      error: 'Invalid phone number format. Use international format (+1234567890)'
    };
  }

  // SAFE REGEX: Character class only - ReDoS safe
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(normalized)) {
    return {
      isValid: false,
      error: 'Invalid phone number format. Use international format (+1234567890)'
    };
  }

  return { isValid: true };
}

export function validateDateOfBirth(dateOfBirth?: string | null): ValidationResult {
  if (!dateOfBirth || dateOfBirth.trim() === '') {
    return { isValid: true };
  }

  const trimmed = dateOfBirth.trim();
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const isoDateTimeUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  if (!isoDateOnly.test(trimmed) && !isoDateTimeUtc.test(trimmed)) {
    return { isValid: false, error: 'Invalid date of birth (must be 13+ years old)' };
  }

  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date of birth (must be 13+ years old)' };
  }

  const now = new Date();
  if (date >= now) {
    return { isValid: false, error: 'Invalid date of birth (must be 13+ years old)' };
  }

  const ageYears = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 13) {
    return { isValid: false, error: 'Invalid date of birth (must be 13+ years old)' };
  }

  return { isValid: true };
}

/**
 * Validates username using centralized limits
 * SAFE REGEX: Character class only - ReDoS safe
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim() === '') {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < VALIDATION_LIMITS.USERNAME_MIN) {
    return { isValid: false, error: `Username must be at least ${VALIDATION_LIMITS.USERNAME_MIN} characters` };
  }

  if (trimmed.length > VALIDATION_LIMITS.USERNAME_MAX) {
    return { isValid: false, error: `Username must be at most ${VALIDATION_LIMITS.USERNAME_MAX} characters` };
  }

  // SAFE REGEX: Character class only - ReDoS safe
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, and underscores'
    };
  }

  return { isValid: true };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.trim() === '') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  // Check for at least one uppercase, one lowercase, and one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return {
      isValid: false,
      error: 'Password must contain uppercase, lowercase, and numbers'
    };
  }

  return { isValid: true };
}

/**
 * Validates post content using centralized limits
 */
export function validatePostContent(content: string): ValidationResult {
  if (!content || content.trim() === '') {
    return { isValid: false, error: 'Post content is required' };
  }

  const trimmed = content.trim();

  if (trimmed.length > VALIDATION_LIMITS.POST_CONTENT_MAX) {
    return {
      isValid: false,
      error: `Post is too long (${trimmed.length}/${VALIDATION_LIMITS.POST_CONTENT_MAX} characters)`
    };
  }

  return { isValid: true };
}

/**
 * Validates bio content using centralized limits
 * Plan2 Step 1: New validation function
 */
export function validateBio(bio: string): ValidationResult {
  if (!bio) {
    return { isValid: true };  // Bio is optional
  }

  const trimmed = bio.trim();

  if (trimmed.length > VALIDATION_LIMITS.BIO_MAX) {
    return {
      isValid: false,
      error: `Bio is too long (${trimmed.length}/${VALIDATION_LIMITS.BIO_MAX} characters)`
    };
  }

  return { isValid: true };
}

/**
 * Validates name using centralized limits
 * Plan2 Step 1: New validation function
 */
export function validateName(name: string): ValidationResult {
  if (!name) {
    return { isValid: true };  // Name is optional
  }

  const trimmed = name.trim();

  if (trimmed.length > VALIDATION_LIMITS.NAME_MAX) {
    return {
      isValid: false,
      error: `Name is too long (${trimmed.length}/${VALIDATION_LIMITS.NAME_MAX} characters)`
    };
  }

  return { isValid: true };
}

/**
 * Validates search query using centralized limits
 * Plan2 Step 1: New validation function
 */
export function validateSearchQuery(query: string): ValidationResult {
  if (!query || query.trim() === '') {
    return { isValid: false, error: 'Search query is required' };
  }

  const trimmed = query.trim();

  if (trimmed.length > VALIDATION_LIMITS.SEARCH_QUERY_MAX) {
    return {
      isValid: false,
      error: `Search query is too long (max ${VALIDATION_LIMITS.SEARCH_QUERY_MAX} characters)`
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes string input (removes dangerous characters)
 */
export function sanitizeString(input: string): string {
  if (!input) return '';

  const trimmed = input.trim();
  let out = '';
  for (const ch of trimmed) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    if (code === 0 || code < 32 || code === 127) continue;
    out += ch;
  }
  return out;
}

/**
 * HTML Entity Encoding helper
 * Plan2 Step 3: Renamed from sanitizeHTML for clarity - encodes HTML entities for safe display
 */
export function encodeHtmlEntities(input: string): string {
  if (!input) return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/** @deprecated Use encodeHtmlEntities instead */
export const sanitizeHTML = encodeHtmlEntities;

/**
 * Sanitizes HTML content using DOMPurify with allowed tags
 * Plan2 Step 3: Enhanced XSS protection with stricter config
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href'],  // Removed 'target' to prevent target="_blank" attacks
    ALLOW_DATA_ATTR: false,  // Prevent data attributes
    SAFE_FOR_TEMPLATES: true,  // Prevent template injection
  });
}

/**
 * Sanitizes text content by removing all HTML tags
 * Plan2 Step 3: Enhanced with additional security flags
 */
export function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,  // Preserve text content while stripping tags
  });
}

/**
 * Sanitizes username by removing special characters
 */
export function sanitizeUsername(username: string): string {
  return username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

/**
 * Sanitizes email by trimming and converting to lowercase
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates Solana address using PublicKey constructor
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes Solana amount to prevent precision issues
 */
export function sanitizeSolanaAmount(amount: number | string): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num) || num < 0) {
    throw new Error('Invalid amount');
  }

  return Math.floor(num * 1e9) / 1e9;
}

/**
 * Validates and sanitizes a numeric input
 */
export function sanitizeNumericInput(input: string): string {
  if (!input) return '';

  // Remove all non-numeric characters except decimal point
  return input.replace(/[^0-9.]/g, '');
}

/**
 * Validates private key format
 */
export function validatePrivateKey(privateKey: string): ValidationResult {
  if (!privateKey || privateKey.trim() === '') {
    return { isValid: false, error: 'Private key is required' };
  }

  const trimmed = privateKey.trim();

  // Solana private keys in base58 are typically around 88 characters
  if (trimmed.length < 80 || trimmed.length > 100) {
    return {
      isValid: false,
      error: 'Invalid private key length'
    };
  }

  // Check if it contains only valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid private key format (invalid characters)'
    };
  }

  return { isValid: true };
}

// Zod Schemas for enhanced validation
export const solanaAddressSchema = z.string().refine(
  (val) => isValidSolanaAddress(val),
  { message: 'Invalid Solana address' }
);

export const solanaAmountSchema = z.number()
  .positive('Amount must be positive')
  .finite('Amount must be finite')
  .transform((val) => sanitizeSolanaAmount(val));

export const transactionSignatureSchema = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{87,88}$/,
  'Invalid transaction signature'
);

/**
 * Validates mnemonic phrase (seed phrase)
 */
export function validateMnemonic(mnemonic: string): ValidationResult {
  if (!mnemonic || mnemonic.trim() === '') {
    return { isValid: false, error: 'Mnemonic phrase is required' };
  }

  const words = mnemonic.trim().split(/\s+/);

  // BIP39 mnemonics are 12, 15, 18, 21, or 24 words
  const validLengths = [12, 15, 18, 21, 24];
  if (!validLengths.includes(words.length)) {
    return {
      isValid: false,
      error: `Invalid mnemonic length (${words.length} words). Must be 12, 15, 18, 21, or 24 words`
    };
  }

  // Check that each word only contains letters
  const wordRegex = /^[a-z]+$/;
  for (const word of words) {
    if (!wordRegex.test(word)) {
      return {
        isValid: false,
        error: 'Invalid mnemonic format. Words should only contain lowercase letters'
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates a URL
 */
export function validateURL(url: string): ValidationResult {
  if (!url || url.trim() === '') {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    new URL(url);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validates a percentage value (0-100)
 */
export function validatePercentage(value: string): ValidationResult {
  const num = parseFloat(value);

  if (isNaN(num)) {
    return { isValid: false, error: 'Must be a valid number' };
  }

  if (num < 0 || num > 100) {
    return { isValid: false, error: 'Must be between 0 and 100' };
  }

  return { isValid: true };
}
