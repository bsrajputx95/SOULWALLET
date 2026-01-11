/**
 * ReDoS (Regular Expression Denial of Service) Security Tests
 * Plan2 Step 6: Verify all regex patterns are safe from catastrophic backtracking
 */

import {
    validateSolanaAddress,
    validateEmail,
    validatePhoneNumber,
    validateUsername,
    validatePrivateKey,
    validateMnemonic,
} from '../../src/lib/validation';

describe('ReDoS Security Tests', () => {
    const TIMEOUT_MS = 100; // Maximum allowed execution time
    const LONG_INPUT_LENGTH = 10000; // 10K characters for stress testing

    /**
     * Helper to measure execution time
     */
    function measureTime(fn: () => void): number {
        const start = performance.now();
        fn();
        return performance.now() - start;
    }

    describe('Base58 Regex - validateSolanaAddress', () => {
        it('should handle long valid-looking input quickly (no backtracking)', () => {
            // Create a long string of valid base58 characters
            const longInput = '1'.repeat(LONG_INPUT_LENGTH);

            const time = measureTime(() => {
                validateSolanaAddress(longInput);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });

        it('should handle alternating patterns without exponential backtracking', () => {
            // Pattern designed to trigger backtracking in vulnerable regexes
            const input = 'A'.repeat(100) + '!' + 'A'.repeat(100);

            const time = measureTime(() => {
                validateSolanaAddress(input);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });
    });

    describe('Email Regex - validateEmail', () => {
        it('should handle long email-like input quickly', () => {
            const longInput = 'a'.repeat(LONG_INPUT_LENGTH) + '@test.com';

            const time = measureTime(() => {
                validateEmail(longInput);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });

        it('should handle repeated @ symbols without backtracking', () => {
            const input = 'test@'.repeat(1000) + 'test.com';

            const time = measureTime(() => {
                validateEmail(input);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });
    });

    describe('Phone Regex - validatePhoneNumber', () => {
        it('should handle long numeric input quickly', () => {
            const longInput = '+1' + '9'.repeat(LONG_INPUT_LENGTH);

            const time = measureTime(() => {
                validatePhoneNumber(longInput);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });
    });

    describe('Username Regex - validateUsername', () => {
        it('should handle long alphanumeric input quickly', () => {
            const longInput = 'a'.repeat(LONG_INPUT_LENGTH);

            const time = measureTime(() => {
                validateUsername(longInput);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });

        it('should handle mixed valid/invalid characters quickly', () => {
            const input = 'valid_' + '!@#$%'.repeat(200) + '_valid';

            const time = measureTime(() => {
                validateUsername(input);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });
    });

    describe('Private Key Regex - validatePrivateKey', () => {
        it('should handle long base58 input quickly', () => {
            const longInput = 'A'.repeat(LONG_INPUT_LENGTH);

            const time = measureTime(() => {
                validatePrivateKey(longInput);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });
    });

    describe('Mnemonic Word Regex - validateMnemonic', () => {
        it('should handle many words quickly', () => {
            // 1000 words
            const manyWords = Array(1000).fill('test').join(' ');

            const time = measureTime(() => {
                validateMnemonic(manyWords);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });

        it('should handle long individual words quickly', () => {
            // 12 very long words
            const longWords = Array(12).fill('a'.repeat(1000)).join(' ');

            const time = measureTime(() => {
                validateMnemonic(longWords);
            });

            expect(time).toBeLessThan(TIMEOUT_MS);
        });
    });

    describe('General Pattern Safety', () => {
        it('should not exhibit exponential time complexity', () => {
            // Test progressively longer inputs and verify linear time growth
            const times: number[] = [];
            const sizes = [100, 500, 1000, 2000];

            sizes.forEach(size => {
                const input = 'a'.repeat(size);
                const time = measureTime(() => {
                    validateUsername(input);
                });
                times.push(time);
            });

            // Time should grow roughly linearly, not exponentially
            // If the last measurement is more than 100x the first, it's likely exponential
            const firstTime = times[0] || 0.001;
            const lastTime = times[times.length - 1];

            expect(lastTime / firstTime).toBeLessThan(100);
        });
    });
});
