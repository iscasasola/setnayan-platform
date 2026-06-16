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

import { Gauge, Bookmark, Hammer, Scale, Lock, type LucideIcon } from 'lucide-react';

/** The five section tabs of the Services takeover, in order. */
export const BUDGET_BUILD_TABS = ['summary', 'shortlist', 'build', 'compare', 'lock'] as const;
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
  summary: {
    label: 'Summary',
    icon: Gauge,
    blurb: 'Your build at a glance — progress, budget used, and what comes next.',
  },
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
  compare: {
    label: 'Compare',
    icon: Scale,
    blurb: 'Put your saved builds side by side — and see which dates work.',
  },
  lock: {
    label: 'Lock',
    icon: Lock,
    blurb: 'Finalize the vendors for your wedding.',
  },
};

/**
 * Cross-surface tab bus. Any slot OR the docked section sub-nav can request a
 * tab switch without a server round-trip by dispatching this event; the
 * `ServicesTakeover` listens and switches its panel, and the docked sub-nav
 * listens to stay lit. Lives here (next to `BUDGET_BUILD_TABS`) so the takeover
 * (page subtree) and the dock (layout subtree) share one channel without a
 * cross-`_components` import. `services-takeover.tsx` re-exports both for its
 * existing consumers (`build-compare.tsx`, `build-picks-list.tsx`).
 */
export const BB_TAB_EVENT = 'bb:tab';
export function goToBuildTab(tab: BudgetBuildTab) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BB_TAB_EVENT, { detail: tab }));
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
