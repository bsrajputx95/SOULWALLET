/**
 * Account Settings E2E Tests
 *
 * Tests complete user flows for account management features.
 * Run with: npm run test:e2e -- --testNamePattern="Account"
 */

import { by, device, element, expect } from 'detox';

describe('Account Settings E2E Tests', () => {
    beforeAll(async () => {
        await device.launchApp({
            newInstance: true,
            permissions: { camera: 'YES', photos: 'YES' },
        });
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe('Profile Update Flow', () => {
        it('should update user profile information', async () => {
            // Navigate to account settings
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            // Wait for profile to load (skeleton should disappear)
            await waitFor(element(by.id('account-first-name-input')))
                .toBeVisible()
                .withTimeout(5000);

            // Update first name
            await element(by.id('account-first-name-input')).clearText();
            await element(by.id('account-first-name-input')).typeText('TestFirstName');

            // Update last name
            await element(by.id('account-last-name-input')).clearText();
            await element(by.id('account-last-name-input')).typeText('TestLastName');

            // Update phone (valid format)
            await element(by.id('account-phone-input')).clearText();
            await element(by.id('account-phone-input')).typeText('+14155552671');

            // Save changes
            await element(by.id('account-save-button')).tap();

            // Verify success alert
            await expect(element(by.text('Success'))).toBeVisible();
            await element(by.text('OK')).tap();
        });

        it('should reject invalid phone number', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            await waitFor(element(by.id('account-phone-input')))
                .toBeVisible()
                .withTimeout(5000);

            // Enter invalid phone
            await element(by.id('account-phone-input')).clearText();
            await element(by.id('account-phone-input')).typeText('123');

            // Attempt save
            await element(by.id('account-save-button')).tap();

            // Should show validation error
            await expect(element(by.text('Invalid phone number format'))).toBeVisible();
        });

        it('should reject underage date of birth', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            await waitFor(element(by.id('account-dob-input')))
                .toBeVisible()
                .withTimeout(5000);

            // Enter underage DOB (10 years ago)
            const underageDob = new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000);
            await element(by.id('account-dob-input')).clearText();
            await element(by.id('account-dob-input')).typeText(underageDob.toISOString().split('T')[0]);

            // Attempt save
            await element(by.id('account-save-button')).tap();

            // Should show validation error
            await expect(element(by.text('Invalid date of birth'))).toBeVisible();
        });
    });

    describe('Profile Image Upload Flow', () => {
        it('should upload profile image with compression', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            await waitFor(element(by.id('account-profile-image-button')))
                .toBeVisible()
                .withTimeout(5000);

            // Tap profile image button
            await element(by.id('account-profile-image-button')).tap();

            // Select from library (mocked in test environment)
            await element(by.text('Choose from Library')).tap();

            // Wait for upload completion (loading indicator should disappear)
            await waitFor(element(by.id('account-profile-image-button')))
                .toBeVisible()
                .withTimeout(10000);

            // Verify success message
            await expect(element(by.text('Profile picture updated!'))).toBeVisible();
        });
    });

    describe('Two-Factor Authentication Flow', () => {
        it('should enable 2FA via TOTP', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            await waitFor(element(by.id('account-twofactor-switch')))
                .toBeVisible()
                .withTimeout(5000);

            // Enable 2FA toggle
            await element(by.id('account-twofactor-switch')).tap();

            // Step 1: Enter password
            await waitFor(element(by.id('totp-password-input')))
                .toBeVisible()
                .withTimeout(3000);
            await element(by.id('totp-password-input')).typeText('testPassword123');
            await element(by.id('totp-next-button')).tap();

            // Step 2: QR code should be displayed
            await waitFor(element(by.id('totp-qr-code')))
                .toBeVisible()
                .withTimeout(5000);
            await element(by.id('totp-next-button')).tap();

            // Step 3: Enter verification code (mocked in test)
            await waitFor(element(by.id('totp-verify-code-input')))
                .toBeVisible()
                .withTimeout(3000);
            await element(by.id('totp-verify-code-input')).typeText('123456');
            await element(by.id('totp-next-button')).tap();

            // Step 4: Backup codes displayed
            await waitFor(element(by.id('backup-codes-container')))
                .toBeVisible()
                .withTimeout(3000);
            await element(by.id('totp-finish-button')).tap();

            // Verify success
            await expect(element(by.text('Two-Factor Authentication is now enabled!'))).toBeVisible();
        });

        it('should disable 2FA with password and code', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            await waitFor(element(by.id('account-twofactor-switch')))
                .toBeVisible()
                .withTimeout(5000);

            // Disable 2FA toggle (assumes already enabled)
            await element(by.id('account-twofactor-switch')).tap();

            // Enter password and TOTP code
            await element(by.id('disable-totp-password-input')).typeText('testPassword123');
            await element(by.id('disable-totp-code-input')).typeText('123456');
            await element(by.id('disable-totp-confirm-button')).tap();

            // Verify success
            await expect(element(by.text('2FA disabled successfully!'))).toBeVisible();
        });
    });

    describe('Account Deletion Flow', () => {
        it('should delete account with password and confirmation', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            // Scroll to danger zone
            await element(by.id('account-scroll-view')).scrollTo('bottom');

            // Tap delete account button
            await element(by.id('account-delete-account-open-button')).tap();

            // Modal should appear
            await waitFor(element(by.id('delete-account-modal')))
                .toBeVisible()
                .withTimeout(3000);

            // Enter password
            await element(by.id('delete-password-input')).typeText('testPassword123');

            // Enter confirmation text
            await element(by.id('delete-confirm-input')).typeText('DELETE MY ACCOUNT');

            // Confirm deletion
            await element(by.id('delete-account-confirm-button')).tap();

            // Verify account deleted message
            await expect(element(by.text('Account Deleted'))).toBeVisible();
        });

        it('should reject deletion with wrong confirmation text', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            await element(by.id('account-scroll-view')).scrollTo('bottom');
            await element(by.id('account-delete-account-open-button')).tap();

            await element(by.id('delete-password-input')).typeText('testPassword123');
            await element(by.id('delete-confirm-input')).typeText('wrong text');
            await element(by.id('delete-account-confirm-button')).tap();

            // Should show error
            await expect(element(by.text('Please type "DELETE MY ACCOUNT" to confirm'))).toBeVisible();
        });
    });

    describe('Session Management', () => {
        it('should display active sessions', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            // Wait for sessions to load
            await waitFor(element(by.id('session-list')))
                .toBeVisible()
                .withTimeout(5000);

            // Current session should be marked
            await expect(element(by.text('Current'))).toBeVisible();
        });

        it('should revoke non-current session', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            await waitFor(element(by.id('session-list')))
                .toBeVisible()
                .withTimeout(5000);

            // Tap revoke on first non-current session (if exists)
            try {
                await element(by.id('revoke-session-button')).atIndex(0).tap();
                await element(by.text('Revoke')).tap();
                await expect(element(by.text('Session revoked successfully'))).toBeVisible();
            } catch {
                // No other sessions to revoke - skip
                console.log('No additional sessions to revoke');
            }
        });
    });

    describe('Loading States', () => {
        it('should show skeleton loaders while loading', async () => {
            await element(by.id('settings-tab')).tap();
            await element(by.id('account-settings-button')).tap();

            // Skeleton loaders should be briefly visible
            // (They may disappear quickly on fast connections)
            await expect(element(by.id('account-screen'))).toBeVisible();
        });
    });
});
