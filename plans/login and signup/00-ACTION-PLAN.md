# Login & Signup - Action Plan

## Quick Reference

This is the master action plan for fixing the login and signup functionality. Follow the phases in order.

---

## Phase 1: Fix Splash Screen (CRITICAL) ✅ COMPLETED

**Time Estimate**: 30 minutes
**Priority**: 🚨 MUST DO FIRST
**Status**: ✅ DONE

The app was stuck on the splash screen. This blocked everything else.

### Tasks

1. **Update `app/_layout.tsx`** ✅
   - ✅ Add timeout for font loading (5 seconds max)
   - ✅ Handle font loading errors gracefully
   - ✅ Always call `SplashScreen.hideAsync()` even if fonts fail
   - ✅ Add error screen for critical initialization failures

2. **Update `lib/validate-env.ts`** ✅
   - ✅ Don't throw in production, only log errors
   - ✅ Allow app to render error UI instead of crashing

3. **Update `lib/trpc.ts`** ✅
   - ✅ Return empty string instead of throwing if API URL missing
   - ✅ Log error but don't crash app

**Detailed Instructions**: See `02-SPLASH-SCREEN-FIX.md`

---

## Phase 2: Frontend Fixes ✅ COMPLETED

**Time Estimate**: 2-3 hours
**Priority**: 🔴 High
**Status**: ✅ DONE

### Tasks

1. **Login Screen (`app/(auth)/login.tsx`)** ✅
   - ✅ Add input validation before API call
   - ✅ Replace external logo URL with local asset
   - ✅ Add "Coming Soon" handler for social buttons
   - ✅ Add accessibility labels
   - ✅ Add local error state for validation errors

2. **Signup Screen (`app/(auth)/signup.tsx`)** ✅
   - ✅ Fix password regex (add end anchor `$`)
   - ✅ Add username format validation (3-20 chars)
   - ✅ Replace external logo URL with local asset
   - ✅ Add "Coming Soon" handler for social buttons
   - ✅ Add accessibility labels

3. **Forgot Password Screen (`app/(auth)/forgot-password.tsx`)** ✅
   - ✅ Add rate limit error handling (60s cooldown)
   - ✅ Auto-focus OTP input when step changes

4. **Auth Store (`hooks/auth-store.ts`)** ✅
   - ✅ Fixed TypeScript type compatibility

**Detailed Instructions**: See `03-FRONTEND-FIXES.md`

---

## Phase 3: Backend Security Fixes ✅ COMPLETED

**Time Estimate**: 1-2 hours
**Priority**: 🟡 Medium-High
**Status**: ✅ DONE

### Tasks

1. **Fix OTP Generation (`src/lib/services/auth.ts`)** ✅
   - ✅ Replace `Math.random()` with `crypto.randomBytes()`

2. **Fix OTP Verification Flow** ✅
   - ✅ Shorten expiry window to 5 minutes after verification

3. **Environment Variables** ✅
   - ✅ Added `CSRF_ENABLED=true` in `.env.production`

**Detailed Instructions**: See `04-BACKEND-AUDIT.md`

---

## Phase 4: Connection Testing 📋 READY FOR TESTING

**Time Estimate**: 1 hour
**Priority**: 🟡 Medium
**Status**: 📋 Manual Testing Phase

### Tasks

1. **Verify Backend Health**
   ```bash
   curl https://your-app.railway.app/health
   ```

2. **Test CORS Configuration**
   - Verify `ALLOWED_ORIGINS` includes your app's origin

3. **Test Auth Flow End-to-End**
   - [ ] Signup creates account
   - [ ] Login returns tokens
   - [ ] Token refresh works
   - [ ] Password reset flow works

**Detailed Instructions**: See `05-CONNECTION-TESTING.md` and `07-FINISHED-FIXES.md`

---

## Phase 5: Best Practices Enhancements ✅ COMPLETED

**Time Estimate**: 1 hour
**Priority**: 🟢 Nice to Have
**Status**: ✅ DONE

### Implemented Improvements

1. **Password Strength Meter** ✅
   - Visual feedback for password strength
   - Color-coded progress bar (Weak/Fair/Good/Strong)
   - Integrated into signup screen

2. **Breached Password Check** ✅
   - Check against Have I Been Pwned API
   - Privacy-preserving k-anonymity
   - Warning dialog with user choice

### Optional (Not Implemented)

3. **Biometric Authentication**
   - Face ID / Touch ID for returning users

4. **Session Management UI**
   - Let users see and revoke sessions

5. **Security Notifications**
   - Email on new login, password change

**Detailed Instructions**: See `06-BEST-PRACTICES.md`

---

## File Changes Summary

### Completed (Phase 1-5)

| File | Changes | Status |
|------|---------|--------|
| `app/_layout.tsx` | Font loading timeout, error handling | ✅ Done |
| `lib/validate-env.ts` | Don't throw in production | ✅ Done |
| `lib/trpc.ts` | Safe URL resolution | ✅ Done |
| `app/(auth)/login.tsx` | Validation, local logo, accessibility | ✅ Done |
| `app/(auth)/signup.tsx` | Regex fix, validation, local logo, strength meter, breach check | ✅ Done |
| `app/(auth)/forgot-password.tsx` | Rate limit handling | ✅ Done |
| `src/lib/services/auth.ts` | Crypto OTP, verification window | ✅ Done |
| `.env.production` | CSRF_ENABLED=true | ✅ Done |
| `hooks/auth-store.ts` | TypeScript type fixes | ✅ Done |
| `lib/secure-storage.ts` | TypeScript type fixes | ✅ Done |
| `components/PasswordStrengthMeter.tsx` | Password strength indicator | ✅ Done |
| `lib/password-check.ts` | Breached password check | ✅ Done |

### Optional (Not Implemented)

| File | Changes |
|------|---------|
| `lib/biometric-auth.ts` | Biometric authentication utility |
| `screens/SessionsScreen.tsx` | Session management UI |

---

## Testing Checklist

### After Phase 1 ✅
- [x] App loads past splash screen
- [x] Login screen is visible
- [x] No crashes on startup

### After Phase 2 ✅
- [x] Can navigate between login/signup/forgot-password
- [x] Validation errors show correctly
- [x] Social buttons show "Coming Soon"
- [x] Logo loads from local asset

### After Phase 3 ✅
- [x] OTP uses crypto.randomBytes()
- [x] CSRF protection configured
- [x] No TypeScript errors

### After Phase 5 ✅
- [x] Password strength meter shows on signup
- [x] Breached password warning works
- [x] expo-crypto installed
- [x] No TypeScript errors

### After Phase 4 (Manual Testing)
- [ ] Backend health check passes
- [ ] Full signup flow works
- [ ] Full login flow works
- [ ] Full password reset flow works
- [ ] Token refresh works
- [ ] Account lockout works

---

## Quick Commands

```bash
# Start development
npx expo start

# Check backend health
curl https://your-app.railway.app/health

# View Railway logs
railway logs

# Run tests
npm test

# Type check
npm run typecheck
```

---

## Support Resources

- **Expo Documentation**: https://docs.expo.dev
- **tRPC Documentation**: https://trpc.io/docs
- **Prisma Documentation**: https://www.prisma.io/docs
- **Railway Documentation**: https://docs.railway.app

---

## Notes

- Always test on a real device, not just simulator
- Check Railway logs if backend issues occur
- Keep `.env` files secure and never commit them
- All code changes are complete - now ready for deployment and testing
