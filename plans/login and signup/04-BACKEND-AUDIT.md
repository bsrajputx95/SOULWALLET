# Backend Audit - Authentication System

## Overview

This document audits the backend authentication system for security, functionality, and best practices.

---

## Current Architecture

### Files Analyzed
- `src/server/routers/auth.ts` - API endpoints
- `src/lib/services/auth.ts` - Business logic
- `src/lib/validations/auth.ts` - Input validation
- `src/lib/middleware/auth.ts` - Authentication middleware
- `src/lib/middleware/rateLimit.ts` - Rate limiting
- `src/server/fastify.ts` - Server configuration
- `prisma/schema.prisma` - Database schema

### Security Features Already Implemented ✅

1. **Password Hashing**: bcrypt with 12 rounds
2. **JWT with Refresh Tokens**: Short-lived access tokens (15m), longer refresh tokens (7d)
3. **Rate Limiting**: Per-endpoint rate limits
4. **Account Lockout**: After 5 failed attempts, 30-minute lockout
5. **Session Management**: Multiple sessions tracked, can revoke
6. **CSRF Protection**: Double-submit cookie pattern (when enabled)
7. **Input Sanitization**: XSS prevention via sanitization middleware
8. **Suspicious Activity Detection**: Multiple IP/user agent detection
9. **Audit Logging**: Session activities logged
10. **OTP for Password Reset**: 6-digit, 10-minute expiry

---

## 🔴 Critical Security Issues

### Issue 1: JWT Secret Rotation Not Fully Implemented

**File**: `src/lib/services/auth.ts`

**Current Code**:
```typescript
private static readonly JWT_SECRETS: string[] = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret.split(',').map(s => s.trim());
})();
```

**Problem**: While the code supports multiple secrets for rotation, there's no automated rotation mechanism.

**Recommendation**: Document the manual rotation process:
```markdown
## JWT Secret Rotation Process

1. Generate new secret: `openssl rand -base64 32`
2. Update JWT_SECRET to: `new_secret,old_secret`
3. Deploy changes
4. After JWT_EXPIRES_IN + buffer (e.g., 1 hour), remove old secret
5. Update JWT_SECRET to: `new_secret`
```

### Issue 2: OTP Generation Uses Math.random()

**File**: `src/lib/services/auth.ts`

**Current Code**:
```typescript
private static generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
```

**Problem**: `Math.random()` is not cryptographically secure.

**Solution**:
```typescript
import crypto from 'crypto';

private static generateOTP(): string {
  // Generate cryptographically secure random number
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  // Map to 6-digit range (100000-999999)
  const otp = 100000 + (randomNumber % 900000);
  return otp.toString();
}
```

### Issue 3: Password Reset Doesn't Invalidate OTP Immediately

**File**: `src/lib/services/auth.ts`

**Current Flow**:
1. User requests reset → OTP created
2. User verifies OTP → OTP marked as valid (but not used)
3. User sets new password → OTP marked as used

**Problem**: Between steps 2 and 3, the OTP could potentially be reused.

**Solution**: Mark OTP as used during verification, not password reset:
```typescript
static async verifyOTP(input: VerifyOtpInput) {
  try {
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: input.email.toLowerCase(),
        code: input.otp,
        type: OTPType.RESET_PASSWORD,
        expiresAt: { gt: new Date() },
        used: false,
      },
    });

    if (!otpRecord) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid or expired OTP',
      });
    }

    // Mark as used immediately to prevent reuse
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Generate a temporary reset token for the password reset step
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Store reset token (could use Redis or a new DB field)
    // For now, we'll use the OTP record's ID as a reference
    
    return {
      message: 'OTP verified successfully',
      isValid: true,
      resetToken, // Return this for the password reset step
    };
  } catch (error) {
    // ...
  }
}
```

---

## 🟡 High Priority Issues

### Issue 4: No Password History Check

**Problem**: Users can reuse old passwords.

**Solution**: Add password history table:
```prisma
model PasswordHistory {
  id        String   @id @default(cuid())
  userId    String
  password  String   // hashed
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, createdAt])
  @@map("password_history")
}
```

```typescript
// In AuthService.resetPassword
const recentPasswords = await prisma.passwordHistory.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
  take: 5, // Check last 5 passwords
});

for (const history of recentPasswords) {
  if (await bcrypt.compare(input.newPassword, history.password)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot reuse recent passwords',
    });
  }
}

// After password update, save to history
await prisma.passwordHistory.create({
  data: {
    userId: user.id,
    password: hashedPassword,
  },
});
```

### Issue 5: Session Fingerprint Validation Not Strict

**File**: `src/lib/services/auth.ts`

**Current**: Sessions store IP and user agent but don't validate on subsequent requests.

**Solution**: Add fingerprint validation middleware:
```typescript
// In auth middleware
if (process.env.SESSION_FINGERPRINT_STRICT === 'true') {
  const currentIP = ctx.req.ip;
  const currentUA = ctx.req.headers['user-agent'];
  
  if (session.ipAddress && session.ipAddress !== currentIP) {
    // Log suspicious activity
    await AuthService.logSessionActivity({
      sessionId: session.id,
      userId: session.userId,
      action: 'IP_MISMATCH',
      ipAddress: currentIP,
      userAgent: currentUA,
      suspicious: true,
      metadata: { originalIP: session.ipAddress },
    });
    
    // Optionally invalidate session
    // throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Session invalid' });
  }
}
```

### Issue 6: Email Enumeration Possible on Login

**File**: `src/lib/services/auth.ts`

**Current Code**:
```typescript
if (!user) {
  await this.trackLoginAttempt({
    identifier,
    ipAddress,
    successful: false,
    failureReason: 'User not found',
  });
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Invalid email/username or password',
  });
}
```

