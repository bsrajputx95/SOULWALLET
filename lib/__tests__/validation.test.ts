import {
  validateSolanaAddress,
  validateAmount,
  validateEmail,
  validateUsername,
  validatePassword,
  validatePostContent,
  sanitizeString,
  sanitizeHTML,
  sanitizeNumericInput,
} from '../../src/lib/validation';

describe('Validation', () => {
  describe('validateSolanaAddress', () => {
    it('should accept valid Solana address', () => {
      const result = validateSolanaAddress('7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDpvcMwJeK');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty address', () => {
      const result = validateSolanaAddress('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Address is required');
    });

    it('should reject address that is too short', () => {
      const result = validateSolanaAddress('short');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid Solana address length');
    });

    it('should reject address with invalid characters', () => {
      const result = validateSolanaAddress('7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDpvcMwJeK!@#');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid Solana address format');
    });
  });

  describe('validateAmount', () => {
    it('should accept valid amount', () => {
      const result = validateAmount('10.5', 100, 'SOL');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty amount', () => {
      const result = validateAmount('', 100, 'SOL');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount is required');
    });

    it('should reject non-numeric amount', () => {
      const result = validateAmount('abc', 100, 'SOL');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount must be a valid number');
    });

    it('should reject zero amount', () => {
      const result = validateAmount('0', 100, 'SOL');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });

    it('should reject amount exceeding balance', () => {
      const result = validateAmount('150', 100, 'SOL');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject email without @', () => {
      const result = validateEmail('testexample.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject email without domain', () => {
      const result = validateEmail('test@');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });
  });

  describe('validateUsername', () => {
    it('should accept valid username', () => {
      const result = validateUsername('john_doe');
      expect(result.isValid).toBe(true);
    });

    it('should reject username that is too short', () => {
      const result = validateUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be at least 3 characters');
    });

    it('should reject username that is too long', () => {
      const result = validateUsername('a'.repeat(21));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be at most 20 characters');
    });

    it('should reject username with special characters', () => {
      const result = validateUsername('john@doe');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('can only contain letters, numbers, and underscores');
    });
  });

  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(true);
    });

    it('should reject password that is too short', () => {
      const result = validatePassword('Pass1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must contain uppercase, lowercase, and numbers');
    });

    it('should reject password without numbers', () => {
      const result = validatePassword('Password');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must contain uppercase, lowercase, and numbers');
    });
  });

  describe('validatePostContent', () => {
    it('should accept valid post content', () => {
      const result = validatePostContent('This is a valid post');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty content', () => {
      const result = validatePostContent('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Post content is required');
    });

    it('should reject content that is too long', () => {
      const result = validatePostContent('a'.repeat(501));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Post is too long');
    });
  });

  describe('sanitizeString', () => {
    it('should remove null bytes', () => {
      const result = sanitizeString('test\0string');
      expect(result).toBe('teststring');
    });

    it('should trim whitespace', () => {
      const result = sanitizeString('  test  ');
      expect(result).toBe('test');
    });

    it('should handle empty string', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeHTML', () => {
    it('should escape HTML characters', () => {
      const result = sanitizeHTML('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should escape quotes', () => {
      const result = sanitizeHTML('"test"');
      expect(result).toBe('&quot;test&quot;');
    });

    it('should handle empty string', () => {
      const result = sanitizeHTML('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeNumericInput', () => {
    it('should keep only numbers and decimal point', () => {
      const result = sanitizeNumericInput('123.45abc!@#');
      expect(result).toBe('123.45');
    });

    it('should handle empty string', () => {
      const result = sanitizeNumericInput('');
      expect(result).toBe('');
    });

    it('should remove all non-numeric characters', () => {
      const result = sanitizeNumericInput('abc$%^');
      expect(result).toBe('');
    });
  });
});
