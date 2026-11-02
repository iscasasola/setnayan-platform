## 2026-07-09 · style(vendors): unify Shortlist/Build/Compare into one integrated scroll surface

Reworked the couple **Services / Explore** takeover (`ServicesTakeover`) from a one-slot-at-a-time tab switcher into a single, integrated vertical-scroll page. All three slots now render STACKED, each in an anchored `<section>` — `#svc-shortlist` ("Browse the bench") · `#svc-build` ("Build your team") · `#svc-compare` ("Compare saved builds"). Compare defaults COLLAPSED behind a "Show comparison" disclosure (least-used + longest), expandable in place. The sticky section strip is now an in-page anchor nav: selecting a section smooth-scrolls to its anchor and lights the active section via an `IntersectionObserver` scroll-spy.

Composition + navigation only — the `BB_TAB_EVENT` bus, `goToBuildTab`, `TAB_META`, `BUDGET_BUILD_TABS`, and the `?tab=` deep-link contract are UNCHANGED; the bus listener now SCROLLS instead of swapping mounts, so `customer-section-subnav.tsx` (mobile dock) and every `goToBuildTab` caller keep working with ZERO change to their files. Slot component internals (the 3-state Build engine, package cascade-lock, finalize/date-lock gates, calendar-availability intersection, radius reach, `BuildCompare`) are UNTOUCHED — they render as section bodies exactly as before. Single-writer discipline (one live `event_build_picks` + N read-only `budget_builds` snapshots) is preserved. Everything stays behind `isBudgetBuildEnabled()`; the flag-OFF legacy `PlanBudgetAccordion` path is unchanged.

Deferred to follow-up PRs: per-category card fusion of shortlist+build, live fit-badges on shortlist rows, scan-vendor-QR fit-check, reason-labeled shortlist re-filter, the two-column Merkado workspace.

Files: `apps/web/app/dashboard/[eventId]/vendors/_components/services-takeover.tsx`.

SPEC IMPACT: None — UI composition only; no schema, pricing, SKU, or engine change.
