# Frontend-Backend Connection Audit

## Overview
Audit of the integration between frontend and backend, including API calls, error handling, authentication, and data synchronization.

---

## 1. tRPC Setup

### 1.1 Client Configuration (`lib/trpc.ts`)

```typescript
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../backend/trpc/app-router';

export const trpc = createTRPCReact<AppRouter>();

// Client for direct calls (outside React)
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers() {
        return {
          authorization: token ? `Bearer ${token}` : '',
        };
      },
    }),
  ],
});
```

### 1.2 Server Configuration (`src/server/trpc.ts`)

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './types';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

---

## 2. API Endpoints Used by Home Screen

### 2.1 Portfolio APIs
| Endpoint | Purpose | Auth | Cache |
|----------|---------|------|-------|
| `portfolio.getOverview` | Total balance, SOL price | ✅ | 60s |
| `portfolio.getPNL` | Daily P&L | ✅ | 300s |
| `portfolio.getHistory` | Historical snapshots | ✅ | - |

### 2.2 Wallet APIs
| Endpoint | Purpose | Auth | Cache |
|----------|---------|------|-------|
| `wallet.getTokens` | Token balances | ✅ | 60s |
| `wallet.getTokenMetadata` | Token info | ✅ | 300s |
| `wallet.getBalance` | SOL balance | ✅ | - |
| `wallet.recordTransaction` | Save tx to DB | ✅ | - |

### 2.3 Copy Trading APIs
| Endpoint | Purpose | Auth | Cache |
|----------|---------|------|-------|
| `copyTrading.getMyCopyTrades` | Active copies | ✅ | 30s |
| `copyTrading.getStats` | Copy stats | ✅ | 120s |
| `copyTrading.getPositionHistory` | Past positions | ✅ | 120s |
| `copyTrading.startCopying` | Start copy | ✅ | - |
| `copyTrading.stopCopying` | Stop copy | ✅ | - |

### 2.4 Market APIs
| Endpoint | Purpose | Auth | Cache |
|----------|---------|------|-------|
| `market.trending` | Trending coins | ✅ | 60s |
| `market.search` | Search coins | ✅ | 60s |

### 2.5 Traders APIs
| Endpoint | Purpose | Auth | Cache |
|----------|---------|------|-------|
| `traders.getTopTraders` | Top performers | ✅ | 300s |
| `traders.search` | Search traders | ✅ | - |

---

## 3. Authentication Flow

### 3.1 Token Storage
```typescript
// lib/secure-storage.ts
export const SecureStorage = {
  async getToken(): Promise<string | null> {
    return await getSecureItem('auth_token');
  },
  async setToken(token: string): Promise<void> {
    await setSecureItem('auth_token', token);
  },
};
```

### 3.2 Auth Header Injection
```typescript
// In trpc client
headers() {
  const token = await SecureStorage.getToken();
  return {
    authorization: token ? `Bearer ${token}` : '',
  };
},
```

### 3.3 Auth State Management (`hooks/auth-store.ts`)
```typescript
export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = await SecureStorage.getToken();
    if (token) {
      // Validate token with server
      const userData = await trpcClient.auth.me.query();
      setUser(userData);
    }
    setIsLoading(false);
  };

  return { user, isLoading, login, logout };
});
```

---

## 4. Issues Found

### 🔴 Critical Issues

#### 4.1 No Token Refresh
```typescript
// Current: Token expires, user gets logged out
// Missing: Automatic token refresh before expiry
```

**FIX**: Implement refresh token flow:
```typescript
const refreshToken = async () => {
  const refreshToken = await SecureStorage.getRefreshToken();
  const { accessToken, newRefreshToken } = await trpcClient.auth.refresh.mutate({ refreshToken });
  await SecureStorage.setToken(accessToken);
  await SecureStorage.setRefreshToken(newRefreshToken);
};

// Add to tRPC link
const authLink = ({ op, next }) => {
  return next(op).pipe(
    catchError(async (error) => {
      if (error.data?.code === 'UNAUTHORIZED') {
        await refreshToken();
        return next(op); // Retry
      }
      throw error;
    })
  );
};
```

#### 4.2 No Offline Support
**ISSUE**: App crashes or shows errors when offline

**FIX**: Add offline detection and graceful degradation:
```typescript
import NetInfo from '@react-native-community/netinfo';

const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsOnline(state.isConnected);
  });
  return unsubscribe;
}, []);

// Show cached data when offline
if (!isOnline) {
  return <OfflineIndicator />;
}
```

### 🟠 High Priority Issues

#### 4.3 Inconsistent Error Handling
```typescript
// Some places catch errors
try {
  await createCopyTradeMutation.mutateAsync({...});
} catch (error: any) {
  Alert.alert('Error', error.message);
}

// Others don't
const { data } = trpc.portfolio.getOverview.useQuery(); // No error handling
```

**FIX**: Create consistent error handling wrapper:
```typescript
const useQueryWithError = <T>(query: UseQueryResult<T>) => {
  useEffect(() => {
    if (query.error) {
      showErrorToast(query.error.message);
    }
  }, [query.error]);
  return query;
};
```

#### 4.4 No Request Deduplication
```typescript
// Multiple components might call same endpoint
const { data: overview1 } = trpc.portfolio.getOverview.useQuery();
const { data: overview2 } = trpc.portfolio.getOverview.useQuery();
```

**FIX**: tRPC React Query handles this automatically, but verify:
```typescript
// Ensure same query key is used
const queryClient = useQueryClient();
// Check for duplicate requests in network tab
```

#### 4.5 Missing Loading States
```typescript
const { data, isLoading } = trpc.market.trending.useQuery();

// But isLoading is true on every refetch
// Should distinguish initial load from background refresh
```

