# Frontend-Backend Connection Testing

## Overview

This document covers testing the connection between the frontend (Expo app) and backend (Railway deployment) for the authentication flow.

---

## Current Connection Architecture

```
┌─────────────────┐     HTTPS      ┌─────────────────┐
│   Expo App      │ ──────────────▶│  Railway Server │
│   (Frontend)    │                │   (Backend)     │
│                 │                │                 │
│  lib/trpc.ts    │◀──────────────│  fastify.ts     │
│                 │    JSON/tRPC   │  routers/auth   │
└─────────────────┘                └─────────────────┘
        │                                  │
        ▼                                  ▼
┌─────────────────┐                ┌─────────────────┐
│ SecureStorage   │                │   PostgreSQL    │
│ (expo-secure-   │                │   (Database)    │
│  store)         │                │                 │
└─────────────────┘                └─────────────────┘
```

---

## Pre-Testing Checklist

### 1. Environment Variables

**Frontend (.env or app.json)**:
```env
EXPO_PUBLIC_API_URL=https://your-railway-app.railway.app
```

**Backend (Railway Environment)**:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=<secure-secret>
JWT_REFRESH_SECRET=<secure-secret>
ALLOWED_ORIGINS=exp://...,https://your-app-domain.com
NODE_ENV=production
```

### 2. Verify Backend is Running

```bash
# Test health endpoint
curl https://your-railway-app.railway.app/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-...",
  "checks": {
    "database": { "healthy": true },
    "redis": { "healthy": true }
  }
}
```

### 3. Verify CORS Configuration

```bash
# Test CORS preflight
curl -X OPTIONS https://your-railway-app.railway.app/api/trpc/auth.login \
  -H "Origin: exp://localhost:8081" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should return:
# Access-Control-Allow-Origin: exp://localhost:8081
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

---

## Connection Test Script

Create a test file to verify the connection:

**File**: `__tests__/connection/auth-connection.test.ts`

