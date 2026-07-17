## 2026-07-18 · feat(studio): Silid — the guided in-app services surface (flag-dark)

New `/dashboard/[eventId]/silid` route: a single guided surface that leads with the Setnayan AI recommendations (phase-aware "what to set up next"), then **Yours** (owned services), then **Add to your day** (sellable features grouped by outcome — "Plan · Your website · Your day captured · Your look & keepsakes"), then the complete **Free to use** layer with the Date Finder as a featured free helper.

Its point is the free layer: every free tool is a real tappable doorway — the six first-class planners (Find your date, Guest List, Budget Planner, Schedule, Checklist, Compare vendors) plus every free catalog SKU — which closes the wayfinding gap the 2026-07-18 doorway audit found (7 of 13 free tools were buried outside the nav). Because the free-SKU list is sourced from `tier === 'free'`, the paid Custom QR SKU correctly does NOT appear as free.

Reuses the proven Studio data layer wholesale — **live admin-catalog prices (never hardcoded)**, bundle-aware/co-host-aware ownership (`eventActiveSkus`), roadmap-aware recommendations, and 0053 event-type surface gating — and the `StudioAppRow` component. So the still-open pricing decisions don't block it (prices read live) and the still-recommended name lives in the single `SILID_NAME` constant (rename = one edit).

Gated behind `NEXT_PUBLIC_SILID='true'` (fail-closed `notFound()` when unset) so the live Studio (`../studio`) is byte-untouched until the owner switches it on. Also adds a `routes.dashboard.checklist` helper (the one free-planner route that lacked one) so no doorway uses a hand-typed path.

Verified: `tsc --noEmit` clean, `next lint` clean, the route compiles (8251 modules) and renders past the flag with the couple-membership auth guard firing correctly; the existing `/studio` is unaffected.

SPEC IMPACT: None. Net-new flag-dark surface, no shipped behavior change. The design + naming recommendation + free-layer audit are already recorded in the corpus (`Event_Studio_Replot_Council_Verdict_2026-07-17.md`, the DECISION_LOG Silid-naming + doorway-audit rows). Turning it on and locking the name/prices remain owner decisions.
