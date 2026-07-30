## 2026-07-30 · fix(marketplace): the mobile takeover sub-nav is gone — the Coverage Strip is the navigator

Owner complaint #1 on the Explore/Marketplace integration wave: *"why is the
subnav still present?"* `/dashboard/[eventId]/vendors` stopped being switchable
panels on 2026-07-09 — it is one scroll — but the mobile dock kept shipping four
chips (Shortlist · Build · Budget · Plans) that navigated inside a page you can
simply scroll. Executes `Explore_Integration_BUILD_SPEC_2026-07-29.md` §5 (PR-3).

- **`lib/customer-menu.ts`** — the explore menu emits `children`,
  `sectionMatch`, `sectionMatchExact` and `subnavLabel` **only when
  `!isExploreReplanEnabled()`**. `customer-section-subnav.tsx` gates on both
  (`inSection` is `children.length > 0`, and `matchesMenuSection` needs
  `sectionMatch`), so with the flag ON it returns null on `/vendors` — while
  **Studio's anchor dock and the Guests journey dock are untouched**. Flag OFF
  is byte-identical to production before this change, so the flag stays an
  honest kill-switch.
- **Side benefit, no code:** the global bottom nav un-collapses back to
  icons+labels on this route. It shrinks only while `html.subnav-docked` is set,
  and that class is now never applied here — mobile drops from two stacked bars
  to one.
- **Nothing is stranded.** Shortlist was a no-op (the page opens there) · Build
  is replaced by the mobile team summary chip (PR-4, next) · Budget is reachable
  from the sidebar's "Also in this event → Budget" (`customer-nav-config.ts`)
  and Overview → checklist → "Review your budget" · Plans is reachable by scroll
  and its own disclosure.
- **The `?tab=` deep link and the `BB_TAB_EVENT` bus are NOT touched.**
  `services-takeover.tsx` imports nothing from `customer-menu` — it owns both
  contracts itself, and `goToBuildTab` keeps working for the cross-section jumps
  (Compare→Build, Build→Lock).
- Tests: four new cases in `lib/customer-menu.test.ts` pin the flag-OFF shape
  (4 tab children + their `customer.budget-subnav.*` registry slots), the
  flag-ON absence, that the bottom-nav tab still lights on `/vendors`, and that
  Studio/Guests are unaffected in both states. Full unit suite green (5384).

SPEC IMPACT: None. This *implements* the already-owner-approved
`Explore_Integration_BUILD_SPEC_2026-07-29.md` §5; no SKU, pricing, schema or
policy change. The build spec's remaining-work list is updated in the corpus
handoff (`WHATS_NEXT_Explore_Marketplace_2026-07-29.md` §4.2 → done).
