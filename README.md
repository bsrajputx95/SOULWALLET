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

## 📊 Observability Stack

Complete production monitoring with Prometheus, Jaeger, ELK Stack, and Grafana.

### Quick Start
```bash
# Start observability stack
npm run observability:up

# Verify all services
npm run verify:observability

# Open dashboards
npm run dashboards:view   # Grafana (http://localhost:3000)
npm run metrics:view      # Prometheus (http://localhost:9090)
npm run traces:view       # Jaeger (http://localhost:16686)
npm run logs:view         # Kibana (http://localhost:5601)
```

### Components
| Component | Port | Purpose |
|-----------|------|---------|
| Prometheus | 9090 | Metrics collection |
| AlertManager | 9093 | Alert routing |
| Jaeger | 16686 | Distributed tracing |
| Elasticsearch | 9200 | Log storage |
| Kibana | 5601 | Log visualization |
| Grafana | 3000 | Dashboards |

### Pre-built Dashboards
- **API Performance** - Request rate, latency, error rate
- **Infrastructure** - Database pool, Redis cache, memory
- **Copy Trading** - Trading-specific metrics
- **Business** - Auth, user activity, API usage

### Documentation
For detailed setup and troubleshooting, see [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md).

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

---

## 🛡️ V1 Launch Readiness & Compliance

SoulWallet implements comprehensive compliance features required for production launch.

### GDPR Compliance
| Feature | Status | Endpoint |
|---------|--------|----------|
| Data Export (Article 15) | ✅ | `compliance.requestDataExport` |
| Data Deletion (Article 17) | ✅ | `compliance.requestDataDeletion` |
| Consent Management (Article 7) | ✅ | `compliance.logConsent` |
| 30-day grace period | ✅ | Automatic via cron |
| Data retention policies | ✅ | Configurable per data type |

### KYC/AML
| Feature | Status |
|---------|--------|
| Tiered verification (0-3) | ✅ |
| Document submission | ✅ |
| Admin review flow | ✅ |
| OFAC SDN screening | ✅ |

### Geo-Blocking
| Feature | Status |
|---------|--------|
| OFAC-sanctioned regions blocked | ✅ |
| Global Fastify hook for auth paths | ✅ |
| Quarterly review cadence | ✅ |
| Fail-open for availability | ✅ |

### Documentation
- [Compliance Guide](docs/compliance.md) - Full GDPR/KYC/geo-block documentation
- [Key Management](docs/KEY_MANAGEMENT.md) - Encryption key handling
- [Deployment Checklist](scripts/deployment-checklist.md) - Production readiness

---

## 🚀 Production Deployment

### Prerequisites
- Docker & Docker Compose
- PM2 (`npm install -g pm2`)
- k6 load testing tool (optional)
- AWS KMS or HashiCorp Vault configured

### Deployment Steps

1. **Configure Environment**
   ```bash
   cp .env.example .env.production
   # Edit .env.production:
   # - Set KMS_PROVIDER=aws (or vault)
   # - Configure AWS_KMS_KEY_ID
   # - Set CAPTCHA_ENABLED=true with valid keys
   # - Generate TOTP_ENCRYPTION_KEY: openssl rand -base64 32
   ```

2. **Verify Security Configuration**
   ```bash
   npm run verify:security
   ```

3. **Start Infrastructure**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

4. **Run Database Migrations**
   ```bash
   npm run db:migrate:deploy
   ```

5. **Start Application with PM2**
   ```bash
   npm run server:build
   pm2 start pm2.config.js --env production
   pm2 save
   pm2 startup
   ```

6. **Verify Deployment**
   ```bash
   npm run health:test
   npm run load-test
   npm run verify:failover  # (staging only)
   ```

### Production Checklist

- [ ] KMS configured (AWS/Vault, not env)
- [ ] CAPTCHA enabled with valid hCaptcha/reCAPTCHA keys
- [ ] TOTP_ENCRYPTION_KEY set (32-byte random)
- [ ] Database connection pooling configured (20+ connections)
- [ ] Redis enabled for caching and pub/sub
- [ ] PM2 clustering enabled (`instances: 'max'`)
- [ ] Load tests passing (P95 < 500ms, error rate < 1%)
- [ ] Security verification passing
- [ ] Monitoring configured (Sentry, health checks)
- [ ] Backups automated (daily database dumps)
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting enabled
- [ ] Audit logging enabled (`ENABLE_KEY_AUDIT_LOGGING=true`)

### Verification Commands

```bash
# Security verification
npm run verify:security

# Health checks
npm run health:test

# Load testing
npm run load-test              # Normal load
npm run load-test:production   # 1000 concurrent users

# Full verification
npm run verify:all
```

### Rollback Procedure

```bash
# Stop current version
pm2 stop all

# Restore previous version
git checkout <previous-tag>
npm install
npm run server:build

# Rollback database (if needed)
./scripts/restore-database.sh <backup-file>

# Restart
pm2 restart all
```

