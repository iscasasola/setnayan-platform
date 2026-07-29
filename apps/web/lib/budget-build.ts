/**
 * Budget "Build" — Services takeover feature flag.
 *
 * Design: `Budget_Build_Services_Takeover_2026-06-08.md` (spec corpus). The
 * couple's Services tab (`/dashboard/[eventId]/vendors`) becomes a full-screen
 * FOCUS MODE takeover — Shortlist · Build · Compare — mirroring the
 * Guests takeover (global-nav suppression + a floating X → event Home). The
 * standalone "Summary" cover tab was REMOVED 2026-06-25 (owner "start with
 * shortlist right away"): the workspace now opens directly on the Shortlist
 * bench, and the Setnayan AI toggle that lived on Summary moved into the
 * Shortlist header so no control was lost.
 * lock action + locked-service list moved INTO the Build tab 2026-06-20 ("Build
 * absorbs Lock" — Vendor_Transaction_Lifecycle_2026-06-20.md Phase 1 PR2), so
 * the standalone fifth "Lock" tab is gone.
 *
 * LIVE by default — owner activated 2026-06-09 ("build it to the website"). The
 * takeover IS the production Services experience now. To DISABLE without a revert,
 * set `BUDGET_BUILD_ENABLED=false` (env) — `/explore` then falls back to the
 * `PlanBudgetAccordion` + global bottom nav exactly as before (the kill-switch).
 *
 * Phase rollout (see the spec §): Phase 1 = this shell (tabs + takeover chrome,
 * Shortlist houses today's accordion); Phases 2–5 fill Build (the allocator +
 * lock), Compare, and Summary.
 */

import { Bookmark, Hammer, Wallet, Scale, type LucideIcon } from 'lucide-react';
import { isExploreReplanEnabled } from './explore-replan-flag';

/**
 * The four section tabs of the Services takeover, in order.
 *
 * The standalone "Lock" tab was REMOVED 2026-06-20 ("Build absorbs Lock" —
 * Vendor_Transaction_Lifecycle_2026-06-20.md Phase 1 PR2): the lock action +
 * the locked-service display now live inside the Build tab, so the couple's
 * whole assemble→lock loop happens in one place. `BuildLocked` renders below
 * `Build3StateControl` in the Build slot.
 */
export const BUDGET_BUILD_TABS = ['shortlist', 'build', 'budget', 'compare'] as const;
export type BudgetBuildTab = (typeof BUDGET_BUILD_TABS)[number];

/**
 * Per-tab display metadata — the SINGLE source for both the takeover's own tab
 * strips (desktop `.sn-seg` + `TabStub`) AND the docked mobile section sub-nav
 * (`vendors-section-subnav.tsx`), so the two can't drift on label/icon. Lifted
 * out of `services-takeover.tsx` 2026-06-16 when the <SubNav> moved up to the
 * event layout (so the sub-nav renders before the takeover's server data).
 * Importing the icon components here is server-safe — lucide glyphs are inert
 * React components until rendered, and this module's only server importer
 * (`vendors/page.tsx`) never renders them.
 */
export const TAB_META: Record<
  BudgetBuildTab,
  { label: string; icon: LucideIcon; blurb: string }
> = {
  shortlist: {
    label: 'Shortlist',
    icon: Bookmark,
    blurb: 'The bench — every service you are considering.',
  },
  build: {
    label: 'Build',
    icon: Hammer,
    blurb: 'Assemble a plan that fits your budget, date and guest count.',
  },
  budget: {
    label: 'Budget',
    icon: Wallet,
    blurb: 'Your budget, allotments and every vendor payment — in one place.',
  },
  compare: {
    label: 'Compare',
    icon: Scale,
    blurb: 'Put your saved builds side by side — and see which dates work.',
  },
};

