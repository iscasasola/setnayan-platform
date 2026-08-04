/**
 * Budget-truth feature flag (Explore_Replan_BUILD_SPEC_2026-07-27.md §18.6).
 *
 * Gates every surface's move onto the shared money resolver
 * (`lib/budget-truth.ts` → `resolveEventMoney`, shipped read-only in BUD-1).
 * Slices BUD-2..BUD-10 each put one more surface behind this flag, so a couple
 * never sees half the app on the new arithmetic and half on the old.
 *
 * While OFF every wired surface renders byte-identically to pre-BUD-2
 * production — the legacy per-surface formulas still run and the resolver is
 * not even called.
 *
 * NEXT_PUBLIC_ so the same value is readable on the server (the page decides
 * which numbers to compute) and the client (a card labels an estimate as an
 * estimate only when the resolver supplied it) — same pattern as
 * `explore-replan-flag.ts` / `payment-gated-lock.ts`. Off by default; the owner
 * flips it after previewing, never in-code.
 */
export function isBudgetTruthEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_BUDGET_TRUTH_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
