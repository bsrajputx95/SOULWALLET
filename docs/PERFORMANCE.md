# Performance Benchmarks

This document tracks performance targets and benchmarks for the SOULWALLET application.

## Account Settings

| Metric | Target | Notes |
|--------|--------|-------|
| Account screen load time | <500ms | From navigation to content visible |
| Profile update latency | <1s | From save tap to confirmation |
| Image upload time | <3s | For 5MB image (compressed to ~500KB) |
| 2FA QR generation | <2s | Password verification + QR generation |

### Optimizations Applied
- **Skeleton loaders**: Show placeholder UI during data fetch
- **Optimistic updates**: Local state updated before server confirmation
- **Image compression**: 800x800px, 70% quality JPEG reduces upload size by ~90%
- **Component extraction**: ProfileForm and SecurityModal extracted for better re-render performance

---

## Wallet Operations

| Metric | Target | Notes |
|--------|--------|-------|
| Wallet unlock | <500ms | PBKDF2 key derivation |
| Balance refresh | <1s | SOL + all token balances |
| Send SOL | <3s | TX simulation + broadcast + confirmation |
| Swap execution | <5s | Quote + TX build + sign + broadcast |

### Optimizations Applied
- **Native PBKDF2**: 310k iterations with react-native-quick-crypto (vs 250k JS on web)
- **Batch RPC calls**: Multiple balance queries batched
- **Optimistic balance updates**: Show pending state immediately
- **Race condition fix**: 2s buffer after finalization before refresh

---

## Portfolio

| Metric | Target | Notes |
|--------|--------|-------|
| Holdings load | <800ms | Token list with cached metadata |
| P&L calculation | <500ms | Server-side with Redis cache |
| Token metadata fetch | <1s | Metaplex fallback for unknown tokens |

### Optimizations Applied
- **Redis caching**: Portfolio snapshots cached 5 minutes
- **Metaplex metadata**: 24h cache for on-chain token metadata
- **expo-image**: Optimized image loading with memory-disk cache

---

## App Startup

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start (Android) | <2s | Hermes enabled |
| Cold start (iOS) | <1.5s | Hermes enabled |
| Hot reload | <500ms | Development only |

### Optimizations Applied
- **Hermes engine**: Bytecode compilation for faster startup
- **Lazy loading**: Non-critical modules loaded on demand
- **Image optimization**: expo-image with caching policy

---

## Load Testing Results

> Run with: `k6 run tests/load/wallet-flows.js`

| Test Scenario | P95 Latency | P99 Latency | Error Rate |
|---------------|-------------|-------------|------------|
| 1K concurrent users | TBD | TBD | TBD |
| 10K concurrent users | <200ms target | <500ms target | <0.1% target |

---

## Lighthouse Scores (Web)

> Run with: `npx lighthouse https://app.soulwallet.io --view`

| Metric | Target | Current |
|--------|--------|---------|
| Performance | >90 | TBD |
| Accessibility | >95 | TBD |
| Best Practices | >90 | TBD |
| SEO | >80 | TBD |

---

## Monitoring

Performance metrics are collected via:
- **Prometheus**: Server-side latency histograms
- **Sentry**: Client-side performance traces
- **Custom metrics**: `src/lib/metrics.ts` business KPIs

Key metrics to monitor:
- `wallet_operation_duration_seconds` - Wallet operation latency
- `api_request_duration_seconds` - API endpoint latency
- `queue_job_duration_seconds` - Background job processing time

---

## Rollback Thresholds

If performance degrades beyond these thresholds, consider rollback:
- P95 latency >500ms for core operations
- Error rate >1%
- Memory usage >500MB (mobile)
- CPU usage sustained >80%