**FIX**:
```typescript
const { data, isLoading, isFetching, isRefetching } = trpc.market.trending.useQuery();

const isInitialLoading = isLoading && !data;
const isBackgroundRefreshing = isFetching && data;
```

### 🟡 Medium Priority Issues

#### 4.6 No Retry Configuration
```typescript
trpc.portfolio.getOverview.useQuery(undefined, {
  refetchInterval: 60000,
  // Missing: retry, retryDelay
});
```

**FIX**: Add retry configuration:
```typescript
trpc.portfolio.getOverview.useQuery(undefined, {
  refetchInterval: 60000,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

#### 4.7 No Request Timeout
**FIX**: Add timeout to tRPC client:
```typescript
httpBatchLink({
  url: `${API_URL}/trpc`,
  fetch: (url, options) => {
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
  },
}),
```

#### 4.8 No Request Cancellation
**ISSUE**: Navigating away doesn't cancel pending requests

**FIX**: Use AbortController:
```typescript
const controller = new AbortController();

useEffect(() => {
  return () => controller.abort();
}, []);

trpc.market.search.useQuery(
  { q: searchTerm },
  { signal: controller.signal }
);
```

---

## 5. Data Synchronization

### 5.1 Current Refresh Strategy
| Data | Interval | Trigger |
|------|----------|---------|
| Portfolio Overview | 60s | Auto |
| P&L | 300s | Auto |
| Tokens | 60s | Auto |
| Copy Trades | 30s | Auto |
| Trending Coins | 60s | Auto |
| Top Traders | 300s | Auto |

### 5.2 Issues

#### 5.2.1 No Real-Time Updates
**ISSUE**: User must wait for next poll to see changes

**FIX**: Add WebSocket for real-time updates:
```typescript
// Server
const wsRouter = router({
  onBalanceChange: subscription({
    resolve: async function* ({ ctx }) {
      while (true) {
        const balance = await getBalance(ctx.user.walletAddress);
        yield balance;
        await sleep(5000);
      }
    },
  }),
});

// Client
trpc.ws.onBalanceChange.useSubscription(undefined, {
  onData: (balance) => {
    queryClient.setQueryData(['portfolio', 'overview'], (old) => ({
      ...old,
      totalValue: balance,
    }));
  },
});
```

#### 5.2.2 Stale Data After Mutation
```typescript
// After creating copy trade, data might be stale
await createCopyTradeMutation.mutateAsync({...});
// Should invalidate related queries
```

**FIX**: Invalidate queries after mutations:
```typescript
const utils = trpc.useUtils();

const createCopyTrade = trpc.copyTrading.startCopying.useMutation({
  onSuccess: () => {
    utils.copyTrading.getMyCopyTrades.invalidate();
    utils.copyTrading.getStats.invalidate();
    utils.portfolio.getOverview.invalidate();
  },
});
```

---

## 6. Error Handling Strategy

### 6.1 Error Types
```typescript
enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
}
```

### 6.2 Recommended Error Handling
```typescript
const handleError = (error: TRPCClientError) => {
  switch (error.data?.code) {
    case 'UNAUTHORIZED':
      // Redirect to login
      router.replace('/login');
      break;
    case 'FORBIDDEN':
      Alert.alert('Access Denied', 'You do not have permission');
      break;
    case 'NOT_FOUND':
      Alert.alert('Not Found', error.message);
      break;
    case 'BAD_REQUEST':
      Alert.alert('Invalid Request', error.message);
      break;
    case 'INTERNAL_SERVER_ERROR':
      Alert.alert('Server Error', 'Please try again later');
      Sentry.captureException(error);
      break;
    default:
      if (error.message.includes('Network')) {
        Alert.alert('Network Error', 'Check your connection');
      } else {
        Alert.alert('Error', error.message);
      }
  }
};
```

---

## 7. Performance Monitoring

### 7.1 Request Timing
```typescript
// Add to tRPC link
const timingLink = ({ op, next }) => {
  const start = Date.now();
  return next(op).pipe(
    tap({
      next: () => {
        const duration = Date.now() - start;
        if (duration > 3000) {
          logger.warn(`Slow request: ${op.path} took ${duration}ms`);
        }
      },
    })
  );
};
```

### 7.2 Error Tracking
```typescript
// Add to tRPC link
const errorTrackingLink = ({ op, next }) => {
  return next(op).pipe(
    catchError((error) => {
      Sentry.captureException(error, {
        tags: { endpoint: op.path },
        extra: { input: op.input },
      });
      throw error;
    })
  );
};
```

---

## 8. Testing Checklist

### API Integration Tests
- [ ] All endpoints return expected data shape
- [ ] Auth token is sent with requests
- [ ] Unauthorized requests return 401
- [ ] Rate limiting works correctly
- [ ] Errors are properly formatted

### Error Handling Tests
- [ ] Network error shows appropriate message
- [ ] Server error shows appropriate message
- [ ] Auth error redirects to login
- [ ] Timeout shows appropriate message

### Data Sync Tests
- [ ] Data refreshes at correct intervals
- [ ] Mutations invalidate correct queries
- [ ] Optimistic updates work correctly
- [ ] Stale data is handled gracefully

---

## 9. Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 | Implement token refresh | 4hr |
| 🔴 | Add offline support | 4hr |
| 🟠 | Consistent error handling | 3hr |
| 🟠 | Query invalidation after mutations | 2hr |
| 🟠 | Distinguish loading states | 2hr |
| 🟡 | Add retry configuration | 1hr |
| 🟡 | Add request timeout | 1hr |
| 🟡 | Add request cancellation | 2hr |
| 🟡 | WebSocket for real-time | 8hr |
| 🟡 | Performance monitoring | 2hr |

**Total Estimated Effort: ~29 hours**
