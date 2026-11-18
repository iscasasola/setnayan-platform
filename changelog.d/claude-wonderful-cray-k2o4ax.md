## 2026-11-18 · fix(couple): W4 walk B2–B4 — Guests carousel no longer widens the page, a loading copy draws no counts, one days-to-go number

From the W4 couple-side walk of live `fbd1fae`.

- **B2 · Guests overflow (406 > 390 px).** `.carousel` in `components/snap-carousel.module.css` now has `max-width: 100%; overflow-x: clip`, so the summary slides cannot widen the page. Guard: `lib/the-snap-carousel-never-widens-the-page.test.ts`. The CSS source is guarded; the exact pixel at 390 px was not re-measured in a browser here.
- **B3 · Guests wrong numbers while loading.** While the phone's old copy of the list is on screen (`copy.freshness === 'updating'`) its rows stay but the counts strip is a quiet placeholder (`data-roster-counts-waiting`), so "Total guests 1 · 8% replied" can no longer read as real. A failed refresh keeps its counts (dimmed, "may be out of date"); a fresh list is unchanged. Guard: `guests/a-loading-copy-never-draws-counts-as-real.test.ts`.
- **B4 · "212 days to go" (Home) vs "213" (Schedule).** Schedule subtracted calendar days; Home uses the countdown's rule (whole days of real time left). New shared `daysToGoCount` in `lib/countdown-target.ts`, read by Schedule. Guard: `lib/days-to-go-is-one-calculation.test.ts`.
- **B1 and B5: no code change.** B1's named controls already wear the shared 46 px halos (`.ab::after`, `.sn-hit`, `.sn-hit-2d`, `.hc-tiny::before`) that a bounding-box measure cannot see; B5 needs an owner call (two different denominators). See the PR.

SPEC IMPACT: None.
