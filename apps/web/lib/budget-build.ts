/**
 * Budget "Build" — Services 5-tab takeover feature flag.
 *
 * Design: `Budget_Build_Services_Takeover_2026-06-08.md` (spec corpus). The
 * couple's Services tab (`/dashboard/[eventId]/vendors`) becomes a full-screen
 * FOCUS MODE takeover — Summary · Shortlist · Build · Compare · Lock — mirroring
 * the Guests takeover (global-nav suppression + a floating X → event Home).
 *
 * LIVE by default — owner activated 2026-06-09 ("build it to the website"). The
 * takeover IS the production Services experience now. To DISABLE without a revert,
 * set `BUDGET_BUILD_ENABLED=false` (env) — `/explore` then falls back to the
 * `PlanBudgetAccordion` + global bottom nav exactly as before (the kill-switch).
 *
 * Phase rollout (see the spec §): Phase 1 = this shell (tabs + takeover chrome,
 * Shortlist houses today's accordion); Phases 2–5 fill Build (the allocator),
 * Compare, Summary, and Lock.
 */

/** The five section tabs of the Services takeover, in order. */
export const BUDGET_BUILD_TABS = ['summary', 'shortlist', 'build', 'compare', 'lock'] as const;
export type BudgetBuildTab = (typeof BUDGET_BUILD_TABS)[number];

/**
 * Is the Services "Build" takeover active? LIVE by default (owner 2026-06-09).
 * Returns false ONLY when `BUDGET_BUILD_ENABLED=false` is explicitly set — the
 * kill-switch. Read server-side and passed down as a prop (NOT `NEXT_PUBLIC_*` —
 * client surfaces receive it from the server layout/page).
 */
export function isBudgetBuildEnabled(): boolean {
  return process.env.BUDGET_BUILD_ENABLED !== 'false';
}
