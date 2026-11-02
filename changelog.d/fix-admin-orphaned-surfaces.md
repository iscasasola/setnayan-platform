## 2026-07-12 · fix(admin): resolve the 3 nav-orphaned admin surfaces + honest hero-video labeling

Follow-through on the 2026-07-12 page-layer hygiene audit's owner decisions —
the three admin surfaces that were nav-orphaned but NOT safe to bare-delete:

- **/admin/demand — WIRED, not deleted.** Demand Radar (the all-markets demand
  read behind the vendor Market Intel Pro-and-up feature, owner-locked
  2026-07-11) was fully functional but never menued since creation. Now a
  proper item in the App Performance sidebar group (beside Intelligence,
  `Signal` icon, matchPrefix `/admin/demand`) + an admin-nav-descriptions
  entry; the More landing picks it up automatically from ADMIN_NAV_GROUPS.
- **/admin/insights — MERGED then redirected.** The stale 6-tab-era mobile
  landing grid was the SOLE render surface for the Peso-per-Lead ROI and
  Won/Lost vendor unit-economics cards (Wave 6). Both cards + their fetchers
  (`fetchAdminPesoOverview` / `fetchAdminOutcomeOverview`) moved into the App
  Performance studio's Intelligence tab (components re-homed to
  `app-performance/_components/`); `/admin/insights` is now a redirect stub →
  `/admin/app-performance?tab=intelligence` (pattern: /admin/queues → /admin/work).
  No analytics lost.
- **/admin/marketing — redirect stub.** The Marketing lane folded into Studio
  on 2026-07-04; the leftover card-grid bookmark landing now `redirect()`s to
  `/admin/studio`. The two dangling refs removed in the same change: the
  `'/admin/marketing'` activeMatch in admin-bottom-nav.tsx and the dead
  `admin.bottom-nav.marketing` seed in nav-registry-defaults.ts.
- **Hero-video relabel (cosmetic).** `lib/hero-video.ts` + `/admin/hero-video`
  only feed the /login left-panel still image since the ELN reskin — the
  homepage hero runs on `lib/background-videos.ts`. The admin surface no
  longer claims to control the homepage: nav description + uploader
  empty-state copy now say sign-in-page hero still. Files kept (live).

Verified: tsc + lint clean; all three routes respond 307 (auth bounce) with
zero 500s on a local dev server; card move is prop-identical.

SPEC IMPACT: corpus DECISION_LOG.md 2026-07-12 row (admin-surface resolutions;
closes 4 of the 5 audit owner-decisions — the 5th, /admin/background-videos
nav re-link, ships with reskin Phase 5).