/**
 * The Explore-Replan display label for a tab (`Explore_Integration_BUILD_SPEC_2026-07-29.md`
 * §2, executing `Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-F).
 *
 * Two renames, one word per concept:
 *   - `compare` → **"Plans"** — the couple saves NAMED plans, loads one back,
 *     and compares them side by side; "Compare" named the view, not the thing.
 *   - `budget` → **"Payments"** — on THIS page the section is the payments lens
 *     ("what's paid, what's due"). "Budget" is the money TARGET and belongs to
 *     the tile + `/budget`, the canonical editor. One word, one concept.
 *
 * LABEL ONLY: the tab KEYS stay `'compare'` / `'budget'`, so `?tab=` deep links,
 * the `BB_TAB_EVENT` bus, the `#svc-*` anchors and the
 * `customer.budget-subnav.*` nav slots are all untouched. Every label consumer
 * (the mobile section sub-nav via `customer-menu.ts`, the takeover's own
 * `SectionStub`) reads through here so the two can't drift.
 *
 * Flag-gated: with `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED` off this returns exactly
 * `TAB_META[tab].label`, i.e. today's production strings.
 */
export function tabLabel(tab: BudgetBuildTab): string {
  if (isExploreReplanEnabled()) {
    if (tab === 'compare') return 'Plans';
    if (tab === 'budget') return 'Payments';
  }
  return TAB_META[tab].label;
}

/**
 * The Explore-Replan sub-heading for a tab — the `tabLabel` counterpart for
 * `TAB_META[tab].blurb`, so a renamed section can't keep the old section's
 * sentence. Only `budget` moves: the section is the payments lens, and the
 * budget TARGET is set at `/dashboard/[eventId]/budget` (the canonical editor),
 * which is exactly where the lens's own link points.
 *
 * Flag-gated the same way — OFF returns `TAB_META[tab].blurb` verbatim.
 */
export function tabBlurb(tab: BudgetBuildTab): string {
  if (tab === 'budget' && isExploreReplanEnabled()) {
    return 'What’s paid, what’s due — and the doorway to your full budget.';
  }
  return TAB_META[tab].blurb;
}

/**
 * Cross-surface tab bus. Any slot OR the docked section sub-nav can request a
 * tab switch without a server round-trip by dispatching this event; the
 * `ServicesTakeover` listens and switches its panel, and the docked sub-nav
 * listens to stay lit. Lives here (next to `BUDGET_BUILD_TABS`) so the takeover
 * (page subtree) and the dock (layout subtree) share one channel without a
 * cross-`_components` import. `services-takeover.tsx` re-exports both for its
 * existing consumer (`build-compare.tsx`).
 */
export const BB_TAB_EVENT = 'bb:tab';
export function goToBuildTab(tab: BudgetBuildTab) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BB_TAB_EVENT, { detail: tab }));
  }
}

/**
 * Rename bus — the SAME pattern as `BB_TAB_EVENT`, for the same reason.
 *
 * "Save current as a plan" moved from the Plans panel to "Your team" on
 * 2026-07-29 (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §3 item 6). The
 * Plans panel's shipped **Rename** control worked by loading the plan's name
 * into that Save-As bar with itself pre-selected as the overwrite target — pure
 * `setState`, which stops working the moment the bar lives in a sibling
 * component. The spec doesn't mention the coupling; this is what keeps Rename
 * working rather than quietly losing it.
 *
 * Deliberately NOT new machinery: one CustomEvent, declared beside the tab bus
 * that `build-compare.tsx` and `team-controls.tsx` already jump over.
 */
export const BB_RENAME_PLAN_EVENT = 'bb:rename-plan';
export type RenamePlanRequest = { buildId: string; name: string };
export function requestPlanRename(req: RenamePlanRequest) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BB_RENAME_PLAN_EVENT, { detail: req }));
  }
}

/**
 * Is the Services "Build" takeover active? LIVE by default (owner 2026-06-09).
 * Returns false ONLY when `BUDGET_BUILD_ENABLED=false` is explicitly set — the
 * kill-switch. Read server-side and passed down as a prop (NOT `NEXT_PUBLIC_*` —
 * client surfaces receive it from the server layout/page).
 */
export function isBudgetBuildEnabled(): boolean {
  return process.env.BUDGET_BUILD_ENABLED !== 'false';
}
