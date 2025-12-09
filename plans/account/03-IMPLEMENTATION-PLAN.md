# Account Settings - Implementation Plan

## Summary of Current State

### What's Already Working ✅
1. **Backend Auth Router** - Full session management, OTP for password reset
2. **Email Service** - Password reset, welcome, suspicious login, lockout emails
3. **Account Router** - Profile CRUD, security settings, backup codes
4. **Account Store** - tRPC integration for all account operations

### What Needs Fixing ⚠️
1. **Frontend Password Reset Modal** - Not connected to backend
2. **Frontend 2FA Modal** - Simulated, not connected to backend
3. **2FA Implementation** - Just a boolean flag, no real TOTP
4. **Email Verification** - No endpoint or UI
5. **Phone Verification** - No endpoint or UI

## Implementation Phases

---

## Phase 1: Connect Password Reset Modal to Backend

### Current Flow (Broken)
```
User clicks "Reset Password" → Modal opens → User enters email → 
Alert.alert("OTP Sent") → User enters OTP → Alert.alert("Verified") → 
User enters new password → Alert.alert("Success")
```

### Target Flow (Working)
```
User clicks "Reset Password" → Modal opens → User enters email → 
API: auth.requestPasswordReset → Email sent with OTP → 
User enters OTP → API: auth.verifyOtp → 
User enters new password → API: auth.resetPassword → Success
```

### Changes Required

#### app/account.tsx
1. Import trpc client
2. Add mutation hooks for password reset flow
3. Replace Alert.alert with actual API calls
4. Add loading states during API calls
5. Add error handling with user-friendly messages

```typescript
// Add to imports
import { trpc } from '../lib/trpc';

// Add mutations
const requestResetMutation = trpc.auth.requestPasswordReset.useMutation();
const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
const resetPasswordMutation = trpc.auth.resetPassword.useMutation();

// Update handlePasswordResetNext
const handlePasswordResetNext = async () => {
  if (passwordResetStep === 1) {
    try {
      setIsLoading(true);
      await requestResetMutation.mutateAsync({ email: resetContactValue });
      setPasswordResetStep(2);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  }
  // ... similar for steps 2 and 3
};
```

---

## Phase 2: Add Email Verification Flow

### New Backend Endpoints Needed

#### src/server/routers/auth.ts
```typescript
// Send email verification OTP
sendEmailVerification: protectedProcedure
  .mutation(async ({ ctx }) => {
    // Generate OTP
    // Store in DB with type VERIFY_EMAIL
    // Send email
    return { success: true, message: 'Verification code sent' };
  }),

// Verify email
verifyEmail: protectedProcedure
  .input(z.object({ otp: z.string().length(6) }))
  .mutation(async ({ ctx, input }) => {
    // Verify OTP
    // Update user.emailVerified = true
    return { success: true, message: 'Email verified' };
  }),
```

### Schema Changes
```prisma
// Add to User model
emailVerified    Boolean  @default(false)
emailVerifiedAt  DateTime?
```

### Frontend Changes
- Add verification status indicator in profile section
- Add "Verify Email" button if not verified
- Add OTP input modal for verification

---

## Phase 3: Implement Real 2FA with TOTP

### Dependencies to Add
```bash
npm install otplib qrcode
```

### New Backend Service: src/lib/services/twoFactor.ts
```typescript
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export class TwoFactorService {
  static generateSecret(email: string): { secret: string; qrCodeUrl: string } {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'Soul Wallet', secret);
    return { secret, qrCodeUrl: otpauth };
  }

  static async generateQRCode(otpauth: string): Promise<string> {
    return QRCode.toDataURL(otpauth);
  }

  static verifyToken(secret: string, token: string): boolean {
    return authenticator.verify({ token, secret });
  }
}
```

### New Backend Endpoints

#### src/server/routers/account.ts
```typescript
// Setup TOTP - returns secret and QR code
setupTOTP: protectedProcedure
  .input(z.object({ password: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Verify password
    // Generate TOTP secret
    // Store encrypted secret (not enabled yet)
    // Return QR code data URL
  }),

// Enable TOTP - verifies code and enables 2FA
enableTOTP: protectedProcedure
  .input(z.object({ code: z.string().length(6) }))
  .mutation(async ({ ctx, input }) => {
    // Verify code against stored secret
    // Enable 2FA
    // Generate backup codes
    // Return backup codes
  }),

// Disable TOTP
disableTOTP: protectedProcedure
  .input(z.object({ password: z.string(), code: z.string().length(6) }))
  .mutation(async ({ ctx, input }) => {
    // Verify password
    // Verify TOTP code
    // Disable 2FA
    // Clear secret
  }),
```

