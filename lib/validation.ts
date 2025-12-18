import { Platform } from 'react-native';
import { logger } from './client-logger';

// DOMPurify doesn't work in React Native (no DOM)
// We'll use a simple fallback for RN
let DOMPurify: any = null;

// Only import DOMPurify on web platform
if (Platform.OS === 'web') {
  try {
    // Dynamic import for web only
    DOMPurify = require('isomorphic-dompurify');
  } catch (e) {
    // Ignore import errors
  }
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify for robust HTML sanitization (web only)
 * Returns plain text for React Native
 * 
 * @param html - The HTML string to sanitize
 * @param allowedTags - Optional array of allowed HTML tags
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string, allowedTags?: string[]): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    // On React Native, just strip HTML tags (no DOM available)
    if (Platform.OS !== 'web' || !DOMPurify?.sanitize) {
      return html
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .trim();
    }

    const config: any = {
      ALLOWED_TAGS: allowedTags || [
        'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
      ],
      ALLOWED_ATTR: ['href', 'title', 'target'],
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true,
    };

    return DOMPurify.sanitize(html, config);
  } catch (error) {
    logger.error('HTML sanitization error:', error);
    // Return stripped text on error for safety
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

/**
 * Strip all HTML tags from a string
 * Useful for displaying plain text from HTML content
 * 
 * @param html - HTML string to convert to plain text
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // First sanitize to prevent any malicious code execution
  const sanitized = sanitizeHtml(html);

  // Then strip all HTML tags
  return sanitized
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim();
}

/**
 * Validate email format
 * 
 * @param email - Email string to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 * - 3-20 characters
 * - Alphanumeric and underscores only
 * - Cannot start with underscore
 * 
 * @param username - Username to validate
 * @returns True if valid username
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_]{2,19}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 * - At least 8 characters
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number
 * - Contains special character
 * 
 * @param password - Password to validate
 * @returns True if password meets requirements
 */
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);

  return hasUppercase && hasLowercase && hasNumber && hasSpecial;
}

/**
 * Validate Solana wallet address
 * - Must be 32-44 characters (base58 encoded)
 * 
 * @param address - Wallet address to validate
 * @returns True if valid Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded, typically 32-44 characters
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return solanaAddressRegex.test(address);
}
