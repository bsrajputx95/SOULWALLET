# Login & Signup - Overview and Critical Issues

## Executive Summary

This document provides a comprehensive analysis of the SoulWallet login and signup functionality. The app is stuck on the splash screen, which indicates issues with the app initialization flow, not necessarily the auth screens themselves.

## Current Architecture

### Frontend Stack
- **Framework**: React Native with Expo Router
- **State Management**: Custom context hooks (createContextHook pattern)
- **Storage**: expo-secure-store (native) + AsyncStorage (web fallback)
- **API Client**: tRPC with React Query
- **UI Components**: Custom Neon-themed components

### Backend Stack
- **Framework**: Fastify with tRPC
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Security**: bcrypt, rate limiting, CSRF protection, session management

---

## 🚨 CRITICAL ISSUE: App Stuck on Splash Screen

### Root Cause Analysis

The app is stuck on the splash screen because `SplashScreen.hideAsync()` is never called. This happens when:

1. **Fonts fail to load** - The app waits for `fontsLoaded` to be true
2. **Environment validation throws** - In production, missing env vars cause errors
3. **Provider initialization fails** - Any provider in the chain can block rendering

### Location: `app/_layout.tsx`

```typescript
// Current problematic flow:
const [appIsReady, setAppIsReady] = useState(false);
const [fontsLoaded] = useFonts({...});

useEffect(() => {
  if (fontsLoaded) {
    setAppIsReady(true);  // Only sets ready when fonts load
  }
}, [fontsLoaded]);

if (!appIsReady) {
  return null;  // App stuck here if fonts never load
}
```

### Fix Required

```typescript
// Add error handling and timeout
const [fontsLoaded, fontError] = useFonts({...});

useEffect(() => {
  async function prepare() {
    try {
      // Add timeout for font loading
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Font loading timeout')), 5000)
      );
      
      await Promise.race([
        new Promise(resolve => {
          if (fontsLoaded || fontError) resolve(true);
        }),
        timeout
      ]);
    } catch (e) {
      console.warn('Font loading failed, using system fonts');
    } finally {
      setAppIsReady(true);  // Always set ready
    }
  }
  prepare();
}, [fontsLoaded, fontError]);
```

---

## 🔴 Critical Issues (Must Fix)

### 1. Missing Error Boundary Around Providers
**File**: `app/_layout.tsx`
**Issue**: If any provider throws during initialization, the entire app crashes silently
**Impact**: App stuck on splash screen

### 2. Environment Validation Blocks App
**File**: `lib/validate-env.ts`
**Issue**: `validateEnvironmentOrThrow()` throws in production if `EXPO_PUBLIC_API_URL` is missing
**Impact**: App crashes before rendering

### 3. tRPC Client URL Configuration
**File**: `lib/trpc.ts`
**Issue**: `getBaseUrl()` throws if no API URL is configured in production
**Impact**: App crashes on startup

### 4. Social Buttons Not Functional
**Files**: `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`
**Issue**: Google and Apple sign-in buttons are rendered but have no `onPress` handlers
**Impact**: Confusing UX, buttons do nothing

### 5. No Loading State for Initial Auth Check
**File**: `hooks/auth-store.ts`
**Issue**: `loadUser()` runs on mount but there's no visual feedback
**Impact**: User sees blank screen during auth check

---

## 🟡 High Priority Issues

### 6. Password Validation Mismatch
**Frontend**: `app/(auth)/signup.tsx`
```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
```

**Backend**: `src/lib/validations/auth.ts`
```typescript
.regex(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  ...
)
```

**Issue**: Frontend regex doesn't anchor to end (`$`), allowing trailing invalid characters

### 7. Email Validation Inconsistency
**Frontend**: Uses basic check in forgot-password
**Backend**: Uses Zod email validation
**Issue**: Frontend may accept emails that backend rejects

### 8. No Network Error Handling
**Files**: All auth screens
**Issue**: Network failures show generic errors, no retry mechanism
**Impact**: Poor UX on flaky connections

### 9. Remember Me Not Fully Implemented
**File**: `hooks/auth-store.ts`
**Issue**: `rememberMe` is stored but not used to control session persistence
**Impact**: Feature doesn't work as expected

---

## 🟢 Medium Priority Issues

### 10. Unused Imports and Dead Code
**Files**: Multiple auth files
**Issue**: Imported components/functions not used
**Impact**: Bundle size, code clarity

### 11. Inconsistent Error Display
**Files**: Auth screens
**Issue**: Some errors show in red text, others in toast-like containers
**Impact**: Inconsistent UX

### 12. Missing Accessibility Labels
**Files**: All auth components
**Issue**: No `accessibilityLabel` on interactive elements
**Impact**: Screen reader users can't navigate

### 13. Hardcoded Logo URL
**Files**: Auth screens
**Issue**: Logo loaded from external URL, should be bundled
**Impact**: Slow load, potential failure if URL unavailable

---

## File Structure Reference

```
Frontend Auth Files:
├── app/
│   ├── _layout.tsx              # Root layout with providers
│   └── (auth)/
│       ├── _layout.tsx          # Auth stack layout
│       ├── login.tsx            # Login screen
│       ├── signup.tsx           # Signup screen
│       └── forgot-password.tsx  # Password reset flow
├── hooks/
│   └── auth-store.ts            # Auth state management
├── lib/
│   ├── trpc.ts                  # API client
│   ├── secure-storage.ts        # Token storage
│   └── validate-env.ts          # Environment validation
└── components/
    ├── NeonInput.tsx            # Input component
    ├── NeonButton.tsx           # Button component
    ├── SocialButton.tsx         # Social login button
    ├── GlowingText.tsx          # Styled text
    └── NeonDivider.tsx          # Divider component

Backend Auth Files:
├── src/server/
│   ├── routers/auth.ts          # Auth API routes
│   ├── trpc.ts                  # tRPC setup
│   └── fastify.ts               # Server config
└── src/lib/
    ├── services/auth.ts         # Auth business logic
    ├── validations/auth.ts      # Input validation schemas
    └── middleware/
        ├── auth.ts              # Auth middleware
        └── rateLimit.ts         # Rate limiting
```

---

## Next Steps

1. **Read**: `02-SPLASH-SCREEN-FIX.md` - Fix the immediate blocking issue
2. **Read**: `03-FRONTEND-FIXES.md` - All frontend code fixes
3. **Read**: `04-BACKEND-AUDIT.md` - Backend security and functionality audit
4. **Read**: `05-CONNECTION-TESTING.md` - Frontend-backend integration testing
5. **Read**: `06-BEST-PRACTICES.md` - Industry standards and improvements
