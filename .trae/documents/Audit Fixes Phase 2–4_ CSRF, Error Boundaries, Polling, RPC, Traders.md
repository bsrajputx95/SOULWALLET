## Scope
- Continue implementing HS audit: security (CSRF/web auth), reliability (error boundaries), performance (polling), data integrity (validation), and traders data source.
- Target files: server tRPC/Fastify, Home/Swap screens, traders router, secure-storage.

## Phase 2 — CSRF & Web Auth Strategy
- Add CSRF protection at server:
  - Register `@fastify/csrf-protection` with SameSite cookies in `src/server/fastify.ts`.
  - Create `csrfMiddleware` and apply to `protectedProcedure` in `src/server/trpc.ts`.
- Web auth storage:
  - For web builds, avoid storing `auth_token`/`refresh_token` in AsyncStorage; implement cookie-based httpOnly + SameSite=strict path in web flow.
  - Update `lib/secure-storage.ts` to return `null` for tokens on web and rely on cookie auth.
- Acceptance:
  - All mutations reject requests without valid CSRF; tokens not readable from JS on web.

## Phase 3 — Error Boundaries & UX Reliability
- Home tab granular boundaries:
  - Wrap each tab section (Trending, Traders, Copy Trading) with `ErrorBoundary` and local fallbacks in `app/(tabs)/index.tsx`.
  - Add retry buttons using query `refetch()`.
- Standardize error messages:
  - Introduce error message mapping utility; use across Home actions; ensure alerts show user-friendly text.
- Modal hygiene:
  - Add backdrop dismissal via `Pressable` overlay; reset form state on close; disable buttons during mutations.
- Acceptance:
  - Component errors isolated; modals dismiss by backdrop; duplicate submissions prevented.

## Phase 4 — Performance & Polling Consolidation
- Auth-gated polling already applied; now:
  - Add `staleTime` and align `refetchInterval` across queries in `app/(tabs)/index.tsx`.
  - Create a simple refresh orchestrator in `hooks/wallet-store.ts` to reduce concurrent calls.
  - Add offline indicator and cache fallback using React Query options.
- Acceptance:
  - ≤2 concurrent polls on Home; offline banner when disconnected; reduced re-renders.

## Phase 5 — RPC Resilience & Buffer Guard
- RPC failover wrappers:
  - Implement `executeWithFailover` helper in `hooks/solana-wallet-store.ts` and use for network calls.
  - Add retry with backoff on transient failures.
- Buffer guard:
  - In `app/_layout.tsx:33-39`, only assign `global.Buffer`/`window.Buffer` if undefined.
- Acceptance:
  - Operations switch RPC automatically on failure; no Buffer overrides when already present.

## Phase 6 — Traders Router Data Source
- Replace hardcoded top traders with DB-backed query:
  - Update `src/server/routers/traders.ts` to use `prisma.traderProfile.findMany({ isFeatured: true, isVerified: true })`, with validation of wallet addresses via `PublicKey` at insert.
- Add debounced trader search endpoint and client usage in Home.
- Acceptance:
  - No hardcoded addresses; trader list managed via DB; search works with debounce.

## Phase 7 — Frontend Validation & Accessibility
- Copy trade form:
  - Add numeric validation and balance checks; validate Solana address via `PublicKey`.
- Accessibility/i18n:
  - Add `accessibilityLabel`/`Role` on interactive elements; begin extracting critical strings for i18n.
- Acceptance:
  - Invalid inputs blocked early; improved screen reader support.

## Phase 8 — Tests & Docs
- Tests:
  - Add unit/integration tests for auth gating, CSRF rejection, send MAX fee-aware, swap execution path, storage behavior (web vs native), trader router DB source.
- Docs:
  - Update README and `.env.example` for new envs (`EXPO_PUBLIC_FIAT_ONRAMP_URL`, `EXPO_PUBLIC_MOONPAY_KEY`, RPC env standardization); document CSRF and cookie strategy.
- Acceptance:
  - CI green; coverage increased; env/docs consistent.

## File Changes (Planned)
- `src/server/fastify.ts`: register CSRF plugin; SameSite cookies.
- `src/server/trpc.ts`: add `csrfMiddleware` to `protectedProcedure`.
- `lib/secure-storage.ts`: adjust web token storage strategy.
- `app/(tabs)/index.tsx`: add error fallbacks, modal backdrop, orchestrated polling, offline banner.
- `hooks/wallet-store.ts`: orchestrate refetch; offline handling.
- `hooks/solana-wallet-store.ts`: add `executeWithFailover` and backoff; Buffer guard not here, see layout.
- `app/_layout.tsx`: guard Buffer assignment.
- `src/server/routers/traders.ts`: DB-backed featured list and search; address validation at insert.
- `__tests__/...`: new tests for above.

## Acceptance Checklist
- CSRF enforced; web tokens not in AsyncStorage.
- Granular error boundaries; modals cleaned up.
- Polling reduced; offline mode visible.
- RPC failover and timeouts validated; Buffer guarded.
- Traders data sourced from DB; search implemented.
- Tests/docs updated and passing.

Please confirm to proceed with Phases 2–8 above; I will implement and verify each item sequentially with tests and acceptance checks.