## 2026-06-28 · chore(dashboard): delete the dead PlanningGroups grid cluster + its now-unused data-prep

The 12-card `PlanningGroups` planning grid was unmounted from the couple event
home on 2026-06-02 (`c87ac2b5c` "lean couple event-home", owner directive) but
the component + its supporting tree were left in the tree. A repo-wide grep
found **zero** JSX usages and **zero** imports of `planning-groups.tsx` outside
itself — every surviving reference was a stale comment. That commit explicitly
deferred this cleanup ("the now-dead server-side data-prep … can be pruned for a
real load-time win"); this is that follow-up. Verified intentional retirement
(not an accidental unmount), so the cluster is deleted.

**Deleted (9 dead component files · ~2,400 LOC)** — the whole cluster only
`planning-groups.tsx` consumed:
- `planning-groups.tsx` (1,555 lines: `GroupCard`, `LockedCard`,
  `LockedVendorAvatar`, `CompatibilityChip`, `AutoCascadedChip`,
  `PaperworkSubLink`, `FromPackageBadge`, …)
- `directions-buttons.tsx` · `plan-card-ctas.tsx` · `officiant-parish-ctas.tsx`
  · `plan-card-compare.tsx` · `plan-card-lock.tsx` · `recommended-vendor-row.tsx`
  · `switch-vendor-confirm.tsx` · `manual-vendor-dropdown.tsx`

**Pruned dead lib exports** in `lib/wedding-plan-groups.ts` (1,731 → 1,304
lines) — all verified planning-groups-only consumers: `PLAN_GROUP_TIER_LABEL`,
`PLAN_GROUP_TIER_HINT` + `CEREMONY_HINTS`/`resolvePlanGroupHint`, the whole
cross-category section (`CrossCategoryRecommendation`/`CrossCategoryInput`/
`buildCrossCategoryRecommendations` + local `isVendorCategory`), and the DIY
dynamic-cells section (`AddACategoryEntry`/`getCustomPlanGroups`).

**Pruned dead data-prep** in `app/dashboard/[eventId]/page.tsx`: the
`crossCategoryRecommendations` computation (computed, never read) + its
`compatibilityFetches[4]` `vendor_services` cross-category fetch — a per-render
Singapore round-trip that fed only the removed grid. Home `event_vendors` fetch
and its compat enrichment stay (still feed `TodaysOneThing` + `FinalizedChipStrip`
+ the lock count).

**Kept (still live, despite the task framing):** `bucketVendorsByGroup` (4 call
sites: Vendors tab, `vendors-plan-budget.ts`, `todays-one-thing.ts`),
`PLAN_GROUPS`, `PLAN_GROUP_TIER_ORDER`, `buildPlanGroupSearchHref`,
`isCeremonyType`, `targetDateStatus`, `new-manual-vendor-modal.tsx`,
`lock-milestone.tsx`. The Chinese tea-ceremony tile added for PR-F is unaffected
— it already renders on the Home page (`page.tsx`), not via the deleted grid.

**Comment hygiene:** rewrote ~18 stale comments across `page.tsx`, `loading.tsx`,
`vendors/actions.ts`, `todays-one-thing.tsx`, `lib/todays-one-thing.ts`,
`lib/wedding-plan-groups.ts`, `explore/page.tsx`, `explore/actions.ts`,
`finalized-chip-strip.tsx`, `workspace/page.tsx`, `_overview-tile.tsx` that
described `PlanningGroups` as a live/currently-rendering surface or current
consumer.

No user-visible behavior change — the grid never rendered. typecheck + lint +
production build all green; home route compiles (`/dashboard/[eventId]` 9.36 kB).

SPEC IMPACT: None. Pure dead-code removal executing the deferred follow-up of the
already-decided 2026-06-02 lean-home restructure; no SKU, schema, or product
surface changes. A one-line DECISION_LOG row records the retire-vs-remount call.
