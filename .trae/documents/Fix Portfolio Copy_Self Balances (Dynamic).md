## Goal

Replace hardcoded portfolio balances for “Copy Trade” and “Self” with real, dynamic values.

## Scope

* Screen: `app/(tabs)/portfolio.tsx`

* Lines to change: `app/(tabs)/portfolio.tsx:220-227`

* No backend changes required; leverage existing tRPC endpoints.

## Data Sources

* `trpc.copyTrading.getOpenPositions.useQuery()` → returns open positions with `currentValue` per position.

* `useWallet()` → `totalBalance` (from `portfolio.getOverview`) already used in the screen.

## Implementation

1. Add query:

   * Call `trpc.copyTrading.getOpenPositions.useQuery()` near other portfolio queries.
2. Compute balances:

   * `copyTradeBalance = sum(positions.map(p => p.currentValue))`.

   * `selfBalance = Math.max(0, totalBalance - copyTradeBalance)`.
3. Replace hardcoded UI:

   * Update the “Copy Trade” and “Self” value texts at `app/(tabs)/portfolio.tsx:221` and `app/(tabs)/portfolio.tsx:226` to render `formatCurrency(copyTradeBalance)` and `formatCurrency(selfBalance)`.
4. Formatting & UX:

   * Use a small `formatCurrency(value)` helper (Intl.NumberFormat) co-located in the component for consistent display.

   * Show `$0.00` while loading or if no data; avoid flicker by checking query `isLoading`.
5. Performance:

   * Reuse existing `refetch` from `useWallet()`; also let `getOpenPositions` use its defaults (already paginated and efficient), no extra polling beyond what’s configured.

## Verification

* Manual: Start app, open Portfolio. Ensure values reflect open positions. Close or open a position and verify real-time updates on refresh.

* Consistency: Verify `copyTradeBalance + selfBalance` approximates `totalBalance` (minor differences possible due to pricing sources).

## Fallbacks & Edge Cases

* If `getOpenPositions` returns empty or fails, fallback to budgets:

  * `copyTradeBalance = sum(copiedWallets.map(w => w.totalAmount || 0))`.

  * Maintain `selfBalance = Math.max(0, totalBalance - copyTradeBalance)`.

* If `useWallet().totalBalance` is 0 or undefined, show `$0.00` for both.

## Acceptance Criteria

* No hardcoded values remain on Portfolio.

* “Copy Trade” shows live aggregate value of open copied positions.

* “Self” shows remainder of portfolio not in copy trades.

* Handles loading/error states gracefully without breaking layout.

