/**
 * Input Validation and Sanitization Utilities
 * 
 * Provides validation functions for user inputs across the app
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a Solana wallet address
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

  // Check if it contains only valid base58 characters
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
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}

/**
 * Validates phone number
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Basic international phone validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
    return { 
      isValid: false, 
      error: 'Invalid phone number format. Use international format (+1234567890)' 
    };
  }

  return { isValid: true };
}

/**
 * Validates username
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim() === '') {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username must be at most 20 characters' };
  }

  // Only allow alphanumeric and underscores
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
 * Validates post content
 */
export function validatePostContent(content: string): ValidationResult {
  if (!content || content.trim() === '') {
    return { isValid: false, error: 'Post content is required' };
  }

  const trimmed = content.trim();

  if (trimmed.length > 500) {
    return { 
      isValid: false, 
      error: `Post is too long (${trimmed.length}/500 characters)` 
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes string input (removes dangerous characters)
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Sanitizes HTML (for display purposes)
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
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