**Status**: ✅ Already correct - same error message for user not found and wrong password.

### Issue 7: Missing Brute Force Protection on OTP Verification

**File**: `src/server/routers/auth.ts`

**Current**: Rate limiting exists but no account-level lockout for OTP attempts.

**Solution**:
```typescript
// Track OTP verification attempts
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_MINUTES = 30;

// Before verifying OTP
const recentAttempts = await prisma.loginAttempt.count({
  where: {
    identifier: input.email.toLowerCase(),
    action: 'OTP_VERIFY',
    successful: false,
    createdAt: { gte: new Date(Date.now() - OTP_LOCKOUT_MINUTES * 60 * 1000) },
  },
});

if (recentAttempts >= MAX_OTP_ATTEMPTS) {
  throw new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: `Too many verification attempts. Try again in ${OTP_LOCKOUT_MINUTES} minutes.`,
  });
}
```

---

## 🟢 Medium Priority Issues

### Issue 8: Cleanup Service Timing

**File**: `src/lib/services/cleanup.ts`

**Current**: Cleanup runs on a fixed interval.

**Recommendation**: Add jitter to prevent thundering herd:
```typescript
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const JITTER = Math.random() * 60 * 60 * 1000; // Up to 1 hour jitter

setInterval(() => {
  this.runCleanup();
}, CLEANUP_INTERVAL + JITTER);
```

### Issue 9: Missing Request ID in Error Responses

**Problem**: Error responses don't include request ID for debugging.

**Solution**: Already implemented via `getRequestId()` - ensure it's included in all error responses.

### Issue 10: Inconsistent Error Messages

**Current**: Some errors expose internal details.

**Solution**: Standardize error messages:
```typescript
// Create error message constants
const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email/username or password',
  ACCOUNT_LOCKED: 'Account is temporarily locked. Please try again later.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  INVALID_OTP: 'Invalid or expired verification code',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again later.',
};
```

---

## Database Schema Review

### User Model ✅
- Proper indexes on email, username, walletAddress
- Password stored as hash
- Account lockout fields present
- Timestamps for auditing

### Session Model ✅
- Linked to user with cascade delete
- Expiry tracking
- IP and user agent stored
- Last activity tracking

### OTP Model ✅
- Type enum for different OTP purposes
- Expiry and used flags
- Indexed for quick lookup

### LoginAttempt Model ✅
- Tracks all login attempts
- IP and user agent stored
- Success/failure tracking
- Indexed for rate limiting queries

### SessionActivity Model ✅
- Comprehensive audit trail
- Suspicious flag for security alerts
- Metadata for additional context

---

## API Endpoint Security Checklist

### POST /api/trpc/auth.signup
- [x] Input validation (Zod schema)
- [x] Rate limiting
- [x] Password hashing
- [x] Duplicate email/username check
- [x] Session creation
- [ ] Email verification (optional, not implemented)

### POST /api/trpc/auth.login
- [x] Input validation
- [x] Rate limiting
- [x] Account lockout check
- [x] Password verification
- [x] Failed attempt tracking
- [x] Session creation
- [x] Suspicious activity detection

### POST /api/trpc/auth.logout
- [x] Authentication required
- [x] Session deletion
- [x] Activity logging

### POST /api/trpc/auth.requestPasswordReset
- [x] Input validation
- [x] Rate limiting
- [x] No email enumeration (same response for existing/non-existing)
- [x] OTP generation
- [ ] OTP should use crypto.randomBytes (see Issue 2)

### POST /api/trpc/auth.verifyOtp
- [x] Input validation
- [x] Rate limiting
- [x] OTP expiry check
- [ ] OTP should be marked used immediately (see Issue 3)
- [ ] Brute force protection (see Issue 7)

### POST /api/trpc/auth.resetPassword
- [x] Input validation
- [x] Rate limiting
- [x] OTP verification
- [x] Password hashing
- [x] All sessions invalidated
- [ ] Password history check (see Issue 4)

### POST /api/trpc/auth.refreshToken
- [x] Token validation
- [x] Session verification
- [x] New token generation
- [x] Activity logging

---

## Environment Variables Audit

### Required for Production
```env
# Must be set and secure
JWT_SECRET=<min 32 chars, high entropy>
JWT_REFRESH_SECRET=<min 32 chars, high entropy>
DATABASE_URL=<postgresql connection string>
REDIS_URL=<redis connection string>
ALLOWED_ORIGINS=<comma-separated origins>

# Should be set
CSRF_ENABLED=true
SESSION_FINGERPRINT_STRICT=true
```

### Security Settings
```env
# Recommended values
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION_MINUTES=30
OTP_EXPIRES_IN_MINUTES=10
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

---

## Recommendations Summary

### Immediate Actions
1. Fix OTP generation to use crypto.randomBytes
2. Mark OTP as used during verification, not password reset
3. Ensure CSRF_ENABLED=true in production

### Short-term Actions
1. Add password history checking
2. Implement OTP brute force protection
3. Add session fingerprint validation option

### Long-term Actions
1. Implement email verification flow
2. Add 2FA support
3. Implement OAuth providers (Google, Apple)
4. Add security event notifications (email on new login, etc.)

---

## Testing Recommendations

### Security Tests to Add
```typescript
describe('Auth Security', () => {
  it('should lock account after 5 failed attempts', async () => {});
  it('should not enumerate users via login', async () => {});
  it('should not enumerate users via password reset', async () => {});
  it('should invalidate all sessions on password change', async () => {});
  it('should reject expired OTPs', async () => {});
  it('should reject reused OTPs', async () => {});
  it('should rate limit login attempts', async () => {});
  it('should rate limit OTP requests', async () => {});
});
```
