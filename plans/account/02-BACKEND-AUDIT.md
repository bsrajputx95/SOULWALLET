# Account Settings - Backend Audit

## File: src/server/routers/account.ts

### Existing Endpoints

#### 1. getUserProfile (Query)
```typescript
// Returns: id, username, email, firstName, lastName, phone, dateOfBirth,
//          profileImage, defaultCurrency, language, twoFactorEnabled,
//          walletAddress, createdAt, updatedAt
```
**Status:** ✅ Working
**Issues:** None

#### 2. updateUserProfile (Mutation)
```typescript
// Input: username?, firstName?, lastName?, phone?, dateOfBirth?,
//        defaultCurrency?, language?
```
**Status:** ✅ Working
**Issues:**
- No email update (intentional - requires verification)
- No validation on phone format
- No validation on date format

#### 3. getSecuritySettings (Query)
```typescript
// Returns: userId, twoFactorEnabled, lastPasswordChange, loginAttempts,
//          lockedUntil, recoveryEmail
```
**Status:** ✅ Working
**Issues:** None

#### 4. updateSecuritySettings (Mutation)
```typescript
// Input: twoFactorEnabled?, recoveryEmail?
```
**Status:** ⚠️ Incomplete
**Issues:**
- Just sets a boolean flag for 2FA
- No actual TOTP secret generation
- No verification before enabling 2FA
- Should require password or OTP to change

#### 5. getWalletInfo (Query)
```typescript
// Returns: publicKey, walletType, isBackedUp, createdAt
```
**Status:** ✅ Working
**Issues:** None

#### 6. resetPassword (Mutation)
```typescript
// Input: currentPassword, newPassword
```
**Status:** ✅ Working
**Issues:**
- This is for authenticated password change
- Different from forgot password flow
- Should invalidate all sessions after change

#### 7. getWalletPrivateKey (Mutation)
```typescript
// Input: password
// Returns: success, privateKey (null), message
```
**Status:** ⚠️ Placeholder
**Issues:**
- Returns null - private key is client-side only
- This is correct for security, but UI should handle this

#### 8. getWalletRecoveryPhrase (Mutation)
```typescript
// Input: password
// Returns: success, recoveryPhrase (null), message
```
**Status:** ⚠️ Placeholder
**Issues:**
- Same as above - client-side only

#### 9. generateBackupCodes (Mutation)
```typescript
// Returns: success, codes (array of 10), message
```
**Status:** ✅ Working
**Issues:**
- Codes are hashed and stored
- Plain codes returned once (correct behavior)
- Should require 2FA to be enabled first

#### 10. uploadProfileImage (Mutation)
```typescript
// Input: imageBase64, mimeType
```
**Status:** ⚠️ Placeholder
**Issues:**
- Stores truncated base64 as data URL
- Should upload to cloud storage (S3, Cloudinary)
- No image validation (size, type)

#### 11. deleteAccount (Mutation)
```typescript
// Input: password, confirmText ("DELETE MY ACCOUNT")
```
**Status:** ✅ Working
**Issues:**
- Requires password verification
- Requires exact confirmation text
- Cascades delete to related data

---

## File: src/lib/services/auth.ts

### Relevant Methods for Account Settings

#### generateOTP()
```typescript
// Private method - generates 6-digit cryptographically secure OTP
```
**Status:** ✅ Working

#### requestPasswordReset(input)
```typescript
// Creates OTP record in database
// Returns generic message (doesn't reveal if email exists)
```
**Status:** ✅ Working
**Issues:**
- OTP is created but not sent (email service needed)
- Comment says "OTP will be sent via email service in the router"

#### verifyOTP(input)
```typescript
// Verifies OTP for password reset
// Sets 5-minute window for password reset
```
**Status:** ✅ Working

#### resetPassword(input)
```typescript
// Resets password using OTP
// Invalidates all sessions
// Logs activity
```
**Status:** ✅ Working

### Missing Methods

1. **sendVerificationOTP(email/phone, type)**
   - For email verification
   - For phone verification
   - For 2FA setup

2. **verifyEmailOTP(email, otp)**
   - Mark email as verified

3. **verifyPhoneOTP(phone, otp)**
   - Mark phone as verified

4. **setupTOTP(userId)**
   - Generate TOTP secret
   - Return QR code data

5. **verifyTOTP(userId, code)**
   - Verify TOTP code
   - Enable 2FA if valid

6. **getActiveSessions(userId)**
   - List all active sessions

7. **revokeSession(userId, sessionId)**
   - Invalidate specific session

---

## File: prisma/schema.prisma

### Relevant Models