### Schema Changes
```prisma
// Add to User model
totpSecret       String?   // Encrypted
totpEnabled      Boolean   @default(false)
totpEnabledAt    DateTime?
```

### Frontend Changes
1. Update 2FA modal to show QR code
2. Add authenticator app instructions
3. Show backup codes after enabling
4. Add "Disable 2FA" flow with verification

---

## Phase 4: Add Session Management UI

### Backend Already Exists ✅
- `auth.getSessions` - List all sessions
- `auth.revokeSession` - Revoke specific session
- `auth.getSessionActivity` - Get activity log

### Frontend Changes

#### app/account.tsx - Add Sessions Section
```typescript
// Add to Security & Privacy section
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Active Sessions</Text>
  
  {sessions.map(session => (
    <View key={session.id} style={styles.sessionItem}>
      <View>
        <Text>{session.userAgent}</Text>
        <Text>{session.ipAddress}</Text>
        <Text>{session.lastActivityAt}</Text>
        {session.current && <Badge>Current</Badge>}
      </View>
      {!session.current && (
        <TouchableOpacity onPress={() => revokeSession(session.id)}>
          <Text>Revoke</Text>
        </TouchableOpacity>
      )}
    </View>
  ))}
</View>
```

---

## Phase 5: Polish & Security

### Add Delete Account UI
- Add "Delete Account" button in settings
- Confirmation modal with password + "DELETE MY ACCOUNT" text
- Call `account.deleteAccount` mutation
- Redirect to login on success

### Add Backup Codes UI
- Show "Generate Backup Codes" button when 2FA enabled
- Display codes in modal (one-time view)
- Copy all codes button
- Warning about storing securely

### Add Security Audit Log
- Show recent security events
- Login attempts, password changes, 2FA changes
- Use `auth.getSessionActivity` endpoint

---

## File Changes Summary

### Files to Modify
| File | Changes |
|------|---------|
| `app/account.tsx` | Connect modals to backend, add sessions UI, add delete account |
| `hooks/account-store.ts` | Add OTP mutations, fix TypeScript errors |
| `src/server/routers/auth.ts` | Add email verification endpoints |
| `src/server/routers/account.ts` | Add TOTP setup/enable/disable endpoints |
| `prisma/schema.prisma` | Add emailVerified, totpSecret, totpEnabled fields |

### New Files to Create
| File | Purpose |
|------|---------|
| `src/lib/services/twoFactor.ts` | TOTP generation and verification |
| `components/account/SessionsList.tsx` | Sessions list component |
| `components/account/BackupCodesModal.tsx` | Backup codes display |
| `components/account/DeleteAccountModal.tsx` | Delete account confirmation |

---

## Testing Checklist

### Password Reset Flow
- [ ] Request reset sends email
- [ ] OTP verification works
- [ ] Password reset completes
- [ ] All sessions invalidated after reset
- [ ] Error handling for invalid OTP
- [ ] Rate limiting works

### 2FA Flow
- [ ] QR code generates correctly
- [ ] Authenticator app can scan QR
- [ ] Code verification works
- [ ] Backup codes generated
- [ ] Disable 2FA works
- [ ] Login requires 2FA when enabled

### Session Management
- [ ] Sessions list loads
- [ ] Current session marked
- [ ] Revoke session works
- [ ] Activity log displays

### Email Verification
- [ ] Verification email sends
- [ ] OTP verification works
- [ ] Status updates in UI

---

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Password Reset | 2-3 hours | HIGH |
| Phase 2: Email Verification | 3-4 hours | MEDIUM |
| Phase 3: Real 2FA | 4-6 hours | HIGH |
| Phase 4: Session Management UI | 2-3 hours | MEDIUM |
| Phase 5: Polish | 3-4 hours | LOW |

**Total: 14-20 hours**
