# Account Settings - Master Plan

## Overview

This document outlines the comprehensive audit and fixes needed to make the Account Settings screen production-ready. The account settings page is accessed from the home screen by tapping on the username.

## Current State Analysis

### Frontend (app/account.tsx)
- ✅ Basic UI structure exists with profile, security, and app settings sections
- ✅ Password reset modal with 3-step flow (email/phone → OTP → new password)
- ✅ Two-factor authentication modal with 4-step flow
- ⚠️ OTP verification is SIMULATED (Alert.alert only, no real backend call)
- ⚠️ 2FA setup is SIMULATED (no real TOTP/authenticator integration)
- ⚠️ Profile image upload button exists but no real implementation
- ⚠️ No email verification flow
- ⚠️ No phone verification flow
- ❌ Missing: Delete account functionality in UI
- ❌ Missing: Session management (view/revoke active sessions)
- ❌ Missing: Backup codes display/regeneration UI

### Frontend (app/settings.tsx)
- ✅ Wallet information display (public key, private key, recovery phrase)
- ✅ Share wallet address functionality
- ⚠️ Account linking (Gmail, Mobile) is SIMULATED
- ⚠️ Support options are placeholder alerts

### Backend (src/server/routers/account.ts)
- ✅ getUserProfile - fetches user profile with settings
- ✅ updateUserProfile - updates profile fields
- ✅ getSecuritySettings - fetches 2FA status, login attempts
- ✅ updateSecuritySettings - toggles 2FA flag (but no real 2FA)
- ✅ getWalletInfo - fetches wallet public key
- ✅ resetPassword - changes password (requires current password)
- ✅ getWalletPrivateKey - placeholder (returns null, client-side storage)
- ✅ getWalletRecoveryPhrase - placeholder (returns null, client-side storage)
- ✅ generateBackupCodes - generates and hashes 10 backup codes
- ✅ uploadProfileImage - placeholder (stores truncated base64)
- ✅ deleteAccount - deletes user with password + confirmation
- ❌ Missing: Real 2FA with TOTP (Google Authenticator)
- ❌ Missing: Send OTP for email/phone verification
- ❌ Missing: Verify OTP for email/phone
- ❌ Missing: Session management endpoints

### Backend (src/lib/services/auth.ts)
- ✅ OTP generation (cryptographically secure 6-digit)
- ✅ OTP verification for password reset
- ✅ Session management with fingerprinting
- ✅ Brute-force protection
- ✅ Suspicious activity detection
- ⚠️ OTP is only used for password reset, not for 2FA or verification

## Critical Issues to Fix

### Priority 1: Security (Must Fix)
1. **Real 2FA Implementation** - Currently just a boolean flag, need TOTP
2. **OTP for Account Verification** - Email/phone verification with real OTP
3. **Session Management** - View and revoke active sessions
4. **Rate Limiting on Sensitive Operations** - Password changes, 2FA setup

### Priority 2: Functionality (Should Fix)
5. **Connect Password Reset Modal to Backend** - Currently simulated
6. **Connect 2FA Setup Modal to Backend** - Currently simulated
7. **Email Verification Flow** - Send OTP, verify, mark verified
8. **Phone Verification Flow** - Send OTP via SMS, verify
9. **Profile Image Upload** - Real cloud storage integration

### Priority 3: UX Improvements (Nice to Have)
10. **Delete Account UI** - Add to settings with confirmation
11. **Backup Codes UI** - Display, copy, regenerate
12. **Active Sessions UI** - List sessions, revoke option
13. **Security Audit Log** - Show recent security events

## Scope Exclusions (Next Version)
- Profile picture upload (per user request)
- OAuth linking (Google, Apple sign-in)
- Biometric authentication

## Files to Modify

### Frontend
- `app/account.tsx` - Main account settings screen
- `app/settings.tsx` - Wallet settings screen
- `hooks/account-store.ts` - Account state management

### Backend
- `src/server/routers/account.ts` - Account API endpoints
- `src/server/routers/auth.ts` - Auth endpoints (OTP sending)
- `src/lib/services/auth.ts` - Auth service (OTP logic)
- `prisma/schema.prisma` - May need schema updates for 2FA

### New Files
- `src/lib/services/twoFactor.ts` - TOTP service
- `src/lib/services/sms.ts` - SMS sending service (Twilio)
- `src/lib/services/email.ts` - Email sending service

## Implementation Order

1. **Phase 1: Backend OTP Infrastructure**
   - Add OTP sending endpoints (email/SMS)
   - Add OTP verification endpoints
   - Add rate limiting

2. **Phase 2: Connect Frontend to Backend**
   - Wire up password reset modal to real API
   - Wire up 2FA setup modal to real API
   - Add proper error handling

3. **Phase 3: Real 2FA with TOTP**
   - Implement TOTP generation/verification
   - Add QR code for authenticator apps
   - Add backup codes flow

4. **Phase 4: Session Management**
   - Add session list endpoint
   - Add session revoke endpoint
   - Add UI for session management

5. **Phase 5: Polish & Security**
   - Add security audit logging
   - Add delete account UI
   - Final security review

## Dependencies
- `otplib` or `speakeasy` - For TOTP generation
- `qrcode` - For QR code generation
- Twilio or similar - For SMS OTP (optional, can use email only)
- SendGrid/Resend - For email OTP

## Success Criteria
- [ ] Password reset works end-to-end with real OTP
- [ ] 2FA can be enabled/disabled with proper verification
- [ ] Users can view and revoke active sessions
- [ ] All sensitive operations are rate-limited
- [ ] Proper error messages for all failure cases
- [ ] No simulated/mock functionality in production
