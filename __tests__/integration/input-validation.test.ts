/**
 * Comprehensive Input Validation Integration Tests
 * Plan2 Step 7: Test all input validation across the application
 */

import {
    validateUsername,
    validatePostContent,
    validateBio,
    validateName,
    validateSearchQuery,
    validateEmail,
    validatePassword,
    validateSolanaAddress,
    sanitizeHtml,
    sanitizeText,
    encodeHtmlEntities,
    sanitizeString,
    VALIDATION_LIMITS,
} from '../../src/lib/validation';

import {
    notificationsSchema,
    privacySchema,
    securitySchema,
    preferencesSchema,
    userSettingsSchema,
    postImagesSchema,
    transactionMetadataSchema,
} from '../../src/lib/schemas/user-settings';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Input Validation Integration Tests', () => {
    describe('Length Limits (Step 1)', () => {
        describe('Username', () => {
            it('should accept usernames with minimum length', () => {
                const result = validateUsername('abc');
                expect(result.isValid).toBe(true);
            });

            it('should accept usernames with maximum length', () => {
                const result = validateUsername('a'.repeat(VALIDATION_LIMITS.USERNAME_MAX));
                expect(result.isValid).toBe(true);
            });

            it('should reject usernames below minimum length', () => {
                const result = validateUsername('ab');
                expect(result.isValid).toBe(false);
            });

            it('should reject usernames above maximum length', () => {
                const result = validateUsername('a'.repeat(VALIDATION_LIMITS.USERNAME_MAX + 1));
                expect(result.isValid).toBe(false);
            });

            // Comment 1 fix: Test 50-char usernames with various patterns
            it('should accept 50-char username with mixed case and underscores', () => {
                const username = 'User_Name_With_Mixed_Case_And_Underscores_12345678';
                expect(username.length).toBe(50);
                const result = validateUsername(username);
                expect(result.isValid).toBe(true);
            });

            it('should reject 51-char username (exceeds limit)', () => {
                const username = 'a'.repeat(51);
                const result = validateUsername(username);
                expect(result.isValid).toBe(false);
            });

            it('should accept username with only underscores and alphanumeric', () => {
                const result = validateUsername('valid_username_123');
                expect(result.isValid).toBe(true);
            });
        });

        describe('Post Content', () => {
            it('should accept post content within limit', () => {
                const result = validatePostContent('Hello world!');
                expect(result.isValid).toBe(true);
            });

            it('should accept post content at maximum length', () => {
                const result = validatePostContent('a'.repeat(VALIDATION_LIMITS.POST_CONTENT_MAX));
                expect(result.isValid).toBe(true);
            });

            it('should reject post content exceeding limit', () => {
                const result = validatePostContent('a'.repeat(VALIDATION_LIMITS.POST_CONTENT_MAX + 1));
                expect(result.isValid).toBe(false);
                expect(result.error).toContain(`${VALIDATION_LIMITS.POST_CONTENT_MAX}`);
            });
        });

        describe('Bio', () => {
            it('should accept empty bio (optional)', () => {
                const result = validateBio('');
                expect(result.isValid).toBe(true);
            });

            it('should accept bio at maximum length', () => {
                const result = validateBio('a'.repeat(VALIDATION_LIMITS.BIO_MAX));
                expect(result.isValid).toBe(true);
            });

            it('should reject bio exceeding limit', () => {
                const result = validateBio('a'.repeat(VALIDATION_LIMITS.BIO_MAX + 1));
                expect(result.isValid).toBe(false);
            });
        });

        describe('Name', () => {
            it('should accept name at maximum length', () => {
                const result = validateName('a'.repeat(VALIDATION_LIMITS.NAME_MAX));
                expect(result.isValid).toBe(true);
            });

            it('should reject name exceeding limit', () => {
                const result = validateName('a'.repeat(VALIDATION_LIMITS.NAME_MAX + 1));
                expect(result.isValid).toBe(false);
            });
        });

        describe('Search Query', () => {
            it('should accept query within limit', () => {
                const result = validateSearchQuery('search term');
                expect(result.isValid).toBe(true);
            });

            it('should reject empty query', () => {
                const result = validateSearchQuery('');
                expect(result.isValid).toBe(false);
            });

            it('should reject query exceeding limit', () => {
                const result = validateSearchQuery('a'.repeat(VALIDATION_LIMITS.SEARCH_QUERY_MAX + 1));
                expect(result.isValid).toBe(false);
            });
        });
    });

    describe('XSS Sanitization (Step 3)', () => {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            '<svg onload=alert("XSS")>',
            'javascript:alert("XSS")',
            '<iframe src="evil.com"></iframe>',
            '"><script>alert(1)</script>',
            '<object data="data:text/html,<script>alert(1)</script>">',
            '<embed src="data:text/html,<script>alert(1)</script>">',
        ];

        describe('sanitizeText', () => {
            xssPayloads.forEach((payload, index) => {
                it(`should strip XSS payload #${index + 1}`, () => {
                    const result = sanitizeText(payload);
                    expect(result).not.toContain('<script');
                    expect(result).not.toContain('onerror');
                    expect(result).not.toContain('onload');
                    expect(result).not.toContain('<iframe');
                    expect(result).not.toContain('<object');
                    expect(result).not.toContain('<embed');
                });
            });
        });

        describe('sanitizeHtml', () => {
            it('should allow safe HTML tags', () => {
                const input = '<b>Bold</b> and <i>italic</i> and <a href="https://safe.com">link</a>';
                const result = sanitizeHtml(input);
                expect(result).toContain('<b>');
                expect(result).toContain('<i>');
                expect(result).toContain('<a href="https://safe.com">');
            });

            it('should strip dangerous tags', () => {
                const input = '<b>safe</b><script>evil</script>';
                const result = sanitizeHtml(input);
                expect(result).toContain('<b>safe</b>');
                expect(result).not.toContain('<script>');
            });

            it('should remove target attribute from links', () => {
                const input = '<a href="https://test.com" target="_blank">link</a>';
                const result = sanitizeHtml(input);
                expect(result).not.toContain('target');
            });
        });

        describe('encodeHtmlEntities', () => {
            it('should encode all special characters', () => {
                const input = '<script>"test"\'data\'</script>';
                const result = encodeHtmlEntities(input);
                expect(result).not.toContain('<');
                expect(result).not.toContain('>');
                expect(result).toContain('&lt;');
                expect(result).toContain('&gt;');
                expect(result).toContain('&quot;');
                expect(result).toContain('&#x27;');
            });
        });
    });

    describe('JSON Schema Validation (Step 5)', () => {
        describe('Notifications Schema', () => {
            it('should accept valid notifications settings', () => {
                const result = notificationsSchema.safeParse({
                    push: true,
                    email: false,
                    transactions: true,
                });
                expect(result.success).toBe(true);
            });

            it('should reject extra properties (strict mode)', () => {
                const result = notificationsSchema.safeParse({
                    push: true,
                    malicious: 'data',
                });
                expect(result.success).toBe(false);
            });
        });

        describe('Privacy Schema', () => {
            it('should accept valid privacy settings', () => {
                const result = privacySchema.safeParse({
                    showBalance: false,
                    showPortfolio: true,
                });
                expect(result.success).toBe(true);
            });
        });

        describe('Security Schema', () => {
            it('should accept valid security settings', () => {
                const result = securitySchema.safeParse({
                    twoFactorEnabled: true,
                    biometricEnabled: false,
                });
                expect(result.success).toBe(true);
            });

            it('should validate recovery email format', () => {
                const result = securitySchema.safeParse({
                    recoveryEmail: 'not-an-email',
                });
                expect(result.success).toBe(false);
            });
        });

        describe('Post Images Schema', () => {
            it('should accept valid image URLs', () => {
                const result = postImagesSchema.safeParse([
                    'https://example.com/image1.jpg',
                    'https://example.com/image2.png',
                ]);
                expect(result.success).toBe(true);
            });

            it('should reject too many images', () => {
                const result = postImagesSchema.safeParse([
                    'https://example.com/1.jpg',
                    'https://example.com/2.jpg',
                    'https://example.com/3.jpg',
                    'https://example.com/4.jpg',
                    'https://example.com/5.jpg',
                ]);
                expect(result.success).toBe(false);
            });

            it('should reject invalid URLs', () => {
                const result = postImagesSchema.safeParse([
                    'not-a-url',
                ]);
                expect(result.success).toBe(false);
            });
        });
    });

    describe('Edge Cases', () => {
        describe('Unicode Characters', () => {
            it('should handle unicode in usernames correctly', () => {
                const result = validateUsername('user_123');
                expect(result.isValid).toBe(true);

                // Should reject unicode (only alphanumeric + underscore allowed)
                const unicodeResult = validateUsername('user_🚀');
                expect(unicodeResult.isValid).toBe(false);
            });

            it('should allow emoji in post content', () => {
                const result = validatePostContent('Hello 👋 World 🌍!');
                expect(result.isValid).toBe(true);
            });
        });

        describe('Null Bytes', () => {
            it('should remove null bytes from strings', () => {
                const input = 'hello\x00world';
                const result = sanitizeString(input);
                expect(result).not.toContain('\x00');
                expect(result).toBe('helloworld');
            });
        });

        describe('Control Characters', () => {
            it('should remove control characters', () => {
                const input = 'hello\x01\x02\x03world';
                const result = sanitizeString(input);
                expect(result).toBe('helloworld');
            });
        });

        describe('Very Long URLs', () => {
            it('should handle long URLs in bio validation', () => {
                const longUrl = 'https://example.com/' + 'a'.repeat(400);
                const bio = `Check out my site: ${longUrl}`;
                const result = validateBio(bio);
                // Bio itself should be validated for length, not individual URL length
                expect(result.isValid).toBe(bio.length <= VALIDATION_LIMITS.BIO_MAX);
            });
        });

        describe('Malformed JSON in Metadata', () => {
            it('should reject non-object input for settings', () => {
                const result = userSettingsSchema.safeParse('not an object');
                expect(result.success).toBe(false);
            });

            it('should reject arrays instead of objects', () => {
                const result = userSettingsSchema.safeParse(['array', 'data']);
                expect(result.success).toBe(false);
            });
        });
    });
});
