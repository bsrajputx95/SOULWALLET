## Status
- Not fully finished. Critical items completed: encrypted-only wallet storage (hooks/solana-wallet-store.ts:176-211, 730-744), strict rate limiting for copy trading (src/server/routers/copyTrading.ts:99-110,208-218,255-259,428-432), market response validation + circuit breaker (src/lib/services/marketData.ts:18-26,42-121,127-168), auth gating + MoonPay env externalization (app/(tabs)/index.tsx:47-50,68-74,78-81,149-155,177-180,285-290), transaction confirmation timeouts (hooks/solana-wallet-store.ts:445-451,600-604).

## Phase A — Security & Reliability (Home-focused)
1. CSRF protection for all tRPC mutations (server-side): register plugin and add middleware for protected procedures; verify from Home actions.
2. Address validation (PublicKey) for send/copy flows and MAX SOL fee-aware behavior in `/send-receive` referenced by Home quick actions.
3. Error boundaries per Home section with fallbacks and retry buttons.
4. Numeric input validation and balance checks for Copy Trading modal; prevent invalid submissions.

## Phase B — Performance & Data Flow
1. Consolidate polling with `staleTime`, `refetchOnWindowFocus:false` across Home queries; orchestrate refetch in wallet-store.
2. Implement offline detection and cached display banner on Home.
3. Time filters wired to backend queries for coins/traders; update query params on filter change.
4. Market/trader search pagination and result limits; keepPreviousData for smooth pagination.

## Phase C — UX & Accessibility
1. Modal hygiene: backdrop dismiss, cleanup on close, disable actions during mutations.
2. Add accessibility labels/roles/hints to Home interactive elements; improve contrast.
3. Begin i18n extraction for critical Home strings (labels/buttons) using react-i18next.

## Phase D — Observability & Testing
1. Centralized error message mapping for Home; user-friendly alerts and technical logs separated.
2. Add analytics for key actions (copy start/stop, buy, swap, send) and performance marks for Home mount.
3. Tests: unit/integration for auth gating, CSRF rejection on mutation, address/numeric validation, offline banner, polling cadence; add testIDs.
4. Style extraction from Home into `styles/home.styles.ts` for performance and maintainability.

## Files To Update
- server: `src/server/fastify.ts`, `src/server/trpc.ts` (CSRF); `src/server/routers/traders.ts` (if wiring time filters/search pagination needed for Home data).
- Home: `app/(tabs)/index.tsx` (error boundaries, offline, filters, modal hygiene, accessibility, i18n labels, analytics, polling options).
- Stores: `hooks/wallet-store.ts` (refetch orchestration, offline).
- Send/Receive: `app/send-receive.tsx` (address validation, MAX fee-aware).
- Tests/docs: `__tests__/home/*`, README, `.env.example` for CSRF/cookie strategy.

## Acceptance
- Home sections isolated on error, retry works; inputs validated; auth-gated queries minimal polling; offline banner shows cached data; filters affect queries; accessibility improved; analytics/tracing active; tests/CI pass.

Approve to implement these Home-screen fixes now; I will deliver verified changes and tests in order.