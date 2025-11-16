## Objectives
- Align fixes with the existing Expo + Fastify + tRPC stack.
- Systematically address audit findings in `audits/*` and code hotspots.
- Preserve performance and UX of the Market tab while improving security and reliability.

## Current Stack Summary
- Mobile: Expo React Native with `expo-router`, `@tanstack/react-query`, context hooks.
- Backend: Fastify + tRPC, Prisma, axios; optional caching.
- Market data: DexScreener via `src/lib/services/marketData.ts` with curated `SoulMarket` filters.
- Testing: Jest with Expo setup; PM2/Docker for deployment; env validation scripts.

## Audit Inventory & Classification
- Locate and catalog all audit files under `audits/` (e.g., `audits/HS.md`).
- Classify findings by severity: critical, high, medium, low; tag by area (auth, data fetching, caching, env/secrets, routing/UI, performance).
- Identify actionable items vs informational notes.

## Remediation Strategy
- Critical/high first: authentication/authorization gaps, secret handling, input validation, rate limiting, DOS/timeout safeguards, SSRF/XSS/CSRF risks.
- Market data service hardening: request validation, error handling, retry/backoff, circuit breaker, cache TTL/size, sanitization of external data.
- tRPC/React Query: strict input schemas, error boundaries, query invalidation rules, refresh intervals sanity.
- Environment & secrets: `.env` loading safety, production config checks, vault/secret manager integration (if applicable), avoid logging secrets.
- Build/deploy: PM2/Docker configs, healthchecks, resource limits, Node version pinning, CI lint/test gates.

## Verification & Tests
- Unit tests for market data service filters and error paths.
- Contract tests for tRPC routers (`market.search`, `market.trending`, `market.soulMarket`).
- E2E smoke for Market tab rendering, filters, search, and error states.
- Performance checks: query timings, caching effectiveness, UI frame rates.

## Documentation & Tracking
- Update audit files with status, remediation notes, and verification evidence.
- Create a checklist mapping each finding to a fix and a test.
- Maintain changelog entries for security-impacting changes.

## Deliverables
- Remediated code aligned with the stack.
- Passing tests and measurable improvements in stability/performance.
- Updated `audits/*` with resolutions and references.

## Next Steps
- Confirm this plan and share any priority audits or specific files to address first.
- Once approved, I will start with audit inventory, then proceed by severity and validate each fix with tests.