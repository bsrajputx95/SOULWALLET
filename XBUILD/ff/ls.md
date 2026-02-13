# Login + Signup Stabilization Plan (Android Beta, Speed + No-Crash First)
## Problem statement
You want login/signup to be fast, simple, stable, and agent-executable with zero ambiguity. The implementation must avoid overengineering, keep only practical security, and prioritize crash prevention + smooth UX on Android beta.
## Current state snapshot (auth-only)
The auth flow is functional but has avoidable fragility and duplication.
- Frontend auth screens are separate and heavily duplicated in structure and styling: `app/(auth)/login.tsx (1-320)` and `app/(auth)/signup.tsx (1-360)`.
- Login currently blocks submit behind a Terms checkbox (`app/(auth)/login.tsx:37`, `app/(auth)/login.tsx:204`), which adds friction on every login.
- Login input is labeled username/email but uses email keyboard (`app/(auth)/login.tsx:136`), which is not ideal for username entry.
- Signup password hint says stricter requirements than backend actually enforces (`app/(auth)/signup.tsx:205` vs backend min length in `soulwallet-backend/src/server.ts (140-152)`).
- API client has a confirmed type/logic issue in auth path: `services/api.ts:42` calls `clearSession` with an argument, but `clearSession` accepts none (`utils/session.ts (36-45)`), which means intended logout callback behavior is not executed there.
- API client auth header typing also fails strict TS (`services/api.ts:27`), increasing maintenance risk.
- Auth backend endpoints exist and are straightforward (`soulwallet-backend/src/server.ts (216-320)` and `soulwallet-backend/src/server.ts (320-520)`), with auth rate limiting already present (`soulwallet-backend/src/server.ts (111-112)`).
- Lint command is currently not runnable because `eslint-plugin-jsdoc` is referenced but missing (`.eslintrc.js (8-25)`), so static quality checks must not rely only on lint until this is addressed.
## Improved prompt for implementation agents (copy/paste)
You are implementing login/signup improvements for an Android beta app.
Primary goals (strict order):
1) No crashes
2) Fast perceived performance
3) Simplicity and maintainability
4) Reasonable beta-level security only
Hard constraints:
- Scope only auth flow: login/signup screens and directly related auth utilities/services/context/backend auth endpoints.
- Do not add new product features, new auth systems, or architecture overhauls.
- Do not add heavy security systems (2FA, OAuth redesign, refresh-token architecture) in this task.
- Preserve existing API contracts unless this plan explicitly says otherwise.
- Prefer small, local refactors over broad rewrites.
Execution behavior:
- Make changes in small commits internally (if committing is enabled), one logical concern at a time.
- After each concern, run verification and record pass/fail.
- If a change increases complexity without clear stability/perf benefit, revert it.
- Keep UI behavior predictable and backward-compatible.
Definition of done:
- Auth flow has no known crash paths under normal invalid-input/network-failure scenarios.
- Duplicate-submit and session-clear edge cases are handled.
- Login/signup code is simpler (less duplication or clearer shared logic), with no dead code in touched files.
- Manual smoke test matrix passes.
## Proposed implementation
### Phase 1: Stabilize auth primitives first (must do before UI changes)
Objective
Remove auth-state inconsistency and type pitfalls that can cause unstable behavior.
Changes
- `services/api.ts`
  - Replace unsafe header mutation pattern with a typed headers object to resolve `services/api.ts:27` type issue.
  - Fix 401 handling so session clear and in-memory logout both execute deterministically (do not pass ignored callback into `clearSession`; call functions explicitly in sequence).
  - Keep redirect to `/(auth)/login`, but ensure it occurs after session cleanup attempt.
  - Add safe JSON parsing fallback for non-JSON error bodies to avoid secondary parsing crashes.
- `utils/session.ts`
  - Keep it simple: pure storage utilities only.
  - Ensure `clearSession` responsibility is explicit and side-effect scope is documented (storage clear only, no router side effects).
- `contexts/AuthContext.tsx`
  - Keep existing shape, but verify logout remains idempotent and safe when called multiple times.
