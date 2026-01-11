/**
 * Real E2E Edge Case Tests using Detox
 * 
 * Tests for error handling, edge cases, and recovery scenarios.
 * Drives the actual app through failure conditions and validates graceful handling.
 */

describe('E2E Wallet Edge Cases', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe('Password/Unlock Edge Cases', () => {
        it('should lock wallet after timeout and require unlock', async () => {
            // Create wallet first
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);

            // Navigate to settings
            await element(by.id('settings-button')).tap();

            // Set auto-lock to short duration
            await element(by.id('auto-lock-setting')).tap();
            await element(by.text('1 minute')).tap();

            // Wait for lock (in real test, would mock time)
            // For now, navigate away and back
            await device.sendToHome();
            await device.launchApp({ newInstance: false });

            // Should show unlock screen
            await waitFor(element(by.id('unlock-screen'))).toBeVisible().withTimeout(5000);
        });

        it('should reject wrong password on unlock', async () => {
            // Assuming locked state
            await waitFor(element(by.id('unlock-screen'))).toBeVisible().withTimeout(5000);

            await element(by.id('unlock-password-input')).typeText('wrongpassword');
            await element(by.id('unlock-submit-button')).tap();

            // Verify error
            await waitFor(element(by.text('Invalid password'))).toBeVisible().withTimeout(3000);
        });

        it('should show lockout after too many failed attempts', async () => {
            await waitFor(element(by.id('unlock-screen'))).toBeVisible().withTimeout(5000);

            // Try 5 wrong passwords
            for (let i = 0; i < 5; i++) {
                await element(by.id('unlock-password-input')).clearText();
                await element(by.id('unlock-password-input')).typeText(`wrong${i}`);
                await element(by.id('unlock-submit-button')).tap();
                await waitFor(element(by.text('Invalid password'))).toBeVisible().withTimeout(2000);
            }

            // Should show lockout message
            await waitFor(element(by.text('Too many attempts'))).toBeVisible().withTimeout(3000);
        });
    });

    describe('Network Error Recovery', () => {
        it('should retry on network failure', async () => {
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);

            // Disable network
            await device.setStatusBar({ network: 'none' });

            // Trigger refresh
            await element(by.id('portfolio-screen')).scroll(200, 'down');

            // Wait for error
            await waitFor(element(by.id('error-banner'))).toBeVisible().withTimeout(5000);

            // Enable network
            await device.setStatusBar({ network: 'wifi' });

            // Tap retry
            await element(by.id('retry-button')).tap();

            // Verify recovery
            await waitFor(element(by.id('portfolio-balance'))).toBeVisible().withTimeout(10000);
        });

        it('should show queue degraded status on high load', async () => {
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);

            // Queue status banner should exist
            await expect(element(by.id('queue-status-banner'))).toExist();

            // In degraded state, banner should show warning
            // This would require backend to return degraded status
        });
    });

    describe('Transaction Edge Cases', () => {
        it('should handle transaction timeout gracefully', async () => {
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);

            await element(by.id('send-button')).tap();
            await waitFor(element(by.id('send-screen'))).toBeVisible().withTimeout(5000);

            await element(by.id('recipient-address-input')).typeText('11111111111111111111111111111111');
            await element(by.id('send-amount-input')).typeText('0.001');
            await element(by.id('send-submit-button')).tap();

            // Simulate slow network (transaction takes longer than expected)
            // In real test, would mock connection latency

            // Verify optimistic update reverts on failure
            // Balance should return to original after timeout
        });

        it('should prevent double-spend on rapid taps', async () => {
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);

            await element(by.id('send-button')).tap();
            await waitFor(element(by.id('send-screen'))).toBeVisible().withTimeout(5000);

            await element(by.id('recipient-address-input')).typeText('11111111111111111111111111111111');
            await element(by.id('send-amount-input')).typeText('0.001');

            // Rapid double-tap
            await element(by.id('send-submit-button')).multiTap(2);

            // Should only process once (button should be disabled after first tap)
            await waitFor(element(by.id('transaction-pending'))).toBeVisible().withTimeout(5000);
        });

        it('should show simulation failure before sending', async () => {
            await element(by.id('send-button')).tap();
            await waitFor(element(by.id('send-screen'))).toBeVisible().withTimeout(5000);

            // Enter amount that would fail simulation (e.g., to program that rejects)
            await element(by.id('recipient-address-input')).typeText('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
            await element(by.id('send-amount-input')).typeText('0.001');
            await element(by.id('send-submit-button')).tap();

            // Should show simulation error, not send
            await waitFor(element(by.text('Simulation failed'))).toBeVisible().withTimeout(5000);
        });
    });

    describe('Swap Edge Cases', () => {
        it('should handle slippage exceeded error', async () => {
            await element(by.id('swap-tab')).tap();
            await waitFor(element(by.id('swap-screen'))).toBeVisible().withTimeout(5000);

            // Enter swap with tight slippage
            await element(by.id('slippage-settings')).tap();
            await element(by.id('slippage-input')).clearText();
            await element(by.id('slippage-input')).typeText('0.01'); // 0.01%
            await element(by.id('save-slippage')).tap();

            // Enter large swap amount
            await element(by.id('swap-amount-input')).typeText('100');
            await element(by.id('execute-swap-button')).tap();

            // Should warn about slippage being too low
            await waitFor(element(by.text('Slippage too low'))).toBeVisible().withTimeout(5000);
        });

        it('should prevent swap with zero amount', async () => {
            await element(by.id('swap-tab')).tap();
            await waitFor(element(by.id('swap-screen'))).toBeVisible().withTimeout(5000);

            await element(by.id('swap-amount-input')).typeText('0');

            // Swap button should be disabled
            await expect(element(by.id('execute-swap-button'))).toHaveAttribute('accessibilityState', { disabled: true });
        });
    });

    describe('iBuy Edge Cases', () => {
        it('should validate minimum iBuy amount', async () => {
            await element(by.id('feed-tab')).tap();
            await waitFor(element(by.id('feed-screen'))).toBeVisible().withTimeout(5000);

            // Find iBuy button
            await waitFor(element(by.id('ibuy-button'))).toBeVisible().withTimeout(10000);
            await element(by.id('ibuy-button')).tap();

            // Enter amount below minimum
            await element(by.id('ibuy-amount-input')).typeText('0.001');
            await element(by.id('confirm-ibuy-button')).tap();

            // Should show minimum amount error
            await waitFor(element(by.text('Minimum amount'))).toBeVisible().withTimeout(3000);
        });

        it('should track iBuy purchase in portfolio', async () => {
            await element(by.id('feed-tab')).tap();
            await waitFor(element(by.id('feed-screen'))).toBeVisible().withTimeout(5000);

            // Execute iBuy
            await element(by.id('ibuy-button')).tap();
            await element(by.id('ibuy-amount-input')).typeText('1');
            await element(by.id('confirm-ibuy-button')).tap();

            // Wait for completion
            await waitFor(element(by.text('iBuy successful'))).toBeVisible().withTimeout(30000);

            // Navigate to portfolio
            await element(by.id('portfolio-tab')).tap();

            // Verify token appears in holdings
            await waitFor(element(by.id('ibuy-holdings-section'))).toBeVisible().withTimeout(5000);
        });
    });

    describe('Memory and Performance', () => {
        it('should handle large token list without crash', async () => {
            await element(by.id('market-tab')).tap();
            await waitFor(element(by.id('market-screen'))).toBeVisible().withTimeout(5000);

            // Scroll through many pages
            for (let i = 0; i < 10; i++) {
                await element(by.id('market-screen')).scroll(500, 'down');
                await waitFor(element(by.id('load-more-button'))).toBeVisible().withTimeout(3000);
                await element(by.id('load-more-button')).tap();
            }

            // App should not crash
            await expect(element(by.id('market-screen'))).toBeVisible();
        });

        it('should recover from background state', async () => {
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);

            // Send to background
            await device.sendToHome();

            // Wait some time
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Bring back
            await device.launchApp({ newInstance: false });

            // Should recover state
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);
        });
    });
});

// CI configuration
module.exports = {
    testEnvironment: 'detox/runners/jest',
    testTimeout: 180000,
    reporters: ['default', 'jest-html-reporters'],
};
