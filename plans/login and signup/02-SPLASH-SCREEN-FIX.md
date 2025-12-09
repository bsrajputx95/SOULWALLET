# Fix: App Stuck on Splash Screen

## Priority: 🚨 CRITICAL - Must fix first

## Problem Description

The app shows the splash screen and never progresses to the login/signup screens. This is caused by the app initialization flow failing silently.

---

## Root Causes

### 1. Font Loading Without Timeout or Error Handling

**File**: `app/_layout.tsx` (Lines 80-85)

**Current Code**:
```typescript
const [fontsLoaded] = useFonts({
  Orbitron_400Regular,
  Orbitron_500Medium,
  Orbitron_700Bold,
});

useEffect(() => {
  if (fontsLoaded) {
    setAppIsReady(true);
  }
}, [fontsLoaded]);
```

**Problem**: If fonts fail to load (network issue, missing font file), `fontsLoaded` stays `false` forever.

### 2. Environment Validation Throws in Production

**File**: `lib/validate-env.ts`

**Current Code**:
```typescript
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();
  if (!result.isValid) {
    throw new Error('Environment validation failed...');
  }
}
```

**Problem**: In production, if `EXPO_PUBLIC_API_URL` is not set, this throws and crashes the app.

### 3. tRPC Client Throws on Missing URL

**File**: `lib/trpc.ts` (Lines 10-20)

**Current Code**:
```typescript
const getBaseUrl = () => {
  if (__DEV__) {
    return 'http://localhost:3001';
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  throw new Error("No API URL found...");  // Crashes app
};
```

---

## Solutions

### Fix 1: Robust Font Loading with Timeout

**File**: `app/_layout.tsx`

**Replace** the font loading logic:

```typescript
import { useFonts, Orbitron_400Regular, Orbitron_500Medium, Orbitron_700Bold } from '@expo-google-fonts/orbitron';

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Load fonts with error state
  const [fontsLoaded, fontError] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        // Wait for fonts with a timeout
        if (!fontsLoaded && !fontError) {
          // Give fonts 5 seconds to load
          await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('Font loading timeout - using system fonts');
              resolve(true);
            }, 5000);
            
            // Check periodically if fonts loaded
            const interval = setInterval(() => {
              if (fontsLoaded || fontError) {
                clearTimeout(timeout);
                clearInterval(interval);
                resolve(true);
              }
            }, 100);
          });
        }

        // Log font loading result
        if (fontError) {
          console.warn('Font loading error:', fontError);
        }

      } catch (e) {
        console.error('App initialization error:', e);
        setInitError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        // Always set app as ready
        setAppIsReady(true);
      }
    }

    prepare();
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Error hiding splash screen:', e);
      }
      
      if (__DEV__) {
        performanceMonitor.endTiming('app-startup');
        performanceMonitor.logSummary();
      }
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  // Show error screen if initialization failed critically
  if (initError && !__DEV__) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0F1F' }}>
        <Text style={{ color: '#FF3D71', fontSize: 16, textAlign: 'center', padding: 20 }}>
          Failed to initialize app. Please restart.
        </Text>
      </View>
    );
  }

  // Rest of the component...
}
```

### Fix 2: Safe Environment Validation

**File**: `lib/validate-env.ts`

**Replace** `validateEnvironmentOrThrow`:

```typescript
/**
 * Validates environment and logs errors but doesn't throw in production
 * This prevents the app from crashing on startup
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    const errorMessage = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🚨 ENVIRONMENT CONFIGURATION ERROR',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      ...result.errors,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    console.error(errorMessage);
    
    // In development, throw to alert developer
    // In production, log but don't crash - let app show error UI
    if (__DEV__) {
      throw new Error('Environment validation failed. Check console for details.');
    }
  }

  // Log warnings in development
  if (__DEV__ && result.warnings.length > 0) {
    console.warn(
      '\n⚠️  Environment Warnings:\n' + result.warnings.join('\n\n')
    );
  }

  // Success message in development
  if (__DEV__) {
    console.log('✅ Environment variables validated successfully');
  }
}
```

### Fix 3: Safe tRPC URL Resolution

**File**: `lib/trpc.ts`

**Replace** `getBaseUrl`:

```typescript
const getBaseUrl = (): string => {
  // In development, use local server
  if (__DEV__) {
    return 'http://localhost:3001';
  }
  
  // In production, use environment variable
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (apiUrl) {
    return apiUrl;
  }

  // Fallback: Log error but return a placeholder
  // This allows the app to render and show a proper error message
  console.error(
    '🚨 EXPO_PUBLIC_API_URL is not configured!\n' +
    'API calls will fail. Please set this environment variable.'
  );
  
  // Return empty string - API calls will fail gracefully
  // The app can still render and show appropriate error messages
  return '';
};
```

### Fix 4: Wrap Environment Validation in Try-Catch

**File**: `app/_layout.tsx`

**Current Code** (around line 50):
```typescript
if (__DEV__) {
  try {
    validateEnvironmentOrThrow();
  } catch (error) {
    logger.error('Environment validation failed:', error);
  }
}
```

**Replace with**:
```typescript
// Validate environment in both dev and production, but handle errors gracefully
try {
  validateEnvironmentOrThrow();
} catch (error) {
  // Log but don't crash - the app will show appropriate error UI
  console.error('Environment validation failed:', error);
  if (__DEV__) {
    // In dev, also show in logger
    logger.error('Environment validation failed:', error);
  }
}
```

---

## Testing the Fix

### Step 1: Test Font Loading Failure
```typescript
// Temporarily break font loading to test
const [fontsLoaded, fontError] = useFonts({
  Orbitron_400Regular: 'invalid-url', // This will fail
});
```

Expected: App should still load after 5 second timeout.

### Step 2: Test Missing Environment Variable
```bash
# Remove EXPO_PUBLIC_API_URL from .env
# Run the app
```

Expected: App should load and show login screen. API calls will fail with proper error messages.

### Step 3: Test Normal Flow
```bash
# Restore all environment variables
# Run the app
```

Expected: App loads normally, fonts load, login screen appears.

---

## Verification Checklist

- [ ] App loads even if fonts fail to load
- [ ] App loads even if `EXPO_PUBLIC_API_URL` is missing
- [ ] Splash screen hides within 5-10 seconds maximum
- [ ] Error messages are logged to console
- [ ] In production, app shows error UI instead of crashing
- [ ] In development, errors are clearly visible in console

---

## Related Files to Update

1. `app/_layout.tsx` - Main fix location
2. `lib/validate-env.ts` - Environment validation
3. `lib/trpc.ts` - API URL configuration
4. `.env.production` - Ensure `EXPO_PUBLIC_API_URL` is set correctly
