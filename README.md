# SoulWallet

A comprehensive Solana wallet application with copy trading, social features, and portfolio management.

## 📊 Monitoring & Error Tracking

### Sentry Integration

SoulWallet uses Sentry for crash reporting, error tracking, and performance monitoring across both mobile app and backend services.

**Key Features:**
- Real-time error tracking for mobile app and backend
- Performance monitoring for critical endpoints
- Source map support for readable stack traces
- User context and breadcrumbs for debugging
- Release tracking and deploy notifications

**Setup:** See `scripts/sentry-setup-guide.md` for detailed configuration instructions.

### Health Monitoring

Comprehensive health check endpoints for system monitoring:

- `/health` - Overall system health
- `/health/db` - Database connectivity
- `/health/redis` - Redis connectivity
- `/health/solana` - Solana RPC connectivity
- `/health/ready` - Readiness probe (for load balancers)
- `/health/live` - Liveness probe (for orchestrators)

**Health Check Scripts:**
```bash
# Run automated health check tests
npm run health:test

# Run with custom URL
npm run health:test -- --url https://api.example.com

# Run with custom timeout
npm run health:test -- --timeout 10000

# Run with verbose output
npm run health:test -- --verbose

# Run with JSON output for CI/CD
npm run health:test -- --json

# Start continuous health monitoring
npm run health:monitor
```

### Testing Monitoring Setup

```bash
# Validate Sentry configuration
npm run sentry:test-config

# Test all health endpoints
npm run health:test
```

## 🧪 Testing

SoulWallet has comprehensive integration tests covering all API endpoints and critical user flows.

### Running Tests
```bash
# Run all tests
npm test

# Run integration tests only
npm run test:integration

# Run full integration suite with detailed report
npm run test:integration:full

# Run specific test suites
npm run test:auth
npm run test:wallet
npm run test:copy-trading
npm run test:market
npm run test:social
npm run test:swap
npm run test:transaction
npm run test:portfolio
npm run test:health
npm run test:errors

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Coverage
We maintain 80-85% code coverage across:
- Authentication & authorization
- Wallet operations (balance, transactions, linking)
- Copy trading (start, stop, positions, stats)
- Market data (search, trending, token details)
- Social features (posts, likes, comments, follows)
- Token swaps (quotes, execution, history)
- Transaction management (sync, verify, stats)
- Portfolio tracking (overview, history, P&L)

### Documentation
For detailed testing documentation, see [docs/TESTING.md](docs/TESTING.md).

## 🚀 Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
```

### Database
```bash
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with test data
npm run db:reset     # Reset database (development only)
```

### Monitoring
```bash
npm run sentry:test-config  # Validate Sentry configuration
npm run health:test         # Run health check tests
npm run health:monitor      # Start continuous health monitoring
```

## 📚 Documentation

- `scripts/sentry-setup-guide.md` - Sentry configuration guide
- `scripts/deployment-checklist.md` - Production deployment checklist
- `scripts/database-maintenance.md` - Database operations guide
- `scripts/railway-env-setup.md` - Railway environment setup

## 🏗️ Architecture

- **Frontend:** React Native with Expo
- **Backend:** Node.js with Fastify and tRPC
- **Database:** PostgreSQL with Prisma ORM
- **Blockchain:** Solana with web3.js
- **Monitoring:** Sentry for error tracking and performance
- **Deployment:** Railway for backend, EAS for mobile builds

## 🔧 Environment Setup

See `.env.production.example` for required environment variables and configuration options.
