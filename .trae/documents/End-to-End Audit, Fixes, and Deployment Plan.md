## Phase 1: Finalize HS.md
- Expand and align documentation with current codebase:
  - Architecture Overview: Expo Router React Native app + Fastify+tRPC backend + Prisma; Solana wallet provider; Market/Traders/Copy Trading.
  - Diagrams: Auth flow, Copy Trading flow, Transaction flow, Deployment architecture (backend, DB, Redis, monitoring).
  - API References: tRPC routers and procedures with inputs/outputs/errors:
    - Market: `src/server/routers/market.ts`
    - CopyTrading: `src/server/routers/copyTrading.ts`
    - Traders: `src/server/routers/traders.ts` (verify DB-backed source)
    - Wallet/Portfolio (if present)
  - Data Models: Prisma schema tables and relations (CopyTrading, Position, TraderProfile, MonitoredWallet) from `prisma/schema.prisma`.
  - Dependencies: Client (Expo, React Query, lucide), Server (Fastify, tRPC, Prisma, rate-limiter, Redis optional), Testing (Jest), CI/CD scripts in `package.json`.
  - Code Samples: Verified and updated examples for providers and hooks (`app/_layout.tsx`, `hooks/solana-wallet-store.ts`, `app/(tabs)/index.tsx`).
  - Env & Config: Document `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_MOONPAY_KEY`, `EXPO_PUBLIC_FIAT_ONRAMP_URL`, Solana RPC envs; feature flags behavior.
- Acceptance: HS.md contains accurate specs, diagrams, API/data refs, and verified samples matching current code.

## Phase 2: Full Project Audit
- Static Analysis: Run type-check, ESLint, Prettier checks; catalog violations.
- Security Review:
  - Authentication/authorization and protected procedures (`src/server/trpc.ts`).
  - Rate limiting coverage for sensitive mutations (`src/server/routers/copyTrading.ts`).
  - CSRF strategy for web builds (plan to add plugin + middleware).
  - Token storage policy (web/native) in `lib/secure-storage.ts`.
  - External API validation (DexScreener) `src/lib/services/marketData.ts` and others.
- Performance Review:
  - Polling cadence and `staleTime` across Home queries.
  - StyleSheet size and re-render risk on Home.
  - Backend N+1 risks and query efficiency.
- Architecture Consistency:
  - Buffer polyfill guards (`app/_layout.tsx`); env naming consistency client/server.
  - Shared types import boundaries; client-safe type-only imports.
- Tests & CI/CD:
  - Current test coverage; pipeline steps (format, lint, type-check, build, migrate).
- Output: A categorized audit report with severity, rationale, and recommended actions.

## Phase 3: Systematic Fixes (Preserving Stack)
- Critical Path (already partly done):
  - Encrypted-only wallet storage; remove unencrypted flows (`hooks/solana-wallet-store.ts`).
  - Rate limiting on copy trading mutations (`src/server/routers/copyTrading.ts`).
  - Market validation + circuit breaker (`src/lib/services/marketData.ts`).
  - Auth gating and MoonPay env externalization on Home (`app/(tabs)/index.tsx`).
  - Transaction confirmation timeouts for SOL/SPL.
- Remaining Fixes (Home-first):
  - CSRF plugin registration (server) and tRPC middleware; document web cookie auth.
  - Error boundaries per Home section with fallbacks and retry.
  - Numeric + balance validation and address checks for copy modal.
  - Polling consolidation (`staleTime`, `refetchOnWindowFocus:false`), simple refresh orchestrator, optional offline indicator.
  - Time filters wired where supported; trader/market search pagination & limits.
  - Modal hygiene (backdrop dismiss, cleanup, disabled state); accessibility labels; seed i18n.
- Verification: Unit/integration tests and manual flows; backward compatibility via feature flags.

## Phase 4: Audit Documentation (trae-solo-coder-fixies.md)
- For each change: issue, approach + rationale, temp vs permanent, impact + risks, verification steps + test results.
- Structure by category: Security, Performance, Reliability, UX, Docs, Deployment.
- Include `file_path:line_number` citations and env/config changes.

## Phase 5: Industrial Deployment Readiness
- Logging & Monitoring: Standardize logger; add correlation IDs; integrate Sentry; performance marks on Home.
- Security Hardening: CSRF protection, sanitized inputs (Zod + text sanitization), token storage policy for web; rate limiting and locks for copy trading.
- Scalability: RPC failover helpers and health checks; Redis-backed locks; cache policies for market/trader data.
- Deployment Docs: Update README and `.env.example` with required envs; docker-compose usage; PM2 config; CI pipeline steps; health checks.
- Container & Orchestration: Validate Dockerfiles/compose; readiness/liveness endpoints; outline k8s orchestration if applicable.

## Deliverables
- Updated `audits/HS.md` with complete documentation.
- Full audit report listing issues, severity, and actions.
- Implemented fixes and tests with clear commit strategy (grouped by feature/fix).
- `trae-solo-coder-fixies.md` documenting all modifications.
- Deployment-readiness documentation and verified container setup.

## Acceptance Criteria
- Documentation is accurate and comprehensive; code samples validated.
- Security/performance/reliability issues addressed or listed with planned resolution.
- Home screen meets validation, error isolation, and performance goals.
- CI/Type-check/Lint/Format pass; tests cover critical flows.
- Deployment docs and containers ready for production usage.

Confirm to proceed; I’ll execute Phases 1–5 sequentially, delivering verified changes and documentation.