Acceptance gate
- 401 from any authenticated API call reliably clears storage + in-memory token and returns user to login without app crash or stale-auth UI.
### Phase 2: Simplify login flow for speed + reliability
Objective
Reduce friction and eliminate avoidable failure paths in login.
Changes
- `app/(auth)/login.tsx`
  - Add explicit duplicate-submit guard (`if (isLoading) return`) at handler start.
  - Normalize input once (`trim`) and reuse normalized value.
  - Change username/email field keyboard behavior to a neutral input mode appropriate for either username or email (`app/(auth)/login.tsx:136`).
  - Remove login-time Terms gating from submit path (keep legal acceptance only in signup), to reduce friction and support faster return-login.
  - Keep error surface concise and user-friendly (avoid leaking raw internal errors where possible).
  - Keep haptics optional (non-web only), but ensure no uncaught promise crashes from feedback calls.
Acceptance gate
- One tap/submit triggers one request.
- Valid login navigates to tabs and persists token.
- Invalid credentials and offline errors show stable message, no crash, no stuck loading state.
### Phase 3: Align signup validation with backend and remove ambiguity
Objective
Make signup behavior predictable and consistent between frontend and backend.
Changes
- `app/(auth)/signup.tsx`
  - Add lightweight client validation matching backend constraints in `soulwallet-backend/src/server.ts (140-152)`:
    - username length/allowed chars
    - valid email format
    - password minimum length
    - password confirmation match
  - Fix hint text to match actual enforced policy (currently mismatch at `app/(auth)/signup.tsx:205`).
  - Add duplicate-submit guard to prevent repeated registration calls.
  - Keep Terms gating for signup only.
Acceptance gate
- Client-side validation prevents obvious bad requests.
- Backend validation errors still render cleanly when server rejects input.
- Successful signup stores session once and routes to tabs.
### Phase 4: Remove auth bloat without overengineering
Objective
Cut duplication and dead logic in touched auth files only.
Changes
- Consolidate repeated token persistence logic used by login/signup into one tiny helper (single responsibility, no framework abstraction).
- Remove dead imports/unused state/functions in touched auth files.
- Keep styling approach simple; extract only if it clearly reduces duplicated auth boilerplate with low risk.
Acceptance gate
- Touched files have no obvious dead code.
- Readability improves without adding architectural layers.
### Phase 5: Backend auth sanity alignment (minimal)
Objective
Ensure backend auth behavior remains simple, fast, and stable for beta.
Changes
- `soulwallet-backend/src/server.ts`
  - Keep current auth limiter and endpoint structure.
  - Ensure auth error responses are consistent and concise (`{ error: string }`) across register/login failures.
  - Do not introduce heavy security mechanisms in this phase.
Acceptance gate
- Register/login responses are predictable for frontend mapping.
- No regression in existing auth endpoints.
## Verification protocol (agent must execute)
Run/verify in this exact order
1) Static check for auth-related TS issues
- `npx tsc --noEmit --pretty false` and isolate auth-file failures.
- Required pass condition for touched auth files: no new TS errors introduced in those files.
2) Auth smoke tests (manual)
- Login success (existing user).
- Login invalid password.
- Login with network unavailable.
- Signup success (new user).
- Signup validation failures (bad email, short password, mismatch password).
- Duplicate tap/submit on both screens.
- Forced 401 scenario from protected route: verify storage cleared + redirect works.
3) Regression sanity
- App relaunch with valid token should remain authenticated.
- App relaunch after forced 401 should open login screen.
Notes
- If lint remains blocked by missing `eslint-plugin-jsdoc`, do not expand scope to tooling migration in this task; record it as separate tech-debt.
## Explicit non-goals for this task
- No social login, no MFA, no refresh-token redesign, no biometric auth changes.
- No backend modularization/route architecture rewrite.
- No UI redesign beyond necessary auth simplification and clarity fixes.
## Expected outcome
After implementation, login/signup should feel faster, fail safely, avoid duplicate-request bugs, stay consistent with backend validation, and be simpler for future maintenance without unnecessary engineering weight.
