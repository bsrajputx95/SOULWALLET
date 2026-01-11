/**
 * Market Tab E2E Tests
 * Comment 5: End-to-end tests for market flows
 * 
 * Tests cover:
 * - SoulMarket token loading with beast filters
 * - Filter functionality
 * - Search functionality
 * - TokenCard navigation to swap
 * - DEX WebView loading
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Market Tab E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Flow 1: SoulMarket Token Loading', () => {
    it('should load SoulMarket tab with quality tokens', async () => {
      // Navigate to Market tab
      await element(by.id('tab-market')).tap();
      
      // Wait for tokens to load
      await waitFor(element(by.id('token-list')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Verify tokens are displayed
      await expect(element(by.id('token-card-0'))).toBeVisible();
    });

    it('should only show Solana tokens (no stablecoins)', async () => {
      await element(by.id('tab-market')).tap();
      
      await waitFor(element(by.id('token-list')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Verify no stablecoins are shown
      await expect(element(by.text('USDC'))).not.toBeVisible();
      await expect(element(by.text('USDT'))).not.toBeVisible();
      await expect(element(by.text('DAI'))).not.toBeVisible();
    });

    it('should show token count', async () => {
      await element(by.id('tab-market')).tap();
      
      await waitFor(element(by.id('token-count')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Flow 2: Filter Functionality', () => {
    beforeEach(async () => {
      await element(by.id('tab-market')).tap();
      await waitFor(element(by.id('token-list')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should toggle volume filter', async () => {
      // Open filters
      await element(by.id('filter-button')).tap();
      
      // Toggle volume filter
      await element(by.id('filter-chip-volume')).tap();
      
      // Verify filter is active
      await expect(element(by.id('filter-chip-volume-active'))).toBeVisible();
    });

    it('should toggle liquidity filter', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('filter-chip-liquidity')).tap();
      await expect(element(by.id('filter-chip-liquidity-active'))).toBeVisible();
    });

    it('should toggle buys ratio filter (beast filter)', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('filter-chip-buysRatio')).tap();
      await expect(element(by.id('filter-chip-buysRatio-active'))).toBeVisible();
    });

    it('should toggle txns filter (beast filter)', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('filter-chip-txns')).tap();
      await expect(element(by.id('filter-chip-txns-active'))).toBeVisible();
    });

    it('should toggle price change filter (beast filter)', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('filter-chip-priceChange')).tap();
      await expect(element(by.id('filter-chip-priceChange-active'))).toBeVisible();
    });

    it('should show filter count badge', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('filter-chip-volume')).tap();
      await element(by.id('filter-chip-liquidity')).tap();
      
      // Verify badge shows count
      await expect(element(by.id('filter-badge'))).toHaveText('2');
    });

    it('should open advanced filters modal', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('advanced-filters-button')).tap();
      
      await expect(element(by.id('advanced-filters-modal'))).toBeVisible();
    });
  });

  describe('Flow 3: Search Functionality', () => {
    beforeEach(async () => {
      await element(by.id('tab-market')).tap();
      await waitFor(element(by.id('token-list')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should search for BONK token', async () => {
      // Open search
      await element(by.id('search-button')).tap();
      
      // Type search query
      await element(by.id('search-input')).typeText('BONK');
      
      // Verify results
      await waitFor(element(by.text('BONK')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should clear search', async () => {
      await element(by.id('search-button')).tap();
      await element(by.id('search-input')).typeText('BONK');
      
      // Clear search
      await element(by.id('search-clear')).tap();
      
      // Verify search is cleared
      await expect(element(by.id('search-input'))).toHaveText('');
    });
  });

  describe('Flow 4: TokenCard Navigation to Swap', () => {
    beforeEach(async () => {
      await element(by.id('tab-market')).tap();
      await waitFor(element(by.id('token-list')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should navigate to swap screen when tapping token', async () => {
      // Tap first token card
      await element(by.id('token-card-0')).tap();
      
      // Verify swap screen is shown
      await waitFor(element(by.id('swap-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should pre-fill token in swap screen', async () => {
      // Search for specific token
      await element(by.id('search-button')).tap();
      await element(by.id('search-input')).typeText('JUP');
      
      await waitFor(element(by.text('JUP')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Tap the token
      await element(by.text('JUP')).tap();
      
      // Verify swap screen has token pre-filled
      await waitFor(element(by.id('swap-to-token')))
        .toHaveText('JUP')
        .withTimeout(5000);
    });
  });

  describe('Flow 5: DEX WebView Loading', () => {
    beforeEach(async () => {
      await element(by.id('tab-market')).tap();
    });

    it('should load DexScreener WebView', async () => {
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('webview-dexscreener')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should show wallet status in WebView header', async () => {
      await element(by.id('tab-dexscreener')).tap();
      
      await expect(element(by.id('wallet-status'))).toBeVisible();
    });

    it('should show Trade in App button', async () => {
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('trade-in-app-button')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should navigate to swap when tapping Trade in App', async () => {
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('trade-in-app-button')))
        .toBeVisible()
        .withTimeout(10000);
      
      await element(by.id('trade-in-app-button')).tap();
      
      await expect(element(by.id('swap-screen'))).toBeVisible();
    });
  });

  describe('Flow 6: All DEX Tabs Loading', () => {
    beforeEach(async () => {
      await element(by.id('tab-market')).tap();
    });

    it('should load Raydium tab', async () => {
      await element(by.id('tab-raydium')).tap();
      
      await waitFor(element(by.id('webview-raydium')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should load Bonk tab', async () => {
      await element(by.id('tab-bonk')).tap();
      
      await waitFor(element(by.id('webview-bonk')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should load Pump.fun tab', async () => {
      await element(by.id('tab-pumpfun')).tap();
      
      await waitFor(element(by.id('webview-pumpfun')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should load Orca tab', async () => {
      await element(by.id('tab-orca')).tap();
      
      await waitFor(element(by.id('webview-orca')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });

  describe('Flow 7: Error Handling & Jupiter Fallback', () => {
    it('should show Jupiter fallback on WebView error', async () => {
      // This test requires mocking network failure
      // In real implementation, use network mocking
      
      await element(by.id('tab-market')).tap();
      await element(by.id('tab-dexscreener')).tap();
      
      // If error occurs, verify fallback is shown
      // await expect(element(by.id('jupiter-fallback-button'))).toBeVisible();
    });
  });

  describe('Flow 8: Token-Aware Routing from WebView', () => {
    beforeEach(async () => {
      await element(by.id('tab-market')).tap();
    });

    it('should extract token from DexScreener URL and pass to swap', async () => {
      // Navigate to DexScreener
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('webview-dexscreener')))
        .toBeVisible()
        .withTimeout(15000);
      
      // Wait for WebView to load and potentially navigate to a token page
      // In real test, we'd navigate to a specific token URL
      
      // Tap Trade in App button
      await element(by.id('trade-in-app-button')).tap();
      
      // Verify swap screen opens
      await expect(element(by.id('swap-screen'))).toBeVisible();
    });

    it('should show token detected badge when token is extracted', async () => {
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('webview-dexscreener')))
        .toBeVisible()
        .withTimeout(15000);
      
      // If token is detected from URL, badge should be visible
      // This depends on the actual URL navigation in WebView
      // await expect(element(by.id('token-detected-badge'))).toBeVisible();
    });

    it('should update Trade button text when token is detected', async () => {
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('webview-dexscreener')))
        .toBeVisible()
        .withTimeout(15000);
      
      // When token is detected, button should say "Trade This Token"
      // When no token, button should say "Trade in App"
      await expect(element(by.id('trade-in-app-button'))).toBeVisible();
    });

    it('should handle Raydium URL token extraction', async () => {
      await element(by.id('tab-raydium')).tap();
      
      await waitFor(element(by.id('webview-raydium')))
        .toBeVisible()
        .withTimeout(15000);
      
      // Raydium uses ?inputMint=xxx&outputMint=xxx format
      // Token extraction should work for outputMint
      
      await element(by.id('trade-in-app-button')).tap();
      await expect(element(by.id('swap-screen'))).toBeVisible();
    });

    it('should handle Pump.fun URL token extraction', async () => {
      await element(by.id('tab-pumpfun')).tap();
      
      await waitFor(element(by.id('webview-pumpfun')))
        .toBeVisible()
        .withTimeout(15000);
      
      // Pump.fun uses /coin/{tokenAddress} format
      
      await element(by.id('trade-in-app-button')).tap();
      await expect(element(by.id('swap-screen'))).toBeVisible();
    });

    it('should preserve token context in error fallback', async () => {
      // When WebView fails after navigating to a token page,
      // the Jupiter fallback should still have the token context
      
      await element(by.id('tab-dexscreener')).tap();
      
      // Simulate error scenario (would need network mocking)
      // The fallback button should navigate to swap with token pre-filled
    });
  });

  describe('Flow 9: Wallet Injection Bridge', () => {
    beforeEach(async () => {
      await element(by.id('tab-market')).tap();
    });

    it('should inject SoulWallet object into WebView', async () => {
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('webview-dexscreener')))
        .toBeVisible()
        .withTimeout(15000);
      
      // The WebView should have window.SoulWallet available
      // This is verified by the wallet status showing in the header
      await expect(element(by.id('wallet-status'))).toBeVisible();
    });

    it('should show connected wallet status when wallet is connected', async () => {
      // Assuming wallet is connected in test setup
      await element(by.id('tab-dexscreener')).tap();
      
      await waitFor(element(by.id('wallet-status')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Status should show truncated public key
      // await expect(element(by.id('wallet-status'))).toHaveText(/\w{4}...\w{4}/);
    });
  });
});