#### User
```prisma
model User {
  // ... existing fields
  failedLoginAttempts Int?
  lockedUntil         DateTime?
  // Missing: emailVerified, phoneVerified, totpSecret
}
```

#### UserSettings
```prisma
model UserSettings {
  security      Json?  // Contains twoFactorEnabled, backupCodes, etc.
  preferences   Json?  // Contains phone, dateOfBirth, etc.
}
```

#### OTP
```prisma
model OTP {
  email     String
  code      String
  type      OTPType  // RESET_PASSWORD, VERIFY_EMAIL, etc.
  expiresAt DateTime
  used      Boolean
}
```

### Schema Changes Needed

1. **Add to User model:**
```prisma
emailVerified    Boolean  @default(false)
phoneVerified    Boolean  @default(false)
phone            String?
totpSecret       String?  // Encrypted TOTP secret
totpEnabled      Boolean  @default(false)
```

2. **Add OTPType enum values:**
```prisma
enum OTPType {
  RESET_PASSWORD
  VERIFY_EMAIL
  VERIFY_PHONE
  TWO_FACTOR_SETUP
}
```

---

## Missing Backend Functionality

### Priority 1: OTP Infrastructure
1. **Email OTP Sending**
   - Integrate email service (SendGrid/Resend)
   - Create email templates
   - Add rate limiting

2. **SMS OTP Sending** (Optional)
   - Integrate Twilio or similar
   - Add rate limiting
   - Handle international numbers

### Priority 2: 2FA Implementation
3. **TOTP Setup**
   - Generate secret using `otplib`
   - Store encrypted secret
   - Generate QR code URL

4. **TOTP Verification**
   - Verify code against secret
   - Handle time drift
   - Backup code fallback

### Priority 3: Session Management
5. **List Sessions**
   - Return all active sessions
   - Include device info, location, last activity

6. **Revoke Session**
   - Delete specific session
   - Log security event

### Priority 4: Verification Flows
7. **Email Verification**
   - Send OTP to email
   - Verify and mark verified

8. **Phone Verification**
   - Send OTP via SMS
   - Verify and mark verified

---

## API Endpoints to Add

### Auth Router (src/server/routers/auth.ts)

```typescript
// Send OTP for various purposes
sendOTP: publicProcedure
  .input(z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    type: z.enum(['VERIFY_EMAIL', 'VERIFY_PHONE', 'TWO_FACTOR_SETUP']),
  }))
  .mutation(...)

// Verify email
verifyEmail: protectedProcedure
  .input(z.object({ otp: z.string().length(6) }))
  .mutation(...)

// Verify phone
verifyPhone: protectedProcedure
  .input(z.object({ otp: z.string().length(6) }))
  .mutation(...)
```

### Account Router (src/server/routers/account.ts)

```typescript
// Setup TOTP 2FA
setupTOTP: protectedProcedure
  .input(z.object({ password: z.string() }))
  .mutation(...)
  // Returns: secret, qrCodeUrl, backupCodes

// Verify and enable TOTP
enableTOTP: protectedProcedure
  .input(z.object({ code: z.string().length(6) }))
  .mutation(...)

// Disable 2FA
disableTOTP: protectedProcedure
  .input(z.object({ 
    password: z.string(),
    code: z.string().length(6) 
  }))
  .mutation(...)

// Get active sessions
getActiveSessions: protectedProcedure
  .query(...)

// Revoke session
revokeSession: protectedProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(...)

// Revoke all other sessions
revokeAllOtherSessions: protectedProcedure
  .mutation(...)
```

---

## Security Considerations

1. **Rate Limiting**
   - OTP requests: 3 per 10 minutes per email/phone
   - Password changes: 3 per hour
   - 2FA setup: 5 per day

2. **OTP Security**
   - 6-digit codes
   - 10-minute expiry
   - Single use
   - Cryptographically secure generation

3. **TOTP Security**
   - Encrypt secret at rest
   - Allow 30-second time drift
   - Require password to setup/disable

4. **Session Security**
   - Log all session events
   - Detect suspicious activity
   - Auto-revoke on password change

---

## Summary of Backend Work

### Must Do
- [ ] Add email sending service integration
- [ ] Add sendOTP endpoint for email verification
- [ ] Add verifyEmail endpoint
- [ ] Connect password reset to email service
- [ ] Add proper rate limiting

### Should Do
- [ ] Add TOTP 2FA implementation
- [ ] Add session management endpoints
- [ ] Add phone verification (if SMS service available)
- [ ] Update schema for verification status

### Nice to Have
- [ ] Add security audit logging
- [ ] Add device fingerprinting
- [ ] Add location-based session info
