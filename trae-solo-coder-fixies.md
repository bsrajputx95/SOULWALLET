# Trae Solo Coder Fixies

## Index
- Security
- Performance
- Reliability/UX
- Documentation

## Security
- Issue: Unencrypted wallet storage flows in Solana provider
  - Files: `hooks/solana-wallet-store.ts:176-211,730-744`
  - Approach: Removed loading/saving of unencrypted private keys; enforced encrypted-only flows with password; retained unlock path.
  - Classification: Permanent solution
  - Impact: Eliminates private key exposure via unencrypted storage
  - Verification: Created/imported encrypted wallet; balances refresh and backend sync work.

- Issue: Missing rate limiting on copy trading mutations
  - Files: `src/server/routers/copyTrading.ts:99-110,208-218,255-259,428-432`
  - Approach: Applied strict rate limiting using existing rate limiter context on start/update/stop/close.
  - Classification: Permanent solution
  - Impact: Prevents abuse and overload of sensitive mutations
  - Verification: Calls under normal cadence succeed; excessive calls return TOO_MANY_REQUESTS.

- Issue: Market external API response unvalidated
  - Files: `src/lib/services/marketData.ts:18-26,42-121,127-168`
  - Approach: Added Zod validation for search responses and a simple circuit breaker fallback to cached results.
  - Classification: Permanent solution
  - Impact: Reduces crash risk from malformed data
  - Verification: Invalid responses yield empty pairs; valid responses pass and cache works.

- Issue: Hard-coded MoonPay URL/key in Home
  - Files: `app/(tabs)/index.tsx:292-303`
  - Approach: Replaced with env-driven URL/key; added unavailable alert when missing.
  - Classification: Permanent solution
  - Impact: Removes hard-coded secrets; allows env configuration
  - Verification: BUY opens correct URL; missing env shows alert.

## Performance
- Issue: UI hangs on transaction confirmations
  - Files: `hooks/solana-wallet-store.ts:445-451,600-604`
  - Approach: Added 60s confirmation timeout to SOL and SPL transactions.
  - Classification: Permanent solution
  - Impact: Prevents indefinite waits
  - Verification: Timeout errors surface; successful confirmations proceed.

## Reliability/UX
- Issue: Errors crash whole Home screen
  - Files: `app/(tabs)/index.tsx:327-392,394-468,472-580`
  - Approach: Wrapped each tab content with `ErrorBoundary` components.
  - Classification: Permanent solution
  - Impact: Isolates failures per section; improves resilience
  - Verification: Section-specific errors show fallback and allow retry.

- Issue: Copy trading modal lacks validation/backdrop dismiss
  - Files: `app/(tabs)/index.tsx:728-736,847-881`
  - Approach: Added address + numeric validation, balance checks; disabled state during mutation; backdrop press dismiss.
  - Classification: Permanent solution
  - Impact: Prevents invalid submissions and improves UX
  - Verification: Invalid inputs blocked; mutation disables button; backdrop closes modal.

## Documentation
- Issue: HS.md incomplete
  - Files: `audits/HS.md`
  - Approach: Added architecture overview, API references, data models, dependencies, verified code examples.
  - Classification: Permanent documentation
  - Impact: Accurate reference for future work
  - Verification: Cross-checked file_path:line_number references.

- Issue: No consolidated project audit doc
  - Files: `audits/PROJECT_AUDIT.md`
  - Approach: Added audit report covering static analysis, security, performance, architecture, tests/CI, risks, next actions.
  - Classification: Permanent documentation
  - Impact: Central reference for improvements
  - Verification: Matches current repository state.

## Risk & Impact Summary
- Security changes reduce key exposure and mutation abuse.
- UX changes reduce crashes and improve modal behavior.
- Documentation improves onboarding and quality.

## Verification Methods
- Manual testing of Home flows; encryption paths; rate-limited endpoints; environment-driven BUY; transaction timeout behavior.