```typescript
import { trpcClient } from '../../lib/trpc';

describe('Auth API Connection', () => {
  const TEST_EMAIL = `test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'Test123!@#';
  const TEST_USERNAME = `testuser${Date.now()}`;

  describe('Health Check', () => {
    it('should connect to backend health endpoint', async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data.status).toBe('healthy');
    });
  });

  describe('Signup Flow', () => {
    it('should successfully create a new account', async () => {
      const result = await trpcClient.auth.signup.mutate({
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(TEST_EMAIL.toLowerCase());
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await expect(
        trpcClient.auth.signup.mutate({
          username: `another${Date.now()}`,
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          confirmPassword: TEST_PASSWORD,
        })
      ).rejects.toThrow(/already exists/i);
    });

    it('should reject weak password', async () => {
      await expect(
        trpcClient.auth.signup.mutate({
          username: `weak${Date.now()}`,
          email: `weak${Date.now()}@example.com`,
          password: 'weak',
          confirmPassword: 'weak',
        })
      ).rejects.toThrow(/password/i);
    });
  });

  describe('Login Flow', () => {
    it('should login with email', async () => {
      const result = await trpcClient.auth.login.mutate({
        identifier: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should login with username', async () => {
      const result = await trpcClient.auth.login.mutate({
        identifier: TEST_USERNAME,
        password: TEST_PASSWORD,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      await expect(
        trpcClient.auth.login.mutate({
          identifier: TEST_EMAIL,
          password: 'wrongpassword',
        })
      ).rejects.toThrow(/invalid/i);
    });
  });

  describe('Token Refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const result = await trpcClient.auth.login.mutate({
        identifier: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      refreshToken = result.refreshToken;
    });

    it('should refresh tokens', async () => {
      const result = await trpcClient.auth.refreshToken.mutate({
        refreshToken,
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });
});
```

---

## Manual Testing Steps

### Test 1: Signup Flow

1. Open the app on your phone
2. Navigate to signup screen
3. Enter test credentials:
   - Username: `testuser123`
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Confirm Password: `Test123!@#`
4. Tap "Sign Up"

**Expected Results**:
- Loading indicator appears
- On success: Redirected to main app
- On error: Error message displayed

**Debug if fails**:
```typescript
// Add to signup handler temporarily
console.log('Signup attempt:', { username, email });
try {
  const result = await signup(username, email, password, confirmPassword);
  console.log('Signup result:', result);
} catch (error) {
  console.error('Signup error:', error);
}
```

### Test 2: Login Flow

1. Open the app
2. Navigate to login screen
3. Enter credentials:
   - Email: `test@example.com`
   - Password: `Test123!@#`
4. Tap "Login"

**Expected Results**:
- Loading indicator appears
- On success: Redirected to main app
- On error: Error message displayed

### Test 3: Password Reset Flow

1. Navigate to "Forgot Password"
2. Enter email: `test@example.com`
3. Tap "Send Reset Code"
4. Check email for OTP (or console logs in dev)
5. Enter OTP
6. Set new password

**Expected Results**:
- OTP sent (check backend logs)
- OTP verification succeeds
- Password reset succeeds
- Can login with new password

---

## Common Connection Issues

### Issue 1: Network Request Failed

**Symptoms**:
- "Network request failed" error
- App can't reach backend

**Causes & Solutions**:

1. **Wrong API URL**:
   ```typescript
   // Check lib/trpc.ts
   console.log('API URL:', getBaseUrl());
   ```

2. **CORS not configured**:
   ```typescript
   // Backend: Check ALLOWED_ORIGINS includes your app's origin
   // For Expo Go: exp://192.168.x.x:8081
   // For production: your app's domain
   ```

3. **HTTPS required in production**:
   ```typescript
   // Ensure API URL uses https://
   EXPO_PUBLIC_API_URL=https://your-app.railway.app
   ```

### Issue 2: 401 Unauthorized

**Symptoms**:
- Login succeeds but subsequent requests fail
- "Unauthorized" errors

**Causes & Solutions**:

1. **Token not being sent**:
   ```typescript
   // Check lib/trpc.ts headers function
   const token = await SecureStorage.getToken();
   console.log('Token being sent:', token ? 'yes' : 'no');
   ```

2. **Token expired**:
   ```typescript
   // Check JWT_EXPIRES_IN setting
   // Default is 15m, might be too short for testing
   ```

3. **Token storage failing**:
   ```typescript
   // Test secure storage
   await SecureStorage.setToken('test');
   const retrieved = await SecureStorage.getToken();
   console.log('Storage working:', retrieved === 'test');
   ```

### Issue 3: 403 Forbidden

**Symptoms**:
- Requests blocked with 403

**Causes & Solutions**:

1. **CSRF token missing** (if CSRF_ENABLED=true):
   ```typescript
   // Ensure CSRF token is being sent
   // Check lib/trpc.ts for CSRF header logic
   ```

2. **Origin not allowed**:
   ```typescript
   // Check backend ALLOWED_ORIGINS
   // Add your app's origin
   ```

### Issue 4: 500 Internal Server Error

**Symptoms**:
- Server errors on auth requests

**Causes & Solutions**:

1. **Database connection issue**:
   ```bash
   # Check Railway logs
   railway logs
   ```

2. **Missing environment variables**:
   ```bash
   # Verify all required env vars are set
   railway variables
   ```

---

## Debugging Tools

### 1. Network Inspector (React Native Debugger)

```bash
# Install React Native Debugger
# Enable network inspection
# View all API requests/responses
```

### 2. Backend Logging

```typescript
// Add to auth router for debugging
logger.info('Auth request received', {
  endpoint: 'login',
  identifier: input.identifier,
  ip: ctx.req.ip,
});
```

### 3. tRPC Request Logging

```typescript
// Add to lib/trpc.ts
const trpcClient = trpc.createClient({
  links: [
    // Add logging link
    {
      next: (opts) => {
        console.log('tRPC Request:', opts.op.path, opts.op.input);
        return opts.next(opts);
      },
    },
    httpLink({...}),
  ],
});
```

---

## Production Deployment Checklist

### Frontend
- [ ] `EXPO_PUBLIC_API_URL` set to production URL
- [ ] No `console.log` statements with sensitive data
- [ ] Error messages are user-friendly
- [ ] Loading states work correctly

### Backend
- [ ] `NODE_ENV=production`
- [ ] `CSRF_ENABLED=true`
- [ ] `ALLOWED_ORIGINS` includes production domains
- [ ] All secrets are secure and unique
- [ ] Database connection is stable
- [ ] Redis is configured for rate limiting
- [ ] Health checks pass

### Testing
- [ ] Signup works end-to-end
- [ ] Login works end-to-end
- [ ] Password reset works end-to-end
- [ ] Token refresh works
- [ ] Rate limiting works
- [ ] Account lockout works
- [ ] Error messages are appropriate

---

## Quick Diagnostic Commands

```bash
# Test backend health
curl https://your-app.railway.app/health

# Test auth health
curl https://your-app.railway.app/api/trpc/auth.healthCheck

# Test signup (replace with your data)
curl -X POST https://your-app.railway.app/api/trpc/auth.signup \
  -H "Content-Type: application/json" \
  -d '{"json":{"username":"test","email":"test@test.com","password":"Test123!@#","confirmPassword":"Test123!@#"}}'

# Test login
curl -X POST https://your-app.railway.app/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"json":{"identifier":"test@test.com","password":"Test123!@#"}}'
```
