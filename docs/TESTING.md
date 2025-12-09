# SoulWallet Testing Documentation

Comprehensive guide for testing the SoulWallet application.

## Overview

SoulWallet uses a multi-layered testing approach:
- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test API endpoints and service interactions
- **End-to-End Tests**: Test complete user flows (future)

### Coverage Goals
- Lines: 85%
- Branches: 80%
- Functions: 85%
- Statements: 85%

## Setup

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL 14+ (for integration tests)
- Redis (optional, for rate limiting tests)

### Environment Variables
Create a `.env.test` file with:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/soulwallet_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-key
JWT_REFRESH_SECRET=test-refresh-secret-key
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Database Setup
```bash
# Create test database
createdb soulwallet_test

# Run migrations
DATABASE_URL=postgresql://... npx prisma migrate deploy
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Full Integration Suite with Report
```bash
npm run test:integration:full
```

### Individual Test Suites
```bash
npm run test:auth          # Authentication tests
npm run test:wallet        # Wallet operations
npm run test:copy-trading  # Copy trading features
npm run test:market        # Market data
npm run test:social        # Social features
npm run test:swap          # Token swaps
npm run test:transaction   # Transaction management
npm run test:portfolio     # Portfolio tracking
npm run test:health        # Health endpoints
npm run test:errors        # Error handling
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Structure

```
__tests__/
├── utils/
│   ├── test-helpers.ts    # Shared test utilities
│   └── test-fixtures.ts   # Mock data and factories
├── integration/
│   ├── auth.test.ts       # Authentication flows
│   ├── wallet.test.ts     # Wallet operations
│   ├── copy-trading.test.ts
│   ├── market.test.ts
│   ├── social.test.ts
│   ├── swap.test.ts
│   ├── transaction.test.ts
│   ├── portfolio.test.ts
│   ├── health-checks.test.ts
│   └── error-handling.test.ts
├── scripts/
│   └── run-all-tests.ts   # Master test runner
├── reports/               # Generated test reports
└── test-auth.js           # Legacy auth test script
```

## Test Helpers

### Making tRPC Requests
```typescript
import { trpcRequest, trpcQuery } from '../utils/test-helpers';

// Mutation
const result = await trpcRequest('auth.signup', {
  email: 'test@example.com',
  password: 'Password123!',
}, token);

// Query
const data = await trpcQuery('wallet.getBalance', {}, token);
```

### Creating Test Users
```typescript
import { createTestUser, cleanupTestUser } from '../utils/test-helpers';

const user = await createTestUser();
// user.email, user.password, user.token, user.userId

await cleanupTestUser(user.email);
```

### Asserting Errors
```typescript
import { expectTRPCError } from '../utils/test-helpers';

await expectTRPCError(
  trpcRequest('auth.login', { email: 'bad', password: 'bad' }),
  'UNAUTHORIZED'
);
```

## Test Fixtures

```typescript
import {
  createMockUser,
  createMockTrader,
  createMockTransaction,
  VALID_SOLANA_ADDRESSES,
  invalidData,
} from '../utils/test-fixtures';

const user = createMockUser({ email: 'custom@test.com' });
const trader = createMockTrader({ winRate: 75 });
```

## Mocking External Services

Integration tests use mocks for external APIs to ensure deterministic, fast, and offline-capable testing.

### Available Mocks
Located in `__tests__/mocks/external-services.ts`:

```typescript
import {
  mockSolanaRPC,
  mockJupiterAPI,
  mockMarketDataAPI,
  mockPriceAPI,
  setupExternalServiceMocks,
  simulateError,
  simulateEmptyResponse,
} from '../mocks/external-services';

// Setup mocks before tests
beforeEach(() => {
  setupExternalServiceMocks();
});

// Simulate error scenario
it('should handle RPC failure', async () => {
  simulateError(mockSolanaRPC.getBalance, new Error('RPC unavailable'));
  // ... test error handling
});

// Simulate empty response
it('should handle no results', async () => {
  simulateEmptyResponse(mockMarketDataAPI.searchTokens);
  // ... test empty state
});
```

### Mock Coverage
- **Solana RPC**: Balance, tokens, transactions, fees
- **Jupiter API**: Quotes, swap transactions, supported tokens
- **Market Data**: Token search, trending, details, prices
- **Price API**: Single and batch price lookups

## Writing Tests

### Best Practices
1. Use descriptive test names
2. Follow AAA pattern (Arrange, Act, Assert)
3. Clean up test data after each test
4. Mock external APIs (Jupiter, Birdeye, Solana RPC)
5. Test both success and error cases
6. Test edge cases and validation
7. Use mocks for deterministic results

### Example Test
```typescript
describe('Auth Router', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    await waitForServer();
    testUser = await createTestUser();
  });

  afterAll(async () => {
    await cleanupTestUser(testUser.email);
  });

  it('should login with valid credentials', async () => {
    const result = await trpcRequest('auth.login', {
      email: testUser.email,
      password: testUser.password,
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should reject invalid password', async () => {
    await expectTRPCError(
      trpcRequest('auth.login', {
        email: testUser.email,
        password: 'wrong',
      }),
      'UNAUTHORIZED'
    );
  });
});
```

## Integration Test Suites

### auth.test.ts
- Signup flow (valid, duplicate, weak password)
- Login flow (valid, wrong password, non-existent)
- Logout flow
- Password reset
- Token refresh
- Session management
- Security features

### wallet.test.ts
- Balance operations
- Fee estimation
- Wallet linking
- Transaction recording
- Token metadata
- QR code generation

### copy-trading.test.ts
- Trader discovery
- Start/stop copying
- Settings management
- Position management
- Statistics

### market.test.ts
- Token search
- Trending tokens
- Token details

### social.test.ts
- Posts (CRUD)
- Likes and comments
- Follow/unfollow
- User profiles
- Notifications

### swap.test.ts
- Get quote
- Execute swap
- Swap history

### transaction.test.ts
- List transactions
- Get by signature
- Sync and verify
- Statistics

### portfolio.test.ts
- Overview
- History
- Performance
- P&L

### health-checks.test.ts
- All health endpoints
- Response times
- Service status

### error-handling.test.ts
- Authentication errors
- Authorization errors
- Validation errors
- Rate limiting

## CI/CD Integration

Tests run automatically on:
- Push to main/develop
- Pull requests

See `.github/workflows/test.yml` for configuration.

## Troubleshooting

### Server Not Running
```
Error: Server is not running
```
Start the server: `npm run server:dev`

### Database Connection Failed
Check DATABASE_URL and ensure PostgreSQL is running.

### Rate Limiting
Tests may fail if rate limits are hit. Wait and retry.

### RPC Failures
Solana RPC may be unavailable. Tests handle this gracefully.

## Coverage Reports

Generate coverage report:
```bash
npm run test:coverage
```

View report at `coverage/lcov-report/index.html`

## Test Reports

Full integration test reports are saved to:
```
__tests__/reports/test-results-{timestamp}.json
```

Report includes:
- Total tests run
- Pass/fail counts per suite
- Execution times
- Error details
