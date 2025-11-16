## Confirmation
- Read `audits/HS.md` end-to-end and mapped findings to the repo.
- Primary focus begins on Home tab (per audit), with Market integrations and stack/env alignment included.

## Immediate Priorities (Critical)
- Wallet key storage: remove unencrypted paths, enforce password-encrypted storage and biometrics. References: `hooks/solana-wallet-store.ts:114,256-281,283-309`.
- Copy trading security: add per-user rate limiting, idempotency keys, distributed locking (Redis), transaction isolation. References: `src/server/routers/copyTrading.ts:99-203,255-295`.
- CSRF protection: register CSRF at Fastify and enforce in tRPC protected procedures. References: `src/server/fastify.ts`, `src/server/trpc.ts`.
- External API validation: Zod-validate DexScreener/Birdeye/Jupiter responses; add circuit breaker and TTL cache. References: `src/server/routers/market.ts:18-47`, `src/lib/services/marketData.ts:1-171`.
- Transaction safety: simulate all types, validate slippage and account state, add confirmation timeout and retry; MEV mitigation options. References: `hooks/solana-wallet-store.ts:410-466,469-486`.

## High-Impact UX/Performance
- Auth gating and polling: gate protected queries on auth; consolidate intervals; set `staleTime`/`refetchOnWindowFocus:false`. References: `app/(tabs)/index.tsx:47-90`.
- MoonPay key externalization + flags: move key/URL to env; gate BUY by feature flag. References: `app/(tabs)/index.tsx:285-289`.
- Search hardening: add pagination/limits and input sanitization to market/trader searches. References: `src/server/routers/market.ts:18-27`, Home search usage `app/(tabs)/index.tsx:149-155`.
- RPC resilience: failover retries and health checks; standardize env names; add confirmation timeout. References: `hooks/solana-wallet-store.ts:29-72,469-486`.

## Reliability & Error Handling
- Granular ErrorBoundaries per section (Trending/Traders/Copy Trading); unified error messages with codes/help. References: `app/(tabs)/index.tsx:574-712`, `components/ErrorBoundary.tsx`.
- Modal state hygiene: backdrop dismiss; reset all form state on close; disable during mutations.

## Maintainability & Tests
- Split Home (2000+ lines) into feature components/hooks; extract massive styles to `styles/`.
- Type safety: remove `any` in Home/Swap handlers; enforce type-only imports from server.
- Tests: unit/integration for auth gating, send MAX fees, swap execution path, storage security; add testIDs.

## Accessibility & i18n
- Add accessibility labels/hints/roles; ensure contrast.
- Extract strings to i18n; introduce `react-i18next` for future localization.

## Deployment & Env Alignment
- Standardize Solana RPC env across client/server; document mapping.
- Ensure tRPC base URL works on device; prefer `EXPO_PUBLIC_API_URL`.
- Align Prisma provider with CI; migrations/tests pass.
- Web auth strategy: httpOnly cookies + CSRF for web, or disable prod web login.

## Acceptance Checks
- No unencrypted wallet storage; encrypted-only flows pass unlock + balance refresh.
- Copy-trading mutations respect rate limits/locks and are idempotent.
- CSRF enforced on all mutations; cookies have `SameSite=strict`.
- Market/trader responses validated; circuit breaker/fallback works.
- Home queries gated on auth; ≤2 concurrent polls; MoonPay key removed from code.
- Transaction sending/swap simulate first; timeout + retry implemented.
- Error boundaries isolate failures; user-friendly messages shown.
- Tests pass; CI green; env/docs updated.

## Execution Order (Phase 1)
1. Wallet storage hardening in `hooks/solana-wallet-store.ts` (remove unencrypted paths, enforce encrypted + biometric, KDF).
2. Copy trading router hardening: rate limit + idempotency + Redis locks. File: `src/server/routers/copyTrading.ts`.
3. CSRF registration and middleware wiring. Files: `src/server/fastify.ts`, `src/server/trpc.ts`.
4. Market API validation schemas + circuit breaker/TTL updates. Files: `src/server/routers/market.ts`, `src/lib/services/marketData.ts`.
5. Transaction simulation/timeout/retry additions. File: `hooks/solana-wallet-store.ts`.
6. Auth gating + MoonPay externalization + flags on Home. File: `app/(tabs)/index.tsx`.

## Deliverables
- PRs per step with targeted changes, tests, and documentation updates (`.env.example`, README, flags table).

Approve to begin Phase 1 implementation steps above; I will execute and verify each item sequentially with tests and acceptance checks.