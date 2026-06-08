/**
 * Budget "Build" — Services 5-tab takeover feature flag.
 *
 * Design: `Budget_Build_Services_Takeover_2026-06-08.md` (spec corpus). The
 * couple's Services tab (`/dashboard/[eventId]/vendors`) becomes a full-screen
 * FOCUS MODE takeover — Summary · Shortlist · Build · Compare · Lock — mirroring
 * the Guests takeover (global-nav suppression + a floating X → event Home).
 *
 * Shipped behind this flag, DEFAULT OFF — same posture as
 * `SETNAYAN_AI_PAYWALL_ENABLED` / `WEBSITE_PHASES_ENABLED`. While off, `/vendors`
 * renders exactly as today (the `PlanBudgetAccordion` + the global bottom nav),
 * so merging to production changes nothing until the owner flips
 * `BUDGET_BUILD_ENABLED=true` (env — a config change, not a deploy) and previews.
 *
 * Phase rollout (see the spec §): Phase 1 = this shell (tabs + takeover chrome,
 * Shortlist houses today's accordion); Phases 2–5 fill Build (the allocator),
 * Compare, Summary, and Lock.
 */

/** The five section tabs of the Services takeover, in order. */
export const BUDGET_BUILD_TABS = ['summary', 'shortlist', 'build', 'compare', 'lock'] as const;
export type BudgetBuildTab = (typeof BUDGET_BUILD_TABS)[number];

/**
 * Is the Services "Build" takeover active? Default OFF. Env-driven so the flip
 * is a config change, not a deploy. Read server-side and passed down as a prop
 * (the flag is intentionally NOT `NEXT_PUBLIC_*` — client surfaces receive it
 * from the server layout/page so it never leaks into the client bundle as env).
 */
export function isBudgetBuildEnabled(): boolean {
  return process.env.BUDGET_BUILD_ENABLED === 'true';
}
