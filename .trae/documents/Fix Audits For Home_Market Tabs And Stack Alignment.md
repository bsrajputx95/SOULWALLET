## Scope
- Address all findings in `audits/HS.md` across security, performance, reliability, UX, accessibility, and testing.
- Focus first on Home tab (primary audit target) and align stack/configs; then apply cross-cutting fixes.

## Priorities
- Critical: wallet key storage security, rate limiting, CSRF, external API response validation, transaction simulation coverage, copy-trading concurrency/locking, error handling boundaries.
- High: polling consolidation, pagination/limits for searches, modal memory leaks cleanup, auth gating for protected queries, RPC failover/timeout, consistent error messaging, offline mode basics.
- Medium/Low: refactors (component split, styles), i18n, analytics, logging, naming/formatting, tests, accessibility.

## Phase 1 — Security & Stability (Critical)
1. Remove unencrypted wallet storage; enforce encrypted storage and biometric option (`hooks/solana-wallet-store.ts`).
2. Add per-user rate limiting and idempotency to copy-trading mutations; implement distributed locking (Redis) and DB transaction isolation (`src/server/routers/copyTrading.ts`).
3. Implement CSRF protection at Fastify layer and tRPC middleware; add SameSite cookies for web (`src/server/fastify.ts`, `src/server/trpc.ts`).
4. Validate all external API responses (Birdeye/Jupiter/DexScreener) with Zod schemas; cache validated data with TTL and circuit breaker (`src/server/routers/*`, `src/lib/services/*`).
5. Expand transaction simulation and pre-flight checks for all types; add slippage, rent-exemption, account existence validation; MEV mitigation options (`hooks/solana-wallet-store.ts`).
6. Add granular ErrorBoundaries per section on Home; standardize error handling utilities and user-friendly messages.

## Phase 2 — Auth & Performance
1. Gate all protected queries with `enabled: isAuthenticated`; add refresh handling and consolidate refetch orchestration (Home, Swap, Wallet stores).
2. Replace hard-coded MoonPay URL/key with env vars; feature-flag BUY; remove any `pk_live` occurrences.
3. Consolidate polling intervals; set `staleTime`, `refetchOnWindowFocus: false`; align cadences across Home queries.
4. Add pagination and result limits to market/trader searches; implement server-side cursor-based pagination and input sanitization.
5. Implement RPC failover with retries and health checks; add confirmation timeout for transactions.

## Phase 3 — UX & Reliability
1. Fix modal memory leaks; reset state on close; backdrop dismiss; extract modals to components; add loading/disabled states for mutations.
2. Implement error recovery flows with retry and fallbacks; unify error messages with code mapping and help text.
3. Ensure time filters affect backend queries; pass period params; update server endpoints accordingly.
4. Add balance validation before copy-trade submissions; optimistic updates with rollback.

## Phase 4 — Maintainability & Tests
1. Split Home (2000+ lines) into feature components and hooks; extract styles into separate files; remove duplicate modal code.
2. Remove `any` types and ensure client-only type imports; move shared types to a safe shared package.
3. Add unit/integration tests for gating, send MAX fees, swap execution, storage security; add testIDs to critical elements.
4. Implement structured logging with levels and correlation IDs; minimize console logs in production.

## Phase 5 — Accessibility & Internationalization
1. Add accessibility labels/hints/roles; support dynamic font sizes; improve color contrast.
2. Introduce i18n (react-i18next); extract strings; add language selection and RTL support.

## Phase 6 — Deployment/Env Alignment
1. Standardize Solana RPC env names across client/server; document mapping.
2. Ensure tRPC base URL resolves on device (Expo LAN/IP); prefer `EXPO_PUBLIC_API_URL`.
3. Align Prisma provider in CI with runtime (SQLite/Postgres); adjust migrations/tests.
4. Document web auth strategy: httpOnly cookies + CSRF or disable prod web login.

## Verification & Acceptance
- Authentication gating: unauth state triggers no protected requests; post-login enables queries without churn.
- MoonPay externalization: no hard-coded keys; BUY gated by flags.
- Search pagination: capped results, cursor flow verified.
- Copy-trading: rate limiting, locking, idempotency prevent duplicates; parameters validated.
- Transaction simulation: all types simulated; timeout and retry behavior verified.
- Error boundaries: tab-level failures isolated with fallbacks.
- Tests: unit/integration pass; CI green; performance monitoring shows reduced polling and fewer re-renders.

## Deliverables
- Comprehensive PRs per phase with tests and docs updates.
- Updated `.env.example`, README, and audit notes describing resolutions.

Please confirm to proceed with Phase 1 (Security & Stability).