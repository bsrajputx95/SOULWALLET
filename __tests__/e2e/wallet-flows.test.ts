/**
 * Real E2E Wallet Flow Tests using Detox
 * 
 * These tests drive the actual app through wallet creation, send, swap, and portfolio flows.
 * Requires Detox to be configured in the project.
 */

// Detox E2E test structure - requires `detox` package and device configuration
// Run with: npx detox test -c ios.sim.debug

describe('E2E Wallet Flows', () => {
    beforeAll(async () => {
        // Launch the app fresh before all tests
        await device.launchApp({ newInstance: true });
    });

    beforeEach(async () => {
        // Reload React Native to reset state between tests  
        await device.reloadReactNative();
    });

    describe('Wallet Creation Flow', () => {
        it('should navigate to wallet setup and create a new wallet', async () => {
            // Wait for app to load
            await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);

            // Navigate to wallet setup if no wallet exists
            await expect(element(by.id('create-wallet-button'))).toBeVisible();
            await element(by.id('create-wallet-button')).tap();

            // Enter password
            await waitFor(element(by.id('password-input'))).toBeVisible().withTimeout(5000);
            await element(by.id('password-input')).typeText('TestPassword123!');
            await element(by.id('confirm-password-input')).typeText('TestPassword123!');

            // Create wallet
            await element(by.id('create-wallet-submit')).tap();

            // Wait for wallet creation and mnemonic display
            await waitFor(element(by.id('mnemonic-display'))).toBeVisible().withTimeout(15000);

            // Verify mnemonic is shown (12 words)
            await expect(element(by.id('mnemonic-word-0'))).toBeVisible();
            await expect(element(by.id('mnemonic-word-11'))).toBeVisible();

            // Confirm mnemonic backup
            await element(by.id('confirm-backup-checkbox')).tap();
            await element(by.id('continue-button')).tap();

            // Verify we reach portfolio screen with wallet connected
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);
            await expect(element(by.id('wallet-balance'))).toBeVisible();
        });

        it('should show wallet address after creation', async () => {
            // After wallet creation, verify address is displayed
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);

            // Tap on wallet address to copy
            await expect(element(by.id('wallet-address'))).toBeVisible();
            await element(by.id('wallet-address')).tap();

            // Verify copy confirmation toast
            await waitFor(element(by.text('Address copied'))).toBeVisible().withTimeout(3000);
        });
    });

    describe('Wallet Import Flow', () => {
        it('should import wallet from mnemonic phrase', async () => {
            await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);

            // Navigate to import
            await element(by.id('import-wallet-button')).tap();

            // Select mnemonic import method
            await element(by.id('import-mnemonic-tab')).tap();

            // Enter test mnemonic (12 words)
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await element(by.id('mnemonic-input')).typeText(testMnemonic);

            // Enter password
            await element(by.id('import-password-input')).typeText('ImportTest123!');
            await element(by.id('import-confirm-password')).typeText('ImportTest123!');

            // Submit import
            await element(by.id('import-wallet-submit')).tap();

            // Wait for import to complete
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(15000);

            // Verify expected wallet address for test mnemonic
            await expect(element(by.id('wallet-address'))).toBeVisible();
        });

        it('should reject invalid mnemonic', async () => {
            await element(by.id('import-wallet-button')).tap();
            await element(by.id('import-mnemonic-tab')).tap();

            // Enter invalid mnemonic
            await element(by.id('mnemonic-input')).typeText('invalid words that are not valid');
            await element(by.id('import-password-input')).typeText('Test123!');
            await element(by.id('import-wallet-submit')).tap();

            // Verify error message
            await waitFor(element(by.text('Invalid mnemonic'))).toBeVisible().withTimeout(5000);
        });
    });

    describe('Send Flow', () => {
        beforeEach(async () => {
            // Ensure wallet is unlocked
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);
        });

        it('should navigate to send screen and validate address', async () => {
            // Tap send button
            await element(by.id('send-button')).tap();

            // Wait for send screen
            await waitFor(element(by.id('send-screen'))).toBeVisible().withTimeout(5000);

            // Enter invalid address
            await element(by.id('recipient-address-input')).typeText('invalid-address');
            await element(by.id('send-amount-input')).typeText('0.001');

            // Try to send
            await element(by.id('send-submit-button')).tap();

            // Verify validation error
            await expect(element(by.text('Invalid address'))).toBeVisible();
        });

        it('should show fee estimate before sending', async () => {
            await element(by.id('send-button')).tap();
            await waitFor(element(by.id('send-screen'))).toBeVisible().withTimeout(5000);

            // Enter valid address
            await element(by.id('recipient-address-input')).typeText('11111111111111111111111111111111');
            await element(by.id('send-amount-input')).typeText('0.001');

            // Wait for fee estimate
            await waitFor(element(by.id('fee-estimate'))).toBeVisible().withTimeout(5000);
            await expect(element(by.id('fee-estimate'))).toHaveText(expect.stringMatching(/\d+\.\d+/));
        });
    });

    describe('Swap Flow', () => {
        beforeEach(async () => {
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(10000);
        });

        it('should navigate to swap screen and select tokens', async () => {
            // Navigate to swap
            await element(by.id('swap-tab')).tap();

            await waitFor(element(by.id('swap-screen'))).toBeVisible().withTimeout(5000);

            // Select from token (SOL)
            await element(by.id('from-token-selector')).tap();
            await waitFor(element(by.id('token-selector-modal'))).toBeVisible().withTimeout(3000);
            await element(by.text('SOL')).tap();

            // Select to token (USDC)
            await element(by.id('to-token-selector')).tap();
            await waitFor(element(by.id('token-selector-modal'))).toBeVisible().withTimeout(3000);
            await element(by.text('USDC')).tap();

            // Verify tokens are selected
            await expect(element(by.id('from-token-symbol'))).toHaveText('SOL');
            await expect(element(by.id('to-token-symbol'))).toHaveText('USDC');
        });

        it('should show swap quote when amount is entered', async () => {
            await element(by.id('swap-tab')).tap();
            await waitFor(element(by.id('swap-screen'))).toBeVisible().withTimeout(5000);

            // Enter swap amount
            await element(by.id('swap-amount-input')).typeText('0.1');

            // Wait for quote to load
            await waitFor(element(by.id('swap-quote-output'))).toBeVisible().withTimeout(10000);

            // Verify quote shows estimated output
            await expect(element(by.id('swap-quote-output'))).toHaveText(expect.stringMatching(/\d+/));
        });
    });

    describe('iBuy Flow', () => {
        it('should show iBuy option on token posts', async () => {
            // Navigate to feed
            await element(by.id('feed-tab')).tap();
            await waitFor(element(by.id('feed-screen'))).toBeVisible().withTimeout(5000);

            // Find a post with token mention
            await waitFor(element(by.id('ibuy-button'))).toBeVisible().withTimeout(10000);

            // Verify iBuy button is visible
            await expect(element(by.id('ibuy-button'))).toBeVisible();
        });
    });

    describe('Portfolio/Market Views', () => {
        it('should load portfolio with token balances', async () => {
            await element(by.id('portfolio-tab')).tap();
            await waitFor(element(by.id('portfolio-screen'))).toBeVisible().withTimeout(5000);

            // Verify balance is displayed
            await expect(element(by.id('portfolio-total-value'))).toBeVisible();

            // Verify token list loads
            await waitFor(element(by.id('token-list'))).toBeVisible().withTimeout(10000);
        });

        it('should load market with trending tokens', async () => {
            await element(by.id('market-tab')).tap();
            await waitFor(element(by.id('market-screen'))).toBeVisible().withTimeout(5000);

            // Verify market loads tokens
            await waitFor(element(by.id('token-card'))).toBeVisible().withTimeout(15000);

            // Verify queue status banner is visible
            await expect(element(by.id('queue-status-banner'))).toExist();
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            // Simulate offline mode
            await device.setStatusBar({ network: 'none' });

            // Try to refresh portfolio
            await element(by.id('portfolio-tab')).tap();
            await element(by.id('portfolio-screen')).scroll(200, 'down');

            // Verify error message
            await waitFor(element(by.text('Network error'))).toBeVisible().withTimeout(5000);

            // Restore network
            await device.setStatusBar({ network: 'wifi' });
        });

        it('should show insufficient balance error on send', async () => {
            await element(by.id('send-button')).tap();
            await waitFor(element(by.id('send-screen'))).toBeVisible().withTimeout(5000);

            // Enter large amount
            await element(by.id('recipient-address-input')).typeText('11111111111111111111111111111111');
            await element(by.id('send-amount-input')).typeText('999999');

            await element(by.id('send-submit-button')).tap();

            // Verify insufficient balance error
            await waitFor(element(by.text('Insufficient balance'))).toBeVisible().withTimeout(5000);
        });
    });
});

// Export for CI integration
module.exports = {
    testEnvironment: 'detox/runners/jest',
    testTimeout: 120000,
    reporters: ['default', 'jest-html-reporters'],
};
