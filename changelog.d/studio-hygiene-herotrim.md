## 2026-07-11 · chore(studio): dead-code hygiene + Studio hero trim (4→1)

The no-decision, low-risk tier of the Studio/IA plan (a 3-investigator + architect + adversarial-critic workflow). All zero-caller / exact-path claims were re-verified by hand before deleting (the critic flagged two traps — a name collision on the `routes.ts` helpers and a live *vendor* `desktop-redirect.tsx` twin — both avoided).

**Hygiene sweep (dead code, zero callers):**
- Removed `studioFreeTools()` + the `StudioFreeTool` type from `lib/add-ons-catalog.ts` (imported nowhere) and the now-unused `Users` / `Wallet` / `CalendarClock` icon imports (`LayoutGrid` kept — still used by the seating entry).
- Removed the dead `routes.dashboard.addOns.animatedMonogram` + `addOns.detail` helpers from `lib/routes.ts` (zero callers — the Studio hub routes add-ons via the catalog's `addOnHref`/`appStoreDetailHref`; `patiktok.detail` is a different, live helper and was left intact).
- Deleted two orphaned `/more`-era components: `app/dashboard/[eventId]/_components/customer-mobile-landing.tsx` + `.../desktop-redirect.tsx` (importer-free; the live vendor `desktop-redirect.tsx` twin under `app/vendor-dashboard/more/` is untouched).

**Hero trim (render-only, hides nothing):**
- `studio/page.tsx`: only the FIRST "Browse everything" section now renders the tall gradient `StudioFeaturedCard`. The other three sections demote their flagship to a normal row at the top of the list — cutting ~3 full-width hero cards of vertical scroll (worst on mobile, where the in-page tab strip is hidden) with nothing hidden and no catalog/nav edits.

Verified: typecheck + lint clean; full lib suite 1427 green (the widely-imported `routes.ts` + catalog deletions broke nothing); Studio recommendation + catalog tests green. Not browser-verified — the Studio route is auth-gated; CI's production build + Vercel preview cover it.

Skipped by design (per the workflow's honest verdict): the Vendors/Services-tab unification (intentional, owner-locked divergence — "no real problem"). Still open for owner sign-off: the `alaala` entry point (wire-in recommended — it is NOT orphaned, a live `kwento_assignment_nudge` notification deep-links into it, so retiring would break that flow) and the website-section de-dupe.

SPEC IMPACT: None (dead-code removal + render-layer presentation; no SKU, price, schema, route destination, or catalog-content change — no catalog ENTRY was deleted or hidden).
