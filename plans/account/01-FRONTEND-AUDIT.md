# Account Settings - Frontend Audit

## File: app/account.tsx (1100 lines)

### Current Features

#### Profile Information Section
- ✅ Profile image display with placeholder
- ✅ Camera button for image upload (UI only)
- ✅ First name input
- ✅ Last name input
- ✅ Email input
- ✅ Phone number input
- ✅ Date of birth input

#### Security & Privacy Section
- ✅ Reset Password button → opens modal
- ✅ Two-Factor Authentication toggle → opens modal

#### App Settings Section
- ✅ Default Currency input
- ✅ Language input

#### Social Section
- ✅ Invite Friends button (shows referral code alert)

### Password Reset Modal (3 Steps)

**Step 1: Contact Method Selection**
```
- Email/Phone toggle selector
- Input field for email or phone
- "Send Code" button
```
**Issue:** `handlePasswordResetNext()` only shows Alert, doesn't call backend

**Step 2: OTP Verification**
```
- 6-digit OTP input
- "Verify" button
```
**Issue:** No backend verification, just checks length === 6

**Step 3: New Password**
```
- New password input
- Confirm password input
- "Reset Password" button
```
**Issue:** No backend call, just shows success alert

### Two-Factor Authentication Modal (4 Steps)

**Step 1: Current Verification**
```
- Email/Phone toggle
- Input for current email/phone
- "Send Code" button
```
**Issue:** Simulated OTP send

**Step 2: Verify Current Method**
```
- 6-digit OTP input
- "Verify" button
```
**Issue:** No real verification

**Step 3: New 2FA Method Setup**
```
- Email/Phone toggle for new method
- Input for new email/phone
- "Send Code" button
```
**Issue:** Simulated

**Step 4: Verify New Method**
```
- 6-digit OTP input
- "Activate 2FA" button
```
**Issue:** Just sets local state, calls updateSecurity({ twoFactorEnabled: true })

### Critical Issues

1. **No Real OTP Integration**
   - Password reset OTP is simulated
   - 2FA OTP is simulated
   - No backend calls for OTP send/verify

2. **No TOTP/Authenticator Support**
   - 2FA is just email/phone OTP
   - No Google Authenticator integration
   - No QR code generation

3. **Missing Features**
   - No delete account option
   - No backup codes display
   - No session management
   - No email verification status
   - No phone verification status

4. **State Management Issues**
   - Form state initialized from profile but doesn't update when profile changes
   - No form validation before submission
   - No loading states during OTP operations

### Fixes Required

#### High Priority
1. Connect password reset modal to `auth.requestPasswordReset` and `auth.resetPassword`
2. Connect 2FA modal to real OTP endpoints
3. Add proper loading states during async operations
4. Add form validation with error messages

#### Medium Priority
5. Add delete account section with confirmation modal
6. Add backup codes section (generate, display, copy)
7. Add email/phone verification status indicators
8. Sync form state with profile data on mount

#### Low Priority
9. Add session management section
10. Add security audit log section
11. Improve date picker for DOB

---

## File: app/settings.tsx (400 lines)

### Current Features

#### User Info Card
- ✅ Username display
- ✅ Email display

#### Wallet Not Connected Warning
- ✅ Shows when no wallet
- ✅ Create Wallet button
- ✅ Import Wallet button

#### Wallet Information Section (when wallet exists)
- ✅ Public key display with copy
- ✅ Private key display with show/hide toggle
- ✅ Recovery phrase display with show/hide toggle
- ✅ Share Wallet Address button

#### Account Linking Section
- ⚠️ Link Gmail Account (simulated)
- ⚠️ Link Mobile Number (simulated)

#### Support Section
- ⚠️ Email Support (placeholder)
- ⚠️ Phone Support (placeholder)
- ⚠️ Help Center (placeholder)

#### Security Warning Card
- ✅ Warning about not sharing private key

### Issues

1. **Wallet Data Source**
   - Uses `user?.walletData` which may not exist
   - Private key/mnemonic shown as "No wallet connected" fallback
   - Should use secure storage, not user object

2. **Account Linking is Fake**
   - Gmail linking just shows alert
   - Mobile linking just shows alert
   - No OAuth or verification flow

3. **Support Links are Placeholders**
   - No real email/phone/help center URLs

### Fixes Required

1. Get wallet data from secure storage, not user object
2. Remove or implement account linking properly
3. Add real support links or remove section
4. Add logout button
5. Add app version display

---

## File: hooks/account-store.ts

### Current Implementation
- ✅ Uses tRPC queries for profile, security, wallet
- ✅ Uses tRPC mutations for updates
- ✅ Proper loading/updating states
- ✅ Error handling with logger
- ⚠️ Has @ts-ignore comments (type issues)

### Issues

1. **Type Ignores**
   - Multiple `@ts-ignore` comments for tRPC calls
   - Should fix types properly

2. **Missing OTP Operations**
   - No sendOtp function
   - No verifyOtp function
   - These are needed for password reset and 2FA

3. **Missing Session Operations**
   - No getActiveSessions
   - No revokeSession

### Fixes Required

1. Add OTP send/verify functions
2. Add session management functions
3. Fix TypeScript types (remove @ts-ignore)
4. Add proper error types

---

## Summary of Frontend Work

### Must Do
- [ ] Wire password reset modal to real backend
- [ ] Wire 2FA modal to real backend
- [ ] Add loading states for all async operations
- [ ] Add proper form validation
- [ ] Fix TypeScript errors in account-store

### Should Do
- [ ] Add delete account UI
- [ ] Add backup codes UI
- [ ] Add verification status indicators
- [ ] Fix wallet data source in settings.tsx

### Nice to Have
- [ ] Add session management UI
- [ ] Add security audit log
- [ ] Improve date picker
- [ ] Add real support links
